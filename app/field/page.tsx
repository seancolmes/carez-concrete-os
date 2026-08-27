import { redirect } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { createClient } from '@/lib/supabase/server';
import { createDailyLog, createTimecard } from './actions';

const today=()=>new Date().toISOString().slice(0,10);
const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);

export default async function FieldPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
  const [{data:profile},{data:projects},{data:crew},{data:timecards},{data:logs}]=await Promise.all([
    supabase.from('profiles').select('full_name').eq('id',user.id).maybeSingle(),
    supabase.from('projects').select('id,job_number,name').eq('status','active').order('name'),
    supabase.from('crew_members').select('id,name,hourly_rate').eq('available',true).order('name'),
    supabase.from('timecards').select('*,projects(job_number,name)').order('work_date',{ascending:false}).limit(20),
    supabase.from('daily_logs').select('*,projects(job_number,name)').order('log_date',{ascending:false}).limit(10)
  ]);
  const hours=(timecards||[]).reduce((s,t)=>s+Number(t.hours||0),0);
  const labor=(timecards||[]).reduce((s,t)=>s+Number(t.hours||0)*Number(t.hourly_rate||0),0);
  return <AppShell userName={profile?.full_name||user.email||'Owner'}>
    <h1 className="page-title">Field</h1><p className="subtitle">Fast field entry for labor and daily production.</p>
    <div className="grid grid4"><div className="card"><div className="label">Recent Labor Hours</div><div className="value">{hours.toFixed(1)}</div></div><div className="card"><div className="label">Recorded Labor Cost</div><div className="value">{money(labor)}</div></div><div className="card"><div className="label">Active Jobs</div><div className="value">{(projects||[]).length}</div></div><div className="card"><div className="label">Daily Logs</div><div className="value">{(logs||[]).length}</div></div></div>
    {(projects||[]).length===0&&<div className="alert warn"><strong>Add a project first.</strong> Timecards and daily logs must be assigned to an active job.</div>}
    <div className="split section">
      <div className="card"><div className="title">Add Timecard</div><form action={createTimecard} className="form" style={{marginTop:12}}>
        <label className="field"><span>Project</span><select name="project_id" required defaultValue=""><option value="" disabled>Select job</option>{(projects||[]).map(p=><option key={p.id} value={p.id}>{p.job_number} — {p.name}</option>)}</select></label>
        <label className="field"><span>Worker</span><select name="crew_member_id" defaultValue=""><option value="">Manual / Owner</option>{(crew||[]).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="field"><span>Worker Name</span><input name="worker_name" required placeholder="Nik or Richard Montes"/></label>
        <label className="field"><span>Date</span><input type="date" name="work_date" defaultValue={today()} required/></label>
        <label className="field"><span>Operation</span><select name="task" defaultValue="Formwork"><option>Formwork</option><option>Rebar</option><option>Placement</option><option>Finishing</option><option>Strip</option><option>Cleanup</option><option>Layout</option><option>General</option></select></label>
        <div className="grid grid2"><label className="field"><span>Hours</span><input type="number" step="0.25" min="0.25" max="24" name="hours" required/></label><label className="field"><span>Hourly Cost</span><input type="number" step="0.01" min="0" name="hourly_rate" placeholder="30.00"/></label></div>
        <label className="field"><span>Notes</span><input name="notes" placeholder="Optional"/></label><button className="button">Save Timecard</button>
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
    <div className="card section"><div className="title">Recent Timecards</div><div className="list">{(timecards||[]).length===0?<div className="meta" style={{paddingTop:12}}>No timecards yet.</div>:(timecards||[]).map(t=><div className="row" key={t.id}><div><div className="title">{t.worker_name} · {Number(t.hours).toFixed(2)} hr</div><div className="meta">{t.work_date} · {t.projects?.job_number||'Job'} · {t.task}</div></div><strong>{t.hourly_rate?money(Number(t.hours)*Number(t.hourly_rate)):'—'}</strong></div>)}</div></div>
    <div className="card section"><div className="title">Recent Daily Logs</div><div className="list">{(logs||[]).length===0?<div className="meta" style={{paddingTop:12}}>No daily logs yet.</div>:(logs||[]).map(l=><div className="row" key={l.id}><div><div className="title">{l.log_date} · {l.projects?.job_number||'Job'}</div><div className="meta">{l.work_completed}</div>{l.delays_issues&&<div className="meta">Issue: {l.delays_issues}</div>}</div><span className="status">{Number(l.concrete_yards||0).toFixed(1)} CY</span></div>)}</div></div>
  </AppShell>;
}
