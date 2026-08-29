import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { createClient } from '@/lib/supabase/server';

const n = (v: any) => Number(v || 0);
const qty = (v: any, d = 2) => n(v).toLocaleString('en-US', { maximumFractionDigits: d });
const pct = (v: any) => `${Math.round(n(v) * 100)}%`;
const rate = (v: any, unit: string) => v == null ? '—' : `${n(v).toFixed(4)} MH/${unit}`;
const mh = (v: any) => `${n(v).toFixed(2)} MH`;

export default async function EstimatorIntelligencePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('full_name,company_id,role').eq('id', user.id).single();
  if (!profile?.company_id) redirect('/login');
  if (profile.role === 'employee') redirect('/employee');
  const companyId = profile.company_id;

  const [
    { data: outputGuidance }, { data: rateGuidance }, { data: outliers },
    { data: measurements }, { data: sets }, { data: estimates }, { count: assemblyCount },
  ] = await Promise.all([
    supabase.from('takeoff_output_rate_guidance').select('*').eq('company_id', companyId).limit(750),
    supabase.from('carez_production_rate_guidance').select('*').eq('company_id', companyId).order('evidence_weight', { ascending: false }),
    supabase.from('carez_production_guidance_samples').select('*').eq('company_id', companyId).eq('included_for_guidance', false).order('completed_at', { ascending: false }).limit(50),
    supabase.from('takeoff_measurements').select('id,takeoff_set_id,name,location,drawing_reference,status').eq('company_id', companyId),
    supabase.from('takeoff_sets').select('id,estimate_id,name,revision_label,status').eq('company_id', companyId),
    supabase.from('estimates').select('id,estimate_number,name,version,status').eq('company_id', companyId),
    supabase.from('concrete_assemblies').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('active', true),
  ]);

  const measurementMap = new Map((measurements || []).map((x: any) => [x.id, x]));
  const setMap = new Map((sets || []).map((x: any) => [x.id, x]));
  const estimateMap = new Map((estimates || []).map((x: any) => [x.id, x]));
  const rows = outputGuidance || [];
  const productionRows = rateGuidance || [];
  const baselineMH = rows.reduce((sum: number, x: any) => sum + n(x.published_estimated_man_hours), 0);
  const guidedMH = rows.reduce((sum: number, x: any) => sum + n(x.guided_estimated_man_hours), 0);
  const comparable = rows.filter((x: any) => x.carez_man_hours_per_unit != null);
  const increase = comparable.filter((x: any) => x.guidance_direction === 'increase');
  const decrease = comparable.filter((x: any) => x.guidance_direction === 'decrease');
  const cleanPackages = productionRows.reduce((sum: number, x: any) => sum + n(x.sample_packages), 0);
  const excludedPackages = productionRows.reduce((sum: number, x: any) => sum + n(x.excluded_outliers), 0);

  return <AppShell userName={profile.full_name || user.email || 'Owner'}><div className="contractor-page">
    <div className="command-hero">
      <div><div className="section-kicker">CAREZ ESTIMATING INTELLIGENCE</div><h1>Reference Baseline → Carez Standard</h1><p>National reference rates start the estimate. Clean completed Work Packages teach Carez how this company actually performs. Faster history lowers labor cautiously; slower history raises the warning before margin disappears.</p></div>
      <div className="command-actions"><Link className="button" href="/takeoff">Takeoff + Assemblies</Link><Link className="button secondary" href="/production">Production Control</Link><Link className="button secondary" href="/production/work-packages">Work Packages</Link></div>
    </div>

    <div className="alert info"><strong>Guidance does not silently rewrite an estimate.</strong> Published assembly versions remain the contractual/audit baseline. This page previews what current Carez evidence supports; a future promoted assembly version will make an adopted rate explicit and traceable.</div>

    <div className="command-grid section">
      <div className="command-card"><div className="command-label">Published Assemblies</div><div className="command-value">{assemblyCount || 0}</div><div className="command-help">Versioned concrete methods available to takeoff.</div></div>
      <div className={`command-card ${productionRows.length ? 'good' : 'watch'}`}><div className="command-label">Learned Work Types</div><div className="command-value">{productionRows.length}</div><div className="command-help">Tasks with clean completed-package evidence.</div></div>
      <div className="command-card"><div className="command-label">Clean Package Samples</div><div className="command-value">{cleanPackages}</div><div className="command-help">Completed quantities with approved employee time.</div></div>
      <div className={`command-card ${excludedPackages ? 'watch' : 'good'}`}><div className="command-label">Held-Out Outliers</div><div className="command-value">{excludedPackages}</div><div className="command-help">Kept in the audit trail but blocked from steering bids.</div></div>
      <div className={`command-card ${comparable.length ? 'good' : ''}`}><div className="command-label">Takeoff Lines With Signal</div><div className="command-value">{comparable.length}</div><div className="command-help">Current labor outputs with comparable Carez history.</div></div>
    </div>

    <section className="section">
      <div className="section-heading"><div><div className="section-kicker">ESTIMATE PREVIEW</div><div className="section-title">What Carez Evidence Would Change</div><div className="section-heading-meta">This is a preview only. It compares the exact published baseline used by each takeoff output against clean company production for the same task and unit.</div></div></div>
      {rows.length === 0 ? <div className="empty-state"><div><div className="title">No assembly labor outputs yet</div><div className="meta">Once a takeoff generates labor, Carez will compare its published baseline against company production here.</div><div className="action-row"><Link className="button" href="/takeoff">Create Takeoff</Link></div></div></div> : <>
        <div className="metric-grid">
          <div className="metric-card"><div className="label">Published Labor</div><div className="metric-value">{mh(baselineMH)}</div><div className="metric-detail">Current immutable assembly output.</div></div>
          <div className="metric-card brand"><div className="label">Carez-Guided Preview</div><div className="metric-value">{mh(guidedMH)}</div><div className="metric-detail">Evidence-weighted preview, not an estimate mutation.</div></div>
          <div className={`metric-card ${increase.length ? 'warning' : 'positive'}`}><div className="label">Carry More Labor</div><div className="metric-value">{increase.length}</div><div className="metric-detail">Carez history is slower than baseline.</div></div>
          <div className={`metric-card ${decrease.length ? 'positive' : ''}`}><div className="label">Possible Reduction</div><div className="metric-value">{decrease.length}</div><div className="metric-detail">Only after enough evidence exists.</div></div>
        </div>
        <div className="data-table-wrap section"><table className="data-table"><thead><tr><th>Estimate / Object</th><th>Work</th><th>Published</th><th>Carez Actual</th><th>Evidence</th><th>Guided</th><th>MH Delta</th><th>Direction</th></tr></thead><tbody>{rows.map((x: any) => {
          const m: any = measurementMap.get(x.measurement_id);
          const s: any = m ? setMap.get(m.takeoff_set_id) : null;
          const e: any = s ? estimateMap.get(s.estimate_id) : null;
          return <tr key={x.takeoff_output_id}>
            <td><strong>{e ? `${e.estimate_number}-R${e.version}` : 'Takeoff'}</strong><div className="meta">{m?.name || s?.name || 'Measured object'}</div></td>
            <td><strong>{x.label}</strong><div className="meta">{qty(x.production_quantity)} {x.production_unit}</div></td>
            <td>{rate(x.published_baseline_man_hours_per_unit, x.production_unit)}</td>
            <td>{rate(x.carez_man_hours_per_unit, x.production_unit)}{x.sample_packages != null && <div className="meta">{x.sample_packages} pkg · {x.sample_projects} jobs</div>}</td>
            <td>{x.carez_man_hours_per_unit == null ? '—' : pct(x.evidence_weight)}<div className="meta">{x.confidence}</div></td>
            <td><strong>{rate(x.recommended_man_hours_per_unit, x.production_unit)}</strong><div className="meta">{x.guidance_reason}</div></td>
            <td>{x.carez_man_hours_per_unit == null ? '—' : `${n(x.guidance_delta_man_hours) >= 0 ? '+' : ''}${n(x.guidance_delta_man_hours).toFixed(2)} MH`}</td>
            <td><span className={`status ${x.guidance_direction === 'increase' ? 'on-hold' : x.guidance_direction === 'decrease' ? 'completed' : x.guidance_direction === 'hold' ? 'active' : ''}`}>{String(x.guidance_direction).replaceAll('_', ' ')}</span></td>
          </tr>;
        })}</tbody></table></div>
      </>}
    </section>

    <section className="section">
      <div className="section-heading"><div><div className="section-kicker">CLEAN COMPANY PRODUCTION</div><div className="section-title">Evidence by Physical Work Type</div><div className="section-heading-meta">Only completed Work Packages with approved employee time and trusted quantities enter this model. Evidence strengthens continuously across packages and distinct jobs rather than flipping after an arbitrary job count.</div></div></div>
      {productionRows.length === 0 ? <div className="empty-state"><div><div className="title">No clean Carez production samples yet</div><div className="meta">That is expected until the first physical Work Package is completed and its employee time is approved. Carez will not fabricate a company production rate from an estimate.</div><div className="action-row"><Link className="button" href="/production/work-packages">Open Work Packages</Link></div></div></div> : <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Work</th><th>Unit</th><th>Clean Packages</th><th>Jobs</th><th>Held Out</th><th>Carez Actual</th><th>Median</th><th>Evidence</th><th>Stage</th></tr></thead><tbody>{productionRows.map((x: any) => <tr key={`${x.production_task_id}-${x.unit}`}><td><strong>{x.task_name}</strong></td><td>{x.unit}</td><td>{x.sample_packages}</td><td>{x.sample_projects}</td><td>{x.excluded_outliers}</td><td><strong>{rate(x.carez_man_hours_per_unit, x.unit)}</strong></td><td>{rate(x.median_man_hours_per_unit, x.unit)}</td><td>{pct(x.evidence_weight)}<div className="meta">{x.confidence}</div></td><td>{x.recommendation_stage}</td></tr>)}</tbody></table></div>}
    </section>

    {(outliers || []).length > 0 && <section className="section">
      <div className="section-heading"><div><div className="section-kicker">QUALITY CONTROL</div><div className="section-title">Packages Held Out of Future-Bid Guidance</div><div className="section-heading-meta">These records are never deleted. They remain traceable to the job, quantity and approved MH, but unusual performance does not automatically teach future estimates.</div></div></div>
      <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Completed</th><th>Job / Package</th><th>Work</th><th>Actual</th><th>Group Median</th><th>Reason</th></tr></thead><tbody>{(outliers || []).map((x: any) => <tr key={x.operation_id}><td>{x.completed_date}</td><td>{x.job_number} — {x.package_name}</td><td>{x.task_name}</td><td>{rate(x.man_hours_per_unit, x.unit)}</td><td>{rate(x.median_man_hours_per_unit, x.unit)}</td><td>{String(x.guidance_review_reason).replaceAll('_', ' ')}</td></tr>)}</tbody></table></div>
    </section>}

    <section className="section"><div className="surface"><div className="surface-header"><div><div className="surface-title">How Carez Protects the Estimate</div><div className="surface-subtitle">Company history can improve the estimator without teaching it bad habits.</div></div></div><div className="surface-body"><div className="project-list">
      <div><strong>1. Reference baseline stays visible.</strong><div className="meta">The published National/Carez assembly rate is never erased from historical estimates.</div></div>
      <div><strong>2. Clean field evidence earns weight gradually.</strong><div className="meta">Package count and distinct-job diversity both matter. Maximum automatic evidence weight is intentionally below 100%.</div></div>
      <div><strong>3. Slower actual production raises the preview immediately.</strong><div className="meta">Carez should not protect a generic baseline when its own field history says the work is taking more labor.</div></div>
      <div><strong>4. Faster production must prove itself before bids get cheaper.</strong><div className="meta">Evidence below 25% cannot lower the baseline, and later reductions remain capped by evidence strength.</div></div>
      <div><strong>5. Outliers remain auditable.</strong><div className="meta">Unusually fast or slow packages can be reviewed without allowing one abnormal job to rewrite future estimates.</div></div>
    </div></div></div></section>
  </div></AppShell>;
}
