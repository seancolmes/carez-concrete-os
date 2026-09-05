import { calculateStripFootingV2, STRIP_FOOTING_V2_DEFINITION } from './stripFootingV2.ts';
import type {
  ConditionArchetypeDefinition,
  ConditionCalculation,
  ConditionCalculationRequest,
  ConditionHold,
  ConditionInputDefinition,
  ConditionInputGroup,
  ConditionModuleConfiguration,
  ConditionModuleDefinition,
  ConditionModuleInputDefinition,
  ConditionOutput,
  ConditionOutputDefinition,
  ConditionOutputTrace,
  ConditionTraceValue,
  ConditionValue,
} from './types.ts';

export const STRIP_FOOTING_V3_CONTRACT_VERSION = 3;

const BAR_WEIGHT_LB_PER_FT: Record<string, number> = {
  '#3': 0.376,
  '#4': 0.668,
  '#5': 1.043,
  '#6': 1.502,
  '#7': 2.044,
  '#8': 2.67,
  '#9': 3.4,
  '#10': 4.303,
  '#11': 5.313,
  '#14': 7.65,
  '#18': 13.6,
};

const BAR_SIZES = [...Object.keys(BAR_WEIGHT_LB_PER_FT), 'Custom'];
const LABOR_KEYS = [
  'place_concrete',
  'forms',
  'reinforcing',
  'anchors_embeds',
  'excavation',
  'backfill',
  'finish',
  'cure_protection',
  'misc',
] as const;
type LaborKey = (typeof LABOR_KEYS)[number];

const LABOR_META: Record<LaborKey, { label: string; unit: string; outputKey: string; dependencyKeys: string[]; legacyComponentKey: string }> = {
  place_concrete: { label: 'Place concrete', unit: 'CY', outputKey: 'labor.place_concrete_mh', dependencyKeys: ['concrete.installed_cy'], legacyComponentKey: 'labor_place' },
  forms: { label: 'Form', unit: 'SF', outputKey: 'labor.forms_mh', dependencyKeys: ['forms.side_contact_sf', 'forms.end_contact_sf'], legacyComponentKey: 'labor_forms' },
  reinforcing: { label: 'Reinforcing', unit: 'LB', outputKey: 'labor.reinforcing_mh', dependencyKeys: ['reinforcing.installed_lb'], legacyComponentKey: 'labor_rebar' },
  anchors_embeds: { label: 'Anchor / embed', unit: 'EA', outputKey: 'labor.anchors_embeds_mh', dependencyKeys: ['anchors_embeds.anchor_ea'], legacyComponentKey: 'labor_anchors' },
  excavation: { label: 'Excavation', unit: 'CY', outputKey: 'labor.excavation_mh', dependencyKeys: ['excavation_backfill.excavation_cy'], legacyComponentKey: 'labor_excavation' },
  backfill: { label: 'Backfill', unit: 'CY', outputKey: 'labor.backfill_mh', dependencyKeys: ['excavation_backfill.backfill_cy'], legacyComponentKey: 'labor_backfill' },
  finish: { label: 'Finish concrete', unit: 'SF', outputKey: 'labor.finish_mh', dependencyKeys: ['finish_cure_protection.finish_sf'], legacyComponentKey: 'labor_finish' },
  cure_protection: { label: 'Cure / protection', unit: 'SF', outputKey: 'labor.cure_protection_mh', dependencyKeys: ['finish_cure_protection.protection_sf'], legacyComponentKey: 'labor_cure_protection' },
  misc: { label: 'Miscellaneous', unit: 'EA', outputKey: 'labor.misc_mh', dependencyKeys: ['miscellaneous.item_ea'], legacyComponentKey: 'labor_misc' },
};

const input = (
  key: string,
  label: string,
  group: ConditionInputGroup,
  valueType: ConditionInputDefinition['valueType'],
  options: Omit<ConditionInputDefinition, 'key' | 'label' | 'group' | 'valueType'> = {},
): ConditionInputDefinition => ({ key, label, group, valueType, ...options });

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

const laborInputs = LABOR_KEYS.flatMap((key) => {
  const meta = LABOR_META[key];
  return [
    input(`${key}_labor_method`, `${meta.label} labor method`, 'production', 'select', { options: ['factor', 'crew_rate'] }),
    input(`${key}_mh_per_unit`, `${meta.label} labor factor`, 'production', 'number', { unit: `MH/${meta.unit}`, minimum: 0 }),
    input(`${key}_crew_size`, `${meta.label} crew size`, 'production', 'number', { unit: 'PERSON', minimum: 0.000001 }),
    input(`${key}_production_per_crew_hr`, `${meta.label} production`, 'production', 'number', { unit: `${meta.unit}/CREW-HR`, minimum: 0.000001 }),
  ];
});

const reinforcingModule: ConditionModuleDefinition = {
  key: 'reinforcing',
  label: 'Reinforcing',
  repeatable: true,
  defaultEnabled: false,
  inputs: [
    moduleInput('kind', 'Reinforcing location / pattern', 'select', { options: ['bottom_longitudinal', 'top_longitudinal', 'transverse', 'dowel', 'stirrup', 'custom'] }),
    moduleInput('description', 'Description', 'text'),
    moduleInput('bar_size', 'Bar size', 'select', { options: BAR_SIZES }),
    moduleInput('custom_unit_weight_lb_per_ft', 'Custom unit weight', 'number', { unit: 'LB/LF', minimum: 0 }),
    moduleInput('bar_count', 'Bars total', 'integer', { unit: 'EA', minimum: 1 }),
    moduleInput('spacing_in', 'Spacing / centers', 'number', { unit: 'IN', minimum: 0.000001 }),
    moduleInput('pieces_per_location', 'Pieces per location', 'integer', { unit: 'EA', minimum: 1 }),
    moduleInput('piece_length_ft', 'Piece length', 'number', { unit: 'FT', minimum: 0.000001 }),
    moduleInput('extra_locations', 'Extra locations', 'integer', { unit: 'EA', minimum: 0 }),
    moduleInput('cover_in', 'Cover', 'number', { unit: 'IN', minimum: 0 }),
    moduleInput('splice_policy', 'Splice policy', 'select', { options: ['none', 'stock_lap'] }),
    moduleInput('stock_length_ft', 'Stock length', 'number', { unit: 'FT', minimum: 0.000001 }),
    moduleInput('lap_length_in', 'Lap length', 'number', { unit: 'IN', minimum: 0 }),
    moduleInput('custom_total_length_ft', 'Custom total length', 'number', { unit: 'FT', minimum: 0.000001 }),
    moduleInput('waste_pct', 'Procurement allowance', 'number', { unit: '%', minimum: 0, maximum: 100 }),
  ],
};

const modules = (STRIP_FOOTING_V2_DEFINITION.modules || []).map((item): ConditionModuleDefinition => {
  if (item.key === 'reinforcing') return reinforcingModule;
  if (item.key === 'concrete') return { ...item, inputs: item.inputs.filter(field => field.key !== 'placement_method' && field.key !== 'top_finish') };
  if (item.key === 'labor') return { ...item, label: 'Labor / productivity' };
  return item;
});

const v2NonLaborOutputs = STRIP_FOOTING_V2_DEFINITION.outputs.filter(item => item.resourceClass !== 'labor' && item.outputKey !== 'reinforcing.steel_lb');
const laborOutputs = LABOR_KEYS.map((key) => {
  const meta = LABOR_META[key];
  return output(meta.outputKey, 'labor', `${meta.label} labor`, 'labor', 'HR', 'labor-productivity-v3', meta.legacyComponentKey);
});

export const STRIP_FOOTING_V3_DEFINITION: ConditionArchetypeDefinition = {
  ...STRIP_FOOTING_V2_DEFINITION,
  contractVersion: STRIP_FOOTING_V3_CONTRACT_VERSION,
  inputs: [
    ...STRIP_FOOTING_V2_DEFINITION.inputs.filter(item => item.group !== 'production'),
    ...laborInputs,
  ],
  modules,
  outputs: [
    ...v2NonLaborOutputs,
    output('reinforcing.installed_lb', 'reinforcing', 'Reinforcing steel — installed', 'material', 'LB', 'strip-rebar-installed-v3', 'rebar_installed'),
    output('reinforcing.procurement_lb', 'reinforcing', 'Reinforcing steel — procurement', 'material', 'LB', 'strip-rebar-procurement-v3', 'rebar'),
    output('reinforcing.stock_bars_ea', 'reinforcing', 'Reinforcing stock bars — order guide', 'material', 'EA', 'strip-rebar-stock-bars-v3', 'rebar_stock_bars'),
    ...laborOutputs,
  ],
};

type NumericRead = { value: number | null; holds: ConditionHold[]; trace: ConditionTraceValue[] };
type RebarTotals = { installed: number | null; procurement: number | null; stockPieces: number | null; holds: ConditionHold[]; trace: ConditionTraceValue[]; measurementIds: string[] };

const round = (value: number, precision = 4) => Math.round((value + Number.EPSILON) * 10 ** precision) / 10 ** precision;
const hold = (key: string, label: string, code: ConditionHold['code'] = 'input_required'): ConditionHold => ({ code, message: `${label} is required for this output.`, requiredInputs: [key] });
const uniqueHolds = (holds: ConditionHold[]) => {
  const seen = new Set<string>();
  return holds.filter(item => {
    const key = `${item.code}|${item.message}|${(item.requiredInputs || []).join(',')}|${(item.dependencyOutputKeys || []).join(',')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

function moduleNumber(module: ConditionModuleConfiguration, key: string, label: string, options: { positive?: boolean; integer?: boolean; maximum?: number; optional?: boolean } = {}): NumericRead {
  const raw = module.inputValues?.[key];
  const traceKey = `${module.moduleKey}.${module.instanceKey || 'default'}.${key}`;
  if (raw === '' || raw === null || raw === undefined) return options.optional ? { value: null, holds: [], trace: [] } : { value: null, holds: [hold(traceKey, label)], trace: [] };
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`${label} must be a finite number.`);
  if (options.positive ? value <= 0 : value < 0) throw new Error(`${label} must be ${options.positive ? 'greater than' : 'at least'} zero.`);
  if (options.integer && !Number.isInteger(value)) throw new Error(`${label} must be a whole number.`);
  if (options.maximum !== undefined && value > options.maximum) throw new Error(`${label} cannot exceed ${options.maximum}.`);
  return { value, holds: [], trace: [{ key: traceKey, value, mode: module.inputProvenance?.[key]?.mode, sourceLabel: module.inputProvenance?.[key]?.sourceLabel }] };
}

function moduleText(module: ConditionModuleConfiguration, key: string, label: string): { value: string | null; holds: ConditionHold[]; trace: ConditionTraceValue[] } {
  const raw = String(module.inputValues?.[key] ?? '').trim();
  const traceKey = `${module.moduleKey}.${module.instanceKey || 'default'}.${key}`;
  if (!raw) return { value: null, holds: [hold(traceKey, label)], trace: [] };
  return { value: raw, holds: [], trace: [{ key: traceKey, value: raw, mode: module.inputProvenance?.[key]?.mode, sourceLabel: module.inputProvenance?.[key]?.sourceLabel }] };
}

function calculateRebar(request: ConditionCalculationRequest): RebarTotals {
  const runRoles = request.measurementRoles.filter(role => role.roleKey === 'run');
  const run = runRoles.reduce((sum, role) => sum + Number(role.quantity || 0), 0);
  const measurementIds = runRoles.map(role => role.measurementId);
  const sets = (request.modules || []).filter(module => module.moduleKey === 'reinforcing' && module.enabled);
  if (!sets.length) return { installed: 0, procurement: 0, stockPieces: 0, holds: [], trace: [{ key: 'role.run', value: run }], measurementIds };

  let installed = 0;
  let procurement = 0;
  let stockPieces = 0;
  const holds: ConditionHold[] = [];
  const trace: ConditionTraceValue[] = [{ key: 'role.run', value: run }];
  for (const set of sets) {
    const label = set.label || 'Reinforcing set';
    const kind = moduleText(set, 'kind', `${label} location / pattern`);
    const barSize = moduleText(set, 'bar_size', `${label} bar size`);
    const customWeight = barSize.value === 'Custom' ? moduleNumber(set, 'custom_unit_weight_lb_per_ft', `${label} custom unit weight`, { positive: true }) : { value: null, holds: [], trace: [] };
    const unitWeight = barSize.value === 'Custom' ? customWeight.value : BAR_WEIGHT_LB_PER_FT[String(barSize.value || '')];
    let setHolds = [...kind.holds, ...barSize.holds, ...customWeight.holds];
    if (!unitWeight) setHolds.push(hold(`reinforcing.${set.instanceKey || 'default'}.bar_size`, `${label} bar size / unit weight`));
    let length = 0;
    let stockPieceBase = 0;

    if (kind.value === 'bottom_longitudinal' || kind.value === 'top_longitudinal') {
      const count = moduleNumber(set, 'bar_count', `${label} bars total`, { positive: true, integer: true });
      const splice = moduleText(set, 'splice_policy', `${label} splice policy`);
      let lapAdded = 0;
      setHolds.push(...count.holds, ...splice.holds);
      trace.push(...count.trace, ...splice.trace);
      if (splice.value === 'stock_lap') {
        const stock = moduleNumber(set, 'stock_length_ft', `${label} stock length`, { positive: true });
        const lap = moduleNumber(set, 'lap_length_in', `${label} lap length`);
        setHolds.push(...stock.holds, ...lap.holds);
        trace.push(...stock.trace, ...lap.trace);
        if (!stock.holds.length && !lap.holds.length) {
          const stockFt = Number(stock.value);
          const lapFt = Number(lap.value) / 12;
          if (stockFt <= lapFt && run > stockFt) throw new Error(`${label} stock length must exceed lap length.`);
          const piecesPerLine = run <= stockFt ? 1 : Math.ceil((run - lapFt) / (stockFt - lapFt));
          lapAdded = Math.max(0, piecesPerLine - 1) * lapFt;
          stockPieceBase = piecesPerLine * Number(count.value || 0);
          trace.push({ key: `reinforcing.${set.instanceKey || 'default'}.stock_pieces_before_allowance`, value: stockPieceBase });
        }
      }
      if (!setHolds.length) length = (run + lapAdded) * Number(count.value);
    } else if (kind.value === 'transverse' || kind.value === 'dowel' || kind.value === 'stirrup') {
      const spacing = moduleNumber(set, 'spacing_in', `${label} spacing`, { positive: true });
      const pieces = moduleNumber(set, 'pieces_per_location', `${label} pieces per location`, { positive: true, integer: true });
      const pieceLength = moduleNumber(set, 'piece_length_ft', `${label} piece length`, { positive: true });
      const extras = moduleNumber(set, 'extra_locations', `${label} extra locations`, { integer: true, optional: true });
      setHolds.push(...spacing.holds, ...pieces.holds, ...pieceLength.holds, ...extras.holds);
      trace.push(...spacing.trace, ...pieces.trace, ...pieceLength.trace, ...extras.trace);
      if (!setHolds.length) length = (Math.ceil(run * 12 / Number(spacing.value)) + 1 + Number(extras.value || 0)) * Number(pieces.value) * Number(pieceLength.value);
    } else if (kind.value === 'custom') {
      const total = moduleNumber(set, 'custom_total_length_ft', `${label} total length`, { positive: true });
      setHolds.push(...total.holds);
      trace.push(...total.trace);
      if (!setHolds.length) length = Number(total.value);
    }

    const waste = moduleNumber(set, 'waste_pct', `${label} procurement allowance`, { maximum: 100, optional: true });
    setHolds.push(...waste.holds);
    trace.push(...kind.trace, ...barSize.trace, ...customWeight.trace, ...waste.trace);
    holds.push(...setHolds);
    if (!setHolds.length) {
      const allowance = 1 + Number(waste.value || 0) / 100;
      const installedSet = length * Number(unitWeight);
      installed += installedSet;
      procurement += installedSet * allowance;
      if (stockPieceBase > 0) stockPieces += Math.ceil(stockPieceBase * allowance);
    }
  }

  return { installed: holds.length ? null : round(installed), procurement: holds.length ? null : round(procurement), stockPieces: holds.length ? null : stockPieces, holds: uniqueHolds(holds), trace, measurementIds };
}

function v2CompatibleModules(modules: ConditionModuleConfiguration[] | undefined): ConditionModuleConfiguration[] {
  return (modules || []).map(module => {
    if (module.moduleKey === 'labor') return { ...module, enabled: false };
    if (module.moduleKey === 'reinforcing') {
      const values = module.inputValues || {};
      const kind = String(values.kind || '');
      const mappedKind = kind === 'bottom_longitudinal' || kind === 'top_longitudinal' ? 'continuous' : kind;
      return {
        ...module,
        inputValues: { ...values, kind: mappedKind, bars_per_run: values.bar_count ?? '', layers: 1, faces: 1, waste_pct: 0 },
      };
    }
    return module;
  });
}

function v2CompatibleInputs(request: ConditionCalculationRequest) {
  return { ...request.inputs, production: {} } as ConditionCalculationRequest['inputs'];
}

function buildOutput(definition: ConditionOutputDefinition, request: ConditionCalculationRequest, draft: { quantity: number | null; holds?: ConditionHold[]; traceValues?: ConditionTraceValue[]; measurementIds?: string[] }): ConditionOutput {
  const moduleActive = (request.modules || []).some(module => module.moduleKey === definition.moduleKey && module.enabled);
  const override = request.outputOverrides?.[definition.outputKey];
  if (override && (!Number.isFinite(override.quantity) || override.quantity < 0 || !override.reason.trim())) throw new Error(`${definition.label} override requires a nonnegative quantity and reason.`);
  const holds = uniqueHolds(draft.holds || []);
  const derivedQuantity = draft.quantity === null ? null : round(draft.quantity);
  const trace: ConditionOutputTrace = {
    algorithm: definition.algorithm,
    conditionVersionId: request.conditionVersionId,
    measurementIds: [...new Set(draft.measurementIds || [])],
    values: draft.traceValues || [],
    derivedQuantity,
    ...(override ? { override } : {}),
  };
  const quantity = override ? round(override.quantity) : derivedQuantity;
  return {
    outputKey: definition.outputKey,
    moduleKey: definition.moduleKey,
    label: definition.label,
    resourceClass: definition.resourceClass,
    unit: definition.unit,
    status: !moduleActive ? 'inactive' : quantity === null ? 'held' : 'ready',
    quantity: !moduleActive ? 0 : quantity,
    quantityMode: override ? 'explicit_override' : 'derived',
    holds: !moduleActive || override ? [] : holds,
    trace,
    legacyComponentKey: definition.legacyComponentKey,
  };
}

function productionValue(request: ConditionCalculationRequest, key: string): ConditionValue | undefined {
  return request.inputs?.production?.[key];
}

function calculateLaborOutput(key: LaborKey, request: ConditionCalculationRequest, outputs: Map<string, ConditionOutput>): ConditionOutput {
  const meta = LABOR_META[key];
  const definition = STRIP_FOOTING_V3_DEFINITION.outputs.find(item => item.outputKey === meta.outputKey)!;
  const dependencies = meta.dependencyKeys.map(depKey => outputs.get(depKey));
  const missingDependency = dependencies.find(dep => !dep || dep.status === 'held' || dep.quantity === null);
  const measurementIds = dependencies.flatMap(dep => dep?.trace.measurementIds || []);
  const traceValues: ConditionTraceValue[] = dependencies.filter(Boolean).map(dep => ({ key: dep!.outputKey, value: Number(dep!.quantity || 0) }));
  if (missingDependency) {
    return buildOutput(definition, request, { quantity: null, holds: [{ code: 'input_required', message: `Resolve ${meta.dependencyKeys.join(', ')} before calculating ${meta.label.toLowerCase()} labor.`, dependencyOutputKeys: meta.dependencyKeys }], traceValues, measurementIds });
  }

  const drivenQuantity = dependencies.reduce((sum, dep) => sum + Number(dep?.quantity || 0), 0);
  if (drivenQuantity === 0) return buildOutput(definition, request, { quantity: 0, traceValues, measurementIds });

  const methodKey = `${key}_labor_method`;
  const method = productionValue(request, methodKey);
  if (!method || typeof method.value !== 'string' || !String(method.value).trim()) {
    return buildOutput(definition, request, { quantity: null, holds: [hold(methodKey, `${meta.label} labor method`, 'labor_rate_required')], traceValues, measurementIds });
  }
  traceValues.push({ key: methodKey, value: method.value, group: 'production', mode: method.mode, sourceId: method.sourceId, sourceLabel: method.sourceLabel });

  if (method.value === 'factor') {
    const factorKey = `${key}_mh_per_unit`;
    const factor = productionValue(request, factorKey);
    if (!factor || typeof factor.value !== 'number' || !Number.isFinite(factor.value) || factor.value < 0) {
      return buildOutput(definition, request, { quantity: null, holds: [hold(factorKey, `${meta.label} labor factor`, 'labor_rate_required')], traceValues, measurementIds });
    }
    traceValues.push({ key: factorKey, value: factor.value, group: 'production', mode: factor.mode, sourceId: factor.sourceId, sourceLabel: factor.sourceLabel });
    return buildOutput(definition, request, { quantity: drivenQuantity * factor.value, traceValues, measurementIds });
  }

  if (method.value === 'crew_rate') {
    const crewKey = `${key}_crew_size`;
    const productionKey = `${key}_production_per_crew_hr`;
    const crew = productionValue(request, crewKey);
    const production = productionValue(request, productionKey);
    const holds: ConditionHold[] = [];
    if (!crew || typeof crew.value !== 'number' || !Number.isFinite(crew.value) || crew.value <= 0) holds.push(hold(crewKey, `${meta.label} crew size`, 'labor_rate_required'));
    if (!production || typeof production.value !== 'number' || !Number.isFinite(production.value) || production.value <= 0) holds.push(hold(productionKey, `${meta.label} production per crew hour`, 'labor_rate_required'));
    if (holds.length) return buildOutput(definition, request, { quantity: null, holds, traceValues, measurementIds });
    const crewHours = drivenQuantity / Number(production!.value);
    const totalMh = crewHours * Number(crew!.value);
    traceValues.push(
      { key: crewKey, value: Number(crew!.value), group: 'production', mode: crew!.mode, sourceId: crew!.sourceId, sourceLabel: crew!.sourceLabel },
      { key: productionKey, value: Number(production!.value), group: 'production', mode: production!.mode, sourceId: production!.sourceId, sourceLabel: production!.sourceLabel },
      { key: `${key}.crew_hours`, value: round(crewHours) },
      { key: `${key}.effective_mh_per_unit`, value: round(totalMh / drivenQuantity) },
    );
    return buildOutput(definition, request, { quantity: totalMh, traceValues, measurementIds });
  }

  return buildOutput(definition, request, { quantity: null, holds: [{ code: 'review_required', message: `${meta.label} labor method is not supported.`, requiredInputs: [methodKey] }], traceValues, measurementIds });
}

export function calculateStripFootingV3(request: ConditionCalculationRequest): ConditionCalculation {
  if (request.archetypeKey !== 'strip_wall_footing') throw new Error('Strip Footing v3 calculator requires strip_wall_footing.');
  if (!request.conditionVersionId.trim()) throw new Error('Condition version ID is required.');

  const v2Request: ConditionCalculationRequest = {
    ...request,
    inputs: v2CompatibleInputs(request),
    modules: v2CompatibleModules(request.modules),
    outputOverrides: Object.fromEntries(Object.entries(request.outputOverrides || {}).filter(([key]) => !['reinforcing.installed_lb','reinforcing.procurement_lb','reinforcing.stock_bars_ea'].includes(key) && !key.startsWith('labor.'))),
  };
  const base = calculateStripFootingV2(v2Request);
  const outputs = new Map<string, ConditionOutput>();
  for (const item of base.outputs) {
    if (item.resourceClass === 'labor' || item.outputKey === 'reinforcing.steel_lb') continue;
    outputs.set(item.outputKey, item);
  }

  const rebar = calculateRebar(request);
  const rebarQuantities: Record<string, number | null> = {
    'reinforcing.installed_lb': rebar.installed,
    'reinforcing.procurement_lb': rebar.procurement,
    'reinforcing.stock_bars_ea': rebar.stockPieces,
  };
  for (const key of Object.keys(rebarQuantities)) {
    const definition = STRIP_FOOTING_V3_DEFINITION.outputs.find(item => item.outputKey === key)!;
    outputs.set(key, buildOutput(definition, request, { quantity: rebarQuantities[key], holds: rebar.holds, traceValues: rebar.trace, measurementIds: rebar.measurementIds }));
  }

  for (const key of LABOR_KEYS) {
    const labor = calculateLaborOutput(key, request, outputs);
    outputs.set(labor.outputKey, labor);
  }

  return {
    archetypeKey: 'strip_wall_footing',
    conditionVersionId: request.conditionVersionId,
    outputs: STRIP_FOOTING_V3_DEFINITION.outputs.map(item => {
      const calculated = outputs.get(item.outputKey);
      if (!calculated) throw new Error(`Strip Footing v3 calculator did not emit ${item.outputKey}.`);
      return calculated;
    }),
  };
}
