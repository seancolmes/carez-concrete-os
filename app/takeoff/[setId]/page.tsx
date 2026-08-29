import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { createClient } from '@/lib/supabase/server';
import { TakeoffDrawingWorkspace } from '@/components/takeoff/TakeoffDrawingWorkspace';
import { TakeoffPlanUpload } from '@/components/takeoff/TakeoffPlanUpload';

export default async function TakeoffDrawingPage({ params }: { params: Promise<{ setId: string }> }) {
  const { setId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('full_name,company_id,role').eq('id', user.id).single();
  if (!profile?.company_id) redirect('/login');
  if (profile.role === 'employee') redirect('/employee');
  const companyId = profile.company_id;

  const { data: set } = await supabase.from('takeoff_sets').select('*').eq('id', setId).eq('company_id', companyId).maybeSingle();
  if (!set) notFound();

  const [
    { data: estimate }, { data: presentation }, { data: document }, { data: sheets }, { data: measurements },
    { data: assemblies }, { data: versions }, { data: variables }, { data: sections }, { data: riskClasses },
  ] = await Promise.all([
    supabase.from('estimates').select('id,estimate_number,name,version,status').eq('id', set.estimate_id).eq('company_id', companyId).maybeSingle(),
    supabase.from('proposal_presentations').select('id,proposal_number,status').eq('estimate_id', set.estimate_id).eq('company_id', companyId).limit(1).maybeSingle(),
    set.source_document_id ? supabase.from('company_documents').select('id,title,storage_path,mime_type').eq('id', set.source_document_id).eq('company_id', companyId).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('takeoff_sheets').select('*').eq('takeoff_set_id', setId).eq('company_id', companyId).order('page_number'),
    supabase.from('takeoff_measurements').select('id,sheet_id,assembly_version_id,name,location,drawing_reference,raw_quantity,raw_unit,geometry,status,variables,risk_class_code').eq('takeoff_set_id', setId).eq('company_id', companyId).eq('status', 'active').order('created_at'),
    supabase.from('concrete_assemblies').select('id,code,name,category,primary_measurement,description').eq('company_id', companyId).eq('active', true).order('category').order('name'),
    supabase.from('concrete_assembly_versions').select('id,assembly_id,version_no,status,default_risk_class_code,source_label,source_reference').eq('company_id', companyId).eq('status', 'published').order('version_no', { ascending: false }),
    supabase.from('concrete_assembly_variables').select('id,assembly_version_id,variable_key,label,value_type,unit,default_value,min_value,max_value,required,help_text,sort_order').eq('company_id', companyId).order('sort_order'),
    supabase.from('estimate_sections').select('id,name,scope_type,sort_order').eq('estimate_id', set.estimate_id).eq('company_id', companyId).order('sort_order'),
    supabase.from('li_risk_classes').select('code,name,employer_rate_per_hour,tax_year').eq('company_id', companyId).eq('active', true).order('code'),
  ]);

  const measurementIds = (measurements || []).map((m: any) => m.id);
  let summaries: any[] = [];
  if (measurementIds.length) {
    const { data } = await supabase.from('takeoff_measurement_outputs')
      .select('measurement_id,estimated_man_hours,direct_cost,pricing_status')
      .eq('company_id', companyId)
      .in('measurement_id', measurementIds);
    summaries = data || [];
  }

  let pdfUrl: string | null = null;
  if (document?.storage_path) {
    const { data } = await supabase.storage.from('carez-documents').createSignedUrl(document.storage_path, 28800);
    pdfUrl = data?.signedUrl || null;
  }

  const locked = Boolean(presentation) || !estimate || ['accepted', 'approved', 'superseded'].includes(estimate.status);

  return <AppShell userName={profile.full_name || user.email || 'Owner'}>
    <div className="contractor-page">
      <div className="command-hero">
        <div>
          <div className="section-kicker">Graphical Takeoff</div>
          <h1>{set.name}</h1>
          <p>{estimate ? `${estimate.estimate_number}-R${estimate.version} — ${estimate.name}` : 'Estimate'} · {set.revision_label}{set.source_filename ? ` · ${set.source_filename}` : ''}</p>
        </div>
        <div className="command-actions"><Link className="button secondary" href="/takeoff">Back to Takeoff</Link><Link className="button secondary" href="/estimates">Estimate</Link></div>
      </div>

      {locked && <div className="alert warning"><strong>Issued revision — read only.</strong> Measurements remain visible, but drawing, calibration and deletion are locked. Create the next estimate/proposal revision for changed plans or scope.</div>}

      {!document || !pdfUrl ? <section className="section"><div className="surface"><div className="surface-header"><div><div className="surface-title">Attach PDF Plan Set</div><div className="surface-subtitle">The plan file becomes the permanent source drawing for this takeoff revision.</div></div></div><div className="surface-body">{locked ? <div className="empty-state"><div><div className="title">No source drawing is attached to this locked revision.</div></div></div> : <TakeoffPlanUpload companyId={companyId} takeoffSetId={setId} />}</div></div></section> :
      <TakeoffDrawingWorkspace
        takeoffSet={set}
        estimate={estimate}
        pdfUrl={pdfUrl}
        sourceTitle={document.title}
        initialSheets={sheets || []}
        initialMeasurements={measurements || []}
        measurementSummaries={summaries}
        assemblies={assemblies || []}
        versions={versions || []}
        variables={variables || []}
        sections={sections || []}
        riskClasses={riskClasses || []}
        locked={locked}
      />}
    </div>
  </AppShell>;
}
