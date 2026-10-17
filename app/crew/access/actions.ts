'use server';
import {createHash,randomBytes} from 'crypto';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';

export async function createEmployeeAccessInvite(formData:FormData){
 const crewId=String(formData.get('crew_member_id')||'');if(!crewId)return;
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('Not signed in');const {data:profile}=await supabase.from('profiles').select('company_id,role').eq('id',user.id).single();if(!profile?.company_id||profile.role==='employee')throw new Error('Owner access required');
 const token=randomBytes(24).toString('hex');const hash=createHash('sha256').update(token).digest('hex');
 const {data,error}=await supabase.rpc('carez_issue_employee_invite',{p_crew_member_id:crewId,p_token_hash:hash});
 if(error||!data)throw new Error(error?.message||'No invite was confirmed.');redirect(`/crew/access/invite/${token}`);
}
