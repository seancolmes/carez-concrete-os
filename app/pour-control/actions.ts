'use server';
import {revalidateFieldWorkspace as revalidatePath} from '@/lib/ui/revalidateUnifiedWorkspace';
import { createClient } from '@/lib/supabase/server';
import {executePourAuthorization} from '@/lib/financials/pourAuthorization';
import {executePourPlanning} from '@/lib/financials/pourPlanning';

async function ctx(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)throw new Error('Not signed in');
  const {data:profile}=await supabase.from('profiles').select('company_id,role').eq('id',user.id).single();
  if(!profile?.company_id||!['owner','office'].includes(profile.role))throw new Error('Owner or office access required');
  return {supabase,user,companyId:profile.company_id};
}
export async function createPourPlan(fd:FormData){
 const {supabase}=await ctx();await executePourPlanning(supabase,fd,'create_plan');
 revalidatePath('/pour-control');revalidatePath('/projects');
}

export async function updatePourPlan(fd:FormData){
 const {supabase}=await ctx();await executePourPlanning(supabase,fd,'update_plan');
 revalidatePath('/pour-control');revalidatePath('/projects');
}

export async function addPourCostItem(fd:FormData){
 const {supabase}=await ctx();await executePourPlanning(supabase,fd,'add_cost');
 revalidatePath('/pour-control');revalidatePath('/projects');
}

export async function addPourLaborItem(fd:FormData){
 const {supabase}=await ctx();await executePourPlanning(supabase,fd,'add_labor');
 revalidatePath('/pour-control');revalidatePath('/projects');
}

export async function deletePourCostItem(fd:FormData){
 const {supabase}=await ctx();await executePourPlanning(supabase,fd,'delete_cost');
 revalidatePath('/pour-control');revalidatePath('/projects');
}

export async function recordPourAuthorization(fd:FormData){
  const {supabase}=await ctx();
  await executePourAuthorization(supabase,fd);
  revalidatePath('/pour-control');revalidatePath('/projects');
}

export async function closePourPlan(fd:FormData){
 const {supabase}=await ctx();await executePourPlanning(supabase,fd,'close_plan');
 revalidatePath('/pour-control');revalidatePath('/projects');
}
