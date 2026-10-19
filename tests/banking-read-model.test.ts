import test from 'node:test';import assert from 'node:assert/strict';
import {bankingReadModel,bankRows,bankMetric,type BankingReads} from '../lib/banking/readModel.ts';
const reads=():BankingReads=>({summary:{data:{active_connections:0,linked_accounts:0},error:null},reconciliation:{data:{needs_review_count:0,high_confidence_count:0},error:null},accounts:{data:[],error:null,count:0},transactions:{data:[],error:null},connections:{data:[],error:null},changedMatches:{data:null,error:null,count:0}});
test('successful empty records are distinct from zero recorded balance and failed independent reads',()=>{
 const r=reads();let model=bankingReadModel(r);assert.equal(model.needs,0);assert.deepEqual(model.accounts,[]);assert.equal(model.connectedCash,null);assert.equal(model.includedCount,0);
 r.accounts={data:[{active:true,include_in_cash:true,account_type:'depository',cash_balance:0,last_balance_at:'2026-10-19T12:00:00Z'}],error:null,count:1};model=bankingReadModel(r);assert.equal(model.connectedCash,0);
 r.reconciliation.error='failed';model=bankingReadModel(r);assert.equal(model.needs,null);assert.equal(model.connectedCash,0);
 r.accounts.error='failed';model=bankingReadModel(r);assert.equal(model.accounts,null);assert.equal(model.connectedCash,null);assert.equal(model.changedMatches,0);
});
test('incomplete, undated or unknown included balance never supplies a complete total',()=>{
 const r=reads();r.accounts={data:[{active:true,include_in_cash:true,account_type:'depository',cash_balance:null,last_balance_at:'2026-10-19T12:00:00Z'}],error:null,count:1};
 assert.equal(bankingReadModel(r).connectedCash,null);r.accounts.data[0].cash_balance=25;r.accounts.count=2;assert.equal(bankingReadModel(r).connectedCash,null);
 r.accounts.count=1;r.accounts.data[0].last_balance_at=null;assert.equal(bankingReadModel(r).connectedCash,null);
 r.changedMatches.error='failed';assert.equal(bankingReadModel(r).changedMatches,null);
});

test('reconciliation choices require successful complete coverage independently of recorded metrics',()=>{
 assert.deepEqual(bankRows({data:[],error:null,count:0},true),[]);
 assert.equal(bankRows({data:[],error:'failed',count:0},true),null);
 assert.equal(bankRows({data:[{id:'one'}],error:null,count:2},true),null);
 assert.equal(bankRows({data:[{id:'one'}],error:null},false)?.length,1);
 assert.equal(bankMetric({data:{count:0},error:null},'count'),0);
 assert.equal(bankMetric({data:{count:0},error:'failed'},'count'),null);
 assert.equal(bankMetric({data:null,error:null},'count'),null);
});
