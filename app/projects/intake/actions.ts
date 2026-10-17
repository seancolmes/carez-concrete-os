'use server';
import {createClient} from '@/lib/supabase/server';
import {revalidatePath} from 'next/cache';
import {externalJobPayload} from '@/lib/projects/externalJobIntake';
export async function intakeExternalJob(_previous:{error:string;projectId:string},fd:FormData){
 try{
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('Sign in again before saving.');
  const payload=externalJobPayload(fd);
  const {data,error}=await supabase.rpc('carez_intake_external_job',{p_request_id:String(fd.get('request_id')||''),p_payload:payload});
  if(error||!data)throw new Error(error?.message||'No saved project was confirmed.');
  revalidatePath('/projects');return{error:'',projectId:String(data)};
 }catch(error){return{error:error instanceof Error?error.message:'Save unavailable. Your form is retained; retry with the same request.',projectId:''};}
}
