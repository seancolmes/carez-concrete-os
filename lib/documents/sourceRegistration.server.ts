import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {verifyUploadedSource} from './sourceStorage.server';
import {sourceWriterConfiguration} from './sourceWriterConfiguration';

/** The caller supplies actor/company only from its authenticated server context. */
export async function registerVerifiedSource(reader:Parameters<typeof verifyUploadedSource>[0],actorId:string,input:{companyId:string;path:string;privateFile:boolean;format:string;requiresPdf:boolean;filename:string;values:Record<string,unknown>}){
 const {url,key}=sourceWriterConfiguration(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.POURTRACE_SUPABASE_SERVICE_ROLE_KEY,process.env.SUPABASE_SERVICE_ROLE_KEY);
 const writer=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const verified=await verifyUploadedSource(reader,input.path,input.companyId,input.privateFile,input.format,input.requiresPdf,{seal:async paths=>{
  const result=await writer.rpc('carez_seal_source_upload',{p_actor_id:actorId,p_paths:paths});
  if(result.error)throw new Error(result.error.message||'Original source could not be sealed for verification.');
 }});
 if(verified.manifest&&verified.manifest.filename!==input.filename)throw new Error('Original filename does not match the uploaded manifest.');
 const result=await writer.rpc('carez_register_source_document_v3',{...input.values,p_actor_id:actorId,p_path:input.path,p_hash:verified.sha256,p_bytes:verified.size,p_manifest:verified.manifest});
 const data=result.data;
 if(result.error||typeof data?.id!=='string'||!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(data.id)||typeof data.storage_path!=='string')throw new Error(result.error?.message||'No registered source was confirmed. Retry without uploading another original.');
 if(data.storage_path!==input.path){
  // A cleanup failure must not turn a confirmed registration into an uncertain
  // save. The browser reports pending cleanup if these seals remain in place.
  const paths=[input.path,...(verified.manifest?.chunks.map(chunk=>chunk.path)||[])];
  try{await writer.rpc('carez_release_unused_source_upload',{p_actor_id:actorId,p_paths:paths});}catch{/* Retain the sealed unused upload for explicit cleanup. */}
 }
 return data as {id:string;storage_path:string;revision_state:string};
}
