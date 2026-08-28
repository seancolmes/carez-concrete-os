'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

async function ctx(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)throw new Error('Not signed in');
  const {data:profile}=await supabase.from('profiles').select('company_id').eq('id',user.id).single();
  if(!profile?.company_id)throw new Error('Company profile missing');
  return {supabase,user,companyId:profile.company_id};
}
const n=(v:FormDataEntryValue|null)=>{const x=Number(String(v??'0').replace(/[$,% ,]/g,''));return Number.isFinite(x)?x:0;};

export async function recordVendorPayment(fd:FormData){
  const billId=String(fd.get('vendor_bill_id')||'');if(!billId)return;
  const {supabase,user,companyId}=await ctx();
  const amount=n(fd.get('amount'));if(amount<=0)throw new Error('Payment amount must be greater than zero.');
  const fee=Math.max(0,n(fd.get('processing_fee')));
  const paymentDate=String(fd.get('payment_date')||new Date().toISOString().slice(0,10));
  const method=String(fd.get('payment_method')||'check');
  const reference=String(fd.get('reference_number')||'').trim()||null;
  const notes=String(fd.get('notes')||'').trim()||null;
  const [{data:bill},{data:paymentId,error}]=await Promise.all([
    supabase.from('vendor_bill_ap_summary').select('vendor_name,vendor_bill_number').eq('vendor_bill_id',billId).eq('company_id',companyId).maybeSingle(),
    supabase.rpc('record_vendor_bill_payment',{
      p_vendor_bill_id:billId,p_payment_date:paymentDate,p_amount:amount,p_payment_method:method,p_reference_number:reference,p_processing_fee:fee,p_notes:notes
    })
  ]);
  if(error)throw new Error(error.message);
  if(fee>0&&paymentId){
    const {data:bankingItem}=await supabase.from('overhead_items').select('id,category,business_use_percent').eq('company_id',companyId).eq('name','Bank account / ACH / wire fees').eq('active',true).maybeSingle();
    const {error:feeError}=await supabase.from('company_expenses').insert({
      company_id:companyId,overhead_item_id:bankingItem?.id||null,expense_date:paymentDate,category:bankingItem?.category||'Banking',payee:bill?.vendor_name||null,
      description:`Vendor payment fee${bill?.vendor_bill_number?` — ${bill.vendor_bill_number}`:''}`,subtotal:fee,sales_tax:0,total_amount:fee,
      business_use_percent:Number(bankingItem?.business_use_percent??100),business_expense_amount:fee,cash_source:'company_account',payment_status:'paid',paid_date:paymentDate,
      payment_method:method,reference_number:reference,notes:'Automatically created from vendor payment.',source_type:'vendor_payment_fee',source_id:paymentId,created_by:user.id
    });
    if(feeError)throw new Error(`Vendor payment posted, but fee expense could not be recorded: ${feeError.message}`);
  }
  revalidatePath('/payables');revalidatePath('/procurement');revalidatePath('/projects');revalidatePath('/cashflow');revalidatePath('/overhead');revalidatePath('/');
}

export async function voidVendorPayment(fd:FormData){
  const id=String(fd.get('vendor_payment_id')||'');if(!id)return;
  const {supabase,companyId}=await ctx();
  const {error}=await supabase.rpc('void_vendor_payment',{p_vendor_payment_id:id});
  if(error)throw new Error(error.message);
  await supabase.from('company_expenses').update({payment_status:'void',updated_at:new Date().toISOString()}).eq('company_id',companyId).eq('source_type','vendor_payment_fee').eq('source_id',id);
  revalidatePath('/payables');revalidatePath('/procurement');revalidatePath('/projects');revalidatePath('/cashflow');revalidatePath('/overhead');revalidatePath('/');
}
