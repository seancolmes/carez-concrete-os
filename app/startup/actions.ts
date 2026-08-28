'use server';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';

async function ownerContext(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)throw new Error('Not signed in');
  const {data:profile}=await supabase.from('profiles').select('company_id,role').eq('id',user.id).single();
  if(!profile?.company_id||profile.role==='employee')throw new Error('Owner access required');
  return {supabase,user,companyId:profile.company_id};
}

export async function updateStartupItem(formData:FormData){
  const id=String(formData.get('id')||'');
  const current=String(formData.get('current_status')||'open');
  const status=String(formData.get('status')||current);
  if(!id||!['open','done','not_needed'].includes(status))return;
  const {supabase,user,companyId}=await ownerContext();
  const finished=status!=='open';
  const {error}=await supabase.from('project_startup_items').update({
    status,
    notes:String(formData.get('notes')||'').trim()||null,
    completed_at:finished?new Date().toISOString():null,
    completed_by:finished?user.id:null,
    updated_at:new Date().toISOString()
  }).eq('id',id).eq('company_id',companyId);
  if(error)throw new Error(error.message);
  revalidatePath('/startup');
  revalidatePath('/projects');
}
