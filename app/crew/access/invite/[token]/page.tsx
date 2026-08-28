import {createHash} from 'crypto';
import {redirect} from 'next/navigation';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {InviteLinkBox} from '@/components/employee/InviteLinkBox';
import {createClient} from '@/lib/supabase/server';

export default async function InvitePage({params}:{params:Promise<{token:string}>}){
 const {token}=await params;const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');const {data:profile}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();if(!profile?.company_id||profile.role==='employee')redirect('/employee');
 const hash=createHash('sha256').update(token).digest('hex');const {data:invite}=await supabase.from('employee_invites').select('employee_name,expires_at,accepted_at').eq('company_id',profile.company_id).eq('token_hash',hash).maybeSingle();if(!invite)redirect('/crew/access');
 const path=`/employee/join/${token}`;
 return <AppShell userName={profile.full_name||user.email||'Owner'}><div className="contractor-page"><div className="command-hero"><div><h1>Employee Invite</h1><p>Send this private link to {invite.employee_name}. It connects their Carez login to the correct crew record.</p></div><div className="command-actions"><Link className="button secondary" href="/crew/access">Done</Link></div></div><div className="surface"><div className="surface-header"><div><div className="surface-title">{invite.employee_name}</div><div className="surface-subtitle">Expires {new Date(invite.expires_at).toLocaleString()}</div></div></div>{invite.accepted_at?<div className="surface-body"><div className="alert success">This invite has already been used.</div></div>:<InviteLinkBox path={path}/>}</div></div></AppShell>;
}
