'use server';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';
import {externalAgreementRequest} from '@/lib/projects/externalAgreement';
export async function verifyExternalAgreement(_previous:{error:string;message:string},fd:FormData){
 try{
  const input=externalAgreementRequest(fd),client=await createClient();
  const {data,error}=await client.rpc('carez_verify_external_agreement',{p_request_id:input.requestId,p_payload:input.payload});
  if(error||typeof data!=='string'||!/^[0-9a-f-]{36}$/i.test(data))throw new Error(error?.message||'No agreement verification was confirmed.');
  revalidatePath(`/job-setup/${input.payload.project_id}`);revalidatePath(`/projects/${input.payload.project_id}`);revalidatePath('/projects');revalidatePath('/dashboard');
  return {error:'',message:input.payload.action==='revoke'?'Owner verification revoked. Agreement readiness is held again; financial history is unchanged.':'Owner verification recorded. Tax, payment and work readiness remain independent.'};
 }catch(error){return{error:error instanceof Error?error.message:'Verification unavailable. No completion was confirmed.',message:''};}
}
