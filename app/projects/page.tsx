import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { createClient } from '@/lib/supabase/server';
import { createProject,updateLaborBudget,updateProjectEconomics } from './actions';

const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
const num=(v:any)=>Number(v||0);

export default async function ProjectsPage(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
 const {data:profile}=await supabase.from('profiles').select('full_name,company_id').eq('id',user.id).maybeSingle();
 const [{data:projects},{data:financials},{data:budgetActuals},{data:company}]=await Promise.all([
  supabase.from('projects').select('*,customers(name)').order('created_at',{ascending:false}),
  supabase.from('project_financial_summary').select('*'),
  supabase.from('project_budget_actual_summary').select('*'),
  profile?.company_id?supabase.from('companies').select('card_processing_reference_percent').eq('id',profile.company_id).single():Promise.resolve({data:null})
 ]);
 const fMap=new Map((financials||[]).map((f:any)=>[f.project_id,f]));
 const bMap=new Map((budgetActuals||[]).map((b:any)=>[b.project_id,b]));

 return <AppShell userName={profile?.full_name||user.email||'Owner'}>
  <div className="page-heading"><div><h1 className="page-title">Projects</h1><p className="subtitle">Budget health, current job cost and profitability in one operating view.</p></div></div>

  <details className="controls-disclosure create-disclosure">
   <summary>Add Project</summary>
   <div className="controls-body"><form action={createProject} className="form">
    <div className="grid grid2"><label className="field"><span>Job Number</span><input name="job_number" required placeholder="D58"/></label><label className="field"><span>Project Name</span><input name="name" required placeholder="307 NW 52nd St"/></label></div>
    <label className="field"><span>Address</span><input name="address"/></label>
    <div className="grid grid2"><label className="field"><span>City</span><input name="city"/></label><label className="field"><span>Contract Value</span><input name="contract_value" inputMode="decimal"/></label></div>
    <div className="grid grid2"><label className="field"><span>Estimated Labor Hours</span><input name="estimated_labor_hours" type="number" min="0" step="0.25"/></label><label className="field"><span>Estimated Labor Cost</span><input name="estimated_labor_cost" inputMode="decimal"/></label></div>
    <label className="field"><span>Next Action</span><input name="next_action"/></label>
    <button className="button">Create Project</button>
   </form></div>
  </details>

  <div className="alert info"><strong>Budget tracking active.</strong> Approved estimates become frozen project budgets. Actual labor and job costs accumulate against that baseline every day.</div>

  <div className="project-list">{(projects||[]).map((p:any)=>{
   const f:any=fMap.get(p.id)||{};
   const b:any=bMap.get(p.id)||null;
   const adjusted=num(f.adjusted_contract),direct=num(f.total_direct_cost),oh=num(f.overhead_recovery),rev=num(f.revenue_cost_reserve),trueCost=num(f.true_company_cost),profit=num(f.profit_if_complete_now),margin=num(f.margin_if_complete_now),target=num(f.target_margin_percent),room=num(f.cost_room_to_target),isComplete=p.status==='completed';
   const pct=Math.max(0,num(b?.budget_cost_used_percent));
   const progressState=pct>100?'danger':pct>=85?'warning':'';
   const statusClass=p.status==='on_hold'?'on-hold':p.status;
   const costRemaining=num(b?.total_cost_remaining);
   const laborHoursRemaining=num(b?.labor_hours_remaining);
   return <article className="project-card" key={p.id}>
    <header className="project-header"><div><div className="project-name">{p.job_number} — {p.name}</div><div className="project-location">{p.customers?.name||'Direct / customer not linked'} · {[p.address,p.city,p.state].filter(Boolean).join(', ')}</div></div><span className={`status ${statusClass}`}>{p.status.replace('_',' ')}</span></header>

    {b?<section className="project-section tinted">
     <div className="section-heading"><div className="section-heading-copy"><div className="section-kicker">Frozen Baseline</div><div className="section-title">Budget vs Actual</div><div className="section-heading-meta">{b.label}</div></div><div className="section-stat">{pct.toFixed(1)}% cost used</div></div>
     <div className="progress-wrap"><div className="progress-track"><div className={`progress-fill ${progressState}`} style={{width:`${Math.min(100,pct)}%`}}/></div><div className="progress-caption"><span>Actual true cost {money(num(b.actual_total_company_cost))}</span><span>Budget {money(num(b.budget_total_company_cost))}</span></div></div>
     <div className="metric-grid section">
      <div className="metric-card"><div className="label">Labor Hours</div><div className="metric-value">{num(b.actual_labor_hours).toFixed(1)} / {num(b.budget_labor_hours).toFixed(1)}</div><div className="metric-detail">{laborHoursRemaining.toFixed(1)} hr remaining</div></div>
      <div className="metric-card"><div className="label">Direct Cost</div><div className="metric-value">{money(num(b.actual_total_direct_cost))}</div><div className="metric-detail">Budget {money(num(b.budget_total_direct_cost))}</div></div>
      <div className={`metric-card ${costRemaining<0?'danger-metric':pct>=85?'warning':'brand'}`}><div className="label">Total Cost Remaining</div><div className="metric-value">{money(costRemaining)}</div><div className="metric-detail">After direct cost, overhead and revenue costs</div></div>
      <div className="metric-card"><div className="label">Budgeted Profit</div><div className="metric-value">{money(num(b.budgeted_profit))}</div><div className="metric-detail">Budget margin {num(b.budgeted_margin_percent).toFixed(1)}%</div></div>
     </div>
     <div className="metric-grid section">
      <div className={`metric-card ${num(b.labor_cost_remaining)<0?'danger-metric':''}`}><div className="label">Labor Remaining</div><div className="metric-value">{money(num(b.labor_cost_remaining))}</div></div>
      <div className={`metric-card ${num(b.material_cost_remaining)<0?'danger-metric':''}`}><div className="label">Materials Remaining</div><div className="metric-value">{money(num(b.material_cost_remaining))}</div></div>
      <div className={`metric-card ${num(b.equipment_cost_remaining)<0?'danger-metric':''}`}><div className="label">Equipment Remaining</div><div className="metric-value">{money(num(b.equipment_cost_remaining))}</div></div>
      <div className={`metric-card ${num(b.subcontractor_cost_remaining)+num(b.other_direct_cost_remaining)<0?'danger-metric':''}`}><div className="label">Subs / Other Remaining</div><div className="metric-value">{money(num(b.subcontractor_cost_remaining)+num(b.other_direct_cost_remaining))}</div></div>
     </div>
     {costRemaining<0&&<div className="alert danger"><strong>Budget exceeded.</strong> Actual true company cost is above the frozen project budget.</div>}
     {laborHoursRemaining<0&&<div className="alert danger"><strong>Labor-hours budget exceeded.</strong> Review remaining production before adding more field time.</div>}
    </section>:<section className="project-section tinted"><div className="alert warn" style={{margin:0}}><strong>No frozen project budget.</strong> Build and approve an estimate to establish the baseline for estimate-vs-actual tracking.</div></section>}

    <section className="project-section">
     <div className="section-heading"><div className="section-heading-copy"><div className="section-kicker">Cost To Date</div><div className="section-title">Current Job Cost</div><div className="section-heading-meta">What the project has consumed so far.</div></div></div>
     <div className="metric-grid">
      <div className="metric-card brand"><div className="label">Adjusted Contract</div><div className="metric-value">{money(adjusted)}</div><div className="metric-detail">Contract + approved changes − backcharges</div></div>
      <div className="metric-card"><div className="label">Direct Cost</div><div className="metric-value">{money(direct)}</div><div className="metric-detail">Labor {money(num(f.direct_labor_cost))} · Other {money(num(f.nonlabor_direct_cost))}</div></div>
      <div className="metric-card"><div className="label">Overhead Recovery</div><div className="metric-value">{money(oh)}</div><div className="metric-detail">{num(f.labor_hours).toFixed(1)} productive hr</div></div>
      <div className="metric-card"><div className="label">Revenue Costs</div><div className="metric-value">{money(rev)}</div><div className="metric-detail">B&O {money(num(f.bo_cost_reserve))} · Processing {money(num(f.payment_processing_cost_reserve))}</div></div>
     </div>
    </section>

    <section className="project-section tinted">
     <div className="section-heading"><div className="section-heading-copy"><div className="section-kicker">Economics</div><div className="section-title">Profitability</div><div className="section-heading-meta">Active jobs remain cost-to-date until all project costs are entered.</div></div></div>
     <div className="metric-grid">
      <div className="metric-card brand"><div className="label">True Company Cost</div><div className="metric-value">{money(trueCost)}</div><div className="metric-detail">Direct + overhead + revenue costs</div></div>
      <div className={`metric-card ${profit>=0?'positive':'danger-metric'}`}><div className="label">{isComplete?'Actual Profit':'Profit If Complete Now'}</div><div className="metric-value">{money(profit)}</div><div className="metric-detail">Not final until the job is closed</div></div>
      <div className={`metric-card ${margin>=target?'positive':'warning'}`}><div className="label">{isComplete?'Actual Margin':'Margin If Complete Now'}</div><div className="metric-value">{margin.toFixed(1)}%</div><div className="metric-detail">Target {target.toFixed(1)}%</div></div>
      <div className={`metric-card ${room>=0?'brand':'danger-metric'}`}><div className="label">Cost Room to Target</div><div className="metric-value">{money(room)}</div><div className="metric-detail">Target cost ceiling {money(num(f.target_cost_ceiling))}</div></div>
     </div>
     {!isComplete&&<div className="alert warn"><strong>Cost-to-date only.</strong> This is not final profit until the job is complete and all labor, invoices, equipment and subcontractor costs are entered.</div>}
     {isComplete&&margin<target&&<div className="alert danger"><strong>Closed below target.</strong> Final margin is {margin.toFixed(1)}% versus {target.toFixed(1)}% target.</div>}
     {isComplete&&margin>=target&&<div className="alert success"><strong>Closed at/above target.</strong> Final margin is {margin.toFixed(1)}%.</div>}
    </section>

    <section className="project-section">
     <div className="next-action"><div><div className="next-action-label">Next Action</div><div className="next-action-text">{p.next_action||'No action assigned'}</div></div></div>
     <div className="action-row"><Link className="button" href="/estimates">Estimates / Budget</Link><Link className="button secondary" href="/field">Enter Labor</Link><Link className="button secondary" href="/costs">Enter Job Cost</Link></div>
     <details className="controls-disclosure section">
      <summary>Project Controls & Settings</summary>
      <div className="controls-body"><div className="control-grid">
       <div className="subcard"><div className="subcard-title">Legacy Labor Budget</div><div className="meta" style={{marginBottom:12}}>Manual fallback while older projects transition to frozen estimate budgets.</div><form action={updateLaborBudget} className="form"><input type="hidden" name="project_id" value={p.id}/><div className="grid grid2"><label className="field"><span>Est. Labor Hours</span><input name="estimated_labor_hours" type="number" min="0" step="0.25" defaultValue={num(p.estimated_labor_hours)}/></label><label className="field"><span>Est. Direct Labor Cost</span><input name="estimated_labor_cost" type="number" min="0" step="0.01" defaultValue={num(p.estimated_labor_cost)}/></label></div><button className="button secondary">Update Labor Budget</button></form></div>
       <div className="subcard"><div className="subcard-title">Project Economics</div><form action={updateProjectEconomics} className="form"><input type="hidden" name="project_id" value={p.id}/><div className="grid grid2"><label className="field"><span>Target Margin %</span><input name="target_margin_percent" type="number" min="0" max="80" step="0.1" defaultValue={target}/></label><label className="field"><span>B&O Classification</span><select name="bo_classification" defaultValue={p.bo_classification||'retailing'}><option value="retailing">Retailing — 0.471%</option><option value="wholesaling">Wholesaling — 0.484%</option></select></label></div><div className="grid grid2"><label className="field"><span>Payment Processing Reserve %</span><input name="payment_processing_rate_percent" type="number" min="0" step="0.01" defaultValue={num(p.payment_processing_rate_percent)} placeholder={String(num(company?.card_processing_reference_percent))}/></label><label className="field"><span>Project Status</span><select name="status" defaultValue={p.status}><option value="active">Active</option><option value="completed">Completed</option><option value="on_hold">On Hold</option></select></label></div><button className="button secondary">Save Project Economics</button></form></div>
      </div></div>
     </details>
    </section>
   </article>;
  })}</div>
 </AppShell>;
}
