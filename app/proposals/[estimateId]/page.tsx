import {headers} from 'next/headers';
import {notFound,redirect} from 'next/navigation';
import Link from 'next/link';
import {ArrowLeft,ArrowRight,Check,CheckCircle2,Clock3,ExternalLink,FileText,Mail,MessageSquareText,RefreshCw,Send,ShieldCheck} from 'lucide-react';
import {AppShell} from '@/components/AppShell';
import {createClient} from '@/lib/supabase/server';
import {addProposalClarification,createProposalLink,createProposalRevision,deleteProposalClarification,markProposalResponseHandled,recordProposalFollowUp,revokeProposalLink,saveProposalSettings,toggleValueOptionPresented} from '../actions';

const money=(n:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n||0));
const dt=(v:any)=>v?new Date(v).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'—';
const day=(v:any)=>v?new Date(`${String(v).slice(0,10)}T12:00:00`).toLocaleDateString('en-US',{month:'short',day:'numeric'}):'—';
const audienceLabel=(v:string)=>v==='homeowner'?'Homeowner':v==='commercial_owner'?'Commercial Owner':'General Contractor';
const stageLabel=(v:string)=>({sent:'Sent · Not Viewed',viewed:'Viewed',needs_reply:'Needs Reply',accepted:'Accepted',declined:'Declined',expired:'Expired',revoked:'Link Off',superseded:'Superseded'} as any)[v]||v;

export default async function ProposalDetail({params}:{params:Promise<{estimateId:string}>}){
  const {estimateId}=await params;
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();if(!profile?.company_id)redirect('/login');if(profile.role==='employee')redirect('/employee');
  const companyId=profile.company_id;
  const [{data:e},{data:summary},{data:q},{data:settings},{data:clarifications},{data:options},{data:lead},{data:project},{data:items},{data:events},{data:billing}]=await Promise.all([
    supabase.from('estimates').select('*').eq('id',estimateId).eq('company_id',companyId).maybeSingle(),
    supabase.from('estimate_financial_summary').select('*').eq('estimate_id',estimateId).eq('company_id',companyId).maybeSingle(),
    supabase.from('proposal_conversion_queue').select('*').eq('estimate_id',estimateId).eq('company_id',companyId).maybeSingle(),
    supabase.from('proposal_settings').select('*').eq('estimate_id',estimateId).eq('company_id',companyId).maybeSingle(),
    supabase.from('proposal_clarifications').select('*').eq('estimate_id',estimateId).eq('company_id',companyId).order('sort_order'),
    supabase.from('bid_value_options').select('id,estimate_id,name,customer_description,sell_price_change,schedule_days_change,status,function_quality_note,approval_required').eq('estimate_id',estimateId).eq('company_id',companyId).order('created_at'),
    supabase.from('leads').select('id,customer_name,contact_name,email,phone,project_name,address,city,state,postal_code,scope,follow_up,status').eq('id',(await supabase.from('estimates').select('lead_id').eq('id',estimateId).single()).data?.lead_id||'00000000-0000-0000-0000-000000000000').eq('company_id',companyId).maybeSingle(),
    supabase.from('projects').select('id,job_number,name,address,city,state').eq('id',(await supabase.from('estimates').select('project_id').eq('id',estimateId).single()).data?.project_id||'00000000-0000-0000-0000-000000000000').eq('company_id',companyId).maybeSingle(),
    supabase.from('estimate_items').select('id,section_id,description,quantity,unit,item_type').eq('estimate_id',estimateId).eq('company_id',companyId).order('sort_order'),
    qPromise(supabase,companyId,estimateId),
    supabase.from('company_billing_profiles').select('default_terms_text').eq('company_id',companyId).maybeSingle(),
  ]);
  if(!e)notFound();

  // qPromise above resolves events after finding the presentation. Reload the current queue in case the view changed while loading.
  const queue=q||null;
  const responseEvents=events||[];
  const sell=Number(queue?.base_sell_price||summary?.selected_sell_price||summary?.recommended_sell_price||0);
  const issued=Boolean(queue);
  const locked=issued||['accepted','approved','superseded'].includes(e.status);
  const proposalDisplay=queue?.proposal_number||`P-${e.opportunity_number||String(e.estimate_number||'').replace(/^E-/,'')}-R${Number(e.version||0)}`;
  const ps=settings||{};
  const terms=ps.terms_text||billing?.default_terms_text||'';
  const contactReady=Boolean(lead?.email||lead?.phone);
  const readiness=[
    {ok:e.status==='ready',label:'Estimate marked Ready for Audit / Proposal'},
    {ok:sell>0,label:'Customer price is set'},
    {ok:(items||[]).length>0,label:'Customer scope is included'},
    {ok:contactReady,label:'Customer contact is available'},
    {ok:Boolean(terms),label:'Terms are available'},
  ];
  const readyCount=readiness.filter(x=>x.ok).length;
  const h=await headers();const host=h.get('x-forwarded-host')||h.get('host')||'',proto=h.get('x-forwarded-proto')||'https',origin=host?`${proto}://${host}`:'';
  const link=queue&&origin?`${origin}/proposal/${queue.token}`:'';
  const preview=link?`${link}?preview=1`:'';
  const mailto=queue?.customer_email?`mailto:${queue.customer_email}?subject=${encodeURIComponent(`Follow-up: ${proposalDisplay} — ${e.name}`)}&body=${encodeURIComponent(`Hi ${queue.contact_name||queue.customer_name||''},\n\nI wanted to follow up on ${proposalDisplay} for ${queue.project_name||e.name}. Please let me know if you have any questions or if there is anything you would like us to clarify or revise.\n\nThank you,\nCarez Concrete`)}`:'';
  const customer=lead?.customer_name||queue?.customer_name||'Customer';
  const job=lead?.project_name||project?.name||e.name;

  return <AppShell userName={profile.full_name||user.email||'Owner'}><div className="contractor-page proposal-detail-v3">
    <div className="command-hero"><div><div className="section-kicker">{proposalDisplay} · {(issued?stageLabel(queue.conversion_stage):'PREP').toUpperCase()}</div><h1>{customer}</h1><p>{job}{lead?.contact_name?` · ${lead.contact_name}`:''}{lead?.email?` · ${lead.email}`:''}</p></div><div className="command-actions"><Link className="button secondary" href="/proposals"><ArrowLeft size={15}/> Proposals</Link><Link className="button secondary" href={`/estimates/${e.id}`}><FileText size={15}/> Estimate</Link></div></div>

    <div className="takeoff-flow-strip"><span>1 <b>Takeoff</b></span><ArrowRight/><span>2 <b>Estimate</b></span><ArrowRight/><span>3 <b>Audit</b></span><ArrowRight/><span className="active">4 <b>Proposal</b></span></div>

    <div className="command-grid section"><div className="command-card brand"><div className="command-label">Customer Price</div><div className="command-value">{money(sell)}</div><div className="command-help">Immutable once this revision is issued.</div></div><div className={`command-card ${issued&&Number(queue.view_count||0)>0?'good':''}`}><div className="command-label">Views</div><div className="command-value">{issued?Number(queue.view_count||0):'—'}</div><div className="command-help">{issued&&queue.last_viewed_at?`Last viewed ${dt(queue.last_viewed_at)}`:'Customer engagement after issue.'}</div></div><div className={`command-card ${responseEvents.length?'watch':''}`}><div className="command-label">Needs Reply</div><div className="command-value">{responseEvents.length}</div><div className="command-help">Unanswered customer responses.</div></div><div className={`command-card ${issued&&queue.follow_up_due_now?'watch':''}`}><div className="command-label">Follow-up</div><div className="command-value">{issued&&queue.follow_up_due?day(queue.follow_up_due):'—'}</div><div className="command-help">{issued?queue.next_action:'Set automatically when issued.'}</div></div></div>

    {!issued?<ProposalPreparation e={e} sell={sell} ps={ps} terms={terms} readiness={readiness} readyCount={readyCount} clarifications={clarifications||[]} options={options||[]}/>:<IssuedProposal e={e} queue={queue} responseEvents={responseEvents} preview={preview} link={link} mailto={mailto} lead={lead} project={project}/>} 

    {locked&&['accepted','approved'].includes(e.status)&&project&&<section className="section"><div className="estimate-next-step"><div><div className="section-kicker">AWARDED</div><div className="section-title">Proposal accepted — operating handoff is active</div><div className="section-heading-meta">Carez preserved this revision and created the awarded-job baseline, Work Packages and readiness chain.</div></div><Link className="button" href={`/projects/${project.id}`}><CheckCircle2 size={15}/> Open Job</Link></div></section>}
  </div></AppShell>;
}

async function qPromise(supabase:any,companyId:string,estimateId:string){
  const {data:q}=await supabase.from('proposal_conversion_queue').select('presentation_id').eq('estimate_id',estimateId).eq('company_id',companyId).maybeSingle();
  if(!q?.presentation_id)return {data:[]};
  return supabase.from('proposal_engagement_events').select('id,presentation_id,event_type,customer_name,customer_email,customer_message,decline_reason,option_id,created_at,handled_at').eq('company_id',companyId).eq('presentation_id',q.presentation_id).is('handled_at',null).neq('event_type','view').order('created_at',{ascending:false});
}

function ProposalPreparation({e,sell,ps,terms,readiness,readyCount,clarifications,options}:{e:any;sell:number;ps:any;terms:string;readiness:any[];readyCount:number;clarifications:any[];options:any[]}){
  return <>
    <section className="section"><div className="proposal-prep-grid">
      <div className="surface"><div className="surface-header"><div><div className="surface-title">Ready to Issue</div><div className="surface-subtitle">Carez checks the minimum before an immutable customer revision can be created.</div></div></div><div className="surface-body"><div className="proposal-readiness-list">{readiness.map((item:any,index:number)=><div key={index} className={item.ok?'good':'hold'}><span>{item.ok?<Check size={14}/>:<Clock3 size={14}/>}</span><strong>{item.label}</strong></div>)}</div><div className="proposal-ready-score"><span>Conversion readiness</span><strong>{readyCount}/5</strong></div></div></div>

      <div className="surface"><div className="surface-header"><div><div className="surface-title">Customer Offer</div><div className="surface-subtitle">Customer-facing wording only. Internal cost, labor burden and margin never appear here.</div></div></div><div className="surface-body"><form action={saveProposalSettings} className="form"><input type="hidden" name="estimate_id" value={e.id}/><label className="field"><span>Customer type</span><select name="audience_type" defaultValue={ps.audience_type||'general_contractor'}><option value="general_contractor">General Contractor</option><option value="homeowner">Homeowner</option><option value="commercial_owner">Commercial Owner</option></select></label><label className="field"><span>Opening / scope summary</span><textarea name="executive_summary" rows={4} defaultValue={ps.executive_summary||''} placeholder="Concrete scope summarized in customer language…"/></label><div className="grid grid2"><label className="field"><span>Schedule</span><input name="schedule_summary" defaultValue={ps.schedule_summary||''} placeholder="Schedule / duration / coordination"/></label><label className="field"><span>Payment</span><input name="payment_summary" defaultValue={ps.payment_summary||''} placeholder="Deposit / progress / final payment"/></label></div><div className="grid grid2"><label className="field"><span>Valid for</span><div className="quantity-with-unit"><input name="validity_days" type="number" min="1" max="90" defaultValue={Number(ps.validity_days||30)}/><b>DAYS</b></div></label><label className="checkRow"><input name="show_quantities" type="checkbox" defaultChecked={ps.show_quantities!==false}/><span>Show customer-facing quantities where appropriate</span></label></div><details className="estimate-commercial-advanced"><summary>Warranty, positioning & terms</summary><div className="proposal-advanced-fields"><label className="field"><span>Customer message</span><textarea name="customer_message" rows={3} defaultValue={ps.customer_message||''}/></label><label className="field"><span>Warranty</span><textarea name="warranty_summary" rows={3} defaultValue={ps.warranty_summary||''}/></label><label className="field"><span>Why Carez</span><textarea name="why_carez" rows={3} defaultValue={ps.why_carez||''}/></label><label className="field"><span>Pricing note</span><textarea name="pricing_note" rows={3} defaultValue={ps.pricing_note||''}/></label><label className="field full"><span>Terms</span><textarea name="terms_text" rows={7} defaultValue={terms}/></label></div></details><button className="button secondary">Save Customer Offer</button></form></div></div>
    </div></section>

    <section className="section"><div className="proposal-prep-grid">
      <div className="surface"><div className="surface-header"><div><div className="surface-title">Inclusions / Exclusions</div><div className="surface-subtitle">Short clarifiers prevent scope arguments without bloating the proposal.</div></div></div><div className="surface-body"><div className="proposal-clarification-list">{clarifications.length?clarifications.map((c:any)=><div key={c.id}><span>{String(c.category).replaceAll('_',' ')}</span><strong>{c.clarification_text}</strong><form action={deleteProposalClarification}><input type="hidden" name="clarification_id" value={c.id}/><input type="hidden" name="estimate_id" value={e.id}/><button type="submit">×</button></form></div>):<div className="meta">No proposal clarifiers yet.</div>}</div><details className="controls-disclosure section"><summary>Add Clarifier</summary><div className="controls-body"><form action={addProposalClarification} className="form"><input type="hidden" name="estimate_id" value={e.id}/><label className="field"><span>Type</span><select name="category"><option value="inclusion">Inclusion</option><option value="exclusion">Exclusion</option><option value="assumption">Assumption</option><option value="allowance">Allowance</option><option value="qualification">Qualification</option></select></label><label className="field"><span>Customer wording</span><textarea name="clarification_text" required rows={3} placeholder="Example: Excavation and export by others."/></label><button className="button secondary">Add Clarifier</button></form></div></details></div></div>

      <div className="surface"><div className="surface-header"><div><div className="surface-title">Options / Value Engineering</div><div className="surface-subtitle">Choose which approved alternates are actually visible to the customer.</div></div></div><div className="surface-body">{options.length?<div className="proposal-option-list">{options.map((option:any)=><div key={option.id}><div><strong>{option.name}</strong><span>{option.customer_description||option.function_quality_note||'Alternate option'} · {Number(option.sell_price_change||0)>=0?'+':''}{money(option.sell_price_change)}</span></div><form action={toggleValueOptionPresented}><input type="hidden" name="estimate_id" value={e.id}/><input type="hidden" name="option_id" value={option.id}/><input type="hidden" name="target_status" value={option.status==='presented'?'suggested':'presented'}/><button className={`status ${option.status==='presented'?'active':''}`}>{option.status==='presented'?'Shown':'Hidden'}</button></form></div>)}</div>:<div className="meta">No value-engineering options are attached to this estimate.</div>}</div></div>
    </div></section>

    <section className="section"><div className="proposal-issue-panel"><div><div className="section-kicker">ISSUE CUSTOMER REVISION</div><div className="section-title">{readyCount===5?'Ready to create the customer link':'Finish the readiness items first'}</div><div className="section-heading-meta">Issuing creates an immutable snapshot of this exact estimate, scope, customer wording, clarifications and options.</div></div><form action={createProposalLink}><input type="hidden" name="estimate_id" value={e.id}/><button className="button" disabled={readyCount<5}><Send size={15}/> Issue {money(sell)} Proposal</button></form></div></section>
  </>;
}

function IssuedProposal({e,queue,responseEvents,preview,link,mailto,lead,project}:{e:any;queue:any;responseEvents:any[];preview:string;link:string;mailto:string;lead:any;project:any}){
  return <>
    <section className="section"><div className={`proposal-live-banner ${queue.conversion_stage==='needs_reply'?'attention':queue.conversion_stage==='accepted'?'success':''}`}><div><span>{stageLabel(queue.conversion_stage)}</span><strong>{queue.next_action}</strong><small>Sent {dt(queue.sent_at)} · {audienceLabel(queue.audience_type)}{queue.first_viewed_at?` · First viewed ${dt(queue.first_viewed_at)}`:' · not opened yet'}</small></div><div className="proposal-live-actions">{preview&&<a className="button" href={preview} target="_blank" rel="noreferrer"><ExternalLink size={14}/> Preview</a>}{link&&<a className="button secondary" href={link} target="_blank" rel="noreferrer"><ExternalLink size={14}/> Customer Link</a>}{mailto&&<a className="button secondary" href={mailto}><Mail size={14}/> Follow Up</a>}</div></div></section>

    {responseEvents.length>0&&<section className="section"><div className="section-heading"><div><div className="section-kicker">CUSTOMER RESPONSE</div><div className="section-title">Needs your attention</div><div className="section-heading-meta">Questions and requested changes stay attached to the proposal instead of disappearing into text messages.</div></div></div><div className="proposal-response-list">{responseEvents.map((event:any)=><article key={event.id}><div className="proposal-response-icon"><MessageSquareText/></div><div><span>{String(event.event_type).replaceAll('_',' ')} · {dt(event.created_at)}</span><strong>{event.customer_name||event.customer_email||'Customer'}</strong>{event.customer_message&&<p>{event.customer_message}</p>}{event.decline_reason&&<small>Reason: {String(event.decline_reason).replaceAll('_',' ')}</small>}</div><form action={markProposalResponseHandled}><input type="hidden" name="event_id" value={event.id}/><button className="button secondary">Handled</button></form></article>)}</div></section>}

    <section className="section"><div className="proposal-engagement-grid">
      <div className="surface"><div className="surface-header"><div><div className="surface-title">Engagement</div><div className="surface-subtitle">What the customer has done with this exact revision.</div></div></div><div className="surface-body"><div className="proposal-engagement-stats"><div><span>Sent</span><strong>{dt(queue.sent_at)}</strong></div><div><span>First viewed</span><strong>{dt(queue.first_viewed_at)}</strong></div><div><span>Last viewed</span><strong>{dt(queue.last_viewed_at)}</strong></div><div><span>Total views</span><strong>{Number(queue.view_count||0)}</strong></div><div><span>Follow-up due</span><strong>{queue.follow_up_due?day(queue.follow_up_due):'—'}</strong></div></div></div></div>

      <div className="surface"><div className="surface-header"><div><div className="surface-title">Follow-up</div><div className="surface-subtitle">Record what happened and schedule the next touch.</div></div></div><div className="surface-body">{lead?.id?<form action={recordProposalFollowUp} className="form"><input type="hidden" name="lead_id" value={lead.id}/><label className="field"><span>What happened?</span><textarea name="note" required rows={3} placeholder="Spoke with GC — reviewing inclusions with owner…"/></label><label className="field"><span>Next follow-up</span><input name="next_follow_up" type="date" defaultValue={queue.follow_up_due||lead.follow_up||''}/></label><button className="button secondary">Save Follow-up</button></form>:<div className="meta">This standalone proposal is not linked to a CRM lead.</div>}</div></div>
    </div></section>

    {!['accepted','superseded'].includes(queue.conversion_stage)&&<section className="section"><div className="proposal-revision-panel"><div><div className="section-kicker">REVISION CONTROL</div><div className="section-title">Do not rewrite what the customer already received</div><div className="section-heading-meta">Any price or scope change creates the next estimate/proposal revision so history remains exact.</div></div><div className="action-row"><form action={createProposalRevision}><input type="hidden" name="estimate_id" value={e.id}/><button className="button"><RefreshCw size={14}/> Create Next Revision</button></form>{!queue.revoked_at&&queue.proposal_access_token_id&&<form action={revokeProposalLink}><input type="hidden" name="id" value={queue.proposal_access_token_id}/><button className="button secondary">Turn Customer Link Off</button></form>}</div></div></section>}

    {queue.conversion_stage==='accepted'&&project&&<section className="section"><div className="estimate-next-step"><div><div className="section-kicker">WON</div><div className="section-title">Customer accepted this revision</div><div className="section-heading-meta">The accepted estimate is locked and Carez has handed it into Job Setup, budget and field planning.</div></div><Link className="button" href={`/projects/${project.id}`}><CheckCircle2 size={15}/> Open Job</Link></div></section>}
  </>;
}
