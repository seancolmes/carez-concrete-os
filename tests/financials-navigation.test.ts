import test from 'node:test';
import assert from 'node:assert/strict';
import {FINANCIAL_GROUPS,AVAILABLE_FINANCIAL_VIEWS,resolveFinancialView} from '../lib/financials/navigation.ts';

test('all 23 existing Financials destinations retain their tab and view contracts',()=>{
 const expected={ledger:['ledger','banking','reconcile','bank-rules','cash-accounts','expenses','reserves','pour-funding'],billing:['billing','invoices','payments','retainage','billing-setup'],procurement:['procurement','payables','bills','orders','vendors','quotes'],labor:['payroll','costs','catalog','work-package-financials']};
 for(const group of FINANCIAL_GROUPS){
  assert.deepEqual(group.views.map(([view])=>view),expected[group.id]);
  for(const [view] of group.views){
   const url=new URL(`/financials?tab=${group.id}&view=${view}`,'https://fixture.invalid');
   const result=resolveFinancialView(url.searchParams.get('tab')!,url.searchParams.get('view')!);
   assert.equal(result.group.id,group.id);assert.equal(result.selected,view);assert.equal(AVAILABLE_FINANCIAL_VIEWS.has(view),true);
  }
 }
 assert.equal(AVAILABLE_FINANCIAL_VIEWS.size,23);
});

test('default, invalid and cross-group requests preserve the existing tab-first resolution',()=>{
 for(const tab of [undefined,'unknown'])for(const view of [undefined,'unknown','payroll']){
  const result=resolveFinancialView(tab,view);assert.equal(result.group.id,'billing');assert.equal(result.selected,'billing');
 }
 for(const group of FINANCIAL_GROUPS){
  const first=group.views[0][0];
  for(const view of [undefined,'unknown',...FINANCIAL_GROUPS.filter(other=>other.id!==group.id).flatMap(other=>other.views.map(([id])=>id))]){
   const result=resolveFinancialView(group.id,view);assert.equal(result.group.id,group.id);assert.equal(result.selected,first);
  }
 }
});

test('four primary groups have clear desktop labels and concise phone labels',()=>{
 assert.deepEqual(FINANCIAL_GROUPS.map(group=>[group.label,group.phoneLabel]),[['Cash & banking','Cash'],['Billing & invoices','Billing'],['Purchasing','Purchasing'],['Labor & costs','Labor']]);
});
