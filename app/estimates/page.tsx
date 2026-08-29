import {redirect} from 'next/navigation';
import Link from 'next/link';
import {ArrowRight,Calculator,CheckCircle2,FileText,Plus,Ruler,ShieldCheck} from 'lucide-react';
import {AppShell} from '@/components/AppShell';
import {createClient} from '@/lib/supabase/server';
import {createEstimate} from './actions';

const money=(n:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n||0));
const num=(n:any)=>Number(n||0);

export default async function EstimatesPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
  const {data:p}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();if(!p?.company_id)redirect('/login');if(p.role==='employee')redirect('/employee');
  const [{data:projects},{data:estimates},{data:summaries},{data:presentations},{data:takeoffSummaries}]=await Promise.all([
    supabase.from('projects').select('id,job_number,name,status').eq('company_id',p.company_id).order('created_at',{ascending:false}),
    supabase.from('estimates').select('*').eq('company_id',p.company_id).order('updated_at',{ascending:false}),
    supabase.from('estimate_financial_summary').select('*').eq('company_id',p.company_id),
    supabase.from('proposal_presentations').select('estimate_id,proposal_number,status,sent_at').eq('company_id',p.company_id).order('sent_at',{ascending:false}),
    supabase.from('estimate_takeoff_summary').select('*').eq('company_id',p.company_id),
  ]);
  const summaryMap=new Map((summaries||[]).map((x:any)=>[x.estimate_id,x]));
  const projectMap=new Map((projects||[]).map((x:any)=>[x.id,x]));
  const takeoffMap=new Map((takeoffSummaries||[]).map((x:any)=>[x.estimate_id,x]));
  const issuedMap=new Map<string,any>();for(const row of presentations||[])if(!issuedMap.has(row.estimate_id))issuedMap.set(row.estimate_id,row);
  const rows=(estimates||[]).map((e:any)=>{const proposal=issuedMap.get(e.id);const locked=['accepted','approved','superseded'].includes(e.status)||Boolean(proposal);const stage=e.status==='accepted'||e.status==='approved'?'awarded':proposal?'issued':e.status==='ready'?'ready':e.status==='superseded'?'history':'working';return{e,proposal,locked,stage,s:summaryMap.get(e.id)||{},takeoff:takeoffMap.get(e.id)||{},project:projectMap.get(e.project_id)};});
  const working=rows.filter((r:any)=>['working','ready'].includes(r.stage));
  const issued=rows.filter((r:any)=>r.stage==='issued');
  const awarded=rows.filter((r:any)=>r.stage==='awarded');
  const history=rows.filter((r:any)=>r.stage==='history'||r.e.status==='declined');
  const pipeline=working.reduce((sum:number,r:any)=>sum+num(r.s.recommended_sell_price),0);

  return <AppShell userName={p.full_name||user.email||'Owner'}><div className="contractor-page estimates-home-v3">
    <div className="command-hero"><div><div className="section-kicker">ESTIMATE · PRICING</div><h1>Estimates</h1><p>Build the price from concrete takeoff, resolve exceptions, review margin, then issue a clean customer proposal. One bid at a time.</p></div><div className="command-actions"><Link className="button" href="/takeoff"><Ruler size={15}/> Takeoff</Link><Link className="button secondary" href="/estimates/audit"><ShieldCheck size={15}/> Estimate Audit</Link></div></div>

    <div className="takeoff-flow-strip"><span>1 <b>Takeoff</b></span><ArrowRight/><span className="active">2 <b>Estimate</b></span><ArrowRight/><span>3 <b>Audit</b></span><ArrowRight/><span>4 <b>Proposal</b></span></div>

    <div className="command-grid section"><div className="command-card"><div className="command-label">Pricing Now</div><div className="command-value">{working.length}</div><div className="command-help">Editable bid revisions.</div></div><div className={`command-card ${working.some((r:any)=>r.stage==='ready')?'good':''}`}><div className="command-label">Ready for Audit</div><div className="command-value">{working.filter((r:any)=>r.stage==='ready').length}</div><div className="command-help">Price and scope marked ready.</div></div><div className="command-card"><div className="command-label">Issued</div><div className="command-value">{issued.length}</div><div className="command-help">Customer-facing revisions in market.</div></div><div className="command-card"><div className="command-label">Pricing Pipeline</div><div className="command-value">{money(pipeline)}</div><div className="command-help">Recommended value still being priced.</div></div></div>

    <section className="section"><div className="section-heading"><div><div className="section-kicker">ACTIVE BIDS</div><div className="section-title">Estimate Workbench</div><div className="section-heading-meta">Open one estimate to work on it. Takeoff status, pricing holds and margin are visible here without rendering the entire editor for every bid.</div></div><details className="controls-disclosure create-disclosure"><summary>Standalone Estimate</summary><div className="controls-body"><div className="meta">Normal workflow starts from a Lead so customer/job information carries forward.</div><form action={createEstimate} className="form section"><label className="field"><span>Description <em>optional</em></span><input name="name" placeholder="Concrete scope / property name"/></label><label className="field"><span>Existing job <em>optional</em></span><select name="project_id" defaultValue=""><option value="">New opportunity</option>{(projects||[]).map((x:any)=><option key={x.id} value={x.id}>{x.job_number} — {x.name}</option>)}</select></label><button className="button"><Plus size={15}/> Create Estimate</button></form></div></details></div>
      {working.length===0?<div className="empty-state"><div><div className="title">No estimate is being priced right now</div><div className="meta">Start from Leads, or create a standalone estimate above.</div><div className="action-row section"><Link className="button" href="/leads">Open Leads</Link></div></div></div>:<div className="estimate-workbench-grid">{working.map((r:any)=><EstimateCard key={r.e.id} row={r}/>)}</div>}
    </section>

    {issued.length>0&&<section className="section"><div className="section-heading"><div><div className="section-kicker">IN MARKET</div><div className="section-title">Issued Proposals</div><div className="section-heading-meta">These revisions are immutable while the customer has them. Follow-up and revisions happen from Proposal.</div></div><Link className="button secondary" href="/proposals"><FileText size={15}/> Proposal</Link></div><div className="estimate-workbench-grid">{issued.map((r:any)=><EstimateCard key={r.e.id} row={r}/>)}</div></section>}

    {awarded.length>0&&<section className="section"><div className="section-heading"><div><div className="section-kicker">WON</div><div className="section-title">Accepted / Awarded</div><div className="section-heading-meta">Accepted estimate snapshots are locked and handed into Job Setup and Work Packages automatically.</div></div></div><div className="estimate-workbench-grid">{awarded.map((r:any)=><EstimateCard key={r.e.id} row={r}/>)}</div></section>}

    {history.length>0&&<section className="section"><details className="history-disclosure"><summary>Previous / Superseded Revisions <span>{history.length}</span></summary><div className="estimate-workbench-grid section">{history.map((r:any)=><EstimateCard key={r.e.id} row={r}/>)}</div></details></section>}
  </div></AppShell>;
}

function EstimateCard({row:r}:{row:any}){
  const {e,s,takeoff,proposal,project,stage}=r;
  const display=`${e.estimate_number}-R${Number(e.version||0)}`;
  const takeoffObjects=Number(takeoff.active_measurements||0),holds=Number(takeoff.missing_price_outputs||0),margin=num(s.projected_margin_percent),target=num(e.target_margin_percent),price=num(s.selected_sell_price||s.recommended_sell_price||e.proposed_sell_price);
  const stageText=stage==='working'?'Pricing':stage==='ready'?'Ready for Audit':stage==='issued'?(proposal?.proposal_number||'Issued'):stage==='awarded'?'Awarded':e.status;
  return <article className={`estimate-card-v3 ${stage}`}><header><div className="estimate-card-mark"><Calculator size={17}/></div><div><span>{display}{project?` · Job ${project.job_number}`:''}</span><strong>{e.name}</strong></div><b>{stageText}</b></header><div className="estimate-card-metrics"><div><span>Takeoff</span><strong>{takeoffObjects?`${takeoffObjects} objects`:'Not started'}</strong></div><div className={holds?'hold':''}><span>Price Holds</span><strong>{holds}</strong></div><div><span>Direct Cost</span><strong>{money(s.total_direct_cost)}</strong></div><div><span>Quote</span><strong>{money(price)}</strong></div><div className={margin<target?'hold':'good'}><span>Projected Margin</span><strong>{margin.toFixed(1)}%</strong></div></div><footer><Link className="button" href={`/estimates/${e.id}`}>{stage==='issued'||stage==='awarded'?'View Estimate':'Open Estimate'} <ArrowRight size={14}/></Link>{stage==='working'&&!takeoffObjects&&<Link className="button secondary" href="/takeoff"><Ruler size={14}/> Start Takeoff</Link>}{stage==='ready'&&<Link className="button secondary" href="/estimates/audit"><ShieldCheck size={14}/> Audit</Link>}{stage==='awarded'&&project&&<Link className="button secondary" href={`/projects/${project.id}`}><CheckCircle2 size={14}/> Open Job</Link>}</footer></article>;
}
