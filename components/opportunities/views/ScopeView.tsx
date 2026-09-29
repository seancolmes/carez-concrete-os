import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {ArrowRight,CalendarDays,Ruler} from 'lucide-react';
import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {createClient} from '@/lib/supabase/server';
import {estimateHref} from '../opportunityHref';
import {convertLeadToEstimate} from '@/app/leads/actions';
import {addLeadActivity,setLeadFollowUp,updateLeadStatus} from '@/app/leads/actions';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Textarea} from '@/components/ui/textarea';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import viewStyles from './opportunity-view.module.css';
import {OpportunitySectionNav} from './OpportunitySectionNav';

type Estimate={id:string;estimate_number:string|null;version:number|null;name:string|null;status:string|null;project_id:string|null;updated_at:string|null};
type TakeoffSet={id:string;estimate_id:string;name:string|null;revision_label:string|null;source_filename:string|null;status:string|null};
type Proposal={estimate_id:string;proposal_number:string|null;conversion_stage:string|null;next_action:string|null;follow_up_due:string|null};
type Activity={id:string;activity_type:string|null;note:string|null;activity_date:string|null;created_at:string|null};

const stageLabel=(value:string|null)=>({new:'New',reviewing:'Reviewing',estimating:'Estimating',proposal_sent:'Proposal sent',follow_up:'Follow-up',won:'Won',lost:'Lost'} as Record<string,string>)[value||'']||String(value||'Not set').replaceAll('_',' ');
const date=(value:string|null|undefined)=>value?new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(value)):'Not set';
const money=(value:number|null|undefined)=>value==null?'Not entered':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value);
const secondaryAction='inline-flex items-center justify-center bg-[#EFF2F0] border border-[#D4DBD7] text-[#171B19] dark:bg-[#1C1F23] dark:border-[#343A3F] dark:text-white h-8 px-4 text-xs font-medium rounded-lg hover:border-[#B9C3BE] hover:bg-[#E5EBE7] dark:hover:border-[#525B62] dark:hover:bg-[#25292C] shadow-sm transition-all whitespace-nowrap';
const primaryAction='bg-[#007A52] hover:bg-[#005c3e] text-white inline-flex items-center justify-center gap-2 h-8 px-4 text-xs font-medium [&_svg]:size-3.5 rounded-lg border border-[#009966]/30 shadow-[0_2px_8px_rgba(0,122,82,0.15)] transition-all';
const masterSection='scroll-mt-28 mb-6 overflow-hidden rounded-xl border border-[#D4DBD7] bg-white p-4 shadow-sm dark:border-[#343A3F] dark:bg-[#121212]';
const inputClass='h-10 w-full rounded-lg border border-[#D4DBD7] bg-white px-3 py-2 text-sm text-[#171B19] transition-colors focus:border-[#007A52] focus:outline-none focus:ring-1 focus:ring-[#007A52] dark:border-[#343A3F] dark:bg-[#121212] dark:text-white dark:focus:border-[#009966] dark:focus:ring-[#009966]';
const labelClass='mb-1.5 block text-xs font-mono uppercase tracking-widest text-[#525C57] dark:text-muted-foreground';
const groundedHeader='-mx-4 -mt-4 mb-4 border-b border-[#D4DBD7] bg-[#EFF2F0] px-4 py-3 dark:border-[#343A3F] dark:bg-[#181A1B]';

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
        <Link href="/opportunities" className={secondaryAction}>Opportunities</Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0"><p className="font-mono text-xs font-mono uppercase tracking-wider text-[#7B8580] dark:text-[#525B62]">L-{lead.opportunity_number||'UNNUMBERED'}</p><h1 className="mt-1 text-base font-semibold tracking-tight text-[#171B19] dark:text-white">{lead.project_name||lead.customer_name||'Untitled opportunity'}</h1><p className="mt-2 text-sm leading-relaxed text-[#525C57] dark:text-[#8B949E]">{lead.customer_name||'Customer not entered'}{address?` · ${address}`:''}</p></div>
          <Badge variant="outline" className={lead.status==='won'?'mt-1 bg-[#009966]/15 border border-[#009966]/50 text-[#009966]':'mt-1'}>{stageLabel(lead.status)}</Badge>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm"><span><strong className="font-medium">Bid due:</strong> <span className="text-muted-foreground">{date(lead.bid_due)}</span></span><span><strong className="font-medium">Follow-up:</strong> <span className="text-muted-foreground">{date(lead.follow_up)}</span></span><span><strong className="font-medium">Rough value:</strong> <span className="text-muted-foreground">{money(lead.estimated_value)}</span></span></div>
        <div className="mt-5 flex flex-wrap gap-2">
          {latestEstimate?<Link href={`/opportunities?lead=${lead.id}&estimate=${latestEstimate.id}&tab=worksheet`} className={primaryAction}>Continue estimate <ArrowRight/></Link>:!isClosed?<form action={convertLeadToEstimate}><input type="hidden" name="lead_id" value={lead.id}/><Button type="submit" className={primaryAction}>Start estimate <ArrowRight/></Button></form>:null}
          {latestProposal?<Link href={`/opportunities?lead=${lead.id}&estimate=${latestProposal.estimate_id}&tab=proposal`} className={secondaryAction}>Open proposal</Link>:null}
          {latestEstimate?.project_id?<Link href={`/projects/${latestEstimate.project_id}`} className={secondaryAction}>Open awarded project</Link>:null}
        </div>
      </header>

      <section aria-label="Opportunity follow-up" className="grid grid-cols-1 gap-6 rounded-xl border border-[#D4DBD7] bg-white p-4 dark:border-[#343A3F] dark:bg-[#181A1B] lg:grid-cols-3">
        <form action={updateLeadStatus} className="grid min-w-0 grid-rows-[auto_1fr_auto] gap-2"><input type="hidden" name="id" value={lead.id}/><Label htmlFor={`scope-stage-${lead.id}`} className={labelClass}>Pipeline stage</Label><div><Select name="status" defaultValue={lead.status||'new'}><SelectTrigger id={`scope-stage-${lead.id}`} className={inputClass}><SelectValue/></SelectTrigger><SelectContent><SelectItem value="new">New lead</SelectItem><SelectItem value="reviewing">Reviewing</SelectItem><SelectItem value="estimating">Estimating</SelectItem><SelectItem value="proposal_sent">Proposal sent</SelectItem><SelectItem value="follow_up">Follow up</SelectItem><SelectItem value="won">Won</SelectItem><SelectItem value="lost">Lost</SelectItem></SelectContent></Select></div><Button type="submit" className={`${secondaryAction} justify-self-end`}>Save</Button></form>
        <form action={setLeadFollowUp} className="grid min-w-0 grid-rows-[auto_1fr_auto] gap-2"><input type="hidden" name="id" value={lead.id}/><Label htmlFor={`scope-follow-${lead.id}`} className={labelClass}>Next follow up</Label><div><Input id={`scope-follow-${lead.id}`} name="follow_up" type="date" defaultValue={lead.follow_up||''} className={inputClass}/></div><Button type="submit" className={`${secondaryAction} justify-self-end`}>Save</Button></form>
        <form action={addLeadActivity} className="grid min-w-0 grid-rows-[auto_1fr_auto] gap-2"><input type="hidden" name="lead_id" value={lead.id}/><Label htmlFor={`scope-note-${lead.id}`} className={labelClass}>Record activity</Label><div className="grid gap-2"><Select name="activity_type" defaultValue="note"><SelectTrigger aria-label="Activity type" className={inputClass}><SelectValue/></SelectTrigger><SelectContent><SelectItem value="note">Note</SelectItem><SelectItem value="call">Call</SelectItem><SelectItem value="email">Email</SelectItem><SelectItem value="meeting">Meeting</SelectItem><SelectItem value="proposal">Proposal</SelectItem></SelectContent></Select><Textarea id={`scope-note-${lead.id}`} name="note" rows={2} placeholder="Activity notes" className={`${inputClass} h-auto min-h-16 resize-y`}/></div><Button type="submit" className={`${secondaryAction} justify-self-end`}>Save</Button></form>
      </section>

      <OpportunitySectionNav/>

      <section id="scope" className={masterSection}><h2 className={`${groundedHeader} text-base font-semibold tracking-tight text-[#171B19] dark:text-white`}>Scope and contact</h2><p className="mt-3 max-w-3xl whitespace-pre-wrap text-sm leading-6">{lead.scope||'Concrete scope has not been entered yet.'}</p><dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">Contact</dt><dd className="mt-1">{lead.contact_name||lead.customer_name||'Not entered'}</dd></div><div><dt className="text-muted-foreground">Email / phone</dt><dd className="mt-1 break-words">{[lead.email,lead.phone].filter(Boolean).join(' · ')||'Not entered'}</dd></div></dl>{lead.notes?<p className="mt-5 max-w-3xl border-t border-border pt-4 text-sm leading-relaxed text-[#525C57] dark:text-[#8B949E]">{lead.notes}</p>:null}</section>

      <section id="plans" className={masterSection}><div className={`${groundedHeader} flex flex-wrap items-start justify-between gap-3`}><div><h2 className="text-base font-semibold tracking-tight text-[#171B19] dark:text-white">Plans &amp; Takeoff</h2><p className="mt-1 text-sm leading-relaxed text-[#525C57] dark:text-[#8B949E]">Plan sets attached to this opportunity’s estimate revisions.</p></div><Link href="/takeoff" className={secondaryAction}><Ruler/>Takeoff queue</Link></div>{takeoffResult.error?<p role="status" className="mt-4 text-sm leading-relaxed text-[#525C57] dark:text-[#8B949E]">Plan sets are unavailable right now. Open the Takeoff queue to try again.</p>:sets.length?<div className="mt-4 divide-y divide-[#D4DBD7] border-y border-[#D4DBD7] dark:divide-[#343A3F] dark:border-[#343A3F]">{sets.map(set=><div key={set.id} className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-[#EFF2F0] dark:hover:bg-[#181A1B]"><div><strong className="text-sm text-[#171B19] dark:text-[#E1E7E3]">{set.source_filename||set.name||'Plan set'}</strong><p className="mt-1 text-xs font-mono uppercase tracking-wider text-[#7B8580] dark:text-[#525B62]">{set.revision_label||'Revision not labeled'} · {estimates.find(item=>item.id===set.estimate_id)?.estimate_number||'Estimate'}</p></div><Link href={`/opportunities?lead=${lead.id}&estimate=${set.estimate_id}&takeoff=${set.id}&tab=takeoff`} className={secondaryAction}>Open takeoff</Link></div>)}</div>:<p className="mt-4 text-sm leading-relaxed text-[#525C57] dark:text-[#8B949E]">No plan takeoff is linked yet. Start from an estimate in the Takeoff queue.</p>}</section>

      <section id="estimates" className={masterSection}><h2 className={`${groundedHeader} text-base font-semibold tracking-tight text-[#171B19] dark:text-white`}>Estimates</h2>{estimateResult.error?<p role="status" className="mt-4 text-sm leading-relaxed text-[#525C57] dark:text-[#8B949E]">Estimate revisions are unavailable right now. Open the Estimates queue to try again.</p>:estimates.length?<div className="mt-4 divide-y divide-[#D4DBD7] border-y border-[#D4DBD7] dark:divide-[#343A3F] dark:border-[#343A3F]">{estimates.map(estimate=><div key={estimate.id} className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-[#EFF2F0] dark:hover:bg-[#181A1B]"><div><strong className="text-sm text-[#171B19] dark:text-[#E1E7E3]">{estimate.estimate_number}-R{estimate.version??0}</strong><p className="mt-1 text-xs font-mono uppercase tracking-wider text-[#7B8580] dark:text-[#525B62]">{estimate.status||'Status unavailable'} · Updated {date(estimate.updated_at)}</p></div><Link href={estimateHref(estimate.id)} className={secondaryAction}>Open revision</Link></div>)}</div>:<p className="mt-4 text-sm leading-relaxed text-[#525C57] dark:text-[#8B949E]">No estimate has been started for this opportunity.</p>}</section>

      <section id="proposals" className={masterSection}><h2 className={`${groundedHeader} text-base font-semibold tracking-tight text-[#171B19] dark:text-white`}>Proposals</h2>{proposalResult.error?<p role="status" className="mt-4 text-sm leading-relaxed text-[#525C57] dark:text-[#8B949E]">Proposal states are unavailable right now. Open the Proposals queue to try again.</p>:proposals.length?<div className="mt-4 divide-y divide-[#D4DBD7] border-y border-[#D4DBD7] dark:divide-[#343A3F] dark:border-[#343A3F]">{proposals.map(proposal=><div key={proposal.estimate_id} className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-[#EFF2F0] dark:hover:bg-[#181A1B]"><div><strong className="text-sm text-[#171B19] dark:text-[#E1E7E3]">{proposal.proposal_number||'Proposal'}</strong><p className="mt-1 text-xs font-mono uppercase tracking-wider text-[#7B8580] dark:text-[#525B62]">{proposal.conversion_stage?.replaceAll('_',' ')||'State unavailable'}{proposal.follow_up_due?` · Follow up ${date(proposal.follow_up_due)}`:''}</p>{proposal.next_action?<p className="mt-1 text-sm">{proposal.next_action}</p>:null}</div><Link href={estimateHref(proposal.estimate_id,'proposal')} className={secondaryAction}>Open proposal</Link></div>)}</div>:<p className="mt-4 text-sm leading-relaxed text-[#525C57] dark:text-[#8B949E]">No issued proposal is linked to this opportunity. Proposal preparation stays with an estimate revision.</p>}</section>

      <section id="activity" className={masterSection}><div className={`${groundedHeader} flex flex-wrap items-start justify-between gap-3`}><div><h2 className="text-base font-semibold tracking-tight text-[#171B19] dark:text-white">Activity</h2><p className="mt-1 text-sm leading-relaxed text-[#525C57] dark:text-[#8B949E]">Calls, messages, and decisions recorded for this opportunity.</p></div></div>{activityResult.error?<p role="status" className="mt-4 text-sm leading-relaxed text-[#525C57] dark:text-[#8B949E]">Activity is unavailable right now. Try again from Opportunities.</p>:activities.length?<ol className="mt-4 divide-y divide-[#D4DBD7] border-y border-[#D4DBD7] dark:divide-[#343A3F] dark:border-[#343A3F]">{activities.map(item=><li key={item.id} className="flex gap-3 py-3"><CalendarDays className="mt-0.5 size-4 shrink-0 text-muted-foreground"/><div><div className="text-sm font-medium text-[#171B19] dark:text-[#E1E7E3]">{String(item.activity_type||'Activity').replaceAll('_',' ')}</div><div className="mt-1 text-xs font-mono uppercase tracking-wider text-[#7B8580] dark:text-[#525B62]">{date(item.activity_date||item.created_at)}</div>{item.note?<p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm leading-6">{item.note}</p>:null}</div></li>)}</ol>:<p className="mt-4 text-sm leading-relaxed text-[#525C57] dark:text-[#8B949E]">No activity has been recorded yet.</p>}</section>
    </div>
  </>;
}
