'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

async function company(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) throw new Error('Not signed in');
  const {data:profile}=await supabase.from('profiles').select('company_id,role').eq('id',user.id).single();
  if(!profile?.company_id||profile.role==='employee') throw new Error('Owner access required');
  return {supabase,companyId:profile.company_id};
}
const numberValue=(value:FormDataEntryValue|null)=>{const cleaned=String(value||'').replace(/[$,% ,]/g,'');const n=Number(cleaned);return Number.isFinite(n)?n:0;};

export async function createProject(formData:FormData){
  const {supabase,companyId}=await company();
  let job_number=String(formData.get('job_number')||'').trim();if(!job_number){const {data:n,error}=await supabase.rpc('next_opportunity_number');if(error||!n)throw new Error(error?.message||'Could not create job number');job_number=n;}
  const address=String(formData.get('address')||'').trim()||null,city=String(formData.get('city')||'').trim()||null;
  const name=String(formData.get('name')||'').trim()||address||city||`Direct Job ${job_number}`;
  const {data:co}=await supabase.from('companies').select('target_margin_percent,default_bo_classification,retailing_bo_rate_percent,wholesaling_bo_rate_percent').eq('id',companyId).single();
  const boClass=co?.default_bo_classification||'retailing',boRate=boClass==='wholesaling'?Number(co?.wholesaling_bo_rate_percent||0.484):Number(co?.retailing_bo_rate_percent||0.471);
  const {error}=await supabase.from('projects').insert({company_id:companyId,job_number,name,address,city,state:String(formData.get('state')||'WA').trim()||'WA',status:'active',contract_value:numberValue(formData.get('contract_value')),estimated_labor_hours:numberValue(formData.get('estimated_labor_hours')),estimated_labor_cost:numberValue(formData.get('estimated_labor_cost')),target_margin_percent:Number(co?.target_margin_percent||30),bo_classification:boClass,bo_rate_percent:boRate,next_action:String(formData.get('next_action')||'').trim()||null});
  if(error)throw new Error(error.message);
  revalidatePath('/');revalidatePath('/projects');revalidatePath('/field');
}

export async function updateLaborBudget(formData:FormData){
  const projectId=String(formData.get('project_id')||'');if(!projectId)return;
  const {supabase,companyId}=await company();
  await supabase.from('projects').update({estimated_labor_hours:numberValue(formData.get('estimated_labor_hours')),estimated_labor_cost:numberValue(formData.get('estimated_labor_cost'))}).eq('id',projectId).eq('company_id',companyId);
  revalidatePath('/projects');
}

export async function updateProjectEconomics(formData:FormData){
  const projectId=String(formData.get('project_id')||'');if(!projectId)return;
  const {supabase,companyId}=await company();
  const boClass=String(formData.get('bo_classification')||'retailing');
  const {data:co}=await supabase.from('companies').select('retailing_bo_rate_percent,wholesaling_bo_rate_percent').eq('id',companyId).single();
  const boRate=boClass==='wholesaling'?Number(co?.wholesaling_bo_rate_percent||0.484):Number(co?.retailing_bo_rate_percent||0.471),status=String(formData.get('status')||'active');
  await supabase.from('projects').update({target_margin_percent:numberValue(formData.get('target_margin_percent')),bo_classification:boClass,bo_rate_percent:boRate,payment_processing_rate_percent:numberValue(formData.get('payment_processing_rate_percent')),status,completed_at:status==='completed'?new Date().toISOString():null}).eq('id',projectId).eq('company_id',companyId);
  revalidatePath('/projects');
}
