'use server';

import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';

export async function submitProposalResponse(fd:FormData){
 const token=String(fd.get('token')||''),responseType=String(fd.get('response_type')||'').trim();
 if(!token||!responseType)throw new Error('Proposal response is incomplete.');
 const supabase=await createClient();
 const {data,error}=await supabase.rpc('submit_public_proposal_response',{
  p_token:token,
  p_response_type:responseType,
  p_name:String(fd.get('customer_name')||'').trim()||null,
  p_email:String(fd.get('customer_email')||'').trim()||null,
  p_message:String(fd.get('customer_message')||'').trim()||null,
  p_decline_reason:String(fd.get('decline_reason')||'').trim()||null,
  p_option_id:String(fd.get('option_id')||'').trim()||null
 });
 if(error)throw new Error(error.message);
 if(!data)throw new Error('This proposal link is no longer valid.');
 revalidatePath(`/proposal/${token}`);
}
