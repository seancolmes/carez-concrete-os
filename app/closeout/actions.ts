'use server';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';
import {executeCloseoutCommand,type CloseoutCommand} from '@/lib/projects/closeoutCommands';
async function save(form:FormData,command:CloseoutCommand){
 const supabase=await createClient();const {data:{user},error:authError}=await supabase.auth.getUser();if(authError||!user)throw new Error('Not signed in');
 const {data:profile,error}=await supabase.from('profiles').select('company_id,role').eq('id',user.id).single();
 if(error||!profile?.company_id||!['owner','office'].includes(profile.role))throw new Error('Owner or office access required');
 await executeCloseoutCommand(supabase,form,command);
 for(const path of ['/closeout','/projects','/field','/dashboard'])revalidatePath(path);
}
export async function ensureCloseout(form:FormData){await save(form,'ensure');}
export async function saveCloseoutChecklist(form:FormData){await save(form,'save_checklist');}
export async function completeProjectCloseout(form:FormData){await save(form,'complete');}
export async function reopenProject(form:FormData){await save(form,'reopen');}
