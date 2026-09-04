import type { ConditionCalculation, ConditionOutput } from './types.ts';

export type LegacyConditionOutputMapping = {
  outputKey: string;
  assemblyComponentId: string;
  componentKey: string;
  label: string;
  estimateItemType: 'labor' | 'material' | 'equipment' | 'subcontractor' | 'other';
  outputUnit: string;
  costCodeId?: string | null;
  catalogItemId?: string | null;
  productionTaskId?: string | null;
  unitCost?: number | null;
  costSource?: string | null;
  baselineSource?: string | null;
};

export type LegacyPreparedConditionOutput = {
  assembly_component_id: string;
  component_key: string;
  label: string;
  estimate_item_type: LegacyConditionOutputMapping['estimateItemType'];
  cost_code_id: string;
  catalog_item_id: string;
  production_task_id: string;
  production_quantity: number;
  production_unit: string;
  estimated_man_hours: number;
  baseline_man_hours_per_unit: '';
  baseline_source: string;
  unit_cost: number;
  cost_source: string;
  direct_cost: number;
  pricing_status: 'priced' | 'missing_price' | 'missing_input' | 'not_priced';
  formula_trace: Record<string, unknown>;
};

const moneyRound = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

function pricingState(output: ConditionOutput, mapping: LegacyConditionOutputMapping) {
  if (output.status === 'held') return { status: 'missing_input' as const, unitCost: 0, directCost: 0 };
  if (output.status === 'inactive' || output.quantity === 0) return { status: 'not_priced' as const, unitCost: 0, directCost: 0 };
  const unitCost = Number(mapping.unitCost || 0);
  if (!(unitCost > 0)) return { status: 'missing_price' as const, unitCost: 0, directCost: 0 };
  return { status: 'priced' as const, unitCost, directCost: moneyRound(Number(output.quantity) * unitCost) };
}

/**
 * Converts Condition results into the existing atomic Takeoff RPC payload.
 *
 * This is intentionally a one-way persistence adapter. The legacy formula engine
 * does not calculate Condition quantities and no legacy record is rewritten.
 */
export function adaptConditionOutputsToLegacy(
  calculation: ConditionCalculation,
  mappings: LegacyConditionOutputMapping[],
): LegacyPreparedConditionOutput[] {
  const seenOutputs = new Set<string>();
  const seenComponents = new Set<string>();

  return mappings.map(mapping => {
    if (!mapping.assemblyComponentId.trim()) throw new Error(`Legacy component ID is required for ${mapping.outputKey}.`);
    if (seenOutputs.has(mapping.outputKey)) throw new Error(`Condition output ${mapping.outputKey} is mapped more than once.`);
    if (seenComponents.has(mapping.assemblyComponentId)) throw new Error(`Legacy component ${mapping.assemblyComponentId} is mapped more than once.`);
    seenOutputs.add(mapping.outputKey);
    seenComponents.add(mapping.assemblyComponentId);

    const output = calculation.outputs.find(item => item.outputKey === mapping.outputKey);
    if (!output) throw new Error(`Condition output ${mapping.outputKey} was not calculated.`);
    if (output.unit.toUpperCase() !== mapping.outputUnit.toUpperCase()) {
      throw new Error(`${mapping.outputKey} produces ${output.unit}, but its legacy component requires ${mapping.outputUnit}.`);
    }

    const pricing = pricingState(output, mapping);
    const quantity = output.status === 'ready' ? Number(output.quantity || 0) : 0;
    const laborHours = mapping.estimateItemType === 'labor' ? quantity : 0;

    return {
      assembly_component_id: mapping.assemblyComponentId,
      component_key: mapping.componentKey,
      label: mapping.label,
      estimate_item_type: mapping.estimateItemType,
      cost_code_id: mapping.costCodeId || '',
      catalog_item_id: mapping.catalogItemId || '',
      production_task_id: mapping.productionTaskId || '',
      production_quantity: quantity,
      production_unit: mapping.outputUnit,
      estimated_man_hours: laborHours,
      baseline_man_hours_per_unit: '',
      baseline_source: mapping.baselineSource || 'Concrete Condition engine',
      unit_cost: pricing.unitCost,
      cost_source: mapping.costSource || '',
      direct_cost: pricing.directCost,
      pricing_status: pricing.status,
      formula_trace: {
        engine: 'concrete_condition_v1',
        compatibility_mode: true,
        condition_version_id: calculation.conditionVersionId,
        condition_output_key: output.outputKey,
        quantity_mode: output.quantityMode,
        status: output.status,
        holds: output.holds,
        trace: output.trace,
      },
    };
  });
}
