'use server';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';

async function ctx(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('Not signed in');const {data:p}=await supabase.from('profiles').select('company_id,role').eq('id',user.id).single();if(!p?.company_id||p.role==='employee')throw new Error('Owner access required');return {supabase,user,companyId:p.company_id};}
const num=(v:FormDataEntryValue|null)=>{const x=Number(String(v??'').replace(/[$,]/g,''));return Number.isFinite(x)?x:null;};

export async function saveDocumentMetadata(fd:FormData){const title=String(fd.get('title')||'').trim(),storage_path=String(fd.get('storage_path')||'').trim();if(!title||!storage_path)return;const {supabase,user,companyId}=await ctx();const {error}=await supabase.from('company_documents').insert({company_id:companyId,project_id:String(fd.get('project_id')||'')||null,document_type:String(fd.get('document_type')||'other'),title,vendor_id:String(fd.get('vendor_id')||'')||null,document_date:String(fd.get('document_date')||'')||null,amount:num(fd.get('amount')),storage_path,mime_type:String(fd.get('mime_type')||'')||null,source:'upload',notes:String(fd.get('notes')||'').trim()||null,created_by:user.id});if(error)throw new Error(error.message);revalidatePath('/documents');}

export async function deleteDocument(fd:FormData){const id=String(fd.get('id')||'');if(!id)return;const {supabase,companyId}=await ctx();const {data:doc}=await supabase.from('company_documents').select('storage_path').eq('id',id).eq('company_id',companyId).single();if(doc?.storage_path)await supabase.storage.from('carez-documents').remove([doc.storage_path]);await supabase.from('company_documents').delete().eq('id',id).eq('company_id',companyId);revalidatePath('/documents');}
