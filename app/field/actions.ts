'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

async function context(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) throw new Error('Not signed in');
  const {data:profile}=await supabase.from('profiles').select('company_id').eq('id',user.id).single();
  if(!profile?.company_id) throw new Error('Company profile missing');
  return {supabase,user,companyId:profile.company_id};
}

export async function createTimecard(formData:FormData){
  const project_id=String(formData.get('project_id')||'');
  const crew_member_id=String(formData.get('crew_member_id')||'')||null;
  const worker_name=String(formData.get('worker_name')||'').trim();
  const hours=Number(formData.get('hours')||0);
  if(!project_id||!worker_name||!Number.isFinite(hours)||hours<=0) return;
  const {supabase,companyId}=await context();
  const rateRaw=String(formData.get('hourly_rate')||'').replace(/[$,]/g,'');
  await supabase.from('timecards').insert({
    company_id:companyId,project_id,crew_member_id,worker_name,
    work_date:String(formData.get('work_date')||''),
    task:String(formData.get('task')||'General'),
    hours,
    hourly_rate:rateRaw&&Number.isFinite(Number(rateRaw))?Number(rateRaw):null,
    notes:String(formData.get('notes')||'').trim()||null
  });
  revalidatePath('/field');
}

export async function createDailyLog(formData:FormData){
  const project_id=String(formData.get('project_id')||'');
  const work_completed=String(formData.get('work_completed')||'').trim();
  if(!project_id||!work_completed) return;
  const {supabase,user,companyId}=await context();
  const yards=Number(formData.get('concrete_yards')||0);
  await supabase.from('daily_logs').insert({
    company_id:companyId,project_id,
    log_date:String(formData.get('log_date')||''),
    weather:String(formData.get('weather')||'').trim()||null,
    crew_count:Number(formData.get('crew_count')||0),
    work_completed,
    concrete_yards:Number.isFinite(yards)?yards:0,
    delays_issues:String(formData.get('delays_issues')||'').trim()||null,
    notes:String(formData.get('notes')||'').trim()||null,
    created_by:user.id
  });
  revalidatePath('/field');
}
