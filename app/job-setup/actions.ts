'use server';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';
import {executeBillingCommand} from '@/lib/billing/commands';

async function ctx(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)throw new Error('Not signed in');
  const {data:p}=await supabase.from('profiles').select('company_id,role').eq('id',user.id).single();
  if(!p?.company_id||p.role==='employee')throw new Error('Owner access required');
  return {supabase,user,companyId:p.company_id};
}
const n=(v:FormDataEntryValue|null)=>{const x=Number(String(v??'0').replace(/[$,% ,]/g,''));return Number.isFinite(x)?x:0;};
const refresh=(projectId?:string)=>{revalidatePath('/job-setup');if(projectId)revalidatePath(`/job-setup/${projectId}`);revalidatePath('/projects');revalidatePath('/schedule');revalidatePath('/billing');revalidatePath('/');};

export async function updateJobBillingSetup(fd:FormData){
  const projectId=String(fd.get('project_id')||'');if(!projectId)return;
  const {supabase,companyId}=await ctx();
  const exempt=fd.get('sales_tax_exempt')==='on';
  const rate=exempt?0:Math.max(0,n(fd.get('sales_tax_rate_percent')));
  const jurisdiction=String(fd.get('sales_tax_jurisdiction')||'').trim()||null;
  if(!exempt&&(rate<=0||!jurisdiction))throw new Error('Enter the project sales-tax rate and jurisdiction, or mark the job tax exempt.');
  const {error}=await supabase.from('projects').update({sales_tax_rate_percent:rate,sales_tax_jurisdiction:jurisdiction,sales_tax_exempt:exempt,updated_at:new Date().toISOString()}).eq('id',projectId).eq('company_id',companyId);
  if(error)throw new Error(error.message);refresh(projectId);
}

export async function updateAwardBillingNotes(fd:FormData){
  const awardId=String(fd.get('award_record_id')||''),projectId=String(fd.get('project_id')||'');if(!awardId||!projectId)return;
  const {supabase,companyId}=await ctx();
  const {error}=await supabase.from('project_award_records').update({billing_plan_notes:String(fd.get('billing_plan_notes')||'').trim()||null,updated_at:new Date().toISOString()}).eq('id',awardId).eq('company_id',companyId).eq('project_id',projectId);
  if(error)throw new Error(error.message);refresh(projectId);
}

export async function addPaymentMilestone(fd:FormData){
  const {supabase}=await ctx();
  await executeBillingCommand(supabase,fd,'add_payment_milestone');
  refresh(String(fd.get('project_id')||''));
}

export async function deletePaymentMilestone(fd:FormData){
  const {supabase}=await ctx();
  await executeBillingCommand(supabase,fd,'delete_payment_milestone');
  refresh(String(fd.get('project_id')||''));
}

export async function waivePaymentMilestone(fd:FormData){
  const {supabase}=await ctx();
  await executeBillingCommand(supabase,fd,'waive_payment_milestone');
  refresh(String(fd.get('project_id')||''));
}

export async function createMilestoneInvoice(fd:FormData){
  const {supabase}=await ctx();
  await executeBillingCommand(supabase,fd,'create_milestone_invoice');
  refresh(String(fd.get('project_id')||''));
}
