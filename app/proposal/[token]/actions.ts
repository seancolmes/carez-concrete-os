'use server';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';

export async function acceptProposal(fd:FormData){const token=String(fd.get('token')||''),name=String(fd.get('accepted_name')||'').trim();if(!token||!name)throw new Error('Name is required');const supabase=await createClient();const {data,error}=await supabase.rpc('accept_public_proposal',{p_token:token,p_name:name,p_email:String(fd.get('accepted_email')||'').trim()||null,p_note:String(fd.get('acceptance_note')||'').trim()||null});if(error)throw new Error(error.message);if(!data)throw new Error('This proposal link is no longer valid.');revalidatePath(`/proposal/${token}`);}
