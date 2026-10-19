import {financialNumber} from '../financials/amount.ts';

type Read<T>={data:T|null;error:unknown|null};
type Row=Record<string,unknown>;
/** Printing requires the recorded summary and the complete, loaded line set. */
export function invoiceDocumentState(summary:Read<Row>,lines:Read<Row[]>&{count:number|null}){
 const summaryAvailable=!summary.error&&summary.data!==null;
 const summaryComplete=summaryAvailable&&['subtotal','sales_tax','retainage_held','invoice_total','amount_paid','balance_due'].every(key=>financialNumber(summary.data?.[key])!==null)&&summary.data?.payment_basis_status==='known';
 const linesComplete=!lines.error&&lines.data!==null&&lines.count===lines.data.length&&lines.data.every(row=>['quantity','unit_price','line_amount'].every(key=>financialNumber(row[key])!==null));
 return {summaryAvailable,summaryComplete,linesComplete,canPrint:summaryComplete&&linesComplete};
}
