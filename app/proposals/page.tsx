import {redirect} from 'next/navigation';
import Link from 'next/link';
import {ArrowRight,CheckCircle2,Clock3,Eye,FileText,MessageSquareText,ShieldCheck} from 'lucide-react';
import {AppShell} from '@/components/AppShell';
import {createClient} from '@/lib/supabase/server';

const money=(n:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n||0));
const day=(v:any)=>v?new Date(`${String(v).slice(0,10)}T12:00:00`).toLocaleDateString('en-US',{month:'short',day:'numeric'}):'—';
const dt=(v:any)=>v?new Date(v).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'—';
const stageLabel=(v:string)=>({sent:'Sent · Not Viewed',viewed:'Viewed',needs_reply:'Needs Reply',accepted:'Accepted',declined:'Declined',expired:'Expired',revoked:'Link Off',superseded:'Superseded'} as any)[v]||v;

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

  return <AppShell userName={profile.full_name||user.email||'Owner'}><div className="contractor-page proposals-v3">
    <div className="command-hero"><div><div className="section-kicker">ESTIMATE · PROPOSAL</div><h1>Proposals</h1><p>Prepare the offer, send one immutable revision, see customer engagement, and know exactly who needs a follow-up. Proposal management should feel like a sales pipeline—not a document settings page.</p></div><div className="command-actions"><Link className="button secondary" href="/estimates"><FileText size={15}/> Estimates</Link><Link className="button secondary" href="/estimates/audit"><ShieldCheck size={15}/> Audit</Link></div></div>

    <div className="takeoff-flow-strip"><span>1 <b>Takeoff</b></span><ArrowRight/><span>2 <b>Estimate</b></span><ArrowRight/><span>3 <b>Audit</b></span><ArrowRight/><span className="active">4 <b>Proposal</b></span></div>

    <div className="command-grid section"><div className="command-card"><div className="command-label">Ready to Send</div><div className="command-value">{ready.length}</div><div className="command-help">Estimate revisions waiting for proposal prep.</div></div><div className={`command-card ${needs.length?'watch':''}`}><div className="command-label">Needs Reply</div><div className="command-value">{needs.length}</div><div className="command-help">Customer question, change request or response.</div></div><div className={`command-card ${market.length?'good':''}`}><div className="command-label">In Market</div><div className="command-value">{market.length}</div><div className="command-help">Sent or viewed and awaiting decision.</div></div><div className="command-card"><div className="command-label">Open Proposal Value</div><div className="command-value">{money(openValue)}</div><div className="command-help">Current ready + active customer proposals.</div></div></div>

    {needs.length>0&&<section className="section"><div className="section-heading"><div><div className="section-kicker">ATTENTION</div><div className="section-title">Customer response waiting</div><div className="section-heading-meta">These are the proposals most likely to require action now.</div></div></div><div className="proposal-pipeline-grid">{needs.map((row:any)=><ProposalCard key={row.e.id} row={row} priority/>)}</div></section>}

    <section className="section"><div className="section-heading"><div><div className="section-kicker">CUSTOMER PIPELINE</div><div className="section-title">Ready & In Market</div><div className="section-heading-meta">Each card shows the current customer state. Open it only when you need to prepare, send, follow up, respond, or revise.</div></div></div>
      {ready.length+market.length===0?<div className="empty-state"><div><div className="title">No proposal is waiting right now</div><div className="meta">Finish an estimate, run the audit, then mark it Ready for Audit / Proposal.</div><div className="section"><Link className="button" href="/estimates">Open Estimates</Link></div></div></div>:<div className="proposal-pipeline-grid">{[...ready,...market].map((row:any)=><ProposalCard key={row.e.id} row={row}/>)}</div>}
    </section>

    {won.length>0&&<section className="section"><div className="section-heading"><div><div className="section-kicker">WON</div><div className="section-title">Accepted Proposals</div><div className="section-heading-meta">Accepted proposal revisions are locked and already handed into the awarded-job workflow.</div></div></div><div className="proposal-pipeline-grid">{won.map((row:any)=><ProposalCard key={row.e.id} row={row}/>)}</div></section>}

    {history.length>0&&<section className="section"><details className="history-disclosure"><summary>Closed / Previous Proposal Revisions <span>{history.length}</span></summary><div className="proposal-pipeline-grid section">{history.map((row:any)=><ProposalCard key={row.e.id} row={row}/>)}</div></details></section>}
  </div></AppShell>;
}

function ProposalCard({row,priority=false}:{row:any;priority?:boolean}){
  const {e,q,lead,project,sell,responses,stage}=row;
  const proposalNumber=q?.proposal_number||`P-${e.opportunity_number||String(e.estimate_number||'').replace(/^E-/,'')}-R${Number(e.version||0)}`;
  const customer=lead.customer_name||q?.customer_name||'Customer';
  const job=lead.project_name||project?.name||e.name;
  const viewed=Number(q?.view_count||0)>0;
  const label=q?stageLabel(stage):stage==='ready'?'Ready to Prepare':stage;
  const next=q?.next_action||(stage==='ready'?'Prepare and issue customer proposal':'Open proposal');
  return <article className={`proposal-card-v3 ${priority?'priority':''}`}><header><div className="proposal-card-icon">{responses?<MessageSquareText/>:viewed?<Eye/>:<FileText/>}</div><div><span>{proposalNumber}</span><strong>{customer}</strong><small>{job}</small></div><b>{label}</b></header><div className="proposal-card-body"><div className="proposal-card-price"><span>Customer price</span><strong>{money(sell)}</strong></div><div className="proposal-card-facts"><div><span>Views</span><strong>{q?Number(q.view_count||0):'—'}</strong></div><div><span>Responses</span><strong className={responses?'attention':''}>{responses}</strong></div><div><span>Last Viewed</span><strong>{q?.last_viewed_at?dt(q.last_viewed_at):'—'}</strong></div><div><span>Follow-up</span><strong className={q?.follow_up_due_now?'attention':''}>{q?.follow_up_due?day(q.follow_up_due):'—'}</strong></div></div><div className="proposal-card-next"><Clock3 size={14}/><span>{next}</span></div></div><footer><Link className="button" href={`/proposals/${e.id}`}>{q?'Open Proposal':'Prepare Proposal'} <ArrowRight size={14}/></Link>{stage==='accepted'&&e.project_id&&<Link className="button secondary" href={`/projects/${e.project_id}`}><CheckCircle2 size={14}/> Open Job</Link>}</footer></article>;
}
