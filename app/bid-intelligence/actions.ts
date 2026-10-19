'use server';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';
import {executeIntelligenceCommand,type IntelligenceCommand} from '@/lib/opportunities/intelligenceCommands';
async function save(form:FormData,command:IntelligenceCommand){
 const supabase=await createClient();const {data:{user},error:authError}=await supabase.auth.getUser();
 if(authError||!user)throw new Error('Not signed in');
 const {data:profile,error}=await supabase.from('profiles').select('company_id,role').eq('id',user.id).single();
 if(error||!profile?.company_id||!['owner','office'].includes(profile.role))throw new Error('Owner or office access required');
 await executeIntelligenceCommand(supabase,form,command);
 for(const path of ['/bid-intelligence','/opportunities','/leads','/estimates','/proposals','/'])revalidatePath(path);
}
export async function saveBidProfile(form:FormData){await save(form,'save_profile');}
export async function recordCompetitorFeedback(form:FormData){await save(form,'record_feedback');}
export async function addScopeComparisonItem(form:FormData){await save(form,'add_scope');}
export async function deleteScopeComparisonItem(form:FormData){await save(form,'remove_scope');}
export async function addValueOption(form:FormData){await save(form,'add_value_option');}
export async function updateValueOptionStatus(form:FormData){await save(form,'update_value_option_status');}
export async function recordBidFollowUp(form:FormData){await save(form,'record_follow_up');}
export async function markProposalSent(form:FormData){await save(form,'mark_proposal_sent');}
export async function recordBidOutcome(form:FormData){await save(form,'record_outcome');}
