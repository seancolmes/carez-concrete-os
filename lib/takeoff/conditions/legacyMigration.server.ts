import { createHash } from 'node:crypto';

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


type LegacyPilotFamily = NonNullable<LegacyMigrationCandidate['supportedPilotFamily']>;

export type LegacyPilotMigrationPreparation = {
  classification: 'mapped' | 'unsupported_review';
  reason: string | null;
  family: LegacyPilotFamily;
  estimateId: string;
  measurementId: string;
  targetTemplateVersionId: string;
  targetCompatibilityAssemblyVersionId: string;
  conditionDraft: {
    templateVersionId: string;
    archetypeVersionId: string;
    archetypeKey: LegacyPilotFamily;
    legacyMethodProfileId: string | null;
    inputs: Record<string, Record<string, unknown>>;
    inputProvenance: Record<string, Record<string, unknown>>;
    modules: Array<{
      moduleKey: string;
      instanceKey: string;
      label: string;
      enabled: boolean;
      inputValues: Record<string, unknown>;
      inputProvenance: Record<string, unknown>;
      sortOrder: number;
    }>;
    measurementRole: {
      roleKey: string;
      roleInstanceKey: string;
      measurementId: string;
      sortOrder: number;
    };
  };
  compatibilityRebind: null | {
    measurementId: string;
    expectedUpdatedAt: string;
    sourceAssemblyVersionId: string;
    targetAssemblyVersionId: string;
  };
  provenance: {
    source_measurement_id: string;
    source_assembly_version_id: string;
    target_template_version_id: string;
    target_compatibility_assembly_version_id: string;
    raw_quantity: number | string;
    raw_unit: string;
    geometry_hash: string;
    source_output_ids: string[];
    source_estimate_item_ids: string[];
  };
};

const objectRecord = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};

const arrayRows = (value: unknown): any[] => Array.isArray(value) ? value : [];

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function geometryHash(geometry: unknown) {
  return createHash('sha256').update(stableJson(geometry)).digest('hex');
}

function legacyValueMatchesDefinition(value: unknown, valueType: unknown) {
  if (valueType === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (valueType === 'integer') return typeof value === 'number' && Number.isInteger(value);
  if (valueType === 'boolean') return typeof value === 'boolean';
  if (valueType === 'text' || valueType === 'select') return typeof value === 'string';
  return false;
}

function preparedProjectInputs(inputSchema: unknown, variables: unknown, measurementId: string) {
  const source = objectRecord(variables);
  const inputs: Record<string, Record<string, unknown>> = {};
  const provenance: Record<string, Record<string, unknown>> = {};

  for (const definition of arrayRows(inputSchema)) {
    const key = String(definition?.key || '');
    const group = String(definition?.group || '');
    if (!key || !group || !(key in source) || !legacyValueMatchesDefinition(source[key], definition?.value_type)) continue;
    inputs[group] ||= {};
    provenance[group] ||= {};
    inputs[group][key] = source[key];
    provenance[group][key] = {
      mode: 'project_value',
      sourceId: measurementId,
      sourceLabel: 'Legacy measurement variable',
      note: 'Prepared from the persisted legacy measurement without browser-supplied quantity.',
    };
  }

  return { inputs, provenance };
}

function preparedModules(moduleSchema: unknown, moduleDefaults: unknown) {
  const defaults = objectRecord(moduleDefaults);
  return arrayRows(moduleSchema).map((definition, index) => {
    const moduleKey = String(definition?.key || '');
    const configured = objectRecord(defaults[moduleKey]);
    const enabled = typeof configured.enabled === 'boolean'
      ? configured.enabled
      : typeof definition?.default_enabled === 'boolean'
        ? definition.default_enabled
        : true;
    return {
      moduleKey,
      instanceKey: 'default',
      label: String(definition?.label || moduleKey.replaceAll('_', ' ')),
      enabled,
      inputValues: objectRecord(configured.inputs),
      inputProvenance: {},
      sortOrder: (index + 1) * 10,
    };
  });
}

function expectedMeasurementType(role: any) {
  if (role?.measurement_type) return String(role.measurement_type);
  if (role?.geometry_type === 'count') return 'count';
  if (role?.geometry_type === 'polyline') return 'linear';
  if (role?.geometry_type === 'polygon') return 'area';
  return '';
}

export async function prepareLegacyPilotMigration({
  supabase,
  companyId,
  takeoffSetId,
  measurementId,
}: InventoryInput & { measurementId: string }): Promise<LegacyPilotMigrationPreparation> {
  const inventory = await buildLegacyMigrationInventory({ supabase, companyId, takeoffSetId });
  if (inventory.estimateStatus !== 'draft') throw new Error('Legacy migration preparation requires a draft estimate.');
  if (inventory.proposalCount > 0) throw new Error('Legacy migration preparation is blocked after a proposal has been created.');

  const candidate = inventory.candidates.find(row => row.objectType === 'measurement' && row.legacyId === measurementId);
  if (!candidate) throw new Error('Legacy measurement migration candidate not found.');
  if (candidate.classification !== 'mapped' || !candidate.supportedPilotFamily || !candidate.targetTemplateVersionId) {
    throw new Error('Legacy measurement remains unsupported_review until a governed pilot mapping exists.');
  }

  const { data: measurement, error: measurementError } = await supabase.from('takeoff_measurements')
    .select('id,takeoff_set_id,sheet_id,scale_region_id,assembly_version_id,method_profile_id,status,measurement_type,raw_quantity,raw_unit,geometry,variables,updated_at')
    .eq('company_id', companyId)
    .eq('takeoff_set_id', takeoffSetId)
    .eq('id', measurementId)
    .eq('status', 'active')
    .maybeSingle();
  if (measurementError) throw new Error(measurementError.message);
  if (!measurement) throw new Error('Active legacy measurement not found.');
  if (!measurement.sheet_id) throw new Error('Legacy migration preparation requires sheet-backed geometry.');

  const { data: mappedTemplate, error: mappedTemplateError } = await supabase.from('company_condition_template_versions')
    .select('id,template_id')
    .eq('company_id', companyId)
    .eq('id', candidate.targetTemplateVersionId)
    .eq('status', 'published')
    .maybeSingle();
  if (mappedTemplateError) throw new Error(mappedTemplateError.message);
  if (!mappedTemplate?.template_id) throw new Error('Mapped Company Condition Template version is unavailable.');

  const { data: latestTemplate, error: latestTemplateError } = await supabase.from('company_condition_template_versions')
    .select('id,template_id,archetype_version_id,version_no,status,template_code_snapshot,module_defaults,input_defaults,input_provenance,legacy_assembly_version_id')
    .eq('company_id', companyId)
    .eq('template_id', mappedTemplate.template_id)
    .eq('status', 'published')
    .order('version_no', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestTemplateError) throw new Error(latestTemplateError.message);
  if (!latestTemplate?.id || !latestTemplate.archetype_version_id || !latestTemplate.legacy_assembly_version_id) {
    throw new Error('Latest published pilot template is incomplete.');
  }

  const [{ data: archetypeVersion, error: archetypeVersionError }, { data: mappings, error: mappingError }] = await Promise.all([
    supabase.from('platform_condition_archetype_versions')
      .select('id,archetype_id,version_no,status,engine_key,role_schema,input_schema,module_schema,output_schema')
      .eq('id', latestTemplate.archetype_version_id)
      .eq('status', 'published')
      .maybeSingle(),
    supabase.from('condition_legacy_output_mappings')
      .select('id,output_key,legacy_assembly_component_id')
      .eq('company_id', companyId)
      .eq('template_version_id', latestTemplate.id),
  ]);
  if (archetypeVersionError) throw new Error(archetypeVersionError.message);
  if (mappingError) throw new Error(mappingError.message);
  if (!archetypeVersion || archetypeVersion.engine_key !== 'concrete_condition_v1') {
    throw new Error('Published pilot Condition contract is unavailable.');
  }

  const { data: archetype, error: archetypeError } = await supabase.from('platform_condition_archetypes')
    .select('id,code,active')
    .eq('id', archetypeVersion.archetype_id)
    .eq('active', true)
    .maybeSingle();
  if (archetypeError) throw new Error(archetypeError.message);
  const family = String(archetype?.code || '') as LegacyPilotFamily;
  if (!['pad_column_footing', 'strip_wall_footing', 'slab_on_grade'].includes(family)
    || family !== candidate.supportedPilotFamily) {
    throw new Error('Legacy measurement remains unsupported_review because its pilot family contract does not match.');
  }

  const outputKeys = arrayRows(archetypeVersion.output_schema).map(row => String(row?.key || '')).filter(Boolean);
  const mappedOutputKeys = new Set((mappings || []).map((row: any) => String(row.output_key || '')).filter(Boolean));
  const mappingComplete = outputKeys.length > 0 && outputKeys.every(key => mappedOutputKeys.has(key));
  if (!mappingComplete) {
    throw new Error('Legacy measurement remains unsupported_review because the target output mapping is incomplete.');
  }

  const primaryRole = arrayRows(archetypeVersion.role_schema).find(role => Boolean(role?.primary));
  if (!primaryRole?.key
    || String(primaryRole.unit || '').toUpperCase() !== String(measurement.raw_unit || '').toUpperCase()
    || expectedMeasurementType(primaryRole) !== String(measurement.measurement_type || '')) {
    throw new Error('Legacy measurement remains unsupported_review because its primary measurement contract does not match.');
  }

  const { data: outputRows, error: outputError } = await supabase.from('takeoff_measurement_outputs')
    .select('id,measurement_id')
    .eq('company_id', companyId)
    .eq('measurement_id', measurement.id);
  if (outputError) throw new Error(outputError.message);
  const sourceOutputIds = (outputRows || []).map((row: any) => String(row.id));

  const { data: estimateItems, error: estimateItemError } = await supabase.from('estimate_items')
    .select('id,source_takeoff_measurement_id,source_takeoff_output_id')
    .eq('company_id', companyId)
    .eq('estimate_id', inventory.estimateId);
  if (estimateItemError) throw new Error(estimateItemError.message);
  const outputIdSet = new Set(sourceOutputIds);
  const sourceEstimateItemIds = (estimateItems || [])
    .filter((row: any) => row.source_takeoff_measurement_id === measurement.id || outputIdSet.has(String(row.source_takeoff_output_id || '')))
    .map((row: any) => String(row.id));

  const preparedInputs = preparedProjectInputs(archetypeVersion.input_schema, measurement.variables, measurement.id);
  const targetTemplateVersionId = String(latestTemplate.id);
  const targetCompatibilityAssemblyVersionId = String(latestTemplate.legacy_assembly_version_id);
  const sourceAssemblyVersionId = String(measurement.assembly_version_id);
  const provenance = {
    source_measurement_id: String(measurement.id),
    source_assembly_version_id: sourceAssemblyVersionId,
    target_template_version_id: targetTemplateVersionId,
    target_compatibility_assembly_version_id: targetCompatibilityAssemblyVersionId,
    raw_quantity: measurement.raw_quantity,
    raw_unit: String(measurement.raw_unit),
    geometry_hash: geometryHash(measurement.geometry),
    source_output_ids: sourceOutputIds,
    source_estimate_item_ids: sourceEstimateItemIds,
  };

  return {
    classification: 'mapped',
    reason: null,
    family,
    estimateId: inventory.estimateId,
    measurementId: String(measurement.id),
    targetTemplateVersionId,
    targetCompatibilityAssemblyVersionId,
    conditionDraft: {
      templateVersionId: targetTemplateVersionId,
      archetypeVersionId: String(archetypeVersion.id),
      archetypeKey: family,
      legacyMethodProfileId: measurement.method_profile_id ? String(measurement.method_profile_id) : null,
      inputs: preparedInputs.inputs,
      inputProvenance: preparedInputs.provenance,
      modules: preparedModules(archetypeVersion.module_schema, latestTemplate.module_defaults),
      measurementRole: {
        roleKey: String(primaryRole.key),
        roleInstanceKey: `${String(primaryRole.key)}-001`,
        measurementId: String(measurement.id),
        sortOrder: 10,
      },
    },
    compatibilityRebind: sourceAssemblyVersionId === targetCompatibilityAssemblyVersionId ? null : {
      measurementId: String(measurement.id),
      expectedUpdatedAt: String(measurement.updated_at),
      sourceAssemblyVersionId,
      targetAssemblyVersionId: targetCompatibilityAssemblyVersionId,
    },
    provenance,
  };
}


export function legacyPilotPreparationFromLedger(
  detailsValue: unknown,
  estimateId: string,
  measurementId: string,
): LegacyPilotMigrationPreparation {
  const details = objectRecord(detailsValue);
  const migrationPreparation = objectRecord(details.migration_preparation);
  const draft = objectRecord(migrationPreparation.condition_draft);
  const role = objectRecord(draft.measurementRole);
  const modules = arrayRows(draft.modules);
  const family = String(details.supported_pilot_family || draft.archetypeKey || '') as LegacyPilotFamily;
  const targetTemplateVersionId = String(details.target_template_version_id || draft.templateVersionId || '');
  const targetCompatibilityAssemblyVersionId = String(details.target_compatibility_assembly_version_id || '');

  if (migrationPreparation.status !== 'ready'
    || !['pad_column_footing', 'strip_wall_footing', 'slab_on_grade'].includes(family)
    || !targetTemplateVersionId
    || !targetCompatibilityAssemblyVersionId
    || String(details.source_measurement_id || '') !== measurementId
    || String(role.measurementId || '') !== measurementId
    || !String(draft.archetypeVersionId || '')
    || !String(role.roleKey || '')
    || !modules.length) {
    throw new Error('Stored legacy migration preparation is incomplete.');
  }

  return {
    classification: 'mapped',
    reason: null,
    family,
    estimateId,
    measurementId,
    targetTemplateVersionId,
    targetCompatibilityAssemblyVersionId,
    conditionDraft: {
      templateVersionId: targetTemplateVersionId,
      archetypeVersionId: String(draft.archetypeVersionId),
      archetypeKey: family,
      legacyMethodProfileId: draft.legacyMethodProfileId ? String(draft.legacyMethodProfileId) : null,
      inputs: objectRecord(draft.inputs),
      inputProvenance: objectRecord(draft.inputProvenance),
      modules: modules.map((module, index) => {
        const row = objectRecord(module);
        const moduleKey = String(row.moduleKey || '');
        if (!moduleKey) throw new Error('Stored migration module identity is incomplete.');
        return {
          moduleKey,
          instanceKey: String(row.instanceKey || 'default'),
          label: String(row.label || moduleKey.replaceAll('_', ' ')),
          enabled: row.enabled !== false,
          inputValues: objectRecord(row.inputValues),
          inputProvenance: objectRecord(row.inputProvenance),
          sortOrder: Number.isInteger(row.sortOrder) ? Number(row.sortOrder) : (index + 1) * 10,
        };
      }),
      measurementRole: {
        roleKey: String(role.roleKey),
        roleInstanceKey: String(role.roleInstanceKey || `${String(role.roleKey)}-001`),
        measurementId,
        sortOrder: Number.isInteger(role.sortOrder) ? Number(role.sortOrder) : 10,
      },
    },
    compatibilityRebind: null,
    provenance: {
      source_measurement_id: measurementId,
      source_assembly_version_id: String(details.source_assembly_version_id || ''),
      target_template_version_id: targetTemplateVersionId,
      target_compatibility_assembly_version_id: targetCompatibilityAssemblyVersionId,
      raw_quantity: details.raw_quantity as number | string,
      raw_unit: String(details.raw_unit || ''),
      geometry_hash: String(details.geometry_hash || ''),
      source_output_ids: arrayRows(details.source_output_ids).map(String),
      source_estimate_item_ids: arrayRows(details.source_estimate_item_ids).map(String),
    },
  };
}

export function legacyMigrationConditionCode(measurementId: string) {
  return `MIG-${measurementId.replace(/-/g, '').toUpperCase()}`;
}

export async function assertLegacyMigrationEstimateLineage({
  supabase,
  companyId,
  estimateId,
  measurementId,
  conditionVersionId,
}: {
  supabase: any;
  companyId: string;
  estimateId: string;
  measurementId: string;
  conditionVersionId: string;
}) {
  const [{ data: outputs, error: outputError }, { data: conditionOutputs, error: conditionOutputError }] = await Promise.all([
    supabase.from('takeoff_measurement_outputs')
      .select('id,measurement_id,is_active,estimate_visible,generated_estimate_item_id')
      .eq('company_id', companyId)
      .eq('measurement_id', measurementId),
    supabase.from('project_condition_outputs')
      .select('id,legacy_takeoff_output_id,generated_estimate_item_id,status')
      .eq('company_id', companyId)
      .eq('condition_version_id', conditionVersionId),
  ]);
  if (outputError) throw new Error(outputError.message);
  if (conditionOutputError) throw new Error(conditionOutputError.message);

  const outputRows = outputs || [];
  const outputIds = outputRows.map((row: any) => String(row.id));
  const { data: measurementItems, error: measurementItemError } = await supabase.from('estimate_items')
    .select('id,estimate_id,source_takeoff_output_id,source_takeoff_measurement_id')
    .eq('company_id', companyId)
    .eq('estimate_id', estimateId)
    .eq('source_takeoff_measurement_id', measurementId);
  if (measurementItemError) throw new Error(measurementItemError.message);

  let outputItems: any[] = [];
  if (outputIds.length) {
    const { data, error } = await supabase.from('estimate_items')
      .select('id,estimate_id,source_takeoff_output_id,source_takeoff_measurement_id')
      .eq('company_id', companyId)
      .eq('estimate_id', estimateId)
      .in('source_takeoff_output_id', outputIds);
    if (error) throw new Error(error.message);
    outputItems = data || [];
  }
  const estimateItems = [...new Map(
    [...(measurementItems || []), ...outputItems].map((item: any) => [String(item.id), item]),
  ).values()];

  const itemsByOutput = new Map<string, any[]>();
  const itemIds = new Set<string>();
  for (const item of estimateItems) {
    const outputId = String(item.source_takeoff_output_id || '');
    const bucket = itemsByOutput.get(outputId) || [];
    bucket.push(item);
    itemsByOutput.set(outputId, bucket);
    const itemId = String(item.id);
    if (itemIds.has(itemId)) throw new Error('Duplicate generated estimate-item lineage detected.');
    itemIds.add(itemId);
  }

  const outputById = new Map(outputRows.map((row: any) => [String(row.id), row]));
  const generatedIds = new Set<string>();
  let expectedEstimateItemCount = 0;

  for (const output of outputRows) {
    const outputId = String(output.id);
    const linked = itemsByOutput.get(outputId) || [];
    const estimateVisibleActive = Boolean(output.is_active && output.estimate_visible);
    if (estimateVisibleActive) {
      expectedEstimateItemCount += 1;
      if (linked.length !== 1) {
        throw new Error(`Estimate lineage requires exactly one generated item for active output ${outputId}; duplicate or orphan relationship found.`);
      }
      const item = linked[0];
      if (String(item.source_takeoff_measurement_id || '') !== measurementId
        || String(output.generated_estimate_item_id || '') !== String(item.id)) {
        throw new Error(`Orphan estimate lineage detected for active output ${outputId}.`);
      }
    } else if (linked.length || output.generated_estimate_item_id) {
      throw new Error(`Inactive or hidden output ${outputId} retains orphan estimate lineage.`);
    }

    if (output.generated_estimate_item_id) {
      const generatedId = String(output.generated_estimate_item_id);
      if (generatedIds.has(generatedId)) throw new Error('Duplicate generated_estimate_item_id relationship detected.');
      generatedIds.add(generatedId);
    }
  }

  const conditionLegacyIds = new Set<string>();
  for (const conditionOutput of conditionOutputs || []) {
    const legacyOutputId = String(conditionOutput.legacy_takeoff_output_id || '');
    if (!legacyOutputId || !outputById.has(legacyOutputId)) {
      throw new Error('Orphan Condition output lineage detected.');
    }
    if (conditionLegacyIds.has(legacyOutputId)) {
      throw new Error('Duplicate source_takeoff_output_id relationship detected in Condition lineage.');
    }
    conditionLegacyIds.add(legacyOutputId);
    const legacyOutput: any = outputById.get(legacyOutputId);
    if (String(conditionOutput.generated_estimate_item_id || '') !== String(legacyOutput.generated_estimate_item_id || '')) {
      throw new Error('Condition and Takeoff generated_estimate_item_id lineage do not match.');
    }
  }

  for (const item of estimateItems) {
    const outputId = String(item.source_takeoff_output_id || '');
    if (!outputId || !outputById.has(outputId) || String(item.source_takeoff_measurement_id || '') !== measurementId) {
      throw new Error('Orphan source_takeoff_measurement_id relationship detected.');
    }
  }

  for (const output of outputRows) {
    if (output.is_active && output.estimate_visible && !conditionLegacyIds.has(String(output.id))) {
      throw new Error('Orphan active Takeoff output remains outside the migrated Condition projection.');
    }
  }

  return {
    measurementOutputCount: outputRows.length,
    conditionOutputCount: (conditionOutputs || []).length,
    estimateItemCount: estimateItems.length,
    expectedEstimateItemCount,
  };
}
