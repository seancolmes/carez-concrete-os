import {redirect} from 'next/navigation';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {createClient} from '@/lib/supabase/server';
import {createEmployeeAccessInvite} from './actions';

export default async function CrewAccessPage(){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');const {data:profile}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();if(!profile?.company_id||profile.role==='employee')redirect('/employee');
 const {data:crew}=await supabase.from('crew_members').select('id,name,role,phone,profile_id,active').eq('company_id',profile.company_id).eq('worker_type','employee').order('active',{ascending:false}).order('name');
 return <AppShell userName={profile.full_name||user.email||'Owner'}><div className="contractor-page"><div className="command-hero"><div><h1>Employee Access</h1><p>Give each W-2 employee a private Carez clock login. They only see their job clock, tasks, breaks and their own time.</p></div><div className="command-actions"><Link className="button secondary" href="/crew">Back to Crew</Link></div></div>
 <section className="section"><div className="surface"><div className="surface-header"><div><div className="surface-title">Employee Logins</div><div className="surface-subtitle">Create one invite link per employee.</div></div></div><div className="surface-body"><div className="list">{(crew||[]).length===0?<div className="empty-state"><div><div className="title">No W-2 employees yet</div><div className="meta">Add employees in Crew first.</div></div></div>:(crew||[]).map((c:any)=><div className="row" key={c.id}><div><div className="title">{c.name}</div><div className="meta">{c.role} · {c.phone||'No phone'} · {c.active?'Active':'Inactive'}</div></div>{c.profile_id?<span className="status active">Login Connected</span>:<form action={createEmployeeAccessInvite}><input type="hidden" name="crew_member_id" value={c.id}/><button className="button">Create Login Invite</button></form>}</div>)}</div></div></div></section>
 </div></AppShell>;
}
