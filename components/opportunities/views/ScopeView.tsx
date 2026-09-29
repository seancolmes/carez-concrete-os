import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {ArrowRight,CalendarDays,Ruler} from 'lucide-react';
import {Badge} from '@/components/ui/badge';
import {Button,buttonVariants} from '@/components/ui/button';
import {createClient} from '@/lib/supabase/server';
import {convertLeadToEstimate} from '@/app/leads/actions';
import {addLeadActivity,setLeadFollowUp,updateLeadStatus} from '@/app/leads/actions';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Textarea} from '@/components/ui/textarea';
import viewStyles from './opportunity-view.module.css';

type Estimate={id:string;estimate_number:string|null;version:number|null;name:string|null;status:string|null;project_id:string|null;updated_at:string|null};
type TakeoffSet={id:string;estimate_id:string;name:string|null;revision_label:string|null;source_filename:string|null;status:string|null};
type Proposal={estimate_id:string;proposal_number:string|null;conversion_stage:string|null;next_action:string|null;follow_up_due:string|null};
type Activity={id:string;activity_type:string|null;note:string|null;activity_date:string|null;created_at:string|null};

const stageLabel=(value:string|null)=>({new:'New',reviewing:'Reviewing',estimating:'Estimating',proposal_sent:'Proposal sent',follow_up:'Follow-up',won:'Won',lost:'Lost'} as Record<string,string>)[value||'']||String(value||'Not set').replaceAll('_',' ');
const date=(value:string|null|undefined)=>value?new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(value)):'Not set';
const money=(value:number|null|undefined)=>value==null?'Not entered':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value);

export async function ScopeView({id}:{id:string}){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
  if(!profile?.company_id)redirect('/login');
  if(profile.role==='employee')redirect('/employee');
  const companyId=profile.company_id;
  const {data:lead,error:leadError}=await supabase.from('leads').select('id,opportunity_number,project_name,customer_name,contact_name,email,phone,address,city,state,postal_code,scope,estimated_value,status,bid_due,follow_up,source,notes').eq('id',id).eq('company_id',companyId).maybeSingle();
  if(leadError)throw new Error('Could not load this opportunity.');
  if(!lead)notFound();

  const [estimateResult,activityResult]=await Promise.all([
    supabase.from('estimates').select('id,estimate_number,version,name,status,project_id,updated_at').eq('lead_id',id).eq('company_id',companyId).order('created_at',{ascending:false}),
    supabase.from('lead_activities').select('id,activity_type,note,activity_date,created_at').eq('lead_id',id).eq('company_id',companyId).order('activity_date',{ascending:false}).limit(30),
  ]);
  const estimates=(estimateResult.data||[]) as Estimate[];
  const activities=(activityResult.data||[]) as Activity[];
  const estimateIds=estimates.map(item=>item.id);
  const [takeoffResult,proposalResult]=estimateIds.length?await Promise.all([
    supabase.from('takeoff_sets').select('id,estimate_id,name,revision_label,source_filename,status').eq('company_id',companyId).in('estimate_id',estimateIds).order('created_at',{ascending:false}),
    supabase.from('proposal_conversion_queue').select('estimate_id,proposal_number,conversion_stage,next_action,follow_up_due').eq('company_id',companyId).in('estimate_id',estimateIds),
  ]):[{data:[] as TakeoffSet[],error:null},{data:[] as Proposal[],error:null}];
  const sets=(takeoffResult.data||[]) as TakeoffSet[];
  const proposals=(proposalResult.data||[]) as Proposal[];
  const latestEstimate=estimates.find(item=>!['declined','superseded'].includes(item.status||''))||estimates[0]||null;
  const latestProposal=latestEstimate?proposals.find(item=>item.estimate_id===latestEstimate.id)||proposals[0]||null:proposals[0]||null;
  const isClosed=lead.status==='won'||lead.status==='lost';
  const address=[lead.address,lead.city,lead.state,lead.postal_code].filter(Boolean).join(', ');

  return <>
    <div className={`${viewStyles.workspace} flex w-full min-w-0 flex-col gap-8`}>
      <header className="border-b border-border pb-5">
        <Link href="/opportunities" className="text-sm text-[var(--pt-link)] underline-offset-4 hover:underline">Opportunities</Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0"><p className="font-mono text-xs text-muted-foreground">L-{lead.opportunity_number||'UNNUMBERED'}</p><h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{lead.project_name||lead.customer_name||'Untitled opportunity'}</h1><p className="mt-2 text-sm text-muted-foreground">{lead.customer_name||'Customer not entered'}{address?` · ${address}`:''}</p></div>
          <Badge variant="outline" className="mt-1">{stageLabel(lead.status)}</Badge>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm"><span><strong className="font-medium">Bid due:</strong> <span className="text-muted-foreground">{date(lead.bid_due)}</span></span><span><strong className="font-medium">Follow-up:</strong> <span className="text-muted-foreground">{date(lead.follow_up)}</span></span><span><strong className="font-medium">Rough value:</strong> <span className="text-muted-foreground">{money(lead.estimated_value)}</span></span></div>
        <div className="mt-5 flex flex-wrap gap-2">
          {latestEstimate?<Link href={`/opportunities?lead=${lead.id}&estimate=${latestEstimate.id}&tab=worksheet`} className={buttonVariants({size:'sm'})}>Continue estimate <ArrowRight/></Link>:!isClosed?<form action={convertLeadToEstimate}><input type="hidden" name="lead_id" value={lead.id}/><Button type="submit" size="sm">Start estimate <ArrowRight/></Button></form>:null}
          {latestProposal?<Link href={`/opportunities?lead=${lead.id}&estimate=${latestProposal.estimate_id}&tab=proposal`} className={buttonVariants({variant:'outline',size:'sm'})}>Open proposal</Link>:null}
          {latestEstimate?.project_id?<Link href={`/projects/${latestEstimate.project_id}`} className={buttonVariants({variant:'outline',size:'sm'})}>Open awarded project</Link>:null}
        </div>
      </header>

      <section aria-label="Opportunity follow-up" className="grid gap-3 rounded-xl border border-[#D4DBD7] bg-white p-4 dark:border-[#343A3F] dark:bg-[#181A1B] lg:grid-cols-3">
        <form action={updateLeadStatus} className="flex flex-col gap-2"><input type="hidden" name="id" value={lead.id}/><Label htmlFor={`scope-stage-${lead.id}`}>Pipeline stage</Label><div className="flex gap-2"><select id={`scope-stage-${lead.id}`} name="status" defaultValue={lead.status||'new'} className="h-9 min-w-0 flex-1 rounded-sm border border-input bg-background px-2 text-sm"><option value="new">New lead</option><option value="reviewing">Reviewing</option><option value="estimating">Estimating</option><option value="proposal_sent">Proposal sent</option><option value="follow_up">Follow up</option><option value="won">Won</option><option value="lost">Lost</option></select><Button type="submit" variant="outline" size="sm">Save</Button></div></form>
        <form action={setLeadFollowUp} className="flex flex-col gap-2"><input type="hidden" name="id" value={lead.id}/><Label htmlFor={`scope-follow-${lead.id}`}>Next follow up</Label><div className="flex gap-2"><Input id={`scope-follow-${lead.id}`} name="follow_up" type="date" defaultValue={lead.follow_up||''} className="h-9 min-w-0"/><Button type="submit" variant="outline" size="sm">Save</Button></div></form>
        <form action={addLeadActivity} className="flex flex-col gap-2"><input type="hidden" name="lead_id" value={lead.id}/><Label htmlFor={`scope-note-${lead.id}`}>Record activity</Label><div className="flex gap-2"><select name="activity_type" aria-label="Activity type" className="h-9 rounded-sm border border-input bg-background px-2 text-sm"><option value="note">Note</option><option value="call">Call</option><option value="email">Email</option><option value="meeting">Meeting</option><option value="proposal">Proposal</option></select><Textarea id={`scope-note-${lead.id}`} name="note" rows={1} className="min-h-9 min-w-0 flex-1"/><Button type="submit" variant="outline" size="sm">Save</Button></div></form>
      </section>

      <nav aria-label="Opportunity sections" className="flex gap-5 overflow-x-auto border-b border-border pb-3 text-sm font-medium whitespace-nowrap"><a href="#scope" className="hover:text-[var(--pt-link)]">Scope</a><a href="#plans" className="hover:text-[var(--pt-link)]">Plans &amp; Takeoff</a><a href="#estimates" className="hover:text-[var(--pt-link)]">Estimates</a><a href="#proposals" className="hover:text-[var(--pt-link)]">Proposals</a><a href="#activity" className="hover:text-[var(--pt-link)]">Activity</a></nav>

      <section id="scope" className="scroll-mt-28 border-b border-border pb-7"><h2 className="text-lg font-semibold">Scope and contact</h2><p className="mt-3 max-w-3xl whitespace-pre-wrap text-sm leading-6">{lead.scope||'Concrete scope has not been entered yet.'}</p><dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">Contact</dt><dd className="mt-1">{lead.contact_name||lead.customer_name||'Not entered'}</dd></div><div><dt className="text-muted-foreground">Email / phone</dt><dd className="mt-1 break-words">{[lead.email,lead.phone].filter(Boolean).join(' · ')||'Not entered'}</dd></div></dl>{lead.notes?<p className="mt-5 max-w-3xl border-t border-border pt-4 text-sm text-muted-foreground">{lead.notes}</p>:null}</section>

      <section id="plans" className="scroll-mt-28 border-b border-border pb-7"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Plans &amp; Takeoff</h2><p className="mt-1 text-sm text-muted-foreground">Plan sets attached to this opportunity’s estimate revisions.</p></div><Link href="/takeoff" className={buttonVariants({variant:'outline',size:'sm'})}><Ruler/>Takeoff queue</Link></div>{takeoffResult.error?<p role="status" className="mt-4 text-sm text-muted-foreground">Plan sets are unavailable right now. Open the Takeoff queue to try again.</p>:sets.length?<div className="mt-4 divide-y divide-border border-y border-border">{sets.map(set=><div key={set.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><strong className="text-sm">{set.source_filename||set.name||'Plan set'}</strong><p className="mt-1 text-xs text-muted-foreground">{set.revision_label||'Revision not labeled'} · {estimates.find(item=>item.id===set.estimate_id)?.estimate_number||'Estimate'}</p></div><Link href={`/opportunities?lead=${lead.id}&estimate=${set.estimate_id}&takeoff=${set.id}&tab=takeoff`} className="text-sm font-medium text-[var(--pt-link)] underline-offset-4 hover:underline">Open takeoff</Link></div>)}</div>:<p className="mt-4 text-sm text-muted-foreground">No plan takeoff is linked yet. Start from an estimate in the Takeoff queue.</p>}</section>

      <section id="estimates" className="scroll-mt-28 border-b border-border pb-7"><h2 className="text-lg font-semibold">Estimates</h2>{estimateResult.error?<p role="status" className="mt-4 text-sm text-muted-foreground">Estimate revisions are unavailable right now. Open the Estimates queue to try again.</p>:estimates.length?<div className="mt-4 divide-y divide-border border-y border-border">{estimates.map(estimate=><div key={estimate.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><strong className="text-sm">{estimate.estimate_number}-R{estimate.version??0}</strong><p className="mt-1 text-xs text-muted-foreground">{estimate.status||'Status unavailable'} · Updated {date(estimate.updated_at)}</p></div><Link href={`/estimates/${estimate.id}`} className="text-sm font-medium text-[var(--pt-link)] underline-offset-4 hover:underline">Open revision</Link></div>)}</div>:<p className="mt-4 text-sm text-muted-foreground">No estimate has been started for this opportunity.</p>}</section>

      <section id="proposals" className="scroll-mt-28 border-b border-border pb-7"><h2 className="text-lg font-semibold">Proposals</h2>{proposalResult.error?<p role="status" className="mt-4 text-sm text-muted-foreground">Proposal states are unavailable right now. Open the Proposals queue to try again.</p>:proposals.length?<div className="mt-4 divide-y divide-border border-y border-border">{proposals.map(proposal=><div key={proposal.estimate_id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><strong className="text-sm">{proposal.proposal_number||'Proposal'}</strong><p className="mt-1 text-xs text-muted-foreground">{proposal.conversion_stage?.replaceAll('_',' ')||'State unavailable'}{proposal.follow_up_due?` · Follow up ${date(proposal.follow_up_due)}`:''}</p>{proposal.next_action?<p className="mt-1 text-sm">{proposal.next_action}</p>:null}</div><Link href={`/proposals/${proposal.estimate_id}`} className="text-sm font-medium text-[var(--pt-link)] underline-offset-4 hover:underline">Open proposal</Link></div>)}</div>:<p className="mt-4 text-sm text-muted-foreground">No issued proposal is linked to this opportunity. Proposal preparation stays with an estimate revision.</p>}</section>

      <section id="activity" className="scroll-mt-28"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Activity</h2><p className="mt-1 text-sm text-muted-foreground">Calls, messages, and decisions recorded for this opportunity.</p></div></div>{activityResult.error?<p role="status" className="mt-4 text-sm text-muted-foreground">Activity is unavailable right now. Try again from Opportunities.</p>:activities.length?<ol className="mt-4 divide-y divide-border border-y border-border">{activities.map(item=><li key={item.id} className="flex gap-3 py-3"><CalendarDays className="mt-0.5 size-4 shrink-0 text-muted-foreground"/><div><div className="text-sm font-medium">{String(item.activity_type||'Activity').replaceAll('_',' ')}</div><div className="mt-1 text-xs text-muted-foreground">{date(item.activity_date||item.created_at)}</div>{item.note?<p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm leading-6">{item.note}</p>:null}</div></li>)}</ol>:<p className="mt-4 text-sm text-muted-foreground">No activity has been recorded yet.</p>}</section>
    </div>
  </>;
}
