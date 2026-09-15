import {
  classifyLegacyMigrationCandidate,
  type LegacyMigrationClassification,
} from './legacyMigration';

export type LegacyMigrationObjectType =
  | 'assembly_version'
  | 'method_profile'
  | 'measurement'
  | 'output'
  | 'estimate_item'
  | 'proposal_snapshot';

export type LegacyMigrationCandidate = {
  objectType: LegacyMigrationObjectType;
  legacyId: string;
  classification: LegacyMigrationClassification;
  supportedPilotFamily: 'pad_column_footing' | 'strip_wall_footing' | 'slab_on_grade' | null;
  sourceAssemblyVersionId: string | null;
  targetTemplateVersionId: string | null;
  targetCompatibilityAssemblyVersionId: string | null;
  details: Record<string, unknown>;
};

type InventoryInput = {
  supabase: any;
  companyId: string;
  takeoffSetId: string;
};

function pilotFamily(templateCode: unknown): LegacyMigrationCandidate['supportedPilotFamily'] {
  const code = String(templateCode || '').toUpperCase();
  if (code.includes('PAD') && code.includes('FOOTING')) return 'pad_column_footing';
  if (code.includes('STRIP') && code.includes('FOOTING')) return 'strip_wall_footing';
  if (code.includes('SLAB')) return 'slab_on_grade';
  return null;
}

function countBy<T>(rows: T[], key: (row: T) => string | null | undefined) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = key(row);
    if (!value) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return counts;
}

export async function buildLegacyMigrationInventory({
  supabase,
  companyId,
  takeoffSetId,
}: InventoryInput): Promise<{
  estimateId: string;
  estimateStatus: string;
  proposalCount: number;
  candidates: LegacyMigrationCandidate[];
}> {
  const { data: takeoffSet, error: setError } = await supabase.from('takeoff_sets')
    .select('id,estimate_id,status')
    .eq('company_id', companyId)
    .eq('id', takeoffSetId)
    .maybeSingle();
  if (setError) throw new Error(setError.message);
  if (!takeoffSet) throw new Error('Takeoff set not found.');

  const [{ data: estimate, error: estimateError }, { data: proposals, error: proposalError }] = await Promise.all([
    supabase.from('estimates').select('id,status,updated_at').eq('company_id', companyId).eq('id', takeoffSet.estimate_id).maybeSingle(),
    supabase.from('proposal_presentations').select('id,status,response_state,created_at').eq('company_id', companyId).eq('estimate_id', takeoffSet.estimate_id),
  ]);
  if (estimateError) throw new Error(estimateError.message);
  if (proposalError) throw new Error(proposalError.message);
  if (!estimate) throw new Error('Estimate not found.');

  const [{ data: measurements, error: measurementError }, { data: profiles, error: profileError }, { data: templates, error: templateError }] = await Promise.all([
    supabase.from('takeoff_measurements')
      .select('id,assembly_version_id,method_profile_id,status,raw_quantity,raw_unit,updated_at')
      .eq('company_id', companyId)
      .eq('takeoff_set_id', takeoffSetId),
    supabase.from('takeoff_method_profiles')
      .select('id,assembly_version_id,status,profile_kind,revision_no')
      .eq('company_id', companyId)
      .eq('takeoff_set_id', takeoffSetId),
    supabase.from('company_condition_template_versions')
      .select('id,legacy_assembly_version_id,template_code_snapshot,status,version_no')
      .eq('company_id', companyId)
      .eq('status', 'published'),
  ]);
  if (measurementError) throw new Error(measurementError.message);
  if (profileError) throw new Error(profileError.message);
  if (templateError) throw new Error(templateError.message);

  const measurementRows = measurements || [];
  const profileRows = profiles || [];
  const templateRows = templates || [];
  const measurementIds = measurementRows.map((row: any) => row.id);

  let outputRows: any[] = [];
  if (measurementIds.length) {
    const { data, error } = await supabase.from('takeoff_measurement_outputs')
      .select('id,measurement_id,assembly_component_id,generated_estimate_item_id,is_active,pricing_status')
      .eq('company_id', companyId)
      .in('measurement_id', measurementIds);
    if (error) throw new Error(error.message);
    outputRows = data || [];
  }

  const { data: estimateItems, error: estimateItemsError } = await supabase.from('estimate_items')
    .select('id,source_takeoff_measurement_id,source_takeoff_output_id,source_assembly_version_id')
    .eq('company_id', companyId)
    .eq('estimate_id', takeoffSet.estimate_id);
  if (estimateItemsError) throw new Error(estimateItemsError.message);

  const templateIds = templateRows.map((row: any) => row.id);
  let mappingRows: any[] = [];
  if (templateIds.length) {
    const { data, error } = await supabase.from('condition_legacy_output_mappings')
      .select('id,template_version_id,legacy_assembly_component_id,output_key')
      .eq('company_id', companyId)
      .in('template_version_id', templateIds);
    if (error) throw new Error(error.message);
    mappingRows = data || [];
  }

  const assemblyVersionIds = [...new Set([
    ...measurementRows.map((row: any) => row.assembly_version_id),
    ...profileRows.map((row: any) => row.assembly_version_id),
  ].filter(Boolean))];
  let assemblyRows: any[] = [];
  if (assemblyVersionIds.length) {
    const { data, error } = await supabase.from('concrete_assembly_versions')
      .select('id,status,assembly_code_snapshot,version_no')
      .eq('company_id', companyId)
      .in('id', assemblyVersionIds);
    if (error) throw new Error(error.message);
    assemblyRows = data || [];
  }

  const proposalRows = proposals || [];
  const referencedByIssuedHistory = proposalRows.length > 0 || ['accepted', 'approved', 'superseded'].includes(String(estimate.status));
  const measurementRefsByAssembly = countBy(measurementRows.filter((row: any) => row.status === 'active'), (row: any) => row.assembly_version_id);
  const measurementRefsByProfile = countBy(measurementRows.filter((row: any) => row.status === 'active'), (row: any) => row.method_profile_id);
  const templateRefsByAssembly = countBy(templateRows, (row: any) => row.legacy_assembly_version_id);
  const templateByAssembly = new Map<string, any>();
  for (const row of templateRows) if (row.legacy_assembly_version_id && !templateByAssembly.has(row.legacy_assembly_version_id)) templateByAssembly.set(row.legacy_assembly_version_id, row);
  const mappedComponents = new Map<string, any>();
  for (const row of mappingRows) if (row.legacy_assembly_component_id) mappedComponents.set(row.legacy_assembly_component_id, row);
  const measurementById = new Map(measurementRows.map((row: any) => [row.id, row]));
  const outputById = new Map(outputRows.map((row: any) => [row.id, row]));

  const classifyAssembly = (assemblyVersionId: string | null | undefined, refs: number, history = referencedByIssuedHistory) => {
    const template = assemblyVersionId ? templateByAssembly.get(assemblyVersionId) : null;
    const family = pilotFamily(template?.template_code_snapshot);
    const classification = classifyLegacyMigrationCandidate({
      referencedByIssuedHistory: history,
      activeMeasurementRefs: refs,
      templateMappingCount: assemblyVersionId ? (templateRefsByAssembly.get(assemblyVersionId) || 0) : 0,
      supportedPilotFamily: Boolean(family),
    });
    return { template, family, classification };
  };

  const candidates: LegacyMigrationCandidate[] = [];

  for (const row of assemblyRows) {
    const result = classifyAssembly(row.id, measurementRefsByAssembly.get(row.id) || 0);
    candidates.push({
      objectType: 'assembly_version', legacyId: row.id, classification: result.classification,
      supportedPilotFamily: result.family, sourceAssemblyVersionId: row.id,
      targetTemplateVersionId: result.template?.id || null,
      targetCompatibilityAssemblyVersionId: result.template?.legacy_assembly_version_id || null,
      details: { status: row.status, code: row.assembly_code_snapshot, version_no: row.version_no },
    });
  }

  for (const row of profileRows) {
    const result = classifyAssembly(row.assembly_version_id, measurementRefsByProfile.get(row.id) || 0, referencedByIssuedHistory || row.status === 'verified');
    candidates.push({
      objectType: 'method_profile', legacyId: row.id, classification: result.classification,
      supportedPilotFamily: result.family, sourceAssemblyVersionId: row.assembly_version_id || null,
      targetTemplateVersionId: result.template?.id || null,
      targetCompatibilityAssemblyVersionId: result.template?.legacy_assembly_version_id || null,
      details: { status: row.status, profile_kind: row.profile_kind, revision_no: row.revision_no },
    });
  }

  for (const row of measurementRows) {
    const result = classifyAssembly(row.assembly_version_id, row.status === 'active' ? 1 : 0);
    candidates.push({
      objectType: 'measurement', legacyId: row.id, classification: result.classification,
      supportedPilotFamily: result.family, sourceAssemblyVersionId: row.assembly_version_id || null,
      targetTemplateVersionId: result.template?.id || null,
      targetCompatibilityAssemblyVersionId: result.template?.legacy_assembly_version_id || null,
      details: { status: row.status, raw_quantity: row.raw_quantity, raw_unit: row.raw_unit, method_profile_id: row.method_profile_id, updated_at: row.updated_at },
    });
  }

  for (const row of outputRows) {
    const measurement: any = measurementById.get(row.measurement_id);
    const result = classifyAssembly(measurement?.assembly_version_id, measurement?.status === 'active' ? 1 : 0);
    const mapped = mappedComponents.has(row.assembly_component_id);
    candidates.push({
      objectType: 'output', legacyId: row.id,
      classification: referencedByIssuedHistory ? 'historical_only' : mapped && result.family ? 'mapped' : result.classification === 'unreferenced' ? 'unreferenced' : 'unsupported_review',
      supportedPilotFamily: result.family, sourceAssemblyVersionId: measurement?.assembly_version_id || null,
      targetTemplateVersionId: result.template?.id || null,
      targetCompatibilityAssemblyVersionId: result.template?.legacy_assembly_version_id || null,
      details: { measurement_id: row.measurement_id, assembly_component_id: row.assembly_component_id, generated_estimate_item_id: row.generated_estimate_item_id, active: row.is_active, pricing_status: row.pricing_status },
    });
  }

  for (const row of estimateItems || []) {
    const output: any = row.source_takeoff_output_id ? outputById.get(row.source_takeoff_output_id) : null;
    const measurement: any = measurementById.get(row.source_takeoff_measurement_id || output?.measurement_id);
    const result = classifyAssembly(row.source_assembly_version_id || measurement?.assembly_version_id, measurement?.status === 'active' ? 1 : 0);
    candidates.push({
      objectType: 'estimate_item', legacyId: row.id,
      classification: referencedByIssuedHistory ? 'historical_only' : result.classification,
      supportedPilotFamily: result.family, sourceAssemblyVersionId: row.source_assembly_version_id || measurement?.assembly_version_id || null,
      targetTemplateVersionId: result.template?.id || null,
      targetCompatibilityAssemblyVersionId: result.template?.legacy_assembly_version_id || null,
      details: { source_takeoff_measurement_id: row.source_takeoff_measurement_id, source_takeoff_output_id: row.source_takeoff_output_id },
    });
  }

  for (const row of proposalRows) {
    candidates.push({
      objectType: 'proposal_snapshot', legacyId: row.id, classification: 'historical_only',
      supportedPilotFamily: null, sourceAssemblyVersionId: null, targetTemplateVersionId: null,
      targetCompatibilityAssemblyVersionId: null,
      details: { status: row.status, response_state: row.response_state, created_at: row.created_at },
    });
  }

  return {
    estimateId: String(takeoffSet.estimate_id),
    estimateStatus: String(estimate.status || ''),
    proposalCount: proposalRows.length,
    candidates,
  };
}
