import test from 'node:test';import assert from 'node:assert/strict';
import {normalizePlaidAccounts,normalizePlaidPage,makePlaidConnectionSync} from '../lib/banking/plaidSync.ts';
const account={account_id:'bank-a',name:'Synthetic checking',type:'depository',balances:{current:0,available:null}};
const tx={transaction_id:'tx-a',account_id:'bank-a',date:'2026-10-16',amount:0,pending:false,name:'Synthetic transaction'};
const page=(cursor:string,more=false)=>({added:[],modified:[],removed:[],next_cursor:cursor,has_more:more});
const scope={companyId:'company',actorId:'owner',connectionId:'connection'};
function harness(pages:any[],options:{busy?:boolean;lostReceipt?:boolean;badReceipt?:boolean;providerError?:Error}={}){
 const calls:{name:string;args:any}[]=[],requests:{path:string;body:any;signal?:AbortSignal}[]=[];let sequence=0,index=0,lost=false;
 const deps={uuid:()=>`request-${++sequence}`,decrypt:()=> 'synthetic-inert-access',post:async(path:string,body:any,extra?:{signal?:AbortSignal})=>{
  requests.push({path,body,signal:extra?.signal});if(path.startsWith('/accounts/'))return{accounts:[account]};if(options.providerError)throw options.providerError;return pages[index++];
 },writer:{rpc:async(name:string,args:any)=>{
  calls.push({name,args});if(name==='carez_plaid_sync_begin')return{error:null,data:{ok:true,busy:options.busy||false,run_id:'run',lease_token:args.p_lease,generation:0,page_index:0,cursor:null}};
  if(name==='carez_plaid_sync_commit_page'){
   if(options.lostReceipt&&!lost){lost=true;throw new Error('Synthetic acknowledgement loss');}
   return{error:null,data:{ok:true,run_id:args.p_run,page_id:args.p_page_id,generation:args.p_generation,page_index:args.p_page_index+1,cursor:args.p_page.next_cursor,complete:!args.p_page.has_more,changed:options.badReceipt?null:args.p_page.added.length+args.p_page.modified.length+args.p_page.removed.length,accounts:args.p_accounts?.length||0,matched_source_changes:0}};
  }return{error:null,data:{ok:true}};
 }}};
 return {run:makePlaidConnectionSync(deps),calls,requests};
}
test('provider normalization preserves zero and explicit unknown balances without numeric defaults',()=>{
 assert.equal(normalizePlaidAccounts({accounts:[account]})[0].current_balance,0);assert.equal(normalizePlaidAccounts({accounts:[account]})[0].available_balance,null);
 for(const amount of [null,undefined,NaN,Infinity,'0'])assert.throws(()=>normalizePlaidPage({...page('c1'),added:[{...tx,amount}]},null),/amount unavailable/);
 assert.throws(()=>normalizePlaidAccounts({accounts:[{...account,balances:{current:0}}]}),/Complete provider balances/);
 assert.throws(()=>normalizePlaidPage({...page('c1'),added:[tx],removed:[{transaction_id:tx.transaction_id}]},null),/repeated an identity/);
 assert.throws(()=>normalizePlaidPage({...page('c1'),has_more:'false'},null),/Explicit provider state/);
 assert.throws(()=>normalizePlaidPage({...page('c1'),added:[{...tx,date:'2026-02-30'}]},null),/date invalid/);
 assert.throws(()=>normalizePlaidPage(page('c1',true),'c1'),/did not progress/);
});
test('two-page orchestration confirms each page before fetching the next, with a bounded signal',async()=>{
 const h=harness([{...page('c1',true),added:[tx]},page('c2')]);const result=await h.run(scope);
 assert.equal(result.complete,true);assert.equal(result.changed,1);assert.equal(result.accounts,1);
 const commits=h.calls.filter(x=>x.name==='carez_plaid_sync_commit_page');assert.equal(commits.length,2);assert.equal(commits[0].args.p_expected_cursor,null);assert.equal(commits[1].args.p_expected_cursor,'c1');assert.equal(commits[1].args.p_accounts,null);
 assert.equal(h.requests[2].body.cursor,'c1');assert.ok(h.requests.every(x=>x.signal instanceof AbortSignal));
});
test('uncertain page acknowledgement retries the exact same identity and payload once',async()=>{
 const h=harness([{...page('c1'),added:[tx]}],{lostReceipt:true});const result=await h.run(scope);assert.equal(result.changed,1);
 const calls=h.calls.filter(x=>x.name==='carez_plaid_sync_commit_page');assert.equal(calls.length,2);assert.deepEqual(calls[0].args,calls[1].args);assert.equal(h.requests.length,2);
});
test('busy connection does not fetch or acknowledge synchronization',async()=>{
 const h=harness([],{busy:true});const result=await h.run(scope);assert.equal(result.complete,false);assert.equal(result.busy,true);assert.equal(h.requests.length,0);
});
test('page cap is explicitly incomplete and records resumable state',async()=>{
 const h=harness([page('c1',true),page('c2',true)]);const result=await h.run(scope,{pageCap:2});assert.equal(result.complete,false);assert.equal(result.code,'SYNC_PAGE_LIMIT');
 const last=h.calls.at(-1)!;assert.equal(last.name,'carez_plaid_sync_stop');assert.equal(last.args.p_outcome,'incomplete');assert.equal(last.args.p_code,'SYNC_PAGE_LIMIT');
});
test('provider pagination-mutation code survives failure handling; no invented empty completion',async()=>{
 const problem=Object.assign(new Error('Synthetic mutation'),{code:'TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION'});
 const h=harness([],{providerError:problem});await assert.rejects(h.run(scope),/not completed/);assert.equal(h.calls.at(-1)!.args.p_code,problem.code);assert.equal(h.calls.filter(x=>x.name==='carez_plaid_sync_commit_page').length,0);
});
test('malformed completion acknowledgement prevents the next fetch',async()=>{
 const h=harness([page('c1',true),page('c2')],{badReceipt:true});await assert.rejects(h.run(scope),/not completed/);assert.equal(h.requests.length,2);assert.equal(h.calls.at(-1)!.args.p_outcome,'failed');
});
