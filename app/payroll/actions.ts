'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

async function ctx(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)throw new Error('Not signed in');
  const {data:profile}=await supabase.from('profiles').select('company_id').eq('id',user.id).single();
  if(!profile?.company_id)throw new Error('Company profile missing');
  return {supabase,companyId:profile.company_id};
}
const n=(v:FormDataEntryValue|null)=>{const x=Number(String(v??'').replace(/[$,% ,]/g,''));return Number.isFinite(x)?x:null;};
const refresh=()=>{revalidatePath('/payroll');revalidatePath('/cashflow');revalidatePath('/');};

export async function createPayrollRun(fd:FormData){
  const start=String(fd.get('period_start')||''),end=String(fd.get('period_end')||'');
  if(!start||!end)return;
  const {supabase}=await ctx();
  const {error}=await supabase.rpc('create_payroll_run',{
    p_period_start:start,
    p_period_end:end,
    p_pay_date:String(fd.get('pay_date')||'')||null,
    p_notes:String(fd.get('notes')||'').trim()||null
  });
  if(error)throw new Error(error.message);
  refresh();
}

export async function approvePayrollRun(fd:FormData){
  const id=String(fd.get('payroll_run_id')||'');if(!id)return;
  const {supabase}=await ctx();
  const {error}=await supabase.rpc('approve_payroll_run',{p_payroll_run_id:id});
  if(error)throw new Error(error.message);
  refresh();
}

export async function processPayrollRun(fd:FormData){
  const id=String(fd.get('payroll_run_id')||'');if(!id)return;
  const {supabase}=await ctx();
  const actual=n(fd.get('actual_cash_paid'));
  const {error}=await supabase.rpc('process_payroll_run',{
    p_payroll_run_id:id,
    p_actual_cash_paid:actual,
    p_reference_number:String(fd.get('reference_number')||'').trim()||null
  });
  if(error)throw new Error(error.message);
  refresh();
}

export async function voidPayrollRun(fd:FormData){
  const id=String(fd.get('payroll_run_id')||'');if(!id)return;
  const {supabase}=await ctx();
  const {error}=await supabase.rpc('void_payroll_run',{p_payroll_run_id:id});
  if(error)throw new Error(error.message);
  refresh();
}
