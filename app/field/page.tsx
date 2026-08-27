import { redirect } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { createClient } from '@/lib/supabase/server';
import { createDailyLog, createTimecard } from './actions';

const today=()=>new Date().toISOString().slice(0,10);
const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);

export default async function FieldPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('full_name,company_id').eq('id',user.id).maybeSingle();
  const [{data:projects},{data:crew},{data:riskClasses},{data:timecards},{data:logs}]=await Promise.all([
    supabase.from('projects').select('id,job_number,name').eq('status','active').order('name'),
    supabase.from('crew_members').select('id,name,hourly_rate,internal_field_rate,is_owner,default_risk_class_code').eq('available',true).order('name'),
    profile?.company_id?supabase.from('li_risk_classes').select('code,name,employer_rate_per_hour').eq('company_id',profile.company_id).eq('tax_year',2026).eq('active',true).order('code'):Promise.resolve({data:[]}),
    supabase.from('timecards').select('*,projects(job_number,name)').order('work_date',{ascending:false}).limit(20),
    supabase.from('daily_logs').select('*,projects(job_number,name)').order('log_date',{ascending:false}).limit(10)
  ]);
  const hours=(timecards||[]).reduce((s,t)=>s+Number(t.hours||0),0);
  const labor=(timecards||[]).reduce((s,t)=>s+Number(t.direct_labor_cost||0),0);
  return <AppShell userName={profile?.full_name||user.email||'Owner'}>
    <h1 className="page-title">Field</h1><p className="subtitle">Fast field entry with automatic direct labor costing.</p>
    <div className="grid grid4"><div className="card"><div className="label">Recent Labor Hours</div><div className="value">{hours.toFixed(1)}</div></div><div className="card"><div className="label">True Direct Labor Cost</div><div className="value">{money(labor)}</div></div><div className="card"><div className="label">Active Jobs</div><div className="value">{(projects||[]).length}</div></div><div className="card"><div className="label">Daily Logs</div><div className="value">{(logs||[]).length}</div></div></div>
    {(projects||[]).length===0&&<div className="alert warn"><strong>Add a project first.</strong> Timecards and daily logs must be assigned to an active job.</div>}
    <div className="split section">
      <div className="card"><div className="title">Add Timecard</div><p className="subtitle">Select the worker, L&I class and hours. Carez OS calculates wage, taxes, L&I and sick-leave reserve automatically.</p><form action={createTimecard} className="form">
        <label className="field"><span>Project</span><select name="project_id" required defaultValue=""><option value="" disabled>Select job</option>{(projects||[]).map(p=><option key={p.id} value={p.id}>{p.job_number} — {p.name}</option>)}</select></label>
        <label className="field"><span>Worker</span><select name="crew_member_id" required defaultValue=""><option value="" disabled>Select worker</option>{(crew||[]).map(c=><option key={c.id} value={c.id}>{c.name}{c.is_owner?' — Owner':` — $${Number(c.hourly_rate||0).toFixed(2)}/hr`}</option>)}</select></label>
        <label className="field"><span>Date</span><input type="date" name="work_date" defaultValue={today()} required/></label>
        <label className="field"><span>Operation</span><select name="task" defaultValue="Formwork"><option>Formwork</option><option>Rebar</option><option>Placement</option><option>Finishing</option><option>Strip</option><option>Cleanup</option><option>Layout</option><option>General</option></select></label>
        <label className="field"><span>L&I Risk Class</span><select name="risk_class_code" defaultValue="0217-01"><option value="0217-01">0217-01 — Foundation / flatwork — wood building</option><option value="0214-01">0214-01 — Curb / sidewalk — roadways</option>{(riskClasses||[]).filter(r=>!['0217-01','0214-01'].includes(r.code)).map(r=><option key={r.code} value={r.code}>{r.code} — {r.name}</option>)}</select></label>
        <div className="grid grid2"><label className="field"><span>Regular Hours</span><input type="number" step="0.25" min="0" max="24" name="regular_hours" defaultValue="8" required/></label><label className="field"><span>Overtime Hours</span><input type="number" step="0.25" min="0" max="24" name="overtime_hours" defaultValue="0"/></label></div>
        <label className="field"><span>Notes</span><input name="notes" placeholder="Optional"/></label><button className="button">Save & Calculate Labor</button>
      </form></div>
      <div className="card"><div className="title">Daily Log</div><form action={createDailyLog} className="form" style={{marginTop:12}}>
        <label className="field"><span>Project</span><select name="project_id" required defaultValue=""><option value="" disabled>Select job</option>{(projects||[]).map(p=><option key={p.id} value={p.id}>{p.job_number} — {p.name}</option>)}</select></label>
        <label className="field"><span>Date</span><input type="date" name="log_date" defaultValue={today()} required/></label>
        <div className="grid grid2"><label className="field"><span>Crew Count</span><input type="number" min="0" name="crew_count" defaultValue="0"/></label><label className="field"><span>Concrete Placed (CY)</span><input type="number" step="0.1" min="0" name="concrete_yards" defaultValue="0"/></label></div>
        <label className="field"><span>Weather</span><input name="weather" placeholder="Dry, 68°F"/></label>
        <label className="field"><span>Work Completed</span><textarea name="work_completed" rows={4} required placeholder="Formed east stem wall, placed 12 CY..."/></label>
        <label className="field"><span>Delays / Issues</span><textarea name="delays_issues" rows={2} placeholder="Truck delay, access issue, failed inspection..."/></label>
        <label className="field"><span>Notes</span><input name="notes" placeholder="Optional"/></label><button className="button">Save Daily Log</button>
      </form></div>
    </div>
    <div className="card section"><div className="title">Recent Timecards</div><div className="list">{(timecards||[]).length===0?<div className="meta" style={{paddingTop:12}}>No timecards yet.</div>:(timecards||[]).map(t=><div className="row" key={t.id}><div><div className="title">{t.worker_name} · {Number(t.hours).toFixed(2)} hr</div><div className="meta">{t.work_date} · {t.projects?.job_number||'Job'} · {t.task}{t.risk_class_code?` · ${t.risk_class_code}`:''}</div><div className="meta">Wages {money(Number(t.gross_wage_cost||0))} · L&I {money(Number(t.employer_li_cost||0))} · Payroll burden {money(Number(t.employer_social_security_cost||0)+Number(t.employer_medicare_cost||0)+Number(t.employer_futa_cost||0)+Number(t.employer_wa_sui_cost||0)+Number(t.sick_leave_reserve_cost||0))}</div></div><strong>{money(Number(t.direct_labor_cost||0))}</strong></div>)}</div></div>
    <div className="card section"><div className="title">Recent Daily Logs</div><div className="list">{(logs||[]).length===0?<div className="meta" style={{paddingTop:12}}>No daily logs yet.</div>:(logs||[]).map(l=><div className="row" key={l.id}><div><div className="title">{l.log_date} · {l.projects?.job_number||'Job'}</div><div className="meta">{l.work_completed}</div>{l.delays_issues&&<div className="meta">Issue: {l.delays_issues}</div>}</div><span className="status">{Number(l.concrete_yards||0).toFixed(1)} CY</span></div>)}</div></div>
  </AppShell>;
}
