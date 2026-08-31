export type WorksheetLine = {
  item_type?: string | null;
  quantity?: unknown;
  unit?: string | null;
  regular_hours?: unknown;
  overtime_hours?: unknown;
  direct_cost?: unknown;
  source_takeoff_output_id?: string | null;
};

export type WorksheetOutput = {
  pricing_status?: string | null;
  cost_source?: string | null;
} | null | undefined;

export type WorksheetPricingState =
  | 'price_required'
  | 'manual_override'
  | 'priced'
  | 'manual';

const numberValue = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function getWorksheetPricingState(
  line: WorksheetLine,
  output: WorksheetOutput,
): WorksheetPricingState {
  if (!line.source_takeoff_output_id || !output) return 'manual';
  const status = String(output.pricing_status || '').toLowerCase();
  if (status === 'missing_price' || status === 'missing_labor_rate') {
    return 'price_required';
  }
  if (status === 'manual_override') return 'manual_override';
  return 'priced';
}

export function getWorksheetPricingLabel(state: WorksheetPricingState) {
  if (state === 'price_required') return 'PRICE REQUIRED';
  if (state === 'manual_override') return 'MANUAL OVERRIDE';
  if (state === 'priced') return 'PRICED';
  return 'MANUAL';
}

export function getWorksheetLineQuantity(line: WorksheetLine) {
  const itemType = String(line.item_type || '').toLowerCase();
  const unit = itemType === 'labor' ? 'HR' : String(line.unit || '').toUpperCase();
  const explicitHours = numberValue(line.regular_hours) + numberValue(line.overtime_hours);
  const quantity = itemType === 'labor' && explicitHours > 0
    ? explicitHours
    : numberValue(line.quantity);
  return { quantity, unit };
}

export function getWorksheetCostBuckets(line: WorksheetLine) {
  const directCost = Math.max(numberValue(line.direct_cost), 0);
  const itemType = String(line.item_type || '').toLowerCase();
  return {
    material: itemType === 'material' ? directCost : 0,
    labor: itemType === 'labor' ? directCost : 0,
    equipment: ['equipment', 'subcontractor', 'other'].includes(itemType) ? directCost : 0,
    total: directCost,
  };
}
