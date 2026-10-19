import assert from 'node:assert/strict';
import test from 'node:test';
import {cashFigures} from '../lib/financials/cashReadModel.ts';
const row={active_cash_accounts:1,accounts_with_balance:1,balance_as_of:'2026-10-16',bank_cash:100,safe_cash_after_known_obligations:50,sales_tax_reserve:0,open_ap:10,open_po_commitments:20,unpaid_company_expense_obligations:0,manual_reserves:5};
test('cash totals require complete recorded balances and all obligation inputs',()=>{
 const a=cashFigures({data:row,error:null},{data:{total_open_payroll_requirement:15},error:null});assert.equal(a.bank,100);assert.equal(a.spokenFor,50);assert.equal(a.tax,0);
 const b=cashFigures({data:{...row,active_cash_accounts:2},error:null},{data:{total_open_payroll_requirement:15},error:null});assert.equal(b.bank,null);assert.equal(b.safe,null);assert.equal(b.spokenFor,50);
});
test('independent payroll and cash failures preserve other known inputs',()=>{
 const a=cashFigures({data:row,error:null},{data:null,error:{message:'failed'}});assert.equal(a.payrollNeed,null);assert.equal(a.spokenFor,null);assert.equal(a.bank,100);assert.equal(a.ap,10);
 const b=cashFigures({data:null,error:{message:'failed'}},{data:{total_open_payroll_requirement:0},error:null});assert.equal(b.payrollNeed,0);assert.equal(b.tax,null);assert.equal(b.spokenFor,null);
 assert.equal(cashFigures({data:null,error:null},{data:null,error:null}).bank,null);
});
