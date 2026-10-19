import test from 'node:test';import assert from 'node:assert/strict';
import {bankRuleBusinessUse} from '../lib/banking/rules.ts';
test('expense rules preserve explicit zero and reject unavailable or invalid percentages instead of manufacturing100%',()=>{
 assert.equal(bankRuleBusinessUse('0','company_expense'),0);
 assert.equal(bankRuleBusinessUse('37.5','company_expense'),37.5);
 for(const value of [null,'',' ','NaN','Infinity','101','-1'])assert.throws(()=>bankRuleBusinessUse(value,'company_expense'));
 assert.equal(bankRuleBusinessUse(null,'ignore'),100);
});
