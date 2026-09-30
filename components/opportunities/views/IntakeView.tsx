import Link from 'next/link';
import {opportunityHref} from '../opportunityHref';
import {redirect} from 'next/navigation';
import { OpenRegular as ExternalLink, MailInboxRegular as Inbox, MailRegular as Mail, ArrowClockwiseRegular as RefreshCw, ShieldErrorRegular as ShieldAlert, PeopleRegular as Users } from '@fluentui/react-icons';
import {Badge,Button,Card,CardFooter,CardHeader,Table,TableBody,TableCell,TableHeader,TableHeaderCell,TableRow} from '@fluentui/react-components';
import viewStyles from './opportunity-view.module.css';
import {createClient} from '@/lib/supabase/server';
import {outlookConfigured} from '@/lib/outlook';
import {providerMutationAllowed} from '@/lib/provider-mutation-policy';
import {createLeadFromCandidate,disconnectOutlook,ignoreLeadCandidate,syncOutlookNow} from '@/app/leads/inbox/actions';
import {cn} from '@/lib/utils';

const pct=(n:any)=>`${Math.round(Number(n||0)*100)}%`;
const secondaryAction='inline-flex items-center justify-center bg-[#111111] border border-[#222222] text-[#EDEDED] dark:bg-[#1C1F23] dark:border-[#222222] dark:text-white text-xs font-medium px-4 py-2 rounded-lg hover:border-[#333333] hover:bg-[#1A1A1A] dark:hover:border-[#333333] dark:hover:bg-[#111111] shadow-sm transition-all whitespace-nowrap';
const primaryAction='bg-[#111111] hover:bg-[#222222] text-white text-sm font-medium px-5 py-2.5 rounded-lg border border-[#333333] shadow-[inset_0px_1px_0px_rgba(255,255,255,0.05)] transition-all';
const masterSection='mb-6 overflow-hidden rounded-xl border border-[#222222] bg-[#0A0A0A] shadow-sm dark:border-[#222222] dark:bg-[#0A0A0A]';
const sectionHeader='border-b border-[#222222] bg-[#111111] px-4 py-3 dark:border-[#222222] dark:bg-[#0A0A0A]';

function Metric({label,value,help,tone='default'}:{label:string;value:string;help:string;tone?:'default'|'success'|'warning'}){
  return <div className={cn('min-w-0 px-4 py-3',tone==='warning'&&'border-t-2 border-warning')}><div className="font-mono text-[10px] font-medium uppercase tracking-[.12em] text-muted-foreground">{label}</div><div className={cn('mt-1 font-mono text-lg font-semibold tracking-tight tabular-nums',tone==='success'&&'text-success',tone==='warning'&&'text-warning')}>{value}</div><div className="mt-1 text-xs leading-5 text-muted-foreground">{help}</div></div>;
}

function SectionHeading({kicker,title,description}:{kicker:string;title:string;description?:string}){
  return <div className={sectionHeader}><p className="text-xs font-mono uppercase tracking-wider text-[#999999] dark:text-[#525B62]">{kicker}</p><h2 className="mt-1 text-base font-semibold tracking-tight text-[#EDEDED] dark:text-white">{title}</h2>{description?<p className="mt-1 max-w-4xl text-sm leading-relaxed text-[#AAAAAA] dark:text-[#AAAAAA]">{description}</p>:null}</div>;
}

export async function IntakeView(){
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

  const configured=outlookConfigured(),providerEnabled=providerMutationAllowed();
  const connected=connection?.status==='active';
  const background=Boolean(connection?.subscription_id&&connection?.subscription_expires_at&&new Date(connection.subscription_expires_at).getTime()>Date.now());

  return <>
    <div className={`${viewStyles.workspace} flex w-full min-w-0 flex-col gap-6`}>
      <header className="carez-page-heading flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><h1 className="text-base font-semibold tracking-tight text-[#EDEDED] dark:text-white">Intake</h1><p className="mt-1 max-w-4xl text-sm leading-relaxed text-[#AAAAAA] dark:text-[#AAAAAA]">Connected Outlook can bring concrete opportunities here. Clear leads may be created automatically; uncertain messages wait for review.</p></div>
        <div className="flex flex-wrap items-center gap-2">{connected?<form action={syncOutlookNow}><Button type="submit" size="small" disabled={!providerEnabled}><RefreshCw/>Check Outlook now</Button></form>:providerEnabled?<a className={primaryAction} href="/api/outlook/connect"><Mail/>Connect Outlook</a>:<Button type="button" size="small" disabled><Mail/>Connect Outlook</Button>}<Link className={secondaryAction} href="/opportunities"><Users/>Opportunities</Link></div>
      </header>

      {!providerEnabled&&<p role="status" className="text-sm leading-relaxed text-[#AAAAAA] dark:text-[#AAAAAA]">Outlook connection and sync are disabled in this environment.</p>}

      <section className={`${masterSection} grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4`}>
        <Metric label="Outlook" value={connected?'Connected':'Not connected'} help={connection?.mailbox_email||'Connect the Carez mailbox.'} tone={connected?'success':'warning'}/>
        <Metric label="Needs review" value={String((candidates||[]).length)} help="Possible jobs Carez was not confident enough to create automatically." tone={(candidates||[]).length?'warning':'success'}/>
        <Metric label="Created from email" value={String((messages||[]).length)} help="Recent Outlook messages already tied to numbered leads."/>
        <Metric label="Background watch" value={!providerEnabled?'Paused':connected?(background?'On':'Needs attention'):'Off'} help={!providerEnabled?'Provider sync is disabled in this environment.':background?`Microsoft subscription through ${new Date(connection.subscription_expires_at).toLocaleDateString()}.`:'Manual sync still works; background notification setup may need attention.'} tone={providerEnabled&&connected&&background?'success':providerEnabled&&connected?'warning':'default'}/>
      </section>

      {providerEnabled&&!configured?<div className="flex gap-3 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm"><ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning"/><div><div className="font-medium text-warning">Microsoft app setup is not finished.</div><div className="mt-1 text-xs leading-5 text-muted-foreground">Carez needs the Microsoft client credentials before Outlook authorization can complete.</div></div></div>:null}
      {connection?.last_error?<div className="flex gap-3 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm"><ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning"/><div><div className="font-medium text-warning">Outlook needs attention</div><div className="mt-1 text-xs leading-5 text-muted-foreground">{connection.last_error}</div></div></div>:null}

      <section className={masterSection}>
        <SectionHeading kicker="Review" title="Possible leads" description="Create it if this is real concrete work. Ignore vendor mail, spam, or existing-job conversation."/>
        {(candidates||[]).length===0?<div className="min-h-56 border bg-muted/20"><div><div><Inbox/></div><h3>Nothing waiting for review</h3><p>New uncertain Outlook opportunities will land here.</p></div><div>{connected?<form action={syncOutlookNow}><Button type="submit" appearance="outline" disabled={!providerEnabled}><RefreshCw/>Check Outlook</Button></form>:null}</div></div>:
          <div className="grid gap-3 xl:grid-cols-2">{(candidates||[]).map((candidate:any)=>{
            const message:any=candidate.outlook_messages||{};
            return <Card key={candidate.id} className={masterSection}>
              <CardHeader className={`${sectionHeader} grid grid-cols-[minmax(0,1fr)_auto] gap-3`}><div className="min-w-0"><div className="mb-1 flex flex-wrap items-center gap-2"><Badge appearance="tint" className="bg-warning/10 text-warning">Review</Badge><Badge appearance="outline">{pct(candidate.confidence)} confidence</Badge></div><h3 className="truncate text-base font-semibold tracking-tight text-[#EDEDED] dark:text-white">{message.subject||candidate.project_name||'Possible concrete job'}</h3><p className="mt-1 truncate text-sm leading-relaxed text-[#AAAAAA] dark:text-[#AAAAAA]">{message.sender_name||candidate.contact_name||'Unknown sender'} · {message.sender_email||candidate.email||'No email'}</p></div>{message.web_link?<a href={message.web_link} target="_blank" rel="noreferrer" className={secondaryAction} aria-label="Open email"><ExternalLink/></a>:null}</CardHeader>
              <div className="space-y-3 p-4"><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{[['Customer / GC',candidate.customer_name||'Not clear'],['Phone',candidate.phone||'Not found'],['Jobsite',candidate.address||candidate.city||'Not found']].map(([label,value])=><div key={String(label)} className="min-w-0 rounded-lg border bg-muted/20 p-3"><div className="text-[11px] text-muted-foreground">{label}</div><div className="mt-1 truncate text-sm font-medium">{value}</div></div>)}</div><div className="rounded-lg border bg-muted/20 p-3"><div className="text-[11px] font-medium text-muted-foreground">What the email says</div><div className="mt-1 text-sm leading-5">{candidate.scope||'No useful preview was available.'}</div></div></div>
              <CardFooter className="flex flex-wrap gap-2 border-t border-[#222222] bg-[#111111] p-3 dark:border-[#222222] dark:bg-[#0A0A0A]"><form action={createLeadFromCandidate}><input type="hidden" name="candidate_id" value={candidate.id}/><Button type="submit" className={primaryAction}>Create numbered lead</Button></form><form action={ignoreLeadCandidate}><input type="hidden" name="candidate_id" value={candidate.id}/><Button type="submit" className={secondaryAction}>Not a lead</Button></form>{message.web_link?<a href={message.web_link} target="_blank" rel="noreferrer" className={secondaryAction}>Open email<ExternalLink/></a>:null}</CardFooter>
            </Card>;
          })}</div>}
      </section>

      <section className={masterSection}>
        <SectionHeading kicker="Automation" title="Recently created from Outlook"/>
        {(messages||[]).length===0?<div className="min-h-44 border bg-muted/20"><div><div><Mail/></div><h3>No Outlook-generated leads yet</h3><p>Automatically created numbered leads will be shown here.</p></div></div>:
          <Card className={masterSection}><Table><TableHeader><TableRow className="bg-muted/30 hover:bg-muted/30"><TableHeaderCell>Lead</TableHeaderCell><TableHeaderCell>Sender</TableHeaderCell><TableHeaderCell>Received</TableHeaderCell><TableHeaderCell>Status</TableHeaderCell></TableRow></TableHeader><TableBody>{(messages||[]).map((message:any)=><TableRow key={message.id}><TableCell><Link href={opportunityHref(message.lead_id)} className={secondaryAction}>L-{message.leads?.opportunity_number||'—'} — {message.leads?.project_name||message.subject}</Link></TableCell><TableCell className="text-muted-foreground">{message.sender_name||message.sender_email||'Email'}</TableCell><TableCell className="text-xs font-mono uppercase tracking-wider text-[#999999] dark:text-[#525B62]">{message.received_at?new Date(message.received_at).toLocaleString():'—'}</TableCell><TableCell><Badge appearance="tint" className="bg-success/10 text-success">Created</Badge></TableCell></TableRow>)}</TableBody></Table></Card>}
      </section>

      {connected?<Card className={masterSection}><CardHeader className={`${sectionHeader} grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center`}><div><h3 className="text-base font-semibold tracking-tight text-[#EDEDED] dark:text-white">Mailbox connection</h3><p className="mt-1 text-sm leading-relaxed text-[#AAAAAA] dark:text-[#AAAAAA]">Disconnect only when Carez should stop reading this mailbox for lead automation.</p></div><form action={disconnectOutlook}><Button type="submit" className={secondaryAction} disabled={!providerEnabled}>Disconnect Outlook</Button></form></CardHeader></Card>:null}
    </div>
  </>;
}
