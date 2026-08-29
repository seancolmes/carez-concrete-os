import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { createClient } from '@/lib/supabase/server';

const qty = (n: any) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 1 });
const money = (n: any) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n || 0));

export default async function PlanTakeoffLanding() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('full_name,company_id,role').eq('id', user.id).single();
  if (!profile?.company_id) redirect('/login');
  if (profile.role === 'employee') redirect('/employee');
  const companyId = profile.company_id;

  const [{ data: sets }, { data: estimates }, { data: presentations }, { data: summaries }] = await Promise.all([
    supabase.from('takeoff_sets').select('id,estimate_id,name,revision_label,status,source_document_id,source_filename,page_count,created_at').eq('company_id', companyId).eq('status', 'active').order('created_at', { ascending: false }),
    supabase.from('estimates').select('id,estimate_number,name,version,status').eq('company_id', companyId),
    supabase.from('proposal_presentations').select('estimate_id,proposal_number,status').eq('company_id', companyId),
    supabase.from('estimate_takeoff_summary').select('*').eq('company_id', companyId),
  ]);

  const estimateMap = new Map((estimates || []).map((e: any) => [e.id, e]));
  const proposalMap = new Map((presentations || []).map((p: any) => [p.estimate_id, p]));
  const summaryMap = new Map((summaries || []).map((s: any) => [s.estimate_id, s]));

  return <AppShell userName={profile.full_name || user.email || 'Owner'}><div className="contractor-page">
    <div className="command-hero"><div><div className="section-kicker">Desktop Estimating</div><h1>Plan Takeoff</h1><p>Open a PDF plan set, calibrate each sheet, and draw concrete quantities directly into the same assemblies and estimate lines used by Carez.</p></div><div className="command-actions"><Link className="button secondary" href="/takeoff">Takeoff + Assemblies</Link><Link className="button secondary" href="/estimates">Estimates</Link></div></div>

    <div className="alert info"><strong>One measurement chain:</strong> PDF geometry → measured LF/SF/EA → concrete assembly → labor/material/equipment quantities → estimate → budget → Work Package. The drawing tool does not create a separate takeoff file that has to be re-entered later.</div>

    <section className="section"><div className="section-heading"><div><div className="section-kicker">Takeoff Sets</div><div className="section-title">Choose the Estimate Revision</div><div className="section-heading-meta">Create a new set from Takeoff + Assemblies if the estimate is not listed here.</div></div></div>
      {(sets || []).length === 0 ? <div className="empty-state"><div><div className="title">No active takeoff sets</div><div className="meta">Create an estimate and takeoff set first.</div><div className="section"><Link className="button" href="/takeoff">Create Takeoff Set</Link></div></div></div> :
      <div className="project-list">{(sets || []).map((set: any) => {
        const estimate: any = estimateMap.get(set.estimate_id);
        const proposal: any = proposalMap.get(set.estimate_id);
        const summary: any = summaryMap.get(set.estimate_id) || {};
        const locked = Boolean(proposal) || !estimate || ['accepted','approved','superseded'].includes(estimate.status);
        return <article className="project-card" key={set.id}><header className="project-header"><div><div className="project-name">{set.name}</div><div className="project-location">{estimate ? `${estimate.estimate_number}-R${estimate.version} — ${estimate.name}` : 'Estimate'} · {set.revision_label}</div></div><span className={`status ${locked ? 'on-hold' : 'active'}`}>{locked ? 'Read Only' : set.source_document_id ? 'Drawing Ready' : 'Needs Plans'}</span></header><section className="project-section"><div className="metric-grid"><div className="metric-card"><div className="label">Sheets</div><div className="metric-value">{set.page_count || '—'}</div></div><div className="metric-card"><div className="label">Objects</div><div className="metric-value">{Number(summary.active_measurements || 0)}</div></div><div className="metric-card"><div className="label">Generated Labor</div><div className="metric-value">{qty(summary.takeoff_man_hours)} MH</div></div><div className="metric-card brand"><div className="label">Direct Cost</div><div className="metric-value">{money(summary.takeoff_direct_cost)}</div></div></div><div className="row section"><div><div className="title">{set.source_filename || 'No PDF attached yet'}</div><div className="meta">{locked && proposal ? `Issued as ${proposal.proposal_number}. Drawing revision is preserved.` : 'Open the workspace to attach/calibrate plans and measure concrete.'}</div></div><Link className="button" href={`/takeoff/${set.id}`}>{set.source_document_id ? 'Open Drawing Workspace' : 'Attach Plans'}</Link></div></section></article>;
      })}</div>}
    </section>
  </div></AppShell>;
}
