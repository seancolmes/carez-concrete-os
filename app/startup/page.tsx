import {redirect} from 'next/navigation';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {createClient} from '@/lib/supabase/server';
import {updateStartupItem} from './actions';

const day=(v?:string|null)=>!v?'Not set':new Intl.DateTimeFormat('en-US',{weekday:'short',month:'short',day:'numeric'}).format(new Date(`${v}T12:00:00`));
const today=()=>new Date().toISOString().slice(0,10);
const addDays=(v:string,n:number)=>{const d=new Date(`${v}T12:00:00`);d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);};

export default async function StartupPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
  if(!profile?.company_id)redirect('/login');if(profile.role==='employee')redirect('/employee');

  const [{data:jobs},{data:items}]=await Promise.all([
    supabase.from('project_startup_readiness').select('*').eq('company_id',profile.company_id).order('job_number'),
    supabase.from('project_startup_items').select('*').eq('company_id',profile.company_id).order('sort_order')
  ]);
  const byProject=new Map<string,any[]>();for(const item of items||[]){const a=byProject.get(item.project_id)||[];a.push(item);byProject.set(item.project_id,a);}
  const rows:any[]=jobs||[];const ready=rows.filter(r=>r.readiness_status==='ready');const needs=rows.filter(r=>r.readiness_status!=='ready');const soonEnd=addDays(today(),7);const startingSoon=rows.filter(r=>r.next_work_date&&r.next_work_date>=today()&&r.next_work_date<=soonEnd);const unscheduled=rows.filter(r=>!r.has_work_scheduled);

  return <AppShell userName={profile.full_name||user.email||'Owner'}><div className="contractor-page">
    <div className="command-hero"><div><div className="section-kicker">JOBS & FIELD</div><h1>Job Startup</h1><p>Before the crew rolls out, Carez checks the job setup and shows exactly what is still missing.</p></div><div className="command-actions"><Link className="button" href="/schedule">Schedule Work</Link><Link className="button secondary" href="/projects">Projects</Link></div></div>

    <div className="command-grid">
      <div className={`command-card ${needs.length?'watch':'good'}`}><div className="command-label">Need Setup</div><div className="command-value">{needs.length}</div><div className="command-help">Awarded jobs not ready for crew startup yet.</div></div>
      <div className={`command-card ${ready.length?'good':''}`}><div className="command-label">Ready to Work</div><div className="command-value">{ready.length}</div><div className="command-help">Required startup checks are clear.</div></div>
      <div className="command-card"><div className="command-label">Starting Next 7 Days</div><div className="command-value">{startingSoon.length}</div><div className="command-help">Jobs with scheduled work coming up.</div></div>
      <div className={`command-card ${unscheduled.length?'bad':'good'}`}><div className="command-label">No Work Date</div><div className="command-value">{unscheduled.length}</div><div className="command-help">Active jobs with nothing scheduled.</div></div>
    </div>

    <section className="section"><div className="section-heading"><div><div className="section-kicker">READY-TO-WORK</div><div className="section-title">Startup Board</div><div className="section-heading-meta">System checks update automatically. You only confirm the field decisions Carez cannot know on its own.</div></div></div>
    {rows.length===0?<div className="empty-state"><div><div className="title">No active jobs need startup</div><div className="meta">When an estimate is awarded, the new job will appear here automatically.</div></div></div>:<div className="project-list">{rows.map(r=>{
      const manual=byProject.get(r.project_id)||[];const pct=Math.round((Number(r.ready_steps||0)/Math.max(1,Number(r.total_steps||10)))*100);
      const checks=[
        {ok:Boolean(r.has_awarded_budget),title:'Awarded job budget',detail:r.has_awarded_budget?'Accepted estimate is frozen as the job baseline.':'No frozen original budget yet.'},
        {ok:Boolean(r.has_customer_contact),title:'Customer / GC contact',detail:r.has_customer_contact?[r.customer_name,r.contact_name,r.customer_phone||r.customer_email].filter(Boolean).join(' · '):'Add a working phone number or email.'},
        {ok:Boolean(r.has_jobsite),title:'Jobsite address',detail:r.has_jobsite?[r.address,r.city,r.state].filter(Boolean).join(', '):'Job address or city is missing.'},
        {ok:Boolean(r.has_work_scheduled),title:'First work day',detail:r.has_work_scheduled?day(r.next_work_date):'Nothing is on the schedule yet.'},
        {ok:Number(r.crew_assigned_count||0)>0,title:'Crew assigned',detail:Number(r.crew_assigned_count||0)>0?`${r.crew_assigned_count} worker${Number(r.crew_assigned_count)===1?'':'s'} assigned to upcoming work.`:'No crew is assigned to upcoming work.'}
      ];
      return <article className="project-card" key={r.project_id}>
        <header className="project-header"><div><div className="project-name">{r.job_number} — {r.name}</div><div className="project-location">{[r.address,r.city,r.state].filter(Boolean).join(', ')||'Jobsite not complete'}</div></div><span className={`status ${r.readiness_status==='ready'?'completed':'on-hold'}`}>{r.readiness_status==='ready'?'READY TO WORK':'NEEDS SETUP'}</span></header>
        <section className="project-section">
          <div className="metric-grid">
            <div className={`metric-card ${r.readiness_status==='ready'?'positive':'warning'}`}><div className="label">Startup Ready</div><div className="metric-value">{pct}%</div><div className="metric-detail">{r.ready_steps} of {r.total_steps} checks clear</div></div>
            <div className={`metric-card ${r.has_work_scheduled?'brand':'danger-metric'}`}><div className="label">First Work Day</div><div className="metric-value">{r.next_work_date?day(r.next_work_date):'Not Set'}</div></div>
            <div className={`metric-card ${Number(r.crew_assigned_count||0)>0?'positive':'warning'}`}><div className="label">Crew Assigned</div><div className="metric-value">{Number(r.crew_assigned_count||0)}</div><div className="metric-detail">Across upcoming scheduled work</div></div>
            <div className="metric-card"><div className="label">Next Pour</div><div className="metric-value">{r.next_pour_date?day(r.next_pour_date):'Not Planned'}</div><div className="metric-detail">{r.next_pour_name?`${r.next_pour_name} · ${String(r.next_pour_status||'planning').replaceAll('_',' ')}`:'Pour planning does not block prep work.'}</div></div>
          </div>

          <div className="grid grid2 section">
            <section className="surface"><div className="surface-header"><div><div className="surface-title">Carez Checks Automatically</div><div className="surface-subtitle">These change as the rest of the OS is updated.</div></div></div><div className="surface-body"><div className="list">{checks.map((c,i)=><div className="row" key={i}><div><div className="title">{c.title}</div><div className="meta">{c.detail}</div></div><span className={`status ${c.ok?'completed':'on-hold'}`}>{c.ok?'Ready':'Needed'}</span></div>)}</div></div></section>

            <section className="surface"><div className="surface-header"><div><div className="surface-title">Field Confirmations</div><div className="surface-subtitle">Mark these once you have actually handled them.</div></div><strong>{Number(r.manual_open||0)} left</strong></div><div className="surface-body"><div className="list">{manual.map(item=><form action={updateStartupItem} className="row" key={item.id} style={{alignItems:'flex-start'}}><input type="hidden" name="id" value={item.id}/><input type="hidden" name="current_status" value={item.status}/><div style={{flex:1,minWidth:0}}><div className="title">{item.title}</div><div className="meta">{item.detail}</div><input name="notes" defaultValue={item.notes||''} placeholder="Optional note" style={{marginTop:8,width:'100%'}}/></div><div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',justifyContent:'flex-end'}}><span className={`status ${item.status==='done'?'completed':item.status==='not_needed'?'':'on-hold'}`}>{item.status==='done'?'Done':item.status==='not_needed'?'Not Needed':'Open'}</span>{item.status==='open'?<><button className="button secondary" name="status" value="done">Done</button><button className="button secondary" name="status" value="not_needed">Not Needed</button></>:<button className="button secondary" name="status" value="open">Reopen</button>}<button className="button secondary">Save Note</button></div></form>)}</div></div></section>
          </div>

          <section className="surface section"><div className="surface-header"><div><div className="surface-title">Production Setup</div><div className="surface-subtitle">The next operational pieces for this job.</div></div></div><div className="surface-body"><div className="list"><div className="row"><div><div className="title">Upcoming work</div><div className="meta">{r.next_work_date?`First scheduled day: ${day(r.next_work_date)}`:'No work scheduled yet.'}</div></div><Link className="button secondary" href="/schedule">Schedule</Link></div><div className="row"><div><div className="title">Concrete pour</div><div className="meta">{r.next_pour_name?`${r.next_pour_name} · ${r.next_pour_date?day(r.next_pour_date):'date not set'}`:'No pour plan yet.'}</div></div><Link className="button secondary" href="/pour-control">Pour Control</Link></div><div className="row"><div><div className="title">Materials / equipment committed</div><div className="meta">{Number(r.open_po_count||0)} issued purchase order{Number(r.open_po_count||0)===1?'':'s'} open.</div></div><Link className="button secondary" href="/procurement">Purchasing</Link></div></div></div></section>

          {r.readiness_status==='ready'?<div className="alert success section"><strong>Ready to work.</strong> Carez has the startup information required to send the crew to this job.</div>:<div className="alert danger section"><strong>Do not call this job ready yet.</strong> Clear the items marked Needed or Open above first.</div>}
          <div className="action-row section"><Link className="button" href={`/projects/${r.project_id}`}>Open Job</Link><Link className="button secondary" href="/schedule">Schedule</Link><Link className="button secondary" href="/pour-control">Plan Pour</Link><Link className="button secondary" href="/procurement">Order Materials</Link></div>
        </section>
      </article>;
    })}</div>}</section>
  </div></AppShell>;
}
