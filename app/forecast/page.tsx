import { redirect } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

 return <AppShell userName={profile?.full_name||user.email||'Owner'}><div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
  <header><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Financial project control</div><h1 className="mt-1 text-2xl font-semibold tracking-tight">Forecast</h1><p className="mt-1 max-w-4xl text-sm text-muted-foreground">Cost-to-complete and production forecasting from frozen budgets, field progress, actual labor and actual job cost.</p></header>

  <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground"><strong className="text-foreground">How to use this:</strong> update physical completion by scope as the job progresses. Labor forecast adjusts from actual production. Materials, equipment and subs stay at remaining budget unless you enter an ETC override.</div>

  {(projects||[]).length===0?<Empty className="border border-border"><EmptyHeader><EmptyTitle>No active projects to forecast</EmptyTitle><EmptyDescription>Active and on-hold projects will appear here when they are available.</EmptyDescription></EmptyHeader></Empty>:<div className="space-y-4">{(projects||[]).map((p:any)=>{
   const f:any=pf.get(p.id)||null;
   const scopes=scopesByProject.get(p.id)||[];
   const margin=num(f?.forecast_margin_at_completion);
   const target=num(f?.target_margin_percent);
   const variance=num(f?.forecast_variance_to_budget);
   return <Card key={p.id}><header className="carez-page-heading flex flex-col gap-3 border-b border-border px-4 pb-4 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="font-semibold">{p.job_number} — {p.name}</h2><p className="mt-1 text-sm text-muted-foreground">Production forecast</p></div><Badge variant="outline" className={p.status==='on_hold'?'border-warning/30 bg-warning/10 text-warning':'border-success/30 bg-success/10 text-success'}>{p.status.replace('_',' ')}</Badge></header><CardContent className="space-y-6">
    {!f?<div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-3 text-sm text-warning">No active frozen budget. Approve an estimate before forecasting.</div>:<>
    <section className="space-y-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Forecast at completion</div><h3 className="mt-1 font-semibold">Project Outlook</h3></div><div className="text-sm font-medium tabular-nums text-muted-foreground">{num(f.weighted_physical_percent_complete).toFixed(1)}% physically complete</div></div>
     <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-lg border border-primary/25 bg-primary/5 p-3"><div className="text-xs font-medium text-muted-foreground">Current True Cost</div><div className="mt-1 text-lg font-semibold tabular-nums">{money(num(f.current_true_company_cost))}</div></div>
      <div className="rounded-lg border border-border bg-muted/20 p-3"><div className="text-xs font-medium text-muted-foreground">Forecast Cost to Complete</div><div className="mt-1 text-lg font-semibold tabular-nums">{money(num(f.forecast_cost_to_complete))}</div><div className="mt-1 text-xs text-muted-foreground">Remaining expected exposure</div></div>
      <div className={`rounded-lg border bg-muted/20 p-3 ${variance>=0?'border-success/30 text-success':'border-destructive/30 text-destructive'}`}><div className="text-xs font-medium text-muted-foreground">Forecast Final Cost</div><div className="mt-1 text-lg font-semibold tabular-nums">{money(num(f.forecast_cost_at_completion))}</div><div className="mt-1 text-xs text-muted-foreground">{variance>=0?`${money(variance)} under budget`:`${money(Math.abs(variance))} over budget`}</div></div>
      <div className={`rounded-lg border bg-muted/20 p-3 ${margin>=target?'border-success/30 text-success':'border-warning/30 text-warning'}`}><div className="text-xs font-medium text-muted-foreground">Forecast Final Margin</div><div className="mt-1 text-lg font-semibold tabular-nums">{margin.toFixed(1)}%</div><div className="mt-1 text-xs text-muted-foreground">Target {target.toFixed(1)}% · Profit {money(num(f.forecast_profit_at_completion))}</div></div>
     </div>
     {(num(f.scopes_high_risk)>0||num(f.scopes_on_watch)>0||num(f.scopes_needing_progress)>0)&&<div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-3 text-sm text-warning"><strong>Attention:</strong> {num(f.scopes_high_risk)} high-risk scope(s), {num(f.scopes_on_watch)} watch scope(s), {num(f.scopes_needing_progress)} scope(s) need a progress update.</div>}
    </section>

    <section className="space-y-4 border-t border-border pt-5"><div><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Scope forecasts</div><h3 className="mt-1 font-semibold">Production by Assembly</h3><p className="mt-1 text-sm text-muted-foreground">Use actual progress to expose labor drift before the budget is exhausted.</p></div>
     {scopes.length===0?<Empty className="border border-border"><EmptyHeader><EmptyTitle>No scope forecasts available</EmptyTitle><EmptyDescription>Forecastable budget scopes will appear here after an active frozen budget exists.</EmptyDescription></EmptyHeader></Empty>:<div className="space-y-3">{scopes.map((s:any)=>{
      const status=s.forecast_status||'needs_progress';
      const complete=s.physical_percent_complete===null?null:num(s.physical_percent_complete);
      const varianceHours=num(s.forecast_labor_hours_variance);
      const statusClass=status==='on_track'?'border-success/30 bg-success/10 text-success':status==='high_risk'?'border-destructive/30 bg-destructive/10 text-destructive':status==='needs_progress'?'border-warning/30 bg-warning/10 text-warning':'text-muted-foreground';
      return <details className="rounded-lg border border-border" key={s.budget_section_id}>
       <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 text-sm font-medium"><span>{s.name}</span><Badge variant="outline" className={statusClass}>{status.replace('_',' ')}</Badge></summary>
       <div className="space-y-5 border-t border-border p-3"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-border bg-muted/20 p-3"><div className="text-xs font-medium text-muted-foreground">Physical Complete</div><div className="mt-1 text-lg font-semibold tabular-nums">{complete===null?'—':`${complete.toFixed(1)}%`}</div><div className="mt-1 text-xs text-muted-foreground">Last update {s.as_of_date||'not entered'}</div></div>
        <div className="rounded-lg border border-border bg-muted/20 p-3"><div className="text-xs font-medium text-muted-foreground">Labor Hours</div><div className="mt-1 text-lg font-semibold tabular-nums">{num(s.actual_labor_hours).toFixed(1)} / {num(s.budget_labor_hours).toFixed(1)}</div><div className="mt-1 text-xs text-muted-foreground">Forecast final {num(s.forecast_labor_hours_at_completion).toFixed(1)} hr</div></div>
        <div className={`rounded-lg border bg-muted/20 p-3 ${varianceHours>=0?'border-success/30 text-success':'border-destructive/30 text-destructive'}`}><div className="text-xs font-medium text-muted-foreground">Forecast Labor Variance</div><div className="mt-1 text-lg font-semibold tabular-nums">{varianceHours.toFixed(1)} hr</div><div className="mt-1 text-xs text-muted-foreground">Positive = hours remaining under budget</div></div>
        <div className="rounded-lg border border-primary/25 bg-primary/5 p-3"><div className="text-xs font-medium text-muted-foreground">Labor Productivity Index</div><div className="mt-1 text-lg font-semibold tabular-nums">{s.labor_productivity_index===null?'—':num(s.labor_productivity_index).toFixed(2)}</div><div className="mt-1 text-xs text-muted-foreground">1.00 = on budget · below 1.00 = inefficient</div></div>
       </div>

       <form action={saveScopeProgress} className="grid gap-4"><input type="hidden" name="budget_section_id" value={s.budget_section_id}/>
        <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor={`forecast-date-${s.budget_section_id}`}>As Of Date</Label><Input id={`forecast-date-${s.budget_section_id}`} type="date" name="as_of_date" defaultValue={today()} required/></div><div className="grid gap-2"><Label htmlFor={`forecast-complete-${s.budget_section_id}`}>Physical % Complete</Label><Input id={`forecast-complete-${s.budget_section_id}`} type="number" name="physical_percent_complete" min="0" max="100" step="1" defaultValue={complete===null?'':complete} placeholder="60" required/></div></div>
        <div><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Optional ETC Overrides</div><p className="mt-1 text-sm text-muted-foreground">Leave blank to use the automatic forecast. Enter only when you know the remaining exposure better than the model.</p></div>
        <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor={`forecast-labor-${s.budget_section_id}`}>Remaining Labor Hours</Label><Input id={`forecast-labor-${s.budget_section_id}`} type="number" min="0" step="0.25" name="remaining_labor_hours_override" placeholder={num(s.forecast_remaining_labor_hours).toFixed(1)}/></div><div className="grid gap-2"><Label htmlFor={`forecast-material-${s.budget_section_id}`}>Remaining Materials $</Label><Input id={`forecast-material-${s.budget_section_id}`} type="number" min="0" step="0.01" name="remaining_material_cost_override" placeholder={num(s.forecast_remaining_material_cost).toFixed(2)}/></div></div>
        <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor={`forecast-equipment-${s.budget_section_id}`}>Remaining Equipment $</Label><Input id={`forecast-equipment-${s.budget_section_id}`} type="number" min="0" step="0.01" name="remaining_equipment_cost_override" placeholder={num(s.forecast_remaining_equipment_cost).toFixed(2)}/></div><div className="grid gap-2"><Label htmlFor={`forecast-subs-${s.budget_section_id}`}>Remaining Subs $</Label><Input id={`forecast-subs-${s.budget_section_id}`} type="number" min="0" step="0.01" name="remaining_subcontractor_cost_override" placeholder={num(s.forecast_remaining_subcontractor_cost).toFixed(2)}/></div></div>
        <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor={`forecast-other-${s.budget_section_id}`}>Remaining Other $</Label><Input id={`forecast-other-${s.budget_section_id}`} type="number" min="0" step="0.01" name="remaining_other_cost_override" placeholder={num(s.forecast_remaining_other_cost).toFixed(2)}/></div><div className="grid gap-2"><Label htmlFor={`forecast-notes-${s.budget_section_id}`}>Progress Notes</Label><Input id={`forecast-notes-${s.budget_section_id}`} name="notes" placeholder="Forms slower than planned, footing scope 75% complete..."/></div></div>
        <Button type="submit" className="w-fit">Save Progress & Reforecast</Button>
       </form></div>
      </details>})}</div>}
    </section></>}
   </CardContent></Card>})}</div>}
 </div></AppShell>;
}
