import {redirect} from 'next/navigation';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {Badge} from '@/components/ui/badge';
import {Button,buttonVariants} from '@/components/ui/button';
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from '@/components/ui/card';
import {Empty,EmptyDescription,EmptyHeader,EmptyTitle} from '@/components/ui/empty';
import {createClient} from '@/lib/supabase/server';
import {createEmployeeAccessInvite} from './actions';

export default async function CrewAccessPage(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)redirect('/login');
 const {data:profile}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
 if(!profile?.company_id||profile.role==='employee')redirect('/employee');
 const {data:crew}=await supabase.from('crew_members').select('id,name,role,phone,profile_id,active').eq('company_id',profile.company_id).eq('worker_type','employee').order('active',{ascending:false}).order('name');

 return <AppShell userName={profile.full_name||user.email||'Owner'}><div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
  <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
   <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Crew</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Employee Access</h1><p className="mt-1 max-w-3xl text-sm text-muted-foreground">Give each W-2 employee a private Carez clock login. They only see their job clock, tasks, breaks and their own time.</p></div>
   <Link className={buttonVariants({variant:'outline'})} href="/crew">Back to Crew</Link>
  </header>

  <Card className="shadow-none">
   <CardHeader><CardTitle>Employee Logins</CardTitle><CardDescription>Create one invite link per employee.</CardDescription></CardHeader>
   <CardContent>
    {(crew||[]).length===0?<Empty className="border border-border"><EmptyHeader><EmptyTitle>No W-2 employees yet</EmptyTitle><EmptyDescription>Add employees in Crew first.</EmptyDescription></EmptyHeader></Empty>:<div className="divide-y rounded-lg border border-border">{(crew||[]).map((c:any)=><div className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between" key={c.id}><div><div className="font-medium">{c.name}</div><div className="mt-1 text-sm text-muted-foreground">{c.role} · {c.phone||'No phone'} · {c.active?'Active':'Inactive'}</div></div>{c.profile_id?<Badge variant="outline" className="border-success/30 bg-success/10 text-success">Login Connected</Badge>:<form action={createEmployeeAccessInvite}><input type="hidden" name="crew_member_id" value={c.id}/><Button type="submit">Create Login Invite</Button></form>}</div>)}</div>}
   </CardContent>
  </Card>
 </div></AppShell>;
}
