'use server';

import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';

async function ctx(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)throw new Error('Not signed in');
 const {data:p}=await supabase.from('profiles').select('company_id,role').eq('id',user.id).single();
 if(!p?.company_id||p.role==='employee')throw new Error('Owner access required');
 return {supabase,user,companyId:p.company_id};
}

const text=(fd:FormData,key:string)=>String(fd.get(key)||'').trim();
const numberValue=(fd:FormData,key:string,fallback=0)=>{const raw=text(fd,key);if(!raw)return fallback;const n=Number(raw.replace(/[$,% ,]/g,''));return Number.isFinite(n)?n:fallback;};
const dateOnly=(d:Date)=>d.toISOString().slice(0,10);
const refresh=()=>{for(const p of ['/','/leads','/estimates','/proposals','/bid-intelligence'])revalidatePath(p);};

async function liveProposalExists(supabase:any,companyId:string,estimateId:string){
 const {data}=await supabase.from('proposal_access_tokens').select('id,expires_at').eq('company_id',companyId).eq('estimate_id',estimateId).is('revoked_at',null);
 const now=Date.now();
 return (data||[]).some((x:any)=>!x.expires_at||new Date(x.expires_at).getTime()>now);
}

async function assertRevisionEditable(supabase:any,companyId:string,estimateId:string){
 const {data:e}=await supabase.from('estimates').select('id,status').eq('id',estimateId).eq('company_id',companyId).maybeSingle();
 if(!e)throw new Error('Estimate not found.');
 if(['accepted','approved','superseded'].includes(e.status))throw new Error('This estimate revision is locked.');
 if(await liveProposalExists(supabase,companyId,estimateId))throw new Error('This proposal revision has already been sent. Create a new revision to change customer-facing information.');
}

export async function saveProposalSettings(fd:FormData){
 const estimateId=text(fd,'estimate_id');if(!estimateId)return;
 const {supabase,user,companyId}=await ctx();
 await assertRevisionEditable(supabase,companyId,estimateId);
 const audience=text(fd,'audience_type')||'general_contractor';
 if(!['homeowner','general_contractor','commercial_owner'].includes(audience))throw new Error('Choose a valid proposal audience.');
 const validity=Math.min(90,Math.max(1,Math.round(numberValue(fd,'validity_days',30))));
 const patch={
  company_id:companyId,estimate_id:estimateId,audience_type:audience,
  executive_summary:text(fd,'executive_summary')||null,
  customer_message:text(fd,'customer_message')||null,
  schedule_summary:text(fd,'schedule_summary')||null,
  payment_summary:text(fd,'payment_summary')||null,
  warranty_summary:text(fd,'warranty_summary')||null,
  why_carez:text(fd,'why_carez')||null,
  pricing_note:text(fd,'pricing_note')||null,
  terms_text:text(fd,'terms_text')||null,
  show_quantities:fd.get('show_quantities')==='on',
  validity_days:validity,created_by:user.id,updated_at:new Date().toISOString()
 };
 const {error}=await supabase.from('proposal_settings').upsert(patch,{onConflict:'estimate_id'});
 if(error)throw new Error(error.message);
 refresh();
}

export async function addProposalClarification(fd:FormData){
 const estimateId=text(fd,'estimate_id'),clarification=text(fd,'clarification_text'),category=text(fd,'category')||'inclusion';
 if(!estimateId||!clarification)return;
 if(!['inclusion','exclusion','assumption','allowance','qualification'].includes(category))throw new Error('Invalid clarification type.');
 const {supabase,user,companyId}=await ctx();
 await assertRevisionEditable(supabase,companyId,estimateId);
 const {error}=await supabase.from('proposal_clarifications').insert({company_id:companyId,estimate_id:estimateId,category,clarification_text:clarification,published:true,sort_order:Date.now()%1000000,created_by:user.id});
 if(error)throw new Error(error.message);
 refresh();
}

export async function deleteProposalClarification(fd:FormData){
 const id=text(fd,'clarification_id'),estimateId=text(fd,'estimate_id');if(!id||!estimateId)return;
 const {supabase,companyId}=await ctx();
 await assertRevisionEditable(supabase,companyId,estimateId);
 const {error}=await supabase.from('proposal_clarifications').delete().eq('id',id).eq('estimate_id',estimateId).eq('company_id',companyId);
 if(error)throw new Error(error.message);
 refresh();
}

export async function toggleValueOptionPresented(fd:FormData){
 const id=text(fd,'option_id'),estimateId=text(fd,'estimate_id'),target=text(fd,'target_status');if(!id||!estimateId)return;
 if(!['suggested','presented'].includes(target))throw new Error('Invalid option status.');
 const {supabase,companyId}=await ctx();
 await assertRevisionEditable(supabase,companyId,estimateId);
 const {error}=await supabase.from('bid_value_options').update({status:target,updated_at:new Date().toISOString()}).eq('id',id).eq('estimate_id',estimateId).eq('company_id',companyId);
 if(error)throw new Error(error.message);
 refresh();
}

export async function createProposalLink(fd:FormData){
 const estimateId=text(fd,'estimate_id');if(!estimateId)return;
 const {supabase,user,companyId}=await ctx();
 let {data:e}=await supabase.from('estimates').select('id,company_id,lead_id,project_id,opportunity_number,estimate_number,version,status,name,expected_start_date,updated_at').eq('id',estimateId).eq('company_id',companyId).single();
 if(!e)throw new Error('Estimate not found.');
 if(e.status!=='ready')throw new Error('Set the estimate to Ready to Send before issuing a customer proposal.');
 if(await liveProposalExists(supabase,companyId,estimateId))throw new Error('This revision already has a live customer proposal. Create a revision if price or scope changed.');

 let opportunity=e.opportunity_number||String(e.estimate_number||'').replace(/^E-/,'');
 if(!opportunity){
  const {data:o,error}=await supabase.rpc('next_opportunity_number');if(error||!o)throw new Error(error?.message||'Could not create opportunity number');
  opportunity=o;
  const {error:updateError}=await supabase.from('estimates').update({opportunity_number:opportunity,estimate_number:`E-${opportunity}`,updated_at:new Date().toISOString()}).eq('id',estimateId).eq('company_id',companyId);
  if(updateError)throw new Error(updateError.message);
  const reread=await supabase.from('estimates').select('id,company_id,lead_id,project_id,opportunity_number,estimate_number,version,status,name,expected_start_date,updated_at').eq('id',estimateId).eq('company_id',companyId).single();e=reread.data;
  if(!e)throw new Error('Estimate could not be reloaded.');
 }

 const [{data:summary},{data:sections},{data:items},{data:settings},{data:clarifications},{data:options},{data:company},{data:billing},{data:lead},{data:project},{data:bidProfile}]=await Promise.all([
  supabase.from('estimate_financial_summary').select('selected_sell_price,recommended_sell_price').eq('estimate_id',estimateId).single(),
  supabase.from('estimate_sections').select('id,name,scope_type,sort_order').eq('estimate_id',estimateId).eq('company_id',companyId).order('sort_order'),
  supabase.from('estimate_items').select('id,section_id,description,quantity,unit,item_type,sort_order').eq('estimate_id',estimateId).eq('company_id',companyId).order('sort_order'),
  supabase.from('proposal_settings').select('*').eq('estimate_id',estimateId).eq('company_id',companyId).maybeSingle(),
  supabase.from('proposal_clarifications').select('id,category,clarification_text,sort_order').eq('estimate_id',estimateId).eq('company_id',companyId).eq('published',true).order('sort_order'),
  supabase.from('bid_value_options').select('id,name,customer_description,sell_price_change,schedule_days_change,function_quality_note,approval_required,status').eq('estimate_id',estimateId).eq('company_id',companyId).eq('status','presented').order('created_at'),
  supabase.from('companies').select('name').eq('id',companyId).single(),
  supabase.from('company_billing_profiles').select('display_name,legal_name,address_line1,address_line2,city,state,postal_code,phone,email,website,ubi_number,contractor_license_number,logo_path,default_terms_text').eq('company_id',companyId).maybeSingle(),
  e.lead_id?supabase.from('leads').select('customer_name,contact_name,email,phone,project_name,address,city,state,postal_code,scope').eq('id',e.lead_id).eq('company_id',companyId).maybeSingle():Promise.resolve({data:null}),
  e.project_id?supabase.from('projects').select('job_number,name,address,city,state').eq('id',e.project_id).eq('company_id',companyId).maybeSingle():Promise.resolve({data:null}),
  e.lead_id?supabase.from('lead_bid_intelligence').select('bid_type').eq('lead_id',e.lead_id).eq('company_id',companyId).maybeSingle():Promise.resolve({data:null})
 ]);

 const sell=Number(summary?.selected_sell_price||summary?.recommended_sell_price||0);
 if(!(sell>0))throw new Error('Customer price must be greater than $0 before a proposal can be sent.');
 if(!(items||[]).length)throw new Error('Add the customer scope before sending this proposal.');
 const audience=settings?.audience_type||(bidProfile?.bid_type==='residential_direct'?'homeowner':'general_contractor');
 const showQuantities=settings?.show_quantities!==false;
 const validityDays=Math.min(90,Math.max(1,Number(settings?.validity_days||30)));
 const expires=new Date();expires.setDate(expires.getDate()+validityDays);
 const proposalNumber=`P-${opportunity}-R${Number(e.version||0)}`;
 const safeItems=(items||[]).map((i:any)=>showQuantities?{id:i.id,section_id:i.section_id,description:i.description,quantity:Number(i.quantity||0),unit:i.unit,item_type:i.item_type,sort_order:i.sort_order}:{id:i.id,section_id:i.section_id,description:i.description,item_type:i.item_type,sort_order:i.sort_order});
 const safeOptions=(options||[]).map((o:any)=>({
  id:o.id,name:o.name,customer_description:o.customer_description,
  price_change:Number(o.sell_price_change||0),option_price:Math.max(0,sell+Number(o.sell_price_change||0)),
  schedule_days_change:Number(o.schedule_days_change||0),function_quality_note:o.function_quality_note,approval_required:o.approval_required
 }));
 const snapshot={
  proposal_number:proposalNumber,valid_through:expires.toISOString(),audience_type:audience,
  estimate:{id:e.id,estimate_number:e.estimate_number,version:e.version,name:e.name,expected_start_date:e.expected_start_date},
  pricing:{base_sell_price:sell},
  company:{name:company?.name||'Carez Concrete',display_name:billing?.display_name||company?.name||'Carez Concrete',legal_name:billing?.legal_name||null,address_line1:billing?.address_line1||null,address_line2:billing?.address_line2||null,city:billing?.city||null,state:billing?.state||null,postal_code:billing?.postal_code||null,phone:billing?.phone||null,email:billing?.email||null,website:billing?.website||null,ubi_number:billing?.ubi_number||null,contractor_license_number:billing?.contractor_license_number||null,logo_path:billing?.logo_path||'/brand/carez-wordmark.png'},
  lead:lead?{customer_name:lead.customer_name,contact_name:lead.contact_name,email:lead.email,phone:lead.phone,project_name:lead.project_name,address:lead.address,city:lead.city,state:lead.state,postal_code:lead.postal_code}:{},
  project:project?{job_number:project.job_number,name:project.name,address:project.address,city:project.city,state:project.state}:{},
  content:{
   executive_summary:settings?.executive_summary||lead?.scope||null,
   customer_message:settings?.customer_message||null,
   schedule_summary:settings?.schedule_summary||null,
   payment_summary:settings?.payment_summary||null,
   warranty_summary:settings?.warranty_summary||null,
   why_carez:settings?.why_carez||null,
   pricing_note:settings?.pricing_note||null,
   terms_text:settings?.terms_text||billing?.default_terms_text||null,
   show_quantities:showQuantities
  },
  sections:(sections||[]).map((s:any)=>({id:s.id,name:s.name,scope_type:s.scope_type,sort_order:s.sort_order})),
  items:safeItems,
  clarifications:(clarifications||[]).map((c:any)=>({id:c.id,category:c.category,text:c.clarification_text,sort_order:c.sort_order})),
  options:safeOptions
 };

 // Clean up any expired-but-still-open legacy links before issuing the new one.
 await supabase.from('proposal_access_tokens').update({revoked_at:new Date().toISOString()}).eq('estimate_id',estimateId).eq('company_id',companyId).is('revoked_at',null);
 const {data:token,error:tokenError}=await supabase.from('proposal_access_tokens').insert({company_id:companyId,estimate_id:estimateId,proposal_number:proposalNumber,expires_at:expires.toISOString()}).select('id,token,expires_at').single();
 if(tokenError||!token)throw new Error(tokenError?.message||'Could not create proposal link.');
 const {error:presentationError}=await supabase.from('proposal_presentations').insert({company_id:companyId,estimate_id:estimateId,proposal_access_token_id:token.id,lead_id:e.lead_id||null,proposal_number:proposalNumber,audience_type:audience,base_sell_price:sell,source_estimate_updated_at:e.updated_at,snapshot,status:'sent',response_state:'none',created_by:user.id});
 if(presentationError){await supabase.from('proposal_access_tokens').update({revoked_at:new Date().toISOString()}).eq('id',token.id);throw new Error(presentationError.message);}

 if(e.lead_id){
  const now=new Date(),follow=new Date(now);follow.setDate(follow.getDate()+2);
  await Promise.all([
   supabase.from('leads').update({status:'proposal_sent',follow_up:dateOnly(follow),updated_at:now.toISOString()}).eq('id',e.lead_id).eq('company_id',companyId),
   supabase.from('lead_activities').insert({company_id:companyId,lead_id:e.lead_id,activity_type:'proposal',note:`${proposalNumber} sent / ready to share. Follow up if the customer has not responded.`,next_follow_up:dateOnly(follow),created_by:user.id}),
   supabase.from('lead_bid_intelligence').upsert({company_id:companyId,lead_id:e.lead_id,proposal_sent_at:now.toISOString(),created_by:user.id,updated_at:now.toISOString()},{onConflict:'lead_id'})
  ]);
 }
 refresh();
}

export async function revokeProposalLink(fd:FormData){
 const id=text(fd,'id');if(!id)return;
 const {supabase,companyId}=await ctx();
 const {error}=await supabase.from('proposal_access_tokens').update({revoked_at:new Date().toISOString()}).eq('id',id).eq('company_id',companyId);
 if(error)throw new Error(error.message);
 refresh();
}

export async function createProposalRevision(fd:FormData){
 const estimateId=text(fd,'estimate_id');if(!estimateId)return;
 const {supabase}=await ctx();
 const {error}=await supabase.rpc('create_estimate_revision',{p_estimate_id:estimateId});
 if(error)throw new Error(error.message);
 refresh();
}

export async function markProposalResponseHandled(fd:FormData){
 const eventId=text(fd,'event_id');if(!eventId)return;
 const {supabase,user,companyId}=await ctx();
 const {data:event,error:readError}=await supabase.from('proposal_engagement_events').select('id,presentation_id').eq('id',eventId).eq('company_id',companyId).maybeSingle();
 if(readError||!event)throw new Error(readError?.message||'Response not found.');
 const now=new Date().toISOString();
 const {error}=await supabase.from('proposal_engagement_events').update({handled_at:now,handled_by:user.id}).eq('id',eventId).eq('company_id',companyId);
 if(error)throw new Error(error.message);
 const [{count},{data:presentation}]=await Promise.all([
  supabase.from('proposal_engagement_events').select('id',{count:'exact',head:true}).eq('presentation_id',event.presentation_id).is('handled_at',null).neq('event_type','view'),
  supabase.from('proposal_presentations').select('id,status,first_viewed_at').eq('id',event.presentation_id).eq('company_id',companyId).maybeSingle()
 ]);
 if((count||0)===0&&presentation?.status==='needs_reply')await supabase.from('proposal_presentations').update({status:presentation.first_viewed_at?'viewed':'sent'}).eq('id',presentation.id).eq('company_id',companyId);
 refresh();
}

export async function recordProposalFollowUp(fd:FormData){
 const leadId=text(fd,'lead_id'),note=text(fd,'note'),next=text(fd,'next_follow_up')||null;
 if(!leadId||!note)throw new Error('Enter what happened on the follow-up.');
 const {supabase,user,companyId}=await ctx();const now=new Date().toISOString();
 const {error}=await supabase.from('lead_activities').insert({company_id:companyId,lead_id:leadId,activity_type:'follow_up',activity_date:now,note,next_follow_up:next,created_by:user.id});
 if(error)throw new Error(error.message);
 await Promise.all([
  supabase.from('leads').update({follow_up:next,status:'follow_up',updated_at:now}).eq('id',leadId).eq('company_id',companyId).not('status','in','(won,lost)'),
  supabase.from('lead_bid_intelligence').update({last_follow_up_at:now,updated_at:now}).eq('lead_id',leadId).eq('company_id',companyId)
 ]);
 refresh();
}
