'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { analyzeBankTransactions } from '@/lib/bank-reconciliation';

async function ctx(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)throw new Error('Not signed in');
  const {data:profile}=await supabase.from('profiles').select('company_id').eq('id',user.id).single();
  if(!profile?.company_id)throw new Error('Company profile missing');
  return {supabase,companyId:profile.company_id};
}

const refresh=()=>{revalidatePath('/banking/rules');revalidatePath('/banking/reconcile');revalidatePath('/banking');};
const truthy=(v:FormDataEntryValue|null)=>String(v||'')==='true'||String(v||'')==='on';
const nullable=(v:FormDataEntryValue|null)=>String(v||'').trim()||null;
const normalizePattern=(v:string)=>v.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

async function validateCompanyId(supabase:any,companyId:string,table:string,id:string|null){
  if(!id)return null;
  const {data}=await supabase.from(table).select('id').eq('id',id).eq('company_id',companyId).maybeSingle();
  if(!data)throw new Error('Selected record does not belong to this Carez company.');
  return id;
}

export async function updateBankRule(fd:FormData){
  const id=String(fd.get('rule_id')||'');if(!id)return;
  const {supabase,companyId}=await ctx();
  const name=String(fd.get('name')||'').trim();
  const pattern=normalizePattern(String(fd.get('merchant_pattern')||''));
  const direction=String(fd.get('direction')||'outflow');
  const actionType=String(fd.get('action_type')||'company_expense');
  const categoryPrimary=nullable(fd.get('category_primary'));
  const businessRaw=Number(fd.get('business_use_percent')||100);
  const businessUse=Number.isFinite(businessRaw)?Math.max(0,Math.min(100,businessRaw)):100;
  const active=truthy(fd.get('active'));
  let autoApply=truthy(fd.get('auto_apply'));
  if(!name||!pattern)throw new Error('Rule name and merchant pattern are required.');
  if(!['inflow','outflow','any'].includes(direction))throw new Error('Invalid rule direction.');
  if(!['company_expense','job_cost','ignore'].includes(actionType))throw new Error('Invalid rule action.');
  if(actionType==='job_cost')autoApply=false;

  let overheadItemId=nullable(fd.get('overhead_item_id'));
  let costCodeId=nullable(fd.get('cost_code_id'));
  let vendorId=nullable(fd.get('vendor_id'));
  if(actionType==='company_expense'){
    overheadItemId=await validateCompanyId(supabase,companyId,'overhead_items',overheadItemId);
    costCodeId=null;vendorId=null;
  }else if(actionType==='job_cost'){
    costCodeId=await validateCompanyId(supabase,companyId,'cost_codes',costCodeId);
    vendorId=await validateCompanyId(supabase,companyId,'vendors',vendorId);
    overheadItemId=null;
  }else{overheadItemId=null;costCodeId=null;vendorId=null;}

  const {error}=await supabase.from('bank_reconciliation_rules').update({
    name,merchant_pattern:pattern,direction,category_primary:categoryPrimary,action_type:actionType,
    overhead_item_id:overheadItemId,expense_category:actionType==='company_expense'?nullable(fd.get('expense_category')):null,
    cost_code_id:costCodeId,vendor_id:vendorId,business_use_percent:actionType==='company_expense'?businessUse:100,
    auto_apply:autoApply,active,updated_at:new Date().toISOString()
  }).eq('id',id).eq('company_id',companyId);
  if(error)throw new Error(error.message);
  try{await analyzeBankTransactions(supabase,companyId);}catch{}
  refresh();
}

export async function setBankRuleState(fd:FormData){
  const id=String(fd.get('rule_id')||''),field=String(fd.get('field')||''),value=String(fd.get('value')||'')==='true';
  if(!id||!['active','auto_apply'].includes(field))return;
  const {supabase,companyId}=await ctx();
  const {data:rule}=await supabase.from('bank_reconciliation_rules').select('id,action_type').eq('id',id).eq('company_id',companyId).maybeSingle();
  if(!rule)throw new Error('Bank rule not found.');
  if(field==='auto_apply'&&value&&rule.action_type==='job_cost')throw new Error('Job-cost rules require a project selection and cannot auto-post.');
  const {error}=await supabase.from('bank_reconciliation_rules').update({[field]:value,updated_at:new Date().toISOString()}).eq('id',id).eq('company_id',companyId);
  if(error)throw new Error(error.message);
  try{await analyzeBankTransactions(supabase,companyId);}catch{}
  refresh();
}
