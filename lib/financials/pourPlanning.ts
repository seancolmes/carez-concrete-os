import {financialRequestId} from './commands.ts';
export const pourPlanningFields={
 create_plan:['project_id','budget_section_id','change_order_id','name','scheduled_date','expected_concrete_yards','contingency_percent','minimum_cash_buffer','company_cash_support','notes'],
 update_plan:['expected_updated_at','pour_plan_id','name','scheduled_date','expected_concrete_yards','contingency_percent','minimum_cash_buffer','company_cash_support','notes'],
 add_cost:['expected_updated_at','pour_plan_id','item_type','cost_code_id','catalog_item_id','description','quantity','unit','unit_cost','committed','vendor_name','notes'],
 add_labor:['expected_updated_at','pour_plan_id','crew_member_id','description','regular_hours','overtime_hours','payroll_tax_date','risk_class_code','committed','notes'],
 delete_cost:['expected_updated_at','pour_plan_id','item_id'],close_plan:['expected_updated_at','pour_plan_id','status'],
} as const;
export type PourPlanningCommand=keyof typeof pourPlanningFields;
export function pourPlanningRequest(form:FormData,command:PourPlanningCommand){
 const values:Record<string,string|null>={};
 for(const field of pourPlanningFields[command]){const value=form.get(field);if(value!==null&&typeof value!=='string')throw new Error('Unsupported pour planning value.');values[field]=value?.trim()||null;}
 return{p_request_id:financialRequestId(form),p_command:command,p_values:values};
}
export async function executePourPlanning(client:{rpc:(name:string,args:Record<string,unknown>)=>any},form:FormData,command:PourPlanningCommand){
 const {data,error}=await client.rpc('carez_pour_planning_command_v1',pourPlanningRequest(form,command));
 if(error||data?.ok!==true||!data.id)throw new Error(error?.message||'Pour planning save was not confirmed. Retry the same form.');return data;
}
