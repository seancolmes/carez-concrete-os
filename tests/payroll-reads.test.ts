import test from 'node:test';
import assert from 'node:assert/strict';
import {optionalPayrollCash,payrollAmount,payrollRead,payrollSum} from '../lib/financials/payrollReads.ts';

test('payroll reads keep independent errors and known records',()=>{
 const known=[{id:'run',gross_wages:0}];
 assert.deepEqual(payrollRead({data:known,error:null}),{available:true,data:known});
 assert.deepEqual(payrollRead({data:[],error:null}),{available:true,data:[]});
 assert.deepEqual(payrollRead({data:null,error:new Error('missing relation')}),{available:false,data:null});
 assert.deepEqual(payrollRead({data:known,error:null}).data,known);
});
test('payroll recorded zeros stay distinct from missing or malformed amounts',()=>{
 for(const value of [0,'0','0.00'])assert.equal(payrollAmount(value),0);
 for(const value of [null,undefined,'',' ','NaN','Infinity',NaN,Infinity,true,{}])assert.equal(payrollAmount(value),null);
 assert.equal(payrollSum(0,'12.5',2),14.5);
 assert.equal(payrollSum(12,null),null);
});
test('optional payroll cash preserves blank and rejects invalid values',()=>{
 assert.equal(optionalPayrollCash(null),null);
 assert.equal(optionalPayrollCash('  '),null);
 assert.equal(optionalPayrollCash('0'),0);
 assert.equal(optionalPayrollCash('125.50'),125.5);
 for(const value of ['NaN','Infinity','-1','1e9','4%','$5','12.345','abc'])assert.throws(()=>optionalPayrollCash(value));
});
