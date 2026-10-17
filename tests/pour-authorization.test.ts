import test from 'node:test';
import assert from 'node:assert/strict';
import {pourAuthorizationRequest,executePourAuthorization} from '../lib/financials/pourAuthorization.ts';
import {financialMoney,completeFinancialSum} from '../lib/financials/amount.ts';
test('pour decisions send a stable request and reviewed fingerprint without client financial amounts',async()=>{
 const fd=new FormData();for(const [key,value] of Object.entries({financial_request_id:'a1100000-0000-4000-8000-000000000001',pour_plan_id:'pour',financial_basis_fingerprint:'recorded-hash',decision:'authorized',override_reason:'Human decision',project_funding_balance:'999999'}))fd.set(key,value);
 const args=pourAuthorizationRequest(fd);assert.equal(args.p_fingerprint,'recorded-hash');assert.equal(args.p_reason,'Human decision');assert.equal((args as any).project_funding_balance,undefined);
 const calls:any[]=[];await executePourAuthorization({rpc:async(name,args)=>{calls.push([name,args]);return{data:{ok:true,id:'snapshot'},error:null};}},fd);assert.equal(calls[0][0],'carez_record_pour_authorization_v1');
 await assert.rejects(executePourAuthorization({rpc:async()=>({data:null,error:{message:'Funding changed'}})},fd),/Funding changed/);
});
test('financial displays retain zero and do not sum missing or unavailable amounts as zero',()=>{
 assert.equal(financialMoney(0),'$0.00');for(const value of [null,undefined,'',NaN,Infinity])assert.equal(financialMoney(value),'Unavailable');
 assert.equal(completeFinancialSum([],'amount'),0);assert.equal(completeFinancialSum(null,'amount'),null);assert.equal(completeFinancialSum([{amount:5},{amount:null}],'amount'),null);assert.equal(completeFinancialSum([{amount:5},{amount:0}],'amount'),5);
});
