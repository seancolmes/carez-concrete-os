'use server';
import {revalidateFinancialsWorkspace as revalidatePath} from '@/lib/ui/revalidateUnifiedWorkspace';
import { createClient } from '@/lib/supabase/server';
import {companyLogoPublicUrl} from '@/lib/companyBranding';
import {customerBillingPayload} from './customer-contact-terms';
import {executeInvoicePayment} from '@/lib/billing/paymentCommand';
import {executeBillingCommand} from '@/lib/billing/commands';

async function ctx(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)throw new Error('Not signed in');
  const {data:p}=await supabase.from('profiles').select('company_id,role').eq('id',user.id).single();
  if(!p?.company_id||!['owner','office'].includes(p.role))throw new Error('Owner or office access required');
  return {supabase,user,companyId:p.company_id};
}
const n=(v:FormDataEntryValue|null)=>{const x=Number(String(v??'0').replace(/[$,% ,]/g,''));return Number.isFinite(x)?x:0;};
async function companyName(supabase:any,companyId:string){
  const {data,error}=await supabase.from('companies').select('name').eq('id',companyId).single();
  if(error||!data?.name)throw new Error('Set up your company before creating billing documents.');
  return String(data.name);
}

export async function updateCompanyBillingProfile(fd:FormData){
  const {supabase,companyId}=await ctx();
  const displayName=String(fd.get('display_name')||'').trim()||await companyName(supabase,companyId);
  const [{data:current,error:profileError},{data:branding,error:brandingError}]=await Promise.all([
    supabase.from('company_billing_profiles').select('logo_path,address_line2').eq('company_id',companyId).maybeSingle(),
    supabase.from('company_branding').select('logo_path').eq('company_id',companyId).maybeSingle(),
  ]);
  if(profileError||brandingError)throw new Error('Company invoice profile is unavailable. Reload before saving.');
  const payload={
    company_id:companyId,
    display_name:displayName,
    legal_name:String(fd.get('legal_name')||'').trim()||null,
    address_line1:String(fd.get('address_line1')||'').trim()||null,
    address_line2:fd.has('address_line2')?(String(fd.get('address_line2')||'').trim()||null):current?.address_line2??null,
    city:String(fd.get('city')||'').trim()||null,
    state:String(fd.get('state')||'').trim()||null,
    postal_code:String(fd.get('postal_code')||'').trim()||null,
    phone:String(fd.get('phone')||'').trim()||null,
    email:String(fd.get('email')||'').trim()||null,
    website:String(fd.get('website')||'').trim()||null,
    ubi_number:String(fd.get('ubi_number')||'').trim()||null,
    contractor_license_number:String(fd.get('contractor_license_number')||'').trim()||null,
    logo_path:branding?.logo_path?companyLogoPublicUrl(supabase,branding.logo_path):current?.logo_path&&current.logo_path!=='/brand/carez-wordmark.png'?current.logo_path:null,
    payment_instructions:String(fd.get('payment_instructions')||'').trim()||null,
    invoice_footer:String(fd.get('invoice_footer')||'').trim()||null,
    default_terms_text:String(fd.get('default_terms_text')||'').trim()||null,
    default_due_days:Math.max(0,Math.round(n(fd.get('default_due_days')))),
    updated_at:new Date().toISOString()
  };
  const {error}=await supabase.from('company_billing_profiles').upsert(payload,{onConflict:'company_id'});
  if(error)throw new Error(error.message);
  revalidatePath('/billing');
}

export async function updateCustomerBillingProfile(fd:FormData){
  const customerId=String(fd.get('customer_id')||'');if(!customerId)return;
  const {supabase,companyId}=await ctx();
  const {payload,revision}=customerBillingPayload(fd);
  let update=supabase.from('customers').update(payload).eq('id',customerId).eq('company_id',companyId);
  if(revision!==null)update=update.eq('billing_profile_revision',revision);
  const {data,error}=await update.select('id').maybeSingle();
  if(error)throw new Error(error.message);
  if(!data)throw new Error('Customer changed or is unavailable. Reopen the customer and review its current values before saving.');
  revalidatePath('/billing');
}

export async function updateProjectBillingSetup(fd:FormData){
  const projectId=String(fd.get('project_id')||'');if(!projectId)return;
  const {supabase,companyId}=await ctx();
  const rate=Math.max(0,n(fd.get('sales_tax_rate_percent')));
  const {error}=await supabase.from('projects').update({
    sales_tax_rate_percent:rate,
    sales_tax_jurisdiction:String(fd.get('sales_tax_jurisdiction')||'').trim()||null,
    sales_tax_exempt:fd.get('sales_tax_exempt')==='on',
    updated_at:new Date().toISOString()
  }).eq('id',projectId).eq('company_id',companyId);
  if(error)throw new Error(error.message);
  revalidatePath('/billing');
}

export async function createInvoice(fd:FormData){
  const {supabase}=await ctx();
  await executeBillingCommand(supabase,fd,'create_invoice');
  revalidatePath('/billing');revalidatePath('/projects');
}

export async function createRetainageRelease(fd:FormData){
  const {supabase}=await ctx();
  await executeBillingCommand(supabase,fd,'create_retainage_release');
  revalidatePath('/billing');revalidatePath('/projects');
}

export async function addInvoiceLine(fd:FormData){
  const {supabase}=await ctx();
  await executeBillingCommand(supabase,fd,'add_invoice_line');
  revalidatePath('/billing');revalidatePath('/projects');
}

export async function deleteInvoiceLine(fd:FormData){
  const {supabase}=await ctx();
  await executeBillingCommand(supabase,fd,'delete_invoice_line');
  revalidatePath('/billing');revalidatePath('/projects');
}

export async function updateInvoice(fd:FormData){
  const {supabase}=await ctx();
  await executeBillingCommand(supabase,fd,'update_invoice');
  revalidatePath('/billing');revalidatePath('/projects');
}

export async function sendInvoice(fd:FormData){
  const {supabase}=await ctx();
  await executeBillingCommand(supabase,fd,'send_invoice');
  revalidatePath('/billing');revalidatePath('/projects');
}

export async function voidInvoice(fd:FormData){
  const {supabase}=await ctx();
  await executeBillingCommand(supabase,fd,'void_invoice');
  revalidatePath('/billing');revalidatePath('/projects');
}

export async function recordInvoicePayment(fd:FormData){
  const {supabase}=await ctx();
  await executeInvoicePayment(supabase,fd);
  revalidatePath('/billing');revalidatePath('/projects');
}
