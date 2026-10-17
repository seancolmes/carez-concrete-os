'use server';
import {executeProcurementCommand} from '@/lib/financials/procurementCommands';
import {executeFinancialCommand,financialRequestId,optionalFinancialNumber} from '@/lib/financials/commands';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';

async function ctx(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('Not signed in');const {data:p}=await supabase.from('profiles').select('company_id,role').eq('id',user.id).single();if(!p?.company_id||p.role==='employee')throw new Error('Owner access required');return {supabase,user,companyId:p.company_id};}
const txt=(v:FormDataEntryValue|null)=>String(v||'').trim()||null;
const num=(v:FormDataEntryValue|null)=>{const x=Number(String(v??'').replace(/[$,% ,]/g,''));return Number.isFinite(x)?x:null;};

export async function saveDocumentMetadata(fd:FormData){
 const title=String(fd.get('title')||'').trim(),storage_path=String(fd.get('storage_path')||'').trim();if(!title||!storage_path)return;
 const {supabase,user,companyId}=await ctx();
 const documentType=String(fd.get('document_type')||'other');
 const reviewStatus=['receipt','delivery_ticket','concrete_ticket','vendor_invoice'].includes(documentType)?'needs_review':(txt(fd.get('project_id'))?'filed':'needs_review');
 const {error}=await supabase.from('company_documents').insert({
  company_id:companyId,project_id:txt(fd.get('project_id')),document_type:documentType,title,
  vendor_id:txt(fd.get('vendor_id')),document_date:txt(fd.get('document_date')),amount:num(fd.get('amount')),
  storage_path,mime_type:txt(fd.get('mime_type')),source:'upload',notes:txt(fd.get('notes')),
  reference_number:txt(fd.get('reference_number')),review_status:reviewStatus,created_by:user.id
 });
 if(error)throw new Error(error.message);revalidatePath('/documents');
}

export async function updateDocumentReview(fd:FormData){
 const id=String(fd.get('id')||'');if(!id)return;const {supabase,user,companyId}=await ctx();
 const status=String(fd.get('review_status')||'needs_review');if(!['needs_review','filed','matched','ignored'].includes(status))throw new Error('Invalid document status');
 const {error}=await supabase.from('company_documents').update({
  project_id:txt(fd.get('project_id')),vendor_id:txt(fd.get('vendor_id')),document_date:txt(fd.get('document_date')),
  amount:num(fd.get('amount')),reference_number:txt(fd.get('reference_number')),notes:txt(fd.get('notes')),
  review_status:status,reviewed_at:status==='needs_review'?null:new Date().toISOString(),reviewed_by:status==='needs_review'?null:user.id,updated_at:new Date().toISOString()
 }).eq('id',id).eq('company_id',companyId);
 if(error)throw new Error(error.message);revalidatePath('/documents');
}

export async function matchDocumentToVendorBill(fd:FormData){
 const id=String(fd.get('id')||''),vendorBillId=String(fd.get('vendor_bill_id')||'');if(!id||!vendorBillId)return;const {supabase}=await ctx();
 const {error}=await supabase.rpc('link_document_to_vendor_bill',{p_document_id:id,p_vendor_bill_id:vendorBillId});if(error)throw new Error(error.message);revalidatePath('/documents');revalidatePath('/procurement');revalidatePath('/payables');
}

export async function matchDocumentToBank(fd:FormData){
 const id=String(fd.get('id')||''),bankId=String(fd.get('bank_transaction_id')||'');if(!id||!bankId)return;const {supabase}=await ctx();
 const {error}=await supabase.rpc('link_document_to_bank_transaction',{p_document_id:id,p_bank_transaction_id:bankId});if(error)throw new Error(error.message);revalidatePath('/documents');revalidatePath('/banking/reconcile');
}

export async function createPoReceiptFromDocument(form:FormData){
 const {supabase}=await ctx();await executeProcurementCommand(supabase,form,'document_receipt');
 for(const path of ['/documents','/procurement','/pour-control','/production/work-packages','/readiness/resources'])revalidatePath(path);
}

export async function reconcileReceiptToJobCost(fd:FormData){
 const id=String(fd.get('id')||''),bankId=String(fd.get('bank_transaction_id')||''),projectId=String(fd.get('project_id')||''),costCodeId=String(fd.get('cost_code_id')||'');if(!id||!bankId||!projectId||!costCodeId)return;const {supabase}=await ctx();
 const {error}=await executeFinancialCommand(supabase,'reconcile_document_receipt_to_job_cost',{p_document_id:id,p_bank_transaction_id:bankId,p_project_id:projectId,p_cost_code_id:costCodeId,p_vendor_id:txt(fd.get('vendor_id')),p_description:txt(fd.get('description')),p_remember_cost_code:fd.get('remember_cost_code')==='on'},financialRequestId(fd));
 if(error)throw new Error(error.message);revalidatePath('/documents');revalidatePath('/banking/reconcile');revalidatePath('/costs');revalidatePath('/forecast');revalidatePath('/projects');
}

export async function reconcileReceiptToCompanyExpense(fd:FormData){
 const id=String(fd.get('id')||''),bankId=String(fd.get('bank_transaction_id')||'');if(!id||!bankId)return;const {supabase}=await ctx();
 const businessUse=optionalFinancialNumber(fd.get('business_use_percent'),{max:100})??100;
 const {error}=await executeFinancialCommand(supabase,'reconcile_document_receipt_to_company_expense',{p_document_id:id,p_bank_transaction_id:bankId,p_overhead_item_id:txt(fd.get('overhead_item_id')),p_category:String(fd.get('category')||''),p_business_use_percent:businessUse,p_description:txt(fd.get('description'))},financialRequestId(fd));
 if(error)throw new Error(error.message);revalidatePath('/documents');revalidatePath('/banking/reconcile');revalidatePath('/overhead');revalidatePath('/cashflow');
}

export async function deleteDocument(fd:FormData){const id=String(fd.get('id')||'');if(!id)return;const {supabase,companyId}=await ctx();const {data:doc,error:readError}=await supabase.from('company_documents').select('storage_path').eq('id',id).eq('company_id',companyId).single();if(readError||!doc)throw new Error('Document unavailable.');const {data:removed,error}=await supabase.from('company_documents').delete().eq('id',id).eq('company_id',companyId).select('id').single();if(error||!removed)throw new Error(error?.message||'Deletion was not confirmed.');if(doc.storage_path){const {error:storageError}=await supabase.storage.from('carez-documents').remove([doc.storage_path]);if(storageError)throw new Error('Record removed; file cleanup is incomplete.');}revalidatePath('/documents');}
