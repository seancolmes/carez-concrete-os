'use server';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';

async function ctx(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('Not signed in');const {data:p}=await supabase.from('profiles').select('company_id,role').eq('id',user.id).single();if(!p?.company_id||p.role==='employee')throw new Error('Owner access required');return {supabase,user,companyId:p.company_id};}

export async function createProposalLink(fd:FormData){
 const estimate_id=String(fd.get('estimate_id')||'');if(!estimate_id)return;const {supabase,user,companyId}=await ctx();
 const {data:e}=await supabase.from('estimates').select('id,lead_id,opportunity_number,estimate_number,version,status').eq('id',estimate_id).eq('company_id',companyId).single();if(!e)throw new Error('Estimate not found');if(['accepted','approved','declined'].includes(e.status))throw new Error('This estimate is locked and cannot be sent as a new proposal.');
 let opportunity=e.opportunity_number||String(e.estimate_number||'').replace(/^E-/,'');if(!opportunity){const {data:o,error}=await supabase.rpc('next_opportunity_number');if(error||!o)throw new Error(error?.message||'Could not create opportunity number');opportunity=o;await supabase.from('estimates').update({opportunity_number:opportunity,estimate_number:`E-${opportunity}`}).eq('id',estimate_id);}
 const proposalNumber=`P-${opportunity}-R${Number(e.version||0)}`;
 await supabase.from('proposal_access_tokens').update({revoked_at:new Date().toISOString()}).eq('estimate_id',estimate_id).eq('company_id',companyId).is('revoked_at',null);
 const expires=new Date();expires.setDate(expires.getDate()+30);const {error}=await supabase.from('proposal_access_tokens').insert({company_id:companyId,estimate_id,proposal_number:proposalNumber,expires_at:expires.toISOString()});if(error)throw new Error(error.message);
 if(e.lead_id)await Promise.all([supabase.from('leads').update({status:'proposal_sent',updated_at:new Date().toISOString()}).eq('id',e.lead_id).eq('company_id',companyId),supabase.from('lead_activities').insert({company_id:companyId,lead_id:e.lead_id,activity_type:'proposal',note:`Proposal ${proposalNumber} created and ready to send`,created_by:user.id})]);
 revalidatePath('/');revalidatePath('/leads');revalidatePath('/proposals');
}

export async function revokeProposalLink(fd:FormData){const id=String(fd.get('id')||'');if(!id)return;const {supabase,companyId}=await ctx();await supabase.from('proposal_access_tokens').update({revoked_at:new Date().toISOString()}).eq('id',id).eq('company_id',companyId);revalidatePath('/proposals');}
