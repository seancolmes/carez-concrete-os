import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {companyExpenseAmount,assertCompanyExpensePostingAvailable} from '../lib/financials/companyExpensePilot.ts';
test('qualified expense entry is available behind the governed command',()=>assert.doesNotThrow(assertCompanyExpensePostingAvailable));
test('expense reference values distinguish known zero, missing and failed reads',()=>{
 assert.equal(companyExpenseAmount(0,false),0);assert.equal(companyExpenseAmount('0',false),0);assert.equal(companyExpenseAmount(75,false),75);
 for(const value of [null,undefined,'',' '])assert.equal(companyExpenseAmount(value,false),'Not recorded');
 for(const value of [0,75,null])assert.equal(companyExpenseAmount(value,true),'Unavailable');
 for(const value of ['NaN',false,{}])assert.equal(companyExpenseAmount(value,false),'Unavailable');
});
test('expense mutations use the confirmed cash command and do not issue raw table writes',()=>{
 const source=readFileSync('app/cashflow/actions.ts','utf8');
 assert.doesNotMatch(source,/\.from\('company_expenses'\)/);
 assert.match(source,/await executeCashCommand\(supabase,form,command\)/);
 assert.match(source,/Owner or office access required/);
});
