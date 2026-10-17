'use server';
import {revalidateFieldWorkspace as revalidatePath} from '@/lib/ui/revalidateUnifiedWorkspace';
import { createClient } from '@/lib/supabase/server';
import {parseManualLabor} from '@/lib/field/manualLabor';
import type {ShiftReviewState} from '@/lib/field/shiftReview';

async function context(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('Not signed in');const {data:profile}=await supabase.from('profiles').select('company_id,role').eq('id',user.id).single();if(!profile?.company_id||!['owner','office'].includes(profile.role))throw new Error('Company profile missing');return {supabase,user,companyId:profile.company_id};}
const n=(v:FormDataEntryValue|null)=>{const x=Number(String(v??'0').replace(/[$,% ,]/g,''));return Number.isFinite(x)?x:0;};const round=(v:number)=>Math.round((v+Number.EPSILON)*100)/100;

export async function createTimecard(formData:FormData){
 const input=parseManualLabor(formData),{supabase}=await context();
 const {data,error}=await supabase.rpc('carez_record_manual_labor_v1',{p_request_id:input.requestId,p_project_id:input.projectId,p_crew_member_id:input.crewId,p_values:input.values});
 if(error||data?.ok!==true)throw new Error(error?.message||'Manual time was not confirmed. Retry the same reviewed record.');
 for(const path of ['/field','/financials','/projects','/payroll','/forecast'])revalidatePath(path);
}
export async function saveManualTime(_prior:ShiftReviewState,form:FormData):Promise<ShiftReviewState>{try{await createTimecard(form);return{status:'saved',message:'Manual time and its frozen cost were confirmed. Original clock records were preserved.'};}catch(error){return{status:'error',message:error instanceof Error?error.message:'Manual time unavailable. Retry the same record.'};}}

export async function createDailyLog(fd:FormData){
 const numeric=(key:string)=>{const raw=fd.get(key);if(raw===null||String(raw).trim()===''||!Number.isFinite(Number(raw))||Number(raw)<0)throw new Error('Enter finite nonnegative field quantities.');return Number(raw);};
 const {supabase}=await context();const {error}=await supabase.rpc('carez_record_daily_log',{p_request_id:String(fd.get('request_id')||''),p_project_id:String(fd.get('project_id')||''),p_date:String(fd.get('log_date')||''),p_work:String(fd.get('work_completed')||'').trim(),p_crew:numeric('crew_count'),p_yards:numeric('concrete_yards'),p_weather:String(fd.get('weather')||'').trim()||null,p_delays:String(fd.get('delays_issues')||'').trim()||null,p_notes:String(fd.get('notes')||'').trim()||null});
 if(error)throw new Error(error.message);revalidatePath('/field');
}
