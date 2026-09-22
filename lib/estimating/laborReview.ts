export type LaborReviewOutput = {
  estimate_item_type?: string | null;
  estimated_man_hours?: unknown;
  direct_cost?: unknown;
  baseline_man_hours_per_unit?: unknown;
  job_man_hours_per_unit?: unknown;
  pricing_status?: string | null;
};

export type LaborReviewSummary = {
  operations: number;
  totalManHours: number;
  totalDirectCost: number;
  jobOverrides: number;
  missingLaborRate: number;
  missingAssumption: number;
};

const numberOrNull = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const numberValue = (value: unknown) => numberOrNull(value) ?? 0;

export function getEffectiveManHoursPerUnit(output: Pick<LaborReviewOutput, 'baseline_man_hours_per_unit' | 'job_man_hours_per_unit'>) {
  return numberOrNull(output.job_man_hours_per_unit) ?? numberOrNull(output.baseline_man_hours_per_unit);
}

export function getLaborReviewSummary(outputs: LaborReviewOutput[]): LaborReviewSummary {
  const labor = outputs.filter(output => String(output.estimate_item_type || '').toLowerCase() === 'labor');
  return labor.reduce<LaborReviewSummary>((summary, output) => {
    summary.operations += 1;
    summary.totalManHours += Math.max(numberValue(output.estimated_man_hours), 0);
    summary.totalDirectCost += Math.max(numberValue(output.direct_cost), 0);
    if (numberOrNull(output.job_man_hours_per_unit) !== null) summary.jobOverrides += 1;
    if (String(output.pricing_status || '').toLowerCase() === 'missing_labor_rate') summary.missingLaborRate += 1;
    if (getEffectiveManHoursPerUnit(output) === null) summary.missingAssumption += 1;
    return summary;
  }, {
    operations: 0,
    totalManHours: 0,
    totalDirectCost: 0,
    jobOverrides: 0,
    missingLaborRate: 0,
    missingAssumption: 0,
  });
}
