import {redirect} from 'next/navigation';
import Link from 'next/link';
import {ArrowRight,FileText,Plus,Ruler,ShieldCheck} from 'lucide-react';
import {AppShell} from '@/components/AppShell';
import {EstimateGrid,type EstimateGridRow,type EstimateGridStage} from '@/components/estimates/EstimateGrid';
import {createClient} from '@/lib/supabase/server';
import {createEstimate} from './actions';

const money=(value:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(value||0));
const number=(value:any)=>Number(value||0);

export default async function EstimatesPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/login');

  const {data:profile}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
  if(!profile?.company_id)redirect('/login');
  if(profile.role==='employee')redirect('/employee');

  const [{data:projects},{data:estimates},{data:summaries},{data:presentations},{data:takeoffSummaries}]=await Promise.all([
    supabase.from('projects').select('id,job_number,name,status').eq('company_id',profile.company_id).order('created_at',{ascending:false}),
    supabase.from('estimates').select('*').eq('company_id',profile.company_id).order('updated_at',{ascending:false}),
    supabase.from('estimate_financial_summary').select('*').eq('company_id',profile.company_id),
    supabase.from('proposal_presentations').select('estimate_id,proposal_number,status,sent_at').eq('company_id',profile.company_id).order('sent_at',{ascending:false}),
    supabase.from('estimate_takeoff_summary').select('*').eq('company_id',profile.company_id),
  ]);

  const summaryMap=new Map((summaries||[]).map((row:any)=>[row.estimate_id,row]));
  const projectMap=new Map((projects||[]).map((row:any)=>[row.id,row]));
  const takeoffMap=new Map((takeoffSummaries||[]).map((row:any)=>[row.estimate_id,row]));
  const issuedMap=new Map<string,any>();
  for(const row of presentations||[])if(!issuedMap.has(row.estimate_id))issuedMap.set(row.estimate_id,row);

  const rows=(estimates||[]).map((estimate:any)=>{
    const proposal=issuedMap.get(estimate.id);
    const project:any=projectMap.get(estimate.project_id)||null;
    const summary:any=summaryMap.get(estimate.id)||{};
    const takeoff:any=takeoffMap.get(estimate.id)||{};
    const stage:EstimateGridStage=estimate.status==='accepted'||estimate.status==='approved'
      ?'awarded'
      :proposal
        ?'issued'
        :estimate.status==='ready'
          ?'ready'
          :estimate.status==='superseded'||estimate.status==='declined'
            ?'history'
            :'working';
    return {estimate,proposal,project,summary,takeoff,stage};
  });

  const working=rows.filter(row=>row.stage==='working'||row.stage==='ready');
  const issued=rows.filter(row=>row.stage==='issued');
  const awarded=rows.filter(row=>row.stage==='awarded');
  const ready=rows.filter(row=>row.stage==='ready');
  const pipeline=working.reduce((sum,row)=>sum+number(row.summary.recommended_sell_price),0);

  const gridRows:EstimateGridRow[]=rows.map(row=>{
    const {estimate,proposal,project,summary,takeoff,stage}=row;
    const takeoffObjects=number(takeoff.active_measurements);
    const stageLabel=stage==='working'
      ?'Pricing'
      :stage==='ready'
        ?'Ready for Audit'
        :stage==='issued'
          ?proposal?.proposal_number||'Issued'
          :stage==='awarded'
            ?'Awarded'
            :estimate.status==='declined'
              ?'Declined'
              :'Superseded';
    const secondary=stage==='working'&&!takeoffObjects
      ?{href:'/takeoff',label:'Start Takeoff'}
      :stage==='ready'
        ?{href:'/estimates/audit',label:'Audit'}
        :stage==='issued'
          ?{href:`/proposals/${estimate.id}`,label:'Proposal'}
          :stage==='awarded'&&project
            ?{href:`/projects/${project.id}`,label:'Job'}
            :null;

    return {
      id:estimate.id,
      displayNumber:`${estimate.estimate_number}-R${Number(estimate.version||0)}`,
      name:estimate.name,
      projectNumber:project?.job_number||null,
      projectName:project?.name||null,
      stage,
      stageLabel,
      takeoffObjects,
      priceHolds:number(takeoff.missing_price_outputs),
      directCost:number(summary.total_direct_cost),
      quote:number(summary.selected_sell_price||summary.recommended_sell_price||estimate.proposed_sell_price),
      projectedMargin:number(summary.projected_margin_percent),
      targetMargin:number(estimate.target_margin_percent),
      updatedAt:estimate.updated_at||null,
      estimateHref:`/estimates/${estimate.id}`,
      secondaryHref:secondary?.href||null,
      secondaryLabel:secondary?.label||null,
    };
  });

  return <AppShell userName={profile.full_name||user.email||'Owner'}><div className="contractor-page estimates-home-v3">
    <div className="command-hero"><div><div className="section-kicker">ESTIMATE · PRICING</div><h1>Estimates</h1><p>Price concrete scope from takeoff, resolve exceptions, protect margin, and issue the exact revision the customer will accept.</p></div><div className="command-actions"><Link className="button safety-orange" href="/takeoff"><Ruler size={14}/> Takeoff</Link><Link className="button secondary" href="/estimates/audit"><ShieldCheck size={14}/> Audit</Link><Link className="button secondary" href="/proposals"><FileText size={14}/> Proposals</Link></div></div>

    <div className="takeoff-flow-strip"><span>1 <b>Takeoff</b></span><ArrowRight/><span className="active">2 <b>Estimate</b></span><ArrowRight/><span>3 <b>Audit</b></span><ArrowRight/><span>4 <b>Proposal</b></span></div>

    <div className="command-grid section"><div className="command-card"><div className="command-label">Pricing Now</div><div className="command-value">{working.length}</div><div className="command-help">Editable bid revisions.</div></div><div className={`command-card ${ready.length?'good':''}`}><div className="command-label">Ready for Audit</div><div className="command-value">{ready.length}</div><div className="command-help">Price and scope marked ready.</div></div><div className="command-card"><div className="command-label">Issued / Awarded</div><div className="command-value">{issued.length} / {awarded.length}</div><div className="command-help">Customer-facing and won revisions.</div></div><div className="command-card"><div className="command-label">Pricing Pipeline</div><div className="command-value">{money(pipeline)}</div><div className="command-help">Recommended value still being priced.</div></div></div>

    <section className="section"><div className="section-heading"><div><div className="section-kicker">ALL REVISIONS</div><div className="section-title">Estimate Workbench</div><div className="section-heading-meta">Filter, select, and open estimates from one sticky-header grid. Estimate and project identity remain frozen while financial columns scroll.</div></div><details className="controls-disclosure create-disclosure"><summary>Standalone Estimate</summary><div className="controls-body"><div className="meta">The normal workflow starts from a Lead so customer and project information carry forward.</div><form action={createEstimate} className="form section"><label className="field"><span>Description <em>optional</em></span><input name="name" placeholder="Concrete scope / property name"/></label><label className="field"><span>Existing job <em>optional</em></span><select name="project_id" defaultValue=""><option value="">New opportunity</option>{(projects||[]).map((project:any)=><option key={project.id} value={project.id}>{project.job_number} — {project.name}</option>)}</select></label><button className="button safety-orange"><Plus size={14}/> Create Estimate</button></form></div></details></div>
      {gridRows.length?<EstimateGrid rows={gridRows}/>:<div className="empty-state"><div><div className="title">No estimates exist yet</div><div className="meta">Start from Leads, Takeoff, or create a standalone estimate above.</div><div className="action-row"><Link className="button safety-orange" href="/leads">Open Leads</Link></div></div></div>}
    </section>
  </div></AppShell>;
}
