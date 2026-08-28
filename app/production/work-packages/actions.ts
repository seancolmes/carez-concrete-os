'use server';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';

async function ctx(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('Not signed in');const {data:profile}=await supabase.from('profiles').select('company_id,role').eq('id',user.id).single();if(!profile?.company_id||profile.role==='employee')throw new Error('Owner access required');return{supabase,user,companyId:profile.company_id};}
const numberOrNull=(v:FormDataEntryValue|null)=>{const s=String(v??'').trim();if(!s)return null;const n=Number(s);return Number.isFinite(n)?n:null;};
const refresh=()=>{for(const p of ['/production/work-packages','/production','/schedule','/'])revalidatePath(p);};

export async function createWorkPackage(fd:FormData){
 const projectId=String(fd.get('project_id')||''),name=String(fd.get('name')||'').trim();if(!projectId||!name)throw new Error('Choose a job and name the physical work package.');
 const {supabase,user,companyId}=await ctx();const {data:project}=await supabase.from('projects').select('id').eq('id',projectId).eq('company_id',companyId).single();if(!project)throw new Error('Job not found.');
 const {error}=await supabase.from('work_packages').insert({company_id:companyId,project_id:projectId,name,location:String(fd.get('location')||'').trim()||null,drawing_reference:String(fd.get('drawing_reference')||'').trim()||null,description:String(fd.get('description')||'').trim()||null,planned_start_date:String(fd.get('planned_start_date')||'')||null,planned_end_date:String(fd.get('planned_end_date')||'')||null,source_type:'manual',status:'planned',created_by:user.id});if(error)throw new Error(error.message);refresh();
}

export async function addWorkPackageOperation(fd:FormData){
 const packageId=String(fd.get('work_package_id')||''),taskId=String(fd.get('production_task_id')||''),qty=Number(fd.get('planned_quantity'));if(!packageId||!taskId||!Number.isFinite(qty)||qty<=0)throw new Error('Choose the work and enter the known takeoff quantity.');
 const {supabase,companyId}=await ctx();const [{data:pkg},{data:task}]=await Promise.all([supabase.from('work_packages').select('id').eq('id',packageId).eq('company_id',companyId).single(),supabase.from('production_tasks').select('id,production_unit').eq('id',taskId).eq('company_id',companyId).single()]);if(!pkg||!task)throw new Error('Work package or production task not found.');
 const baseline=numberOrNull(fd.get('baseline_man_hours_per_unit')),enteredBudget=numberOrNull(fd.get('budgeted_man_hours'));const budget=enteredBudget??(baseline==null?null:Math.round(qty*baseline*100)/100);
 const {error}=await supabase.from('work_package_operations').insert({company_id:companyId,work_package_id:packageId,production_task_id:taskId,field_label:String(fd.get('field_label')||'').trim()||null,planned_quantity:qty,unit:task.production_unit,budgeted_man_hours:budget,baseline_man_hours_per_unit:baseline,baseline_source:String(fd.get('baseline_source')||'manual'),measurement_method:String(fd.get('measurement_method')||'completion'),notes:String(fd.get('notes')||'').trim()||null,status:'planned'});if(error)throw new Error(error.message);refresh();
}

export async function updateOperationLaborPlan(fd:FormData){
 const id=String(fd.get('operation_id')||''),baseline=numberOrNull(fd.get('baseline_man_hours_per_unit')),enteredBudget=numberOrNull(fd.get('budgeted_man_hours'));if(!id)throw new Error('Work operation missing.');const {supabase,companyId}=await ctx();const {data:op}=await supabase.from('work_package_operations').select('planned_quantity').eq('id',id).eq('company_id',companyId).single();if(!op)throw new Error('Work operation not found.');const budget=enteredBudget??(baseline==null?null:Math.round(Number(op.planned_quantity)*baseline*100)/100);if(budget!==null&&budget<0)throw new Error('Labor budget cannot be negative.');const {error}=await supabase.from('work_package_operations').update({budgeted_man_hours:budget,baseline_man_hours_per_unit:baseline,baseline_source:String(fd.get('baseline_source')||'manual'),updated_at:new Date().toISOString()}).eq('id',id).eq('company_id',companyId);if(error)throw new Error(error.message);refresh();
}

export async function completeWorkPackageOperation(fd:FormData){
 const id=String(fd.get('operation_id')||'');if(!id)return;const {supabase,user,companyId}=await ctx();const {data:op,error}=await supabase.from('work_package_operations').update({status:'completed',completed_at:new Date().toISOString(),completed_by_profile_id:user.id,completed_by_crew_member_id:null,completion_source:'owner_confirmation',updated_at:new Date().toISOString()}).eq('id',id).eq('company_id',companyId).select('work_package_id').single();if(error)throw new Error(error.message);if(op){const {count}=await supabase.from('work_package_operations').select('id',{count:'exact',head:true}).eq('work_package_id',op.work_package_id).eq('company_id',companyId).in('status',['planned','in_progress','on_hold']);await supabase.from('work_packages').update({status:(count||0)===0?'completed':'active',updated_at:new Date().toISOString()}).eq('id',op.work_package_id).eq('company_id',companyId);}refresh();revalidatePath('/employee');
}

export async function reopenWorkPackageOperation(fd:FormData){
 const id=String(fd.get('operation_id')||'');if(!id)return;const {supabase,companyId}=await ctx();const {data:op,error}=await supabase.from('work_package_operations').update({status:'in_progress',completed_at:null,completed_by_profile_id:null,completed_by_crew_member_id:null,completion_source:null,updated_at:new Date().toISOString()}).eq('id',id).eq('company_id',companyId).select('work_package_id').single();if(error)throw new Error(error.message);if(op)await supabase.from('work_packages').update({status:'active',updated_at:new Date().toISOString()}).eq('id',op.work_package_id).eq('company_id',companyId);refresh();revalidatePath('/employee');
}
