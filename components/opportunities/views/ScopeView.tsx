import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import { ArrowRightRegular as ArrowRight, RulerRegular as Ruler } from '@fluentui/react-icons';
import {Button} from '@fluentui/react-components';
import {createClient} from '@/lib/supabase/server';
import {estimateHref} from '../opportunityHref';
import {convertLeadToEstimate} from '@/app/leads/actions';
import viewStyles from './opportunity-view.module.css';
import {OpportunitySectionNav,type OpportunityDetail} from './OpportunitySectionNav';

type Estimate={id:string;estimate_number:string|null;version:number|null;name:string|null;status:string|null;project_id:string|null;updated_at:string|null};
type TakeoffSet={id:string;estimate_id:string;name:string|null;revision_label:string|null;source_filename:string|null;status:string|null};
type Proposal={estimate_id:string;proposal_number:string|null;conversion_stage:string|null;next_action:string|null;follow_up_due:string|null};

const date=(value:string|null|undefined)=>value?new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(value)):'Not set';
const money=(value:number|null|undefined)=>value==null?'Not entered':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value);
const secondaryAction='inline-flex h-8 items-center justify-center whitespace-nowrap rounded-md border border-border bg-secondary px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring';
const primaryAction='inline-flex h-8 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-border bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3.5';
const masterSection='min-h-0 overflow-auto border border-border bg-card p-4';
const groundedHeader='-mx-4 -mt-4 mb-4 border-b border-border bg-secondary px-4 py-2.5';

export async function ScopeView({id,panel='scope',estimateId}:{id:string;panel?:OpportunityDetail;estimateId?:string|null}){
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

  const estimateResult=await supabase.from('estimates').select('id,estimate_number,version,name,status,project_id,updated_at').eq('lead_id',id).eq('company_id',companyId).order('created_at',{ascending:false});
  const estimates=(estimateResult.data||[]) as Estimate[];
  const estimateIds=estimates.map(item=>item.id);
  const [takeoffResult,proposalResult]=estimateIds.length?await Promise.all([
    supabase.from('takeoff_sets').select('id,estimate_id,name,revision_label,source_filename,status').eq('company_id',companyId).in('estimate_id',estimateIds).order('created_at',{ascending:false}),
    supabase.from('proposal_conversion_queue').select('estimate_id,proposal_number,conversion_stage,next_action,follow_up_due').eq('company_id',companyId).in('estimate_id',estimateIds),
  ]):[{data:[] as TakeoffSet[],error:null},{data:[] as Proposal[],error:null}];
  const sets=(takeoffResult.data||[]) as TakeoffSet[];
  const proposals=(proposalResult.data||[]) as Proposal[];
  const latestEstimate=estimates.find(item=>!['declined','superseded'].includes(item.status||''))||estimates[0]||null;
  const activeEstimate=estimates.find(item=>item.id===estimateId)||latestEstimate;
  const activeProposal=activeEstimate?proposals.find(item=>item.estimate_id===activeEstimate.id)||null:null;
  const isClosed=lead.status==='won'||lead.status==='lost';
  const address=[lead.address,lead.city,lead.state,lead.postal_code].filter(Boolean).join(', ');

  return <div className={viewStyles.workspace+' flex w-full min-w-0 flex-col gap-3'}>
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-2">
      <div className="flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span>{lead.customer_name||'Customer not entered'}{address?' · '+address:''}</span><span>Bid due: {date(lead.bid_due)}</span><span>Follow-up: {date(lead.follow_up)}</span><span>Rough value: {money(lead.estimated_value)}</span></div>
      <div className="flex flex-wrap items-center gap-2">
        {activeEstimate?<Link href={'/opportunities?lead='+lead.id+'&estimate='+activeEstimate.id+'&section=commercial'} className={primaryAction}>Continue estimate <ArrowRight/></Link>:!isClosed?<form action={convertLeadToEstimate}><input type="hidden" name="lead_id" value={lead.id}/><Button type="submit" appearance="primary" className={primaryAction}>Start estimate <ArrowRight/></Button></form>:null}
        {activeProposal?<Link href={'/opportunities?lead='+lead.id+'&estimate='+activeProposal.estimate_id+'&section=proposal'} className={secondaryAction}>Open proposal</Link>:null}
        {activeEstimate?.project_id?<Link href={'/projects/'+activeEstimate.project_id} className={secondaryAction}>Open job</Link>:null}
      </div>
    </header>

    <OpportunitySectionNav active={panel} leadId={id} estimateId={estimateId}/>

    {panel==='scope'?<section aria-labelledby="scope-title" className={masterSection}>
      <h3 id="scope-title" className={groundedHeader+' text-sm font-semibold text-foreground'}>Scope and contact</h3>
      <p className="max-w-3xl whitespace-pre-wrap text-sm leading-6">{lead.scope||'Concrete scope has not been entered yet.'}</p>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">Contact</dt><dd className="mt-1">{lead.contact_name||lead.customer_name||'Not entered'}</dd></div><div><dt className="text-muted-foreground">Email / phone</dt><dd className="mt-1 break-words">{[lead.email,lead.phone].filter(Boolean).join(' · ')||'Not entered'}</dd></div></dl>
      {lead.notes?<p className="mt-4 max-w-3xl border-t border-border pt-3 text-sm text-muted-foreground">{lead.notes}</p>:null}
    </section>:null}

    {panel==='plans'?<section aria-labelledby="plans-title" className={masterSection}>
      <div className={groundedHeader+' flex flex-wrap items-center justify-between gap-2'}><h3 id="plans-title" className="text-sm font-semibold text-foreground">Plans &amp; Takeoff</h3><Link href="/takeoff" className={secondaryAction}><Ruler className="mr-1 size-3.5"/>Takeoff queue</Link></div>
      {takeoffResult.error?<p role="status" className="text-sm text-muted-foreground">Plan sets are unavailable right now. Open the Takeoff queue to try again.</p>:sets.length?<div className="divide-y divide-border border-y border-border">{sets.map(set=><div key={set.id} className="flex flex-wrap items-center justify-between gap-3 px-2 py-3 hover:bg-accent/50"><div className="min-w-0"><strong className="text-sm text-foreground">{set.source_filename||set.name||'Plan set'}</strong><p className="mt-1 text-xs text-muted-foreground">{set.revision_label||'Revision not labeled'} · {estimates.find(item=>item.id===set.estimate_id)?.estimate_number||'Estimate'}</p></div><Link href={'/takeoff/'+set.id} className={secondaryAction}>Open takeoff</Link></div>)}</div>:<p className="text-sm text-muted-foreground">No plan takeoff is linked yet. Start from an estimate in the Takeoff queue.</p>}
    </section>:null}

    {panel==='estimates'?<section aria-labelledby="estimates-title" className={masterSection}>
      <h3 id="estimates-title" className={groundedHeader+' text-sm font-semibold text-foreground'}>Estimate revisions</h3>
      {estimateResult.error?<p role="status" className="text-sm text-muted-foreground">Estimate revisions are unavailable right now. Open the Estimates queue to try again.</p>:estimates.length?<div className="divide-y divide-border border-y border-border">{estimates.map(estimate=><div key={estimate.id} className="flex flex-wrap items-center justify-between gap-3 px-2 py-3 hover:bg-accent/50"><div><strong className="text-sm text-foreground">{estimate.estimate_number}-R{estimate.version??0}</strong><p className="mt-1 text-xs text-muted-foreground">{estimate.status||'Status unavailable'} · Updated {date(estimate.updated_at)}</p></div><Link href={estimateHref(estimate.id)} className={secondaryAction}>Open revision</Link></div>)}</div>:<p className="text-sm text-muted-foreground">No estimate has been started for this opportunity.</p>}
    </section>:null}

    {panel==='proposals'?<section aria-labelledby="proposals-title" className={masterSection}>
      <h3 id="proposals-title" className={groundedHeader+' text-sm font-semibold text-foreground'}>Issued proposals</h3>
      {proposalResult.error?<p role="status" className="text-sm text-muted-foreground">Proposal states are unavailable right now. Open the Proposals queue to try again.</p>:proposals.length?<div className="divide-y divide-border border-y border-border">{proposals.map(proposal=><div key={proposal.estimate_id} className="flex flex-wrap items-center justify-between gap-3 px-2 py-3 hover:bg-accent/50"><div><strong className="text-sm text-foreground">{proposal.proposal_number||'Proposal'}</strong><p className="mt-1 text-xs text-muted-foreground">{proposal.conversion_stage?.replaceAll('_',' ')||'State unavailable'}{proposal.follow_up_due?' · Follow up '+date(proposal.follow_up_due):''}</p>{proposal.next_action?<p className="mt-1 text-sm">{proposal.next_action}</p>:null}</div><Link href={estimateHref(proposal.estimate_id,'proposal')} className={secondaryAction}>Open proposal</Link></div>)}</div>:<p className="text-sm text-muted-foreground">No issued proposal is linked to this opportunity. Proposal preparation stays with an estimate revision.</p>}
    </section>:null}
  </div>;
}
