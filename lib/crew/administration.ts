/** Writes require the versioned atomic contract; absent or failed reads never enable them. */
export type CrewMutation='create'|'update'|'rate';
type Client={auth:{getUser():Promise<any>};from(name:string):any;rpc(name:string,args?:Record<string,unknown>):PromiseLike<{data:any;error:any}>};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const skills=['Formwork','Rebar','Placement','Flatwork','Broom Finish','V-Groove','China Trowel','Hard Trowel','Walls','Foundations','Curb / Gutter','Sawcutting','Layout'];
function text(fd:FormData,key:string,max:number,required=false){
 const raw=fd.get(key);if(raw!==null&&typeof raw!=='string')throw new Error(`Invalid ${key}.`);
 const value=String(raw??'').trim();if((required&&!value)||value.length>max)throw new Error(`Enter a valid ${key.replaceAll('_',' ')}.`);return value||null;
}
function id(fd:FormData,key:string){const value=text(fd,key,36,true)!;if(!uuid.test(value))throw new Error(`Invalid ${key}.`);return value;}
function choice(fd:FormData,key:string,values:string[]){const value=text(fd,key,40,true)!;if(!values.includes(value))throw new Error(`Invalid ${key}.`);return value;}
function date(fd:FormData,key:string,required=false){const value=text(fd,key,10,required);if(value&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value))throw new Error(`Invalid ${key}.`);return value;}
function rate(fd:FormData,key:string,required=false){const raw=text(fd,key,40,required);if(raw===null)return null;const value=raw.replace(/[$, ]/g,'');if(!/^\d{1,8}(?:\.\d{1,2})?$/.test(value)||!Number.isFinite(Number(value))||Number(value)>99999999.99)throw new Error('Enter a finite nonnegative rate with at most two decimals.');return Number(value);}

export function parseCrewMutation(operation:CrewMutation,fd:FormData){
 const requestId=id(fd,'request_id'),memberId=operation==='create'?null:id(fd,'id');
 const effectiveDate=date(fd,'effective_date',true),reason=text(fd,'reason',1000,true);
 const revision=operation==='create'?null:text(fd,'expected_revision',12,true);if(revision!==null&&(!/^\d+$/.test(revision)||!Number.isSafeInteger(Number(revision))))throw new Error('Invalid worker revision.');
 const expectedRevision=revision===null?null:Number(revision);
 if(operation==='rate')return {requestId,memberId,expectedRevision,values:{amount:rate(fd,'amount',true),effective_date:effectiveDate,reason}};
 const workerType=choice(fd,'worker_type',['employee','owner','subcontractor']),hourly=rate(fd,'hourly_rate'),internal=rate(fd,'internal_field_rate');
 if(workerType==='owner'?internal===null&&hourly===null:hourly===null)throw new Error('Enter the applicable recorded rate.');
 const selectedSkills=[...new Set(fd.getAll('skills').map(value=>{if(typeof value!=='string'||!skills.includes(value))throw new Error('Invalid worker skill.');return value;}))];
 return {requestId,memberId,expectedRevision,values:{effective_date:effectiveDate,reason,name:text(fd,'name',200,true),role:text(fd,'role',120,true),worker_type:workerType,availability_type:choice(fd,'availability_type',['regular','on_call']),hourly_rate:hourly,internal_field_rate:internal,start_date:date(fd,'start_date'),phone:text(fd,'phone',40),default_risk_class_code:text(fd,'default_risk_class_code',30),skills:selectedSkills,active:operation==='create'?true:fd.get('active')==='on'}};
}

export async function submitCrewMutation(client:Client,operation:CrewMutation,fd:FormData){
 const auth=await client.auth.getUser();if(auth.error||!auth.data?.user?.id)throw new Error('Not signed in.');
 const profile=await client.from('profiles').select('company_id,role').eq('id',auth.data.user.id).maybeSingle();
 if(profile.error||!profile.data?.company_id)throw new Error('Company profile unavailable.');
 if(!['owner','office'].includes(profile.data.role))throw new Error('Owner or office access required.');
 const input=parseCrewMutation(operation,fd),companyId=profile.data.company_id;
 const [schema,history,contract]=await Promise.all([
  client.from('crew_members').select('id,worker_type,availability_type,start_date,administration_revision').eq('company_id',companyId).limit(1),
  client.from('crew_rate_history').select('id,crew_member_id,rate_type,amount,effective_date,end_date').eq('company_id',companyId).limit(1),
  client.rpc('carez_crew_administration_contract'),
 ]);
 if(schema.error)throw new Error('Crew administration unavailable: required worker fields could not be loaded.');
 if(history.error)throw new Error('Crew administration unavailable: rate history could not be loaded.');
 if(contract.error||contract.data?.version!==1||contract.data?.atomic_mutations!==true)throw new Error('Crew administration unavailable: the verified atomic save contract is not installed.');
 if(input.memberId){const member=await client.from('crew_members').select('id,administration_revision').eq('company_id',companyId).eq('id',input.memberId).maybeSingle();if(member.error||member.data?.id!==input.memberId)throw new Error('Worker unavailable in this company.');}
 // The database repeats authorization, checks the request identity, and locks the current revision atomically.
 const result=await client.rpc('carez_administer_crew',{p_operation:operation,p_request_id:input.requestId,p_member_id:input.memberId,p_expected_revision:input.expectedRevision,p_values:input.values});
 if(result.error)throw new Error(result.error.code==='PGRST202'?'Crew administration unavailable: the verified atomic save contract is not installed.':result.error.message);
 const resultId=result.data?.crew_member_id;if(typeof resultId!=='string'||!uuid.test(resultId)||(input.memberId!==null&&resultId!==input.memberId))throw new Error('No worker change was confirmed.');return resultId;
}
