import {financialRequestId} from './commands.ts';
export const cashCommandFields={
 add_expense:['description','overhead_item_id','expense_date','due_date','category','payee','subtotal','sales_tax','business_use_percent','cash_source','payment_status','paid_date','payment_method','reference_number','receipt_reference','notes'],
 pay_expense:['expense_id','expected_updated_at','paid_date','payment_method','reference_number'],
 void_expense:['expense_id','expected_updated_at'],
 add_account:['name','account_type','notes'],
 record_balance:['cash_account_id','balance_date','balance','notes','expected_snapshot_id','expected_revision'],
 add_reserve:['reserve_type','name','amount','due_date','notes'],
 release_reserve:['reserve_id','expected_updated_at'],
 record_remittance:['tax_type','payment_date','amount','reference_number','notes'],
 reverse_remittance:['remittance_id','expected_created_at','reversal_reason'],
} as const;
export type CashCommand=keyof typeof cashCommandFields;
export function cashRequest(form:FormData,command:CashCommand){
 const values:Record<string,string|null>={};
 for(const key of cashCommandFields[command]){const value=form.get(key);if(value!==null&&typeof value!=='string')throw new Error('Unsupported cash value.');values[key]=value?.trim()||null;}
 return{p_request_id:financialRequestId(form),p_command:command,p_values:values};
}
export async function executeCashCommand(client:{rpc:(name:string,args:Record<string,unknown>)=>any},form:FormData,command:CashCommand){
 const {data,error}=await client.rpc('carez_cash_command_v1',cashRequest(form,command));
 if(error||data?.ok!==true||!data.id)throw new Error(error?.message||'Cash save was not confirmed. Retry the same form.');
 return data;
}
