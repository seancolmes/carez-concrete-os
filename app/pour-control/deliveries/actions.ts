'use server';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';

async function ctx(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('Not signed in');const {data:profile}=await supabase.from('profiles').select('company_id,role').eq('id',user.id).single();if(!profile?.company_id||profile.role==='employee')throw new Error('Owner access required');return{supabase,user,companyId:profile.company_id};}
const refresh=()=>{for(const p of ['/pour-control/deliveries','/pour-control','/production','/production/work-packages','/schedule','/'])revalidatePath(p);};

export async function createPlacementPackageFromPour(fd:FormData){
 const pourPlanId=String(fd.get('pour_plan_id')||''),taskId=String(fd.get('production_task_id')||'');if(!pourPlanId||!taskId)throw new Error('Choose the CY placement work for this pour.');
 const {supabase,user,companyId}=await ctx();
 const [{data:pour},{data:task},{data:existing}]=await Promise.all([
  supabase.from('pour_plans').select('id,project_id,name,expected_concrete_yards,scheduled_date,status').eq('id',pourPlanId).eq('company_id',companyId).single(),
  supabase.from('production_tasks').select('id,name,production_unit').eq('id',taskId).eq('company_id',companyId).eq('active',true).single(),
  supabase.from('work_package_operations').select('id').eq('company_id',companyId).eq('pour_plan_id',pourPlanId).eq('measurement_method','ticket').neq('status','cancelled').maybeSingle()
 ]);
 if(existing)throw new Error('This pour is already connected to production.');if(!pour||pour.status==='cancelled')throw new Error('Pour is not available.');if(!task||String(task.production_unit).toUpperCase()!=='CY')throw new Error('Ticket automation requires a CY placement task. Flatwork production remains SF from the takeoff.');
 const planned=Number(pour.expected_concrete_yards||0);if(planned<=0)throw new Error('Set the expected concrete yards on the pour before creating the production link.');
 const {data:learned}=await supabase.from('carez_production_learning_summary').select('sample_packages,weighted_man_hours_per_unit').eq('company_id',companyId).eq('production_task_id',taskId).maybeSingle();
 const baseline=learned&&Number(learned.sample_packages||0)>=2&&Number(learned.weighted_man_hours_per_unit||0)>0?Number(learned.weighted_man_hours_per_unit):null;const budget=baseline==null?null:Math.round(planned*baseline*100)/100;
 const {data:pkg,error:packageError}=await supabase.from('work_packages').insert({company_id:companyId,project_id:pour.project_id,name:`${pour.name} — Concrete Placement`,description:'Created from Pour Control so concrete delivery tickets can feed earned production automatically.',source_type:'import',status:'planned',planned_start_date:pour.scheduled_date,planned_end_date:pour.scheduled_date,created_by:user.id}).select('id').single();if(packageError||!pkg)throw new Error(packageError?.message||'Could not create production package.');
 const {error}=await supabase.from('work_package_operations').insert({company_id:companyId,work_package_id:pkg.id,production_task_id:taskId,field_label:`${task.name} — ${pour.name}`,planned_quantity:planned,unit:'CY',budgeted_man_hours:budget,baseline_man_hours_per_unit:baseline,baseline_source:baseline==null?'manual':'carez_actual',measurement_method:'ticket',pour_plan_id:pourPlanId,status:'planned',notes:'Actual CY is synchronized from matched ready-mix delivery tickets.'});
 if(error){await supabase.from('work_packages').delete().eq('id',pkg.id).eq('company_id',companyId);throw new Error(error.message);}refresh();
}

export async function reviewTicketProduction(fd:FormData){
 const operationId=String(fd.get('operation_id')||''),decision=String(fd.get('decision')||'verify');if(!operationId||!['verify','exclude'].includes(decision))return;const {supabase,companyId}=await ctx();
 const {data:sync}=await supabase.from('pour_work_package_delivery_sync').select('operation_id,operation_status,delivered_cy,tickets_missing_photo,quantity_review_reason').eq('company_id',companyId).eq('operation_id',operationId).maybeSingle();if(!sync)throw new Error('Ticket production link not found.');if(sync.operation_status!=='completed')throw new Error('Production is not closed yet. Finish the pour/ticket reconciliation first.');if(decision==='verify'&&(Number(sync.delivered_cy||0)<=0||Number(sync.tickets_missing_photo||0)>0))throw new Error('Match the delivery evidence before verifying this production sample.');
 const status=decision==='verify'?'verified':'excluded';const reason=decision==='verify'?`Owner verified ticket actual. ${sync.quantity_review_reason||''}`.trim():'Owner excluded this ticket-derived result from Carez production learning.';
 const {error}=await supabase.from('work_package_operations').update({quantity_review_status:status,quantity_review_reason:reason,updated_at:new Date().toISOString()}).eq('id',operationId).eq('company_id',companyId);if(error)throw new Error(error.message);refresh();
}
