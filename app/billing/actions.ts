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
const n=(v:FormDataEntryValue|null)=>{const x=Number(String(v??'0').replace(/[$,% ,]/g,''));return Number.isFinite(x)?x:0;};
const r=(v:number)=>Math.round((v+Number.EPSILON)*100)/100;
const addDays=(iso:string,days:number)=>{const d=new Date(`${iso}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);};

export async function updateCompanyBillingProfile(fd:FormData){
  const {supabase,companyId}=await ctx();
  const payload={
    company_id:companyId,
    display_name:String(fd.get('display_name')||'Carez Concrete').trim()||'Carez Concrete',
    legal_name:String(fd.get('legal_name')||'').trim()||null,
    address_line1:String(fd.get('address_line1')||'').trim()||null,
    address_line2:String(fd.get('address_line2')||'').trim()||null,
    city:String(fd.get('city')||'').trim()||null,
    state:String(fd.get('state')||'').trim()||null,
    postal_code:String(fd.get('postal_code')||'').trim()||null,
    phone:String(fd.get('phone')||'').trim()||null,
    email:String(fd.get('email')||'').trim()||null,
    website:String(fd.get('website')||'').trim()||null,
    ubi_number:String(fd.get('ubi_number')||'').trim()||null,
    contractor_license_number:String(fd.get('contractor_license_number')||'').trim()||null,
    logo_path:'/brand/carez-wordmark.png',
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
  const {error}=await supabase.from('customers').update({
    contact_name:String(fd.get('contact_name')||'').trim()||null,
    email:String(fd.get('email')||'').trim()||null,
    phone:String(fd.get('phone')||'').trim()||null,
    billing_terms:String(fd.get('billing_terms')||'').trim()||null,
    billing_address_line1:String(fd.get('billing_address_line1')||'').trim()||null,
    billing_address_line2:String(fd.get('billing_address_line2')||'').trim()||null,
    billing_city:String(fd.get('billing_city')||'').trim()||null,
    billing_state:String(fd.get('billing_state')||'').trim()||null,
    billing_postal_code:String(fd.get('billing_postal_code')||'').trim()||null
  }).eq('id',customerId).eq('company_id',companyId);
  if(error)throw new Error(error.message);
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
  const projectId=String(fd.get('project_id')||'');if(!projectId)return;
  const {supabase,user,companyId}=await ctx();
  const [{data:project},{data:billingProfile}]=await Promise.all([
    supabase.from('projects').select('id,customer_id,sales_tax_rate_percent,sales_tax_exempt,sales_tax_jurisdiction').eq('id',projectId).eq('company_id',companyId).single(),
    supabase.from('company_billing_profiles').select('*').eq('company_id',companyId).maybeSingle()
  ]);
  if(!project)throw new Error('Project not found');
  let customer:any=null;
  if(project.customer_id){const {data}=await supabase.from('customers').select('*').eq('id',project.customer_id).maybeSingle();customer=data;}
  const {data:invoiceNumber,error:numberError}=await supabase.rpc('next_invoice_number');
  if(numberError||!invoiceNumber)throw new Error(numberError?.message||'Could not create invoice number');
  const issueDate=String(fd.get('issue_date')||new Date().toISOString().slice(0,10));
  const dueDate=String(fd.get('due_date')||'')||addDays(issueDate,Number(billingProfile?.default_due_days||0));
  const {error}=await supabase.from('invoices').insert({
    company_id:companyId,project_id:projectId,customer_id:project.customer_id||null,invoice_number:invoiceNumber,
    invoice_type:String(fd.get('invoice_type')||'progress'),status:'draft',issue_date:issueDate,due_date:dueDate,
    billing_period_start:String(fd.get('billing_period_start')||'')||null,billing_period_end:String(fd.get('billing_period_end')||'')||null,
    po_number:String(fd.get('po_number')||'').trim()||null,
    from_name:billingProfile?.display_name||'Carez Concrete',from_legal_name:billingProfile?.legal_name||null,
    from_address_line1:billingProfile?.address_line1||null,from_address_line2:billingProfile?.address_line2||null,
    from_city:billingProfile?.city||null,from_state:billingProfile?.state||null,from_postal_code:billingProfile?.postal_code||null,
    from_phone:billingProfile?.phone||null,from_email:billingProfile?.email||null,from_website:billingProfile?.website||null,
    from_ubi_number:billingProfile?.ubi_number||null,from_contractor_license_number:billingProfile?.contractor_license_number||null,
    from_logo_path:billingProfile?.logo_path||'/brand/carez-wordmark.png',payment_instructions:billingProfile?.payment_instructions||null,invoice_footer:billingProfile?.invoice_footer||null,
    bill_to_name:customer?.name||null,bill_to_contact:customer?.contact_name||null,bill_to_email:customer?.email||null,
    bill_to_address_line1:customer?.billing_address_line1||null,bill_to_address_line2:customer?.billing_address_line2||null,
    bill_to_city:customer?.billing_city||null,bill_to_state:customer?.billing_state||null,bill_to_postal_code:customer?.billing_postal_code||null,
    sales_tax_rate_percent:Number(project.sales_tax_rate_percent||0),sales_tax_exempt:Boolean(project.sales_tax_exempt),sales_tax_jurisdiction:project.sales_tax_jurisdiction||null,
    retainage_percent:Math.max(0,n(fd.get('retainage_percent'))),terms_text:customer?.billing_terms||billingProfile?.default_terms_text||null,
    notes:String(fd.get('notes')||'').trim()||null,created_by:user.id
  });
  if(error)throw new Error(error.message);
  revalidatePath('/billing');
}

export async function createRetainageRelease(fd:FormData){
  const sourceInvoiceId=String(fd.get('source_invoice_id')||'');if(!sourceInvoiceId)return;
  const amount=r(Math.max(0,n(fd.get('amount'))));if(amount<=0)return;
  const {supabase,user,companyId}=await ctx();
  const [{data:available},{data:source},{data:billingProfile}]=await Promise.all([
    supabase.from('retainage_available_summary').select('*').eq('source_invoice_id',sourceInvoiceId).single(),
    supabase.from('invoices').select('*').eq('id',sourceInvoiceId).eq('company_id',companyId).single(),
    supabase.from('company_billing_profiles').select('*').eq('company_id',companyId).maybeSingle()
  ]);
  if(!available||!source)throw new Error('Source invoice does not have releasable retainage.');
  if(amount>Number(available.available_to_release||0)+0.009)throw new Error('Release amount exceeds retainage currently available.');
  const {data:invoiceNumber,error:numberError}=await supabase.rpc('next_invoice_number');
  if(numberError||!invoiceNumber)throw new Error(numberError?.message||'Could not create invoice number');
  const issueDate=String(fd.get('issue_date')||new Date().toISOString().slice(0,10));
  const dueDate=String(fd.get('due_date')||'')||addDays(issueDate,Number(billingProfile?.default_due_days||0));
  const {data:newInvoice,error}=await supabase.from('invoices').insert({
    company_id:companyId,project_id:source.project_id,customer_id:source.customer_id,invoice_number:invoiceNumber,
    invoice_type:'retainage_release',status:'draft',issue_date:issueDate,due_date:dueDate,
    from_name:billingProfile?.display_name||source.from_name||'Carez Concrete',from_legal_name:billingProfile?.legal_name||source.from_legal_name||null,
    from_address_line1:billingProfile?.address_line1||source.from_address_line1||null,from_address_line2:billingProfile?.address_line2||source.from_address_line2||null,
    from_city:billingProfile?.city||source.from_city||null,from_state:billingProfile?.state||source.from_state||null,from_postal_code:billingProfile?.postal_code||source.from_postal_code||null,
    from_phone:billingProfile?.phone||source.from_phone||null,from_email:billingProfile?.email||source.from_email||null,from_website:billingProfile?.website||source.from_website||null,
    from_ubi_number:billingProfile?.ubi_number||source.from_ubi_number||null,from_contractor_license_number:billingProfile?.contractor_license_number||source.from_contractor_license_number||null,
    from_logo_path:billingProfile?.logo_path||source.from_logo_path||'/brand/carez-wordmark.png',payment_instructions:billingProfile?.payment_instructions||source.payment_instructions||null,invoice_footer:billingProfile?.invoice_footer||source.invoice_footer||null,
    bill_to_name:source.bill_to_name,bill_to_contact:source.bill_to_contact,bill_to_email:source.bill_to_email,
    bill_to_address_line1:source.bill_to_address_line1,bill_to_address_line2:source.bill_to_address_line2,bill_to_city:source.bill_to_city,bill_to_state:source.bill_to_state,bill_to_postal_code:source.bill_to_postal_code,
    sales_tax_rate_percent:Number(source.sales_tax_rate_percent||0),sales_tax_exempt:Boolean(source.sales_tax_exempt),sales_tax_jurisdiction:source.sales_tax_jurisdiction,
    retainage_percent:0,terms_text:source.terms_text||billingProfile?.default_terms_text||null,
    notes:`Retainage release from ${source.invoice_number}. Sales tax, if applicable, was billed on the original invoice.`,created_by:user.id
  }).select('id').single();
  if(error||!newInvoice)throw new Error(error?.message||'Retainage invoice could not be created');
  const {error:lineError}=await supabase.from('invoice_lines').insert({
    company_id:companyId,invoice_id:newInvoice.id,source_type:'retainage_release',source_invoice_id:sourceInvoiceId,
    description:`Retainage release — ${source.invoice_number}`,quantity:1,unit:'LS',unit_price:amount,line_amount:amount,taxable:false,sort_order:10
  });
  if(lineError){await supabase.from('invoices').delete().eq('id',newInvoice.id);throw new Error(lineError.message);}
  revalidatePath('/billing');
}

export async function addInvoiceLine(fd:FormData){
  const invoiceId=String(fd.get('invoice_id')||''),description=String(fd.get('description')||'').trim();if(!invoiceId||!description)return;
  const {supabase,companyId}=await ctx();
  const {data:invoice}=await supabase.from('invoices').select('id,status,project_id,invoice_type').eq('id',invoiceId).eq('company_id',companyId).single();
  if(!invoice||invoice.status!=='draft')throw new Error('Only draft invoices can be edited.');
  if(invoice.invoice_type==='retainage_release')throw new Error('Retainage-release lines are created from held retainage and cannot be manually added.');
  const sourceType=String(fd.get('source_type')||'manual');
  const changeOrderId=String(fd.get('change_order_id')||'')||null;
  if(changeOrderId){const {data:co}=await supabase.from('change_orders').select('id,status,project_id').eq('id',changeOrderId).eq('company_id',companyId).single();if(!co||co.status!=='approved'||co.project_id!==invoice.project_id)throw new Error('Only an approved change order from this project can be billed.');}
  const quantity=Math.max(0,n(fd.get('quantity'))),unitPrice=n(fd.get('unit_price'));
  const amount=r(quantity*unitPrice);
  if(invoice.invoice_type==='credit_memo'&&amount>0)throw new Error('Credit memo lines must use a negative unit price.');
  if(invoice.invoice_type!=='credit_memo'&&amount<0)throw new Error('Use a Credit Memo invoice for customer credits.');
  const {error}=await supabase.from('invoice_lines').insert({
    company_id:companyId,invoice_id:invoiceId,source_type:sourceType,change_order_id:changeOrderId,
    description,quantity,unit:String(fd.get('unit')||'LS'),unit_price:unitPrice,line_amount:amount,
    taxable:fd.get('taxable')==='on',notes:String(fd.get('notes')||'').trim()||null,sort_order:Date.now()%1000000
  });
  if(error)throw new Error(error.message);
  revalidatePath('/billing');
}

export async function deleteInvoiceLine(fd:FormData){
  const lineId=String(fd.get('line_id')||''),invoiceId=String(fd.get('invoice_id')||'');if(!lineId||!invoiceId)return;
  const {supabase,companyId}=await ctx();
  const {data:invoice}=await supabase.from('invoices').select('status').eq('id',invoiceId).eq('company_id',companyId).single();
  if(invoice?.status!=='draft')throw new Error('Only draft invoices can be edited.');
  await supabase.from('invoice_lines').delete().eq('id',lineId).eq('company_id',companyId);
  revalidatePath('/billing');
}

export async function updateInvoice(fd:FormData){
  const id=String(fd.get('invoice_id')||'');if(!id)return;
  const {supabase,companyId}=await ctx();
  const {data:invoice}=await supabase.from('invoices').select('status,invoice_type').eq('id',id).eq('company_id',companyId).single();
  if(invoice?.status!=='draft')throw new Error('Only draft invoices can be edited.');
  const patch:any={
    issue_date:String(fd.get('issue_date')||''),due_date:String(fd.get('due_date')||''),
    billing_period_start:String(fd.get('billing_period_start')||'')||null,billing_period_end:String(fd.get('billing_period_end')||'')||null,
    po_number:String(fd.get('po_number')||'').trim()||null,
    terms_text:String(fd.get('terms_text')||'').trim()||null,notes:String(fd.get('notes')||'').trim()||null,updated_at:new Date().toISOString()
  };
  if(invoice.invoice_type!=='retainage_release'){
    patch.sales_tax_rate_percent=Math.max(0,n(fd.get('sales_tax_rate_percent')));
    patch.sales_tax_exempt=fd.get('sales_tax_exempt')==='on';
    patch.sales_tax_jurisdiction=String(fd.get('sales_tax_jurisdiction')||'').trim()||null;
    patch.retainage_percent=Math.max(0,n(fd.get('retainage_percent')));
  }
  const {error}=await supabase.from('invoices').update(patch).eq('id',id).eq('company_id',companyId);
  if(error)throw new Error(error.message);
  revalidatePath('/billing');
}

export async function sendInvoice(fd:FormData){
  const id=String(fd.get('invoice_id')||'');if(!id)return;
  const {supabase,companyId}=await ctx();
  const {data:summary}=await supabase.from('invoice_financial_summary').select('status,subtotal,invoice_type').eq('invoice_id',id).single();
  if(!summary||summary.status!=='draft')throw new Error('Invoice is not an editable draft.');
  if(Math.abs(Number(summary.subtotal||0))<0.01)throw new Error('Add at least one invoice line before sending.');
  if(summary.invoice_type==='credit_memo'&&Number(summary.subtotal)>0)throw new Error('Credit memo total must be negative.');
  const {error}=await supabase.from('invoices').update({status:'sent',sent_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',id).eq('company_id',companyId);
  if(error)throw new Error(error.message);
  revalidatePath('/billing');revalidatePath('/projects');
}

export async function voidInvoice(fd:FormData){
  const id=String(fd.get('invoice_id')||'');if(!id)return;
  const {supabase,companyId}=await ctx();
  const {data:summary}=await supabase.from('invoice_financial_summary').select('amount_paid,status').eq('invoice_id',id).single();
  if(!summary||summary.status==='void')return;
  if(Number(summary.amount_paid||0)>0.009)throw new Error('This invoice has a payment. Reverse or reallocate the payment before voiding it.');
  const {error}=await supabase.from('invoices').update({status:'void',voided_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',id).eq('company_id',companyId);
  if(error)throw new Error(error.message);
  revalidatePath('/billing');revalidatePath('/projects');
}

export async function recordInvoicePayment(fd:FormData){
  const invoiceId=String(fd.get('invoice_id')||'');const amount=r(Math.max(0,n(fd.get('amount'))));if(!invoiceId||amount<=0)return;
  const {supabase,user,companyId}=await ctx();
  const {data:invoice}=await supabase.from('invoice_financial_summary').select('invoice_id,company_id,project_id,customer_id,status,balance_due').eq('invoice_id',invoiceId).single();
  if(!invoice||invoice.status!=='sent')throw new Error('Payments can only be recorded against sent invoices.');
  const balance=Number(invoice.balance_due||0);if(balance<=0.009)throw new Error('This invoice has no balance due.');
  if(amount>balance+0.01)throw new Error('Payment is greater than the current invoice balance.');
  const fee=r(Math.max(0,n(fd.get('processing_fee'))));if(fee>amount)throw new Error('Processing fee cannot exceed the payment.');
  const {data:payment,error:paymentError}=await supabase.from('customer_payments').insert({
    company_id:companyId,customer_id:invoice.customer_id||null,project_id:invoice.project_id,
    received_date:String(fd.get('received_date')||new Date().toISOString().slice(0,10)),amount,processing_fee:fee,
    payment_method:String(fd.get('payment_method')||'check'),reference_number:String(fd.get('reference_number')||'').trim()||null,
    notes:String(fd.get('notes')||'').trim()||null,created_by:user.id
  }).select('id').single();
  if(paymentError||!payment)throw new Error(paymentError?.message||'Payment could not be saved');
  const {error:allocationError}=await supabase.from('payment_allocations').insert({company_id:companyId,payment_id:payment.id,invoice_id:invoiceId,amount});
  if(allocationError){await supabase.from('customer_payments').delete().eq('id',payment.id);throw new Error(allocationError.message);}
  revalidatePath('/billing');revalidatePath('/projects');
}
