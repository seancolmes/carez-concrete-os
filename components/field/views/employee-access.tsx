import {Badge,Button,Dialog,DialogTitle,DialogTrigger,DialogBody,DialogContent,DialogSurface} from '@fluentui/react-components';
import {redirect} from 'next/navigation';
import Link from 'next/link';
import {createClient} from '@/lib/supabase/server';
import {createEmployeeAccessInvite} from '@/app/crew/access/actions';

export default async function CrewAccessPage(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)redirect('/login');
 const {data:profile}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
 if(!profile?.company_id||profile.role==='employee')redirect('/employee');
 const {data:crew}=await supabase.from('crew_members').select('id,name,role,phone,profile_id,active').eq('company_id',profile.company_id).eq('worker_type','employee').order('active',{ascending:false}).order('name');

 return <><div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4">
  <header className="carez-page-heading flex flex-wrap items-center justify-between gap-3">
   <h1>Employee access</h1>
   <Link className={secondaryLinkClass} href="/crew">Crew roster</Link>
  </header>

  <section aria-labelledby="employee-logins" className="space-y-2"><div className="carez-page-heading"><h2 id="employee-logins">Employee logins</h2></div>
    {(crew||[]).length===0?<div className="border border-border"><div><h3>No W-2 employees yet</h3><p>Add employees in Crew first.</p></div></div>:<div className="divide-y border border-border">{(crew||[]).map((c:any)=><div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2" key={c.id}><div className="min-w-0"><strong className="block truncate text-sm">{c.name}</strong><span className="block truncate text-xs text-muted-foreground">{c.role} · {c.phone||'No phone'} · {c.active?'Active':'Inactive'}</span></div>{c.profile_id?<Badge appearance="outline" className="border-success/30 bg-success/10 text-success">Login connected</Badge>:<Dialog><DialogTrigger><Button appearance="outline" size="small">Create invite</Button></DialogTrigger><DialogSurface><DialogBody><DialogContent><div><DialogTitle>Create login invite</DialogTitle><p>Generate a private Pourtrace access link for {c.name}. Share it only with this employee.</p></div><form action={createEmployeeAccessInvite}><input type="hidden" name="crew_member_id" value={c.id}/><Button type="submit" appearance="primary">Generate invite link</Button></form></DialogContent></DialogBody></DialogSurface></Dialog>}</div>)}</div>}
  </section>
 </div></>;
}

const primaryLinkClass='inline-flex min-h-8 items-center justify-center gap-1 rounded-sm border border-primary bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90';
const secondaryLinkClass='inline-flex min-h-8 items-center justify-center gap-1 rounded-sm border border-border bg-background px-3 text-xs font-semibold hover:bg-accent';
