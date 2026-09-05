import type {
  ConditionArchetypeDefinition,
  ConditionCalculation,
  ConditionCalculationRequest,
  ConditionHold,
  ConditionInputGroup,
  ConditionModuleConfiguration,
  ConditionModuleInputDefinition,
  ConditionOutput,
  ConditionOutputDefinition,
  ConditionOutputTrace,
  ConditionScalar,
  ConditionTraceValue,
} from './types.ts';

export const STRIP_FOOTING_V2_CONTRACT_VERSION = 2;

const input = (
  key: string,
  label: string,
  group: ConditionInputGroup,
  valueType: 'number' | 'integer' | 'boolean' | 'text' | 'select',
  options: { unit?: string; minimum?: number; maximum?: number; choices?: string[]; requiredBy?: string[] } = {},
) => ({
  key,
  label,
  group,
  valueType,
  ...(options.unit ? { unit: options.unit } : {}),
  ...(options.minimum !== undefined ? { minimum: options.minimum } : {}),
  ...(options.maximum !== undefined ? { maximum: options.maximum } : {}),
  ...(options.choices ? { options: options.choices } : {}),
  ...(options.requiredBy ? { requiredBy: options.requiredBy } : {}),
});

const moduleInput = (
  key: string,
  label: string,
  valueType: ConditionModuleInputDefinition['valueType'],
  options: Omit<ConditionModuleInputDefinition, 'key' | 'label' | 'valueType'> = {},
): ConditionModuleInputDefinition => ({ key, label, valueType, ...options });

const output = (
  outputKey: string,
  moduleKey: ConditionOutputDefinition['moduleKey'],
  label: string,
  resourceClass: ConditionOutputDefinition['resourceClass'],
  unit: ConditionOutputDefinition['unit'],
  algorithm: string,
  legacyComponentKey: string,
): ConditionOutputDefinition => ({ outputKey, moduleKey, label, resourceClass, unit, algorithm, legacyComponentKey });

const barSizes = ['#3', '#4', '#5', '#6', '#7', '#8', '#9', '#10', '#11', '#14', '#18', 'Custom'];

export const STRIP_FOOTING_V2_DEFINITION: ConditionArchetypeDefinition = {
  key: 'strip_wall_footing',
  name: 'Strip / Wall Footing',
  contractVersion: STRIP_FOOTING_V2_CONTRACT_VERSION,
  primaryUnit: 'LF',
  roles: [
    { key: 'run', label: 'Footing run', unit: 'LF', geometryType: 'polyline', primary: true, required: true },
    { key: 'end_forms', label: 'End forms', unit: 'EA', geometryType: 'count', primary: false, required: false },
    { key: 'anchors_embeds', label: 'Anchors / embeds', unit: 'EA', geometryType: 'count', primary: false, required: false },
  ],
  inputs: [
    input('width_ft', 'Footing width', 'planFacts', 'number', { unit: 'FT', minimum: 0.000001, requiredBy: ['concrete.installed_cy'] }),
    input('depth_ft', 'Footing depth', 'planFacts', 'number', { unit: 'FT', minimum: 0.000001, requiredBy: ['concrete.installed_cy'] }),
    input('place_concrete_mh_per_cy', 'Place concrete production', 'production', 'number', { unit: 'MH/CY', minimum: 0, requiredBy: ['labor.place_concrete_mh'] }),
    input('form_mh_per_sf', 'Formwork production', 'production', 'number', { unit: 'MH/SF', minimum: 0, requiredBy: ['labor.forms_mh'] }),
    input('rebar_mh_per_lb', 'Reinforcing production', 'production', 'number', { unit: 'MH/LB', minimum: 0, requiredBy: ['labor.reinforcing_mh'] }),
    input('anchor_embed_mh_per_ea', 'Anchor / embed production', 'production', 'number', { unit: 'MH/EA', minimum: 0, requiredBy: ['labor.anchors_embeds_mh'] }),
    input('excavation_mh_per_cy', 'Excavation production', 'production', 'number', { unit: 'MH/CY', minimum: 0, requiredBy: ['labor.excavation_mh'] }),
    input('backfill_mh_per_cy', 'Backfill production', 'production', 'number', { unit: 'MH/CY', minimum: 0, requiredBy: ['labor.backfill_mh'] }),
    input('misc_mh_per_ea', 'Miscellaneous production', 'production', 'number', { unit: 'MH/EA', minimum: 0, requiredBy: ['labor.misc_mh'] }),
    input('concrete_waste_pct', 'Concrete order allowance', 'commercial', 'number', { unit: '%', minimum: 0, maximum: 100, requiredBy: ['concrete.procurement_cy'] }),
    input('elevation_ft', 'Elevation', 'drawing', 'number', { unit: 'FT', requiredBy: ['3d_projection'] }),
    input('elevation_reference', 'Elevation reference', 'drawing', 'select', { choices: ['top', 'bottom', 'centerline'], requiredBy: ['3d_projection'] }),
  ],
  modules: [
    {
      key: 'concrete', label: 'Concrete', repeatable: false, defaultEnabled: true,
      inputs: [
        moduleInput('profile', 'Section profile', 'select', { options: ['rectangular', 'trapezoid'] }),
        moduleInput('top_width_ft', 'Top width', 'number', { unit: 'FT', minimum: 0 }),
        moduleInput('concrete_type', 'Concrete type', 'select', { options: ['normal_weight', 'lightweight', 'other'] }),
        moduleInput('compressive_strength_psi', 'Concrete strength', 'number', { unit: 'PSI', minimum: 0 }),
        moduleInput('placement_method', 'Placement method', 'select', { options: ['direct_chute', 'line_pump', 'boom_pump', 'buggy', 'conveyor', 'other'] }),
        moduleInput('top_finish', 'Top surface', 'select', { options: ['none', 'float', 'trowel', 'broom', 'other'] }),
      ],
    },
    {
      key: 'forms', label: 'Forms', repeatable: false, defaultEnabled: false,
      inputs: [
        moduleInput('form_method', 'Form method', 'select', { options: ['earth_formed', 'one_side', 'two_sides', 'custom'] }),
        moduleInput('formed_sides', 'Formed sides', 'integer', { unit: 'EA', minimum: 0, maximum: 2 }),
        moduleInput('form_system', 'Form system', 'select', { options: ['wood_lumber', 'panel', 'other'] }),
        moduleInput('resource_tracking', 'Track form material', 'boolean'),
        moduleInput('form_material_factor_lf_per_lf', 'Form material factor', 'number', { unit: 'LF/LF', minimum: 0 }),
        moduleInput('stakes_enabled', 'Track stakes', 'boolean'),
        moduleInput('stake_spacing_ft', 'Stake spacing', 'number', { unit: 'FT', minimum: 0 }),
        moduleInput('stakes_per_location', 'Stakes per location', 'integer', { unit: 'EA', minimum: 0 }),
      ],
    },
    {
      key: 'reinforcing', label: 'Reinforcing set', repeatable: true, defaultEnabled: false,
      inputs: [
        moduleInput('kind', 'Reinforcing pattern', 'select', { options: ['continuous', 'transverse', 'dowel', 'stirrup', 'custom'] }),
        moduleInput('description', 'Description', 'text'),
        moduleInput('bar_size', 'Bar size', 'select', { options: barSizes }),
        moduleInput('custom_unit_weight_lb_per_ft', 'Custom unit weight', 'number', { unit: 'LB/LF', minimum: 0 }),
        moduleInput('bars_per_run', 'Bars per run', 'integer', { unit: 'EA', minimum: 0 }),
        moduleInput('spacing_in', 'Spacing / centers', 'number', { unit: 'IN', minimum: 0 }),
        moduleInput('pieces_per_location', 'Pieces per location', 'integer', { unit: 'EA', minimum: 0 }),
        moduleInput('piece_length_ft', 'Piece length', 'number', { unit: 'FT', minimum: 0 }),
        moduleInput('extra_locations', 'Extra locations', 'integer', { unit: 'EA', minimum: 0 }),
        moduleInput('layers', 'Layers', 'integer', { unit: 'EA', minimum: 1 }),
        moduleInput('faces', 'Faces', 'integer', { unit: 'EA', minimum: 1 }),
        moduleInput('cover_in', 'Cover', 'number', { unit: 'IN', minimum: 0 }),
        moduleInput('splice_policy', 'Splice policy', 'select', { options: ['none', 'stock_lap'] }),
        moduleInput('stock_length_ft', 'Stock length', 'number', { unit: 'FT', minimum: 0 }),
        moduleInput('lap_length_in', 'Lap length', 'number', { unit: 'IN', minimum: 0 }),
        moduleInput('custom_total_length_ft', 'Custom total length', 'number', { unit: 'FT', minimum: 0 }),
        moduleInput('waste_pct', 'Procurement allowance', 'number', { unit: '%', minimum: 0, maximum: 100 }),
      ],
    },
    {
      key: 'anchors_embeds', label: 'Anchor / embed set', repeatable: true, defaultEnabled: false,
      inputs: [
        moduleInput('kind', 'Item type', 'select', { options: ['anchor_bolt', 'dowel', 'embed', 'other'] }),
        moduleInput('description', 'Description', 'text'),
        moduleInput('count_mode', 'Count from', 'select', { options: ['measured_role', 'spacing', 'fixed_count'] }),
        moduleInput('spacing_in', 'Spacing', 'number', { unit: 'IN', minimum: 0 }),
        moduleInput('per_location', 'Per location', 'integer', { unit: 'EA', minimum: 0 }),
        moduleInput('extra_count', 'Extra count', 'integer', { unit: 'EA', minimum: 0 }),
        moduleInput('fixed_count', 'Fixed count', 'integer', { unit: 'EA', minimum: 0 }),
      ],
    },
    {
      key: 'excavation_backfill', label: 'Excavation / backfill', repeatable: false, defaultEnabled: false,
      inputs: [
        moduleInput('excavation_method', 'Excavation method', 'select', { options: ['machine_trench', 'machine_open_cut', 'hand', 'other'] }),
        moduleInput('bottom_width_mode', 'Bottom width', 'select', { options: ['footing_plus_working_room', 'explicit'] }),
        moduleInput('working_room_each_side_ft', 'Working room each side', 'number', { unit: 'FT', minimum: 0 }),
        moduleInput('bottom_width_ft', 'Explicit bottom width', 'number', { unit: 'FT', minimum: 0 }),
        moduleInput('excavation_depth_ft', 'Excavation depth', 'number', { unit: 'FT', minimum: 0 }),
        moduleInput('side_slope_h_to_v', 'Side slope H:V', 'number', { unit: 'H/V', minimum: 0 }),
        moduleInput('swell_pct', 'Swell / expansion', 'number', { unit: '%', minimum: 0, maximum: 200 }),
        moduleInput('export_pct', 'Export share', 'number', { unit: '%', minimum: 0, maximum: 100 }),
        moduleInput('backfill_pct', 'Backfill share of remaining void', 'number', { unit: '%', minimum: 0, maximum: 100 }),
        moduleInput('backfill_type', 'Backfill type', 'select', { options: ['native', 'structural_fill', 'crushed_rock', 'other'] }),
        moduleInput('compaction', 'Compaction requirement', 'text'),
      ],
    },
    {
      key: 'placement_equipment', label: 'Placement / equipment', repeatable: false, defaultEnabled: false,
      inputs: [
        moduleInput('method', 'Placement method', 'select', { options: ['line_pump', 'boom_pump', 'buggy', 'conveyor', 'other'] }),
        moduleInput('placement_rate_cy_per_hr', 'Placement rate', 'number', { unit: 'CY/HR', minimum: 0 }),
        moduleInput('setup_hr', 'Setup / cleanup', 'number', { unit: 'HR', minimum: 0 }),
      ],
    },
    {
      key: 'finish_cure_protection', label: 'Finish / cure / protection', repeatable: false, defaultEnabled: false,
      inputs: [
        moduleInput('finish_enabled', 'Finish top surface', 'boolean'),
        moduleInput('finish_type', 'Finish type', 'select', { options: ['float', 'trowel', 'broom', 'other'] }),
        moduleInput('cure_enabled', 'Cure / protect top surface', 'boolean'),
        moduleInput('protection_type', 'Cure / protection type', 'select', { options: ['curing_compound', 'wet_cure', 'blanket', 'poly', 'other'] }),
      ],
    },
    { key: 'labor', label: 'Labor', repeatable: false, defaultEnabled: false, inputs: [] },
    {
      key: 'miscellaneous', label: 'Miscellaneous item', repeatable: true, defaultEnabled: false,
      inputs: [
        moduleInput('category', 'Category', 'select', { options: ['safety', 'protection', 'hardware', 'cleanup', 'other'] }),
        moduleInput('description', 'Description', 'text'),
        moduleInput('quantity_ea', 'Quantity', 'number', { unit: 'EA', minimum: 0 }),
      ],
    },
  ],
  defaultModules: [
    'concrete', 'forms', 'reinforcing', 'anchors_embeds', 'excavation_backfill', 'placement_equipment',
    'finish_cure_protection', 'labor', 'miscellaneous',
  ],
  outputs: [
    output('concrete.installed_cy', 'concrete', 'Concrete — installed', 'material', 'CY', 'strip-profile-volume-v2', 'concrete'),
    output('concrete.procurement_cy', 'concrete', 'Concrete — procurement', 'material', 'CY', 'waste-adjustment-v2', 'concrete_procurement'),
    output('forms.side_contact_sf', 'forms', 'Side form contact area', 'material', 'SF', 'strip-side-form-v2', 'forms'),
    output('forms.end_contact_sf', 'forms', 'End form contact area', 'material', 'SF', 'strip-end-form-v2', 'end_forms'),
    output('forms.form_material_lf', 'forms', 'Form material demand', 'material', 'LF', 'strip-form-material-v2', 'form_material'),
    output('forms.stakes_ea', 'forms', 'Form stakes', 'material', 'EA', 'strip-form-stakes-v2', 'form_stakes'),
    output('reinforcing.steel_lb', 'reinforcing', 'Reinforcing steel', 'material', 'LB', 'strip-repeatable-rebar-v2', 'rebar'),
    output('anchors_embeds.anchor_ea', 'anchors_embeds', 'Anchors / embeds', 'material', 'EA', 'strip-repeatable-anchors-v2', 'anchors'),
    output('excavation_backfill.excavation_cy', 'excavation_backfill', 'Excavation — in place', 'material', 'CY', 'strip-excavation-profile-v2', 'excavation'),
    output('excavation_backfill.loose_cy', 'excavation_backfill', 'Excavation — loose', 'material', 'CY', 'strip-excavation-swell-v2', 'excavation_loose'),
    output('excavation_backfill.export_cy', 'excavation_backfill', 'Export / haul-off', 'material', 'CY', 'strip-excavation-export-v2', 'export'),
    output('excavation_backfill.backfill_cy', 'excavation_backfill', 'Backfill — compacted', 'material', 'CY', 'strip-backfill-v2', 'backfill'),
    output('placement_equipment.equipment_hr', 'placement_equipment', 'Placement equipment', 'equipment', 'HR', 'placement-equipment-time-v2', 'placement_equipment'),
    output('finish_cure_protection.finish_sf', 'finish_cure_protection', 'Top finish area', 'material', 'SF', 'strip-top-surface-v2', 'finish'),
    output('finish_cure_protection.protection_sf', 'finish_cure_protection', 'Cure / protection area', 'material', 'SF', 'strip-top-surface-v2', 'protection'),
    output('miscellaneous.item_ea', 'miscellaneous', 'Miscellaneous items', 'other', 'EA', 'repeatable-count-v2', 'misc'),
    output('labor.place_concrete_mh', 'labor', 'Place concrete labor', 'labor', 'HR', 'production-rate-v2', 'labor_place'),
    output('labor.forms_mh', 'labor', 'Form labor', 'labor', 'HR', 'production-rate-v2', 'labor_forms'),
    output('labor.reinforcing_mh', 'labor', 'Reinforcing labor', 'labor', 'HR', 'production-rate-v2', 'labor_rebar'),
    output('labor.anchors_embeds_mh', 'labor', 'Anchor / embed labor', 'labor', 'HR', 'production-rate-v2', 'labor_anchors'),
    output('labor.excavation_mh', 'labor', 'Excavation labor', 'labor', 'HR', 'production-rate-v2', 'labor_excavation'),
    output('labor.backfill_mh', 'labor', 'Backfill labor', 'labor', 'HR', 'production-rate-v2', 'labor_backfill'),
    output('labor.misc_mh', 'labor', 'Miscellaneous labor', 'labor', 'HR', 'production-rate-v2', 'labor_misc'),
  ],
};

const BAR_WEIGHT_LB_PER_FT: Record<string, number> = {
  '#3': 0.376, '#4': 0.668, '#5': 1.043, '#6': 1.502, '#7': 2.044,
  '#8': 2.67, '#9': 3.4, '#10': 4.303, '#11': 5.313, '#14': 7.65, '#18': 13.6,
};

type NumberResult = { value: number | null; holds: ConditionHold[]; trace: ConditionTraceValue[] };
type RoleResult = NumberResult & { measurementIds: string[] };
type DraftOutput = { quantity: number | null; holds?: ConditionHold[]; values?: ConditionTraceValue[]; measurementIds?: string[] };

const round = (value: number, precision = 4) => Math.round((value + Number.EPSILON) * 10 ** precision) / 10 ** precision;
const hold = (key: string, label = key): ConditionHold => ({ code: 'input_required', message: `${label} is required for this output.`, requiredInputs: [key] });
const dependencyHold = (keys: string[]): ConditionHold => ({ code: 'input_required', message: `Resolve ${keys.join(', ')} before calculating this output.`, dependencyOutputKeys: keys });
const uniqueHolds = (holds: ConditionHold[]) => {
  const seen = new Set<string>();
  return holds.filter(item => { const key = `${item.code}|${item.message}|${(item.requiredInputs || []).join(',')}|${(item.dependencyOutputKeys || []).join(',')}`; if (seen.has(key)) return false; seen.add(key); return true; });
};

export function calculateStripFootingV2(request: ConditionCalculationRequest): ConditionCalculation {
  const definition = STRIP_FOOTING_V2_DEFINITION;
  if (request.archetypeKey !== 'strip_wall_footing') throw new Error('Strip Footing v2 calculator requires strip_wall_footing.');
  if (!request.conditionVersionId.trim()) throw new Error('Condition version ID is required.');

  const roleDefinitions = new Map(definition.roles.map(role => [role.key, role]));
  const measurementIds = new Set<string>();
  for (const role of request.measurementRoles) {
    const roleDefinition = roleDefinitions.get(role.roleKey);
    if (!roleDefinition) throw new Error(`${role.roleKey} is not supported by ${definition.name}.`);
    if (role.unit !== roleDefinition.unit || role.geometryType !== roleDefinition.geometryType) throw new Error(`${roleDefinition.label} requires ${roleDefinition.geometryType} geometry measured in ${roleDefinition.unit}.`);
    if (!role.measurementId.trim() || !role.sheetId.trim()) throw new Error('Every measurement role requires stable measurement and sheet IDs.');
    if (measurementIds.has(role.measurementId)) throw new Error(`Measurement ${role.measurementId} is assigned more than once.`);
    if (!Number.isFinite(role.quantity) || role.quantity < 0) throw new Error(`${roleDefinition.label} quantity must be a nonnegative finite number.`);
    measurementIds.add(role.measurementId);
  }
  const runQuantity = request.measurementRoles.filter(role => role.roleKey === 'run').reduce((sum, role) => sum + role.quantity, 0);
  if (!(runQuantity > 0)) throw new Error('Footing run is required and must be greater than zero.');

  const modules = request.modules || [];
  const moduleInstances = (key: string) => modules.filter(module => module.moduleKey === key);
  const moduleActive = (key: string) => moduleInstances(key).some(module => module.enabled);
  const defaultModule = (key: string) => moduleInstances(key).find(module => module.instanceKey === 'default') || moduleInstances(key)[0];
  const outputDefinitions = new Map(definition.outputs.map(item => [item.outputKey, item]));
  const outputs = new Map<string, ConditionOutput>();

  const numberInput = (group: ConditionInputGroup, key: string, options: { positive?: boolean; integer?: boolean; maximum?: number } = {}): NumberResult => {
    const entry = request.inputs?.[group]?.[key];
    const field = definition.inputs.find(item => item.group === group && item.key === key);
    if (!entry) return { value: null, holds: [hold(key, field?.label)], trace: [] };
    if (typeof entry.value !== 'number' || !Number.isFinite(entry.value)) throw new Error(`${field?.label || key} must be a finite number.`);
    if (options.positive ? entry.value <= 0 : entry.value < 0) throw new Error(`${field?.label || key} must be ${options.positive ? 'greater than' : 'at least'} zero.`);
    if (options.integer && !Number.isInteger(entry.value)) throw new Error(`${field?.label || key} must be a whole number.`);
    if (options.maximum !== undefined && entry.value > options.maximum) throw new Error(`${field?.label || key} cannot exceed ${options.maximum}.`);
    return { value: entry.value, holds: [], trace: [{ key, value: entry.value, group, mode: entry.mode, sourceId: entry.sourceId, sourceLabel: entry.sourceLabel }] };
  };
  const roleQuantity = (roleKey: string, required = false): RoleResult => {
    const roles = request.measurementRoles.filter(role => role.roleKey === roleKey);
    if (!roles.length) return { value: required ? null : 0, holds: required ? [hold(`role.${roleKey}`, roleDefinitions.get(roleKey)?.label)] : [], trace: required ? [] : [{ key: `role.${roleKey}`, value: 0 }], measurementIds: [] };
    const value = roles.reduce((sum, role) => sum + role.quantity, 0);
    return { value, holds: [], trace: [{ key: `role.${roleKey}`, value }], measurementIds: roles.map(role => role.measurementId) };
  };
  const moduleNumber = (module: ConditionModuleConfiguration | undefined, key: string, label: string, options: { positive?: boolean; integer?: boolean; maximum?: number; optional?: boolean } = {}): NumberResult => {
    const raw = module?.inputValues?.[key];
    const traceKey = `${module?.moduleKey || 'module'}.${module?.instanceKey || 'default'}.${key}`;
    if (raw === '' || raw === null || raw === undefined) return options.optional ? { value: null, holds: [], trace: [] } : { value: null, holds: [hold(traceKey, label)], trace: [] };
    const value = Number(raw);
    if (!Number.isFinite(value)) throw new Error(`${label} must be a finite number.`);
    if (options.positive ? value <= 0 : value < 0) throw new Error(`${label} must be ${options.positive ? 'greater than' : 'at least'} zero.`);
    if (options.integer && !Number.isInteger(value)) throw new Error(`${label} must be a whole number.`);
    if (options.maximum !== undefined && value > options.maximum) throw new Error(`${label} cannot exceed ${options.maximum}.`);
    return { value, holds: [], trace: [{ key: traceKey, value, mode: module?.inputProvenance?.[key]?.mode, sourceLabel: module?.inputProvenance?.[key]?.sourceLabel }] };
  };
  const moduleText = (module: ConditionModuleConfiguration | undefined, key: string, label: string, optional = false): { value: string | null; holds: ConditionHold[]; trace: ConditionTraceValue[] } => {
    const raw = String(module?.inputValues?.[key] ?? '').trim();
    const traceKey = `${module?.moduleKey || 'module'}.${module?.instanceKey || 'default'}.${key}`;
    if (!raw) return optional ? { value: null, holds: [], trace: [] } : { value: null, holds: [hold(traceKey, label)], trace: [] };
    return { value: raw, holds: [], trace: [{ key: traceKey, value: raw, mode: module?.inputProvenance?.[key]?.mode, sourceLabel: module?.inputProvenance?.[key]?.sourceLabel }] };
  };
  const moduleBool = (module: ConditionModuleConfiguration | undefined, key: string) => Boolean(module?.inputValues?.[key]);

  const emit = (outputKey: string, draft: DraftOutput) => {
    const outputDefinition = outputDefinitions.get(outputKey);
    if (!outputDefinition) throw new Error(`Unknown Strip Footing v2 output: ${outputKey}`);
    const active = moduleActive(outputDefinition.moduleKey);
    const override = request.outputOverrides?.[outputKey];
    if (override && (!Number.isFinite(override.quantity) || override.quantity < 0 || !override.reason.trim())) throw new Error(`${outputDefinition.label} override requires a nonnegative quantity and reason.`);
    const derivedQuantity = draft.quantity === null ? null : round(draft.quantity);
    const trace: ConditionOutputTrace = { algorithm: outputDefinition.algorithm, conditionVersionId: request.conditionVersionId, measurementIds: [...new Set(draft.measurementIds || [])], values: draft.values || [], derivedQuantity, ...(override ? { override } : {}) };
    const quantity = override ? round(override.quantity) : derivedQuantity;
    outputs.set(outputKey, { outputKey, moduleKey: outputDefinition.moduleKey, label: outputDefinition.label, resourceClass: outputDefinition.resourceClass, unit: outputDefinition.unit, status: !active ? 'inactive' : quantity === null ? 'held' : 'ready', quantity: !active ? 0 : quantity, quantityMode: override ? 'explicit_override' : 'derived', holds: !active || override ? [] : uniqueHolds(draft.holds || []), trace, legacyComponentKey: outputDefinition.legacyComponentKey });
  };
  const dependency = (key: string) => {
    const item = outputs.get(key);
    if (!item || item.status === 'held' || item.quantity === null) return { value: null, holds: [dependencyHold([key])], trace: [] as ConditionTraceValue[], measurementIds: item?.trace.measurementIds || [] };
    return { value: item.quantity, holds: [] as ConditionHold[], trace: [{ key, value: item.quantity }] as ConditionTraceValue[], measurementIds: item.trace.measurementIds };
  };
  const laborFrom = (outputKeys: string[], rateKey: string): DraftOutput => {
    const deps = outputKeys.map(dependency);
    const rate = numberInput('production', rateKey);
    const holds = [...deps.flatMap(item => item.holds), ...rate.holds];
    return { quantity: holds.length ? null : deps.reduce((sum, item) => sum + Number(item.value), 0) * Number(rate.value), holds: holds.map(item => item.requiredInputs?.includes(rateKey) ? { ...item, code: 'labor_rate_required' as const } : item), values: [...deps.flatMap(item => item.trace), ...rate.trace], measurementIds: deps.flatMap(item => item.measurementIds) };
  };

  const run = roleQuantity('run', true);
  const width = numberInput('planFacts', 'width_ft', { positive: true });
  const depth = numberInput('planFacts', 'depth_ft', { positive: true });
  const concreteModule = defaultModule('concrete');
  const profile = moduleText(concreteModule, 'profile', 'Section profile');
  const profileTopWidth = profile.value === 'trapezoid' ? moduleNumber(concreteModule, 'top_width_ft', 'Top width', { positive: true }) : { value: width.value, holds: [] as ConditionHold[], trace: [] as ConditionTraceValue[] };
  const concreteHolds = [...run.holds, ...width.holds, ...depth.holds, ...profile.holds, ...profileTopWidth.holds];
  const sectionWidth = profile.value === 'trapezoid' ? (Number(width.value) + Number(profileTopWidth.value)) / 2 : Number(width.value);
  emit('concrete.installed_cy', { quantity: concreteHolds.length ? null : Number(run.value) * sectionWidth * Number(depth.value) / 27, holds: concreteHolds, values: [...run.trace, ...width.trace, ...depth.trace, ...profile.trace, ...profileTopWidth.trace], measurementIds: run.measurementIds });
  const installed = dependency('concrete.installed_cy');
  const concreteWaste = numberInput('commercial', 'concrete_waste_pct', { maximum: 100 });
  const procurementHolds = [...installed.holds, ...concreteWaste.holds];
  emit('concrete.procurement_cy', { quantity: procurementHolds.length ? null : Number(installed.value) * (1 + Number(concreteWaste.value) / 100), holds: procurementHolds, values: [...installed.trace, ...concreteWaste.trace], measurementIds: installed.measurementIds });

  const formModule = defaultModule('forms');
  const formedSides = moduleNumber(formModule, 'formed_sides', 'Formed sides', { integer: true, maximum: 2 });
  const sideHolds = [...run.holds, ...depth.holds, ...formedSides.holds];
  emit('forms.side_contact_sf', { quantity: sideHolds.length ? null : Number(run.value) * Number(depth.value) * Number(formedSides.value), holds: sideHolds, values: [...run.trace, ...depth.trace, ...formedSides.trace], measurementIds: run.measurementIds });
  const endForms = roleQuantity('end_forms', false);
  const endHolds = [...endForms.holds, ...width.holds, ...depth.holds];
  emit('forms.end_contact_sf', { quantity: endHolds.length ? null : Number(endForms.value) * Number(width.value) * Number(depth.value), holds: endHolds, values: [...endForms.trace, ...width.trace, ...depth.trace], measurementIds: endForms.measurementIds });
  const trackFormMaterial = moduleBool(formModule, 'resource_tracking');
  const formFactor = trackFormMaterial ? moduleNumber(formModule, 'form_material_factor_lf_per_lf', 'Form material factor', { positive: true }) : { value: 0, holds: [] as ConditionHold[], trace: [] as ConditionTraceValue[] };
  const formMaterialHolds = [...run.holds, ...formedSides.holds, ...endForms.holds, ...width.holds, ...formFactor.holds];
  emit('forms.form_material_lf', { quantity: formMaterialHolds.length ? null : trackFormMaterial ? (Number(run.value) * Number(formedSides.value) + Number(endForms.value) * Number(width.value)) * Number(formFactor.value) : 0, holds: formMaterialHolds, values: [...run.trace, ...formedSides.trace, ...endForms.trace, ...width.trace, ...formFactor.trace], measurementIds: [...run.measurementIds, ...endForms.measurementIds] });
  const stakesEnabled = moduleBool(formModule, 'stakes_enabled');
  const stakeSpacing = stakesEnabled ? moduleNumber(formModule, 'stake_spacing_ft', 'Stake spacing', { positive: true }) : { value: 0, holds: [] as ConditionHold[], trace: [] as ConditionTraceValue[] };
  const stakesPerLocation = stakesEnabled ? moduleNumber(formModule, 'stakes_per_location', 'Stakes per location', { positive: true, integer: true }) : { value: 0, holds: [] as ConditionHold[], trace: [] as ConditionTraceValue[] };
  const stakeHolds = [...run.holds, ...formedSides.holds, ...stakeSpacing.holds, ...stakesPerLocation.holds];
  emit('forms.stakes_ea', { quantity: stakeHolds.length ? null : stakesEnabled && Number(formedSides.value) > 0 ? (Math.ceil(Number(run.value) / Number(stakeSpacing.value)) + 1) * Number(formedSides.value) * Number(stakesPerLocation.value) : 0, holds: stakeHolds, values: [...run.trace, ...formedSides.trace, ...stakeSpacing.trace, ...stakesPerLocation.trace], measurementIds: run.measurementIds });

  const rebarSets = moduleInstances('reinforcing').filter(module => module.enabled);
  const rebarHolds: ConditionHold[] = [];
  const rebarTrace: ConditionTraceValue[] = [...run.trace];
  let rebarLb = 0;
  for (const set of rebarSets) {
    const kind = moduleText(set, 'kind', `${set.label} pattern`);
    const barSize = moduleText(set, 'bar_size', `${set.label} bar size`);
    const customWeight = barSize.value === 'Custom' ? moduleNumber(set, 'custom_unit_weight_lb_per_ft', `${set.label} custom unit weight`, { positive: true }) : { value: null, holds: [] as ConditionHold[], trace: [] as ConditionTraceValue[] };
    const unitWeight = barSize.value && barSize.value !== 'Custom' ? BAR_WEIGHT_LB_PER_FT[barSize.value] : customWeight.value;
    const unitWeightHold = unitWeight ? [] : [hold(`reinforcing.${set.instanceKey}.bar_size`, `${set.label} bar size / unit weight`)];
    let length = 0;
    let setHolds = [...kind.holds, ...barSize.holds, ...customWeight.holds, ...unitWeightHold];
    const layers = moduleNumber(set, 'layers', `${set.label} layers`, { positive: true, integer: true, optional: true });
    const faces = moduleNumber(set, 'faces', `${set.label} faces`, { positive: true, integer: true, optional: true });
    const multiplier = Number(layers.value || 1) * Number(faces.value || 1);
    if (kind.value === 'continuous') {
      const bars = moduleNumber(set, 'bars_per_run', `${set.label} bars per run`, { positive: true, integer: true });
      const splicePolicy = moduleText(set, 'splice_policy', `${set.label} splice policy`);
      let lapAdded = 0;
      if (splicePolicy.value === 'stock_lap') {
        const stock = moduleNumber(set, 'stock_length_ft', `${set.label} stock length`, { positive: true });
        const lap = moduleNumber(set, 'lap_length_in', `${set.label} lap length`);
        setHolds = [...setHolds, ...stock.holds, ...lap.holds];
        if (!stock.holds.length && !lap.holds.length) lapAdded = Math.max(0, Math.ceil(Number(run.value) / Number(stock.value)) - 1) * Number(lap.value) / 12;
        rebarTrace.push(...stock.trace, ...lap.trace);
      }
      setHolds.push(...bars.holds, ...splicePolicy.holds);
      if (!setHolds.length) length = (Number(run.value) + lapAdded) * Number(bars.value) * multiplier;
      rebarTrace.push(...bars.trace, ...splicePolicy.trace);
    } else if (kind.value === 'transverse' || kind.value === 'dowel' || kind.value === 'stirrup') {
      const spacing = moduleNumber(set, 'spacing_in', `${set.label} spacing`, { positive: true });
      const perLocation = moduleNumber(set, 'pieces_per_location', `${set.label} pieces per location`, { positive: true, integer: true });
      const pieceLength = moduleNumber(set, 'piece_length_ft', `${set.label} piece length`, { positive: true });
      const extras = moduleNumber(set, 'extra_locations', `${set.label} extra locations`, { integer: true, optional: true });
      setHolds.push(...spacing.holds, ...perLocation.holds, ...pieceLength.holds, ...extras.holds);
      if (!setHolds.length) length = (Math.ceil(Number(run.value) * 12 / Number(spacing.value)) + 1 + Number(extras.value || 0)) * Number(perLocation.value) * Number(pieceLength.value) * multiplier;
      rebarTrace.push(...spacing.trace, ...perLocation.trace, ...pieceLength.trace, ...extras.trace);
    } else if (kind.value === 'custom') {
      const total = moduleNumber(set, 'custom_total_length_ft', `${set.label} total length`, { positive: true });
      setHolds.push(...total.holds);
      if (!setHolds.length) length = Number(total.value);
      rebarTrace.push(...total.trace);
    }
    const waste = moduleNumber(set, 'waste_pct', `${set.label} procurement allowance`, { maximum: 100, optional: true });
    setHolds.push(...waste.holds);
    rebarTrace.push(...kind.trace, ...barSize.trace, ...customWeight.trace, ...layers.trace, ...faces.trace, ...waste.trace);
    rebarHolds.push(...setHolds);
    if (!setHolds.length) rebarLb += length * Number(unitWeight) * (1 + Number(waste.value || 0) / 100);
  }
  emit('reinforcing.steel_lb', { quantity: rebarHolds.length ? null : rebarLb, holds: rebarHolds, values: rebarTrace, measurementIds: run.measurementIds });

  const anchorRole = roleQuantity('anchors_embeds', false);
  const anchorSets = moduleInstances('anchors_embeds').filter(module => module.enabled);
  const anchorHolds: ConditionHold[] = [];
  const anchorTrace: ConditionTraceValue[] = [...run.trace, ...anchorRole.trace];
  let anchorCount = 0;
  let measuredRoleUsed = false;
  for (const set of anchorSets) {
    const mode = moduleText(set, 'count_mode', `${set.label} count source`);
    anchorHolds.push(...mode.holds); anchorTrace.push(...mode.trace);
    if (mode.value === 'measured_role') {
      if (measuredRoleUsed) anchorHolds.push({ code: 'review_required', message: 'Use the measured anchor/embed role in only one active anchor set.' });
      else if (!anchorRole.measurementIds.length) anchorHolds.push(hold('role.anchors_embeds', 'Anchors / embeds takeoff'));
      else { anchorCount += Number(anchorRole.value); measuredRoleUsed = true; }
    } else if (mode.value === 'spacing') {
      const spacing = moduleNumber(set, 'spacing_in', `${set.label} spacing`, { positive: true });
      const perLocation = moduleNumber(set, 'per_location', `${set.label} per location`, { positive: true, integer: true });
      const extra = moduleNumber(set, 'extra_count', `${set.label} extra count`, { integer: true, optional: true });
      anchorHolds.push(...spacing.holds, ...perLocation.holds, ...extra.holds); anchorTrace.push(...spacing.trace, ...perLocation.trace, ...extra.trace);
      if (!spacing.holds.length && !perLocation.holds.length) anchorCount += (Math.ceil(Number(run.value) * 12 / Number(spacing.value)) + 1) * Number(perLocation.value) + Number(extra.value || 0);
    } else if (mode.value === 'fixed_count') {
      const fixed = moduleNumber(set, 'fixed_count', `${set.label} fixed count`, { integer: true });
      anchorHolds.push(...fixed.holds); anchorTrace.push(...fixed.trace); if (!fixed.holds.length) anchorCount += Number(fixed.value);
    }
  }
  emit('anchors_embeds.anchor_ea', { quantity: anchorHolds.length ? null : anchorCount, holds: anchorHolds, values: anchorTrace, measurementIds: [...run.measurementIds, ...anchorRole.measurementIds] });

  const excavation = defaultModule('excavation_backfill');
  const excavationDepth = moduleNumber(excavation, 'excavation_depth_ft', 'Excavation depth', { positive: true });
  const bottomMode = moduleText(excavation, 'bottom_width_mode', 'Excavation bottom width method');
  const workingRoom = bottomMode.value === 'footing_plus_working_room' ? moduleNumber(excavation, 'working_room_each_side_ft', 'Working room each side') : { value: 0, holds: [] as ConditionHold[], trace: [] as ConditionTraceValue[] };
  const explicitBottom = bottomMode.value === 'explicit' ? moduleNumber(excavation, 'bottom_width_ft', 'Excavation bottom width', { positive: true }) : { value: null, holds: [] as ConditionHold[], trace: [] as ConditionTraceValue[] };
  const slope = moduleNumber(excavation, 'side_slope_h_to_v', 'Excavation side slope H:V');
  const excavationHolds = [...run.holds, ...width.holds, ...excavationDepth.holds, ...bottomMode.holds, ...workingRoom.holds, ...explicitBottom.holds, ...slope.holds];
  const bottomWidth = bottomMode.value === 'explicit' ? Number(explicitBottom.value) : Number(width.value) + 2 * Number(workingRoom.value);
  const excavationTopWidth = bottomWidth + 2 * Number(excavationDepth.value) * Number(slope.value);
  const excavationCy = excavationHolds.length ? null : Number(run.value) * ((bottomWidth + excavationTopWidth) / 2) * Number(excavationDepth.value) / 27;
  emit('excavation_backfill.excavation_cy', { quantity: excavationCy, holds: excavationHolds, values: [...run.trace, ...width.trace, ...excavationDepth.trace, ...bottomMode.trace, ...workingRoom.trace, ...explicitBottom.trace, ...slope.trace], measurementIds: run.measurementIds });
  const excavationDependency = dependency('excavation_backfill.excavation_cy');
  const swell = moduleNumber(excavation, 'swell_pct', 'Excavation swell', { maximum: 200 });
  const looseHolds = [...excavationDependency.holds, ...swell.holds];
  emit('excavation_backfill.loose_cy', { quantity: looseHolds.length ? null : Number(excavationDependency.value) * (1 + Number(swell.value) / 100), holds: looseHolds, values: [...excavationDependency.trace, ...swell.trace], measurementIds: run.measurementIds });
  const loose = dependency('excavation_backfill.loose_cy');
  const exportShare = moduleNumber(excavation, 'export_pct', 'Export share', { maximum: 100 });
  const exportHolds = [...loose.holds, ...exportShare.holds];
  emit('excavation_backfill.export_cy', { quantity: exportHolds.length ? null : Number(loose.value) * Number(exportShare.value) / 100, holds: exportHolds, values: [...loose.trace, ...exportShare.trace], measurementIds: run.measurementIds });
  const backfillShare = moduleNumber(excavation, 'backfill_pct', 'Backfill share', { maximum: 100 });
  const backfillHolds = [...excavationDependency.holds, ...installed.holds, ...backfillShare.holds];
  emit('excavation_backfill.backfill_cy', { quantity: backfillHolds.length ? null : Math.max(0, Number(excavationDependency.value) - Number(installed.value)) * Number(backfillShare.value) / 100, holds: backfillHolds, values: [...excavationDependency.trace, ...installed.trace, ...backfillShare.trace], measurementIds: run.measurementIds });

  const placement = defaultModule('placement_equipment');
  const placementRate = moduleNumber(placement, 'placement_rate_cy_per_hr', 'Placement rate', { positive: true });
  const setup = moduleNumber(placement, 'setup_hr', 'Setup / cleanup hours');
  const placementHolds = [...installed.holds, ...placementRate.holds, ...setup.holds];
  emit('placement_equipment.equipment_hr', { quantity: placementHolds.length ? null : Number(installed.value) / Number(placementRate.value) + Number(setup.value), holds: placementHolds, values: [...installed.trace, ...placementRate.trace, ...setup.trace], measurementIds: run.measurementIds });

  const finish = defaultModule('finish_cure_protection');
  const topAreaHolds = [...run.holds, ...width.holds];
  const topArea = topAreaHolds.length ? null : Number(run.value) * Number(width.value);
  emit('finish_cure_protection.finish_sf', { quantity: moduleBool(finish, 'finish_enabled') ? topArea : 0, holds: moduleBool(finish, 'finish_enabled') ? topAreaHolds : [], values: [...run.trace, ...width.trace], measurementIds: run.measurementIds });
  emit('finish_cure_protection.protection_sf', { quantity: moduleBool(finish, 'cure_enabled') ? topArea : 0, holds: moduleBool(finish, 'cure_enabled') ? topAreaHolds : [], values: [...run.trace, ...width.trace], measurementIds: run.measurementIds });

  const miscItems = moduleInstances('miscellaneous').filter(module => module.enabled);
  const miscHolds: ConditionHold[] = [];
  const miscTrace: ConditionTraceValue[] = [];
  let miscEa = 0;
  for (const item of miscItems) {
    const itemQty = moduleNumber(item, 'quantity_ea', `${item.label} quantity`);
    miscHolds.push(...itemQty.holds); miscTrace.push(...itemQty.trace); if (!itemQty.holds.length) miscEa += Number(itemQty.value);
  }
  emit('miscellaneous.item_ea', { quantity: miscHolds.length ? null : miscEa, holds: miscHolds, values: miscTrace, measurementIds: run.measurementIds });

  emit('labor.place_concrete_mh', laborFrom(['concrete.installed_cy'], 'place_concrete_mh_per_cy'));
  emit('labor.forms_mh', laborFrom(['forms.side_contact_sf', 'forms.end_contact_sf'], 'form_mh_per_sf'));
  emit('labor.reinforcing_mh', laborFrom(['reinforcing.steel_lb'], 'rebar_mh_per_lb'));
  emit('labor.anchors_embeds_mh', laborFrom(['anchors_embeds.anchor_ea'], 'anchor_embed_mh_per_ea'));
  emit('labor.excavation_mh', laborFrom(['excavation_backfill.excavation_cy'], 'excavation_mh_per_cy'));
  emit('labor.backfill_mh', laborFrom(['excavation_backfill.backfill_cy'], 'backfill_mh_per_cy'));
  emit('labor.misc_mh', laborFrom(['miscellaneous.item_ea'], 'misc_mh_per_ea'));

  return { archetypeKey: 'strip_wall_footing', conditionVersionId: request.conditionVersionId, outputs: definition.outputs.map(item => { const calculated = outputs.get(item.outputKey); if (!calculated) throw new Error(`Strip Footing v2 calculator did not emit ${item.outputKey}.`); return calculated; }) };
}
