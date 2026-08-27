'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function seedStarterData(){
  const supabase=await createClient();
  const {error}=await supabase.rpc('seed_carez_starter_data');
  if(error) return {ok:false,message:error.message};
  revalidatePath('/');revalidatePath('/projects');revalidatePath('/crew');
  return {ok:true,message:'Starter data loaded.'};
}

export async function signOut(){
  const supabase=await createClient();await supabase.auth.signOut();redirect('/login');
}
