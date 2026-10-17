'use server';
import {revalidateFinancialsWorkspace as revalidatePath} from '@/lib/ui/revalidateUnifiedWorkspace';
import { createClient } from '@/lib/supabase/server';
import {optionalPayrollCash} from '@/lib/financials/payrollReads';
import {financialRequestId} from '@/lib/financials/commands';
import {payrollCohort,payrollPeriod,payrollRunId,type PayrollFormState,type PayrollPreview} from '@/lib/financials/payrollForms';

async function ctx(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)throw new Error('Not signed in');
  const {data:profile}=await supabase.from('profiles').select('company_id,role').eq('id',user.id).single();
  if(!profile?.company_id||!['owner','office'].includes(profile.role))throw new Error('Owner or office authority required');
  return {supabase,companyId:profile.company_id};
}
const refresh=()=>{revalidatePath('/payroll');revalidatePath('/cashflow');revalidatePath('/');};

export async function createPayrollRun(fd:FormData){
  const {start,end,payDate}=payrollPeriod(fd),cohort=payrollCohort(fd);
  const {supabase}=await ctx();
  const {data,error}=await supabase.rpc('carez_create_payroll_run_v2',{
    p_request_id:financialRequestId(fd),p_timecard_ids:cohort.ids,p_fingerprint:cohort.fingerprint,
    p_period_start:start,
    p_period_end:end,
    p_pay_date:payDate,
    p_notes:String(fd.get('notes')||'').trim()||null
  });
  if(error||data?.ok!==true)throw new Error(error?.message||'Pay period creation was not confirmed. Retry the same reviewed values.');
  refresh();
}

export async function approvePayrollRun(fd:FormData){
  const id=payrollRunId(fd);
  const {supabase}=await ctx();
  const {data,error}=await supabase.rpc('carez_transition_payroll_run_v2',{p_request_id:financialRequestId(fd),p_run_id:id,p_action:'approve'});
  if(error||data?.ok!==true)throw new Error(error?.message||'Funding approval was not confirmed.');
  refresh();
}

export async function processPayrollRun(fd:FormData){
  const id=payrollRunId(fd);
  const {supabase}=await ctx();
  const actual=optionalPayrollCash(fd.get('actual_cash_paid'));
  if(actual===null)throw new Error('Record the actual cash paid. Blank is not zero or the forecast.');
  const {data,error}=await supabase.rpc('carez_transition_payroll_run_v2',{
    p_request_id:financialRequestId(fd),p_run_id:id,p_action:'process',
    p_actual_cash_paid:actual,
    p_reference_number:String(fd.get('reference_number')||'').trim()||null
  });
  if(error||data?.ok!==true)throw new Error(error?.message||'Payroll processing was not confirmed.');
  refresh();
}

export async function voidPayrollRun(fd:FormData){
  const id=payrollRunId(fd);
  const {supabase}=await ctx();
  const {data,error}=await supabase.rpc('carez_transition_payroll_run_v2',{p_request_id:financialRequestId(fd),p_run_id:id,p_action:'void'});
  if(error||data?.ok!==true)throw new Error(error?.message||'Pay-period void was not confirmed.');
  refresh();
}

export async function previewPayrollPeriod(_prior:PayrollFormState,form:FormData):Promise<PayrollFormState>{try{const {start,end,payDate}=payrollPeriod(form),{supabase}=await ctx();const {data,error}=await supabase.rpc('carez_preview_payroll_run_v2',{p_period_start:start,p_period_end:end,p_pay_date:payDate});if(error||!data)throw new Error(error?.message||'Payroll preview unavailable.');return{status:'preview',message:'Review this complete period before creating it.',preview:data as PayrollPreview};}catch(error){return{status:'error',message:error instanceof Error?error.message:'Payroll preview unavailable.'};}}
export async function savePayrollPeriod(_prior:PayrollFormState,form:FormData):Promise<PayrollFormState>{try{await createPayrollRun(form);return{status:'saved',message:'Pay period confirmed. Approved cost snapshots were preserved.'};}catch(error){return{status:'error',message:error instanceof Error?error.message:'Pay period creation unavailable.'};}}
export async function savePayrollTransition(_prior:PayrollFormState,form:FormData):Promise<PayrollFormState>{try{const action=form.get('payroll_action');if(action==='approve')await approvePayrollRun(form);else if(action==='process')await processPayrollRun(form);else if(action==='void')await voidPayrollRun(form);else throw new Error('Unsupported payroll action.');return{status:'saved',message:'Payroll transition confirmed.'};}catch(error){return{status:'error',message:error instanceof Error?error.message:'Payroll transition unavailable.'};}}
