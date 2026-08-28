'use server';
import {createHash,randomBytes} from 'crypto';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';

export async function createEmployeeAccessInvite(formData:FormData){
 const crewId=String(formData.get('crew_member_id')||'');if(!crewId)return;
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('Not signed in');const {data:profile}=await supabase.from('profiles').select('company_id,role').eq('id',user.id).single();if(!profile?.company_id||profile.role==='employee')throw new Error('Owner access required');
 const {data:crew}=await supabase.from('crew_members').select('id,name,worker_type,profile_id').eq('id',crewId).eq('company_id',profile.company_id).single();if(!crew||crew.worker_type!=='employee')throw new Error('Employee not found');if(crew.profile_id)throw new Error('This employee already has a Carez login.');
 const token=randomBytes(24).toString('hex');const hash=createHash('sha256').update(token).digest('hex');await supabase.from('employee_invites').delete().eq('crew_member_id',crewId).is('accepted_at',null);
 const {error}=await supabase.from('employee_invites').insert({company_id:profile.company_id,crew_member_id:crewId,token_hash:hash,employee_name:crew.name,created_by:user.id});if(error)throw new Error(error.message);redirect(`/crew/access/invite/${token}`);
}
