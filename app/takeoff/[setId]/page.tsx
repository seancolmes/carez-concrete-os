import { redirect, notFound } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { createClient } from '@/lib/supabase/server';
import { TakeoffAssemblyBuilderShell } from '@/components/takeoff/TakeoffAssemblyBuilderShell';
import { TakeoffConditionWorkflowShell } from '@/components/takeoff/TakeoffConditionWorkflowShell';
import { CONDITION_ARCHETYPE_KEYS } from '@/lib/takeoff/conditions/types';
import { TakeoffPlanUpload } from '@/components/takeoff/TakeoffPlanUpload';
import { TakeoffSheetAutoNaming } from '@/components/takeoff/TakeoffSheetAutoNaming';
import pageStyles from './TakeoffDrawingPage.module.css';
import { resolveDerived3DSnapshot } from '@/lib/takeoff/conditions/derived3d/resolve.server';
import { TakeoffWorkspaceIdentity } from '@/components/takeoff/TakeoffWorkspaceIdentity';
import { buildSpecialistWorksheetModel } from '@/lib/takeoff/specialistWorksheet';

export default async function TakeoffDrawingPage({ params }: { params: Promise<{ setId: string }> }) {
  const { setId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('full_name,company_id,role').eq('id', user.id).single();
  if (!profile?.company_id) redirect('/login');
  if (profile.role === 'employee') redirect('/employee');
  const companyId = profile.company_id;

  // Dependency gate for retiring active Scope Recipe / Build Method authoring.
  // Legacy compatibility data remains intact, but the normal workflow only cuts over
  // when every governed pilot archetype has an active published concrete_condition_v1 contract.
  const { data: pilotArchetypes, error: pilotArchetypeError } = await supabase
    .from('platform_condition_archetypes')
    .select('id,code')
    .in('code', [...CONDITION_ARCHETYPE_KEYS])
    .eq('active', true);
  const pilotArchetypeIds = (pilotArchetypes || []).map((row: any) => row.id);
  let pilotArchetypeVersions: any[] = [];
  let pilotVersionError: any = null;
  if (pilotArchetypeIds.length === CONDITION_ARCHETYPE_KEYS.length) {
    const result = await supabase
      .from('platform_condition_archetype_versions')
      .select('archetype_id,status,engine_key')
      .in('archetype_id', pilotArchetypeIds)
      .eq('status', 'published')
      .eq('engine_key', 'concrete_condition_v1');
    pilotArchetypeVersions = result.data || [];
    pilotVersionError = result.error;
  }
  const conditionAuthoringActive = !pilotArchetypeError && !pilotVersionError && CONDITION_ARCHETYPE_KEYS.every((key) => {
    const archetype = (pilotArchetypes || []).find((row: any) => row.code === key);
    return Boolean(archetype && pilotArchetypeVersions.some((version: any) => version.archetype_id === archetype.id));
  });

  const { data: set } = await supabase.from('takeoff_sets').select('*').eq('id', setId).eq('company_id', companyId).maybeSingle();
  if (!set) notFound();

  const [
    { data: estimate }, { data: presentation }, { data: document }, { data: sheets }, { data: scaleRegions }, { data: measurements },
    { data: assemblies }, { data: versions }, { data: variables }, { data: sections }, { data: riskClasses }, { data: methodProfiles },
  ] = await Promise.all([
    supabase.from('estimates').select('id,estimate_number,name,version,status,project_id').eq('id', set.estimate_id).eq('company_id', companyId).maybeSingle(),
    supabase.from('proposal_presentations').select('id,proposal_number,status').eq('estimate_id', set.estimate_id).eq('company_id', companyId).limit(1).maybeSingle(),
    set.source_document_id ? supabase.from('company_documents').select('id,title,storage_path,mime_type').eq('id', set.source_document_id).eq('company_id', companyId).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('takeoff_sheets').select('*').eq('takeoff_set_id', setId).eq('company_id', companyId).order('page_number'),
    supabase.from('takeoff_scale_regions').select('*').eq('takeoff_set_id', setId).eq('company_id', companyId).order('is_default', { ascending: false }).order('created_at'),
    supabase.from('takeoff_measurements').select('id,sheet_id,scale_region_id,method_profile_id,estimate_section_id,assembly_version_id,name,location,drawing_reference,raw_quantity,raw_unit,geometry,geometry_anchor,geometry_offset_in,updated_at,status,variables,risk_class_code').eq('takeoff_set_id', setId).eq('company_id', companyId).eq('status', 'active').order('created_at'),
    supabase.from('concrete_assemblies').select('id,code,name,category,primary_measurement,description,display_style').eq('company_id', companyId).eq('active', true).eq('direct_takeoff_enabled', true).order('category').order('name'),
    supabase.from('concrete_assembly_versions').select('id,assembly_id,version_no,status,default_risk_class_code,source_label,source_reference,render_config').eq('company_id', companyId).eq('status', 'published').order('version_no', { ascending: false }),
    supabase.from('concrete_assembly_variables').select('id,assembly_version_id,variable_key,label,value_type,unit,default_value,options,min_value,max_value,required,help_text,sort_order,activation_rule,input_role,requires_verification,expose_in_takeoff').eq('company_id', companyId).order('sort_order'),
    supabase.from('estimate_sections').select('id,name,scope_type,sort_order').eq('estimate_id', set.estimate_id).eq('company_id', companyId).order('sort_order'),
    supabase.from('li_risk_classes').select('code,name,employer_rate_per_hour,tax_year').eq('company_id', companyId).eq('active', true).order('code'),
    supabase.from('takeoff_method_profiles').select('id,assembly_version_id,revision_no,name,status,method_inputs,verification_notes,verified_by,verified_at,profile_kind,variant_code').eq('takeoff_set_id', setId).eq('company_id', companyId).eq('status', 'verified').order('revision_no', { ascending: false }),
  ]);

  let builderData: any = null;
  if (!conditionAuthoringActive) {
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
    builderData = {
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
  }

  const measurementIds = (measurements || []).map((m: any) => m.id);
  let summaries: any[] = [];
  if (measurementIds.length) {
    const { data } = await supabase.from('takeoff_measurement_outputs')
      .select('id,measurement_id,component_key,label,estimate_item_type,catalog_item_id,production_quantity,production_unit,estimated_man_hours,unit_cost,cost_source,direct_cost,pricing_status,is_active,resource_behavior,estimate_visible,formula_trace,generated_estimate_item_id')
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
  const { data: project } = estimate?.project_id
    ? await supabase.from('projects').select('id,job_number,name,source_estimate_id').eq('id', estimate.project_id).eq('company_id', companyId).maybeSingle()
    : { data: null };

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

  const { data: conditionSummaries } = await supabase.from('project_condition_summary')
    .select('company_id,condition_id,takeoff_set_id,code,name,condition_version_id,revision_no,version_status,template_version_id,archetype_code,archetype_name,measurement_count,output_count,held_output_count,open_hold_count,direct_cost')
    .eq('company_id', companyId)
    .eq('takeoff_set_id', setId)
    .order('code')
    .order('revision_no', { ascending: false });

  const conditionVersionIds = [...new Set((conditionSummaries || [])
    .map((row: any) => row.condition_version_id)
    .filter(Boolean))] as string[];
  const conditionTemplateVersionIds = [...new Set((conditionSummaries || [])
    .map((row: any) => row.template_version_id)
    .filter(Boolean))] as string[];

  let conditionData: any = {
    conditions: conditionSummaries || [],
    versions: [],
    templateVersions: [],
    archetypeVersions: [],
    modules: [],
    roles: [],
    outputs: [],
    holds: [],
    reconciliation: [],
  };

  if (conditionVersionIds.length) {
    const [
      { data: conditionVersions },
      { data: conditionTemplateVersions },
      { data: conditionModules },
      { data: conditionRoles },
      { data: conditionOutputs },
      { data: conditionHolds },
      { data: conditionReconciliation },
    ] = await Promise.all([
      supabase.from('project_concrete_condition_versions')
        .select('id,template_version_id,archetype_version_id,status,plan_facts,method_inputs,production_inputs,commercial_inputs,drawing_inputs,input_provenance,updated_at')
        .eq('company_id', companyId)
        .in('id', conditionVersionIds),
      supabase.from('company_condition_template_versions')
        .select('id,archetype_version_id,legacy_assembly_version_id,input_defaults,input_provenance')
        .eq('company_id', companyId)
        .in('id', conditionTemplateVersionIds),
      supabase.from('project_condition_module_instances')
        .select('condition_version_id,module_key,instance_key,label,enabled,input_values,input_provenance,legacy_child_key,sort_order')
        .eq('company_id', companyId)
        .in('condition_version_id', conditionVersionIds)
        .order('sort_order'),
      supabase.from('project_condition_measurement_roles')
        .select('condition_version_id,measurement_id,role_key,role_instance_key,sort_order')
        .eq('company_id', companyId)
        .in('condition_version_id', conditionVersionIds)
        .order('sort_order'),
      supabase.from('project_condition_outputs')
        .select('id,condition_version_id,module_instance_id,driver_measurement_role_id,output_key,output_instance_key,label,resource_class,production_quantity,production_unit,status,estimated_man_hours,unit_cost,direct_cost,pricing_status,provenance,legacy_takeoff_output_id,generated_estimate_item_id')
        .eq('company_id', companyId)
        .in('condition_version_id', conditionVersionIds)
        .order('output_key'),
      supabase.from('project_condition_holds')
        .select('id,condition_version_id,output_id,hold_code,status,message')
        .eq('company_id', companyId)
        .in('condition_version_id', conditionVersionIds)
        .order('created_at'),
      supabase.from('condition_legacy_reconciliation')
        .select('condition_version_id,output_key,reconciliation_status')
        .eq('company_id', companyId)
        .in('condition_version_id', conditionVersionIds)
        .order('output_key'),
    ]);

    const archetypeVersionIds = [...new Set((conditionVersions || []).map((row: any) => row.archetype_version_id).filter(Boolean))] as string[];
    let conditionArchetypeVersions: any[] = [];
    if (archetypeVersionIds.length) {
      const { data, error } = await supabase.from('platform_condition_archetype_versions')
        .select('id,version_no,archetype_code_snapshot,status,engine_key')
        .in('id', archetypeVersionIds);
      if (error) throw new Error(error.message);
      conditionArchetypeVersions = data || [];
    }

    conditionData = {
      conditions: conditionSummaries || [],
      versions: conditionVersions || [],
      templateVersions: conditionTemplateVersions || [],
      archetypeVersions: conditionArchetypeVersions,
      modules: conditionModules || [],
      roles: conditionRoles || [],
      outputs: conditionOutputs || [],
      holds: conditionHolds || [],
      reconciliation: conditionReconciliation || [],
    };
  }

  conditionData.specialistWorksheetModel = buildSpecialistWorksheetModel({
    measurements: (measurements || []).map((row: any) => ({
      id: String(row.id),
      sheet_id: row.sheet_id ? String(row.sheet_id) : null,
      estimate_section_id: row.estimate_section_id ? String(row.estimate_section_id) : null,
      name: String(row.name || 'Takeoff'),
      location: row.location ? String(row.location) : null,
      raw_quantity: Number(row.raw_quantity || 0),
      raw_unit: String(row.raw_unit || ''),
    })),
    conditions: (conditionData.conditions || []).map((row: any) => ({
      condition_version_id: String(row.condition_version_id),
      code: String(row.code || ''),
      name: String(row.name || ''),
      measurement_count: Number(row.measurement_count || 0),
    })),
    roles: (conditionData.roles || []).map((row: any) => ({
      condition_version_id: String(row.condition_version_id),
      measurement_id: String(row.measurement_id),
      role_key: String(row.role_key),
      role_instance_key: String(row.role_instance_key || 'default'),
    })),
    modules: (conditionData.modules || []).map((row: any) => ({
      condition_version_id: String(row.condition_version_id),
      module_key: String(row.module_key),
      instance_key: String(row.instance_key || 'default'),
      label: String(row.label || row.module_key || ''),
      enabled: Boolean(row.enabled),
    })),
    outputs: (conditionData.outputs || []).map((row: any) => ({
      id: String(row.id),
      condition_version_id: String(row.condition_version_id),
      module_instance_id: row.module_instance_id ? String(row.module_instance_id) : null,
      driver_measurement_role_id: row.driver_measurement_role_id ? String(row.driver_measurement_role_id) : null,
      output_key: String(row.output_key || ''),
      output_instance_key: String(row.output_instance_key || 'default'),
      label: String(row.label || row.output_key || ''),
      resource_class: String(row.resource_class || ''),
      production_quantity: row.production_quantity === null || row.production_quantity === undefined ? null : Number(row.production_quantity),
      production_unit: String(row.production_unit || ''),
      status: String(row.status || ''),
      estimated_man_hours: Number(row.estimated_man_hours || 0),
      unit_cost: Number(row.unit_cost || 0),
      direct_cost: Number(row.direct_cost || 0),
      pricing_status: String(row.pricing_status || ''),
      provenance: (row.provenance || {}) as Record<string, unknown>,
      legacy_takeoff_output_id: row.legacy_takeoff_output_id ? String(row.legacy_takeoff_output_id) : null,
      generated_estimate_item_id: row.generated_estimate_item_id ? String(row.generated_estimate_item_id) : null,
    })),
    holds: (conditionData.holds || []).map((row: any) => ({
      id: String(row.id),
      condition_version_id: String(row.condition_version_id),
      output_id: row.output_id ? String(row.output_id) : null,
      hold_code: String(row.hold_code || ''),
      status: String(row.status || ''),
      message: String(row.message || ''),
    })),
    sections: (sections || []).map((row: any) => ({ id: String(row.id), name: String(row.name || '') })),
    sheets: (sheets || []).map((row: any) => ({
      id: String(row.id),
      sheet_number: row.sheet_number ? String(row.sheet_number) : null,
      page_number: Number(row.page_number || 0),
    })),
    legacyOutputs: summaries.map((row: any) => ({
      id: String(row.id),
      measurement_id: String(row.measurement_id),
      catalog_item_id: row.catalog_item_id ? String(row.catalog_item_id) : null,
      cost_source: row.cost_source ? String(row.cost_source) : null,
      resource_behavior: row.resource_behavior ? String(row.resource_behavior) : null,
    })),
    pendingConditionVersionIds: new Set<string>(),
  });

  conditionData.derived3DSnapshot = resolveDerived3DSnapshot(companyId, setId, conditionData, measurements || [], sheets || [], scaleRegions || []);

  return <AppShell userName={profile.full_name || user.email || 'Owner'}>
    <div className="takeoff-app-page">
      <TakeoffWorkspaceIdentity
        takeoffName={set.name}
        estimateId={set.estimate_id}
        estimateLabel={estimateLabel}
        estimateStatus={String(estimate?.status||'Unknown').replace(/_/g,' ')}
        revisionLabel={set.revision_label}
        project={project?{id:project.id,jobNumber:project.job_number,name:project.name}:null}
        sheetCount={(sheets||[]).length}
        conditionCount={(conditionSummaries||[]).length}
        holdCount={(conditionData.holds||[]).filter((hold:any)=>hold.status==='open').length}
        locked={locked}
      />

      {locked && <div className="takeoff-app-notice"><strong>Issued revision.</strong> Takeoff remains reviewable, but geometry, scale and deletion are locked. Create the next estimate revision to change scope.</div>}

      {!document || !pdfUrl ? <div className="takeoff-upload-state"><div className="takeoff-upload-card"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Source drawings</p><h1>Attach the PDF plan set</h1><p>This drawing becomes the permanent source for this estimate revision. Once attached, Carez opens the professional takeoff workspace.</p>{locked ? <div className="rounded-lg border border-border bg-muted/20 px-3 py-3 text-sm font-medium text-foreground">No source drawing is attached to this locked revision.</div> : <TakeoffPlanUpload companyId={companyId} takeoffSetId={setId} />}</div></div> : <>
      <TakeoffSheetAutoNaming takeoffSetId={setId} pdfUrl={pdfUrl} initialSheets={sheets || []} locked={locked} />
      {conditionAuthoringActive
        ? <TakeoffConditionWorkflowShell setId={setId} workspaceProps={workspaceProps} conditionData={conditionData} />
        : <TakeoffAssemblyBuilderShell setId={setId} workspaceProps={workspaceProps} builderData={builderData} conditionData={conditionData} />}
      </>}
    </div>
  </AppShell>;
}
