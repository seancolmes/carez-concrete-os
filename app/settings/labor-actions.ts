'use server';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';
import {parseLaborConfiguration} from '@/lib/field/laborConfiguration';
export type LaborSetupState={status:'idle'|'saved'|'error';message:string};
export async function saveLaborSetup(_prior:LaborSetupState,form:FormData):Promise<LaborSetupState>{
 try{
  const input=parseLaborConfiguration(form),client=await createClient();
  const {data:{user}}=await client.auth.getUser();if(!user)throw new Error('Sign in before saving labor setup.');
  const {data,error}=input.kind==='opening'?await client.rpc('carez_verify_labor_opening_v1',{p_request_id:input.requestId,p_member_id:input.memberId,p_tax_year:input.year,p_values:input.values}):await client.rpc('carez_configure_labor_tax_v1',{p_request_id:input.requestId,p_kind:input.kind,p_tax_year:input.year,p_values:input.values});
  if(error||data?.ok!==true)throw new Error(error?.message||'Labor setup was not confirmed. Retry the same form.');
  for(const path of ['/settings','/field','/payroll','/estimates'])revalidatePath(path);
  return{status:'saved',message:'Verified setup saved. Existing approved cost snapshots were preserved.'};
 }catch(error){return{status:'error',message:error instanceof Error?error.message:'Labor setup is unavailable. Retry the same form.'};}
}
