import {redirect} from 'next/navigation';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {createClient} from '@/lib/supabase/server';

const money=(n:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n||0));

export default async function JobSetupPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();if(!profile?.company_id)redirect('/login');if(profile.role==='employee')redirect('/employee');
  const {data:rows}=await supabase.from('project_job_readiness_summary').select('*').eq('company_id',profile.company_id).eq('award_setup_applies',true).order('job_number',{ascending:false});
  const jobs=rows||[],ready=jobs.filter((x:any)=>x.job_ready),hold=jobs.filter((x:any)=>!x.job_ready),prestart=jobs.reduce((s:number,x:any)=>s+Number(x.required_before_start_amount||0)-Number(x.required_before_start_paid_amount||0),0);
  return <AppShell userName={profile.full_name||user.email||'Owner'}><div className="contractor-page">
    <div className="command-hero"><div><h1>Job Setup</h1><p>Turn a won proposal into a job that is safe to put on the calendar. Carez checks the accepted agreement, billing setup and any money required before work starts.</p></div><div className="command-actions"><Link className="button secondary" href="/proposals">Proposals</Link><Link className="button secondary" href="/schedule">Schedule</Link></div></div>
    <div className="command-grid">
      <div className="command-card"><div className="command-label">Won Jobs</div><div className="command-value">{jobs.length}</div><div className="command-help">Jobs created from accepted proposals.</div></div>
      <div className={`command-card ${ready.length?'good':''}`}><div className="command-label">Ready to Schedule</div><div className="command-value">{ready.length}</div><div className="command-help">Agreement, billing and pre-start money are clear.</div></div>
      <div className={`command-card ${hold.length?'bad':''}`}><div className="command-label">Setup Holds</div><div className="command-value">{hold.length}</div><div className="command-help">Something must be handled before scheduling.</div></div>
      <div className={`command-card ${prestart>0?'watch':''}`}><div className="command-label">Pre-Start Money Open</div><div className="command-value">{money(Math.max(0,prestart))}</div><div className="command-help">Required payments not yet cleared.</div></div>
    </div>
    <section className="section"><div className="section-heading"><div><div className="section-kicker">Awarded Work</div><div className="section-title">Ready / Hold Board</div><div className="section-heading-meta">A field decision, not an accounting report: can this job go on the calendar yet?</div></div></div>
      {jobs.length===0?<div className="empty-state"><div><div className="title">No accepted jobs waiting for setup</div><div className="meta">When a customer accepts a Carez proposal, the new job will appear here automatically.</div></div></div>:<div className="project-list">{jobs.map((j:any)=><article className="project-card" key={j.project_id}>
        <header className="project-header"><div><div className="project-name">{j.job_number} — {j.project_name}</div><div className="project-location">{j.agreement_number||'Agreement not captured'}{j.proposal_number?` · ${j.proposal_number}`:''}</div></div><span className={`status ${j.job_ready?'active':'on-hold'}`}>{j.job_ready?'READY TO SCHEDULE':'HOLD — SETUP NEEDED'}</span></header>
        <section className="project-section"><div className="metric-grid">
          <div className={`metric-card ${j.agreement_captured?'positive':'danger-metric'}`}><div className="label">Customer Authorization</div><div className="metric-value">{j.agreement_captured?'Captured':'Missing'}</div><div className="metric-detail">{j.accepted_name?`Accepted by ${j.accepted_name}`:'No acceptance on file'}</div></div>
          <div className={`metric-card ${j.billing_ready?'positive':'warning'}`}><div className="label">Billing Setup</div><div className="metric-value">{j.billing_ready?'Ready':'Needs Setup'}</div><div className="metric-detail">Project sales tax / exemption must be known.</div></div>
          <div className={`metric-card ${Number(j.required_before_start_open_count||0)>0?'warning':'positive'}`}><div className="label">Pre-Start Payment</div><div className="metric-value">{Number(j.required_before_start_count||0)?money(j.required_before_start_amount):'None Required'}</div><div className="metric-detail">{Number(j.required_before_start_open_count||0)>0?`${j.required_before_start_open_count} payment item(s) still open`:'No unpaid pre-start requirement'}</div></div>
          <div className={`metric-card ${j.job_ready?'positive':'warning'}`}><div className="label">Decision</div><div className="metric-value">{j.job_ready?'GO':'HOLD'}</div><div className="metric-detail">{j.readiness_reason}</div></div>
        </div><div className="action-row section"><Link className="button" href={`/job-setup/${j.project_id}`}>Open Job Setup</Link><Link className="button secondary" href={`/projects/${j.project_id}`}>Open Job</Link></div></section>
      </article>)}</div>}
    </section>
  </div></AppShell>;
}
