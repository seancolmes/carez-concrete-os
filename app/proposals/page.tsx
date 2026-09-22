import {redirect} from 'next/navigation';
import Link from 'next/link';
import {ArrowRight,CheckCircle2,Clock3,Eye,FileText,MessageSquareText,ShieldCheck} from 'lucide-react';
import {AppShell} from '@/components/AppShell';
import {Badge} from '@/components/ui/badge';
import {buttonVariants} from '@/components/ui/button';
import {Card,CardContent,CardDescription,CardFooter,CardHeader,CardTitle} from '@/components/ui/card';
import {Empty,EmptyContent,EmptyDescription,EmptyHeader,EmptyMedia,EmptyTitle} from '@/components/ui/empty';
import {createClient} from '@/lib/supabase/server';
import {cn} from '@/lib/utils';

const money=(n:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n||0));
const day=(v:any)=>v?new Date(`${String(v).slice(0,10)}T12:00:00`).toLocaleDateString('en-US',{month:'short',day:'numeric'}):'—';
const dt=(v:any)=>v?new Date(v).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'—';
const stageLabel=(v:string)=>({sent:'Sent · not viewed',viewed:'Viewed',needs_reply:'Needs reply',accepted:'Accepted',declined:'Declined',expired:'Expired',revoked:'Link off',superseded:'Superseded'} as any)[v]||v;

function Metric({label,value,help,tone='default'}:{label:string;value:string;help:string;tone?:'default'|'success'|'warning'}){
  return <div className="min-w-0 border-x border-border px-4 py-3 first:border-l-0 last:border-r-0"><CardHeader className="gap-1 px-0"><CardDescription className="text-xs font-medium uppercase tracking-wide">{label}</CardDescription><CardTitle className={cn('font-mono text-2xl font-semibold tracking-tight tabular-nums',tone==='success'&&'text-success',tone==='warning'&&'text-warning')}>{value}</CardTitle></CardHeader><CardContent className="px-0 text-xs leading-5 text-muted-foreground">{help}</CardContent></div>;
}

export default async function ProposalsPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();if(!profile?.company_id)redirect('/login');if(profile.role==='employee')redirect('/employee');
  const companyId=profile.company_id;
  const [{data:estimates},{data:summaries},{data:queues},{data:leads},{data:projects},{data:events}]=await Promise.all([
    supabase.from('estimates').select('id,estimate_number,opportunity_number,version,name,status,project_id,lead_id,updated_at').eq('company_id',companyId).order('updated_at',{ascending:false}),
    supabase.from('estimate_financial_summary').select('estimate_id,selected_sell_price,recommended_sell_price').eq('company_id',companyId),
    supabase.from('proposal_conversion_queue').select('*').eq('company_id',companyId).order('sent_at',{ascending:false}),
    supabase.from('leads').select('id,customer_name,contact_name,email,phone,project_name,status').eq('company_id',companyId),
    supabase.from('projects').select('id,job_number,name').eq('company_id',companyId),
    supabase.from('proposal_engagement_events').select('id,presentation_id,event_type,handled_at').eq('company_id',companyId).is('handled_at',null).neq('event_type','view'),
  ]);
  const summaryMap=new Map((summaries||[]).map((row:any)=>[row.estimate_id,row]));
  const leadMap=new Map((leads||[]).map((row:any)=>[row.id,row]));
  const projectMap=new Map((projects||[]).map((row:any)=>[row.id,row]));
  const queueMap=new Map<string,any>();for(const row of queues||[])if(!queueMap.has(row.estimate_id))queueMap.set(row.estimate_id,row);
  const eventCountByPresentation=new Map<string,number>();for(const event of events||[])eventCountByPresentation.set(event.presentation_id,(eventCountByPresentation.get(event.presentation_id)||0)+1);
  const rows=(estimates||[]).map((e:any)=>{const q=queueMap.get(e.id);const lead=leadMap.get(e.lead_id)||{};const project=projectMap.get(e.project_id);const s=summaryMap.get(e.id)||{};const sell=Number(q?.base_sell_price||s.selected_sell_price||s.recommended_sell_price||0);const responses=q?eventCountByPresentation.get(q.presentation_id)||0:0;const stage=q?.conversion_stage||(e.status==='ready'?'ready':e.status==='accepted'?'accepted':e.status);return{e,q,lead,project,sell,responses,stage};});
  const ready=rows.filter((r:any)=>r.stage==='ready'&&!r.q);
  const needs=rows.filter((r:any)=>r.stage==='needs_reply'||r.responses>0);
  const market=rows.filter((r:any)=>r.q&&['sent','viewed'].includes(r.stage)&&r.responses===0);
  const won=rows.filter((r:any)=>r.stage==='accepted'||r.e.status==='accepted'||r.e.status==='approved');
  const history=rows.filter((r:any)=>['declined','expired','revoked','superseded'].includes(r.stage)||r.e.status==='superseded');
  const openValue=[...ready,...market,...needs].reduce((sum:number,row:any)=>sum+row.sell,0);

  return <AppShell userName={profile.full_name||user.email||'Owner'}>
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
      <header className="carez-page-heading flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Preconstruction</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Proposals</h1></div>
        <div className="flex flex-wrap items-center gap-2"><Link className={buttonVariants({variant:'outline',size:'sm'})} href="/estimates"><FileText/>Estimates</Link><Link className={buttonVariants({variant:'outline',size:'sm'})} href="/estimates/audit"><ShieldCheck/>Audit</Link></div>
      </header>

      <nav className="flex w-fit max-w-full items-stretch overflow-x-auto rounded-lg border bg-card text-xs" aria-label="Estimate workflow">
        {['Takeoff','Estimate','Audit','Proposal'].map((label,index)=><div key={label} className={index===3?'flex min-h-9 items-center gap-2 border-r bg-accent px-3 font-medium text-primary shadow-[inset_0_-2px_var(--primary)] last:border-r-0':'flex min-h-9 items-center gap-2 border-r px-3 text-muted-foreground last:border-r-0'}><span className="font-mono text-[10px]">{index+1}</span><span>{label}</span>{index<3?<ArrowRight className="size-3 opacity-50"/>:null}</div>)}
      </nav>

      <section className="carez-summary-ledger grid grid-cols-2 gap-px lg:grid-cols-4">
        <Metric label="Ready to send" value={String(ready.length)} help="Estimate revisions waiting for proposal prep."/>
        <Metric label="Needs reply" value={String(needs.length)} help="Customer question, change request, or response." tone={needs.length?'warning':'default'}/>
        <Metric label="In market" value={String(market.length)} help="Sent or viewed and awaiting decision." tone={market.length?'success':'default'}/>
        <Metric label="Open proposal value" value={money(openValue)} help="Current ready and active customer proposals."/>
      </section>

      {needs.length>0?<section className="space-y-4"><div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Attention</p><h2 className="mt-1 text-lg font-semibold">Customer response waiting</h2><p className="mt-1 text-sm text-muted-foreground">These proposals are most likely to require action now.</p></div><div className="grid gap-3 lg:grid-cols-2">{needs.map((row:any)=><ProposalCard key={row.e.id} row={row} priority/>)}</div></section>:null}

      <section className="space-y-4">
        <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Customer pipeline</p><h2 className="mt-1 text-lg font-semibold">Ready & in market</h2><p className="mt-1 text-sm text-muted-foreground">Prepare, send, follow up, respond, or revise only from the current authoritative proposal state.</p></div>
        {ready.length+market.length===0?<Empty className="min-h-56 border bg-muted/20"><EmptyHeader><EmptyMedia variant="icon"><FileText/></EmptyMedia><EmptyTitle>No proposal is waiting right now</EmptyTitle><EmptyDescription>Finish an estimate, run the audit, then move the revision into proposal preparation.</EmptyDescription></EmptyHeader><EmptyContent><Link className={buttonVariants()} href="/estimates">Open estimates</Link></EmptyContent></Empty>:<div className="grid gap-3 lg:grid-cols-2">{[...ready,...market].map((row:any)=><ProposalCard key={row.e.id} row={row}/>)}</div>}
      </section>

      {won.length>0?<section className="space-y-4"><div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Won</p><h2 className="mt-1 text-lg font-semibold">Accepted proposals</h2><p className="mt-1 text-sm text-muted-foreground">Accepted proposal revisions are locked and already handed into the awarded-job workflow.</p></div><div className="grid gap-3 lg:grid-cols-2">{won.map((row:any)=><ProposalCard key={row.e.id} row={row}/>)}</div></section>:null}

      {history.length>0?<section className="space-y-4"><details className="overflow-hidden rounded-lg border bg-card"><summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 bg-muted/30 px-3 text-sm font-medium">Closed / previous proposal revisions <Badge variant="secondary">{history.length}</Badge></summary><div className="grid gap-3 border-t p-3 lg:grid-cols-2">{history.map((row:any)=><ProposalCard key={row.e.id} row={row}/>)}</div></details></section>:null}
    </div>
  </AppShell>;
}

function ProposalCard({row,priority=false}:{row:any;priority?:boolean}){
  const {e,q,lead,project,sell,responses,stage}=row;
  const proposalNumber=q?.proposal_number||`P-${e.opportunity_number||String(e.estimate_number||'').replace(/^E-/,'')}-R${Number(e.version||0)}`;
  const customer=lead.customer_name||q?.customer_name||'Customer';
  const job=lead.project_name||project?.name||e.name;
  const viewed=Number(q?.view_count||0)>0;
  const label=q?stageLabel(stage):stage==='ready'?'Ready to prepare':stage;
  const next=q?.next_action||(stage==='ready'?'Prepare and issue customer proposal':'Open proposal');
  const Icon=responses?MessageSquareText:viewed?Eye:FileText;

  return <article className={cn('border-y border-border bg-transparent',priority&&'border-warning/50')}>
    <CardHeader className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-start gap-3 border-b py-3"><span className={cn('flex size-9 items-center justify-center rounded-lg bg-accent text-primary',priority&&'bg-warning/10 text-warning')}><Icon className="size-4"/></span><div className="min-w-0"><p className="font-mono text-[10px] font-semibold text-primary">{proposalNumber}</p><CardTitle className="mt-1 truncate">{customer}</CardTitle><CardDescription className="mt-0.5 truncate">{job}</CardDescription></div><Badge variant={stage==='accepted'?'secondary':priority?'secondary':'outline'} className={cn(stage==='accepted'&&'bg-success/10 text-success',priority&&'bg-warning/10 text-warning')}>{label}</Badge></CardHeader>
    <CardContent className="space-y-3 p-4">
      <div><div className="text-xs text-muted-foreground">Customer price</div><div className="mt-1 font-mono text-2xl font-semibold tabular-nums">{money(sell)}</div></div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[
        ['Views',q?Number(q.view_count||0):'—',false],['Responses',responses,responses>0],['Last viewed',q?.last_viewed_at?dt(q.last_viewed_at):'—',false],['Follow-up',q?.follow_up_due?day(q.follow_up_due):'—',Boolean(q?.follow_up_due_now)],
      ].map(([name,value,attention])=><div key={String(name)} className="rounded-lg border bg-muted/20 p-2.5"><div className="text-[11px] text-muted-foreground">{name}</div><div className={cn('mt-1 text-xs font-medium',attention&&'text-warning')}>{value}</div></div>)}</div>
      <div className="flex gap-2 rounded-lg border bg-muted/20 px-3 py-2.5 text-xs leading-5"><Clock3 className="mt-0.5 size-3.5 shrink-0 text-primary"/><span>{next}</span></div>
    </CardContent>
    <CardFooter className="flex flex-wrap gap-2 border-t bg-muted/20 p-3"><Link className={buttonVariants({size:'sm'})} href={`/proposals/${e.id}`}>{q?'Open proposal':'Prepare proposal'}<ArrowRight/></Link>{stage==='accepted'&&e.project_id?<Link className={buttonVariants({variant:'outline',size:'sm'})} href={`/projects/${e.project_id}`}><CheckCircle2/>Open job</Link>:null}</CardFooter>
  </article>;
}
