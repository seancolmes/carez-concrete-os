import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { createClient } from '@/lib/supabase/server';

const label=(v:string)=>String(v||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());

export default async function EstimateAuditPage({searchParams}:{searchParams:Promise<{estimate?:string}>}){
  const {estimate:selectedEstimateId}=await searchParams;
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
  if(!profile?.company_id)redirect('/login');
  if(profile.role==='employee')redirect('/employee');
  const companyId=profile.company_id;

  const [{data:summaries},{data:findings}]=await Promise.all([
    supabase.from('estimate_audit_summary').select('*').eq('company_id',companyId).order('estimate_number').order('version',{ascending:false}),
    supabase.from('estimate_audit_findings').select('*').eq('company_id',companyId).order('sort_order'),
  ]);

  const allSummaries=summaries||[];
  const allFindings=findings||[];
  const visibleSummaries=selectedEstimateId?allSummaries.filter((x:any)=>x.estimate_id===selectedEstimateId):allSummaries;
  const visibleIds=new Set(visibleSummaries.map((x:any)=>x.estimate_id));
  const visibleFindings=allFindings.filter((x:any)=>visibleIds.has(x.estimate_id));
  const byEstimate=new Map<string,any[]>();
  for(const f of visibleFindings){const arr=byEstimate.get(f.estimate_id)||[];arr.push(f);byEstimate.set(f.estimate_id,arr);}
  const blocked=allSummaries.filter((x:any)=>x.audit_status==='blocked');
  const review=allSummaries.filter((x:any)=>x.audit_status==='review');
  const clear=allSummaries.filter((x:any)=>x.audit_status==='clear');
  const blockerCount=allSummaries.reduce((s:number,x:any)=>s+Number(x.blocker_count||0),0);
  const warningCount=allSummaries.reduce((s:number,x:any)=>s+Number(x.warning_count||0),0);

  return <AppShell userName={profile.full_name||user.email||'Owner'}><div className="contractor-page">
    <div className="command-hero">
      <div><div className="section-kicker">PRE-SEND CONTROL</div><h1>Estimate Risk / Scope Audit</h1><p>Carez checks the estimate, takeoff, L&amp;I phase, pricing, production evidence and proposal setup before customer issue. Objective blockers stop release. Judgment items stay visible as warnings.</p></div>
      <div className="command-actions"><Link className="button" href="/estimates">Estimates</Link><Link className="button secondary" href="/takeoff">Takeoff</Link><Link className="button secondary" href="/takeoff/intelligence">Estimator Intelligence</Link><Link className="button secondary" href="/proposals">Proposals</Link></div>
    </div>

    <div className="alert info"><strong>The audit is derived, not another checklist.</strong> Fix the underlying estimate or proposal fact and the finding disappears automatically. Proposal issue is blocked only while one or more objective <strong>BLOCK SEND</strong> findings remain.</div>

    <div className="command-grid section">
      <div className={`command-card ${blocked.length?'danger':'good'}`}><div className="command-label">Blocked Estimates</div><div className="command-value">{blocked.length}</div><div className="command-help">Cannot issue a new customer proposal yet.</div></div>
      <div className={`command-card ${review.length?'watch':'good'}`}><div className="command-label">Review Needed</div><div className="command-value">{review.length}</div><div className="command-help">No hard stop, but estimator judgment is required.</div></div>
      <div className="command-card good"><div className="command-label">Audit Clear</div><div className="command-value">{clear.length}</div><div className="command-help">No current blockers or warnings.</div></div>
      <div className={`command-card ${blockerCount?'danger':''}`}><div className="command-label">Blockers</div><div className="command-value">{blockerCount}</div><div className="command-help">Objective conditions that must be corrected.</div></div>
      <div className={`command-card ${warningCount?'watch':''}`}><div className="command-label">Warnings</div><div className="command-value">{warningCount}</div><div className="command-help">Scope, margin, placement or proposal items to review.</div></div>
    </div>

    {selectedEstimateId&&<div className="action-row section"><Link className="button secondary" href="/estimates/audit">Show All Estimates</Link></div>}

    {visibleSummaries.length===0?<div className="empty-state section"><div><div className="title">No estimates to audit yet</div><div className="meta">As estimates are created, Carez will continuously evaluate their release risk here.</div><div className="action-row"><Link className="button" href="/estimates">Open Estimates</Link><Link className="button secondary" href="/takeoff">Start From Takeoff</Link></div></div></div>:
      <section className="section"><div className="project-list">{visibleSummaries.map((s:any)=>{
        const fs=byEstimate.get(s.estimate_id)||[];
        const blockers=fs.filter((f:any)=>f.severity==='blocker');
        const warnings=fs.filter((f:any)=>f.severity==='warning');
        return <div className="surface" key={s.estimate_id}>
          <div className="surface-header"><div><div className="surface-title">{s.estimate_number}-R{s.version} — {s.name}</div><div className="surface-subtitle">Estimate status: {label(s.status)} · {s.finding_count} finding{s.finding_count===1?'':'s'}</div></div><div className="action-row"><span className={`status ${s.audit_status==='blocked'?'on-hold':s.audit_status==='clear'?'completed':'active'}`}>{s.audit_status==='blocked'?'BLOCK SEND':s.audit_status==='clear'?'CLEAR':'REVIEW'}</span><Link className="button secondary" href={`/estimates/audit?estimate=${s.estimate_id}`}>Focus</Link></div></div>
          <div className="surface-body">
            {fs.length===0?<div className="alert success"><strong>Audit clear.</strong> No current pricing, scope, labor or proposal findings.</div>:<>
              {blockers.length>0&&<div className="alert danger"><strong>{blockers.length} release blocker{blockers.length===1?'':'s'}.</strong> {s.next_action}</div>}
              {blockers.length===0&&warnings.length>0&&<div className="alert warning"><strong>No hard stops.</strong> Review {warnings.length} warning{warnings.length===1?'':'s'} before intentionally releasing the proposal.</div>}
              <div className="project-list">{fs.map((f:any)=><div key={f.finding_key} className="project-row"><div><div className="action-row"><span className={`status ${f.severity==='blocker'?'on-hold':'active'}`}>{f.severity==='blocker'?'BLOCK SEND':'WARNING'}</span><span className="meta">{label(f.category)}</span></div><strong>{f.title}</strong><div className="meta">{f.detail}</div><div><strong>Next:</strong> {f.next_action}</div></div></div>)}</div>
            </>}
          </div>
        </div>;
      })}</div></section>}

    <section className="section"><div className="surface"><div className="surface-header"><div><div className="surface-title">What Carez is Watching</div><div className="surface-subtitle">The rules are intentionally split between objective release blockers and estimator-review warnings.</div></div></div><div className="surface-body"><div className="project-list">
      <div><strong>BLOCK SEND — pricing integrity.</strong><div className="meta">No customer price, unpriced assembly output, $0 manual material/equipment/subcontract scope, or labor hours with no payroll cost.</div></div>
      <div><strong>BLOCK SEND — labor classification.</strong><div className="meta">Labor with missing or inactive Washington L&amp;I classification cannot be released.</div></div>
      <div><strong>BLOCK SEND — contract terms.</strong><div className="meta">A customer proposal cannot be issued with no estimate terms and no company default terms.</div></div>
      <div><strong>WARNING — physical-scope risk.</strong><div className="meta">Pump/placement method, flatwork jointing, L&amp;I overrides and unsectioned scope remain visible for estimator judgment.</div></div>
      <div><strong>WARNING — business risk.</strong><div className="meta">Margin below target and clean Carez production evidence that supports more labor are surfaced before the bid leaves the office.</div></div>
      <div><strong>WARNING — proposal quality.</strong><div className="meta">Payment summary, exclusions/assumptions, schedule and contractor identity are checked without pretending every job uses identical language.</div></div>
    </div></div></div></section>
  </div></AppShell>;
}
