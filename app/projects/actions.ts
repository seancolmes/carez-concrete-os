'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

async function company(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) throw new Error('Not signed in');
  const {data:profile}=await supabase.from('profiles').select('company_id').eq('id',user.id).single();
  if(!profile?.company_id) throw new Error('Company profile missing');
  return {supabase,companyId:profile.company_id};
}
const numberValue=(value:FormDataEntryValue|null)=>{const cleaned=String(value||'').replace(/[$,% ,]/g,'');const n=Number(cleaned);return Number.isFinite(n)?n:0;};

export async function createProject(formData:FormData){
  const job_number=String(formData.get('job_number')||'').trim();
  const name=String(formData.get('name')||'').trim();
  if(!job_number||!name) return;
  const {supabase,companyId}=await company();
  const {data:co}=await supabase.from('companies').select('target_margin_percent,default_bo_classification,retailing_bo_rate_percent,wholesaling_bo_rate_percent').eq('id',companyId).single();
  const boClass=co?.default_bo_classification||'retailing';
  const boRate=boClass==='wholesaling'?Number(co?.wholesaling_bo_rate_percent||0.484):Number(co?.retailing_bo_rate_percent||0.471);
  await supabase.from('projects').insert({
    company_id:companyId,job_number,name,
    address:String(formData.get('address')||'').trim()||null,
    city:String(formData.get('city')||'').trim()||null,state:'WA',status:'active',
    contract_value:numberValue(formData.get('contract_value')),
    estimated_labor_hours:numberValue(formData.get('estimated_labor_hours')),
    estimated_labor_cost:numberValue(formData.get('estimated_labor_cost')),
    target_margin_percent:Number(co?.target_margin_percent||30),bo_classification:boClass,bo_rate_percent:boRate,
    next_action:String(formData.get('next_action')||'').trim()||null
  });
  revalidatePath('/');revalidatePath('/projects');revalidatePath('/field');
}

export async function updateLaborBudget(formData:FormData){
  const projectId=String(formData.get('project_id')||'');if(!projectId)return;
  const {supabase,companyId}=await company();
  await supabase.from('projects').update({
    estimated_labor_hours:numberValue(formData.get('estimated_labor_hours')),
    estimated_labor_cost:numberValue(formData.get('estimated_labor_cost'))
  }).eq('id',projectId).eq('company_id',companyId);
  revalidatePath('/projects');
}

export async function updateProjectEconomics(formData:FormData){
  const projectId=String(formData.get('project_id')||'');if(!projectId)return;
  const {supabase,companyId}=await company();
  const boClass=String(formData.get('bo_classification')||'retailing');
  const {data:co}=await supabase.from('companies').select('retailing_bo_rate_percent,wholesaling_bo_rate_percent').eq('id',companyId).single();
  const boRate=boClass==='wholesaling'?Number(co?.wholesaling_bo_rate_percent||0.484):Number(co?.retailing_bo_rate_percent||0.471);
  const status=String(formData.get('status')||'active');
  await supabase.from('projects').update({
    target_margin_percent:numberValue(formData.get('target_margin_percent')),
    bo_classification:boClass,bo_rate_percent:boRate,
    payment_processing_rate_percent:numberValue(formData.get('payment_processing_rate_percent')),
    status,completed_at:status==='completed'?new Date().toISOString():null
  }).eq('id',projectId).eq('company_id',companyId);
  revalidatePath('/projects');
}
