import {redirect} from 'next/navigation';
import Link from 'next/link';
import {ArrowRight,Clock3,FileText,Inbox,MessageSquareText,Plus,Users} from 'lucide-react';
import {AppShell} from '@/components/AppShell';
import {Badge} from '@/components/ui/badge';
import {Button,buttonVariants} from '@/components/ui/button';
import {Card,CardContent,CardDescription,CardFooter,CardHeader,CardTitle} from '@/components/ui/card';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle,DialogTrigger} from '@/components/ui/dialog';
import {Empty,EmptyContent,EmptyDescription,EmptyHeader,EmptyMedia,EmptyTitle} from '@/components/ui/empty';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Textarea} from '@/components/ui/textarea';
import {createClient} from '@/lib/supabase/server';
import {createLead,convertLeadToEstimate,updateLeadStatus,addLeadActivity,setLeadFollowUp} from './actions';
import {cn} from '@/lib/utils';

const money=(n:any)=>n==null?'—':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n));
const today=()=>new Date().toISOString().slice(0,10);
const stageLabel=(s:string)=>({new:'New lead',reviewing:'Reviewing',estimating:'Estimating',proposal_sent:'Proposal sent',follow_up:'Follow up',won:'Won',lost:'Lost'} as Record<string,string>)[s]||String(s||'').replaceAll('_',' ');
const sourceLabel=(s:string)=>({outlook:'Outlook email',phone:'Phone',website:'Website',referral:'Referral',gc_invitation:'GC invitation',repeat_customer:'Repeat customer',manual:'Entered manually',other:'Other'} as Record<string,string>)[s]||s||'Not set';
const fieldSelect='h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none transition-shadow focus:border-ring focus:ring-3 focus:ring-ring/20';

function Metric({label,value,help,tone='default'}:{label:string;value:string;help:string;tone?:'default'|'success'|'warning'|'danger'}){
  return <Card className={cn('gap-2 py-4 shadow-none',tone==='warning'&&'border-amber-500/30',tone==='danger'&&'border-destructive/25')}>
    <CardHeader className="gap-1 px-4"><CardDescription className="text-xs font-medium">{label}</CardDescription><CardTitle className={cn('font-mono text-2xl font-semibold tracking-tight tabular-nums',tone==='success'&&'text-success',tone==='warning'&&'text-amber-700',tone==='danger'&&'text-destructive')}>{value}</CardTitle></CardHeader>
    <CardContent className="px-4 text-xs leading-5 text-muted-foreground">{help}</CardContent>
  </Card>;
}

function LeadStatus({status,followDue}:{status:string;followDue:boolean}){
  if(followDue)return <Badge variant="secondary" className="bg-amber-500/10 text-amber-700">Follow up due</Badge>;
  if(status==='won')return <Badge variant="secondary" className="bg-success/10 text-success">Won</Badge>;
  if(status==='lost')return <Badge variant="secondary" className="text-muted-foreground">Lost</Badge>;
  if(status==='estimating'||status==='proposal_sent')return <Badge>{stageLabel(status)}</Badge>;
  return <Badge variant="outline">{stageLabel(status)}</Badge>;
}

export default async function LeadsPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
  if(!profile?.company_id)redirect('/login');
  if(profile.role==='employee')redirect('/employee');

  const [{data:leads},{data:activities},{data:estimates},{data:inbox}]=await Promise.all([
    supabase.from('leads').select('*').eq('company_id',profile.company_id).order('created_at',{ascending:false}),
    supabase.from('lead_activities').select('*').eq('company_id',profile.company_id).order('activity_date',{ascending:false}).limit(300),
    supabase.from('estimates').select('id,lead_id,estimate_number,version,status').eq('company_id',profile.company_id).not('lead_id','is',null).order('created_at',{ascending:false}),
    supabase.from('lead_inbox_candidates').select('id',{count:'exact',head:true}).eq('company_id',profile.company_id).eq('status','pending'),
  ]);

  const open=(leads||[]).filter((l:any)=>!['won','lost'].includes(l.status));
  const pipeline=open.reduce((sum:number,l:any)=>sum+Number(l.estimated_value||0),0);
  const due=open.filter((l:any)=>l.follow_up&&l.follow_up<=today());
  const bidsDue=open.filter((l:any)=>l.bid_due&&l.bid_due<=today());
  const activityMap=new Map<string,any[]>();
  const estimateMap=new Map<string,any>();
  for(const a of activities||[]){const rows=activityMap.get(a.lead_id)||[];rows.push(a);activityMap.set(a.lead_id,rows);}
  for(const e of estimates||[])if(e.lead_id&&!estimateMap.has(e.lead_id))estimateMap.set(e.lead_id,e);
  const pendingInbox=Number((inbox as any)?.count||0);

  return <AppShell userName={profile.full_name||user.email||'Owner'}>
    <div className="carez-page">
      <header className="carez-page-header">
        <div><p className="carez-kicker">Preconstruction</p><h1 className="carez-page-title">Leads</h1><p className="carez-page-description">Every opportunity gets one permanent number that carries from first contact through estimate, proposal, and awarded job.</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <Link className={buttonVariants({variant:'outline',size:'sm'})} href="/leads/inbox"><Inbox/>Lead inbox{pendingInbox?` (${pendingInbox})`:''}</Link>
          <Dialog>
            <DialogTrigger render={<Button size="sm"/>}><Plus/>Add lead</DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader><DialogTitle>Add lead</DialogTitle><DialogDescription>Carez assigns the permanent opportunity number automatically.</DialogDescription></DialogHeader>
              <form action={createLead} className="grid gap-4">
                <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-muted-foreground"><strong className="text-foreground">Do not invent a lead or job number.</strong> The digital thread starts here and carries forward automatically.</div>
                <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="lead-customer">Customer / GC</Label><Input id="lead-customer" name="customer_name" required placeholder="Smith Homes / John Smith"/></div><div className="grid gap-2"><Label htmlFor="lead-contact">Contact name</Label><Input id="lead-contact" name="contact_name" placeholder="John Smith"/></div></div>
                <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="lead-email">Email</Label><Input id="lead-email" type="email" name="email"/></div><div className="grid gap-2"><Label htmlFor="lead-phone">Phone</Label><Input id="lead-phone" type="tel" name="phone"/></div></div>
                <div className="grid gap-2"><Label htmlFor="lead-address">Project address</Label><Input id="lead-address" name="address" placeholder="123 Main St"/></div>
                <div className="grid gap-3 sm:grid-cols-3"><div className="grid gap-2"><Label htmlFor="lead-city">City</Label><Input id="lead-city" name="city"/></div><div className="grid gap-2"><Label htmlFor="lead-state">State</Label><Input id="lead-state" name="state" defaultValue="WA"/></div><div className="grid gap-2"><Label htmlFor="lead-zip">ZIP</Label><Input id="lead-zip" name="postal_code"/></div></div>
                <div className="grid gap-2"><Label htmlFor="lead-scope">Concrete work</Label><Textarea id="lead-scope" name="scope" rows={3} placeholder="Driveway replacement, foundation, slab, walls..."/></div>
                <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="lead-value">Rough value</Label><Input id="lead-value" name="estimated_value" inputMode="decimal"/></div><div className="grid gap-2"><Label htmlFor="lead-source">Lead source</Label><select id="lead-source" name="source" defaultValue="manual" className={fieldSelect}><option value="manual">Entered manually</option><option value="phone">Phone</option><option value="website">Website</option><option value="referral">Referral</option><option value="gc_invitation">GC invitation</option><option value="repeat_customer">Repeat customer</option><option value="other">Other</option></select></div></div>
                <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="lead-bid-due">Bid due</Label><Input id="lead-bid-due" type="date" name="bid_due"/></div><div className="grid gap-2"><Label htmlFor="lead-follow">Follow up</Label><Input id="lead-follow" type="date" name="follow_up"/></div></div>
                <div className="grid gap-2"><Label htmlFor="lead-notes">Notes</Label><Textarea id="lead-notes" name="notes" rows={2}/></div>
                <div className="flex justify-end"><Button type="submit">Create numbered lead</Button></div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Open pipeline" value={String(open.length)} help="Leads and bids that could become work."/>
        <Metric label="Pipeline value" value={money(pipeline)} help="Current rough value of open opportunities."/>
        <Metric label="Follow ups due" value={String(due.length)} help="Open opportunities at or past their follow-up date." tone={due.length?'danger':'success'}/>
        <Metric label="Bid deadlines due" value={String(bidsDue.length)} help="Open opportunities at or past their bid due date." tone={bidsDue.length?'warning':'success'}/>
      </section>

      <section className="carez-section">
        <div className="carez-section-header"><div><p className="carez-kicker">Sales pipeline</p><h2 className="carez-section-title">Opportunities</h2><p className="carez-section-description">L-26-### becomes E-26-###-R0, then P-26-###-R0, then Job 26-### when accepted.</p></div></div>
        {(leads||[]).length===0?<Empty className="min-h-64 border bg-muted/20"><EmptyHeader><EmptyMedia variant="icon"><Users/></EmptyMedia><EmptyTitle>No leads yet</EmptyTitle><EmptyDescription>Add a lead manually or connect Outlook and review the Lead Inbox.</EmptyDescription></EmptyHeader><EmptyContent><Link href="/leads/inbox" className={buttonVariants({variant:'outline'})}><Inbox/>Open lead inbox</Link></EmptyContent></Empty>:
          <div className="grid gap-3 xl:grid-cols-2">{(leads||[]).map((lead:any)=>{
            const history=activityMap.get(lead.id)||[];
            const followDue=Boolean(lead.follow_up&&lead.follow_up<=today()&&!['won','lost'].includes(lead.status));
            const estimate=estimateMap.get(lead.id);
            return <Card className={cn('gap-0 py-0 shadow-none',followDue&&'border-amber-500/30')} key={lead.id}>
              <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b py-3">
                <div className="min-w-0"><div className="mb-1 flex flex-wrap items-center gap-2"><Badge variant="outline" className="font-mono text-[10px]">L-{lead.opportunity_number||'UNNUMBERED'}</Badge><span className="text-xs text-muted-foreground">{sourceLabel(lead.source)}</span></div><CardTitle className="truncate">{lead.project_name}</CardTitle><CardDescription className="mt-1 truncate">{lead.customer_name}{lead.city?` · ${lead.city}, ${lead.state||'WA'}`:''} · {money(lead.estimated_value)}</CardDescription></div>
                <LeadStatus status={lead.status} followDue={followDue}/>
              </CardHeader>

              <CardContent className="space-y-4 p-4">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[
                  ['Contact',lead.contact_name||lead.customer_name,lead.email||lead.phone||'No contact details'],
                  ['Jobsite',lead.address||lead.city||'Not entered',lead.city&&lead.address?`${lead.city}, ${lead.state||'WA'}`:''],
                  ['Bid due',lead.bid_due||'Not set',''],
                  ['Follow up',lead.follow_up||'Not set',followDue?'Due now':''],
                ].map(([label,value,detail])=><div key={String(label)} className="min-w-0 rounded-lg border bg-muted/20 p-3"><div className="text-[11px] text-muted-foreground">{label}</div><div className={cn('mt-1 truncate text-sm font-medium',label==='Follow up'&&followDue&&'text-amber-700')}>{value}</div>{detail?<div className="mt-0.5 truncate text-[11px] text-muted-foreground">{detail}</div>:null}</div>)}</div>

                <div className="rounded-lg border bg-muted/20 p-3"><div className="text-[11px] font-medium text-muted-foreground">Concrete work</div><div className="mt-1 text-sm leading-5">{lead.scope||'Scope not entered yet.'}</div></div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <form action={updateLeadStatus} className="grid gap-2"><input type="hidden" name="id" value={lead.id}/><Label htmlFor={`status-${lead.id}`}>Pipeline stage</Label><div className="flex gap-2"><select id={`status-${lead.id}`} name="status" defaultValue={lead.status} className={fieldSelect}><option value="new">New lead</option><option value="reviewing">Reviewing</option><option value="estimating">Estimating</option><option value="proposal_sent">Proposal sent</option><option value="follow_up">Follow up</option><option value="won">Won</option><option value="lost">Lost</option></select><Button type="submit" variant="outline" size="sm">Save</Button></div></form>
                  <form action={setLeadFollowUp} className="grid gap-2"><input type="hidden" name="id" value={lead.id}/><Label htmlFor={`follow-${lead.id}`}>Next follow up</Label><div className="flex gap-2"><Input id={`follow-${lead.id}`} type="date" name="follow_up" defaultValue={lead.follow_up||''} className="h-8"/><Button type="submit" variant="outline" size="sm">Save</Button></div></form>
                </div>

                <details className="overflow-hidden rounded-lg border">
                  <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 bg-muted/25 px-3 text-xs font-medium"><MessageSquareText className="size-3.5 text-primary"/>Calls / emails / notes <Badge variant="secondary" className="ml-auto">{history.length}</Badge></summary>
                  <div className="space-y-4 border-t p-3">
                    <form action={addLeadActivity} className="grid gap-3"><input type="hidden" name="lead_id" value={lead.id}/><div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor={`activity-${lead.id}`}>Activity</Label><select id={`activity-${lead.id}`} name="activity_type" className={fieldSelect}><option value="call">Phone call</option><option value="email">Email</option><option value="meeting">Meeting / site visit</option><option value="proposal">Proposal sent</option><option value="note">Note</option></select></div><div className="grid gap-2"><Label htmlFor={`activity-follow-${lead.id}`}>Follow up again</Label><Input id={`activity-follow-${lead.id}`} type="date" name="next_follow_up"/></div></div><div className="grid gap-2"><Label htmlFor={`activity-note-${lead.id}`}>Note</Label><Textarea id={`activity-note-${lead.id}`} name="note" rows={2}/></div><div><Button type="submit" size="sm">Save activity</Button></div></form>
                    {history.length?<div className="divide-y rounded-lg border">{history.slice(0,8).map((activity:any)=><div className="px-3 py-2.5" key={activity.id}><div className="flex items-center gap-2"><span className="text-xs font-medium">{String(activity.activity_type||'note').replaceAll('_',' ')}</span><span className="ml-auto text-[11px] text-muted-foreground">{new Date(activity.activity_date).toLocaleString()}</span></div><div className="mt-1 text-xs leading-5 text-muted-foreground">{activity.note||'No note'}</div></div>)}</div>:<div className="text-xs text-muted-foreground">No activity recorded yet.</div>}
                  </div>
                </details>
              </CardContent>

              <CardFooter className="flex flex-wrap gap-2 border-t bg-muted/20 p-3">
                {estimate?<Link className={buttonVariants({size:'sm'})} href="/estimates"><FileText/>Open {estimate.estimate_number}-R{estimate.version}</Link>:!['won','lost'].includes(lead.status)?<form action={convertLeadToEstimate}><input type="hidden" name="lead_id" value={lead.id}/><Button type="submit" size="sm">Start estimate<ArrowRight/></Button></form>:null}
                <Link className={buttonVariants({variant:'outline',size:'sm'})} href="/leads/inbox"><Inbox/>Email / lead inbox</Link>
                {followDue?<span className="ml-auto flex items-center gap-1.5 self-center text-xs font-medium text-amber-700"><Clock3 className="size-3.5"/>Follow up is due</span>:null}
              </CardFooter>
            </Card>;
          })}</div>}
      </section>
    </div>
  </AppShell>;
}
