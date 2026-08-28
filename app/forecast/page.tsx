import { redirect } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { createClient } from '@/lib/supabase/server';
import { saveScopeProgress } from './actions';

const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
const num=(v:any)=>Number(v||0);
const today=()=>new Date().toISOString().slice(0,10);

export default async function ForecastPage(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
 const {data:profile}=await supabase.from('profiles').select('full_name,company_id').eq('id',user.id).maybeSingle();
 const [{data:projects},{data:projectForecasts},{data:scopeForecasts}]=await Promise.all([
  supabase.from('projects').select('id,job_number,name,status').in('status',['active','on_hold']).order('name'),
  supabase.from('project_cost_to_complete_summary').select('*'),
  supabase.from('project_scope_forecast_summary').select('*').order('sort_order')
 ]);
 const pf=new Map((projectForecasts||[]).map((f:any)=>[f.project_id,f]));
 const scopesByProject=new Map<string,any[]>();
 for(const s of scopeForecasts||[]){const arr=scopesByProject.get(s.project_id)||[];arr.push(s);scopesByProject.set(s.project_id,arr);}
 return <AppShell userName={profile?.full_name||user.email||'Owner'}>
  <div className="page-heading"><div><h1 className="page-title">Forecast</h1><p className="subtitle">Cost-to-complete and production forecasting from frozen budgets, field progress, actual labor and actual job cost.</p></div></div>
  <div className="alert info"><strong>How to use this:</strong> update physical completion by scope as the job progresses. Labor forecast adjusts from actual production. Materials, equipment and subs stay at remaining budget unless you enter an ETC override.</div>
  <div className="project-list">{(projects||[]).map((p:any)=>{const f:any=pf.get(p.id)||null;const scopes=scopesByProject.get(p.id)||[];const margin=num(f?.forecast_margin_at_completion);const target=num(f?.target_margin_percent);const variance=num(f?.forecast_variance_to_budget);return <article className="project-card" key={p.id}>
   <header className="project-header"><div><div className="project-name">{p.job_number} — {p.name}</div><div className="project-location">Production forecast</div></div><span className={`status ${p.status==='on_hold'?'on-hold':p.status}`}>{p.status.replace('_',' ')}</span></header>
   {!f?<section className="project-section"><div className="alert warn" style={{margin:0}}>No active frozen budget. Approve an estimate before forecasting.</div></section>:<>
   <section className="project-section tinted"><div className="section-heading"><div><div className="section-kicker">Forecast at Completion</div><div className="section-title">Project Outlook</div></div><div className="section-stat">{num(f.weighted_physical_percent_complete).toFixed(1)}% physically complete</div></div>
    <div className="metric-grid">
     <div className="metric-card brand"><div className="label">Current True Cost</div><div className="metric-value">{money(num(f.current_true_company_cost))}</div></div>
     <div className="metric-card"><div className="label">Forecast Cost to Complete</div><div className="metric-value">{money(num(f.forecast_cost_to_complete))}</div><div className="metric-detail">Remaining expected exposure</div></div>
     <div className={`metric-card ${variance>=0?'positive':'danger-metric'}`}><div className="label">Forecast Final Cost</div><div className="metric-value">{money(num(f.forecast_cost_at_completion))}</div><div className="metric-detail">{variance>=0?`${money(variance)} under budget`:`${money(Math.abs(variance))} over budget`}</div></div>
     <div className={`metric-card ${margin>=target?'positive':'warning'}`}><div className="label">Forecast Final Margin</div><div className="metric-value">{margin.toFixed(1)}%</div><div className="metric-detail">Target {target.toFixed(1)}% · Profit {money(num(f.forecast_profit_at_completion))}</div></div>
    </div>
    {(num(f.scopes_high_risk)>0||num(f.scopes_on_watch)>0||num(f.scopes_needing_progress)>0)&&<div className="alert warn"><strong>Attention:</strong> {num(f.scopes_high_risk)} high-risk scope(s), {num(f.scopes_on_watch)} watch scope(s), {num(f.scopes_needing_progress)} scope(s) need a progress update.</div>}
   </section>
   <section className="project-section"><div className="section-heading"><div><div className="section-kicker">Scope Forecasts</div><div className="section-title">Production by Assembly</div><div className="section-heading-meta">Use actual progress to expose labor drift before the budget is exhausted.</div></div></div>
    <div className="grid">{scopes.map((s:any)=>{const status=s.forecast_status||'needs_progress';const complete=s.physical_percent_complete===null?null:num(s.physical_percent_complete);const varianceHours=num(s.forecast_labor_hours_variance);return <details className="controls-disclosure" key={s.budget_section_id}>
      <summary><span>{s.name}</span><span className={`status ${status==='on_track'?'active':status==='high_risk'?'on-hold':''}`}>{status.replace('_',' ')}</span></summary>
      <div className="controls-body"><div className="metric-grid">
       <div className="metric-card"><div className="label">Physical Complete</div><div className="metric-value">{complete===null?'—':`${complete.toFixed(1)}%`}</div><div className="metric-detail">Last update {s.as_of_date||'not entered'}</div></div>
       <div className="metric-card"><div className="label">Labor Hours</div><div className="metric-value">{num(s.actual_labor_hours).toFixed(1)} / {num(s.budget_labor_hours).toFixed(1)}</div><div className="metric-detail">Forecast final {num(s.forecast_labor_hours_at_completion).toFixed(1)} hr</div></div>
       <div className={`metric-card ${varianceHours>=0?'positive':'danger-metric'}`}><div className="label">Forecast Labor Variance</div><div className="metric-value">{varianceHours.toFixed(1)} hr</div><div className="metric-detail">Positive = hours remaining under budget</div></div>
       <div className="metric-card brand"><div className="label">Labor Productivity Index</div><div className="metric-value">{s.labor_productivity_index===null?'—':num(s.labor_productivity_index).toFixed(2)}</div><div className="metric-detail">1.00 = on budget · below 1.00 = inefficient</div></div>
      </div>
      <form action={saveScopeProgress} className="form section"><input type="hidden" name="budget_section_id" value={s.budget_section_id}/><div className="grid grid2"><label className="field"><span>As Of Date</span><input type="date" name="as_of_date" defaultValue={today()} required/></label><label className="field"><span>Physical % Complete</span><input type="number" name="physical_percent_complete" min="0" max="100" step="1" defaultValue={complete===null?'':complete} placeholder="60" required/></label></div>
       <div className="section-kicker">Optional ETC Overrides</div><div className="meta">Leave blank to use the automatic forecast. Enter only when you know the remaining exposure better than the model.</div>
       <div className="grid grid2"><label className="field"><span>Remaining Labor Hours</span><input type="number" min="0" step="0.25" name="remaining_labor_hours_override" placeholder={num(s.forecast_remaining_labor_hours).toFixed(1)}/></label><label className="field"><span>Remaining Materials $</span><input type="number" min="0" step="0.01" name="remaining_material_cost_override" placeholder={num(s.forecast_remaining_material_cost).toFixed(2)}/></label></div>
       <div className="grid grid2"><label className="field"><span>Remaining Equipment $</span><input type="number" min="0" step="0.01" name="remaining_equipment_cost_override" placeholder={num(s.forecast_remaining_equipment_cost).toFixed(2)}/></label><label className="field"><span>Remaining Subs $</span><input type="number" min="0" step="0.01" name="remaining_subcontractor_cost_override" placeholder={num(s.forecast_remaining_subcontractor_cost).toFixed(2)}/></label></div>
       <label className="field"><span>Remaining Other $</span><input type="number" min="0" step="0.01" name="remaining_other_cost_override" placeholder={num(s.forecast_remaining_other_cost).toFixed(2)}/></label><label className="field"><span>Progress Notes</span><input name="notes" placeholder="Forms slower than planned, footing scope 75% complete..."/></label><button className="button">Save Progress & Reforecast</button>
      </form></div>
     </details>})}</div>
   </section></>}
  </article>})}</div>
 </AppShell>;
}
