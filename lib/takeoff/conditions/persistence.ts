import { CONDITION_INPUT_GROUPS } from './types.ts';
import type {
  ConditionCalculation,
  ConditionInputGroups,
  ConditionInputProvenance,
  ConditionRawInputGroups,
  ConditionValueMode,
} from './types.ts';

export type ConditionCommitOutput = {
  output_key: string;
  output_instance_key: 'default';
  module_key: string;
  module_instance_key: 'default';
  driver_measurement_id: string | null;
  label: string;
  resource_class: string;
  production_quantity: number | null;
  production_unit: string;
  quantity_mode: 'derived' | 'explicit_override';
  status: 'ready' | 'held' | 'inactive';
  provenance: Record<string, unknown>;
  calculation_trace: Record<string, unknown>;
  holds: Array<{
    hold_code: string;
    message: string;
    details: Record<string, unknown>;
  }>;
};

const own = (value: object | undefined, key: string) =>
  Boolean(value && Object.prototype.hasOwnProperty.call(value, key));

function safeMode(mode: ConditionValueMode | undefined, fallback: ConditionValueMode): ConditionValueMode {
  return mode === 'platform_default'
    || mode === 'company_default'
    || mode === 'project_value'
    || mode === 'explicit_override'
    ? mode
    : fallback;
}

/** Resolve immutable company defaults and the current project snapshot for the calculation kernel. */
export function resolveConditionInputGroups({
  companyDefaults = {},
  companyProvenance = {},
  projectValues = {},
  projectProvenance = {},
}: {
  companyDefaults?: ConditionRawInputGroups;
  companyProvenance?: ConditionInputProvenance;
  projectValues?: ConditionRawInputGroups;
  projectProvenance?: ConditionInputProvenance;
}): ConditionInputGroups {
  const resolved: ConditionInputGroups = {};

  for (const group of CONDITION_INPUT_GROUPS) {
    const defaultValues = companyDefaults[group] || {};
    const localValues = projectValues[group] || {};
    const keys = new Set([...Object.keys(defaultValues), ...Object.keys(localValues)]);
    if (!keys.size) continue;

    resolved[group] = {};
    for (const key of keys) {
      const isProjectValue = own(localValues, key);
      const provenance = isProjectValue
        ? projectProvenance[group]?.[key]
        : companyProvenance[group]?.[key];
      const fallbackMode: ConditionValueMode = isProjectValue ? 'project_value' : 'company_default';
      resolved[group]![key] = {
        value: isProjectValue ? localValues[key] : defaultValues[key],
        mode: safeMode(provenance?.mode, fallbackMode),
        ...(provenance?.sourceId ? { sourceId: provenance.sourceId } : {}),
        ...(provenance?.sourceLabel ? { sourceLabel: provenance.sourceLabel } : {}),
        ...(provenance?.note ? { note: provenance.note } : {}),
      };
    }
  }

  return resolved;
}

/** Build the database payload from the server calculation without accepting client quantities. */
export function buildConditionCommitOutputs(calculation: ConditionCalculation): ConditionCommitOutput[] {
  return calculation.outputs.map(output => ({
    output_key: output.outputKey,
    output_instance_key: 'default',
    module_key: output.moduleKey,
    module_instance_key: 'default',
    driver_measurement_id: output.trace.measurementIds.length === 1
      ? output.trace.measurementIds[0]
      : null,
    label: output.label,
    resource_class: output.resourceClass,
    production_quantity: output.quantity,
    production_unit: output.unit,
    quantity_mode: output.quantityMode,
    status: output.status,
    provenance: {
      engine: 'concrete_condition_v1',
      authority: 'server',
      measurement_ids: output.trace.measurementIds,
      ...(output.trace.override ? { override: output.trace.override } : {}),
    },
    calculation_trace: output.trace as unknown as Record<string, unknown>,
    holds: output.holds.map(hold => ({
      hold_code: hold.code,
      message: hold.message,
      details: {
        required_inputs: hold.requiredInputs || [],
        dependency_output_keys: hold.dependencyOutputKeys || [],
      },
    })),
  }));
}

export function assertCompleteConditionMappings(
  calculation: ConditionCalculation,
  mappedOutputKeys: string[],
) {
  const expected = new Set(calculation.outputs.map(output => output.outputKey));
  const actual = new Set(mappedOutputKeys);
  if (actual.size !== mappedOutputKeys.length) throw new Error('A Condition output is mapped more than once.');
  const missing = [...expected].filter(key => !actual.has(key));
  const unknown = [...actual].filter(key => !expected.has(key));
  if (missing.length || unknown.length) {
    throw new Error(`Condition compatibility mapping is incomplete${missing.length ? `; missing ${missing.join(', ')}` : ''}${unknown.length ? `; unknown ${unknown.join(', ')}` : ''}.`);
  }
}
