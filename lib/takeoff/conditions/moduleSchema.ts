import type {
  ConditionArchetypeDefinition,
  ConditionModuleConfiguration,
  ConditionModuleDefinition,
  ConditionModuleInputDefinition,
  ConditionModuleKey,
  ConditionScalar,
} from './types.ts';

export const conditionModuleIdentity = (module: Pick<ConditionModuleConfiguration, 'moduleKey' | 'instanceKey'>) =>
  `${module.moduleKey}:${module.instanceKey || 'default'}`;

export function conditionModuleDefinition(
  definition: ConditionArchetypeDefinition,
  moduleKey: ConditionModuleKey,
): ConditionModuleDefinition | null {
  return definition.modules?.find(module => module.key === moduleKey) || null;
}

export function conditionModuleFieldVisible(
  moduleKey: ConditionModuleKey,
  field: ConditionModuleInputDefinition,
  values: Record<string, ConditionScalar>,
) {
  const kind = String(values.kind || '');
  if (moduleKey === 'reinforcing') {
    if (field.key === 'custom_unit_weight_lb_per_ft') return values.bar_size === 'Custom';
    if (['bars_per_run', 'splice_policy', 'stock_length_ft', 'lap_length_in'].includes(field.key)) {
      if (kind !== 'continuous') return false;
      if (['stock_length_ft', 'lap_length_in'].includes(field.key)) return values.splice_policy === 'stock_lap';
      return true;
    }
    if (['spacing_in', 'pieces_per_location', 'piece_length_ft', 'extra_locations'].includes(field.key)) {
      return ['transverse', 'dowel', 'stirrup'].includes(kind);
    }
    if (field.key === 'custom_total_length_ft') return kind === 'custom';
  }
  if (moduleKey === 'anchors_embeds') {
    const mode = String(values.count_mode || '');
    if (field.key === 'spacing_in' || field.key === 'per_location' || field.key === 'extra_count') return mode === 'spacing';
    if (field.key === 'fixed_count') return mode === 'fixed_count';
  }
  if (moduleKey === 'forms') {
    if (field.key === 'form_material_factor_lf_per_lf') return Boolean(values.resource_tracking);
    if (field.key === 'stake_spacing_ft' || field.key === 'stakes_per_location') return Boolean(values.stakes_enabled);
  }
  if (moduleKey === 'excavation_backfill') {
    if (field.key === 'working_room_each_side_ft') return values.bottom_width_mode === 'footing_plus_working_room';
    if (field.key === 'bottom_width_ft') return values.bottom_width_mode === 'explicit';
  }
  if (moduleKey === 'finish_cure_protection') {
    if (field.key === 'finish_type') return Boolean(values.finish_enabled);
    if (field.key === 'protection_type') return Boolean(values.cure_enabled);
  }
  return true;
}

export function nextConditionModuleInstanceKey(
  moduleKey: ConditionModuleKey,
  modules: ConditionModuleConfiguration[],
) {
  let sequence = 1;
  const used = new Set(modules.filter(module => module.moduleKey === moduleKey).map(module => module.instanceKey || 'default'));
  while (used.has(`${moduleKey}-${sequence}`)) sequence += 1;
  return `${moduleKey}-${sequence}`;
}

export function cloneConditionModule(
  conditionVersionId: string,
  definition: ConditionModuleDefinition,
  modules: ConditionModuleConfiguration[],
  preset: Record<string, ConditionScalar> = {},
): ConditionModuleConfiguration & { conditionVersionId: string } {
  const instanceKey = nextConditionModuleInstanceKey(definition.key, modules);
  const sameKindCount = modules.filter(module => module.moduleKey === definition.key).length;
  return {
    conditionVersionId,
    moduleKey: definition.key,
    instanceKey,
    label: definition.repeatable ? `${definition.label} ${sameKindCount + 1}` : definition.label,
    enabled: true,
    inputValues: preset,
    inputProvenance: Object.fromEntries(Object.keys(preset).map(key => [key, { mode: 'project_value', sourceLabel: 'Condition Properties' }])),
    sortOrder: Math.max(0, ...modules.map(module => Number(module.sortOrder || 0))) + 10,
  };
}
