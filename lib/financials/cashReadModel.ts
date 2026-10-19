import {financialNumber} from './amount.ts';
export type CashRead={data:Record<string,any>|null;error:unknown};
export function cashFigures(cash:CashRead,payroll:CashRead){
 const value=(key:string)=>cash.error?null:financialNumber(cash.data?.[key]);
 const payrollNeed=payroll.error?null:financialNumber(payroll.data?.total_open_payroll_requirement);
 const obligations=[value('sales_tax_reserve'),payrollNeed,value('open_ap'),value('open_po_commitments'),value('unpaid_company_expense_obligations'),value('manual_reserves')];
 const active=value('active_cash_accounts'),withBalance=value('accounts_with_balance');
 const completeBalances=active!==null&&active>0&&withBalance===active&&Boolean(cash.data?.balance_as_of);
 return{tax:obligations[0],payrollNeed,ap:obligations[2],pos:obligations[3],companyBills:obligations[4],reserves:obligations[5],
  bank:completeBalances?value('bank_cash'):null,safe:completeBalances?value('safe_cash_after_known_obligations'):null,
  spokenFor:obligations.every(n=>n!==null)?obligations.reduce<number>((sum,n)=>sum+n!,0):null,
  completeBalances,
 };
}
