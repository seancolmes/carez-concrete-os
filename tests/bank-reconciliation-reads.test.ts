import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeBankTransactions} from '../lib/bank-reconciliation.ts';
const tx={id:'local-tx',cash_amount:-12,transaction_date:'2026-10-16',name:'Synthetic vendor',account_id:'local-account'};
function mock(failed:string|null,staleFailed=false,incomplete=false){
 let writes=0,initial=true;
 const client={from(table:string){let mutation=false;
  const q:any={select(){return q;},eq(){return q;},is(){return q;},in(){return q;},gt(){return q;},order(){return q;},limit(){return q;},
   update(){mutation=true;writes++;return q;},insert(){mutation=true;writes++;return q;},
   then(resolve:any,reject:any){
    if(mutation)return Promise.resolve({error:staleFailed?{message:'Synthetic stale failure'}:null}).then(resolve,reject);
    if(table==='plaid_transactions'&&initial){initial=false;return Promise.resolve({data:[tx],error:null}).then(resolve,reject);}
    return Promise.resolve({data:table==='plaid_transactions'?[tx]:[],count:incomplete?2:table==='plaid_transactions'?1:0,error:table===failed?{message:'Synthetic read failure'}:null}).then(resolve,reject);
   }};return q;},rpc(name:string){if(name==='carez_plaid_analysis_status')return Promise.resolve({data:{ok:true,ready:true},error:null});throw new Error('Unexpected automatic write');}};
 return{client,get writes(){return writes;}};
}
test('every failed prerequisite prevents suggestion mutation and automatic matching',async()=>{
 for(const table of ['customers','customer_payments','invoice_financial_summary','vendors','vendor_payments','vendor_bill_ap_summary','company_expenses','payroll_run_financial_summary','company_tax_remittances','bank_reconciliation_rules','overhead_items','plaid_transactions']){
  const m=mock(table);await assert.rejects(analyzeBankTransactions(m.client,'local-company'),/unavailable/);assert.equal(m.writes,0,table);
 }
});
test('successful empty reads are distinct from a failed refresh or incomplete coverage',async()=>{
 const success=mock(null);assert.deepEqual(await analyzeBankTransactions(success.client,'local-company'),{analyzed:1,candidates:0,autoMatched:0,autoApplied:0});assert.equal(success.writes,1);
 const failed=mock(null,true);await assert.rejects(analyzeBankTransactions(failed.client,'local-company'),/could not be refreshed/);assert.equal(failed.writes,1);
 const partial=mock(null,false,true);await assert.rejects(analyzeBankTransactions(partial.client,'local-company'),/incomplete/);assert.equal(partial.writes,0);
});
test('unfinished or unavailable sync prevents even candidate reads and writes',async()=>{
 for(const result of [{data:{ok:true,ready:false},error:null},{data:null,error:{message:'read failed'}},{data:{ok:false,ready:true},error:null}]){
  let reads=0;await assert.rejects(analyzeBankTransactions({rpc:async()=>result,from:()=>{reads++;throw new Error('Must not read a partial feed');}},'company'),/incomplete or unavailable/);assert.equal(reads,0);
 }
});
