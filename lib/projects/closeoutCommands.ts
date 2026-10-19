import {financialRequestId} from '../financials/commands.ts';
const confirmations=['punch_complete','timecards_complete','purchase_orders_closed','vendor_bills_complete','change_orders_complete','customer_billed_complete','customer_paid_complete','documents_complete','warranty_sent'] as const;
export const closeoutCommandFields={ensure:['project_id'],save_checklist:['project_id','expected_updated_at',...confirmations,'closeout_notes'],complete:['project_id','expected_updated_at'],reopen:['project_id','expected_project_updated_at','reopen_reason']} as const;
export type CloseoutCommand=keyof typeof closeoutCommandFields;
export function closeoutRequest(form:FormData,command:CloseoutCommand){
 const values:Record<string,string|null>={};for(const key of closeoutCommandFields[command]){const value=form.get(key);if(value!==null&&typeof value!=='string')throw new Error('Unsupported closeout value.');values[key]=value?.trim()||null;}
 return{p_request_id:financialRequestId(form),p_command:command,p_values:values};
}
export async function executeCloseoutCommand(client:{rpc:(name:string,args:Record<string,unknown>)=>any},form:FormData,command:CloseoutCommand){
 const {data,error}=await client.rpc('carez_project_closeout_command_v1',closeoutRequest(form,command));
 if(error||data?.ok!==true||!data.id)throw new Error(error?.message||'Closeout save was not confirmed. Retry the same form.');return data;
}
