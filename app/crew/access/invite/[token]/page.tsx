import {Card,CardHeader} from '@fluentui/react-components';
import {createHash} from 'crypto';
import {redirect} from 'next/navigation';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {InviteLinkBox} from '@/components/employee/InviteLinkBox';
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
  <div className="flex w-full flex-col gap-3 lg:h-full lg:min-h-0 lg:overflow-hidden">
   <header className="carez-page-heading flex shrink-0 flex-col gap-3 rounded-md border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
    <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Crew access</p><h1 className="mt-1 text-lg font-semibold tracking-tight">Employee Invite</h1><p className="mt-1 text-xs text-muted-foreground">Send this private link to {invite.employee_name}. It connects their Carez login to the correct crew record.</p></div>
    <Link className={secondaryLinkClass} href="/crew/access">Done</Link>
   </header>

   <Card className="shadow-none lg:min-h-0 lg:overflow-y-auto">
    <CardHeader><h3>{invite.employee_name}</h3><p>Expires {new Date(invite.expires_at).toLocaleString()}</p></CardHeader>
    <div className="p-4">
     {invite.accepted_at?<div className="rounded-lg border border-success/30 bg-success/10 px-3 py-3 text-sm text-success">This invite has already been used.</div>:<InviteLinkBox path={path}/>} 
    </div>
   </Card>
  </div>
 </AppShell>;
}

const primaryLinkClass='inline-flex min-h-8 items-center justify-center gap-1 rounded-sm border border-primary bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90';
const secondaryLinkClass='inline-flex min-h-8 items-center justify-center gap-1 rounded-sm border border-border bg-background px-3 text-xs font-semibold hover:bg-accent';
