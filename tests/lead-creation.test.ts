import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

function actions(path:string,candidate:Record<string,unknown>={}){
 const writes:Array<{table:string;values:any}>=[];
 const supabase={auth:{getUser:async()=>({data:{user:{id:'actor'}}})},rpc:async()=>({data:'SYN-001',error:null}),from:(table:string)=>{
  const query:any={select:()=>query,eq:()=>query,insert:(values:any)=>{writes.push({table,values});return query;},update:()=>query,
   single:async()=>({data:table==='profiles'?{company_id:'company',role:'owner'}:{id:'lead'},error:null}),
   maybeSingle:async()=>({data:{id:'candidate',customer_name:'Synthetic customer',outlook_messages:{},...candidate},error:null})};return query;
 }};
 const denied=()=>{throw new Error('No provider request or navigation expected');};
 const dependencies:Record<string,unknown>={
  'next/cache':{revalidatePath:()=>{}},'next/navigation':{redirect:denied},
  '@/lib/supabase/server':{createClient:async()=>supabase},
  '@/lib/outlook':new Proxy({},{get:()=>denied}),
  '@/lib/provider-mutation-policy':{providerMutationAllowed:()=>false,PROVIDER_MUTATION_DENIED_MESSAGE:'Disabled'},
 };
 const module={exports:{} as Record<string,(form:FormData)=>Promise<void>>};
 const source=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 runInNewContext(source,{module,exports:module.exports,require:(name:string)=>{if(!(name in dependencies))throw new Error(`Unexpected dependency ${name}`);return dependencies[name];},URL},{filename:path});
 return{exports:module.exports,writes};
}

for(const state of ['', ' OR '])test(`manual opportunity preserves ${state?'entered':'missing'} State without inferring a region`,async()=>{
 const {exports:{createLead},writes}=actions('app/leads/actions.ts');const form=new FormData();
 form.set('customer_name','Synthetic customer');form.set('state',state);await createLead(form);
 const lead=writes.find(row=>row.table==='leads')!.values;
 assert.equal(lead.state,state.trim());assert.equal(lead.contact_name,null);assert.equal(lead.company_id,'company');
 assert.match(writes.find(row=>row.table==='lead_activities')!.values.note,/added to PourTrace$/);
});
for(const state of [null,' CA '])test(`Outlook candidate preserves ${state?'recorded':'missing'} State without a default`,async()=>{
 const {exports:{createLeadFromCandidate},writes}=actions('app/leads/inbox/actions.ts',{state});const form=new FormData();form.set('candidate_id','candidate');
 await createLeadFromCandidate(form);
 const lead=writes.find(row=>row.table==='leads')!.values;
 assert.equal(lead.state,state?.trim()??'');assert.equal(lead.company_id,'company');assert.equal(lead.source,'outlook');
});
