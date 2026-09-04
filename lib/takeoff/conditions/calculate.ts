import { conditionArchetype } from './catalog.ts';
import type {
  ConditionCalculation,
  ConditionCalculationRequest,
  ConditionHold,
  ConditionInputGroup,
  ConditionModuleKey,
  ConditionOutput,
  ConditionOutputDefinition,
  ConditionOutputTrace,
  ConditionTraceValue,
} from './types.ts';

type DraftOutput = {
  quantity: number | null;
  holds?: ConditionHold[];
  values?: ConditionTraceValue[];
  measurementIds?: string[];
};

type NumberResult = {
  value: number | null;
  holds: ConditionHold[];
  trace: ConditionTraceValue[];
};

type RoleResult = NumberResult & { measurementIds: string[] };

export const roundConditionQuantity = (value: number, precision = 4) => {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

const inputHold = (key: string, label = key): ConditionHold => ({
  code: 'input_required',
  message: `${label} is required for this output.`,
  requiredInputs: [key],
});

const dependencyHold = (keys: string[]): ConditionHold => ({
  code: 'input_required',
  message: `Resolve ${keys.join(', ')} before calculating this output.`,
  dependencyOutputKeys: keys,
});

function uniqueHolds(holds: ConditionHold[]): ConditionHold[] {
  const seen = new Set<string>();
  return holds.filter(hold => {
    const key = `${hold.code}|${hold.message}|${(hold.requiredInputs || []).join(',')}|${(hold.dependencyOutputKeys || []).join(',')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function calculateCondition(request: ConditionCalculationRequest): ConditionCalculation {
  if (!request.conditionVersionId.trim()) throw new Error('Condition version ID is required.');
  const archetype = conditionArchetype(request.archetypeKey);
  const roleDefinitions = new Map(archetype.roles.map(role => [role.key, role]));
  const measurementIds = new Set<string>();

  for (const role of request.measurementRoles) {
    const definition = roleDefinitions.get(role.roleKey);
    if (!definition) throw new Error(`${role.roleKey} is not supported by ${archetype.name}.`);
    if (role.unit !== definition.unit || role.geometryType !== definition.geometryType) {
      throw new Error(`${definition.label} requires ${definition.geometryType} geometry measured in ${definition.unit}.`);
    }
    if (!role.measurementId.trim() || !role.sheetId.trim()) throw new Error('Every measurement role requires stable measurement and sheet IDs.');
    if (measurementIds.has(role.measurementId)) throw new Error(`Measurement ${role.measurementId} is assigned more than once.`);
    if (!Number.isFinite(role.quantity) || role.quantity < 0) throw new Error(`${definition.label} quantity must be a nonnegative finite number.`);
    measurementIds.add(role.measurementId);
  }

  for (const requiredRole of archetype.roles.filter(role => role.required)) {
    const quantity = request.measurementRoles
      .filter(role => role.roleKey === requiredRole.key)
      .reduce((sum, role) => sum + role.quantity, 0);
    if (!(quantity > 0)) throw new Error(`${requiredRole.label} is required and must be greater than zero.`);
  }

  const enabledModules = new Map<ConditionModuleKey, boolean>(archetype.defaultModules.map(key => [key, true]));
  for (const module of request.modules || []) {
    if (!archetype.outputs.some(output => output.moduleKey === module.moduleKey)) {
      throw new Error(`${module.moduleKey} is not supported by ${archetype.name}.`);
    }
    enabledModules.set(module.moduleKey, module.enabled);
  }

  const outputs = new Map<string, ConditionOutput>();
  const definitionFor = (key: string): ConditionOutputDefinition => {
    const definition = archetype.outputs.find(item => item.outputKey === key);
    if (!definition) throw new Error(`Unknown Condition output: ${key}`);
    return definition;
  };

  const numberInput = (
    group: ConditionInputGroup,
    key: string,
    options: { positive?: boolean; integer?: boolean; maximum?: number } = {},
  ): NumberResult => {
    const input = request.inputs?.[group]?.[key];
    const definition = archetype.inputs.find(item => item.group === group && item.key === key);
    if (!input) return { value: null, holds: [inputHold(key, definition?.label)], trace: [] };
    if (typeof input.value !== 'number' || !Number.isFinite(input.value)) throw new Error(`${definition?.label || key} must be a finite number.`);
    if (options.positive ? input.value <= 0 : input.value < 0) throw new Error(`${definition?.label || key} must be ${options.positive ? 'greater than' : 'at least'} zero.`);
    if (options.integer && !Number.isInteger(input.value)) throw new Error(`${definition?.label || key} must be a whole number.`);
    if (options.maximum !== undefined && input.value > options.maximum) throw new Error(`${definition?.label || key} cannot exceed ${options.maximum}.`);
    return {
      value: input.value,
      holds: [],
      trace: [{ key, value: input.value, group, mode: input.mode, sourceId: input.sourceId, sourceLabel: input.sourceLabel }],
    };
  };

  const roleQuantity = (roleKey: string, required: boolean): RoleResult => {
    const definition = roleDefinitions.get(roleKey);
    if (!definition) throw new Error(`Unknown measurement role: ${roleKey}`);
    const roles = request.measurementRoles.filter(role => role.roleKey === roleKey);
    if (!roles.length) {
      return {
        value: required ? null : 0,
        holds: required ? [inputHold(`role.${roleKey}`, definition.label)] : [],
        trace: required ? [] : [{ key: `role.${roleKey}`, value: 0 }],
        measurementIds: [],
      };
    }
    const quantity = roles.reduce((sum, role) => sum + role.quantity, 0);
    return {
      value: quantity,
      holds: [],
      trace: [{ key: `role.${roleKey}`, value: quantity }],
      measurementIds: roles.map(role => role.measurementId),
    };
  };

  const emit = (outputKey: string, draft: DraftOutput) => {
    const definition = definitionFor(outputKey);
    const active = enabledModules.get(definition.moduleKey) !== false;
    const override = request.outputOverrides?.[outputKey];
    if (override && (!Number.isFinite(override.quantity) || override.quantity < 0 || !override.reason.trim())) {
      throw new Error(`${definition.label} override requires a nonnegative quantity and reason.`);
    }

    const derivedQuantity = draft.quantity === null ? null : roundConditionQuantity(draft.quantity);
    const trace: ConditionOutputTrace = {
      algorithm: definition.algorithm,
      conditionVersionId: request.conditionVersionId,
      measurementIds: [...new Set(draft.measurementIds || [])],
      values: draft.values || [],
      derivedQuantity,
      ...(override ? { override } : {}),
    };

    const quantity = override ? roundConditionQuantity(override.quantity) : derivedQuantity;
    outputs.set(outputKey, {
      outputKey,
      moduleKey: definition.moduleKey,
      label: definition.label,
      resourceClass: definition.resourceClass,
      unit: definition.unit,
      status: !active ? 'inactive' : quantity === null ? 'held' : 'ready',
      quantity: !active ? 0 : quantity,
      quantityMode: override ? 'explicit_override' : 'derived',
      holds: !active || override ? [] : uniqueHolds(draft.holds || []),
      trace,
      legacyComponentKey: definition.legacyComponentKey,
    });
  };

  const dependency = (outputKey: string): NumberResult & { measurementIds: string[] } => {
    const output = outputs.get(outputKey);
    if (!output || output.status === 'held' || output.quantity === null) {
      return { value: null, holds: [dependencyHold([outputKey])], trace: [], measurementIds: output?.trace.measurementIds || [] };
    }
    return {
      value: output.quantity,
      holds: [],
      trace: [{ key: outputKey, value: output.quantity }],
      measurementIds: output.trace.measurementIds,
    };
  };

  const multiply = (...values: NumberResult[]): DraftOutput => {
    const holds = values.flatMap(value => value.holds);
    if (holds.length || values.some(value => value.value === null)) {
      return { quantity: null, holds, values: values.flatMap(value => value.trace) };
    }
    return {
      quantity: values.reduce((product, value) => product * Number(value.value), 1),
      values: values.flatMap(value => value.trace),
    };
  };

  const withWaste = (baseOutputKey: string, wasteKey: string): DraftOutput => {
    const base = dependency(baseOutputKey);
    const waste = numberInput('commercial', wasteKey, { maximum: 100 });
    const holds = [...base.holds, ...waste.holds];
    return {
      quantity: holds.length ? null : Number(base.value) * (1 + Number(waste.value) / 100),
      holds,
      values: [...base.trace, ...waste.trace],
      measurementIds: base.measurementIds,
    };
  };

  const laborFrom = (physicalOutputKeys: string[], rateKey: string): DraftOutput => {
    const dependencies = physicalOutputKeys.map(dependency);
    const rate = numberInput('production', rateKey);
    const holds = [...dependencies.flatMap(item => item.holds), ...rate.holds];
    return {
      quantity: holds.length ? null : dependencies.reduce((sum, item) => sum + Number(item.value), 0) * Number(rate.value),
      holds: holds.map(hold => hold.code === 'input_required' && hold.requiredInputs?.includes(rateKey)
        ? { ...hold, code: 'labor_rate_required' as const }
        : hold),
      values: [...dependencies.flatMap(item => item.trace), ...rate.trace],
      measurementIds: dependencies.flatMap(item => item.measurementIds),
    };
  };

  if (archetype.key === 'pad_column_footing') {
    const count = roleQuantity('locations', true);
    const width = numberInput('planFacts', 'width_ft', { positive: true });
    const length = numberInput('planFacts', 'length_ft', { positive: true });
    const depth = numberInput('planFacts', 'depth_ft', { positive: true });
    const concrete = multiply(count, width, length, depth);
    emit('concrete.installed_cy', { ...concrete, quantity: concrete.quantity === null ? null : concrete.quantity / 27, measurementIds: count.measurementIds });
    emit('concrete.procurement_cy', withWaste('concrete.installed_cy', 'concrete_waste_pct'));

    const formedSides = numberInput('methods', 'formed_sides', { integer: true, maximum: 4 });
    const formInputs = [count, width, length, depth, formedSides];
    const formHolds = formInputs.flatMap(value => value.holds);
    emit('forms.contact_sf', {
      quantity: formHolds.length ? null : Number(count.value) * 2 * (Number(width.value) + Number(length.value)) * Number(depth.value) * (Number(formedSides.value) / 4),
      holds: formHolds,
      values: formInputs.flatMap(value => value.trace),
      measurementIds: count.measurementIds,
    });

    const rebarLf = numberInput('methods', 'rebar_lf_per_each', { positive: true });
    const rebarWeight = numberInput('methods', 'rebar_unit_weight_lb_per_ft', { positive: true });
    const rebarWaste = numberInput('commercial', 'rebar_waste_pct', { maximum: 100 });
    const rebarInputs = [count, rebarLf, rebarWeight, rebarWaste];
    const rebarHolds = rebarInputs.flatMap(value => value.holds);
    emit('reinforcing.steel_lb', {
      quantity: rebarHolds.length ? null : Number(count.value) * Number(rebarLf.value) * Number(rebarWeight.value) * (1 + Number(rebarWaste.value) / 100),
      holds: rebarHolds,
      values: rebarInputs.flatMap(value => value.trace),
      measurementIds: count.measurementIds,
    });

    const anchorRole = roleQuantity('anchors_embeds', false);
    const anchorsPerEach = numberInput('planFacts', 'anchor_count_per_each');
    const hasAnchorRole = anchorRole.measurementIds.length > 0;
    emit('anchors_embeds.anchor_ea', hasAnchorRole
      ? { quantity: anchorRole.value, values: anchorRole.trace, measurementIds: anchorRole.measurementIds }
      : {
          quantity: anchorsPerEach.holds.length ? null : Number(count.value) * Number(anchorsPerEach.value),
          holds: anchorsPerEach.holds,
          values: [...count.trace, ...anchorsPerEach.trace],
          measurementIds: count.measurementIds,
        });

    emit('labor.place_concrete_mh', laborFrom(['concrete.installed_cy'], 'place_concrete_mh_per_cy'));
    emit('labor.forms_mh', laborFrom(['forms.contact_sf'], 'form_mh_per_sf'));
    emit('labor.reinforcing_mh', laborFrom(['reinforcing.steel_lb'], 'rebar_mh_per_lb'));
    emit('labor.anchors_embeds_mh', laborFrom(['anchors_embeds.anchor_ea'], 'anchor_embed_mh_per_ea'));
  }

  if (archetype.key === 'strip_wall_footing') {
    const run = roleQuantity('run', true);
    const width = numberInput('planFacts', 'width_ft', { positive: true });
    const depth = numberInput('planFacts', 'depth_ft', { positive: true });
    const concrete = multiply(run, width, depth);
    emit('concrete.installed_cy', { ...concrete, quantity: concrete.quantity === null ? null : concrete.quantity / 27, measurementIds: run.measurementIds });
    emit('concrete.procurement_cy', withWaste('concrete.installed_cy', 'concrete_waste_pct'));

    const formedSides = numberInput('methods', 'formed_sides', { integer: true, maximum: 2 });
    const sideInputs = [run, depth, formedSides];
    const sideHolds = sideInputs.flatMap(value => value.holds);
    emit('forms.side_contact_sf', {
      quantity: sideHolds.length ? null : Number(run.value) * Number(depth.value) * Number(formedSides.value),
      holds: sideHolds,
      values: sideInputs.flatMap(value => value.trace),
      measurementIds: run.measurementIds,
    });

    const endForms = roleQuantity('end_forms', false);
    const endInputs = [endForms, width, depth];
    const endHolds = endInputs.flatMap(value => value.holds);
    emit('forms.end_contact_sf', {
      quantity: endHolds.length ? null : Number(endForms.value) * Number(width.value) * Number(depth.value),
      holds: endHolds,
      values: endInputs.flatMap(value => value.trace),
      measurementIds: endForms.measurementIds,
    });

    const barCount = numberInput('methods', 'longitudinal_bar_count', { positive: true, integer: true });
    const barWeight = numberInput('methods', 'rebar_unit_weight_lb_per_ft', { positive: true });
    const rebarWaste = numberInput('commercial', 'rebar_waste_pct', { maximum: 100 });
    const rebarInputs = [run, barCount, barWeight, rebarWaste];
    const rebarHolds = rebarInputs.flatMap(value => value.holds);
    emit('reinforcing.steel_lb', {
      quantity: rebarHolds.length ? null : Number(run.value) * Number(barCount.value) * Number(barWeight.value) * (1 + Number(rebarWaste.value) / 100),
      holds: rebarHolds,
      values: rebarInputs.flatMap(value => value.trace),
      measurementIds: run.measurementIds,
    });

    const anchorRole = roleQuantity('anchors_embeds', false);
    const anchorsPerLf = numberInput('planFacts', 'anchor_count_per_lf');
    const hasAnchorRole = anchorRole.measurementIds.length > 0;
    emit('anchors_embeds.anchor_ea', hasAnchorRole
      ? { quantity: anchorRole.value, values: anchorRole.trace, measurementIds: anchorRole.measurementIds }
      : {
          quantity: anchorsPerLf.holds.length ? null : Number(run.value) * Number(anchorsPerLf.value),
          holds: anchorsPerLf.holds,
          values: [...run.trace, ...anchorsPerLf.trace],
          measurementIds: run.measurementIds,
        });

    emit('labor.place_concrete_mh', laborFrom(['concrete.installed_cy'], 'place_concrete_mh_per_cy'));
    emit('labor.forms_mh', laborFrom(['forms.side_contact_sf', 'forms.end_contact_sf'], 'form_mh_per_sf'));
    emit('labor.reinforcing_mh', laborFrom(['reinforcing.steel_lb'], 'rebar_mh_per_lb'));
    emit('labor.anchors_embeds_mh', laborFrom(['anchors_embeds.anchor_ea'], 'anchor_embed_mh_per_ea'));
  }

  if (archetype.key === 'slab_on_grade') {
    const area = roleQuantity('area', true);
    const thickness = numberInput('planFacts', 'thickness_in', { positive: true });
    const concrete = multiply(area, thickness);
    emit('concrete.installed_cy', { ...concrete, quantity: concrete.quantity === null ? null : concrete.quantity / 12 / 27, measurementIds: area.measurementIds });
    emit('concrete.procurement_cy', withWaste('concrete.installed_cy', 'concrete_waste_pct'));

    const edge = roleQuantity('edge_forms', true);
    const edgeForm = multiply(edge, thickness);
    emit('forms.edge_contact_sf', { ...edgeForm, quantity: edgeForm.quantity === null ? null : edgeForm.quantity / 12, measurementIds: edge.measurementIds });

    const rebarAllowance = numberInput('methods', 'reinforcing_lb_per_sf', { positive: true });
    const rebarWaste = numberInput('commercial', 'rebar_waste_pct', { maximum: 100 });
    const rebarInputs = [area, rebarAllowance, rebarWaste];
    const rebarHolds = rebarInputs.flatMap(value => value.holds);
    emit('reinforcing.steel_lb', {
      quantity: rebarHolds.length ? null : Number(area.value) * Number(rebarAllowance.value) * (1 + Number(rebarWaste.value) / 100),
      holds: rebarHolds,
      values: rebarInputs.flatMap(value => value.trace),
      measurementIds: area.measurementIds,
    });

    const vaporWaste = numberInput('commercial', 'vapor_barrier_waste_pct', { maximum: 100 });
    const vaporInputs = [area, vaporWaste];
    const vaporHolds = vaporInputs.flatMap(value => value.holds);
    emit('slab_systems.vapor_barrier_sf', {
      quantity: vaporHolds.length ? null : Number(area.value) * (1 + Number(vaporWaste.value) / 100),
      holds: vaporHolds,
      values: vaporInputs.flatMap(value => value.trace),
      measurementIds: area.measurementIds,
    });

    const baseDepth = numberInput('planFacts', 'base_depth_in', { positive: true });
    const base = multiply(area, baseDepth);
    emit('slab_systems.base_cy', { ...base, quantity: base.quantity === null ? null : base.quantity / 12 / 27, measurementIds: area.measurementIds });

    const anchors = roleQuantity('anchors_embeds', true);
    emit('anchors_embeds.anchor_ea', { quantity: anchors.value, holds: anchors.holds, values: anchors.trace, measurementIds: anchors.measurementIds });

    const placeFinishRate = numberInput('production', 'place_finish_mh_per_sf');
    const placeFinishHolds = [...area.holds, ...placeFinishRate.holds];
    emit('labor.place_finish_mh', {
      quantity: placeFinishHolds.length ? null : Number(area.value) * Number(placeFinishRate.value),
      holds: placeFinishHolds.map(hold => hold.requiredInputs?.includes('place_finish_mh_per_sf')
        ? { ...hold, code: 'labor_rate_required' as const }
        : hold),
      values: [...area.trace, ...placeFinishRate.trace],
      measurementIds: area.measurementIds,
    });
    emit('labor.forms_mh', laborFrom(['forms.edge_contact_sf'], 'form_mh_per_sf'));
    emit('labor.reinforcing_mh', laborFrom(['reinforcing.steel_lb'], 'rebar_mh_per_lb'));
    emit('labor.anchors_embeds_mh', laborFrom(['anchors_embeds.anchor_ea'], 'anchor_embed_mh_per_ea'));
  }

  return {
    archetypeKey: archetype.key,
    conditionVersionId: request.conditionVersionId,
    outputs: archetype.outputs.map(definition => {
      const calculated = outputs.get(definition.outputKey);
      if (!calculated) throw new Error(`Condition algorithm did not emit ${definition.outputKey}.`);
      return calculated;
    }),
  };
}
