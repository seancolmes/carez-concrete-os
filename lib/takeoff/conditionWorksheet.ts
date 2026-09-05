import { buildConditionIssues, summarizeConditionIssues } from './conditions/issues.ts';

export type ConditionWorksheetOutput = {
  id?: string;
  output_key: string;
  label: string;
  production_quantity: number | string | null;
  production_unit: string;
  status: string;
  direct_cost: number | string;
  pricing_status: string;
};

export type ConditionWorksheetHold = {
  id?: string;
  hold_code: string;
  message: string;
  output_id?: string | null;
  status?: string;
};

export type ConditionWorksheetAuthority = {
  measurementId: string;
  conditionVersionId: string;
  conditionName: string;
  calculated: boolean;
  pendingRecalculation?: boolean;
  outputs: ConditionWorksheetOutput[];
  holds: ConditionWorksheetHold[];
};

export type ConditionWorksheetProjection = {
  concrete: string;
  reinforcing: string;
  formwork: string;
  manHours: number;
  cost: number;
  status: string;
  issues: string[];
  pricingMissing: number;
};

const numberText = (value: number, digits = 2) => value.toLocaleString('en-US', { maximumFractionDigits: digits });

function outputTotal(outputs: ConditionWorksheetOutput[], predicate: (output: ConditionWorksheetOutput) => boolean) {
  const relevant = outputs.filter(output => output.status !== 'inactive' && output.status !== 'held' && output.production_quantity !== null && predicate(output));
  if (!relevant.length) return '—';
  const totals = new Map<string, number>();
  for (const output of relevant) {
    const unit = String(output.production_unit || '').toUpperCase() || 'EA';
    totals.set(unit, (totals.get(unit) || 0) + Number(output.production_quantity || 0));
  }
  return [...totals].map(([unit, value]) => `${numberText(value)} ${unit}`).join(' + ');
}

export function projectConditionWorksheet(authority: ConditionWorksheetAuthority): ConditionWorksheetProjection {
  if (!authority.calculated) {
    return {
      concrete: '—',
      reinforcing: '—',
      formwork: '—',
      manHours: 0,
      cost: 0,
      status: authority.pendingRecalculation ? 'Pending recalculation' : 'Not calculated',
      issues: [],
      pricingMissing: 0,
    };
  }

  const issues = buildConditionIssues(authority.holds, authority.outputs);
  const issueSummary = summarizeConditionIssues(issues);
  const pricingMissing = issues.filter(issue => issue.category === 'pricing' || issue.category === 'production').length;
  const activeOutputs = authority.outputs.filter(output => output.status !== 'inactive');
  const calculationHolds = authority.outputs.filter(output => output.status === 'held').length + authority.holds.length;
  let status = 'Ready';
  if (calculationHolds > 0) status = `${issueSummary.total || calculationHolds} issue${(issueSummary.total || calculationHolds) === 1 ? '' : 's'}`;
  else if (pricingMissing > 0) status = `Qty ready · ${pricingMissing} price${pricingMissing === 1 ? '' : 's'} missing`;
  else if (issueSummary.total > 0) status = `${issueSummary.total} issue${issueSummary.total === 1 ? '' : 's'}`;

  return {
    concrete: outputTotal(activeOutputs, output => output.output_key === 'concrete.installed_cy'),
    reinforcing: outputTotal(activeOutputs, output => output.output_key === 'reinforcing.installed_lb' || output.output_key === 'reinforcing.steel_lb'),
    formwork: outputTotal(activeOutputs, output => output.output_key === 'forms.side_contact_sf' || output.output_key === 'forms.end_contact_sf' || output.output_key === 'forms.contact_sf' || output.output_key === 'forms.edge_contact_sf'),
    manHours: activeOutputs
      .filter(output => output.output_key.startsWith('labor.') && String(output.production_unit).toUpperCase() === 'HR' && output.status === 'ready')
      .reduce((sum, output) => sum + Number(output.production_quantity || 0), 0),
    cost: activeOutputs.reduce((sum, output) => sum + Number(output.direct_cost || 0), 0),
    status,
    issues: issues.map(issue => `${issue.label}: ${issue.message}`),
    pricingMissing,
  };
}
