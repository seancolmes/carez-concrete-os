'use server';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';

async function ctx(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('Not signed in');const {data:p}=await supabase.from('profiles').select('company_id,role').eq('id',user.id).single();if(!p?.company_id||p.role==='employee')throw new Error('Owner access required');return {supabase,companyId:p.company_id};}

export async function createProposalLink(fd:FormData){const estimate_id=String(fd.get('estimate_id')||'');if(!estimate_id)return;const {supabase,companyId}=await ctx();const {data:e}=await supabase.from('estimates').select('id').eq('id',estimate_id).eq('company_id',companyId).single();if(!e)throw new Error('Estimate not found');await supabase.from('proposal_access_tokens').update({revoked_at:new Date().toISOString()}).eq('estimate_id',estimate_id).eq('company_id',companyId).is('revoked_at',null);const expires=new Date();expires.setDate(expires.getDate()+30);const {error}=await supabase.from('proposal_access_tokens').insert({company_id:companyId,estimate_id,expires_at:expires.toISOString()});if(error)throw new Error(error.message);revalidatePath('/proposals');}

export async function revokeProposalLink(fd:FormData){const id=String(fd.get('id')||'');if(!id)return;const {supabase,companyId}=await ctx();await supabase.from('proposal_access_tokens').update({revoked_at:new Date().toISOString()}).eq('id',id).eq('company_id',companyId);revalidatePath('/proposals');}
