'use server';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';

async function ctx(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)throw new Error('Not signed in');
  const {data:p}=await supabase.from('profiles').select('company_id,role').eq('id',user.id).single();
  if(!p?.company_id||p.role==='employee')throw new Error('Owner access required');
  return {supabase,user,companyId:p.company_id};
}
const n=(v:FormDataEntryValue|null)=>{const x=Number(String(v??'0').replace(/[$,% ,]/g,''));return Number.isFinite(x)?x:0;};
const r=(v:number)=>Math.round((v+Number.EPSILON)*100)/100;
const addDays=(iso:string,days:number)=>{const d=new Date(`${iso}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);};
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
  const projectId=String(fd.get('project_id')||''),awardId=String(fd.get('award_record_id')||''),label=String(fd.get('label')||'').trim();
  if(!projectId||!awardId||!label)return;
  const {supabase,user,companyId}=await ctx();
  const {data:award}=await supabase.from('project_award_records').select('id,project_id,original_contract_value,status').eq('id',awardId).eq('company_id',companyId).single();
  if(!award||award.project_id!==projectId||award.status!=='accepted')throw new Error('Accepted job agreement not found.');
  const basis=String(fd.get('amount_basis')||'percent');
  const percent=Math.max(0,n(fd.get('percent_of_contract'))),fixed=Math.max(0,n(fd.get('fixed_amount')));
  if(basis==='percent'&&percent>100)throw new Error('Payment milestone percentage cannot exceed 100%.');
  const amount=r(basis==='percent'?Number(award.original_contract_value||0)*percent/100:fixed);
  if(amount<=0)throw new Error('Payment milestone amount must be greater than $0.');
  const {data:last}=await supabase.from('project_payment_milestones').select('sequence_no').eq('company_id',companyId).eq('project_id',projectId).order('sequence_no',{ascending:false}).limit(1).maybeSingle();
  const milestoneType=String(fd.get('milestone_type')||'progress'),dueTrigger=String(fd.get('due_trigger')||'manual');
  const required=fd.get('required_before_start')==='on';
  const {error}=await supabase.from('project_payment_milestones').insert({
    company_id:companyId,project_id:projectId,award_record_id:awardId,sequence_no:Number(last?.sequence_no||0)+10,
    milestone_type:milestoneType,label,amount_basis:basis,percent_of_contract:basis==='percent'?percent:null,amount,
    due_trigger:required?'before_start':dueTrigger,required_before_start:required,notes:String(fd.get('notes')||'').trim()||null,created_by:user.id
  });
  if(error)throw new Error(error.message);refresh(projectId);
}

export async function deletePaymentMilestone(fd:FormData){
  const id=String(fd.get('milestone_id')||''),projectId=String(fd.get('project_id')||'');if(!id||!projectId)return;
  const {supabase,companyId}=await ctx();
  const {data:m}=await supabase.from('project_payment_milestones').select('invoice_id').eq('id',id).eq('company_id',companyId).eq('project_id',projectId).single();
  if(!m)throw new Error('Payment milestone not found.');
  if(m.invoice_id)throw new Error('This milestone already has an invoice. Void the invoice instead of deleting the milestone.');
  const {error}=await supabase.from('project_payment_milestones').delete().eq('id',id).eq('company_id',companyId);
  if(error)throw new Error(error.message);refresh(projectId);
}

export async function waivePaymentMilestone(fd:FormData){
  const id=String(fd.get('milestone_id')||''),projectId=String(fd.get('project_id')||''),reason=String(fd.get('reason')||'').trim();if(!id||!projectId)return;
  if(!reason)throw new Error('Enter why the payment requirement is being waived.');
  const {supabase,companyId}=await ctx();
  const {data:m}=await supabase.from('project_payment_milestones').select('invoice_id').eq('id',id).eq('company_id',companyId).eq('project_id',projectId).single();
  if(!m)throw new Error('Payment milestone not found.');
  if(m.invoice_id)throw new Error('An invoiced milestone cannot be waived here. Void or resolve the invoice first.');
  const {error}=await supabase.from('project_payment_milestones').update({waived_at:new Date().toISOString(),waived_reason:reason,updated_at:new Date().toISOString()}).eq('id',id).eq('company_id',companyId);
  if(error)throw new Error(error.message);refresh(projectId);
}

export async function createMilestoneInvoice(fd:FormData){
  const milestoneId=String(fd.get('milestone_id')||''),projectId=String(fd.get('project_id')||'');if(!milestoneId||!projectId)return;
  const {supabase,user,companyId}=await ctx();
  const [{data:m},{data:project},{data:billingProfile}]=await Promise.all([
    supabase.from('project_payment_milestones').select('*,project_award_records(agreement_number)').eq('id',milestoneId).eq('company_id',companyId).eq('project_id',projectId).single(),
    supabase.from('projects').select('id,customer_id,job_number,name,sales_tax_rate_percent,sales_tax_exempt,sales_tax_jurisdiction').eq('id',projectId).eq('company_id',companyId).single(),
    supabase.from('company_billing_profiles').select('*').eq('company_id',companyId).maybeSingle()
  ]);
  if(!m||!project)throw new Error('Job or payment milestone not found.');
  if(m.waived_at)throw new Error('This payment milestone was waived.');
  if(m.invoice_id)throw new Error('This payment milestone already has an invoice.');
  const billingReady=Boolean(project.sales_tax_exempt)||(Number(project.sales_tax_rate_percent||0)>0&&Boolean(String(project.sales_tax_jurisdiction||'').trim()));
  if(!billingReady)throw new Error('Finish the project sales-tax setup before creating the invoice.');
  let customer:any=null;if(project.customer_id){const {data}=await supabase.from('customers').select('*').eq('id',project.customer_id).maybeSingle();customer=data;}
  const {data:invoiceNumber,error:numberError}=await supabase.rpc('next_invoice_number');
  if(numberError||!invoiceNumber)throw new Error(numberError?.message||'Could not create invoice number');
  const issueDate=new Date().toISOString().slice(0,10),dueDate=addDays(issueDate,Number(billingProfile?.default_due_days||0));
  const invoiceType=m.milestone_type==='deposit'?'deposit':m.milestone_type==='final'?'final':'progress';
  const agreementNumber=(m as any).project_award_records?.agreement_number||null;
  const {data:invoice,error}=await supabase.from('invoices').insert({
    company_id:companyId,project_id:projectId,customer_id:project.customer_id||null,invoice_number:invoiceNumber,invoice_type:invoiceType,status:'draft',issue_date:issueDate,due_date:dueDate,
    from_name:billingProfile?.display_name||'Carez Concrete',from_legal_name:billingProfile?.legal_name||null,
    from_address_line1:billingProfile?.address_line1||null,from_address_line2:billingProfile?.address_line2||null,from_city:billingProfile?.city||null,from_state:billingProfile?.state||null,from_postal_code:billingProfile?.postal_code||null,
    from_phone:billingProfile?.phone||null,from_email:billingProfile?.email||null,from_website:billingProfile?.website||null,from_ubi_number:billingProfile?.ubi_number||null,from_contractor_license_number:billingProfile?.contractor_license_number||null,
    from_logo_path:billingProfile?.logo_path||'/brand/carez-wordmark.png',payment_instructions:billingProfile?.payment_instructions||null,invoice_footer:billingProfile?.invoice_footer||null,
    bill_to_name:customer?.name||null,bill_to_contact:customer?.contact_name||null,bill_to_email:customer?.email||null,bill_to_address_line1:customer?.billing_address_line1||null,bill_to_address_line2:customer?.billing_address_line2||null,
    bill_to_city:customer?.billing_city||null,bill_to_state:customer?.billing_state||null,bill_to_postal_code:customer?.billing_postal_code||null,
    sales_tax_rate_percent:Number(project.sales_tax_rate_percent||0),sales_tax_exempt:Boolean(project.sales_tax_exempt),sales_tax_jurisdiction:project.sales_tax_jurisdiction||null,
    retainage_percent:0,terms_text:customer?.billing_terms||billingProfile?.default_terms_text||null,
    notes:`${m.label}${agreementNumber?` · ${agreementNumber}`:''} · ${project.job_number} ${project.name}`,created_by:user.id
  }).select('id').single();
  if(error||!invoice)throw new Error(error?.message||'Could not create milestone invoice.');
  const {error:lineError}=await supabase.from('invoice_lines').insert({company_id:companyId,invoice_id:invoice.id,source_type:'original_contract',description:m.label,quantity:1,unit:'LS',unit_price:Number(m.amount||0),line_amount:Number(m.amount||0),taxable:true,sort_order:10});
  if(lineError){await supabase.from('invoices').delete().eq('id',invoice.id);throw new Error(lineError.message);}
  const {error:linkError}=await supabase.from('project_payment_milestones').update({invoice_id:invoice.id,updated_at:new Date().toISOString()}).eq('id',milestoneId).eq('company_id',companyId);
  if(linkError){await supabase.from('invoices').delete().eq('id',invoice.id);throw new Error(linkError.message);}
  refresh(projectId);
}
