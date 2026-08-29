import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { createClient } from '@/lib/supabase/server';
import { createTakeoffSet, createAssemblyMeasurement, deleteTakeoffMeasurement, updateEstimatingLaborProfile, updateTakeoffOutputPrice } from './actions';

const money = (n: any) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n || 0));
const qty = (n: any, d = 2) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: d });
const label = (s: any) => String(s || '').replaceAll('_', ' ');

export default async function TakeoffPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('full_name,company_id,role').eq('id', user.id).single();
  if (!profile?.company_id) redirect('/login');
  if (profile.role === 'employee') redirect('/employee');
  const companyId = profile.company_id;

  const [
    { data: estimates }, { data: sections }, { data: presentations }, { data: sets }, { data: measurements }, { data: outputs },
    { data: assemblies }, { data: versions }, { data: variables }, { data: components }, { data: takeoffSummaries },
    { data: laborProfile }, { data: riskClasses },
  ] = await Promise.all([
    supabase.from('estimates').select('id,estimate_number,name,version,status,lead_id,project_id').eq('company_id', companyId).order('created_at', { ascending: false }),
    supabase.from('estimate_sections').select('id,estimate_id,name,scope_type,sort_order').eq('company_id', companyId).order('sort_order'),
    supabase.from('proposal_presentations').select('estimate_id,proposal_number,status').eq('company_id', companyId),
    supabase.from('takeoff_sets').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
    supabase.from('takeoff_measurements').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
    supabase.from('takeoff_measurement_outputs').select('*').eq('company_id', companyId).order('created_at'),
    supabase.from('concrete_assemblies').select('*').eq('company_id', companyId).eq('active', true).order('category').order('name'),
    supabase.from('concrete_assembly_versions').select('*').eq('company_id', companyId).eq('status', 'published').order('version_no', { ascending: false }),
    supabase.from('concrete_assembly_variables').select('*').eq('company_id', companyId).order('sort_order'),
    supabase.from('concrete_assembly_components').select('*').eq('company_id', companyId).order('sort_order'),
    supabase.from('estimate_takeoff_summary').select('*').eq('company_id', companyId),
    supabase.from('estimating_labor_profiles').select('*').eq('company_id', companyId).eq('active', true).eq('is_default', true).maybeSingle(),
    supabase.from('li_risk_classes').select('code,name,employer_rate_per_hour,tax_year').eq('company_id', companyId).eq('active', true).order('code'),
  ]);

  const issued = new Set((presentations || []).map((p: any) => p.estimate_id));
  const editableEstimates = (estimates || []).filter((e: any) => !issued.has(e.id) && !['accepted', 'approved', 'superseded'].includes(e.status));
  const estimateMap = new Map((estimates || []).map((e: any) => [e.id, e]));
  const sectionByEstimate = new Map<string, any[]>();
  for (const s of sections || []) { const rows = sectionByEstimate.get(s.estimate_id) || []; rows.push(s); sectionByEstimate.set(s.estimate_id, rows); }
  const assemblyMap = new Map((assemblies || []).map((a: any) => [a.id, a]));
  const versionMap = new Map((versions || []).map((v: any) => [v.id, v]));
  const latestVersionByAssembly = new Map<string, any>();
  for (const v of versions || []) if (!latestVersionByAssembly.has(v.assembly_id)) latestVersionByAssembly.set(v.assembly_id, v);
  const varsByVersion = new Map<string, any[]>();
  for (const v of variables || []) { const rows = varsByVersion.get(v.assembly_version_id) || []; rows.push(v); varsByVersion.set(v.assembly_version_id, rows); }
  const compsByVersion = new Map<string, any[]>();
  for (const c of components || []) { const rows = compsByVersion.get(c.assembly_version_id) || []; rows.push(c); compsByVersion.set(c.assembly_version_id, rows); }
  const measurementsBySet = new Map<string, any[]>();
  for (const m of measurements || []) { const rows = measurementsBySet.get(m.takeoff_set_id) || []; rows.push(m); measurementsBySet.set(m.takeoff_set_id, rows); }
  const outputsByMeasurement = new Map<string, any[]>();
  for (const o of outputs || []) { const rows = outputsByMeasurement.get(o.measurement_id) || []; rows.push(o); outputsByMeasurement.set(o.measurement_id, rows); }
  const takeoffSummaryMap = new Map((takeoffSummaries || []).map((s: any) => [s.estimate_id, s]));

  const activeSets = (sets || []).filter((s: any) => s.status === 'active');
  const activeMeasurements = (measurements || []).filter((m: any) => m.status === 'active');
  const missingPrices = (outputs || []).filter((o: any) => ['missing_price', 'missing_labor_rate'].includes(o.pricing_status) && Number(o.production_quantity || o.estimated_man_hours || 0) > 0);
  const totalMH = (outputs || []).reduce((sum: number, o: any) => sum + Number(o.estimated_man_hours || 0), 0);

  return <AppShell userName={profile.full_name || user.email || 'Owner'}><div className="contractor-page">
    <div className="command-hero">
      <div><div className="section-kicker">Estimating Engine</div><h1>Takeoff + Concrete Assemblies</h1><p>Measure concrete once. Carez turns the same physical object into material quantities, labor MH, estimate lines, budget lineage and future Work Packages.</p></div>
      <div className="command-actions"><Link className="button" href="/takeoff/plans">Open Plan Takeoff</Link><Link className="button secondary" href="/estimates">Estimates</Link><Link className="button secondary" href="/bid-intelligence">Bid Intelligence</Link></div>
    </div>

    <div className="alert info"><strong>PDF drawing takeoff is live.</strong> Open Plan Takeoff to upload plans, calibrate each sheet and draw LF, SF or count measurements directly into these assemblies. Manual quantity entry remains available below for field dimensions, sketches and quick bids.</div>

    <div className="command-grid section">
      <div className="command-card"><div className="command-label">Active Takeoff Sets</div><div className="command-value">{activeSets.length}</div></div>
      <div className="command-card"><div className="command-label">Measured Objects</div><div className="command-value">{activeMeasurements.length}</div></div>
      <div className={`command-card ${missingPrices.length ? 'watch' : 'good'}`}><div className="command-label">Pricing Holds</div><div className="command-value">{missingPrices.length}</div></div>
      <div className="command-card"><div className="command-label">Assembly Labor</div><div className="command-value">{qty(totalMH, 1)} MH</div></div>
      <div className="command-card"><div className="command-label">Published Assemblies</div><div className="command-value">{(assemblies || []).length}</div></div>
    </div>

    <section className="section">
      <div className="section-heading"><div><div className="section-kicker">Start</div><div className="section-title">Create Takeoff Set</div><div className="section-heading-meta">One takeoff set belongs to one estimate revision. Once its proposal is issued, the quantities and drawing record lock with that revision.</div></div></div>
      {editableEstimates.length === 0 ? <div className="empty-state"><div><div className="title">No editable estimate revisions</div><div className="meta">Start an estimate from Leads or Estimates. Issued proposal revisions stay immutable.</div></div></div> :
      <details className="controls-disclosure"><summary>New Takeoff Set</summary><div className="controls-body"><form action={createTakeoffSet} className="form">
        <div className="grid grid2"><label className="field"><span>Estimate Revision</span><select name="estimate_id" required defaultValue=""><option value="" disabled>Select estimate</option>{editableEstimates.map((e: any) => <option key={e.id} value={e.id}>{e.estimate_number}-R{e.version} — {e.name}</option>)}</select></label><label className="field"><span>Takeoff Name</span><input name="name" required placeholder="Structural Concrete Takeoff" /></label></div>
        <div className="grid grid2"><label className="field"><span>Drawing Revision</span><input name="revision_label" defaultValue="Current" placeholder="Permit Set / Rev 2 / Addendum 1" /></label><label className="field"><span>Expected Source File</span><input name="source_filename" placeholder="S1-S5 Structural.pdf" /></label></div>
        <label className="field"><span>Notes</span><textarea name="notes" placeholder="Plan date, addenda, takeoff assumptions..." /></label>
        <button className="button">Create Takeoff Set</button>
      </form></div></details>}
    </section>

    <section className="section">
      <div className="section-heading"><div><div className="section-kicker">Working Takeoffs</div><div className="section-title">Drawings → Physical Quantities → Cost</div><div className="section-heading-meta">Use the PDF workspace for normal estimating. Manual entry is the controlled fallback—not a separate estimating system.</div></div></div>
      {activeSets.length === 0 ? <div className="empty-state"><div><div className="title">No active takeoff yet</div><div className="meta">Create a takeoff set above, then attach plans or enter a measured object.</div></div></div> :
      <div className="project-list">{activeSets.map((set: any) => {
        const estimate: any = estimateMap.get(set.estimate_id);
        const locked = !estimate || issued.has(set.estimate_id) || ['accepted', 'approved', 'superseded'].includes(estimate.status);
        const ms = measurementsBySet.get(set.id) || [];
        const sum: any = takeoffSummaryMap.get(set.estimate_id) || {};
        const secs = sectionByEstimate.get(set.estimate_id) || [];
        return <article className="project-card" key={set.id}>
          <header className="project-header"><div><div className="project-name">{set.name}</div><div className="project-location">{estimate ? `${estimate.estimate_number}-R${estimate.version} — ${estimate.name}` : 'Estimate'} · {set.revision_label}{set.source_filename ? ` · ${set.source_filename}` : ''}</div></div><span className={`status ${locked ? 'on-hold' : set.source_document_id ? 'completed' : 'active'}`}>{locked ? 'Locked' : set.source_document_id ? 'Plans Attached' : 'Working'}</span></header>
          <section className="project-section">
            <div className="metric-grid"><div className="metric-card"><div className="label">Objects</div><div className="metric-value">{ms.length}</div></div><div className="metric-card"><div className="label">Generated MH</div><div className="metric-value">{qty(sum.takeoff_man_hours, 1)}</div></div><div className={`metric-card ${Number(sum.missing_price_outputs || 0) ? 'warning' : 'positive'}`}><div className="label">Unpriced Outputs</div><div className="metric-value">{Number(sum.missing_price_outputs || 0)}</div></div><div className="metric-card brand"><div className="label">Takeoff Direct Cost</div><div className="metric-value">{money(sum.takeoff_direct_cost)}</div></div></div>
            <div className="action-row section"><Link className="button" href={`/takeoff/${set.id}`}>{set.source_document_id ? 'Open PDF Workspace' : 'Attach Plans + Draw'}</Link>{locked && <span className="meta">Read-only historical takeoff revision</span>}</div>

            {!locked && <details className="controls-disclosure section"><summary>Manual Quantity Entry</summary><div className="controls-body"><div className="alert info"><strong>Use this when the quantity did not come from the PDF:</strong> field dimensions, sketch, owner-provided quantity, fast ROM, or another verified source.</div><div className="project-list">{(assemblies || []).map((a: any) => {
              const v: any = latestVersionByAssembly.get(a.id); if (!v) return null;
              const av = varsByVersion.get(v.id) || [];
              return <div className="surface" key={`${set.id}-${a.id}`}><div className="surface-header"><div><div className="surface-title">{a.name}</div><div className="surface-subtitle">Enter verified {a.primary_measurement}; Carez derives the remaining assembly quantities.</div></div></div><div className="surface-body"><form action={createAssemblyMeasurement} className="form">
                <input type="hidden" name="takeoff_set_id" value={set.id}/><input type="hidden" name="assembly_version_id" value={v.id}/>
                <div className="grid grid2"><label className="field"><span>Object / Area Name</span><input name="name" required placeholder={a.code === 'FTG-STRIP' ? 'Garage Footings' : a.code === 'WALL-STEM' ? 'North Basement Wall' : 'Driveway'}/></label><label className="field"><span>Measured Quantity ({a.primary_measurement})</span><input name="raw_quantity" type="number" min="0" step="0.01" required/></label></div>
                <div className="grid grid2"><label className="field"><span>Estimate Scope Area</span><select name="estimate_section_id" defaultValue=""><option value="">Unassigned</option>{secs.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label className="field"><span>L&I Phase / Class</span><select name="risk_class_code" defaultValue={v.default_risk_class_code || ''}><option value="">Review / not set</option>{(riskClasses || []).map((r: any) => <option key={`${a.id}-${r.code}-${r.tax_year}`} value={r.code}>{r.code} — {r.name}</option>)}</select></label></div>
                <div className="grid grid2"><label className="field"><span>Location / Zone</span><input name="location" placeholder="Garage / NW corner / Phase 1"/></label><label className="field"><span>Drawing / Source Reference</span><input name="drawing_reference" placeholder="Field measure / S2.1 / Detail 3-S5.2"/></label></div>
                <div className="grid grid2">{av.map((x: any) => <label className="field" key={x.id}><span>{x.label}{x.unit ? ` (${x.unit})` : ''}</span><input name={`var_${x.variable_key}`} type={x.value_type === 'number' ? 'number' : 'text'} step="any" min={x.min_value ?? undefined} max={x.max_value ?? undefined} required={Boolean(x.required && x.default_value === null)} defaultValue={x.default_value === null ? undefined : String(x.default_value)} placeholder={x.default_value === null ? 'Required from plans/detail' : undefined}/><small>{x.help_text}</small></label>)}</div>
                <button className="button">Add Object + Generate Estimate</button>
              </form></div></div>;
            })}</div></div></details>}

            <div className="project-list section">{ms.length === 0 ? <div className="empty-state"><div><div className="title">No measured objects yet</div><div className="meta">Open the PDF workspace or use manual entry above.</div></div></div> : ms.map((m: any) => {
              const v: any = versionMap.get(m.assembly_version_id); const a: any = v ? assemblyMap.get(v.assembly_id) : null;
              const os = outputsByMeasurement.get(m.id) || [];
              const missing = os.filter((o: any) => ['missing_price', 'missing_labor_rate'].includes(o.pricing_status) && Number(o.production_quantity || o.estimated_man_hours || 0) > 0);
              const mh = os.reduce((s: number, o: any) => s + Number(o.estimated_man_hours || 0), 0);
              const cost = os.reduce((s: number, o: any) => s + Number(o.direct_cost || 0), 0);
              return <div className="surface" key={m.id}><div className="surface-header"><div><div className="surface-title">{m.name}</div><div className="surface-subtitle">{a?.name || 'Assembly'} · {qty(m.raw_quantity)} {m.raw_unit}{m.location ? ` · ${m.location}` : ''}{m.drawing_reference ? ` · ${m.drawing_reference}` : ''} · {m.source === 'drawing' ? 'PDF geometry' : 'manual quantity'}</div></div><span className={`status ${missing.length ? 'on-hold' : 'completed'}`}>{missing.length ? `${missing.length} Price Hold` : 'Costed'}</span></div><div className="surface-body">
                <div className="metric-grid"><div className="metric-card"><div className="label">Budgeted Labor</div><div className="metric-value">{qty(mh, 1)} MH</div></div><div className="metric-card brand"><div className="label">Direct Cost</div><div className="metric-value">{money(cost)}</div></div></div>
                <div className="list section">{os.map((o: any) => <div className="row" key={o.id}><div><div className="title">{o.label}</div><div className="meta">{o.estimate_item_type === 'labor' ? `${qty(o.estimated_man_hours, 2)} MH from ${qty(o.production_quantity)} ${o.production_unit}${o.baseline_man_hours_per_unit ? ` @ ${qty(o.baseline_man_hours_per_unit, 4)} MH/${o.production_unit}` : ''}` : `${qty(o.production_quantity)} ${o.production_unit}`} · {label(o.pricing_status)}{o.cost_source ? ` · ${o.cost_source}` : ''}</div></div><div style={{textAlign:'right'}}><strong>{money(o.direct_cost)}</strong>{!locked && o.estimate_item_type !== 'labor' && o.pricing_status === 'missing_price' && Number(o.production_quantity || 0) > 0 && <form action={updateTakeoffOutputPrice} style={{display:'flex',gap:6,marginTop:6}}><input type="hidden" name="output_id" value={o.id}/><input name="unit_cost" type="number" step="0.01" min="0" required placeholder={`$/ ${o.production_unit}`} style={{maxWidth:120}}/><button className="button secondary" style={{padding:'6px 10px'}}>Set Price</button></form>}</div></div>)}</div>
                {missing.length > 0 && <div className="alert warning section"><strong>Estimate hold:</strong> resolve current material/equipment pricing before this estimate can be marked Ready to Send.</div>}
                {!locked && <form action={deleteTakeoffMeasurement} className="action-row section"><input type="hidden" name="measurement_id" value={m.id}/><button className="button secondary">Delete Object + Generated Lines</button></form>}
              </div></div>;
            })}</div>
          </section>
        </article>;
      })}</div>}
    </section>

    <section className="section">
      <div className="section-heading"><div><div className="section-kicker">Cost of a Man-Hour</div><div className="section-title">Estimating Labor Profile</div><div className="section-heading-meta">Productivity (MH/unit) and labor cost ($/MH) stay separate so Carez can learn field production without corrupting payroll/burden history.</div></div></div>
      <div className="grid grid2"><div className="surface"><div className="surface-body"><div className="metric-grid"><div className="metric-card brand"><div className="label">Current Burdened $ / MH</div><div className="metric-value">{laborProfile ? money(laborProfile.burdened_hourly_rate) : 'Missing'}</div><div className="metric-detail">Base L&I class {laborProfile?.base_risk_class_code || 'not set'}</div></div></div><div className="meta section">{laborProfile?.source_label || 'Configure a labor profile.'}{laborProfile?.source_hours ? ` · ${qty(laborProfile.source_hours, 2)} source hours` : ''}</div></div></div>
      <div className="surface"><div className="surface-body"><details className="controls-disclosure"><summary>Review / Update Labor Rate</summary><div className="controls-body"><form action={updateEstimatingLaborProfile} className="form"><label className="field"><span>Fully Burdened Labor Cost / MH</span><input name="burdened_hourly_rate" type="number" step="0.01" min="0" required defaultValue={laborProfile ? Number(laborProfile.burdened_hourly_rate) : undefined}/></label><label className="field"><span>Base L&I Class Included in That Rate</span><select name="base_risk_class_code" defaultValue={laborProfile?.base_risk_class_code || ''}><option value="">None / blended</option>{(riskClasses || []).map((r: any) => <option key={`${r.code}-${r.tax_year}`} value={r.code}>{r.code} — {r.name}</option>)}</select></label><label className="field"><span>Notes</span><input name="notes" placeholder="Why this is the right current estimating rate"/></label><button className="button secondary">Update Labor Profile</button></form></div></details></div></div></div>
    </section>

    <section className="section">
      <div className="section-heading"><div><div className="section-kicker">Versioned Recipes</div><div className="section-title">Concrete Assembly Library</div><div className="section-heading-meta">Published versions are immutable. Future Carez-calibrated productivity becomes a new version, so historical bids never move underneath us.</div></div></div>
      <div className="project-list">{(assemblies || []).map((a: any) => {
        const v: any = latestVersionByAssembly.get(a.id); if (!v) return null;
        const av = varsByVersion.get(v.id) || []; const ac = compsByVersion.get(v.id) || [];
        return <details className="controls-disclosure" key={a.id}><summary>{a.code} — {a.name} · {a.primary_measurement} · V{v.version_no}</summary><div className="controls-body"><div className="meta">{a.description}</div><div className="grid grid2 section"><div><div className="title">Inputs</div><div className="list">{av.map((x: any) => <div className="row" key={x.id}><div><strong>{x.label}</strong><div className="meta">{x.unit || x.value_type}{x.help_text ? ` · ${x.help_text}` : ''}</div></div><span>{x.default_value === null ? 'Required' : `Default ${String(x.default_value)}`}</span></div>)}</div></div><div><div className="title">Generated Cost / Production Lines</div><div className="list">{ac.map((c: any) => <div className="row" key={c.id}><div><strong>{c.label}</strong><div className="meta">{label(c.estimate_item_type)} · {c.output_unit}</div></div><span>{c.labor_rate_formula?.const !== undefined ? `${qty(c.labor_rate_formula.const, 4)} MH/${c.output_unit}` : c.labor_rate_formula?.op === 'piecewise_lte' ? 'Condition-based MH' : c.pricing_strategy === 'manual' ? 'Current price required' : 'Current cost'}</span></div>)}</div></div></div><div className="alert info section"><strong>Baseline source:</strong> {v.source_label || v.source_type}. {v.source_reference}</div></div></details>;
      })}</div>
    </section>
  </div></AppShell>;
}
