import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {companyExpenseAmount,assertCompanyExpensePostingAvailable} from '../lib/financials/companyExpensePilot.ts';
test('excluded expense writes fail explicitly',()=>assert.throws(assertCompanyExpensePostingAvailable,/unavailable in this controlled pilot/));
test('expense reference values distinguish known zero, missing and failed reads',()=>{
 assert.equal(companyExpenseAmount(0,false),0);assert.equal(companyExpenseAmount('0',false),0);assert.equal(companyExpenseAmount(75,false),75);
 for(const value of [null,undefined,'',' '])assert.equal(companyExpenseAmount(value,false),'Not recorded');
 for(const value of [0,75,null])assert.equal(companyExpenseAmount(value,true),'Unavailable');
 for(const value of ['NaN',false,{}])assert.equal(companyExpenseAmount(value,false),'Unavailable');
});
test('all existing expense mutations enforce exclusion after authentication and before writes',()=>{
 const source=readFileSync('app/cashflow/actions.ts','utf8');
 for(const [name,next] of [['addCompanyExpense','markCompanyExpensePaid'],['markCompanyExpensePaid','voidCompanyExpense'],['voidCompanyExpense','addCashAccount']]){
  const action=source.slice(source.indexOf('export async function '+name),source.indexOf('export async function '+next));
  assert.ok(action.indexOf('await ctx()')<action.indexOf('assertCompanyExpensePostingAvailable()'));
  assert.ok(action.indexOf('assertCompanyExpensePostingAvailable()')<action.indexOf("from('company_expenses')"));
 }
});
