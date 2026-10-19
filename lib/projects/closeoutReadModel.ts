import {financialNumber} from '../financials/amount.ts';
type Read={data:any;error:unknown;count?:number|null};
const required=['punch_complete','timecards_complete','purchase_orders_closed','vendor_bills_complete','change_orders_complete','customer_billed_complete','customer_paid_complete','documents_complete'];
export function closeoutReadModel(projectId:string,reads:{checklist:Read;billing:Read;orders:Read;bills:Read;changes:Read;shifts:Read}){
 const count=(read:Read,states:string[])=>{
  const known=!read.error&&Array.isArray(read.data)?read.data.filter(row=>row.project_id===projectId&&states.includes(row.status)).length:0;
  const complete=!read.error&&Array.isArray(read.data)&&typeof read.count==='number'&&read.count===read.data.length;
  return {known,complete,value:complete?known:known>0?`At least ${known}`:null};
 };
 const orders=count(reads.orders,['draft','issued']),bills=count(reads.bills,['draft']),changes=count(reads.changes,['draft','submitted']),shifts=count(reads.shifts,['active','open','submitted']);
 const openPO=orders.value,draftBills=bills.value,openCO=changes.value,openTime=shifts.value;
 const billing=reads.billing.data;
 const billingKnown=!reads.billing.error&&billing?.payment_basis_status==='known'&&financialNumber(billing.outstanding_ar)!==null&&financialNumber(billing.unbilled_contract)!==null;
 const ar=billingKnown?financialNumber(billing.outstanding_ar):null,unbilled=billingKnown?financialNumber(billing.unbilled_contract):null;
 const counts=[orders,bills,changes,shifts];
 const unavailable=Boolean(reads.checklist.error)||!billingKnown||counts.some(n=>!n.complete);
 const blockers=counts.reduce<number>((sum,n)=>sum+n.known,0)+(ar!==null&&ar>0?1:0)+(unbilled!==null&&unbilled>0?1:0);
 const confirmed=Boolean(reads.checklist.data)&&required.every(key=>reads.checklist.data[key]===true);
 return{openPO,draftBills,openCO,openTime,ar,unbilled,unavailable,blockers,confirmed,canComplete:!unavailable&&blockers===0&&confirmed,
  billingStatus:reads.billing.error?'Billing unavailable':!billing?'Billing summary missing':!billingKnown?'Billing basis unavailable':null};
}
