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
const r=(v:number)=>Math.round((v+Number.EPSILON)*100)/100;
const txt=(v:FormDataEntryValue|null)=>String(v||'').trim()||null;

export async function addCompanyExpense(fd:FormData){
  const description=String(fd.get('description')||'').trim();if(!description)return;
  const {supabase,user,companyId}=await ctx();
  const overheadItemId=txt(fd.get('overhead_item_id'));
  let category=String(fd.get('category')||'Other').trim()||'Other';
  let businessUseRaw=String(fd.get('business_use_percent')||'').trim();
  if(overheadItemId){
    const {data:item}=await supabase.from('overhead_items').select('id,category,business_use_percent').eq('id',overheadItemId).eq('company_id',companyId).maybeSingle();
    if(!item)throw new Error('Overhead plan item not found.');
    category=item.category||category;
    if(!businessUseRaw)businessUseRaw=String(item.business_use_percent??100);
  }
  const subtotal=Math.max(0,n(fd.get('subtotal'))),salesTax=Math.max(0,n(fd.get('sales_tax'))),total=r(subtotal+salesTax);
  const businessUse=Math.min(100,Math.max(0,businessUseRaw?Number(businessUseRaw):100));
  const status=String(fd.get('payment_status')||'paid');
  const cashSource=String(fd.get('cash_source')||'company_account');
  const paidDate=status==='paid'?(txt(fd.get('paid_date'))||String(fd.get('expense_date')||new Date().toISOString().slice(0,10))):null;
  const {error}=await supabase.from('company_expenses').insert({
    company_id:companyId,overhead_item_id:overheadItemId,expense_date:String(fd.get('expense_date')||new Date().toISOString().slice(0,10)),due_date:txt(fd.get('due_date')),
    category,payee:txt(fd.get('payee')),description,subtotal,sales_tax:salesTax,total_amount:total,business_use_percent:businessUse,business_expense_amount:r(total*businessUse/100),
    cash_source:cashSource,payment_status:status,paid_date:paidDate,payment_method:txt(fd.get('payment_method')),reference_number:txt(fd.get('reference_number')),receipt_reference:txt(fd.get('receipt_reference')),notes:txt(fd.get('notes')),created_by:user.id
  });
  if(error)throw new Error(error.message);
  revalidatePath('/cashflow');revalidatePath('/overhead');revalidatePath('/');
}

export async function markCompanyExpensePaid(fd:FormData){
  const id=String(fd.get('expense_id')||'');if(!id)return;
  const {supabase,companyId}=await ctx();
  const {data:e}=await supabase.from('company_expenses').select('payment_status').eq('id',id).eq('company_id',companyId).maybeSingle();
  if(!e||e.payment_status!=='unpaid')throw new Error('Only unpaid expenses can be marked paid.');
  const {error}=await supabase.from('company_expenses').update({payment_status:'paid',paid_date:String(fd.get('paid_date')||new Date().toISOString().slice(0,10)),payment_method:txt(fd.get('payment_method')),reference_number:txt(fd.get('reference_number')),updated_at:new Date().toISOString()}).eq('id',id).eq('company_id',companyId);
  if(error)throw new Error(error.message);
  revalidatePath('/cashflow');revalidatePath('/');
}

export async function voidCompanyExpense(fd:FormData){
  const id=String(fd.get('expense_id')||'');if(!id)return;
  const {supabase,companyId}=await ctx();
  const {error}=await supabase.from('company_expenses').update({payment_status:'void',updated_at:new Date().toISOString()}).eq('id',id).eq('company_id',companyId).neq('payment_status','void');
  if(error)throw new Error(error.message);
  revalidatePath('/cashflow');revalidatePath('/overhead');revalidatePath('/');
}

export async function addCashAccount(fd:FormData){
  const name=String(fd.get('name')||'').trim();if(!name)return;
  const {supabase,companyId}=await ctx();
  const {error}=await supabase.from('company_cash_accounts').insert({company_id:companyId,name,account_type:String(fd.get('account_type')||'checking'),notes:txt(fd.get('notes'))});
  if(error)throw new Error(error.message);
  revalidatePath('/cashflow');
}

export async function recordCashBalance(fd:FormData){
  const accountId=String(fd.get('cash_account_id')||'');if(!accountId)return;
  const {supabase,user,companyId}=await ctx();
  const {data:a}=await supabase.from('company_cash_accounts').select('id').eq('id',accountId).eq('company_id',companyId).eq('active',true).maybeSingle();if(!a)throw new Error('Cash account not found.');
  const balanceDate=String(fd.get('balance_date')||new Date().toISOString().slice(0,10));
  const {error}=await supabase.from('company_cash_balance_snapshots').upsert({company_id:companyId,cash_account_id:accountId,balance_date:balanceDate,balance:n(fd.get('balance')),notes:txt(fd.get('notes')),created_by:user.id},{onConflict:'cash_account_id,balance_date'});
  if(error)throw new Error(error.message);
  revalidatePath('/cashflow');revalidatePath('/');revalidatePath('/pour-control');
}

export async function addCashReserve(fd:FormData){
  const name=String(fd.get('name')||'').trim(),amount=Math.max(0,n(fd.get('amount')));if(!name||amount<=0)return;
  const {supabase,user,companyId}=await ctx();
  const {error}=await supabase.from('company_cash_reserves').insert({company_id:companyId,reserve_type:String(fd.get('reserve_type')||'other'),name,amount,due_date:txt(fd.get('due_date')),notes:txt(fd.get('notes')),created_by:user.id});
  if(error)throw new Error(error.message);
  revalidatePath('/cashflow');revalidatePath('/');
}

export async function releaseCashReserve(fd:FormData){
  const id=String(fd.get('reserve_id')||'');if(!id)return;
  const {supabase,companyId}=await ctx();
  const {error}=await supabase.from('company_cash_reserves').update({active:false,updated_at:new Date().toISOString()}).eq('id',id).eq('company_id',companyId);
  if(error)throw new Error(error.message);
  revalidatePath('/cashflow');revalidatePath('/');
}

export async function recordTaxRemittance(fd:FormData){
  const amount=Math.max(0,n(fd.get('amount')));if(amount<=0)return;
  const {supabase,user,companyId}=await ctx();
  const {error}=await supabase.from('company_tax_remittances').insert({company_id:companyId,tax_type:String(fd.get('tax_type')||'sales_tax'),payment_date:String(fd.get('payment_date')||new Date().toISOString().slice(0,10)),amount,reference_number:txt(fd.get('reference_number')),notes:txt(fd.get('notes')),created_by:user.id});
  if(error)throw new Error(error.message);
  revalidatePath('/cashflow');revalidatePath('/');
}

export async function deleteTaxRemittance(fd:FormData){
  const id=String(fd.get('remittance_id')||'');if(!id)return;
  const {supabase,companyId}=await ctx();
  const {error}=await supabase.from('company_tax_remittances').delete().eq('id',id).eq('company_id',companyId);
  if(error)throw new Error(error.message);
  revalidatePath('/cashflow');revalidatePath('/');
}
