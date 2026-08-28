'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

async function company(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('Not signed in');
  const {data:profile}=await supabase.from('profiles').select('company_id').eq('id',user.id).single();if(!profile?.company_id)throw new Error('Company profile missing');
  return {supabase,companyId:profile.company_id};
}
const n=(v:FormDataEntryValue|null)=>{const x=Number(String(v??'0').replace(/[$,% ,]/g,''));return Number.isFinite(x)?x:0;};

export async function updateOverheadItem(formData:FormData){
  const id=String(formData.get('id')||'');if(!id)return;
  const {supabase,companyId}=await company();
  await supabase.from('overhead_items').update({
    amount:n(formData.get('amount')),
    business_use_percent:n(formData.get('business_use_percent')),
    active:String(formData.get('active')||'')==='on'
  }).eq('id',id).eq('company_id',companyId);
  revalidatePath('/overhead');
}

export async function updateOverheadPlan(formData:FormData){
  const {supabase,companyId}=await company();
  const ownerRate=n(formData.get('owner_field_rate'));
  await supabase.from('companies').update({
    target_margin_percent:n(formData.get('target_margin_percent')),
    planned_productive_hours_annual:n(formData.get('planned_productive_hours_annual')),
    owner_compensation_target_annual:n(formData.get('owner_compensation_target_annual')),
    owner_planned_field_hours_annual:n(formData.get('owner_planned_field_hours_annual')),
    owner_field_rate:ownerRate
  }).eq('id',companyId);

  const {data:owners}=await supabase.from('crew_members').select('id').eq('company_id',companyId).eq('is_owner',true);
  const effective=new Date().toISOString().slice(0,10);
  for(const owner of owners||[]){
    await supabase.from('crew_members').update({hourly_rate:ownerRate,internal_field_rate:ownerRate}).eq('id',owner.id).eq('company_id',companyId);
    await supabase.from('crew_rate_history').update({end_date:effective}).eq('crew_member_id',owner.id).eq('rate_type','owner_internal').is('end_date',null).lt('effective_date',effective);
    await supabase.from('crew_rate_history').upsert({company_id:companyId,crew_member_id:owner.id,rate_type:'owner_internal',amount:ownerRate,effective_date:effective,notes:'Updated from Overhead owner field rate.'},{onConflict:'crew_member_id,rate_type,effective_date'});
  }
  revalidatePath('/overhead');revalidatePath('/field');revalidatePath('/projects');revalidatePath('/crew');
}
