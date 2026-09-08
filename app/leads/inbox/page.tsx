import Link from 'next/link';
import {redirect} from 'next/navigation';
import {ExternalLink,Inbox,Mail,RefreshCw,ShieldAlert,Users} from 'lucide-react';
import {AppShell} from '@/components/AppShell';
import {Badge} from '@/components/ui/badge';
import {Button,buttonVariants} from '@/components/ui/button';
import {Card,CardContent,CardDescription,CardFooter,CardHeader,CardTitle} from '@/components/ui/card';
import {Empty,EmptyContent,EmptyDescription,EmptyHeader,EmptyMedia,EmptyTitle} from '@/components/ui/empty';
import {Table,TableBody,TableCell,TableHead,TableHeader,TableRow} from '@/components/ui/table';
import {createClient} from '@/lib/supabase/server';
import {outlookConfigured} from '@/lib/outlook';
import {createLeadFromCandidate,disconnectOutlook,ignoreLeadCandidate,syncOutlookNow} from './actions';
import {cn} from '@/lib/utils';

const pct=(n:any)=>`${Math.round(Number(n||0)*100)}%`;

function Metric({label,value,help,tone='default'}:{label:string;value:string;help:string;tone?:'default'|'success'|'warning'}){
  return <Card className={cn('gap-2 py-4 shadow-none',tone==='warning'&&'border-warning/30')}><CardHeader className="gap-1 px-4"><CardDescription className="text-xs font-medium">{label}</CardDescription><CardTitle className={cn('text-lg font-semibold tracking-tight',tone==='success'&&'text-success',tone==='warning'&&'text-warning')}>{value}</CardTitle></CardHeader><CardContent className="px-4 text-xs leading-5 text-muted-foreground">{help}</CardContent></Card>;
}

function SectionHeading({kicker,title,description}:{kicker:string;title:string;description?:string}){
  return <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{kicker}</p><h2 className="mt-1 text-lg font-semibold">{title}</h2>{description?<p className="mt-1 max-w-4xl text-sm text-muted-foreground">{description}</p>:null}</div>;
}

export default async function LeadInboxPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/login');
  const {data:p}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
  if(!p?.company_id)redirect('/login');
  if(p.role==='employee')redirect('/employee');

  const [{data:connection},{data:candidates},{data:messages}]=await Promise.all([
    supabase.from('outlook_connections').select('*').eq('company_id',p.company_id).maybeSingle(),
    supabase.from('lead_inbox_candidates').select('*,outlook_messages(subject,sender_name,sender_email,received_at,web_link)').eq('company_id',p.company_id).eq('status','pending').order('created_at',{ascending:false}),
    supabase.from('outlook_messages').select('id,subject,sender_name,sender_email,received_at,classification,confidence,lead_id,leads(opportunity_number,project_name)').eq('company_id',p.company_id).not('lead_id','is',null).order('received_at',{ascending:false}).limit(20),
  ]);

  const configured=outlookConfigured();
  const connected=connection?.status==='active';
  const background=Boolean(connection?.subscription_id&&connection?.subscription_expires_at&&new Date(connection.subscription_expires_at).getTime()>Date.now());

  return <AppShell userName={p.full_name||user.email||'Owner'}>
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Preconstruction</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Lead inbox</h1><p className="mt-1 max-w-4xl text-sm text-muted-foreground">Outlook watches for concrete opportunities. Clear leads can be created automatically; uncertain messages wait here for owner review.</p></div>
        <div className="flex flex-wrap items-center gap-2">{connected?<form action={syncOutlookNow}><Button type="submit" size="sm"><RefreshCw/>Check Outlook now</Button></form>:<a className={buttonVariants({size:'sm'})} href="/api/outlook/connect"><Mail/>Connect Outlook</a>}<Link className={buttonVariants({variant:'outline',size:'sm'})} href="/leads"><Users/>Job pipeline</Link></div>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Outlook" value={connected?'Connected':'Not connected'} help={connection?.mailbox_email||'Connect the Carez mailbox.'} tone={connected?'success':'warning'}/>
        <Metric label="Needs review" value={String((candidates||[]).length)} help="Possible jobs Carez was not confident enough to create automatically." tone={(candidates||[]).length?'warning':'success'}/>
        <Metric label="Created from email" value={String((messages||[]).length)} help="Recent Outlook messages already tied to numbered leads."/>
        <Metric label="Background watch" value={connected?(background?'On':'Needs attention'):'Off'} help={background?`Microsoft subscription through ${new Date(connection.subscription_expires_at).toLocaleDateString()}.`:'Manual sync still works; background notification setup may need attention.'} tone={connected&&background?'success':connected?'warning':'default'}/>
      </section>

      {!configured?<div className="flex gap-3 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm"><ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning"/><div><div className="font-medium text-warning">Microsoft app setup is not finished.</div><div className="mt-1 text-xs leading-5 text-muted-foreground">Carez needs the Microsoft client credentials in Vercel before Outlook authorization can complete.</div></div></div>:null}
      {connection?.last_error?<div className="flex gap-3 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm"><ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning"/><div><div className="font-medium text-warning">Outlook needs attention</div><div className="mt-1 text-xs leading-5 text-muted-foreground">{connection.last_error}</div></div></div>:null}

      <section className="space-y-4">
        <SectionHeading kicker="Review" title="Possible leads" description="Create it if this is real concrete work. Ignore vendor mail, spam, or existing-job conversation."/>
        {(candidates||[]).length===0?<Empty className="min-h-56 border bg-muted/20"><EmptyHeader><EmptyMedia variant="icon"><Inbox/></EmptyMedia><EmptyTitle>Nothing waiting for review</EmptyTitle><EmptyDescription>New uncertain Outlook opportunities will land here.</EmptyDescription></EmptyHeader><EmptyContent>{connected?<form action={syncOutlookNow}><Button type="submit" variant="outline"><RefreshCw/>Check Outlook</Button></form>:null}</EmptyContent></Empty>:
          <div className="grid gap-3 xl:grid-cols-2">{(candidates||[]).map((candidate:any)=>{
            const message:any=candidate.outlook_messages||{};
            return <Card key={candidate.id} className="gap-0 py-0 shadow-none">
              <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b py-3"><div className="min-w-0"><div className="mb-1 flex flex-wrap items-center gap-2"><Badge variant="secondary" className="bg-warning/10 text-warning">Review</Badge><Badge variant="outline">{pct(candidate.confidence)} confidence</Badge></div><CardTitle className="truncate">{message.subject||candidate.project_name||'Possible concrete job'}</CardTitle><CardDescription className="mt-1 truncate">{message.sender_name||candidate.contact_name||'Unknown sender'} · {message.sender_email||candidate.email||'No email'}</CardDescription></div>{message.web_link?<a href={message.web_link} target="_blank" rel="noreferrer" className={buttonVariants({variant:'ghost',size:'icon-sm'})} aria-label="Open email"><ExternalLink/></a>:null}</CardHeader>
              <CardContent className="space-y-3 p-4"><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{[['Customer / GC',candidate.customer_name||'Not clear'],['Phone',candidate.phone||'Not found'],['Jobsite',candidate.address||candidate.city||'Not found']].map(([label,value])=><div key={String(label)} className="min-w-0 rounded-lg border bg-muted/20 p-3"><div className="text-[11px] text-muted-foreground">{label}</div><div className="mt-1 truncate text-sm font-medium">{value}</div></div>)}</div><div className="rounded-lg border bg-muted/20 p-3"><div className="text-[11px] font-medium text-muted-foreground">What the email says</div><div className="mt-1 text-sm leading-5">{candidate.scope||'No useful preview was available.'}</div></div></CardContent>
              <CardFooter className="flex flex-wrap gap-2 border-t bg-muted/20 p-3"><form action={createLeadFromCandidate}><input type="hidden" name="candidate_id" value={candidate.id}/><Button type="submit" size="sm">Create numbered lead</Button></form><form action={ignoreLeadCandidate}><input type="hidden" name="candidate_id" value={candidate.id}/><Button type="submit" variant="outline" size="sm">Not a lead</Button></form>{message.web_link?<a href={message.web_link} target="_blank" rel="noreferrer" className={buttonVariants({variant:'outline',size:'sm'})}>Open email<ExternalLink/></a>:null}</CardFooter>
            </Card>;
          })}</div>}
      </section>

      <section className="space-y-4">
        <SectionHeading kicker="Automation" title="Recently created from Outlook"/>
        {(messages||[]).length===0?<Empty className="min-h-44 border bg-muted/20"><EmptyHeader><EmptyMedia variant="icon"><Mail/></EmptyMedia><EmptyTitle>No Outlook-generated leads yet</EmptyTitle><EmptyDescription>Automatically created numbered leads will be shown here.</EmptyDescription></EmptyHeader></Empty>:
          <Card className="py-0 shadow-none"><Table><TableHeader><TableRow className="bg-muted/30 hover:bg-muted/30"><TableHead>Lead</TableHead><TableHead>Sender</TableHead><TableHead>Received</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{(messages||[]).map((message:any)=><TableRow key={message.id}><TableCell><Link href="/leads" className="font-medium hover:text-primary">L-{message.leads?.opportunity_number||'—'} — {message.leads?.project_name||message.subject}</Link></TableCell><TableCell className="text-muted-foreground">{message.sender_name||message.sender_email||'Email'}</TableCell><TableCell className="text-xs text-muted-foreground">{message.received_at?new Date(message.received_at).toLocaleString():'—'}</TableCell><TableCell><Badge variant="secondary" className="bg-success/10 text-success">Created</Badge></TableCell></TableRow>)}</TableBody></Table></Card>}
      </section>

      {connected?<Card className="shadow-none"><CardHeader className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center"><div><CardTitle className="text-sm">Mailbox connection</CardTitle><CardDescription className="mt-1">Disconnect only when Carez should stop reading this mailbox for lead automation.</CardDescription></div><form action={disconnectOutlook}><Button type="submit" variant="outline" size="sm">Disconnect Outlook</Button></form></CardHeader></Card>:null}
    </div>
  </AppShell>;
}
