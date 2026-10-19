import {financialRequestId} from '../financials/commands.ts';
export const intelligenceCommandFields={
 save_profile:['lead_id','bid_type','relationship_strength','estimated_competitor_count','customer_budget','customer_budget_source','project_fit_score','relationship_score','scope_clarity_score','capacity_score','margin_potential_score','payment_confidence_score','competition_score','risk_score','estimator_effort_hours','pursuit_decision','pass_reason'],
 record_feedback:['lead_id','estimate_id','feedback_source','competitor_name','competitor_price','scope_comparable','note'],
 add_scope:['lead_id','estimate_id','bid_price_feedback_id','description','carez_status','competitor_status','equalization_amount','note'],
 remove_scope:['item_id'],
 add_value_option:['lead_id','estimate_id','name','customer_description','sell_price_change','company_cost_change','schedule_days_change','function_quality_note','approval_required'],
 update_value_option_status:['option_id','status','estimate_id'],
 record_follow_up:['lead_id','note','next_follow_up'],mark_proposal_sent:['lead_id'],record_outcome:['lead_id','outcome','lost_reason','outcome_note'],
} as const;
export type IntelligenceCommand=keyof typeof intelligenceCommandFields;
export function intelligenceRequest(form:FormData,command:IntelligenceCommand){
 const values:Record<string,string|null>={};
 for(const key of intelligenceCommandFields[command]){const value=form.get(key);if(value!==null&&typeof value!=='string')throw new Error('Unsupported Intelligence value.');values[key]=value?.trim()||null;}
 return{p_request_id:financialRequestId(form),p_command:command,p_values:values};
}
export async function executeIntelligenceCommand(client:{rpc:(name:string,args:Record<string,unknown>)=>any},form:FormData,command:IntelligenceCommand){
 const {data,error}=await client.rpc('carez_intelligence_command_v1',intelligenceRequest(form,command));
 if(error||data?.ok!==true||!data.id)throw new Error(error?.message||'Intelligence save was not confirmed. Retry the same form.');return data;
}
