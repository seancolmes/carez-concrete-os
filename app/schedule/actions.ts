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

export async function createScheduleItem(formData:FormData){
  const projectId=String(formData.get('project_id')||'');
  const scheduleDate=String(formData.get('schedule_date')||'');
  const title=String(formData.get('title')||'').trim();
  if(!projectId||!scheduleDate||!title)return;
  const {supabase,user,companyId}=await ownerContext();
  const {data:item,error}=await supabase.from('work_schedule_items').insert({
    company_id:companyId,
    project_id:projectId,
    schedule_date:scheduleDate,
    item_type:String(formData.get('item_type')||'work'),
    title,
    production_task_id:String(formData.get('production_task_id')||'')||null,
    pour_plan_id:String(formData.get('pour_plan_id')||'')||null,
    start_time:String(formData.get('start_time')||'')||null,
    end_time:String(formData.get('end_time')||'')||null,
    crew_needed:Number(formData.get('crew_needed')||0),
    status:String(formData.get('status')||'planned'),
    notes:String(formData.get('notes')||'').trim()||null,
    created_by:user.id
  }).select('id').single();
  if(error)throw new Error(error.message);
  const crewIds=formData.getAll('crew_member_ids').map(String).filter(Boolean);
  if(item&&crewIds.length){
    const rows=crewIds.map(crew_member_id=>({company_id:companyId,schedule_item_id:item.id,crew_member_id}));
    const {error:assignmentError}=await supabase.from('work_schedule_assignments').insert(rows);
    if(assignmentError)throw new Error(assignmentError.message);
  }
  revalidatePath('/schedule');revalidatePath('/projects');revalidatePath('/');
}

export async function updateScheduleStatus(formData:FormData){
  const id=String(formData.get('id')||'');
  const status=String(formData.get('status')||'planned');
  if(!id)return;
  const {supabase,companyId}=await ownerContext();
  await supabase.from('work_schedule_items').update({status,updated_at:new Date().toISOString()}).eq('id',id).eq('company_id',companyId);
  revalidatePath('/schedule');
}

export async function deleteScheduleItem(formData:FormData){
  const id=String(formData.get('id')||'');if(!id)return;
  const {supabase,companyId}=await ownerContext();
  await supabase.from('work_schedule_items').delete().eq('id',id).eq('company_id',companyId);
  revalidatePath('/schedule');
}
