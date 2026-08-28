'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { analyzeBankTransactions } from '@/lib/bank-reconciliation';

async function ctx(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('Not signed in');const {data:profile}=await supabase.from('profiles').select('company_id').eq('id',user.id).single();if(!profile?.company_id)throw new Error('Company profile missing');return{supabase,user,companyId:profile.company_id};}
const refresh=()=>{revalidatePath('/banking');revalidatePath('/banking/reconcile');revalidatePath('/cashflow');revalidatePath('/billing');revalidatePath('/payables');revalidatePath('/projects');revalidatePath('/forecast');revalidatePath('/payroll');revalidatePath('/overhead');revalidatePath('/');revalidatePath('/pour-control');};
const b=(fd:FormData,name:string)=>String(fd.get(name)||'')==='on'||String(fd.get(name)||'')==='true';
const text=(fd:FormData,name:string)=>String(fd.get(name)||'').trim()||null;
const num=(fd:FormData,name:string)=>{const x=Number(String(fd.get(name)||'').replace(/[$,% ,]/g,''));return Number.isFinite(x)?x:null;};

export async function setBankAccountCashUse(fd:FormData){const id=String(fd.get('account_id')||'');if(!id)return;const {supabase,companyId}=await ctx();const include=String(fd.get('include_in_cash')||'')==='true';const {data:a}=await supabase.from('plaid_accounts').select('account_type').eq('id',id).eq('company_id',companyId).maybeSingle();if(!a)throw new Error('Bank account not found');if(include&&a.account_type!=='depository')throw new Error('Only checking/savings accounts can be included in company cash.');const {error}=await supabase.from('plaid_accounts').update({include_in_cash:include,updated_at:new Date().toISOString()}).eq('id',id).eq('company_id',companyId);if(error)throw new Error(error.message);refresh();}

export async function setBankTransactionReview(fd:FormData){const id=String(fd.get('transaction_id')||''),status=String(fd.get('review_status')||'unreviewed');if(!id||!['unreviewed','ignored'].includes(status))return;const {supabase,companyId}=await ctx();const patch:any={review_status:status,updated_at:new Date().toISOString()};if(status==='unreviewed'){patch.reconciled_at=null;patch.reconciled_by=null;patch.reconciliation_source=null;patch.bank_rule_id=null;patch.match_note=null;}const {error}=await supabase.from('plaid_transactions').update(patch).eq('id',id).eq('company_id',companyId).neq('review_status','matched');if(error)throw new Error(error.message);refresh();}

export async function analyzeBankFeed(){const {supabase,companyId}=await ctx();await analyzeBankTransactions(supabase,companyId);refresh();}

export async function acceptBankCandidate(fd:FormData){
  const id=String(fd.get('candidate_id')||'');if(!id)return;const {supabase,companyId}=await ctx();
  const {data:c}=await supabase.from('bank_reconciliation_candidates').select('*').eq('id',id).eq('company_id',companyId).eq('status','active').maybeSingle();if(!c)throw new Error('Suggestion is no longer active. Analyze the feed again.');
  let error:any=null;
  if(c.rule_id&&['company_expense','ignore'].includes(c.candidate_type)){({error}=await supabase.rpc('apply_bank_reconciliation_rule',{p_bank_transaction_id:c.bank_transaction_id,p_rule_id:c.rule_id}));}
  else if(['existing_customer_payment','existing_vendor_payment','existing_company_expense','existing_tax_remittance'].includes(c.candidate_type)){({error}=await supabase.rpc('reconcile_bank_existing',{p_bank_transaction_id:c.bank_transaction_id,p_entity_type:c.entity_type,p_entity_id:c.entity_id,p_note:c.reason,p_confidence:c.confidence}));}
  else if(c.candidate_type==='invoice_payment'){({error}=await supabase.rpc('reconcile_bank_to_invoice',{p_bank_transaction_id:c.bank_transaction_id,p_invoice_id:c.entity_id}));}
  else if(c.candidate_type==='vendor_bill_payment'){({error}=await supabase.rpc('reconcile_bank_to_vendor_bill',{p_bank_transaction_id:c.bank_transaction_id,p_vendor_bill_id:c.entity_id}));}
  else if(['existing_payroll','payroll_run'].includes(c.candidate_type)){({error}=await supabase.rpc('reconcile_bank_to_payroll_run',{p_bank_transaction_id:c.bank_transaction_id,p_payroll_run_id:c.entity_id}));}
  else if(c.candidate_type==='internal_transfer'){({error}=await supabase.rpc('reconcile_bank_as_transfer',{p_bank_transaction_id:c.bank_transaction_id,p_other_bank_transaction_id:c.entity_id}));}
  else if(c.candidate_type==='company_expense'){
    const m:any=c.metadata||{};({error}=await supabase.rpc('reconcile_bank_to_company_expense',{p_bank_transaction_id:c.bank_transaction_id,p_overhead_item_id:m.overhead_item_id||null,p_category:m.expense_category||null,p_business_use_percent:m.business_use_percent??null,p_description:null,p_remember_rule:false,p_rule_auto_apply:false}));
  }else throw new Error('This suggestion needs additional information. Use Review Transaction.');
  if(error)throw new Error(error.message);refresh();
}

export async function rejectBankCandidate(fd:FormData){const id=String(fd.get('candidate_id')||'');if(!id)return;const {supabase,companyId}=await ctx();const {error}=await supabase.from('bank_reconciliation_candidates').update({status:'rejected',updated_at:new Date().toISOString()}).eq('id',id).eq('company_id',companyId).eq('status','active');if(error)throw new Error(error.message);revalidatePath('/banking/reconcile');}

export async function reconcileInvoicePayment(fd:FormData){const tx=String(fd.get('transaction_id')||''),invoice=String(fd.get('invoice_id')||'');if(!tx||!invoice)return;const {supabase}=await ctx();const {error}=await supabase.rpc('reconcile_bank_to_invoice',{p_bank_transaction_id:tx,p_invoice_id:invoice});if(error)throw new Error(error.message);refresh();}
export async function reconcileVendorBillPayment(fd:FormData){const tx=String(fd.get('transaction_id')||''),bill=String(fd.get('vendor_bill_id')||'');if(!tx||!bill)return;const {supabase}=await ctx();const {error}=await supabase.rpc('reconcile_bank_to_vendor_bill',{p_bank_transaction_id:tx,p_vendor_bill_id:bill});if(error)throw new Error(error.message);refresh();}
export async function reconcilePayroll(fd:FormData){const tx=String(fd.get('transaction_id')||''),run=String(fd.get('payroll_run_id')||'');if(!tx||!run)return;const {supabase}=await ctx();const {error}=await supabase.rpc('reconcile_bank_to_payroll_run',{p_bank_transaction_id:tx,p_payroll_run_id:run});if(error)throw new Error(error.message);refresh();}
export async function reconcileTax(fd:FormData){const tx=String(fd.get('transaction_id')||''),type=String(fd.get('tax_type')||'other');if(!tx)return;const {supabase}=await ctx();const {error}=await supabase.rpc('reconcile_bank_to_tax',{p_bank_transaction_id:tx,p_tax_type:type});if(error)throw new Error(error.message);refresh();}
export async function reconcileTransfer(fd:FormData){const tx=String(fd.get('transaction_id')||''),other=String(fd.get('other_transaction_id')||'');if(!tx||!other)return;const {supabase}=await ctx();const {error}=await supabase.rpc('reconcile_bank_as_transfer',{p_bank_transaction_id:tx,p_other_bank_transaction_id:other});if(error)throw new Error(error.message);refresh();}

export async function reconcileCompanyExpense(fd:FormData){
  const tx=String(fd.get('transaction_id')||'');if(!tx)return;const {supabase}=await ctx();
  const {error}=await supabase.rpc('reconcile_bank_to_company_expense',{p_bank_transaction_id:tx,p_overhead_item_id:text(fd,'overhead_item_id'),p_category:text(fd,'category'),p_business_use_percent:num(fd,'business_use_percent'),p_description:text(fd,'description'),p_remember_rule:b(fd,'remember_rule'),p_rule_auto_apply:b(fd,'auto_apply')});
  if(error)throw new Error(error.message);refresh();
}

export async function reconcileJobCost(fd:FormData){
  const tx=String(fd.get('transaction_id')||''),project=String(fd.get('project_id')||''),code=String(fd.get('cost_code_id')||'');if(!tx||!project||!code)return;const {supabase}=await ctx();
  const {error}=await supabase.rpc('reconcile_bank_to_job_cost',{p_bank_transaction_id:tx,p_project_id:project,p_cost_code_id:code,p_vendor_id:text(fd,'vendor_id'),p_description:text(fd,'description'),p_remember_cost_code:b(fd,'remember_cost_code')});
  if(error)throw new Error(error.message);refresh();
}

export async function ignoreBankTransaction(fd:FormData){const tx=String(fd.get('transaction_id')||'');if(!tx)return;const {supabase}=await ctx();const {error}=await supabase.rpc('ignore_bank_transaction',{p_bank_transaction_id:tx,p_note:text(fd,'note'),p_remember_rule:b(fd,'remember_rule'),p_rule_auto_apply:b(fd,'auto_apply')});if(error)throw new Error(error.message);refresh();}
