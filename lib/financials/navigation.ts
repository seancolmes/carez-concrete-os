export const FINANCIAL_GROUPS = [
  {id:'ledger',label:'Cash & banking',phoneLabel:'Cash',views:[['ledger','Cash position'],['banking','Banking'],['reconcile','Reconcile'],['bank-rules','Bank rules'],['cash-accounts','Cash accounts'],['expenses','Expenses'],['reserves','Protected money'],['pour-funding','Pour funding']]},
  {id:'billing',label:'Billing & invoices',phoneLabel:'Billing',views:[['billing','Billing'],['invoices','Invoices'],['payments','Payments'],['retainage','Retainage'],['billing-setup','Billing setup']]},
  {id:'procurement',label:'Purchasing',phoneLabel:'Purchasing',views:[['procurement','Procurement'],['payables','Payables'],['bills','Vendor bills'],['orders','Purchase orders'],['vendors','Vendors'],['quotes','Quotes']]},
  {id:'labor',label:'Labor & costs',phoneLabel:'Labor',views:[['payroll','Payroll'],['costs','Job costs'],['catalog','Cost catalog'],['work-package-financials','Package financials']]},
] as const;

export const AVAILABLE_FINANCIAL_VIEWS=new Set(['ledger','banking','reconcile','bank-rules','cash-accounts','expenses','reserves','billing','invoices','payments','retainage','billing-setup','costs','catalog','work-package-financials','procurement','payables','bills','orders','vendors','quotes','payroll','pour-funding']);

/** Keep the existing tab-first route contract and per-group default destination. */
export function resolveFinancialView(tab?:string,view?:string){
  const group=FINANCIAL_GROUPS.find(item=>item.id===tab)||FINANCIAL_GROUPS[1];
  const selected=group.views.find(item=>item[0]===view)?.[0]||group.views.find(item=>AVAILABLE_FINANCIAL_VIEWS.has(item[0]))?.[0]||group.views[0][0];
  return {group,selected};
}
