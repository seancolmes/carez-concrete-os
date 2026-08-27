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

export async function createLead(formData:FormData){
  const customer_name=String(formData.get('customer_name')||'').trim();
  const project_name=String(formData.get('project_name')||'').trim();
  if(!customer_name||!project_name) return;
  const value=String(formData.get('estimated_value')||'').replace(/[$,]/g,'');
  const {supabase,companyId}=await company();
  await supabase.from('leads').insert({
    company_id:companyId,customer_name,project_name,
    city:String(formData.get('city')||'').trim()||null,
    scope:String(formData.get('scope')||'').trim(),
    estimated_value:value&&Number.isFinite(Number(value))?Number(value):null,
    bid_due:String(formData.get('bid_due')||'')||null,
    follow_up:String(formData.get('follow_up')||'')||null,
    status:'new'
  });
  revalidatePath('/');revalidatePath('/leads');
}

export async function updateLeadStatus(formData:FormData){
  const id=String(formData.get('id')||'');const status=String(formData.get('status')||'new');
  const {supabase}=await company();await supabase.from('leads').update({status}).eq('id',id);
  revalidatePath('/');revalidatePath('/leads');
}
