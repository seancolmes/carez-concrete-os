import {financialRequestId} from '../financials/commands.ts';

export const billingFields={
 create_invoice:['project_id','invoice_type','issue_date','due_date','billing_period_start','billing_period_end','po_number','retainage_percent','notes'],
 add_invoice_line:['invoice_id','source_type','change_order_id','description','quantity','unit','unit_price','taxable','notes'],
 delete_invoice_line:['invoice_id','line_id'],
 update_invoice:['invoice_id','issue_date','due_date','billing_period_start','billing_period_end','po_number','terms_text','notes','sales_tax_rate_percent','sales_tax_exempt','sales_tax_jurisdiction','retainage_percent'],
 send_invoice:['invoice_id'],void_invoice:['invoice_id'],
 create_retainage_release:['source_invoice_id','amount','issue_date','due_date'],
 add_payment_milestone:['project_id','award_record_id','label','milestone_type','amount_basis','percent_of_contract','fixed_amount','due_trigger','required_before_start','notes'],
 create_milestone_invoice:['milestone_id','project_id','retainage_percent'],
 delete_payment_milestone:['milestone_id','project_id'],waive_payment_milestone:['milestone_id','project_id','reason'],
} as const;
export type BillingCommand=keyof typeof billingFields;
export function billingRequest(form:FormData,command:BillingCommand){
 const values:Record<string,string|null>={};
 for(const field of billingFields[command]){
  const value=form.get(field);if(value!==null&&typeof value!=='string')throw new Error('Unsupported billing value.');
  values[field]=value?.trim()||null;
 }
 return{p_request_id:financialRequestId(form),p_command:command,p_values:values};
}
export async function executeBillingCommand(client:{rpc:(name:string,args:Record<string,unknown>)=>any},form:FormData,command:BillingCommand){
 const {data,error}=await client.rpc('carez_billing_command_v1',billingRequest(form,command));
 if(error||data?.ok!==true||!data.id)throw new Error(error?.message||'Billing save was not confirmed. Retry the same form.');
 return data;
}
