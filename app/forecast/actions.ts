'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

async function ctx(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)throw new Error('Not signed in');
 const {data:p}=await supabase.from('profiles').select('company_id').eq('id',user.id).single();
 if(!p?.company_id)throw new Error('Company missing');
 return {supabase,user,companyId:p.company_id};
}
const numOrNull=(v:FormDataEntryValue|null)=>{const s=String(v??'').trim();if(!s)return null;const n=Number(s.replace(/[$,% ,]/g,''));return Number.isFinite(n)?n:null;};

export async function saveScopeProgress(fd:FormData){
 const budget_section_id=String(fd.get('budget_section_id')||'');
 const as_of_date=String(fd.get('as_of_date')||'');
 const physical_percent_complete=numOrNull(fd.get('physical_percent_complete'));
 if(!budget_section_id||!as_of_date||physical_percent_complete===null)return;
 const {supabase,user,companyId}=await ctx();
 const {data:section,error:sectionError}=await supabase.from('project_budget_sections').select('id,budget_id,project_budgets!inner(project_id,status)').eq('id',budget_section_id).eq('company_id',companyId).single();
 if(sectionError||!section)throw new Error('Budget scope not found');
 const project_id=(section as any).project_budgets.project_id;
 await supabase.from('project_scope_progress_updates').upsert({
  company_id:companyId,project_id,budget_id:section.budget_id,budget_section_id,as_of_date,physical_percent_complete,
  remaining_labor_hours_override:numOrNull(fd.get('remaining_labor_hours_override')),
  remaining_material_cost_override:numOrNull(fd.get('remaining_material_cost_override')),
  remaining_equipment_cost_override:numOrNull(fd.get('remaining_equipment_cost_override')),
  remaining_subcontractor_cost_override:numOrNull(fd.get('remaining_subcontractor_cost_override')),
  remaining_other_cost_override:numOrNull(fd.get('remaining_other_cost_override')),
  notes:String(fd.get('notes')||'').trim()||null,created_by:user.id,updated_at:new Date().toISOString()
 },{onConflict:'budget_section_id,as_of_date'});
 revalidatePath('/forecast');revalidatePath('/projects');revalidatePath('/field');
}
