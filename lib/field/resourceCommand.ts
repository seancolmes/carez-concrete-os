import {financialRequestId} from '../financials/commands.ts';
export const resourceFields={
 create:['work_package_operation_id','resource_type','label','required_quantity','unit','inventory_item_id','equipment_asset_id','vendor_id','purchase_order_line_id','required_before_start','need_offset_days','need_by_override','vendor_status','vendor_reference','notes','reserve_quantity','reservation_start','reservation_end','equipment_confirmed'],
 reserve_material:['requirement_id','inventory_item_id','quantity'],link_po:['requirement_id','purchase_order_line_id'],consume:['requirement_id'],
 reserve_equipment:['requirement_id','equipment_asset_id','start_date','end_date','confirmed'],vendor:['requirement_id','vendor_id','vendor_status','vendor_reference'],
 waive:['requirement_id','waiver_reason'],restore:['requirement_id'],delete:['requirement_id'],
 create_inventory:['name','category','unit','quantity_on_hand','reorder_point','target_quantity','average_unit_cost','storage_location','notes'],
 adjust_inventory:['inventory_item_id','quantity','transaction_type','project_id','unit_cost','transaction_date','note'],
} as const;
export type ResourceCommand=keyof typeof resourceFields;
export function resourceRequest(form:FormData,command:ResourceCommand){
 const values:Record<string,string|boolean|null>={};
 for(const key of resourceFields[command]){const value=form.get(key);if(value!==null&&typeof value!=='string')throw new Error('Unsupported resource field.');values[key]=['required_before_start','equipment_confirmed','confirmed'].includes(key)?value==='on':value?.trim()||null;}
 return{p_request_id:financialRequestId(form),p_command:command,p_values:values};
}
export async function executeResourceCommand(client:{rpc:(name:string,args:Record<string,unknown>)=>any},form:FormData,command:ResourceCommand){
 const {data,error}=await client.rpc('carez_resource_command_v1',resourceRequest(form,command));if(error||!data?.ok||!data?.id)throw new Error(error?.message||'Resource save was not confirmed. Retry the same form.');return data;
}
