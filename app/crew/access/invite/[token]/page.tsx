import {createHash} from 'crypto';
import {redirect} from 'next/navigation';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {InviteLinkBox} from '@/components/employee/InviteLinkBox';
import {buttonVariants} from '@/components/ui/button';
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from '@/components/ui/card';
import {createClient} from '@/lib/supabase/server';

export default async function InvitePage({params}:{params:Promise<{token:string}>}){
 const {token}=await params;
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)redirect('/login');
 const {data:profile}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
 if(!profile?.company_id||profile.role==='employee')redirect('/employee');
 const hash=createHash('sha256').update(token).digest('hex');
 const {data:invite}=await supabase.from('employee_invites').select('employee_name,expires_at,accepted_at').eq('company_id',profile.company_id).eq('token_hash',hash).maybeSingle();
 if(!invite)redirect('/crew/access');
 const path=`/employee/join/${token}`;

 return <AppShell userName={profile.full_name||user.email||'Owner'}>
  <div className="mx-auto flex w-full max-w-screen-lg flex-col gap-6">
   <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
    <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Crew access</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Employee Invite</h1><p className="mt-1 max-w-3xl text-sm text-muted-foreground">Send this private link to {invite.employee_name}. It connects their Carez login to the correct crew record.</p></div>
    <Link className={buttonVariants({variant:'outline',size:'sm'})} href="/crew/access">Done</Link>
   </header>

   <Card className="shadow-none">
    <CardHeader><CardTitle>{invite.employee_name}</CardTitle><CardDescription>Expires {new Date(invite.expires_at).toLocaleString()}</CardDescription></CardHeader>
    <CardContent>
     {invite.accepted_at?<div className="rounded-lg border border-success/30 bg-success/10 px-3 py-3 text-sm text-success">This invite has already been used.</div>:<InviteLinkBox path={path}/>} 
    </CardContent>
   </Card>
  </div>
 </AppShell>;
}
