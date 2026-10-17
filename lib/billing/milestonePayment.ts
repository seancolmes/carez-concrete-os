type InvoicePayment={status?:string;collection_status?:string;payment_basis_status?:string;balance_due?:number|string|null};
/** Presentation of the server's posted-payment result; no client date/rate rules. */
export function milestonePayment(invoice:InvoicePayment|null|undefined){
 if(!invoice||invoice.payment_basis_status!=='known'||invoice.balance_due==null||!Number.isFinite(Number(invoice.balance_due)))return{paid:false,available:false};
 return{paid:invoice.collection_status==='paid'&&!['draft','void'].includes(invoice.status||'')&&Number(invoice.balance_due)<=0.01,available:true};
}
