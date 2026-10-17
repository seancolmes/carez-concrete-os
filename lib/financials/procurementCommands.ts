import {financialRequestId} from './commands.ts';
export const procurementFields={
 create_vendor:['name','vendor_type','contact_name','email','phone','address_line1','address_line2','city','state','postal_code','payment_terms','account_number','notes'],
 create_quote:['project_id','vendor_id','vendor_quote_number','quote_date','expires_on','budget_section_id','change_order_id','pour_plan_id','notes'],
 add_quote_line:['vendor_quote_id','cost_code_id','catalog_item_id','pour_cost_item_id','description','quantity','unit','unit_cost','sales_tax','notes'],
 delete_quote_line:['vendor_quote_id','line_id'],quote_status:['vendor_quote_id','status'],convert_quote:['vendor_quote_id'],
 create_po:['project_id','vendor_id','expected_delivery_date','budget_section_id','change_order_id','pour_plan_id','delivery_instructions','terms','notes'],
 add_po_line:['purchase_order_id','cost_code_id','catalog_item_id','pour_plan_id','pour_cost_item_id','budget_section_id','change_order_id','description','quantity','unit','unit_cost','sales_tax','notes'],
 delete_po_line:['purchase_order_id','line_id'],issue_po:['purchase_order_id','issue_date'],close_po:['purchase_order_id','status'],
 create_bill:['project_id','vendor_id','purchase_order_id','vendor_bill_number','bill_date','due_date','notes'],
 add_bill_line:['vendor_bill_id','purchase_order_line_id','cost_code_id','catalog_item_id','budget_section_id','change_order_id','pour_plan_id','pour_cost_item_id','description','quantity','unit','unit_cost','sales_tax','notes'],
 delete_bill_line:['vendor_bill_id','line_id'],post_bill:['vendor_bill_id'],void_bill:['vendor_bill_id'],
 receipt:['purchase_order_id','purchase_order_line_id','quantity_received','received_date','delivery_ticket','notes'],
 document_receipt:['id','purchase_order_line_id','quantity_received','received_date','delivery_ticket','notes'],
} as const;
export type ProcurementCommand=keyof typeof procurementFields;
export function procurementRequest(form:FormData,command:ProcurementCommand){
 const requestId=financialRequestId(form),values:Record<string,string|null>={};
 for(const key of procurementFields[command]){const value=form.get(key);if(value!==null&&typeof value!=='string')throw new Error('Unsupported procurement field.');values[key]=value?.trim()||null;}
 return{p_request_id:requestId,p_command:command,p_values:values};
}
export async function executeProcurementCommand(client:{rpc:(name:string,args:Record<string,unknown>)=>any},form:FormData,command:ProcurementCommand){
 const {data,error}=await client.rpc('carez_procurement_command_v1',procurementRequest(form,command));
 if(error||!data?.ok||!data?.id)throw new Error(error?.message||'Procurement save was not confirmed. Retry the same form.');
 return data;
}
