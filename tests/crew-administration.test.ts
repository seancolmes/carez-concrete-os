import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCrewMutation,submitCrewMutation} from '../lib/crew/administration.ts';
const request='ee100000-0000-4000-8000-000000000001',member='ee100000-0000-4000-8000-000000000002',company='ee100000-0000-4000-8000-000000000003';
function form(){const fd=new FormData();for(const [key,value] of Object.entries({request_id:request,id:member,expected_revision:'2',name:'Recorded Worker',role:'Finisher',worker_type:'employee',availability_type:'regular',hourly_rate:'0',active:'on',amount:'35.25',effective_date:'2026-10-16',reason:'Recorded terms reviewed'}))fd.set(key,value);return fd;}
function mock(options:any={}){
 const reads:any[]=[],writes:any[]=[],rpcs:any[]=[];
 const client:any={auth:{getUser:async()=>({data:{user:options.anonymous?null:{id:'authenticated-user'}},error:options.authError?{message:'auth failed'}:null})},from:(table:string)=>{
  const query:any={table,filters:[],selection:''};reads.push(query);
  const end=async()=>table==='profiles'?{data:options.missingProfile?null:{company_id:company,role:options.role??'owner'},error:options.profileError?{message:'profile failed'}:null}:table==='crew_rate_history'?{data:[],error:options.historyError?{message:'history failed'}:null}:query.selection==='id,administration_revision'?{data:options.foreign?null:{id:member,administration_revision:options.revision??2},error:options.memberError?{message:'member failed'}:null}:{data:[],error:options.schemaError?{message:'column missing'}:null};
  return {select(columns:string){query.selection=columns;return this;},eq(key:string,value:any){query.filters.push([key,value]);return this;},limit:async()=>end(),maybeSingle:async()=>end()};
 },rpc:async(name:string,args:any)=>{rpcs.push(name);if(name==='carez_crew_administration_contract')return {data:options.unverified?{}:{version:1,atomic_mutations:true},error:options.contractError?{message:'contract missing',code:'PGRST202'}:null};writes.push(args);return {data:options.unconfirmed?null:{crew_member_id:options.wrongResult?request:member},error:options.saveError||options.revision===3?{message:'transaction failed'}:null};}};
 return {client,reads,writes,rpcs};
}
test('unauthenticated, failed company/profile and disallowed roles cannot reach writes',async()=>{
 for(const option of [{anonymous:true},{authError:true},{missingProfile:true},{profileError:true},{role:'employee'},{role:'unknown'}]){const m=mock(option);await assert.rejects(submitCrewMutation(m.client,'create',form()));assert.equal(m.writes.length,0);assert.equal(m.rpcs.length,0);}
});
test('worker schema, history and uninstalled atomic contract failures independently fail closed',async()=>{
 for(const option of [{schemaError:true},{historyError:true},{contractError:true},{unverified:true}]){const m=mock(option);await assert.rejects(submitCrewMutation(m.client,'create',form()),/unavailable/);assert.equal(m.writes.length,0);}
});
test('foreign and failed worker reads never reach mutation',async()=>{
 for(const operation of ['update','rate'] as const)for(const option of [{foreign:true},{memberError:true}]){const m=mock(option);await assert.rejects(submitCrewMutation(m.client,operation,form()));assert.equal(m.writes.length,0);}
});
test('submitted company cannot change scope and only the atomic protocol receives valid input',async()=>{
 for(const operation of ['create','update','rate'] as const){const m=mock({role:'office'}),fd=form();fd.set('company_id','attacker-company');assert.equal(await submitCrewMutation(m.client,operation,fd),member);for(const read of m.reads.filter(x=>x.table!=='profiles'))assert.ok(read.filters.some(([key,value]:any[])=>key==='company_id'&&value===company));assert.equal(m.writes.length,1);assert.equal(m.writes[0].p_request_id,request);assert.equal(m.writes[0].p_operation,operation);assert.equal('p_company_id' in m.writes[0],false);}
});
test('genuine zero survives; missing, blank, nonfinite, negative, excessive and malformed rates reject',async()=>{
 assert.equal(parseCrewMutation('create',form()).values.hourly_rate,0);
 for(const value of ['', 'NaN','Infinity','-1','1.234','100000000','35%','0x10']){const m=mock(),fd=form();fd.set('amount',value);await assert.rejects(submitCrewMutation(m.client,'rate',fd));assert.equal(m.writes.length,0);}
 const fd=form();fd.delete('hourly_rate');assert.throws(()=>parseCrewMutation('create',fd));
});
test('invalid identities, taxonomy, dates and skills never become fallback defaults',()=>{
 for(const [key,value] of [['request_id','bad'],['expected_revision','-1'],['name',''],['worker_type','admin'],['availability_type','seasonal'],['start_date','2026-02-30'],['skills','unrecognized']]){const fd=form();fd.set(key,value);assert.throws(()=>parseCrewMutation('update',fd));}
});
test('failed or unmatched save responses cannot report success',async()=>{
 for(const option of [{saveError:true},{unconfirmed:true},{wrongResult:true}]){const m=mock(option);await assert.rejects(submitCrewMutation(m.client,'update',form()));}
});
test('all mutations carry an explicit terms effective date and audit reason independent of employment start',()=>{
 for(const operation of ['create','update','rate'] as const){const fd=form();fd.set('start_date','2025-01-02');const input=parseCrewMutation(operation,fd);assert.equal(input.values.effective_date,'2026-10-16');assert.equal(input.values.reason,'Recorded terms reviewed');}
 for(const key of ['effective_date','reason']){const fd=form();fd.delete(key);assert.throws(()=>parseCrewMutation('update',fd));}
});
test('the database decides stale revision versus idempotent retry under the same atomic lock',async()=>{
 const stale=mock({revision:3});await assert.rejects(submitCrewMutation(stale.client,'update',form()),/transaction failed/);assert.equal(stale.writes.length,1);
 const retry=mock({revision:4});assert.equal(await submitCrewMutation(retry.client,'update',form()),member);assert.equal(retry.writes[0].p_expected_revision,2);
});
