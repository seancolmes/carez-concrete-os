'use server';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';
import {ensureOutlookAccessToken,graphRequest,syncOutlookMailbox} from '@/lib/outlook';

async function ctx(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('Not signed in');const {data:p}=await supabase.from('profiles').select('company_id,role').eq('id',user.id).single();if(!p?.company_id||p.role==='employee')throw new Error('Owner access required');return {supabase,user,companyId:p.company_id};}

export async function syncOutlookNow(){const {supabase,companyId}=await ctx();const {data:c}=await supabase.from('outlook_connections').select('*').eq('company_id',companyId).eq('status','active').maybeSingle();if(!c)throw new Error('Connect Outlook first.');await syncOutlookMailbox(supabase,companyId,c);revalidatePath('/');revalidatePath('/leads');revalidatePath('/leads/inbox');}

export async function createLeadFromCandidate(fd:FormData){
 const id=String(fd.get('candidate_id')||'');if(!id)return;const {supabase,user,companyId}=await ctx();
 const {data:c}=await supabase.from('lead_inbox_candidates').select('*,outlook_messages(outlook_message_id,conversation_id,subject,sender_name,sender_email)').eq('id',id).eq('company_id',companyId).eq('status','pending').maybeSingle();if(!c)throw new Error('Lead candidate not found.');
 const {data:opp,error:oppError}=await supabase.rpc('next_opportunity_number');if(oppError||!opp)throw new Error(oppError?.message||'Could not create lead number');
 const projectName=c.project_name||`${c.customer_name||c.contact_name||'New Customer'}${c.address?` - ${c.address}`:c.city?` - ${c.city}`:''}`;
 const msg:any=c.outlook_messages;
 const {data:lead,error}=await supabase.from('leads').insert({company_id:companyId,opportunity_number:opp,customer_name:c.customer_name||c.contact_name||'New Customer',contact_name:c.contact_name,email:c.email,phone:c.phone,project_name:projectName,address:c.address,city:c.city,state:c.state||'WA',postal_code:c.postal_code,scope:c.scope,bid_due:c.bid_due,status:'new',source:'outlook',source_message_id:msg?.outlook_message_id||null,source_conversation_id:msg?.conversation_id||null,notes:'Created from Outlook Lead Inbox'}).select('id').single();if(error||!lead)throw new Error(error?.message||'Could not create lead.');
 await Promise.all([supabase.from('lead_inbox_candidates').update({status:'created',created_lead_id:lead.id,updated_at:new Date().toISOString()}).eq('id',id),supabase.from('outlook_messages').update({lead_id:lead.id}).eq('id',c.outlook_message_id),supabase.from('lead_activities').insert({company_id:companyId,lead_id:lead.id,activity_type:'email',note:`Lead created from Outlook: ${msg?.subject||'No subject'}`,created_by:user.id})]);
 revalidatePath('/');revalidatePath('/leads');revalidatePath('/leads/inbox');
}

export async function ignoreLeadCandidate(fd:FormData){const id=String(fd.get('candidate_id')||'');if(!id)return;const {supabase,companyId}=await ctx();await supabase.from('lead_inbox_candidates').update({status:'ignored',updated_at:new Date().toISOString()}).eq('id',id).eq('company_id',companyId);revalidatePath('/leads/inbox');}

export async function disconnectOutlook(){const {supabase,companyId}=await ctx();const {data:c}=await supabase.from('outlook_connections').select('*').eq('company_id',companyId).maybeSingle();if(!c)return;try{if(c.subscription_id){const access=await ensureOutlookAccessToken(supabase,c);await graphRequest(access,`/subscriptions/${encodeURIComponent(c.subscription_id)}`,{method:'DELETE'});}}catch{}await supabase.from('outlook_connections').update({status:'disconnected',subscription_id:null,subscription_client_state:null,subscription_expires_at:null,updated_at:new Date().toISOString()}).eq('id',c.id);revalidatePath('/leads/inbox');}
