// Real two-connection qualification; only an explicitly named disposable local
// release container is accepted. Leaves labeled synthetic records in that DB.
import {spawn} from 'node:child_process';
import {randomBytes,randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const container=process.argv[2];
if(!/^supabase_db_carez-release-\d+-[a-f0-9]{6}$/.test(container||''))throw new Error('Explicit disposable release container required.');
function run(query:string){
 const child=spawn('docker',['exec','-i',container,'psql','-X','-U','postgres','-d','postgres','-At','-v','ON_ERROR_STOP=1'],{windowsHide:true});
 let output='';child.stdout.on('data',part=>output+=part);child.stderr.on('data',part=>output+=part);
 const result=new Promise<{code:number|null;output:string}>((resolve,reject)=>{child.once('error',reject);child.once('close',code=>resolve({code,output}));});
 child.stdin.end(query);return result;
}
async function sql(query:string){const result=await run(query);if(result.code!==0)throw new Error(result.output);return result.output.trim();}
const results=[];
const selected=(process.argv[3]||'same-token,two-tokens-one-crew,acceptance-vs-replacement,replacement-vs-acceptance,expiry-while-waiting').split(',');
for(const mode of ['same-token','two-tokens-one-crew','acceptance-vs-replacement','replacement-vs-acceptance','expiry-while-waiting'].filter(value=>selected.includes(value))){
 const owner=randomUUID(),crew=randomUUID(),first=randomUUID(),second=randomUUID(),token=randomBytes(24).toString('hex'),other=mode==='same-token'?token:randomBytes(24).toString('hex'),name='signup_concurrency_'+randomBytes(6).toString('hex');
 await sql(`begin;insert into auth.users(id,email,raw_user_meta_data) values('${owner}','${owner}@local.invalid','{"company_name":"Local concurrency fixture ${owner}","full_name":"Synthetic Owner","operating_timezone":"UTC"}');
 insert into public.crew_members(id,company_id,name,role,worker_type,is_owner,active) select '${crew}',company_id,'Synthetic concurrent employee','Finisher','employee',false,true from public.profiles where id='${owner}';
 select set_config('request.jwt.claim.sub','${owner}',true);set local role authenticated;select public.carez_issue_employee_invite('${crew}',encode(sha256(convert_to('${token}','UTF8')),'hex'));reset role;
 ${mode!=='two-tokens-one-crew'?'':`insert into public.employee_invites(company_id,crew_member_id,token_hash,employee_name,created_by) select company_id,'${crew}',encode(sha256(convert_to('${other}','UTF8')),'hex'),'Synthetic historical second invitation','${owner}' from public.profiles where id='${owner}';`}
 commit;`);
 const insert=(id:string,t:string)=>`insert into auth.users(id,email,raw_user_meta_data) values('${id}','${id}@local.invalid',jsonb_build_object('employee_invite_token','${t}'));`;
 const issueOther=`select set_config('request.jwt.claim.sub','${owner}',true);set local role authenticated;select public.carez_issue_employee_invite('${crew}',encode(sha256(convert_to('${other}','UTF8')),'hex'));`;
 const firstWork=mode==='replacement-vs-acceptance'?issueOther:mode==='expiry-while-waiting'?`select 1 from public.companies where id=(select company_id from public.profiles where id='${owner}') for update;update public.employee_invites set expires_at=clock_timestamp()+interval '500 milliseconds' where crew_member_id='${crew}';`:insert(first,token);
 const a=run(`set application_name='${name}';begin;${firstWork}select pg_sleep(1.5);commit;`);
 let holding=false;
 for(let attempt=0;attempt<12;attempt++){
  if(await sql(`select count(*) from pg_stat_activity where application_name='${name}' and wait_event='PgSleep';`)==='1'){holding=true;break;}
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 if(!holding){const result=await a;throw new Error('First transaction never reached its held-lock barrier: '+result.output);}
 const b=run(`begin;${mode==='acceptance-vs-replacement'?issueOther:insert(second,mode==='two-tokens-one-crew'?other:token)}commit;`);
 const [left,right]=await Promise.all([a,b]);assert.equal(left.code,0,left.output);assert.notEqual(right.code,0);assert.match(right.output,mode==='acceptance-vs-replacement'?/without a linked login/:/invite cannot be used/);
 const observed=JSON.parse(await sql(`select jsonb_build_object('accepted_profiles',(select count(*) from public.profiles where id in ('${first}','${second}')),'accepted_auth_users',(select count(*) from auth.users where id in ('${first}','${second}')),'crew_profile',(select profile_id from public.crew_members where id='${crew}'),'consumed',(select count(*) from public.employee_invites where crew_member_id='${crew}' and accepted_at is not null));`));
 const accepted=mode==='replacement-vs-acceptance'||mode==='expiry-while-waiting'?0:1;
 assert.equal(observed.accepted_profiles,accepted);assert.equal(observed.accepted_auth_users,accepted);assert.equal(observed.crew_profile,accepted?first:null);assert.equal(observed.consumed,accepted);
 if(mode==='replacement-vs-acceptance')assert.equal(await sql(`select public.employee_invite_preview('${other}') is not null;`),'t','replacement stays available');
 if(mode==='expiry-while-waiting')assert.equal(await sql(`select public.employee_invite_preview('${token}') is null;`),'t','expired invitation stays unavailable');
 results.push({case:mode,status:'PASS',acceptedAuthUsers:accepted,acceptedCrewBindings:accepted,consumedInvites:accepted});
}
console.log(JSON.stringify({evidence:'Actual concurrent PostgreSQL connections; synthetic local records only',results},null,2));
