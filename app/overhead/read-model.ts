export type Read<T> = {data: T | null; error: unknown};
export type Measure = {value: number | null; state: 'recorded' | 'missing' | 'unavailable'};

const recorded = (value: number): Measure => ({value, state: 'recorded'});
const missing: Measure = {value: null, state: 'missing'};
const unavailable: Measure = {value: null, state: 'unavailable'};

export function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '' || typeof value === 'string' && value.trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function field(read: Read<Record<string, unknown>>, name: string): Measure {
  if (read.error) return unavailable;
  if (!read.data) return missing;
  const value = finiteNumber(read.data[name]);
  return value === null ? missing : recorded(value);
}

function combine(values: Measure[], calculate: (...numbers: number[]) => number): Measure {
  if (values.some(value => value.state === 'unavailable')) return unavailable;
  if (values.some(value => value.state === 'missing')) return missing;
  return recorded(calculate(...values.map(value => value.value as number)));
}

export type OverheadItem = {
  id: string;
  category: string;
  name: string;
  active: boolean | null;
  amount: unknown;
  frequency: string | null;
  business_use_percent: unknown;
  sort_order?: number | null;
};

export function annualize(item: OverheadItem): Measure {
  if (item.active === false) return recorded(0);
  const amount = finiteNumber(item.amount);
  const use = finiteNumber(item.business_use_percent);
  const multiplier = {weekly: 52, monthly: 12, quarterly: 4, annual: 1}[item.frequency || ''] ?? null;
  if (amount === null || use === null || multiplier === null || item.active !== true) return missing;
  return recorded(amount * multiplier * use / 100);
}

export function overheadReadModel(args: {
  company: Read<Record<string, unknown>>;
  items: Read<OverheadItem[]>;
  actual: Read<Record<string, unknown>>;
}) {
  const {company, items, actual} = args;
  const businessAnnual = items.error ? unavailable : items.data === null ? missing :
    combine(items.data.map(annualize), (...amounts) => amounts.reduce((sum, amount) => sum + amount, 0));
  const ownerFieldValue = combine([
    field(company, 'owner_planned_field_hours_annual'), field(company, 'owner_field_rate'),
  ], (hours, rate) => hours * rate);
  const ownerOffice = combine([
    field(company, 'owner_compensation_target_annual'), ownerFieldValue,
  ], (target, fieldValue) => Math.max(0, target - fieldValue));
  const annual = combine([businessAnnual, ownerOffice], (business, office) => business + office);
  const monthly = combine([annual], value => value / 12);
  const hours = field(company, 'planned_productive_hours_annual');
  const perHour = annual.state === 'unavailable' || hours.state === 'unavailable'
    ? unavailable : hours.state === 'recorded' && (hours.value as number) <= 0
      ? missing : combine([annual, hours], (total, plannedHours) => total / plannedHours);
  return {
    businessAnnual, ownerFieldValue, ownerOffice, annual, monthly, hours, perHour,
    targetMargin: field(company, 'target_margin_percent'),
    actualThisMonth: field(actual, 'current_month_business_expense'),
  };
}

export function measureText(measure: Measure, format: (value: number) => string, missingText = 'Not set'): string {
  if (measure.state === 'unavailable') return 'Unavailable';
  if (measure.state === 'missing') return missingText;
  return format(measure.value as number);
}
