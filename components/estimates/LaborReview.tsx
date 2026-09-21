import {
  restoreGeneratedLaborAssumption,
  selectGeneratedLaborProfile,
  updateGeneratedLaborAssumption,
} from '@/app/estimates/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatTakeoffMeasurement } from '@/lib/takeoff/lengthFormat';
import {
  getEffectiveManHoursPerUnit,
  getLaborReviewSummary,
} from '@/lib/estimating/laborReview';

type Measurement = {
  id: string;
  name: string;
  location?: string | null;
  drawing_reference?: string | null;
};

type LaborOutput = {
  id: string;
  measurement_id: string;
  label?: string | null;
  estimate_item_type?: string | null;
  production_quantity?: number | string | null;
  production_unit?: string | null;
  estimated_man_hours?: number | string | null;
  baseline_man_hours_per_unit?: number | string | null;
  baseline_source?: string | null;
  job_man_hours_per_unit?: number | string | null;
  labor_assumption_override_by?: string | null;
  labor_assumption_override_at?: string | null;
  labor_rate_override_by?: string | null;
  labor_rate_override_at?: string | null;
  unit_cost?: number | string | null;
  direct_cost?: number | string | null;
  pricing_status?: string | null;
  price_source_kind?: string | null;
  price_source_id?: string | null;
  price_source_label?: string | null;
  price_source_reference?: string | null;
  price_effective_date?: string | null;
};

type LaborProfile = {
  id: string;
  name: string;
  burdened_hourly_rate: number | string;
  source_type?: string | null;
  source_label?: string | null;
  effective_date?: string | null;
  is_default?: boolean | null;
};

const money = (value: unknown) => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
}).format(Number(value || 0));

const decimal = (value: unknown, digits = 4) => {
  const number = Number(value);
  return Number.isFinite(number)
    ? number.toLocaleString('en-US', { maximumFractionDigits: digits })
    : '—';
};

const selectClass = 'h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground outline-none transition-shadow focus:border-ring focus:ring-3 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50';

function SummaryMetric({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'warning' | 'success' | 'primary';
}) {
  const toneClass = tone === 'warning'
    ? 'border-warning/30 bg-warning/5'
    : tone === 'success'
      ? 'border-success/30 bg-success/5'
      : tone === 'primary'
        ? 'border-primary/30 bg-accent'
        : 'border-border bg-card';
  const valueClass = tone === 'warning'
    ? 'text-warning'
    : tone === 'success'
      ? 'text-success'
      : tone === 'primary'
        ? 'text-primary'
        : 'text-foreground';

  return <div className={`rounded-lg border px-3 py-2.5 ${toneClass}`}>
    <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
    <div className={`mt-1 font-mono text-base font-semibold tabular-nums ${valueClass}`}>{value}</div>
  </div>;
}

function getLaborStatus(output: LaborOutput) {
  const effective = getEffectiveManHoursPerUnit(output);
  if (effective === null) return { label: 'Missing production assumption', tone: 'warning' as const, rank: 0 };
  if (String(output.pricing_status || '').toLowerCase() === 'missing_labor_rate') {
    return { label: 'Missing labor rate', tone: 'warning' as const, rank: 1 };
  }
  if (String(output.pricing_status || '').toLowerCase() === 'missing_input') {
    return { label: 'Input required', tone: 'warning' as const, rank: 2 };
  }
  if (output.job_man_hours_per_unit !== null && output.job_man_hours_per_unit !== undefined && output.job_man_hours_per_unit !== '') {
    return { label: 'Job override', tone: 'primary' as const, rank: 3 };
  }
  return { label: 'Baseline', tone: 'success' as const, rank: 4 };
}

function StatusBadge({ output }: { output: LaborOutput }) {
  const status = getLaborStatus(output);
  const className = status.tone === 'warning'
    ? 'border-warning/30 bg-warning/5 text-warning'
    : status.tone === 'primary'
      ? 'border-primary/30 bg-accent text-primary'
      : 'border-success/30 bg-success/5 text-success';
  return <span className={`inline-flex min-h-6 items-center rounded-md border px-2 text-[11px] font-semibold ${className}`}>{status.label}</span>;
}

export function LaborReview({
  estimateId,
  measurements,
  outputs,
  laborProfiles,
  locked,
}: {
  estimateId: string;
  measurements: Measurement[];
  outputs: LaborOutput[];
  laborProfiles: LaborProfile[];
  locked: boolean;
}) {
  const measurementById = new Map(measurements.map(measurement => [measurement.id, measurement]));
  const laborOutputs = outputs
    .filter(output => String(output.estimate_item_type || '').toLowerCase() === 'labor')
    .sort((first, second) => {
      const rank = getLaborStatus(first).rank - getLaborStatus(second).rank;
      if (rank) return rank;
      const firstMeasurement = measurementById.get(first.measurement_id);
      const secondMeasurement = measurementById.get(second.measurement_id);
      return `${firstMeasurement?.name || ''} ${first.label || ''}`
        .localeCompare(`${secondMeasurement?.name || ''} ${second.label || ''}`);
    });
  const summary = getLaborReviewSummary(laborOutputs);
  const profiles = [...laborProfiles].sort((first, second) => {
    if (Boolean(first.is_default) !== Boolean(second.is_default)) return first.is_default ? -1 : 1;
    return first.name.localeCompare(second.name);
  });

  return <section className="space-y-4" aria-labelledby="labor-review-title">
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Labor</p>
      <h2 id="labor-review-title" className="mt-1 text-lg font-semibold">Labor review</h2>
      <p className="mt-1 text-sm text-muted-foreground">Review production assumptions separately from burdened labor-rate sources. Production Quantity remains controlled by Condition and Takeoff.</p>
    </div>

    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <SummaryMetric label="Operations" value={String(summary.operations)} />
      <SummaryMetric label="Estimated MH" value={decimal(summary.totalManHours, 2)} tone="primary" />
      <SummaryMetric label="Labor Direct Cost" value={money(summary.totalDirectCost)} />
      <SummaryMetric label="Job overrides" value={String(summary.jobOverrides)} tone={summary.jobOverrides ? 'primary' : 'default'} />
      <SummaryMetric label="Missing labor rate" value={String(summary.missingLaborRate)} tone={summary.missingLaborRate ? 'warning' : 'success'} />
      <SummaryMetric label="Missing assumption" value={String(summary.missingAssumption)} tone={summary.missingAssumption ? 'warning' : 'success'} />
    </div>

    <Card className="shadow-none">
      <CardHeader className="gap-1">
        <CardTitle>Production-rate build-up</CardTitle>
        <CardDescription>Baseline MH/unit comes from the published labor model. A job override changes only the production assumption; selecting a labor profile changes only the burdened rate source.</CardDescription>
      </CardHeader>
      <CardContent>
        {laborOutputs.length === 0 ? <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">No generated labor operations are available yet.</div> :
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[1420px] border-collapse text-sm">
              <thead className="bg-muted/60 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Condition / operation</th>
                  <th className="px-3 py-2 text-right font-semibold">Production Quantity</th>
                  <th className="px-3 py-2 text-right font-semibold">Baseline MH / unit</th>
                  <th className="px-3 py-2 text-left font-semibold">Job MH / unit</th>
                  <th className="px-3 py-2 text-right font-semibold">Estimated MH</th>
                  <th className="px-3 py-2 text-left font-semibold">Burdened rate</th>
                  <th className="px-3 py-2 text-right font-semibold">Direct Cost</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {laborOutputs.map(output => {
                  const measurement = measurementById.get(output.measurement_id);
                  const effectiveMh = getEffectiveManHoursPerUnit(output);
                  const hasOverride = output.job_man_hours_per_unit !== null && output.job_man_hours_per_unit !== undefined && output.job_man_hours_per_unit !== '';
                  const selectedProfileId = output.price_source_kind === 'labor_profile' ? String(output.price_source_id || '') : '';
                  const exception = getLaborStatus(output).tone === 'warning';

                  return <tr key={output.id} className={exception ? 'bg-warning/5 align-top' : 'align-top'}>
                    <td className="px-3 py-3">
                      <div className="font-medium">{output.label || 'Labor operation'}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{measurement?.name || 'Takeoff measurement'}{measurement?.location ? ` · ${measurement.location}` : ''}{measurement?.drawing_reference ? ` · ${measurement.drawing_reference}` : ''}</div>
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-xs font-semibold tabular-nums">{formatTakeoffMeasurement(output.production_quantity, output.production_unit)}</td>
                    <td className="px-3 py-3 text-right">
                      <div className="font-mono text-xs font-semibold tabular-nums">{output.baseline_man_hours_per_unit === null || output.baseline_man_hours_per_unit === undefined || output.baseline_man_hours_per_unit === '' ? '—' : decimal(output.baseline_man_hours_per_unit, 6)}</div>
                      <div className="mt-1 max-w-48 text-[11px] text-muted-foreground">{output.baseline_source || 'No baseline source'}</div>
                    </td>
                    <td className="px-3 py-3">
                      {locked ? <div className="font-mono text-xs font-semibold tabular-nums">{effectiveMh === null ? '—' : decimal(effectiveMh, 6)}</div> :
                        <div className="grid gap-2">
                          <form action={updateGeneratedLaborAssumption} className="flex items-center gap-1.5">
                            <input type="hidden" name="estimate_id" value={estimateId}/>
                            <input type="hidden" name="output_id" value={output.id}/>
                            <Input
                              aria-label={`Job MH per unit for ${output.label || 'labor operation'}`}
                              name="man_hours_per_unit"
                              type="number"
                              min="0"
                              step="0.000001"
                              defaultValue={effectiveMh ?? ''}
                              required
                              className="h-8 min-w-24 text-right font-mono text-xs"
                            />
                            <Button type="submit" variant="outline" size="sm">Save</Button>
                          </form>
                          {hasOverride ? <form action={restoreGeneratedLaborAssumption}>
                            <input type="hidden" name="estimate_id" value={estimateId}/>
                            <input type="hidden" name="output_id" value={output.id}/>
                            <Button type="submit" variant="ghost" size="sm" className="h-7 px-1.5 text-[11px]">Restore baseline</Button>
                          </form> : null}
                        </div>}
                      {hasOverride && output.labor_assumption_override_at ? <div className="mt-1 text-[11px] text-muted-foreground">Override saved {output.labor_assumption_override_at.slice(0, 10)}</div> : null}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-xs font-semibold tabular-nums">{decimal(output.estimated_man_hours, 2)}</td>
                    <td className="px-3 py-3">
                      <div className="font-mono text-xs font-semibold tabular-nums">{money(output.unit_cost)} / HR</div>
                      <div className="mt-1 max-w-56 text-[11px] text-muted-foreground">{output.price_source_label || output.cost_source || (output.pricing_status === 'missing_labor_rate' ? 'Missing labor rate' : 'No labor rate source')}{output.price_effective_date ? ` · effective ${output.price_effective_date}` : ''}</div>
                      {!locked ? <form action={selectGeneratedLaborProfile} className="mt-2 flex items-center gap-1.5">
                        <input type="hidden" name="estimate_id" value={estimateId}/>
                        <input type="hidden" name="output_id" value={output.id}/>
                        <select className={selectClass} name="labor_profile_id" defaultValue={selectedProfileId} required aria-label={`Labor rate profile for ${output.label || 'labor operation'}`}>
                          <option value="" disabled>Select labor profile</option>
                          {profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.name} · {money(profile.burdened_hourly_rate)}/HR{profile.is_default ? ' · default' : ''}</option>)}
                        </select>
                        <Button type="submit" variant="outline" size="sm">Use rate</Button>
                      </form> : null}
                      {output.labor_rate_override_at ? <div className="mt-1 text-[11px] text-muted-foreground">Rate source selected {output.labor_rate_override_at.slice(0, 10)}</div> : null}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-xs font-semibold tabular-nums">{money(output.direct_cost)}</td>
                    <td className="px-3 py-3"><StatusBadge output={output}/></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>}
      </CardContent>
    </Card>
  </section>;
}
