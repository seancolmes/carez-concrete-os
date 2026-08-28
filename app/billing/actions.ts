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
  const {data:project}=await supabase.from('projects').select('id,customer_id,sales_tax_rate_percent,sales_tax_exempt,sales_tax_jurisdiction').eq('id',projectId).eq('company_id',companyId).single();
  if(!project)throw new Error('Project not found');
  let customer:any=null;
  if(project.customer_id){const {data}=await supabase.from('customers').select('id,name,contact_name,email,billing_terms').eq('id',project.customer_id).maybeSingle();customer=data;}
  const {data:invoiceNumber,error:numberError}=await supabase.rpc('next_invoice_number');
  if(numberError||!invoiceNumber)throw new Error(numberError?.message||'Could not create invoice number');
  const {error}=await supabase.from('invoices').insert({
    company_id:companyId,project_id:projectId,customer_id:project.customer_id||null,invoice_number:invoiceNumber,
    invoice_type:String(fd.get('invoice_type')||'progress'),status:'draft',
    issue_date:String(fd.get('issue_date')||new Date().toISOString().slice(0,10)),
    due_date:String(fd.get('due_date')||new Date().toISOString().slice(0,10)),
    billing_period_start:String(fd.get('billing_period_start')||'')||null,
    billing_period_end:String(fd.get('billing_period_end')||'')||null,
    po_number:String(fd.get('po_number')||'').trim()||null,
    bill_to_name:customer?.name||null,bill_to_contact:customer?.contact_name||null,bill_to_email:customer?.email||null,
    sales_tax_rate_percent:Number(project.sales_tax_rate_percent||0),sales_tax_exempt:Boolean(project.sales_tax_exempt),sales_tax_jurisdiction:project.sales_tax_jurisdiction||null,
    retainage_percent:Math.max(0,n(fd.get('retainage_percent'))),terms_text:customer?.billing_terms||null,
    notes:String(fd.get('notes')||'').trim()||null,created_by:user.id
  });
  if(error)throw new Error(error.message);
  revalidatePath('/billing');
}

export async function addInvoiceLine(fd:FormData){
  const invoiceId=String(fd.get('invoice_id')||''),description=String(fd.get('description')||'').trim();if(!invoiceId||!description)return;
  const {supabase,companyId}=await ctx();
  const {data:invoice}=await supabase.from('invoices').select('id,status,project_id,invoice_type').eq('id',invoiceId).eq('company_id',companyId).single();
  if(!invoice||invoice.status!=='draft')throw new Error('Only draft invoices can be edited.');
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
  const {data:invoice}=await supabase.from('invoices').select('status').eq('id',id).eq('company_id',companyId).single();
  if(invoice?.status!=='draft')throw new Error('Only draft invoices can be edited.');
  const {error}=await supabase.from('invoices').update({
    issue_date:String(fd.get('issue_date')||''),due_date:String(fd.get('due_date')||''),
    billing_period_start:String(fd.get('billing_period_start')||'')||null,billing_period_end:String(fd.get('billing_period_end')||'')||null,
    po_number:String(fd.get('po_number')||'').trim()||null,
    sales_tax_rate_percent:Math.max(0,n(fd.get('sales_tax_rate_percent'))),sales_tax_exempt:fd.get('sales_tax_exempt')==='on',
    sales_tax_jurisdiction:String(fd.get('sales_tax_jurisdiction')||'').trim()||null,
    retainage_percent:Math.max(0,n(fd.get('retainage_percent'))),terms_text:String(fd.get('terms_text')||'').trim()||null,
    notes:String(fd.get('notes')||'').trim()||null,updated_at:new Date().toISOString()
  }).eq('id',id).eq('company_id',companyId);
  if(error)throw new Error(error.message);
  revalidatePath('/billing');
}

export async function sendInvoice(fd:FormData){
  const id=String(fd.get('invoice_id')||'');if(!id)return;
  const {supabase,companyId}=await ctx();
  const {data:summary}=await supabase.from('invoice_financial_summary').select('status,subtotal,invoice_type,sales_tax_rate_percent,sales_tax_exempt').eq('invoice_id',id).single();
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
  const {data:invoice}=await supabase.from('invoice_financial_summary').select('invoice_id,company_id,project_id,customer_id,status,balance_due,collection_status').eq('invoice_id',invoiceId).single();
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
