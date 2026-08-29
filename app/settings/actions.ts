'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function updateLaborBurden(formData:FormData){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();if(!user)return;
  const {data:profile}=await supabase.from('profiles').select('company_id').eq('id',user.id).single();if(!profile?.company_id)return;
  const n=Number(String(formData.get('labor_burden_percent')||'0').replace('%',''));
  if(!Number.isFinite(n)||n<0)return;
  await supabase.from('companies').update({labor_burden_percent:n}).eq('id',profile.company_id);
  revalidatePath('/settings');revalidatePath('/projects');
}

export async function signOut(){
  const supabase=await createClient();await supabase.auth.signOut();redirect('/login');
}
