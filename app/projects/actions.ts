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

export async function createProject(formData:FormData){
  const job_number=String(formData.get('job_number')||'').trim();
  const name=String(formData.get('name')||'').trim();
  if(!job_number||!name) return;
  const value=String(formData.get('contract_value')||'').replace(/[$,]/g,'');
  const {supabase,companyId}=await company();
  await supabase.from('projects').insert({
    company_id:companyId,
    job_number,
    name,
    address:String(formData.get('address')||'').trim()||null,
    city:String(formData.get('city')||'').trim()||null,
    state:'WA',
    status:'active',
    contract_value:value&&Number.isFinite(Number(value))?Number(value):0,
    next_action:String(formData.get('next_action')||'').trim()||null
  });
  revalidatePath('/');
  revalidatePath('/projects');
  revalidatePath('/field');
}
