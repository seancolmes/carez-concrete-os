'use server';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';

async function ctx(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)throw new Error('Not signed in');
  const {data:profile}=await supabase.from('profiles').select('company_id,role').eq('id',user.id).single();
  if(!profile?.company_id||profile.role==='employee')throw new Error('Owner access required');
  return {supabase,user,companyId:profile.company_id};
}
const txt=(v:FormDataEntryValue|null)=>String(v||'').trim()||null;
const refresh=()=>{for(const p of ['/readiness','/schedule','/employee','/production','/production/work-packages','/pour-control','/'])revalidatePath(p);};

async function getOperation(supabase:any,companyId:string,operationId:string){
  const {data:op}=await supabase.from('work_package_operations').select('id,company_id,status,production_task_id,work_packages!inner(project_id,name),production_tasks!inner(name)').eq('id',operationId).eq('company_id',companyId).single();
  if(!op)throw new Error('Work package operation not found.');
  return op as any;
}

export async function createInspection(fd:FormData){
  const operationId=String(fd.get('operation_id')||'');if(!operationId)throw new Error('Choose the work this inspection must clear.');
  const {supabase,user,companyId}=await ctx();const op=await getOperation(supabase,companyId,operationId);
  if(['completed','cancelled'].includes(op.status))throw new Error('Closed work does not need a new readiness inspection.');
  const inspectionType=String(fd.get('inspection_type')||'general');
  const scheduledDate=txt(fd.get('scheduled_date')),scheduledTime=txt(fd.get('scheduled_time'));
  const status=scheduledDate?'scheduled':'required';
  const title=txt(fd.get('title'))||({rebar:'Rebar / pre-pour inspection',forms:'Forms / footing inspection',special:'Special inspection',row:'ROW / civil inspection',subgrade:'Subgrade / compaction inspection'} as Record<string,string>)[inspectionType]||'Required inspection';
  const {error}=await supabase.from('project_inspections').insert({
    company_id:companyId,project_id:op.work_packages.project_id,required_for_operation_id:operationId,
    title,inspection_type:inspectionType,authority:txt(fd.get('authority')),status,
    requested_at:status==='scheduled'?new Date().toISOString():null,scheduled_date:scheduledDate,scheduled_time:scheduledTime,
    reference_number:txt(fd.get('reference_number')),result_notes:txt(fd.get('notes')),created_by:user.id,updated_by:user.id
  });
  if(error)throw new Error(error.message);refresh();
}

export async function scheduleInspection(fd:FormData){
  const id=String(fd.get('inspection_id')||''),date=String(fd.get('scheduled_date')||'');if(!id||!date)throw new Error('Choose the inspection date.');
  const {supabase,user,companyId}=await ctx();
  const {data:inspection}=await supabase.from('project_inspections').select('id,status').eq('id',id).eq('company_id',companyId).single();if(!inspection)throw new Error('Inspection not found.');
  if(['passed','waived','cancelled'].includes(inspection.status))throw new Error('Closed inspections cannot be rescheduled.');
  const {error}=await supabase.from('project_inspections').update({status:'scheduled',requested_at:new Date().toISOString(),scheduled_date:date,scheduled_time:txt(fd.get('scheduled_time')),authority:txt(fd.get('authority')),reference_number:txt(fd.get('reference_number')),updated_by:user.id,updated_at:new Date().toISOString()}).eq('id',id).eq('company_id',companyId);
  if(error)throw new Error(error.message);refresh();
}

export async function recordInspectionResult(fd:FormData){
  const id=String(fd.get('inspection_id')||''),status=String(fd.get('status')||'');if(!id||!['passed','failed','waived','cancelled'].includes(status))throw new Error('Choose a valid inspection result.');
  const {supabase,user,companyId}=await ctx();
  const {data:inspection}=await supabase.from('project_inspections').select('id,required_for_operation_id,status').eq('id',id).eq('company_id',companyId).single();if(!inspection)throw new Error('Inspection not found.');
  const waivedReason=txt(fd.get('waived_reason')),notes=txt(fd.get('result_notes'));
  if(status==='waived'&&!waivedReason)throw new Error('A waiver reason is required.');
  if(status==='failed'&&!notes)throw new Error('Record what failed so the correction is clear.');
  const {error}=await supabase.from('project_inspections').update({
    status,completed_at:['passed','failed','waived'].includes(status)?new Date().toISOString():null,
    result_notes:notes,waived_reason:status==='waived'?waivedReason:null,updated_by:user.id,updated_at:new Date().toISOString()
  }).eq('id',id).eq('company_id',companyId);
  if(error)throw new Error(error.message);
  if(status==='failed'&&inspection.required_for_operation_id){
    await supabase.from('work_schedule_items').update({status:'planned',updated_at:new Date().toISOString()}).eq('company_id',companyId).eq('work_package_operation_id',inspection.required_for_operation_id).eq('item_type','work').eq('status','confirmed');
  }
  refresh();
}

export async function placeReadinessHold(fd:FormData){
  const operationId=String(fd.get('operation_id')||''),reason=String(fd.get('reason')||'').trim();if(!operationId||!reason)throw new Error('Enter why this work must not start.');
  const {supabase,user,companyId}=await ctx();await getOperation(supabase,companyId,operationId);
  const {error}=await supabase.from('work_package_operations').update({readiness_hold_reason:reason,readiness_hold_at:new Date().toISOString(),readiness_hold_by:user.id,updated_at:new Date().toISOString()}).eq('id',operationId).eq('company_id',companyId);if(error)throw new Error(error.message);refresh();
}

export async function clearReadinessHold(fd:FormData){
  const operationId=String(fd.get('operation_id')||'');if(!operationId)return;const {supabase,companyId}=await ctx();
  const {error}=await supabase.from('work_package_operations').update({readiness_hold_reason:null,readiness_hold_at:null,readiness_hold_by:null,updated_at:new Date().toISOString()}).eq('id',operationId).eq('company_id',companyId);if(error)throw new Error(error.message);refresh();
}

export async function setPriorOperationRule(fd:FormData){
  const operationId=String(fd.get('operation_id')||'');if(!operationId)return;const {supabase,companyId}=await ctx();
  const requires=String(fd.get('requires_prior_operations')||'true')==='true';
  const {error}=await supabase.from('work_package_operations').update({requires_prior_operations:requires,updated_at:new Date().toISOString()}).eq('id',operationId).eq('company_id',companyId);if(error)throw new Error(error.message);refresh();
}
