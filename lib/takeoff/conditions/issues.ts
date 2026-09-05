export type ConditionIssueCategory = 'calculation' | 'scope' | 'production' | 'commercial' | 'pricing';

export type ConditionIssue = {
  key: string;
  category: ConditionIssueCategory;
  label: string;
  message: string;
  outputKey?: string;
};

type HoldLike = {
  id?: string;
  hold_code?: string;
  message?: string;
  output_id?: string | null;
};

type OutputLike = {
  id?: string;
  output_key?: string;
  label?: string;
  status?: string;
  pricing_status?: string;
  production_quantity?: number | string | null;
  direct_cost?: number | string | null;
};

export const CONDITION_ISSUE_LABELS: Record<ConditionIssueCategory, string> = {
  calculation: 'Calculation hold',
  scope: 'Scope conflict',
  production: 'Production issue',
  commercial: 'Commercial issue',
  pricing: 'Pricing issue',
};

export function classifyConditionHold(hold: HoldLike): ConditionIssueCategory {
  const code = String(hold.hold_code || '').toLowerCase();
  const message = String(hold.message || '').toLowerCase();
  if (/role\.|takeoff|measurement|scope/.test(message)) return 'scope';
  if (code === 'labor_rate_required' || /labor|production|crew|man.?hour/.test(message)) return 'production';
  if (/procure|allowance|commercial|waste/.test(message)) return 'commercial';
  return 'calculation';
}

export function conditionOutputStatus(output: OutputLike): string {
  if (output.status === 'inactive') return 'Not included';
  if (output.status === 'held') return 'Calculation hold';
  if (output.pricing_status === 'missing_price' || output.pricing_status === 'missing_labor_rate') return 'Qty ready · Price missing';
  if (output.status === 'ready' && output.pricing_status === 'priced') return 'Ready';
  if (output.status === 'ready') return 'Qty ready';
  return 'Not calculated';
}

export function buildConditionIssues(holds: HoldLike[], outputs: OutputLike[]): ConditionIssue[] {
  const issues: ConditionIssue[] = [];
  for (const hold of holds) {
    const category = classifyConditionHold(hold);
    issues.push({
      key: `hold:${hold.id || `${hold.hold_code}:${hold.message}`}`,
      category,
      label: CONDITION_ISSUE_LABELS[category],
      message: String(hold.message || 'Condition calculation requires attention.'),
    });
  }
  for (const output of outputs) {
    if (output.status !== 'ready') continue;
    if (output.pricing_status !== 'missing_price' && output.pricing_status !== 'missing_labor_rate') continue;
    issues.push({
      key: `pricing:${output.id || output.output_key || output.label}`,
      category: output.pricing_status === 'missing_labor_rate' ? 'production' : 'pricing',
      label: output.pricing_status === 'missing_labor_rate' ? CONDITION_ISSUE_LABELS.production : CONDITION_ISSUE_LABELS.pricing,
      message: `${String(output.label || output.output_key || 'Output')} ${output.pricing_status === 'missing_labor_rate' ? 'labor rate is missing.' : 'price is missing.'}`,
      outputKey: output.output_key,
    });
  }
  const seen = new Set<string>();
  return issues.filter(issue => {
    const fingerprint = `${issue.category}|${issue.message}|${issue.outputKey || ''}`;
    if (seen.has(fingerprint)) return false;
    seen.add(fingerprint);
    return true;
  });
}

export function summarizeConditionIssues(issues: ConditionIssue[]) {
  const counts: Record<ConditionIssueCategory, number> = { calculation: 0, scope: 0, production: 0, commercial: 0, pricing: 0 };
  for (const issue of issues) counts[issue.category] += 1;
  const detail = (Object.entries(counts) as Array<[ConditionIssueCategory, number]>)
    .filter(([, count]) => count > 0)
    .map(([category, count]) => `${count} ${category}`)
    .join(' · ');
  return { total: issues.length, counts, detail };
}

export function pricedDirectCostSummary(outputs: OutputLike[]) {
  const priced = outputs.reduce((sum, output) => sum + Number(output.direct_cost || 0), 0);
  const missing = outputs.filter(output => output.status === 'ready' && (output.pricing_status === 'missing_price' || output.pricing_status === 'missing_labor_rate')).length;
  return { priced, missing, partial: missing > 0 };
}
