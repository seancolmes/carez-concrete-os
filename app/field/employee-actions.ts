'use server';
import {revalidateFieldWorkspace as revalidatePath} from '@/lib/ui/revalidateUnifiedWorkspace';
import {createClient} from '@/lib/supabase/server';
import {parseHistoricalShiftBasis,parseShiftReview,type ShiftReviewState} from '@/lib/field/shiftReview';

const num=(v:FormDataEntryValue|null)=>{const n=Number(v??0);return Number.isFinite(n)?n:0};
const round=(v:number)=>Math.round((v+Number.EPSILON)*100)/100;
async function ctx(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('Not signed in');const {data:profile}=await supabase.from('profiles').select('company_id,role').eq('id',user.id).single();if(!profile?.company_id||profile.role==='employee')throw new Error('Owner access required');return{supabase,user,companyId:profile.company_id};}
const revalidateField=()=>{for(const p of ['/field','/field/review','/production','/projects','/forecast','/payroll','/cashflow','/'])revalidatePath(p);};

export async function approveEmployeeShift(formData:FormData){
 const {supabase}=await ctx();
 const input=parseShiftReview(formData);
 const {data,error}=await supabase.rpc('carez_approve_shift_v3',{p_shift_id:input.shiftId,p_regular_hours:input.regularHours,p_overtime_hours:input.overtimeHours,p_risk_class_code:input.riskCode,p_payroll_tax_date:input.payrollTaxDate,p_note:input.note});
 if(error||!data)throw new Error(error?.message||'Shift approval was not confirmed. Retry the same reviewed values.');revalidateField();
}

export async function rejectEmployeeShift(formData:FormData){const id=String(formData.get('shift_id')||'');const {supabase}=await ctx();const {data,error}=await supabase.rpc('carez_reject_shift_v1',{p_shift_id:id,p_note:String(formData.get('owner_note')||'').trim()});if(error||!data)throw new Error(error?.message||'Correction request was not confirmed.');revalidateField();}

export async function approveShiftReview(_prior:ShiftReviewState,form:FormData):Promise<ShiftReviewState>{try{await approveEmployeeShift(form);return{status:'saved',message:'Approval confirmed. The frozen labor cost is recorded.'};}catch(error){return{status:'error',message:error instanceof Error?error.message:'Approval unavailable. Retry the same reviewed values.'};}}
export async function rejectShiftReview(_prior:ShiftReviewState,form:FormData):Promise<ShiftReviewState>{try{await rejectEmployeeShift(form);return{status:'saved',message:'Returned for correction. No labor cost was posted.'};}catch(error){return{status:'error',message:error instanceof Error?error.message:'Correction request unavailable.'};}}
export async function reviewHistoricalShiftBasis(_prior:ShiftReviewState,form:FormData):Promise<ShiftReviewState>{try{const input=parseHistoricalShiftBasis(form),{supabase}=await ctx();const {data,error}=await supabase.rpc('carez_review_shift_basis_v1',{p_request_id:input.requestId,p_shift_id:input.shiftId,p_values:input.values});if(error||data?.ok!==true)throw new Error(error?.message||'Historical review was not confirmed. Retry the same values.');revalidateField();return{status:'saved',message:'Historical basis review recorded. Original shift facts were preserved. Reopen the shift to approve its reviewed cost.'};}catch(error){return{status:'error',message:error instanceof Error?error.message:'Historical review unavailable.'};}}

export async function saveDailyProduction(formData:FormData){
 const raw=formData.get('quantity_completed');if(raw===null||String(raw).trim()===''||!Number.isFinite(Number(raw)))throw new Error('Enter a finite completed quantity.');
 const {supabase}=await ctx();const {error}=await supabase.rpc('carez_record_verified_production',{p_project_id:String(formData.get('project_id')||''),p_work_date:String(formData.get('work_date')||''),p_task_id:String(formData.get('production_task_id')||''),p_quantity:Number(raw),p_unit:String(formData.get('unit')||'').trim(),p_notes:String(formData.get('notes')||'').trim()||null});
 if(error)throw new Error(error.message);revalidatePath('/field/review');revalidatePath('/production');
}

export async function setProjectJobsite(formData:FormData){const projectId=String(formData.get('project_id')||'');const lat=Number(formData.get('latitude')),lng=Number(formData.get('longitude')),radius=Math.max(50,Number(formData.get('radius_ft')||500));if(!projectId||!Number.isFinite(lat)||!Number.isFinite(lng))throw new Error('GPS location missing.');const {supabase,companyId}=await ctx();const {error}=await supabase.from('projects').update({site_latitude:lat,site_longitude:lng,geofence_radius_ft:radius}).eq('id',projectId).eq('company_id',companyId);if(error)throw new Error(error.message);revalidatePath('/field');revalidatePath('/field/review');}
