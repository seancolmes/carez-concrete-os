import { redirect, notFound } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { createClient } from '@/lib/supabase/server';
import { TakeoffAssemblyBuilderShell } from '@/components/takeoff/TakeoffAssemblyBuilderShell';
import { TakeoffPlanUpload } from '@/components/takeoff/TakeoffPlanUpload';
import { TakeoffSheetAutoNaming } from '@/components/takeoff/TakeoffSheetAutoNaming';
import pageStyles from './TakeoffDrawingPage.module.css';

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
    { data: estimate }, { data: presentation }, { data: document }, { data: sheets }, { data: scaleRegions }, { data: measurements },
    { data: assemblies }, { data: versions }, { data: variables }, { data: sections }, { data: riskClasses }, { data: methodProfiles },
  ] = await Promise.all([
    supabase.from('estimates').select('id,estimate_number,name,version,status').eq('id', set.estimate_id).eq('company_id', companyId).maybeSingle(),
    supabase.from('proposal_presentations').select('id,proposal_number,status').eq('estimate_id', set.estimate_id).eq('company_id', companyId).limit(1).maybeSingle(),
    set.source_document_id ? supabase.from('company_documents').select('id,title,storage_path,mime_type').eq('id', set.source_document_id).eq('company_id', companyId).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('takeoff_sheets').select('*').eq('takeoff_set_id', setId).eq('company_id', companyId).order('page_number'),
    supabase.from('takeoff_scale_regions').select('*').eq('takeoff_set_id', setId).eq('company_id', companyId).order('is_default', { ascending: false }).order('created_at'),
    supabase.from('takeoff_measurements').select('id,sheet_id,scale_region_id,method_profile_id,estimate_section_id,assembly_version_id,name,location,drawing_reference,raw_quantity,raw_unit,geometry,geometry_anchor,geometry_offset_in,status,variables,risk_class_code').eq('takeoff_set_id', setId).eq('company_id', companyId).eq('status', 'active').order('created_at'),
    supabase.from('concrete_assemblies').select('id,code,name,category,primary_measurement,description,display_style').eq('company_id', companyId).eq('active', true).eq('direct_takeoff_enabled', true).order('category').order('name'),
    supabase.from('concrete_assembly_versions').select('id,assembly_id,version_no,status,default_risk_class_code,source_label,source_reference,render_config').eq('company_id', companyId).eq('status', 'published').order('version_no', { ascending: false }),
    supabase.from('concrete_assembly_variables').select('id,assembly_version_id,variable_key,label,value_type,unit,default_value,options,min_value,max_value,required,help_text,sort_order,activation_rule,input_role,requires_verification,expose_in_takeoff').eq('company_id', companyId).order('sort_order'),
    supabase.from('estimate_sections').select('id,name,scope_type,sort_order').eq('estimate_id', set.estimate_id).eq('company_id', companyId).order('sort_order'),
    supabase.from('li_risk_classes').select('code,name,employer_rate_per_hour,tax_year').eq('company_id', companyId).eq('active', true).order('code'),
    supabase.from('takeoff_method_profiles').select('id,assembly_version_id,revision_no,name,status,method_inputs,verification_notes,verified_by,verified_at,profile_kind,variant_code').eq('takeoff_set_id', setId).eq('company_id', companyId).eq('status', 'verified').order('revision_no', { ascending: false }),
  ]);

  const [
    { data: builderAssemblies }, { data: builderVersions }, { data: builderVariables }, { data: builderComponents },
    { data: builderChildren }, { data: builderBindings }, { data: builderFolders }, { data: builderCatalogItems },
  ] = await Promise.all([
    supabase.from('concrete_assemblies').select('id,folder_id,code,name,category,primary_measurement,description,display_style,direct_takeoff_enabled,active').eq('company_id', companyId).eq('active', true).order('category').order('name'),
    supabase.from('concrete_assembly_versions').select('id,assembly_id,version_no,status,source_type,source_label,source_reference,default_risk_class_code,assembly_code_snapshot,assembly_name_snapshot,category_snapshot,primary_measurement_snapshot,description_snapshot,render_config,created_at,published_at').eq('company_id', companyId).order('assembly_id').order('version_no', { ascending: false }),
    supabase.from('concrete_assembly_variables').select('*').eq('company_id', companyId).order('assembly_version_id').order('sort_order'),
    supabase.from('concrete_assembly_components').select('*').eq('company_id', companyId).order('assembly_version_id').order('sort_order'),
    supabase.from('concrete_assembly_children').select('*').eq('company_id', companyId).order('assembly_version_id').order('sort_order'),
    supabase.from('concrete_assembly_property_bindings').select('*').eq('company_id', companyId).order('assembly_version_id').order('sort_order'),
    supabase.from('concrete_assembly_folders').select('*').eq('company_id', companyId).eq('active', true).order('sort_order').order('name'),
    supabase.from('cost_catalog_items').select('id,name,description,default_unit,default_unit_cost,vendor_name,sku,cost_code_id').eq('company_id', companyId).eq('active', true).order('name'),
  ]);

  const measurementIds = (measurements || []).map((m: any) => m.id);
  let summaries: any[] = [];
  if (measurementIds.length) {
    const { data } = await supabase.from('takeoff_measurement_outputs')
      .select('measurement_id,component_key,label,estimate_item_type,production_quantity,production_unit,estimated_man_hours,unit_cost,cost_source,direct_cost,pricing_status,is_active,resource_behavior,estimate_visible,formula_trace')
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
  const estimateLabel = estimate ? `${estimate.estimate_number}-R${estimate.version}` : 'Estimate';

  const workspaceProps = {
    takeoffSet: set,
    estimate,
    pdfUrl: pdfUrl || '',
    sourceTitle: document?.title || 'Plan set',
    initialSheets: sheets || [],
    scaleRegions: scaleRegions || [],
    initialMeasurements: measurements || [],
    measurementSummaries: summaries,
    assemblies: assemblies || [],
    versions: versions || [],
    variables: variables || [],
    sections: sections || [],
    riskClasses: riskClasses || [],
    methodProfiles: methodProfiles || [],
    locked,
  };

  const builderData = {
    assemblies: builderAssemblies || [],
    versions: builderVersions || [],
    variables: builderVariables || [],
    components: builderComponents || [],
    children: builderChildren || [],
    bindings: builderBindings || [],
    folders: builderFolders || [],
    catalogItems: builderCatalogItems || [],
    measurements: measurements || [],
  };

  return <AppShell userName={profile.full_name || user.email || 'Owner'}>
    <div className="takeoff-app-page">
      <header className={pageStyles.identityStrip}>
        <div className={pageStyles.identity}>
          <strong className={pageStyles.title}>{set.name}</strong>
          <div className={pageStyles.meta}>
            <span className={pageStyles.estimate}>{estimateLabel}</span>
            {set.revision_label && <><span className={pageStyles.separator} aria-hidden="true">•</span><span className={pageStyles.revision}>{set.revision_label}</span></>}
          </div>
        </div>
        {locked&&<span className={pageStyles.lock}>Read only</span>}
      </header>

      {locked && <div className="takeoff-app-notice"><strong>Issued revision.</strong> Takeoff remains reviewable, but geometry, scale and deletion are locked. Create the next estimate revision to change scope.</div>}

      {!document || !pdfUrl ? <div className="takeoff-upload-state"><div className="takeoff-upload-card"><div className="section-kicker">SOURCE DRAWINGS</div><h1>Attach the PDF plan set</h1><p>This drawing becomes the permanent source for this estimate revision. Once attached, Carez opens the professional takeoff workspace.</p>{locked ? <div className="empty-state"><div><div className="title">No source drawing is attached to this locked revision.</div></div></div> : <TakeoffPlanUpload companyId={companyId} takeoffSetId={setId} />}</div></div> : <>
      <TakeoffSheetAutoNaming takeoffSetId={setId} pdfUrl={pdfUrl} initialSheets={sheets || []} locked={locked} />
      <TakeoffAssemblyBuilderShell setId={setId} workspaceProps={workspaceProps} builderData={builderData} />
      </>}
    </div>
  </AppShell>;
}