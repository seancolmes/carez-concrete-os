import {invoiceCollectionKind} from '../billing/invoiceCollection.ts';
import {completeFinancialSum,financialNumber} from '../financials/amount.ts';
type ReadResult<T> = {data:readonly T[]|null;error:unknown|null};
type BillingRow = {outstanding_ar:unknown};
type InvoiceRow = {collection_status:string|null;balance_due:unknown};

export function dashboardReceivables(billing:ReadResult<BillingRow>,invoices:ReadResult<InvoiceRow>){
  const outstanding=billing.error||billing.data===null?null:completeFinancialSum(billing.data.map(row=>{const amount=financialNumber(row.outstanding_ar);return{outstanding_ar:amount===null?null:Math.max(0,amount)};}),'outstanding_ar');
  let overdue:number|null=invoices.error||invoices.data===null?null:0;
  if(overdue!==null){
    for(const invoice of invoices.data||[]){
      if(invoiceCollectionKind(invoice.collection_status)==='unavailable'){
        overdue=null;
        break;
      }
      if(invoiceCollectionKind(invoice.collection_status)!=='overdue')continue;
      const raw=invoice.balance_due;
      if(raw===null||raw===undefined||raw===''||!Number.isFinite(Number(raw))){
        overdue=null;
        break;
      }
      overdue+=Number(raw);
    }
  }
  return {outstanding,overdue};
}
