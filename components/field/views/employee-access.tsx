import {redirect} from 'next/navigation';
import Link from 'next/link';
import {Badge} from '@/components/ui/badge';
import {Button,buttonVariants} from '@/components/ui/button';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle,DialogTrigger} from '@/components/ui/dialog';
import {Empty,EmptyDescription,EmptyHeader,EmptyTitle} from '@/components/ui/empty';
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
   <Link className={buttonVariants({variant:'outline',size:'sm'})} href="/crew">Crew roster</Link>
  </header>

  <section aria-labelledby="employee-logins" className="space-y-2"><div className="carez-page-heading"><h2 id="employee-logins">Employee logins</h2></div>
    {(crew||[]).length===0?<Empty className="border border-border"><EmptyHeader><EmptyTitle>No W-2 employees yet</EmptyTitle><EmptyDescription>Add employees in Crew first.</EmptyDescription></EmptyHeader></Empty>:<div className="divide-y border border-border">{(crew||[]).map((c:any)=><div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2" key={c.id}><div className="min-w-0"><strong className="block truncate text-sm">{c.name}</strong><span className="block truncate text-xs text-muted-foreground">{c.role} · {c.phone||'No phone'} · {c.active?'Active':'Inactive'}</span></div>{c.profile_id?<Badge variant="outline" className="border-success/30 bg-success/10 text-success">Login connected</Badge>:<Dialog><DialogTrigger render={<Button variant="outline" size="sm"/>}>Create invite</DialogTrigger><DialogContent><DialogHeader><DialogTitle>Create login invite</DialogTitle><DialogDescription>Generate a private Pourtrace access link for {c.name}. Share it only with this employee.</DialogDescription></DialogHeader><form action={createEmployeeAccessInvite}><input type="hidden" name="crew_member_id" value={c.id}/><Button type="submit">Generate invite link</Button></form></DialogContent></Dialog>}</div>)}</div>}
  </section>
 </div></>;
}
