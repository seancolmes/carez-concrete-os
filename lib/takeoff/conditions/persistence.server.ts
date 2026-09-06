import 'server-only';

import {
  prepareAssemblyOutputs,
  resolveTakeoffCurrentUnitCost,
  resolveTakeoffLaborRate,
} from '@/lib/takeoff/assemblyEngine.server';
import { calculateCondition } from './calculate.ts';
import { conditionArchetype } from './catalog.ts';
import { adaptConditionOutputsToLegacy } from './legacyAdapter.ts';
import {
  assertCompleteConditionMappings,
  buildConditionCommitOutputs,
  resolveConditionInputGroups,
} from './persistence.ts';
import {
  calculateStripFootingV2,
  STRIP_FOOTING_V2_CONTRACT_VERSION,
  STRIP_FOOTING_V2_DEFINITION,
} from './stripFootingV2.ts';
import {
  calculateStripFootingV3,
  STRIP_FOOTING_V3_CONTRACT_VERSION,
  STRIP_FOOTING_V3_DEFINITION,
} from './stripFootingV3.ts';
import {
  calculateStripFootingV4,
  STRIP_FOOTING_V4_CONTRACT_VERSION,
  STRIP_FOOTING_V4_DEFINITION,
  STRIP_FOOTING_V4_ENDPOINT_ROLE,
} from './stripFootingV4.ts';
import type {
  ConditionArchetypeDefinition,
  ConditionArchetypeKey,
  ConditionInputProvenance,
  ConditionMeasurementRole,
  ConditionModuleConfiguration,
  ConditionModuleKey,
  ConditionRawInputGroups,
  PersistConcreteConditionPilotInput,
} from './types.ts';

type LoadedMeasurement = {
  id: string;
  takeoff_set_id: string;
  sheet_id: string | null;
  assembly_version_id: string;
  measurement_type: string;
  raw_quantity: number | string;
  raw_unit: string;
  geometry: unknown;
  variables: Record<string, number | string | null> | null;
  risk_class_code: string | null;
  status: string;
  updated_at: string;
};

type LegacyMeasurementUpdate = {
  measurement_id: string;
  expected_updated_at: string;
  mode: 'condition_projection' | 'suppressed' | 'restored';
  outputs: Array<Record<string, unknown>>;
};

const asRecord = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};

const asArray = (value: unknown): any[] => Array.isArray(value) ? value : [];

const geometryType = (measurementType: string): ConditionMeasurementRole['geometryType'] => {
  if (measurementType === 'count') return 'count';
  if (measurementType === 'linear') return 'polyline';
  if (measurementType === 'area') return 'polygon';
  throw new Error(`Unsupported Condition measurement type: ${measurementType || 'unknown'}.`);
};

const openPolylineEndpointCount = (rawGeometry: unknown) => {
  const geometry = asRecord(rawGeometry);
  if (geometry.type !== 'polyline') throw new Error('Strip footing run geometry must be a polyline.');
  const points = asArray(geometry.points)
    .map(point => asRecord(point))
    .filter(point => Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y)))
    .map(point => ({ x: Number(point.x), y: Number(point.y) }));
  if (points.length < 2) throw new Error('Strip footing run geometry requires at least two points.');
  const first = points[0];
  const last = points[points.length - 1];
  const tolerance = 1e-7;
  const closed = Math.abs(first.x - last.x) <= tolerance && Math.abs(first.y - last.y) <= tolerance;
  return closed ? 0 : 2;
};

const moduleLabel = (key: string) => key
  .split('_')
  .map(part => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
  .join(' ');

function storedInputGroups(version: any): ConditionRawInputGroups {
  return {
    planFacts: asRecord(version.plan_facts),
    methods: asRecord(version.method_inputs),
    production: asRecord(version.production_inputs),
    commercial: asRecord(version.commercial_inputs),
    drawing: asRecord(version.drawing_inputs),
  };
}

function deployedDefinition(archetypeKey: ConditionArchetypeKey, archetypeVersion: any): ConditionArchetypeDefinition {
  if (archetypeKey === 'strip_wall_footing' && Number(archetypeVersion.version_no || 0) >= STRIP_FOOTING_V4_CONTRACT_VERSION) {
    return STRIP_FOOTING_V4_DEFINITION;
  }
  if (archetypeKey === 'strip_wall_footing' && Number(archetypeVersion.version_no || 0) >= STRIP_FOOTING_V3_CONTRACT_VERSION) {
    return STRIP_FOOTING_V3_DEFINITION;
  }
  if (archetypeKey === 'strip_wall_footing' && Number(archetypeVersion.version_no || 0) >= STRIP_FOOTING_V2_CONTRACT_VERSION) {
    return STRIP_FOOTING_V2_DEFINITION;
  }
  return conditionArchetype(archetypeKey);
}

function assertDatabaseContract(archetypeKey: ConditionArchetypeKey, archetypeVersion: any) {
  if (archetypeVersion.engine_key !== 'concrete_condition_v1') {
    throw new Error(`Unsupported Condition calculation engine: ${archetypeVersion.engine_key || 'unknown'}.`);
  }
  const definition = deployedDefinition(archetypeKey, archetypeVersion);
  const roles = new Map(asArray(archetypeVersion.role_schema).map(role => [role.key, role]));
  const outputs = new Map(asArray(archetypeVersion.output_schema).map(output => [output.key, output]));
  const modules = new Map(asArray(archetypeVersion.module_schema).map(module => [module.key, module]));

  if (roles.size !== definition.roles.length || outputs.size !== definition.outputs.length) {
    throw new Error('Published Condition archetype schema does not match the deployed server engine.');
  }
  for (const role of definition.roles) {
    const stored = roles.get(role.key);
    if (!stored
      || stored.unit !== role.unit
      || stored.geometry_type !== role.geometryType
      || Boolean(stored.primary) !== role.primary
      || Boolean(stored.required) !== role.required) {
      throw new Error(`Published role ${role.key} does not match the deployed server engine.`);
    }
  }
  for (const output of definition.outputs) {
    const stored = outputs.get(output.outputKey);
    if (!stored
      || stored.module_key !== output.moduleKey
      || stored.unit !== output.unit
      || stored.resource_class !== output.resourceClass
      || stored.algorithm !== output.algorithm) {
      throw new Error(`Published output ${output.outputKey} does not match the deployed server engine.`);
    }
    if (!modules.has(output.moduleKey)) throw new Error(`Published module ${output.moduleKey} is missing.`);
  }
  for (const module of definition.modules || []) {
    const stored = modules.get(module.key);
    if (!stored || Boolean(stored.repeatable) !== module.repeatable) {
      throw new Error(`Published module ${module.key} does not match the deployed server engine.`);
    }
  }
}

function normalizeModules(
  supplied: ConditionModuleConfiguration[] | undefined,
  existing: any[],
  archetypeVersion: any,
) {
  const source = supplied || existing.map(module => ({
    moduleKey: module.module_key,
    instanceKey: module.instance_key,
    label: module.label,
    enabled: module.enabled,
    inputValues: module.input_values,
    inputProvenance: module.input_provenance,
    legacyChildKey: module.legacy_child_key,
    sortOrder: module.sort_order,
  }));
  const schemaRows = asArray(archetypeVersion.module_schema);
  const schema = new Map(schemaRows.map(module => [String(module.key), module]));
  const seen = new Set<string>();
  const defaultCounts = new Map<string, number>();

  const normalized = source.map((module, index) => {
    const moduleKey = String(module.moduleKey || '').trim();
    const instanceKey = String(module.instanceKey || 'default').trim() || 'default';
    const definition = schema.get(moduleKey);
    if (!definition) throw new Error(`Unsupported Condition module: ${moduleKey || 'unknown'}.`);
    if (!Boolean(definition.repeatable) && instanceKey !== 'default') throw new Error(`${moduleLabel(moduleKey)} is not repeatable.`);
    const identity = `${moduleKey}:${instanceKey}`;
    if (seen.has(identity)) throw new Error(`Condition module instance ${identity} is configured more than once.`);
    seen.add(identity);
    if (instanceKey === 'default') defaultCounts.set(moduleKey, (defaultCounts.get(moduleKey) || 0) + 1);
    return {
      module_key: moduleKey,
      instance_key: instanceKey,
      label: String(module.label || moduleLabel(moduleKey)).trim(),
      enabled: Boolean(module.enabled),
      input_values: asRecord(module.inputValues),
      input_provenance: asRecord(module.inputProvenance),
      legacy_child_key: module.legacyChildKey || null,
      sort_order: Number.isInteger(module.sortOrder) ? Number(module.sortOrder) : (index + 1) * 10,
    };
  });

  for (const definition of schemaRows) {
    if ((defaultCounts.get(String(definition.key)) || 0) !== 1) {
      throw new Error(`${moduleLabel(String(definition.key))} requires exactly one default module instance.`);
    }
  }
  return normalized;
}

function normalizeRoleAssignments(supplied: PersistConcreteConditionPilotInput['measurementRoles'] | undefined, existing: any[]) {
  const source = supplied || existing.map(role => ({
    roleKey: role.role_key,
    roleInstanceKey: role.role_instance_key,
    measurementId: role.measurement_id,
    sortOrder: role.sort_order,
  }));
  const counters = new Map<string, number>();
  return source.map((role, index) => {
    const roleKey = String(role.roleKey || '').trim();
    const count = (counters.get(roleKey) || 0) + 1;
    counters.set(roleKey, count);
    return {
      role_key: roleKey,
      role_instance_key: String(role.roleInstanceKey || `${roleKey}-${String(count).padStart(3, '0')}`).trim(),
      measurement_id: String(role.measurementId || '').trim(),
      sort_order: Number.isInteger(role.sortOrder) ? Number(role.sortOrder) : (index + 1) * 10,
    };
  });
}

async function componentPaths(supabase: any, companyId: string, assemblyVersionId: string) {
  const { data, error } = await supabase.rpc('carez_assembly_component_paths', {
    p_company_id: companyId,
    p_root_version_id: assemblyVersionId,
  });
  if (error) throw new Error(error.message);
  return asArray(data);
}

function suppressedOutputs(
  paths: any[],
  conditionVersionId: string,
  measurementId: string,
): Array<Record<string, unknown>> {
  return paths.map(path => ({
    assembly_component_id: path.component_id,
    component_key: path.component_path_key,
    production_quantity: 0,
    estimated_man_hours: 0,
    unit_cost: 0,
    direct_cost: 0,
    pricing_status: 'not_priced',
    is_active: true,
    estimate_visible: false,
    formula_trace: {
      engine: 'concrete_condition_v1',
      compatibility_mode: true,
      projection: 'suppressed_role_measurement',
      condition_version_id: conditionVersionId,
      measurement_id: measurementId,
    },
  }));
}

/**
 * Load authoritative database measurements, calculate once on the server, and
 * prepare the single transactional RPC payload. No calculated quantity is
 * accepted from the browser.
 */
export async function prepareConcreteConditionPilotPersistence({
  supabase,
  companyId,
  input,
}: {
  supabase: any;
  companyId: string;
  input: PersistConcreteConditionPilotInput;
}) {
  const conditionVersionId = String(input?.conditionVersionId || '').trim();
  if (!conditionVersionId) throw new Error('Condition version is required.');

  const { data: version, error: versionError } = await supabase
    .from('project_concrete_condition_versions')
    .select('id,company_id,condition_id,template_version_id,archetype_version_id,status,plan_facts,method_inputs,production_inputs,commercial_inputs,drawing_inputs,input_provenance,output_overrides,compatibility_anchor_measurement_id,updated_at')
    .eq('id', conditionVersionId)
    .eq('company_id', companyId)
    .maybeSingle();
  if (versionError) throw new Error(versionError.message);
  if (!version || version.status !== 'draft') throw new Error('Draft Project Concrete Condition version not found.');

  const [{ data: condition, error: conditionError }, { data: templateVersion, error: templateError }, { data: archetypeVersion, error: archetypeError }] = await Promise.all([
    supabase.from('project_concrete_conditions')
      .select('id,takeoff_set_id,status,compatibility_projection_version_id')
      .eq('id', version.condition_id).eq('company_id', companyId).maybeSingle(),
    supabase.from('company_condition_template_versions')
      .select('id,status,input_defaults,input_provenance,legacy_assembly_version_id')
      .eq('id', version.template_version_id).eq('company_id', companyId).maybeSingle(),
    supabase.from('platform_condition_archetype_versions')
      .select('id,version_no,status,archetype_code_snapshot,engine_key,role_schema,module_schema,output_schema')
      .eq('id', version.archetype_version_id).maybeSingle(),
  ]);
  if (conditionError) throw new Error(conditionError.message);
  if (templateError) throw new Error(templateError.message);
  if (archetypeError) throw new Error(archetypeError.message);
  if (!condition || condition.status !== 'active') throw new Error('Active Project Concrete Condition not found.');
  if (!templateVersion || templateVersion.status !== 'published' || !templateVersion.legacy_assembly_version_id) {
    throw new Error('Pilot persistence requires a published template with a compatibility assembly.');
  }
  if (!archetypeVersion || archetypeVersion.status !== 'published') throw new Error('Published Platform Condition Archetype version not found.');

  const archetypeKey = String(archetypeVersion.archetype_code_snapshot) as ConditionArchetypeKey;
  const archetype = deployedDefinition(archetypeKey, archetypeVersion);
  assertDatabaseContract(archetypeKey, archetypeVersion);

  const [{ data: existingModules, error: modulesError }, { data: existingRoles, error: rolesError }] = await Promise.all([
    supabase.from('project_condition_module_instances').select('*')
      .eq('company_id', companyId).eq('condition_version_id', conditionVersionId).order('sort_order'),
    supabase.from('project_condition_measurement_roles').select('*')
      .eq('company_id', companyId).eq('condition_version_id', conditionVersionId).order('sort_order'),
  ]);
  if (modulesError) throw new Error(modulesError.message);
  if (rolesError) throw new Error(rolesError.message);

  const modules = normalizeModules(input.modules, existingModules || [], archetypeVersion);
  const roles = normalizeRoleAssignments(input.measurementRoles, existingRoles || []);
  if (!roles.length) throw new Error('Assign at least one measurement role before calculating the Condition.');
  const roleDefinitions = new Map(archetype.roles.map(role => [role.key, role]));
  const measurementIds = roles.map(role => role.measurement_id);
  if (new Set(measurementIds).size !== measurementIds.length) throw new Error('A measurement can be assigned only once per Condition version.');

  let previousRoles: any[] = [];
  if (condition.compatibility_projection_version_id) {
    const { data, error } = await supabase.from('project_condition_measurement_roles')
      .select('measurement_id')
      .eq('company_id', companyId)
      .eq('condition_version_id', condition.compatibility_projection_version_id);
    if (error) throw new Error(error.message);
    previousRoles = data || [];
  }
  const previousIds = previousRoles.map(role => String(role.measurement_id));
  const allMeasurementIds = [...new Set([...measurementIds, ...previousIds])];
  const { data: measurementRows, error: measurementsError } = await supabase.from('takeoff_measurements')
    .select('id,takeoff_set_id,sheet_id,assembly_version_id,measurement_type,raw_quantity,raw_unit,geometry,variables,risk_class_code,status,updated_at')
    .eq('company_id', companyId)
    .in('id', allMeasurementIds);
  if (measurementsError) throw new Error(measurementsError.message);
  if ((measurementRows || []).length !== allMeasurementIds.length) throw new Error('One or more Condition measurements could not be loaded.');
  const measurements = new Map((measurementRows as LoadedMeasurement[]).map(measurement => [measurement.id, measurement]));

  const persistedCalculationRoles: ConditionMeasurementRole[] = roles.map(role => {
    const definition = roleDefinitions.get(role.role_key);
    const measurement = measurements.get(role.measurement_id);
    if (!definition) throw new Error(`Unsupported Condition role: ${role.role_key || 'unknown'}.`);
    if (!measurement || measurement.takeoff_set_id !== condition.takeoff_set_id || measurement.status !== 'active') {
      throw new Error('Every Condition role must reference an active measurement from the same takeoff set.');
    }
    if (!measurement.sheet_id) throw new Error('Condition measurement roles require sheet-backed drawing geometry.');
    return {
      roleKey: role.role_key,
      measurementId: measurement.id,
      sheetId: measurement.sheet_id,
      quantity: Number(measurement.raw_quantity),
      unit: String(measurement.raw_unit).toUpperCase() as ConditionMeasurementRole['unit'],
      geometryType: geometryType(measurement.measurement_type),
    };
  });
  const calculationRoles: ConditionMeasurementRole[] = [...persistedCalculationRoles];
  if (archetypeKey === 'strip_wall_footing' && Number(archetypeVersion.version_no || 0) >= STRIP_FOOTING_V4_CONTRACT_VERSION) {
    for (const role of roles.filter(role => role.role_key === 'run')) {
      const measurement = measurements.get(role.measurement_id);
      if (!measurement?.sheet_id) throw new Error('Strip footing run endpoint derivation requires sheet-backed geometry.');
      calculationRoles.push({
        roleKey: STRIP_FOOTING_V4_ENDPOINT_ROLE,
        measurementId: measurement.id,
        sheetId: measurement.sheet_id,
        quantity: openPolylineEndpointCount(measurement.geometry),
        unit: 'EA',
        geometryType: 'count',
      });
    }
  }

  const primaryMeasurementIds = roles
    .filter(role => roleDefinitions.get(role.role_key)?.primary)
    .map(role => role.measurement_id);
  const anchorId = input.compatibilityAnchorMeasurementId === undefined
    ? (version.compatibility_anchor_measurement_id || primaryMeasurementIds[0])
    : input.compatibilityAnchorMeasurementId;
  if (!anchorId || !primaryMeasurementIds.includes(anchorId)) {
    throw new Error('The compatibility anchor must be one of the primary-role measurements.');
  }
  const anchor = measurements.get(anchorId);
  if (!anchor || anchor.assembly_version_id !== templateVersion.legacy_assembly_version_id) {
    throw new Error('The compatibility anchor must use the template compatibility assembly version.');
  }

  const projectValues = input.inputs === undefined ? storedInputGroups(version) : input.inputs;
  const projectProvenance = (input.inputProvenance === undefined
    ? asRecord(version.input_provenance)
    : input.inputProvenance) as ConditionInputProvenance;
  const outputOverrides = input.outputOverrides === undefined
    ? asRecord(version.output_overrides)
    : input.outputOverrides;
  const resolvedInputs = resolveConditionInputGroups({
    companyDefaults: asRecord(templateVersion.input_defaults) as ConditionRawInputGroups,
    companyProvenance: asRecord(templateVersion.input_provenance) as ConditionInputProvenance,
    projectValues,
    projectProvenance,
  });
  const calculationModules: ConditionModuleConfiguration[] = modules.map(module => ({
    moduleKey: module.module_key as ConditionModuleKey,
    instanceKey: module.instance_key,
    label: module.label,
    enabled: module.enabled,
    inputValues: module.input_values,
    inputProvenance: module.input_provenance,
    legacyChildKey: module.legacy_child_key,
    sortOrder: module.sort_order,
  }));
  const versionNo = Number(archetypeVersion.version_no || 0);
  const calculation = archetypeKey === 'strip_wall_footing' && versionNo >= STRIP_FOOTING_V4_CONTRACT_VERSION
    ? calculateStripFootingV4({ archetypeKey, conditionVersionId, inputs: resolvedInputs, measurementRoles: calculationRoles, modules: calculationModules, outputOverrides })
    : archetypeKey === 'strip_wall_footing' && versionNo >= STRIP_FOOTING_V3_CONTRACT_VERSION
      ? calculateStripFootingV3({ archetypeKey, conditionVersionId, inputs: resolvedInputs, measurementRoles: calculationRoles, modules: calculationModules, outputOverrides })
      : archetypeKey === 'strip_wall_footing' && versionNo >= STRIP_FOOTING_V2_CONTRACT_VERSION
        ? calculateStripFootingV2({ archetypeKey, conditionVersionId, inputs: resolvedInputs, measurementRoles: calculationRoles, modules: calculationModules, outputOverrides })
        : calculateCondition({ archetypeKey, conditionVersionId, inputs: resolvedInputs, measurementRoles: calculationRoles, modules: calculationModules, outputOverrides });

  const { data: mappings, error: mappingsError } = await supabase.from('condition_legacy_output_mappings')
    .select('output_key,legacy_assembly_component_id,legacy_component_key_snapshot,output_unit_snapshot')
    .eq('company_id', companyId)
    .eq('template_version_id', templateVersion.id);
  if (mappingsError) throw new Error(mappingsError.message);
  assertCompleteConditionMappings(calculation, (mappings || []).map((mapping: any) => mapping.output_key));

  const legacyPaths = await componentPaths(supabase, companyId, templateVersion.legacy_assembly_version_id);
  const pathByComponent = new Map(legacyPaths.map(path => [path.component_id, path.component_path_key]));
  if (legacyPaths.length !== (mappings || []).length) {
    throw new Error('Compatibility assembly paths and Condition output mappings are not one-to-one.');
  }
  const componentIds = (mappings || []).map((mapping: any) => mapping.legacy_assembly_component_id);
  const { data: components, error: componentsError } = await supabase.from('concrete_assembly_components')
    .select('id,label,estimate_item_type,output_unit,cost_code_id,catalog_item_id,production_task_id,pricing_strategy,default_unit_cost,baseline_source,resource_behavior,estimate_visible')
    .eq('company_id', companyId)
    .in('id', componentIds);
  if (componentsError) throw new Error(componentsError.message);
  if ((components || []).length !== componentIds.length) throw new Error('Compatibility assembly components could not be loaded.');
  const componentById = new Map((components || []).map((component: any) => [component.id, component]));
  const laborRate = await resolveTakeoffLaborRate(supabase, companyId, anchor.risk_class_code);

  const legacyMappings = await Promise.all((mappings || []).map(async (mapping: any) => {
    const component: any = componentById.get(mapping.legacy_assembly_component_id);
    const path = pathByComponent.get(mapping.legacy_assembly_component_id);
    if (!component || !path) throw new Error(`Compatibility component for ${mapping.output_key} is unavailable.`);
    const price = component.estimate_item_type === 'labor'
      ? laborRate && { unitCost: laborRate.rate, source: laborRate.source }
      : await resolveTakeoffCurrentUnitCost(supabase, companyId, component, component.output_unit);
    return {
      outputKey: mapping.output_key,
      assemblyComponentId: component.id,
      componentKey: path,
      label: component.label,
      estimateItemType: component.estimate_item_type,
      outputUnit: component.output_unit,
      costCodeId: component.cost_code_id,
      catalogItemId: component.catalog_item_id,
      productionTaskId: component.production_task_id,
      unitCost: price?.unitCost || null,
      costSource: price?.source || null,
      baselineSource: component.baseline_source,
      resourceBehavior: component.resource_behavior,
      estimateVisible: component.estimate_visible,
    };
  }));
  const conditionLegacyOutputs = adaptConditionOutputsToLegacy(calculation, legacyMappings);

  const selected = new Set(measurementIds);
  const legacyUpdates: LegacyMeasurementUpdate[] = [{
    measurement_id: anchor.id,
    expected_updated_at: anchor.updated_at,
    mode: 'condition_projection',
    outputs: conditionLegacyOutputs,
  }];
  for (const measurementId of measurementIds) {
    if (measurementId === anchor.id) continue;
    const measurement = measurements.get(measurementId)!;
    const paths = await componentPaths(supabase, companyId, measurement.assembly_version_id);
    legacyUpdates.push({
      measurement_id: measurement.id,
      expected_updated_at: measurement.updated_at,
      mode: 'suppressed',
      outputs: suppressedOutputs(paths, conditionVersionId, measurement.id),
    });
  }
  for (const measurementId of previousIds) {
    if (selected.has(measurementId)) continue;
    const measurement = measurements.get(measurementId)!;
    const restored = await prepareAssemblyOutputs({
      supabase,
      companyId,
      assemblyVersionId: measurement.assembly_version_id,
      rawQuantity: Number(measurement.raw_quantity),
      inputs: asRecord(measurement.variables),
      riskClassCode: measurement.risk_class_code,
    });
    legacyUpdates.push({
      measurement_id: measurement.id,
      expected_updated_at: measurement.updated_at,
      mode: 'restored',
      outputs: restored.prepared,
    });
  }

  return {
    takeoffSetId: condition.takeoff_set_id as string,
    conditionVersionId,
    rpcPayload: {
      p_condition_version_id: conditionVersionId,
      p_expected_version_updated_at: version.updated_at,
      p_expected_projection_version_id: condition.compatibility_projection_version_id || null,
      p_compatibility_anchor_measurement_id: anchor.id,
      p_plan_facts: asRecord(projectValues.planFacts),
      p_method_inputs: asRecord(projectValues.methods),
      p_production_inputs: asRecord(projectValues.production),
      p_commercial_inputs: asRecord(projectValues.commercial),
      p_drawing_inputs: asRecord(projectValues.drawing),
      p_input_provenance: asRecord(projectProvenance),
      p_output_overrides: asRecord(outputOverrides),
      p_modules: modules,
      p_measurement_roles: roles.map(role => ({
        ...role,
        is_primary: Boolean(roleDefinitions.get(role.role_key)?.primary),
      })),
      p_condition_outputs: buildConditionCommitOutputs(calculation),
      p_legacy_measurement_updates: legacyUpdates,
    },
  };
}
