import {financialRequestId} from '../financials/commands.ts';
const fields=['amount','processing_fee','received_date','payment_method','reference_number','notes'] as const;
export function invoicePaymentRequest(form:FormData){
 const values:Record<string,string|null>={};
 for(const field of fields){const value=form.get(field);if(value!==null&&typeof value!=='string')throw new Error('Unsupported payment value.');values[field]=value?.trim()||null;}
 return{p_request_id:financialRequestId(form),p_invoice_id:String(form.get('invoice_id')||''),p_values:values};
}
export async function executeInvoicePayment(client:{rpc:(name:string,args:Record<string,unknown>)=>any},form:FormData){
 const {data,error}=await client.rpc('carez_record_invoice_payment_v2',invoicePaymentRequest(form));
 if(error||data?.ok!==true||!data.id||!data.allocation_id)throw new Error(error?.message||'Payment was not confirmed. Retry the same form.');
 return data;
}
