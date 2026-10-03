import {headers} from 'next/headers';
import {estimateHref,opportunityHref} from '../opportunityHref';
import {notFound,redirect} from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftRegular as ArrowLeft, ArrowRightRegular as ArrowRight, CheckmarkRegular as Check, CheckmarkCircleRegular as CheckCircle2, ClockRegular as Clock3, OpenRegular as ExternalLink, DocumentTextRegular as FileText, MailRegular as Mail, ChatRegular as MessageSquareText, SendRegular as Send } from '@fluentui/react-icons';
import {Accordion,AccordionHeader,AccordionItem,AccordionPanel,Badge,Button,Card,CardHeader,Checkbox,Input,Label,Select,Textarea} from '@fluentui/react-components';
import viewStyles from './opportunity-view.module.css';
import {createClient} from '@/lib/supabase/server';
import {parseEstimateReleaseReadiness} from '@/lib/estimating/releaseReadiness';
import {addProposalClarification,awardProposalAndCreateProject,createNextProposalRevision,createProposalCustomer,createProposalLink,deleteProposalClarification,linkProposalCustomer,markProposalResponseHandled,recordProposalFollowUp,revokeProposalLink,saveProposalSettings,toggleValueOptionPresented} from '@/app/proposals/actions';

const money=(n:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n||0));
const dt=(v:any)=>v?new Date(v).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'—';
const day=(v:any)=>v?new Date(`${String(v).slice(0,10)}T12:00:00`).toLocaleDateString('en-US',{month:'short',day:'numeric'}):'—';
const audienceLabel=(v:string)=>v==='homeowner'?'Homeowner':v==='commercial_owner'?'Commercial Owner':'General Contractor';
const stageLabel=(v:string)=>({sent:'Sent · Not Viewed',viewed:'Viewed',needs_reply:'Needs Reply',accepted:'Accepted',declined:'Declined',expired:'Expired',revoked:'Link Off',superseded:'Superseded'} as any)[v]||v;
const secondaryAction='inline-flex items-center justify-center bg-secondary border border-input text-secondary-foreground text-xs font-medium px-4 py-2 rounded-lg hover:border-[var(--border-strong)] hover:bg-accent shadow-sm transition-all whitespace-nowrap';
const primaryAction='carez-button-primary text-sm font-medium px-5 py-2.5 rounded-lg border transition-all';
const destructiveAction='inline-flex bg-[var(--status-error-bg)] border border-destructive/40 text-[var(--status-error-fg)] text-xs font-medium px-3 py-1.5 rounded-lg hover:border-destructive hover:bg-destructive/15 transition-all';
const masterSection='mb-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm';
const groundedHeader='bg-muted px-4 py-3 border-b border-border';
const checkboxClass='size-4 rounded border-input accent-primary';

export async function ProposalView({estimateId}:{estimateId:string}){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();if(!profile?.company_id)redirect('/login');if(profile.role==='employee')redirect('/employee');
  const companyId=profile.company_id;
  const [{data:e},{data:summary},{data:q},{data:settings},{data:clarifications},{data:options},{data:eLead},{data:project},{data:items},{data:events},{data:billing},{data:customers},{data:company}]=await Promise.all([
    supabase.from('estimates').select('*').eq('id',estimateId).eq('company_id',companyId).maybeSingle(),
    supabase.from('estimate_financial_summary').select('*').eq('estimate_id',estimateId).eq('company_id',companyId).maybeSingle(),
    supabase.from('proposal_conversion_queue').select('*').eq('estimate_id',estimateId).eq('company_id',companyId).maybeSingle(),
    supabase.from('proposal_settings').select('*').eq('estimate_id',estimateId).eq('company_id',companyId).maybeSingle(),
    supabase.from('proposal_clarifications').select('*').eq('estimate_id',estimateId).eq('company_id',companyId).order('sort_order'),
    supabase.from('bid_value_options').select('id,estimate_id,name,customer_description,sell_price_change,schedule_days_change,status,function_quality_note,approval_required').eq('estimate_id',estimateId).eq('company_id',companyId).order('created_at'),
    supabase.from('leads').select('id,opportunity_number,customer_id,customer_name,contact_name,email,phone,project_name,address,city,state,postal_code,scope,follow_up,status').eq('id',(await supabase.from('estimates').select('lead_id').eq('id',estimateId).single()).data?.lead_id||'00000000-0000-0000-0000-000000000000').eq('company_id',companyId).maybeSingle(),
    supabase.from('projects').select('id,job_number,name,address,city,state').eq('id',(await supabase.from('estimates').select('project_id').eq('id',estimateId).single()).data?.project_id||'00000000-0000-0000-0000-000000000000').eq('company_id',companyId).maybeSingle(),
    supabase.from('estimate_items').select('id,section_id,description,quantity,unit,item_type').eq('estimate_id',estimateId).eq('company_id',companyId).order('sort_order'),
    qPromise(supabase,companyId,estimateId),
    supabase.from('company_billing_profiles').select('default_terms_text').eq('company_id',companyId).maybeSingle(),
    supabase.from('customers').select('id,name,email,phone,contact_name').eq('company_id',companyId).eq('active',true).or('email.not.is.null,phone.not.is.null').order('name'),
    supabase.from('companies').select('name').eq('id',companyId).single(),
  ]);
  if(!e)notFound();
  const {data:releaseData,error:releaseError}=await supabase.rpc('carez_get_estimate_release_readiness',{p_estimate_id:estimateId});
  if(releaseError)throw new Error(releaseError.message);
  const release=parseEstimateReleaseReadiness(releaseData);

  const lead:any=eLead?{...eLead}:null;
  const customerLink=lead?.customer_id?(await supabase.from('customers').select('id,name,email,phone,contact_name').eq('id',lead.customer_id).eq('company_id',companyId).maybeSingle()).data:null;
  if(lead)lead.customer=customerLink;

  const queue=q||null;
  const [awardHoldResult,{data:awardRecord}]=queue?.presentation_id?await Promise.all([
    supabase.rpc('carez_get_proposal_award_hold',{p_proposal_revision_id:queue.presentation_id}),
    supabase.from('award_decisions').select('id,project_id').eq('proposal_revision_id',queue.presentation_id).eq('company_id',companyId).maybeSingle(),
  ]):[{data:null,error:null},{data:null}];
  const awardHold=awardHoldResult.error?.message||awardHoldResult.data||null;
  const responseEvents=events||[];
  const sell=Number(queue?.base_sell_price||summary?.selected_sell_price||summary?.recommended_sell_price||0);
  const issued=Boolean(queue);
  const locked=issued||['accepted','approved','superseded'].includes(e.status);
  const proposalDisplay=queue?.proposal_number||`P-${e.opportunity_number||String(e.estimate_number||'').replace(/^E-/,'')}-R${Number(e.version||0)}`;
  const ps=settings||{};
  const terms=ps.terms_text||billing?.default_terms_text||'';
  const contactReady=Boolean(lead?.customer?.email||lead?.customer?.phone);
  const canIssue=release.release_state==='release_ready'&&!locked;
  const setupRows=[
    {ok:e.status==='ready',label:'Estimate workflow',detail:e.status==='ready'?'Ready for Review':String(e.status).replaceAll('_',' ')},
    {ok:sell>0,label:'Customer price',detail:money(sell)},
    {ok:(items||[]).length>0,label:'Customer scope',detail:`${(items||[]).length} Estimate item(s)`},
    {ok:contactReady,label:'Customer contact',detail:contactReady?'Available':'Not available'},
    {ok:Boolean(terms),label:'Terms',detail:terms?'Available':'Not entered'},
    {ok:Boolean(ps.schedule_summary),label:'Schedule',detail:ps.schedule_summary||'Not entered'},
    {ok:Boolean(ps.payment_summary),label:'Payment',detail:ps.payment_summary||'Not entered'},
    {ok:(clarifications||[]).length>0,label:'Clarifications',detail:`${(clarifications||[]).length} recorded`},
  ];
  const h=await headers();
  const host=h.get('x-forwarded-host')||h.get('host')||'';
  const proto=h.get('x-forwarded-proto')||'https';
  const origin=host?`${proto}://${host}`:'';
  const link=queue&&origin?`${origin}/proposal/${queue.token}`:'';
  const preview=link?`${link}?preview=1`:'';
  const mailtoAddress=lead?.customer?.email||queue?.customer_email;
  const mailtoName=lead?.customer?.contact_name||lead?.customer?.name||queue?.contact_name||queue?.customer_name||'';
  const mailto=mailtoAddress?`mailto:${mailtoAddress}?subject=${encodeURIComponent(`Follow-up: ${proposalDisplay} — ${e.name}`)}&body=${encodeURIComponent(`Hi ${mailtoName},\n\nI wanted to follow up on ${proposalDisplay} for ${queue?.project_name||e.name}. Please let me know if you have any questions or if there is anything you would like us to clarify or revise.\n\nThank you,\n${company?.name||'Your contractor'}`)}`:'';
  const customer=lead?.customer?.name||lead?.customer_name||queue?.customer_name||'Customer';
  const contactName=lead?.customer?.contact_name||lead?.contact_name;
  const contactEmail=lead?.customer?.email||lead?.email;
  const proposalCustomers=(customers||[]).filter((candidate:any)=>String(candidate.email||'').trim()||String(candidate.phone||'').trim());
  const job=lead?.project_name||project?.name||e.name;
  const viewed=issued&&Number(queue.view_count||0)>0;
  const stage=issued?stageLabel(queue.conversion_stage):'Prep';

  return <div className={`${viewStyles.workspace} flex w-full min-w-0 flex-col gap-6`}>
    <header className="carez-page-heading flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div><p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{lead&&<><Link className={secondaryAction} href={opportunityHref(lead.id)}>Opportunity {lead.opportunity_number}</Link><span aria-hidden="true"> · </span></>}{proposalDisplay} · {String(stage).toUpperCase()}</p><h1 className="mt-1 text-base font-semibold tracking-tight text-foreground">{customer}</h1><p className="mt-1 max-w-4xl text-sm leading-relaxed text-muted-foreground">{job}{contactName?` · ${contactName}`:""}{contactEmail?` · ${contactEmail}`:""}</p></div>
      <div className="flex flex-wrap gap-2"><Link className={secondaryAction} href="/opportunities"><ArrowLeft/>Proposals</Link><Link className={secondaryAction} href={estimateHref(e.id)}><FileText/>Estimate</Link></div>
    </header>

    <nav className="mb-6 flex w-full items-center gap-2 overflow-x-auto border-b border-border pb-4" aria-label="Estimate workflow">
      {['Takeoff','Estimate','Review','Proposal'].map((label,index)=><div key={label} aria-current={index===3?'step':undefined} className={`${index===3?'bg-[var(--selection-fill)] border-[var(--selection-border)] text-[var(--selection-text)] font-semibold shadow-[inset_0_1px_var(--selection-highlight)]':'bg-card border-border text-muted-foreground font-medium'} flex items-center gap-2 whitespace-nowrap rounded-lg border px-4 py-1.5 text-sm`}><span className="text-xs font-mono uppercase tracking-wider">{index+1}</span><span>{label}</span>{index<3?<ArrowRight className="size-3 opacity-50"/>:null}</div>)}
    </nav>

    <section className={`${masterSection} carez-summary-ledger grid grid-cols-2 gap-px p-4 lg:grid-cols-4`}>
      <MetricCard label="Customer Price" value={money(sell)} help="Immutable once this revision is issued." tone="primary"/>
      <MetricCard label="Views" value={issued?String(Number(queue.view_count||0)):'—'} help={issued&&queue.last_viewed_at?`Last viewed ${dt(queue.last_viewed_at)}`:'Customer engagement after issue.'} tone={viewed?'success':'default'}/>
      <MetricCard label="Needs Reply" value={String(responseEvents.length)} help="Unanswered customer responses." tone={responseEvents.length?'warning':'default'}/>
      <MetricCard label="Follow-up" value={issued&&queue.follow_up_due?day(queue.follow_up_due):'—'} help={issued?queue.next_action:'Set automatically when issued.'} tone={issued&&queue.follow_up_due_now?'warning':'default'}/>
    </section>

    {!issued?<ProposalPreparation e={e} sell={sell} ps={ps} terms={terms} release={release} canIssue={canIssue} setupRows={setupRows} clarifications={clarifications||[]} options={options||[]} lead={lead} customers={proposalCustomers} locked={locked}/>:<IssuedProposal e={e} queue={queue} responseEvents={responseEvents} preview={preview} link={link} mailto={mailto} lead={lead} project={project} awardHold={awardHold||null} awardRecord={awardRecord||null}/>}

    {awardRecord&&project&&<Card className="border-success/30 bg-success/5 shadow-none"><div className="p-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-medium uppercase tracking-wide text-success">Awarded</p><h2 className="mt-1 font-semibold">Exact Proposal revision is awarded</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">The internal Award Decision, Accepted Scope Snapshot and original commercial baseline are frozen.</p></div><Link className={secondaryAction} href={`/projects/${project.id}`}><CheckCircle2/>Open Project</Link></div></Card>}
  </div>;
}

function MetricCard({label,value,help,tone='default'}:{label:string;value:string;help:string;tone?:'default'|'primary'|'success'|'warning'}){
  const toneClass=tone==='primary'?'border-primary/25 bg-primary/5':tone==='success'?'border-success/30 bg-success/5':tone==='warning'?'border-warning/30 bg-warning/5':'';
  const valueClass=tone==='success'?'text-success':tone==='warning'?'text-warning':'';
  return <Card className={`${masterSection} ${toneClass}`}><div className="p-4 space-y-1"><div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{label}</div><div className={`text-2xl font-semibold tabular-nums text-foreground ${valueClass}`}>{value}</div><div className="text-sm leading-relaxed text-muted-foreground">{help}</div></div></Card>;
}

async function qPromise(supabase:any,companyId:string,estimateId:string){
  const {data:q}=await supabase.from('proposal_conversion_queue').select('presentation_id').eq('estimate_id',estimateId).eq('company_id',companyId).maybeSingle();
  if(!q?.presentation_id)return {data:[]};
  return supabase.from('proposal_engagement_events').select('id,presentation_id,event_type,customer_name,customer_email,customer_message,decline_reason,option_id,created_at,handled_at').eq('company_id',companyId).eq('presentation_id',q.presentation_id).is('handled_at',null).neq('event_type','view').order('created_at',{ascending:false});
}

function ProposalPreparation({e,sell,ps,terms,release,canIssue,setupRows,clarifications,options,lead,customers,locked}:{e:any;sell:number;ps:any;terms:string;release:{release_state:string};canIssue:boolean;setupRows:{ok:boolean;label:string;detail:string}[];clarifications:any[];options:any[];lead:any;customers:any[];locked:boolean}){
  return <>
    <Card className={masterSection}><CardHeader className={groundedHeader}><h3 className="text-base font-semibold tracking-tight text-foreground">Customer destination</h3><p className="text-sm leading-relaxed text-muted-foreground">Link this Estimate to the Customer who will receive the Proposal.</p></CardHeader><div className="p-4 grid gap-5 md:grid-cols-2">
      {lead?.customer_id?<div className="rounded-md border p-3"><p className="text-sm font-medium">{lead.customer?.name||'Linked Customer'}</p><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{lead.customer?.email||lead.customer?.phone||'Add an email or phone before issuing.'}</p></div>:<p className="text-sm leading-relaxed text-muted-foreground">No Customer is linked to this Estimate yet.</p>}
      {!locked&&<>{customers.length>0&&<form action={linkProposalCustomer} className="grid gap-2"><input type="hidden" name="estimate_id" value={e.id}/><Label htmlFor={`customer-destination-${e.id}`}>Existing Customer</Label><div className="flex gap-2"><Select appearance="outline" className="w-full" name="customer_id" required defaultValue=""><option value="" disabled>Choose Customer</option>{customers.map((customer:any)=><option key={customer.id} value={customer.id}>{customer.name}{customer.email?` · ${customer.email}`:customer.phone?` · ${customer.phone}`:''}</option>)}</Select><Button type="submit" appearance="outline">Link</Button></div></form>}
      <form action={createProposalCustomer} className="grid gap-3 md:col-span-2"><input type="hidden" name="estimate_id" value={e.id}/><p className="text-sm font-medium">Create Customer</p><div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor={`new-customer-name-${e.id}`}>Name</Label><Input appearance="underline" className="w-full" id={`new-customer-name-${e.id}`} name="name" required/></div><div className="grid gap-2"><Label htmlFor={`new-customer-contact-${e.id}`}>Contact name</Label><Input appearance="underline" className="w-full" id={`new-customer-contact-${e.id}`} name="contact_name"/></div><div className="grid gap-2"><Label htmlFor={`new-customer-email-${e.id}`}>Email</Label><Input appearance="underline" className="w-full" id={`new-customer-email-${e.id}`} name="email" type="email"/></div><div className="grid gap-2"><Label htmlFor={`new-customer-phone-${e.id}`}>Phone</Label><Input appearance="underline" className="w-full" id={`new-customer-phone-${e.id}`} name="phone" type="tel"/></div></div><p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">This Customer becomes the Proposal destination. Enter an email or phone number for delivery.</p><Button type="submit" appearance="outline" className="w-fit">Create and link Customer</Button></form></>}
    </div></Card>
    <section className="grid gap-4 xl:grid-cols-2">
      <Card className={masterSection}><CardHeader className={groundedHeader}><h3 className="text-base font-semibold tracking-tight text-foreground">Proposal setup</h3><p className="text-sm leading-relaxed text-muted-foreground">Setup details help complete the customer offer. Release readiness is evaluated by Estimate Review.</p></CardHeader><div className="p-4 space-y-4"><div className="divide-y divide-border border-y border-border">{setupRows.map((item,index)=><div key={index} className="flex items-center gap-3 px-3 py-3"><span className={`flex size-7 shrink-0 items-center justify-center rounded-full ${item.ok?'bg-success/10 text-success':'bg-warning/10 text-warning'}`}>{item.ok?<Check className="size-4"/>:<Clock3 className="size-4"/>}</span><span><strong className="text-sm font-medium">{item.label}</strong><span className="ml-2 text-sm leading-relaxed text-muted-foreground">{item.detail}</span></span></div>)}</div><div className="flex items-center justify-between border-t border-border pt-3 text-sm"><span className="text-muted-foreground">Estimate release state</span><strong>{release.release_state.replaceAll('_',' ').toUpperCase()}</strong></div></div></Card>

      <Card className={masterSection}><CardHeader className={groundedHeader}><h3 className="text-base font-semibold tracking-tight text-foreground">Customer Offer</h3><p className="text-sm leading-relaxed text-muted-foreground">Customer-facing wording only. Internal cost, labor burden and margin never appear here.</p></CardHeader><div className="p-4"><form action={saveProposalSettings} className="grid gap-4"><input type="hidden" name="estimate_id" value={e.id}/>
        <div className="grid gap-2"><Label htmlFor={`audience-${e.id}`}>Customer type</Label><Select appearance="outline" className="w-full" name="audience_type" defaultValue={ps.audience_type||'general_contractor'}><option value="general_contractor">General Contractor</option><option value="homeowner">Homeowner</option><option value="commercial_owner">Commercial Owner</option></Select></div>
        <div className="grid gap-2"><Label htmlFor={`summary-${e.id}`}>Opening / scope summary</Label><Textarea appearance="outline" className="w-full" id={`summary-${e.id}`} name="executive_summary" rows={4} defaultValue={ps.executive_summary||''} placeholder="Concrete scope summarized in customer language…"/></div>
        <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor={`schedule-${e.id}`}>Schedule</Label><Input appearance="underline" className="w-full" id={`schedule-${e.id}`} name="schedule_summary" defaultValue={ps.schedule_summary||''} placeholder="Schedule / duration / coordination"/></div><div className="grid gap-2"><Label htmlFor={`payment-${e.id}`}>Payment</Label><Input appearance="underline" className="w-full" id={`payment-${e.id}`} name="payment_summary" defaultValue={ps.payment_summary||''} placeholder="Deposit / progress / final payment"/></div></div>
        <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor={`validity-${e.id}`}>Valid for (days)</Label><Input appearance="underline" className="w-full" id={`validity-${e.id}`} name="validity_days" type="number" min="1" max="90" defaultValue={String(Number(ps.validity_days||30))}/></div><label className="flex items-center gap-2 self-end pb-2 text-sm leading-relaxed text-muted-foreground"><Checkbox className={checkboxClass} name="show_quantities" defaultChecked={ps.show_quantities!==false}/>Show customer-facing quantities where appropriate</label></div>
        <Accordion collapsible><AccordionItem value="content" className="rounded-lg border border-border"><AccordionHeader className="cursor-pointer list-none px-3 py-3 text-sm font-medium">Warranty, positioning & terms</AccordionHeader><AccordionPanel collapseMotion={{unmountOnExit:false} as any} className="inert:hidden"><div className="grid gap-4 border-t border-border p-3"><div className="grid gap-2"><Label htmlFor={`message-${e.id}`}>Customer message</Label><Textarea appearance="outline" className="w-full" id={`message-${e.id}`} name="customer_message" rows={3} defaultValue={ps.customer_message||''}/></div><div className="grid gap-2"><Label htmlFor={`warranty-${e.id}`}>Warranty</Label><Textarea appearance="outline" className="w-full" id={`warranty-${e.id}`} name="warranty_summary" rows={3} defaultValue={ps.warranty_summary||''}/></div><div className="grid gap-2"><Label htmlFor={`why-${e.id}`}>Why Carez</Label><Textarea appearance="outline" className="w-full" id={`why-${e.id}`} name="why_carez" rows={3} defaultValue={ps.why_carez||''}/></div><div className="grid gap-2"><Label htmlFor={`pricing-note-${e.id}`}>Pricing note</Label><Textarea appearance="outline" className="w-full" id={`pricing-note-${e.id}`} name="pricing_note" rows={3} defaultValue={ps.pricing_note||''}/></div><div className="grid gap-2"><Label htmlFor={`terms-${e.id}`}>Terms</Label><Textarea appearance="outline" className="w-full" id={`terms-${e.id}`} name="terms_text" rows={7} defaultValue={terms}/></div></div></AccordionPanel></AccordionItem></Accordion>
        <Button type="submit" appearance="outline" className="w-fit">Save Customer Offer</Button>
      </form></div></Card>
    </section>

    <section className="grid gap-4 xl:grid-cols-2">
      <Card className={masterSection}><CardHeader className={groundedHeader}><h3 className="text-base font-semibold tracking-tight text-foreground">Inclusions / Exclusions</h3><p className="text-sm leading-relaxed text-muted-foreground">Short clarifiers prevent scope arguments without bloating the proposal.</p></CardHeader><div className="p-4 space-y-4">
        {clarifications.length?<div className="divide-y divide-border border-y border-border">{clarifications.map((c:any)=><div key={c.id} className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-accent sm:flex-row"><div><Badge appearance="outline">{String(c.category).replaceAll('_',' ')}</Badge><div className="mt-2 text-sm font-medium">{c.clarification_text}</div></div><form action={deleteProposalClarification}><input type="hidden" name="clarification_id" value={c.id}/><input type="hidden" name="estimate_id" value={e.id}/><Button type="submit" className={destructiveAction}>Delete</Button></form></div>)}</div>:<p className="text-sm leading-relaxed text-muted-foreground">No proposal clarifiers yet.</p>}
        <Accordion collapsible><AccordionItem value="content" className="rounded-lg border border-border"><AccordionHeader className="cursor-pointer list-none px-3 py-3 text-sm font-medium">Add Clarifier</AccordionHeader><AccordionPanel collapseMotion={{unmountOnExit:false} as any} className="inert:hidden"><div className="border-t border-border p-3"><form action={addProposalClarification} className="grid gap-4"><input type="hidden" name="estimate_id" value={e.id}/><div className="grid gap-2"><Label htmlFor={`clarifier-type-${e.id}`}>Type</Label><Select appearance="outline" className="w-full" name="category" defaultValue="inclusion"><option value="inclusion">Inclusion</option><option value="exclusion">Exclusion</option><option value="assumption">Assumption</option><option value="allowance">Allowance</option><option value="qualification">Qualification</option></Select></div><div className="grid gap-2"><Label htmlFor={`clarifier-text-${e.id}`}>Customer wording</Label><Textarea appearance="outline" className="w-full" id={`clarifier-text-${e.id}`} name="clarification_text" required rows={3} placeholder="Example: Excavation and export by others."/></div><Button type="submit" appearance="outline" className="w-fit">Add Clarifier</Button></form></div></AccordionPanel></AccordionItem></Accordion>
      </div></Card>

      <Card className={masterSection}><CardHeader className={groundedHeader}><h3 className="text-base font-semibold tracking-tight text-foreground">Options / Value Engineering</h3><p className="text-sm leading-relaxed text-muted-foreground">Choose which approved alternates are actually visible to the customer.</p></CardHeader><div className="p-4">{options.length?<div className="divide-y divide-border border-y border-border">{options.map((option:any)=><div key={option.id} className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-accent sm:flex-row"><div><div className="font-medium">{option.name}</div><div className="mt-1 text-xs font-mono uppercase tracking-wider text-muted-foreground">{option.customer_description||option.function_quality_note||'Alternate option'} · {Number(option.sell_price_change||0)>=0?'+':''}{money(option.sell_price_change)}</div></div><form action={toggleValueOptionPresented}><input type="hidden" name="estimate_id" value={e.id}/><input type="hidden" name="option_id" value={option.id}/><input type="hidden" name="target_status" value={option.status==='presented'?'suggested':'presented'}/><Button type="submit" size="small" appearance={option.status==='presented'?'outline':'subtle'}>{option.status==='presented'?'Shown':'Hidden'}</Button></form></div>)}</div>:<p className="text-sm leading-relaxed text-muted-foreground">No value-engineering options are attached to this estimate.</p>}</div></Card>
    </section>

    <Card className={canIssue?'border-success/30 bg-success/5 shadow-none':'border-warning/30 bg-warning/5 shadow-none'}><div className="p-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Issue customer revision</p><h2 className="mt-1 font-semibold">{canIssue?'Ready to create the customer link':'Complete Estimate Review before issuing'}</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">Issuing creates an immutable snapshot of this exact estimate, scope, customer wording, clarifications and options.</p></div><form action={createProposalLink}><input type="hidden" name="estimate_id" value={e.id}/><Button type="submit" disabled={!canIssue} className={primaryAction}><Send/>Issue {money(sell)} Proposal</Button></form></div></Card>
  </>;
}

function IssuedProposal({e,queue,responseEvents,preview,link,mailto,lead,project,awardHold,awardRecord}:{e:any;queue:any;responseEvents:any[];preview:string;link:string;mailto:string;lead:any;project:any;awardHold:string|null;awardRecord:any}){
  const needsReply=queue.conversion_stage==='needs_reply';
  const accepted=queue.conversion_stage==='accepted';
  return <>
    <Card className={needsReply?'border-warning/30 bg-warning/5 shadow-none':accepted?'border-success/30 bg-success/5 shadow-none':'shadow-none'}><div className="p-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><Badge appearance="outline" className={needsReply?'border-warning/30 bg-warning/10 text-warning':accepted?'border-success/30 bg-success/10 text-success':''}>{stageLabel(queue.conversion_stage)}</Badge><h2 className="mt-2 font-semibold">{queue.next_action}</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">Sent {dt(queue.sent_at)} · {audienceLabel(queue.audience_type)}{queue.first_viewed_at?` · First viewed ${dt(queue.first_viewed_at)}`:' · not opened yet'}</p></div><div className="flex flex-wrap gap-2">{preview&&<a className={secondaryAction} href={preview} target="_blank" rel="noreferrer"><ExternalLink/>Preview</a>}{link&&<a className={secondaryAction} href={link} target="_blank" rel="noreferrer"><ExternalLink/>Customer Link</a>}{mailto&&<a className={secondaryAction} href={mailto}><Mail/>Follow Up</a>}</div></div></Card>

    {responseEvents.length>0&&<section className="space-y-4"><div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Customer response</p><h2 className="mt-1 text-lg font-semibold">Needs your attention</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">Questions and requested changes stay attached to the proposal instead of disappearing into text messages.</p></div><div className="space-y-3">{responseEvents.map((event:any)=><Card key={event.id} className="border-warning/30 shadow-none"><div className="p-4 flex flex-col gap-3 sm:flex-row sm:items-start"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning"><MessageSquareText className="size-4"/></span><div className="min-w-0 flex-1"><div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{String(event.event_type).replaceAll('_',' ')} · {dt(event.created_at)}</div><div className="mt-1 font-medium">{event.customer_name||event.customer_email||'Customer'}</div>{event.customer_message&&<p className="mt-2 text-sm leading-relaxed text-muted-foreground">{event.customer_message}</p>}{event.decline_reason&&<p className="mt-2 text-xs font-mono uppercase tracking-wider text-muted-foreground">Reason: {String(event.decline_reason).replaceAll('_',' ')}</p>}</div><form action={markProposalResponseHandled}><input type="hidden" name="event_id" value={event.id}/><Button type="submit" appearance="outline" size="small">Handled</Button></form></div></Card>)}</div></section>}

    <section className="grid gap-4 xl:grid-cols-2">
      <Card className={masterSection}><CardHeader className={groundedHeader}><h3 className="text-base font-semibold tracking-tight text-foreground">Engagement</h3><p className="text-sm leading-relaxed text-muted-foreground">What the customer has done with this exact revision.</p></CardHeader><div className="p-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[['Sent',dt(queue.sent_at)],['First viewed',dt(queue.first_viewed_at)],['Last viewed',dt(queue.last_viewed_at)],['Total views',String(Number(queue.view_count||0))],['Follow-up due',queue.follow_up_due?day(queue.follow_up_due):'—']].map(([name,value])=><div key={name} className="rounded-lg border border-border bg-muted/20 p-3"><div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{name}</div><div className="mt-1 text-sm font-medium tabular-nums">{value}</div></div>)}</div></div></Card>

      <Card className={masterSection}><CardHeader className={groundedHeader}><h3 className="text-base font-semibold tracking-tight text-foreground">Follow-up</h3><p className="text-sm leading-relaxed text-muted-foreground">Record what happened and schedule the next touch.</p></CardHeader><div className="p-4">{lead?.id?<form action={recordProposalFollowUp} className="grid gap-4"><input type="hidden" name="lead_id" value={lead.id}/><div className="grid gap-2"><Label htmlFor={`followup-note-${e.id}`}>What happened?</Label><Textarea appearance="outline" className="w-full" id={`followup-note-${e.id}`} name="note" required rows={3} placeholder="Spoke with GC — reviewing inclusions with owner…"/></div><div className="grid gap-2"><Label htmlFor={`followup-date-${e.id}`}>Next follow-up</Label><Input appearance="underline" className="w-full" id={`followup-date-${e.id}`} name="next_follow_up" type="date" defaultValue={queue.follow_up_due||lead.follow_up||''}/></div><Button type="submit" className="w-fit">Save Follow-up</Button></form>:<p className="text-sm leading-relaxed text-muted-foreground">This standalone proposal is not linked to a CRM lead.</p>}</div></Card>
    </section>

    <Card className={masterSection}><div className="p-4 flex flex-col gap-4"><div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Internal commercial decision</p><h2 className="mt-1 font-semibold">Award this exact issued revision</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">Award records the full scope as issued and creates its Project and frozen baseline.</p></div>{awardRecord?<div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-success/30 bg-success/5 p-3"><p className="text-sm">This revision is awarded. Its decision, accepted scope and baseline are frozen.</p><Link className={secondaryAction} href={`/projects/${awardRecord.project_id}`}><CheckCircle2/>Open Project</Link></div>:<><div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-sm"><strong>{awardHold?'Award on hold':'Ready for internal award'}</strong>{awardHold&&<p className="mt-1 text-muted-foreground">{awardHold}</p>}</div><div className="flex flex-wrap gap-2"><form action={awardProposalAndCreateProject}><input type="hidden" name="proposal_revision_id" value={queue.presentation_id}/><Button type="submit" disabled={Boolean(awardHold)} className={primaryAction}><CheckCircle2/>Award / Create Project</Button></form><form action={createNextProposalRevision}><input type="hidden" name="proposal_revision_id" value={queue.presentation_id}/><Button type="submit" className={secondaryAction}>Create Next Revision</Button></form>{!queue.revoked_at&&queue.proposal_access_token_id&&<form action={revokeProposalLink}><input type="hidden" name="id" value={queue.proposal_access_token_id}/><Button type="submit" className={destructiveAction}>Turn Customer Link Off</Button></form>}</div></>}</div></Card>

    {queue.conversion_stage==='accepted'&&!awardRecord&&<Card className="border-warning/30 bg-warning/5 shadow-none"><div className="p-4"><Badge appearance="outline">Customer Accepted</Badge><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Customer acceptance is recorded against this issued revision. An authorized internal Award Decision is still required to create the Project.</p></div></Card>}
  </>;
}
