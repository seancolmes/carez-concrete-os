'use server';
import {executeFinancialCommand,financialRequestId,optionalFinancialNumber} from '@/lib/financials/commands';
import {revalidateFinancialsWorkspace as revalidatePath} from '@/lib/ui/revalidateUnifiedWorkspace';
import { createClient } from '@/lib/supabase/server';

const command=(client:Parameters<typeof executeFinancialCommand>[0],fd:FormData,name:string,args:Record<string,unknown>)=>executeFinancialCommand(client,name,args,financialRequestId(fd));

async function ctx(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)throw new Error('Not signed in');
  const {data:profile}=await supabase.from('profiles').select('company_id').eq('id',user.id).single();
  if(!profile?.company_id)throw new Error('Company profile missing');
  return {supabase};
}
const n=(v:FormDataEntryValue|null)=>optionalFinancialNumber(v)??0;

export async function recordVendorPayment(fd:FormData){
  const billId=String(fd.get('vendor_bill_id')||'');if(!billId)return;
  const {supabase}=await ctx();
  const amount=n(fd.get('amount'));if(amount<=0)throw new Error('Payment amount must be greater than zero.');
  const {error}=await command(supabase,fd,'record_vendor_bill_payment',{
    p_vendor_bill_id:billId,
    p_payment_date:String(fd.get('payment_date')||new Date().toISOString().slice(0,10)),
    p_amount:amount,
    p_payment_method:String(fd.get('payment_method')||'check'),
    p_reference_number:String(fd.get('reference_number')||'').trim()||null,
    p_processing_fee:Math.max(0,n(fd.get('processing_fee'))),
    p_notes:String(fd.get('notes')||'').trim()||null
  });
  if(error)throw new Error(error.message);
  revalidatePath('/payables');revalidatePath('/procurement');revalidatePath('/projects');revalidatePath('/cashflow');revalidatePath('/overhead');revalidatePath('/');
}

export async function voidVendorPayment(fd:FormData){
  const id=String(fd.get('vendor_payment_id')||'');if(!id)return;
  const {supabase}=await ctx();
  const {error}=await command(supabase,fd,'void_vendor_payment',{p_vendor_payment_id:id});
  if(error)throw new Error(error.message);
  revalidatePath('/payables');revalidatePath('/procurement');revalidatePath('/projects');revalidatePath('/cashflow');revalidatePath('/overhead');revalidatePath('/');
}
