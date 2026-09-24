import {headers} from 'next/headers';
import {notFound,redirect} from 'next/navigation';
import Link from 'next/link';
import {ArrowLeft,ArrowRight,Check,CheckCircle2,Clock3,ExternalLink,FileText,Mail,MessageSquareText,RefreshCw,Send} from 'lucide-react';
import {AppShell} from '@/components/AppShell';
import {Badge} from '@/components/ui/badge';
import {Button,buttonVariants} from '@/components/ui/button';
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from '@/components/ui/card';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Textarea} from '@/components/ui/textarea';
import {createClient} from '@/lib/supabase/server';
import {parseEstimateReleaseReadiness} from '@/lib/estimating/releaseReadiness';
import {addProposalClarification,createProposalCustomer,createProposalLink,createProposalRevision,deleteProposalClarification,linkProposalCustomer,markProposalResponseHandled,recordProposalFollowUp,revokeProposalLink,saveProposalSettings,toggleValueOptionPresented} from '../actions';

const money=(n:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n||0));
const dt=(v:any)=>v?new Date(v).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'—';
const day=(v:any)=>v?new Date(`${String(v).slice(0,10)}T12:00:00`).toLocaleDateString('en-US',{month:'short',day:'numeric'}):'—';
const audienceLabel=(v:string)=>v==='homeowner'?'Homeowner':v==='commercial_owner'?'Commercial Owner':'General Contractor';
const stageLabel=(v:string)=>({sent:'Sent · Not Viewed',viewed:'Viewed',needs_reply:'Needs Reply',accepted:'Accepted',declined:'Declined',expired:'Expired',revoked:'Link Off',superseded:'Superseded'} as any)[v]||v;
const selectClass='h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-shadow focus:border-ring focus:ring-3 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50';
const checkboxClass='size-4 rounded border-input accent-primary';

export default async function ProposalDetail({params}:{params:Promise<{estimateId:string}>}){
  const {estimateId}=await params;
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();if(!profile?.company_id)redirect('/login');if(profile.role==='employee')redirect('/employee');
  const companyId=profile.company_id;
  const [{data:e},{data:summary},{data:q},{data:settings},{data:clarifications},{data:options},{data:eLead},{data:project},{data:items},{data:events},{data:billing},{data:customers}]=await Promise.all([
    supabase.from('estimates').select('*').eq('id',estimateId).eq('company_id',companyId).maybeSingle(),
    supabase.from('estimate_financial_summary').select('*').eq('estimate_id',estimateId).eq('company_id',companyId).maybeSingle(),
    supabase.from('proposal_conversion_queue').select('*').eq('estimate_id',estimateId).eq('company_id',companyId).maybeSingle(),
    supabase.from('proposal_settings').select('*').eq('estimate_id',estimateId).eq('company_id',companyId).maybeSingle(),
    supabase.from('proposal_clarifications').select('*').eq('estimate_id',estimateId).eq('company_id',companyId).order('sort_order'),
    supabase.from('bid_value_options').select('id,estimate_id,name,customer_description,sell_price_change,schedule_days_change,status,function_quality_note,approval_required').eq('estimate_id',estimateId).eq('company_id',companyId).order('created_at'),
    supabase.from('leads').select('id,customer_id,customer_name,contact_name,email,phone,project_name,address,city,state,postal_code,scope,follow_up,status').eq('id',(await supabase.from('estimates').select('lead_id').eq('id',estimateId).single()).data?.lead_id||'00000000-0000-0000-0000-000000000000').eq('company_id',companyId).maybeSingle(),
    supabase.from('projects').select('id,job_number,name,address,city,state').eq('id',(await supabase.from('estimates').select('project_id').eq('id',estimateId).single()).data?.project_id||'00000000-0000-0000-0000-000000000000').eq('company_id',companyId).maybeSingle(),
    supabase.from('estimate_items').select('id,section_id,description,quantity,unit,item_type').eq('estimate_id',estimateId).eq('company_id',companyId).order('sort_order'),
    qPromise(supabase,companyId,estimateId),
    supabase.from('company_billing_profiles').select('default_terms_text').eq('company_id',companyId).maybeSingle(),
    supabase.from('customers').select('id,name,email,phone,contact_name').eq('company_id',companyId).eq('active',true).or('email.not.is.null,phone.not.is.null').order('name'),
  ]);
  if(!e)notFound();
  const {data:releaseData,error:releaseError}=await supabase.rpc('carez_get_estimate_release_readiness',{p_estimate_id:estimateId});
  if(releaseError)throw new Error(releaseError.message);
  const release=parseEstimateReleaseReadiness(releaseData);

  const lead:any=eLead?{...eLead}:null;
  const customerLink=lead?.customer_id?(await supabase.from('customers').select('id,name,email,phone,contact_name').eq('id',lead.customer_id).eq('company_id',companyId).maybeSingle()).data:null;
  if(lead)lead.customer=customerLink;

  const queue=q||null;
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
  const mailto=mailtoAddress?`mailto:${mailtoAddress}?subject=${encodeURIComponent(`Follow-up: ${proposalDisplay} — ${e.name}`)}&body=${encodeURIComponent(`Hi ${mailtoName},\n\nI wanted to follow up on ${proposalDisplay} for ${queue?.project_name||e.name}. Please let me know if you have any questions or if there is anything you would like us to clarify or revise.\n\nThank you,\nCarez Concrete`)}`:'';
  const customer=lead?.customer?.name||lead?.customer_name||queue?.customer_name||'Customer';
  const contactName=lead?.customer?.contact_name||lead?.contact_name;
  const contactEmail=lead?.customer?.email||lead?.email;
  const proposalCustomers=(customers||[]).filter((candidate:any)=>String(candidate.email||'').trim()||String(candidate.phone||'').trim());
  const job=lead?.project_name||project?.name||e.name;
  const viewed=issued&&Number(queue.view_count||0)>0;
  const stage=issued?stageLabel(queue.conversion_stage):'Prep';

  return <AppShell userName={profile.full_name||user.email||'Owner'}><div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
    <header className="carez-page-heading flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{proposalDisplay} · {String(stage).toUpperCase()}</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">{customer}</h1><p className="mt-1 max-w-4xl text-sm text-muted-foreground">{job}{contactName?` · ${contactName}`:""}{contactEmail?` · ${contactEmail}`:""}</p></div>
      <div className="flex flex-wrap gap-2"><Link className={buttonVariants({variant:'outline',size:'sm'})} href="/proposals"><ArrowLeft/>Proposals</Link><Link className={buttonVariants({variant:'outline',size:'sm'})} href={`/estimates/${e.id}`}><FileText/>Estimate</Link></div>
    </header>

    <nav className="flex w-fit max-w-full items-stretch overflow-x-auto rounded-lg border bg-card text-xs" aria-label="Estimate workflow">
      {['Takeoff','Estimate','Audit','Proposal'].map((label,index)=><div key={label} className={index===3?'flex min-h-9 items-center gap-2 border-r bg-accent px-3 font-medium text-primary shadow-[inset_0_-2px_var(--primary)] last:border-r-0':'flex min-h-9 items-center gap-2 border-r px-3 text-muted-foreground last:border-r-0'}><span className="font-mono text-[10px]">{index+1}</span><span>{label}</span>{index<3?<ArrowRight className="size-3 opacity-50"/>:null}</div>)}
    </nav>

    <section className="carez-summary-ledger grid grid-cols-2 gap-px lg:grid-cols-4">
      <MetricCard label="Customer Price" value={money(sell)} help="Immutable once this revision is issued." tone="primary"/>
      <MetricCard label="Views" value={issued?String(Number(queue.view_count||0)):'—'} help={issued&&queue.last_viewed_at?`Last viewed ${dt(queue.last_viewed_at)}`:'Customer engagement after issue.'} tone={viewed?'success':'default'}/>
      <MetricCard label="Needs Reply" value={String(responseEvents.length)} help="Unanswered customer responses." tone={responseEvents.length?'warning':'default'}/>
      <MetricCard label="Follow-up" value={issued&&queue.follow_up_due?day(queue.follow_up_due):'—'} help={issued?queue.next_action:'Set automatically when issued.'} tone={issued&&queue.follow_up_due_now?'warning':'default'}/>
    </section>

    {!issued?<ProposalPreparation e={e} sell={sell} ps={ps} terms={terms} release={release} canIssue={canIssue} setupRows={setupRows} clarifications={clarifications||[]} options={options||[]} lead={lead} customers={proposalCustomers} locked={locked}/>:<IssuedProposal e={e} queue={queue} responseEvents={responseEvents} preview={preview} link={link} mailto={mailto} lead={lead} project={project}/>}

    {locked&&['accepted','approved'].includes(e.status)&&project&&<Card className="border-success/30 bg-success/5 shadow-none"><CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-medium uppercase tracking-wide text-success">Awarded</p><h2 className="mt-1 font-semibold">Proposal accepted — operating handoff is active</h2><p className="mt-1 text-sm text-muted-foreground">Carez preserved this revision and created the awarded-job baseline, Work Packages and readiness chain.</p></div><Link className={buttonVariants({size:'sm'})} href={`/projects/${project.id}`}><CheckCircle2/>Open Job</Link></CardContent></Card>}
  </div></AppShell>;
}

function MetricCard({label,value,help,tone='default'}:{label:string;value:string;help:string;tone?:'default'|'primary'|'success'|'warning'}){
  const toneClass=tone==='primary'?'border-primary/25 bg-primary/5':tone==='success'?'border-success/30 bg-success/5':tone==='warning'?'border-warning/30 bg-warning/5':'';
  const valueClass=tone==='success'?'text-success':tone==='warning'?'text-warning':'';
  return <Card size="sm" className={toneClass}><CardContent className="space-y-1"><div className="text-xs font-medium text-muted-foreground">{label}</div><div className={`text-2xl font-semibold tabular-nums ${valueClass}`}>{value}</div><div className="text-xs text-muted-foreground">{help}</div></CardContent></Card>;
}

async function qPromise(supabase:any,companyId:string,estimateId:string){
  const {data:q}=await supabase.from('proposal_conversion_queue').select('presentation_id').eq('estimate_id',estimateId).eq('company_id',companyId).maybeSingle();
  if(!q?.presentation_id)return {data:[]};
  return supabase.from('proposal_engagement_events').select('id,presentation_id,event_type,customer_name,customer_email,customer_message,decline_reason,option_id,created_at,handled_at').eq('company_id',companyId).eq('presentation_id',q.presentation_id).is('handled_at',null).neq('event_type','view').order('created_at',{ascending:false});
}

function ProposalPreparation({e,sell,ps,terms,release,canIssue,setupRows,clarifications,options,lead,customers,locked}:{e:any;sell:number;ps:any;terms:string;release:{release_state:string};canIssue:boolean;setupRows:{ok:boolean;label:string;detail:string}[];clarifications:any[];options:any[];lead:any;customers:any[];locked:boolean}){
  return <>
    <Card className="shadow-none"><CardHeader><CardTitle>Customer destination</CardTitle><CardDescription>Link this Estimate to the Customer who will receive the Proposal.</CardDescription></CardHeader><CardContent className="grid gap-5 md:grid-cols-2">
      {lead?.customer_id?<div className="rounded-md border p-3"><p className="text-sm font-medium">{lead.customer?.name||'Linked Customer'}</p><p className="mt-1 text-sm text-muted-foreground">{lead.customer?.email||lead.customer?.phone||'Add an email or phone before issuing.'}</p></div>:<p className="text-sm text-muted-foreground">No Customer is linked to this Estimate yet.</p>}
      {!locked&&<>{customers.length>0&&<form action={linkProposalCustomer} className="grid gap-2"><input type="hidden" name="estimate_id" value={e.id}/><Label htmlFor={`customer-destination-${e.id}`}>Existing Customer</Label><div className="flex gap-2"><select id={`customer-destination-${e.id}`} className={selectClass} name="customer_id" required defaultValue=""><option value="" disabled>Choose Customer</option>{customers.map((customer:any)=><option key={customer.id} value={customer.id}>{customer.name}{customer.email?` · ${customer.email}`:customer.phone?` · ${customer.phone}`:''}</option>)}</select><Button type="submit" variant="outline">Link</Button></div></form>}
      <form action={createProposalCustomer} className="grid gap-3 md:col-span-2"><input type="hidden" name="estimate_id" value={e.id}/><p className="text-sm font-medium">Create Customer</p><div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor={`new-customer-name-${e.id}`}>Name</Label><Input id={`new-customer-name-${e.id}`} name="name" required/></div><div className="grid gap-2"><Label htmlFor={`new-customer-contact-${e.id}`}>Contact name</Label><Input id={`new-customer-contact-${e.id}`} name="contact_name"/></div><div className="grid gap-2"><Label htmlFor={`new-customer-email-${e.id}`}>Email</Label><Input id={`new-customer-email-${e.id}`} name="email" type="email"/></div><div className="grid gap-2"><Label htmlFor={`new-customer-phone-${e.id}`}>Phone</Label><Input id={`new-customer-phone-${e.id}`} name="phone" type="tel"/></div></div><p className="text-xs text-muted-foreground">This Customer becomes the Proposal destination. Enter an email or phone number for delivery.</p><Button type="submit" variant="outline" className="w-fit">Create and link Customer</Button></form></>}
    </CardContent></Card>
    <section className="grid gap-4 xl:grid-cols-2">
      <Card className="shadow-none"><CardHeader><CardTitle>Proposal setup</CardTitle><CardDescription>Setup details help complete the customer offer. Release readiness is evaluated by Estimate Review.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="divide-y rounded-lg border border-border">{setupRows.map((item,index)=><div key={index} className="flex items-center gap-3 px-3 py-3"><span className={`flex size-7 shrink-0 items-center justify-center rounded-full ${item.ok?'bg-success/10 text-success':'bg-warning/10 text-warning'}`}>{item.ok?<Check className="size-4"/>:<Clock3 className="size-4"/>}</span><span><strong className="text-sm font-medium">{item.label}</strong><span className="ml-2 text-sm text-muted-foreground">{item.detail}</span></span></div>)}</div><div className="flex items-center justify-between border-t border-border pt-3 text-sm"><span className="text-muted-foreground">Estimate release state</span><strong>{release.release_state.replaceAll('_',' ').toUpperCase()}</strong></div></CardContent></Card>

      <Card className="shadow-none"><CardHeader><CardTitle>Customer Offer</CardTitle><CardDescription>Customer-facing wording only. Internal cost, labor burden and margin never appear here.</CardDescription></CardHeader><CardContent><form action={saveProposalSettings} className="grid gap-4"><input type="hidden" name="estimate_id" value={e.id}/>
        <div className="grid gap-2"><Label htmlFor={`audience-${e.id}`}>Customer type</Label><select id={`audience-${e.id}`} className={selectClass} name="audience_type" defaultValue={ps.audience_type||'general_contractor'}><option value="general_contractor">General Contractor</option><option value="homeowner">Homeowner</option><option value="commercial_owner">Commercial Owner</option></select></div>
        <div className="grid gap-2"><Label htmlFor={`summary-${e.id}`}>Opening / scope summary</Label><Textarea id={`summary-${e.id}`} name="executive_summary" rows={4} defaultValue={ps.executive_summary||''} placeholder="Concrete scope summarized in customer language…"/></div>
        <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor={`schedule-${e.id}`}>Schedule</Label><Input id={`schedule-${e.id}`} name="schedule_summary" defaultValue={ps.schedule_summary||''} placeholder="Schedule / duration / coordination"/></div><div className="grid gap-2"><Label htmlFor={`payment-${e.id}`}>Payment</Label><Input id={`payment-${e.id}`} name="payment_summary" defaultValue={ps.payment_summary||''} placeholder="Deposit / progress / final payment"/></div></div>
        <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor={`validity-${e.id}`}>Valid for (days)</Label><Input id={`validity-${e.id}`} name="validity_days" type="number" min="1" max="90" defaultValue={Number(ps.validity_days||30)}/></div><label className="flex items-center gap-2 self-end pb-2 text-sm text-muted-foreground"><input className={checkboxClass} name="show_quantities" type="checkbox" defaultChecked={ps.show_quantities!==false}/>Show customer-facing quantities where appropriate</label></div>
        <details className="rounded-lg border border-border"><summary className="cursor-pointer list-none px-3 py-3 text-sm font-medium">Warranty, positioning & terms</summary><div className="grid gap-4 border-t border-border p-3"><div className="grid gap-2"><Label htmlFor={`message-${e.id}`}>Customer message</Label><Textarea id={`message-${e.id}`} name="customer_message" rows={3} defaultValue={ps.customer_message||''}/></div><div className="grid gap-2"><Label htmlFor={`warranty-${e.id}`}>Warranty</Label><Textarea id={`warranty-${e.id}`} name="warranty_summary" rows={3} defaultValue={ps.warranty_summary||''}/></div><div className="grid gap-2"><Label htmlFor={`why-${e.id}`}>Why Carez</Label><Textarea id={`why-${e.id}`} name="why_carez" rows={3} defaultValue={ps.why_carez||''}/></div><div className="grid gap-2"><Label htmlFor={`pricing-note-${e.id}`}>Pricing note</Label><Textarea id={`pricing-note-${e.id}`} name="pricing_note" rows={3} defaultValue={ps.pricing_note||''}/></div><div className="grid gap-2"><Label htmlFor={`terms-${e.id}`}>Terms</Label><Textarea id={`terms-${e.id}`} name="terms_text" rows={7} defaultValue={terms}/></div></div></details>
        <Button type="submit" variant="outline" className="w-fit">Save Customer Offer</Button>
      </form></CardContent></Card>
    </section>

    <section className="grid gap-4 xl:grid-cols-2">
      <Card className="shadow-none"><CardHeader><CardTitle>Inclusions / Exclusions</CardTitle><CardDescription>Short clarifiers prevent scope arguments without bloating the proposal.</CardDescription></CardHeader><CardContent className="space-y-4">
        {clarifications.length?<div className="divide-y rounded-lg border border-border">{clarifications.map((c:any)=><div key={c.id} className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-start sm:justify-between"><div><Badge variant="outline">{String(c.category).replaceAll('_',' ')}</Badge><div className="mt-2 text-sm font-medium">{c.clarification_text}</div></div><form action={deleteProposalClarification}><input type="hidden" name="clarification_id" value={c.id}/><input type="hidden" name="estimate_id" value={e.id}/><Button type="submit" variant="outline" size="sm" className="text-destructive">Delete</Button></form></div>)}</div>:<p className="text-sm text-muted-foreground">No proposal clarifiers yet.</p>}
        <details className="rounded-lg border border-border"><summary className="cursor-pointer list-none px-3 py-3 text-sm font-medium">Add Clarifier</summary><div className="border-t border-border p-3"><form action={addProposalClarification} className="grid gap-4"><input type="hidden" name="estimate_id" value={e.id}/><div className="grid gap-2"><Label htmlFor={`clarifier-type-${e.id}`}>Type</Label><select id={`clarifier-type-${e.id}`} className={selectClass} name="category"><option value="inclusion">Inclusion</option><option value="exclusion">Exclusion</option><option value="assumption">Assumption</option><option value="allowance">Allowance</option><option value="qualification">Qualification</option></select></div><div className="grid gap-2"><Label htmlFor={`clarifier-text-${e.id}`}>Customer wording</Label><Textarea id={`clarifier-text-${e.id}`} name="clarification_text" required rows={3} placeholder="Example: Excavation and export by others."/></div><Button type="submit" variant="outline" className="w-fit">Add Clarifier</Button></form></div></details>
      </CardContent></Card>

      <Card className="shadow-none"><CardHeader><CardTitle>Options / Value Engineering</CardTitle><CardDescription>Choose which approved alternates are actually visible to the customer.</CardDescription></CardHeader><CardContent>{options.length?<div className="divide-y rounded-lg border border-border">{options.map((option:any)=><div key={option.id} className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="font-medium">{option.name}</div><div className="mt-1 text-xs text-muted-foreground">{option.customer_description||option.function_quality_note||'Alternate option'} · {Number(option.sell_price_change||0)>=0?'+':''}{money(option.sell_price_change)}</div></div><form action={toggleValueOptionPresented}><input type="hidden" name="estimate_id" value={e.id}/><input type="hidden" name="option_id" value={option.id}/><input type="hidden" name="target_status" value={option.status==='presented'?'suggested':'presented'}/><Button type="submit" size="sm" variant={option.status==='presented'?'outline':'secondary'}>{option.status==='presented'?'Shown':'Hidden'}</Button></form></div>)}</div>:<p className="text-sm text-muted-foreground">No value-engineering options are attached to this estimate.</p>}</CardContent></Card>
    </section>

    <Card className={canIssue?'border-success/30 bg-success/5 shadow-none':'border-warning/30 bg-warning/5 shadow-none'}><CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Issue customer revision</p><h2 className="mt-1 font-semibold">{canIssue?'Ready to create the customer link':'Complete Estimate Review before issuing'}</h2><p className="mt-1 text-sm text-muted-foreground">Issuing creates an immutable snapshot of this exact estimate, scope, customer wording, clarifications and options.</p></div><form action={createProposalLink}><input type="hidden" name="estimate_id" value={e.id}/><Button type="submit" disabled={!canIssue}><Send/>Issue {money(sell)} Proposal</Button></form></CardContent></Card>
  </>;
}

function IssuedProposal({e,queue,responseEvents,preview,link,mailto,lead,project}:{e:any;queue:any;responseEvents:any[];preview:string;link:string;mailto:string;lead:any;project:any}){
  const needsReply=queue.conversion_stage==='needs_reply';
  const accepted=queue.conversion_stage==='accepted';
  return <>
    <Card className={needsReply?'border-warning/30 bg-warning/5 shadow-none':accepted?'border-success/30 bg-success/5 shadow-none':'shadow-none'}><CardContent className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><Badge variant="outline" className={needsReply?'border-warning/30 bg-warning/10 text-warning':accepted?'border-success/30 bg-success/10 text-success':''}>{stageLabel(queue.conversion_stage)}</Badge><h2 className="mt-2 font-semibold">{queue.next_action}</h2><p className="mt-1 text-sm text-muted-foreground">Sent {dt(queue.sent_at)} · {audienceLabel(queue.audience_type)}{queue.first_viewed_at?` · First viewed ${dt(queue.first_viewed_at)}`:' · not opened yet'}</p></div><div className="flex flex-wrap gap-2">{preview&&<a className={buttonVariants({size:'sm'})} href={preview} target="_blank" rel="noreferrer"><ExternalLink/>Preview</a>}{link&&<a className={buttonVariants({variant:'outline',size:'sm'})} href={link} target="_blank" rel="noreferrer"><ExternalLink/>Customer Link</a>}{mailto&&<a className={buttonVariants({variant:'outline',size:'sm'})} href={mailto}><Mail/>Follow Up</a>}</div></CardContent></Card>

    {responseEvents.length>0&&<section className="space-y-4"><div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Customer response</p><h2 className="mt-1 text-lg font-semibold">Needs your attention</h2><p className="mt-1 text-sm text-muted-foreground">Questions and requested changes stay attached to the proposal instead of disappearing into text messages.</p></div><div className="space-y-3">{responseEvents.map((event:any)=><Card key={event.id} className="border-warning/30 shadow-none"><CardContent className="flex flex-col gap-3 sm:flex-row sm:items-start"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning"><MessageSquareText className="size-4"/></span><div className="min-w-0 flex-1"><div className="text-xs text-muted-foreground">{String(event.event_type).replaceAll('_',' ')} · {dt(event.created_at)}</div><div className="mt-1 font-medium">{event.customer_name||event.customer_email||'Customer'}</div>{event.customer_message&&<p className="mt-2 text-sm text-muted-foreground">{event.customer_message}</p>}{event.decline_reason&&<p className="mt-2 text-xs text-muted-foreground">Reason: {String(event.decline_reason).replaceAll('_',' ')}</p>}</div><form action={markProposalResponseHandled}><input type="hidden" name="event_id" value={event.id}/><Button type="submit" variant="outline" size="sm">Handled</Button></form></CardContent></Card>)}</div></section>}

    <section className="grid gap-4 xl:grid-cols-2">
      <Card className="shadow-none"><CardHeader><CardTitle>Engagement</CardTitle><CardDescription>What the customer has done with this exact revision.</CardDescription></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[['Sent',dt(queue.sent_at)],['First viewed',dt(queue.first_viewed_at)],['Last viewed',dt(queue.last_viewed_at)],['Total views',String(Number(queue.view_count||0))],['Follow-up due',queue.follow_up_due?day(queue.follow_up_due):'—']].map(([name,value])=><div key={name} className="rounded-lg border border-border bg-muted/20 p-3"><div className="text-xs text-muted-foreground">{name}</div><div className="mt-1 text-sm font-medium tabular-nums">{value}</div></div>)}</div></CardContent></Card>

      <Card className="shadow-none"><CardHeader><CardTitle>Follow-up</CardTitle><CardDescription>Record what happened and schedule the next touch.</CardDescription></CardHeader><CardContent>{lead?.id?<form action={recordProposalFollowUp} className="grid gap-4"><input type="hidden" name="lead_id" value={lead.id}/><div className="grid gap-2"><Label htmlFor={`followup-note-${e.id}`}>What happened?</Label><Textarea id={`followup-note-${e.id}`} name="note" required rows={3} placeholder="Spoke with GC — reviewing inclusions with owner…"/></div><div className="grid gap-2"><Label htmlFor={`followup-date-${e.id}`}>Next follow-up</Label><Input id={`followup-date-${e.id}`} name="next_follow_up" type="date" defaultValue={queue.follow_up_due||lead.follow_up||''}/></div><Button type="submit" variant="outline" className="w-fit">Save Follow-up</Button></form>:<p className="text-sm text-muted-foreground">This standalone proposal is not linked to a CRM lead.</p>}</CardContent></Card>
    </section>

    {!['accepted','superseded'].includes(queue.conversion_stage)&&<Card className="shadow-none"><CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Revision control</p><h2 className="mt-1 font-semibold">Do not rewrite what the customer already received</h2><p className="mt-1 text-sm text-muted-foreground">Any price or scope change creates the next estimate/proposal revision so history remains exact.</p></div><div className="flex flex-wrap gap-2"><form action={createProposalRevision}><input type="hidden" name="estimate_id" value={e.id}/><Button type="submit"><RefreshCw/>Create Next Revision</Button></form>{!queue.revoked_at&&queue.proposal_access_token_id&&<form action={revokeProposalLink}><input type="hidden" name="id" value={queue.proposal_access_token_id}/><Button type="submit" variant="outline">Turn Customer Link Off</Button></form>}</div></CardContent></Card>}

    {queue.conversion_stage==='accepted'&&project&&<Card className="border-success/30 bg-success/5 shadow-none"><CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-medium uppercase tracking-wide text-success">Won</p><h2 className="mt-1 font-semibold">Customer accepted this revision</h2><p className="mt-1 text-sm text-muted-foreground">The accepted estimate is locked and Carez has handed it into Job Setup, budget and field planning.</p></div><Link className={buttonVariants({size:'sm'})} href={`/projects/${project.id}`}><CheckCircle2/>Open Job</Link></CardContent></Card>}
  </>;
}
