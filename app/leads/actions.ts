'use server';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';

async function company(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('Not signed in');const {data:profile}=await supabase.from('profiles').select('company_id,role').eq('id',user.id).single();if(!profile?.company_id||profile.role==='employee')throw new Error('Owner access required');return {supabase,user,companyId:profile.company_id};}
const txt=(v:FormDataEntryValue|null)=>String(v||'').trim()||null;

export async function createLead(formData:FormData){
 const customer_name=String(formData.get('customer_name')||'').trim();if(!customer_name)return;
 const value=String(formData.get('estimated_value')||'').replace(/[$,]/g,''),{supabase,user,companyId}=await company();
 const {data:opp,error:oppError}=await supabase.rpc('next_opportunity_number');if(oppError||!opp)throw new Error(oppError?.message||'Could not create lead number.');
 const address=txt(formData.get('address')),city=txt(formData.get('city')),manualName=txt(formData.get('project_name'));
 const project_name=manualName||`${customer_name}${address?` - ${address}`:city?` - ${city}`:''}`;
 const {data:lead,error}=await supabase.from('leads').insert({company_id:companyId,opportunity_number:opp,customer_name,contact_name:txt(formData.get('contact_name')),email:txt(formData.get('email')),phone:txt(formData.get('phone')),project_name,address,city,state:txt(formData.get('state'))||'WA',postal_code:txt(formData.get('postal_code')),scope:txt(formData.get('scope')),estimated_value:value&&Number.isFinite(Number(value))?Number(value):null,bid_due:txt(formData.get('bid_due')),follow_up:txt(formData.get('follow_up')),status:'new',source:txt(formData.get('source'))||'manual',notes:txt(formData.get('notes'))}).select('id').single();
 if(error||!lead)throw new Error(error?.message||'Could not create lead.');
 await supabase.from('lead_activities').insert({company_id:companyId,lead_id:lead.id,activity_type:'created',note:`L-${opp} added to Carez`,created_by:user.id});
 revalidatePath('/');revalidatePath('/leads');revalidatePath('/leads/inbox');
}

export async function convertLeadToEstimate(formData:FormData){
 const leadId=String(formData.get('lead_id')||'');if(!leadId)return;const {supabase,user,companyId}=await company();
 const {data:lead}=await supabase.from('leads').select('*').eq('id',leadId).eq('company_id',companyId).single();if(!lead)throw new Error('Lead not found.');
 let opportunity=lead.opportunity_number;if(!opportunity){const {data:o,error}=await supabase.rpc('next_opportunity_number');if(error||!o)throw new Error(error?.message||'Could not create opportunity number.');opportunity=o;await supabase.from('leads').update({opportunity_number:opportunity}).eq('id',leadId);}
 const {data:existing}=await supabase.from('estimates').select('id').eq('company_id',companyId).eq('lead_id',leadId).not('status','in','(declined,superseded)').order('created_at',{ascending:false}).limit(1).maybeSingle();if(existing)redirect('/estimates');
 const [{data:co},{data:snapshot}]=await Promise.all([supabase.from('companies').select('target_margin_percent,default_bo_classification,retailing_bo_rate_percent,wholesaling_bo_rate_percent').eq('id',companyId).single(),supabase.rpc('capture_overhead_rate_snapshot',{p_effective_date:new Date().toISOString().slice(0,10)})]);
 const bo=co?.default_bo_classification||'retailing',boRate=bo==='wholesaling'?Number(co?.wholesaling_bo_rate_percent||0.484):Number(co?.retailing_bo_rate_percent||0.471),estimateNumber=`E-${opportunity}`;
 const {data:estimate,error}=await supabase.from('estimates').insert({company_id:companyId,lead_id:leadId,opportunity_number:opportunity,project_id:null,estimate_number:estimateNumber,name:lead.project_name||`${lead.customer_name} Concrete`,version:0,status:'draft',target_margin_percent:Number(co?.target_margin_percent||30),bo_classification:bo,bo_rate_percent:boRate,overhead_snapshot_id:snapshot?.id||null,overhead_rate_snapshot:Number(snapshot?.overhead_rate_per_productive_hour||0),created_by:user.id}).select('id').single();if(error||!estimate)throw new Error(error?.message||'Could not create estimate.');
 const starter=['Footings','Stem Walls','Slabs / Flatwork'];await supabase.from('estimate_sections').insert(starter.map((s,i)=>({company_id:companyId,estimate_id:estimate.id,name:s,scope_type:s==='Footings'?'footing':s==='Stem Walls'?'wall':'flatwork',sort_order:(i+1)*10})));
 await Promise.all([supabase.from('leads').update({status:'estimating',updated_at:new Date().toISOString()}).eq('id',leadId),supabase.from('lead_activities').insert({company_id:companyId,lead_id:leadId,activity_type:'estimate',note:`Estimate ${estimateNumber}-R0 started`,created_by:user.id})]);
 revalidatePath('/');revalidatePath('/leads');revalidatePath('/estimates');redirect('/estimates');
}

export async function updateLeadStatus(formData:FormData){const id=String(formData.get('id')||''),status=String(formData.get('status')||'new');if(!id)return;const {supabase,user,companyId}=await company();await supabase.from('leads').update({status,updated_at:new Date().toISOString()}).eq('id',id).eq('company_id',companyId);await supabase.from('lead_activities').insert({company_id:companyId,lead_id:id,activity_type:'status',note:`Status changed to ${status.replaceAll('_',' ')}`,created_by:user.id});revalidatePath('/');revalidatePath('/leads');}

export async function addLeadActivity(formData:FormData){const lead_id=String(formData.get('lead_id')||''),activity_type=String(formData.get('activity_type')||'note'),note=String(formData.get('note')||'').trim(),next=String(formData.get('next_follow_up')||'')||null;if(!lead_id||(!note&&!next))return;const {supabase,user,companyId}=await company();const {error}=await supabase.from('lead_activities').insert({company_id:companyId,lead_id,activity_type,note:note||null,next_follow_up:next,created_by:user.id});if(error)throw new Error(error.message);if(next)await supabase.from('leads').update({follow_up:next,status:activity_type==='proposal'?'proposal_sent':'follow_up',updated_at:new Date().toISOString()}).eq('id',lead_id).eq('company_id',companyId);revalidatePath('/');revalidatePath('/leads');}

export async function setLeadFollowUp(formData:FormData){const id=String(formData.get('id')||''),follow_up=String(formData.get('follow_up')||'')||null;if(!id)return;const {supabase,user,companyId}=await company();await supabase.from('leads').update({follow_up,updated_at:new Date().toISOString()}).eq('id',id).eq('company_id',companyId);await supabase.from('lead_activities').insert({company_id:companyId,lead_id:id,activity_type:'follow_up',note:follow_up?`Follow-up set for ${follow_up}`:'Follow-up cleared',next_follow_up:follow_up,created_by:user.id});revalidatePath('/');revalidatePath('/leads');}
