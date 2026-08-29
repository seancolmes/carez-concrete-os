import {redirect} from 'next/navigation';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {createClient} from '@/lib/supabase/server';

const money=(n:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n||0));

export default async function JobSetupPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();if(!profile?.company_id)redirect('/login');if(profile.role==='employee')redirect('/employee');

  const [{data:rows},{data:handoffRows}]=await Promise.all([
    supabase.from('project_job_readiness_summary').select('*').eq('company_id',profile.company_id).eq('award_setup_applies',true).order('job_number',{ascending:false}),
    supabase.from('project_award_operations_handoff').select('*').eq('company_id',profile.company_id),
  ]);

  const jobs=rows||[],handoffs=handoffRows||[];
  const handoffByProject=new Map(handoffs.map((x:any)=>[x.project_id,x]));
  const ready=jobs.filter((x:any)=>x.job_ready),hold=jobs.filter((x:any)=>!x.job_ready);
  const prestart=jobs.reduce((s:number,x:any)=>s+Number(x.required_before_start_amount||0)-Number(x.required_before_start_paid_amount||0),0);
  const generated=jobs.filter((x:any)=>handoffByProject.get(x.project_id)?.handoff_status==='generated');

  return <AppShell userName={profile.full_name||user.email||'Owner'}><div className="contractor-page">
    <div className="command-hero"><div><h1>Job Setup</h1><p>Customer acceptance now carries the sold takeoff into operations. Carez creates the job budget, physical Work Packages, sequenced field work, pour plans, inspections and resource gates before anyone starts burning hours.</p></div><div className="command-actions"><Link className="button secondary" href="/proposals">Proposals</Link><Link className="button secondary" href="/production/work-packages">Work Packages</Link><Link className="button secondary" href="/readiness">Work Readiness</Link></div></div>
    <div className="command-grid">
      <div className="command-card"><div className="command-label">Won Jobs</div><div className="command-value">{jobs.length}</div><div className="command-help">Jobs created from accepted proposals.</div></div>
      <div className={`command-card ${generated.length?'good':''}`}><div className="command-label">Auto Field Plans</div><div className="command-value">{generated.length}</div><div className="command-help">Accepted takeoffs already connected to physical field work.</div></div>
      <div className={`command-card ${ready.length?'good':''}`}><div className="command-label">Setup Clear</div><div className="command-value">{ready.length}</div><div className="command-help">Agreement, billing and pre-start money are clear. Operation readiness still controls actual start permission.</div></div>
      <div className={`command-card ${hold.length?'bad':''}`}><div className="command-label">Setup Holds</div><div className="command-value">{hold.length}</div><div className="command-help">Something must be handled before scheduling crew work.</div></div>
      <div className={`command-card ${prestart>0?'watch':''}`}><div className="command-label">Pre-Start Money Open</div><div className="command-value">{money(Math.max(0,prestart))}</div><div className="command-help">Required payments not yet cleared.</div></div>
    </div>
    <section className="section"><div className="section-heading"><div><div className="section-kicker">Awarded Work</div><div className="section-title">Award → Field Handoff</div><div className="section-heading-meta">Carez separates job setup from physical start permission: a job can be administratively clear while a specific operation still waits on prior work, inspection, material, equipment or pour authorization.</div></div></div>
      {jobs.length===0?<div className="empty-state"><div><div className="title">No accepted jobs waiting for setup</div><div className="meta">When a customer accepts a Carez proposal, the project, budget and takeoff-linked field plan will be created automatically.</div></div></div>:<div className="project-list">{jobs.map((j:any)=>{
        const h:any=handoffByProject.get(j.project_id);
        const handoffStatus=h?.handoff_status||'manual';
        const generatedPlan=handoffStatus==='generated';
        const needsSync=handoffStatus==='needs_sync';
        return <article className="project-card" key={j.project_id}>
        <header className="project-header"><div><div className="project-name">{j.job_number} — {j.project_name}</div><div className="project-location">{j.agreement_number||'Agreement not captured'}{j.proposal_number?` · ${j.proposal_number}`:''}</div></div><span className={`status ${j.job_ready?'active':'on-hold'}`}>{j.job_ready?'SETUP CLEAR':'HOLD — SETUP NEEDED'}</span></header>
        <section className="project-section"><div className="metric-grid">
          <div className={`metric-card ${j.agreement_captured?'positive':'danger-metric'}`}><div className="label">Customer Authorization</div><div className="metric-value">{j.agreement_captured?'Captured':'Missing'}</div><div className="metric-detail">{j.accepted_name?`Accepted by ${j.accepted_name}`:'No acceptance on file'}</div></div>
          <div className={`metric-card ${generatedPlan?'positive':needsSync?'danger-metric':'warning'}`}><div className="label">Field Plan</div><div className="metric-value">{generatedPlan?'Generated':needsSync?'Needs Sync':handoffStatus==='estimate_only'?'Estimate Only':'Manual'}</div><div className="metric-detail">{generatedPlan?`${Number(h.work_package_count||0)} package(s) · ${Number(h.operation_count||0)} operations · ${Number(h.inspection_count||0)} inspection(s) · ${Number(h.pour_plan_count||0)} pour plan(s) · ${Number(h.resource_requirement_count||0)} resource gate(s)`:h?.next_action||'No automatic takeoff handoff is attached to this job.'}</div></div>
          <div className={`metric-card ${j.billing_ready?'positive':'warning'}`}><div className="label">Billing Setup</div><div className="metric-value">{j.billing_ready?'Ready':'Needs Setup'}</div><div className="metric-detail">Project sales tax / exemption must be known.</div></div>
          <div className={`metric-card ${Number(j.required_before_start_open_count||0)>0?'warning':'positive'}`}><div className="label">Pre-Start Payment</div><div className="metric-value">{Number(j.required_before_start_count||0)?money(j.required_before_start_amount):'None Required'}</div><div className="metric-detail">{Number(j.required_before_start_open_count||0)>0?`${j.required_before_start_open_count} payment item(s) still open`:'No unpaid pre-start requirement'}</div></div>
          <div className={`metric-card ${j.job_ready?'positive':'warning'}`}><div className="label">Administrative Decision</div><div className="metric-value">{j.job_ready?'CLEAR':'HOLD'}</div><div className="metric-detail">{j.readiness_reason}</div></div>
        </div><div className="action-row section"><Link className="button" href={`/job-setup/${j.project_id}`}>Open Job Setup</Link><Link className="button secondary" href={`/projects/${j.project_id}`}>Open Job</Link>{generatedPlan&&<><Link className="button secondary" href="/production/work-packages">Field Packages</Link><Link className="button secondary" href="/readiness/resources">Resource Gates</Link></>}</div></section>
      </article>})}</div>}
    </section>
  </div></AppShell>;
}
