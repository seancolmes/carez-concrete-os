import {
  restoreGeneratedLaborAssumption,
  selectGeneratedLaborProfile,
  updateGeneratedLaborAssumption,
} from '@/app/estimates/actions';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
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
  cost_source?: string | null;
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

function SummaryMetric({label,value,tone='default'}:{label:string;value:string;tone?:'default'|'warning'}){
  return <div className="min-w-0 bg-card px-3 py-2">
    <div className="text-xs text-muted-foreground">{label}</div>
    <strong className={`mt-1 block font-mono text-base tabular-nums ${tone==='warning'?'text-warning':'text-foreground'}`}>{value}</strong>
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
  if(status.tone==='success')return null;
  const className = status.tone === 'warning'
    ? 'border-warning/30 bg-warning/5 text-warning'
    : 'border-primary/30 bg-accent text-primary';
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

  return <section className="space-y-3" aria-labelledby="labor-review-title">
    <div className="carez-page-heading"><h2 id="labor-review-title">Production labor</h2></div>

    <div className="grid grid-cols-2 gap-px border border-border bg-border lg:grid-cols-4" aria-label="Labor summary">
      <SummaryMetric label="Operations" value={String(summary.operations)} />
      <SummaryMetric label="Estimated MH" value={decimal(summary.totalManHours, 2)} />
      <SummaryMetric label="Direct labor cost" value={money(summary.totalDirectCost)} />
      <SummaryMetric label="Needs attention" value={String(summary.missingLaborRate+summary.missingAssumption)} tone={summary.missingLaborRate+summary.missingAssumption?'warning':'default'} />
    </div>

    <div className="border border-border" aria-label="Labor operations">
      <div className="hidden grid-cols-[minmax(0,2fr)_minmax(90px,.7fr)_minmax(90px,.7fr)_minmax(105px,.8fr)_auto] gap-3 border-b border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground md:grid">
        <span>Operation</span><span>Quantity</span><span>Est. MH</span><span>Direct cost</span><span className="sr-only">Actions</span>
      </div>
      {laborOutputs.length===0?<p className="px-3 py-6 text-sm text-muted-foreground">No generated labor operations are available yet.</p>:
        <div className="divide-y divide-border">{laborOutputs.map(output=>{
          const measurement=measurementById.get(output.measurement_id);
          const effectiveMh=getEffectiveManHoursPerUnit(output);
          const hasOverride=output.job_man_hours_per_unit!==null&&output.job_man_hours_per_unit!==undefined&&output.job_man_hours_per_unit!=='';
          const selectedProfileId=output.price_source_kind==='labor_profile'?String(output.price_source_id||''):'';
          const operation=output.label||'Labor operation';
          return <div key={output.id} className="grid gap-2 px-3 py-2 md:grid-cols-[minmax(0,2fr)_minmax(90px,.7fr)_minmax(90px,.7fr)_minmax(105px,.8fr)_auto] md:items-center md:gap-3">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm">{operation}</strong><StatusBadge output={output}/></div><p className="mt-0.5 truncate text-xs text-muted-foreground">{measurement?.name||'Takeoff measurement'}{measurement?.location?` · ${measurement.location}`:''}</p></div>
            <div className="grid grid-cols-3 gap-2 font-mono text-xs tabular-nums md:contents"><span><span className="block text-[11px] text-muted-foreground md:hidden">Quantity</span>{formatTakeoffMeasurement(output.production_quantity,output.production_unit)}</span><span><span className="block text-[11px] text-muted-foreground md:hidden">Est. MH</span>{decimal(output.estimated_man_hours,2)}</span><strong><span className="block font-sans text-[11px] font-normal text-muted-foreground md:hidden">Direct cost</span>{money(output.direct_cost)}</strong></div>
            <Sheet>
              <SheetTrigger render={<Button type="button" variant="outline" size="sm" className="w-fit md:justify-self-end"/>}>View / Edit</SheetTrigger>
              <SheetContent className="overflow-y-auto" style={{width:'100%',maxWidth:'420px'}}>
                <SheetHeader className="border-b border-border pr-12"><SheetTitle>{operation}</SheetTitle><SheetDescription>{measurement?.name||'Takeoff measurement'}{measurement?.location?` · ${measurement.location}`:''}{measurement?.drawing_reference?` · ${measurement.drawing_reference}`:''}</SheetDescription></SheetHeader>
                <div className="space-y-5 px-4 pb-6">
                  <dl className="grid grid-cols-2 gap-px border border-border bg-border text-sm"><div className="bg-card p-3"><dt className="text-xs text-muted-foreground">Production quantity</dt><dd className="mt-1 font-mono">{formatTakeoffMeasurement(output.production_quantity,output.production_unit)}</dd></div><div className="bg-card p-3"><dt className="text-xs text-muted-foreground">Estimated MH</dt><dd className="mt-1 font-mono">{decimal(output.estimated_man_hours,2)}</dd></div><div className="bg-card p-3"><dt className="text-xs text-muted-foreground">Burdened rate</dt><dd className="mt-1 font-mono">{money(output.unit_cost)} / HR</dd></div><div className="bg-card p-3"><dt className="text-xs text-muted-foreground">Direct cost</dt><dd className="mt-1 font-mono">{money(output.direct_cost)}</dd></div></dl>
                  <section className="space-y-3"><h3 className="border-l-2 border-primary pl-2 text-sm font-semibold">Production assumption</h3><div className="grid grid-cols-2 gap-3 text-sm"><div><span className="block text-xs text-muted-foreground">Baseline MH / unit</span><strong className="font-mono">{output.baseline_man_hours_per_unit===null||output.baseline_man_hours_per_unit===undefined||output.baseline_man_hours_per_unit===''?'—':decimal(output.baseline_man_hours_per_unit,6)}</strong></div><div><span className="block text-xs text-muted-foreground">Current MH / unit</span><strong className="font-mono">{effectiveMh===null?'—':decimal(effectiveMh,6)}</strong></div></div><p className="text-xs text-muted-foreground">{output.baseline_source||'No baseline source recorded.'}</p>
                    {!locked&&<form action={updateGeneratedLaborAssumption} className="grid gap-2"><input type="hidden" name="estimate_id" value={estimateId}/><input type="hidden" name="output_id" value={output.id}/><label className="text-xs font-medium" htmlFor={`labor-mh-${output.id}`}>Job MH / unit override</label><div className="flex gap-2"><Input id={`labor-mh-${output.id}`} name="man_hours_per_unit" type="number" min="0" step="0.000001" defaultValue={effectiveMh??''} required className="font-mono"/><Button type="submit" size="sm">Save rate</Button></div></form>}
                    {hasOverride&&!locked&&<form action={restoreGeneratedLaborAssumption}><input type="hidden" name="estimate_id" value={estimateId}/><input type="hidden" name="output_id" value={output.id}/><Button type="submit" variant="outline" size="sm">Restore baseline</Button></form>}
                    {hasOverride&&output.labor_assumption_override_at&&<p className="text-xs text-muted-foreground">Override saved {output.labor_assumption_override_at.slice(0,10)}</p>}
                  </section>
                  <section className="space-y-3 border-t border-border pt-4"><h3 className="border-l-2 border-primary pl-2 text-sm font-semibold">Burdened labor rate</h3><p className="text-xs text-muted-foreground">{output.price_source_label||output.cost_source||(output.pricing_status==='missing_labor_rate'?'Missing labor rate':'No labor rate source')}{output.price_effective_date?` · effective ${output.price_effective_date}`:''}</p>
                    {!locked&&<form action={selectGeneratedLaborProfile} className="grid gap-2"><input type="hidden" name="estimate_id" value={estimateId}/><input type="hidden" name="output_id" value={output.id}/><label className="text-xs font-medium" htmlFor={`labor-profile-${output.id}`}>Labor profile</label><select id={`labor-profile-${output.id}`} className={selectClass} name="labor_profile_id" defaultValue={selectedProfileId} required><option value="" disabled>Select labor profile</option>{profiles.map(profile=><option key={profile.id} value={profile.id}>{profile.name} · {money(profile.burdened_hourly_rate)}/HR{profile.is_default?' · default':''}</option>)}</select><Button type="submit" size="sm" className="w-fit">Use rate</Button></form>}
                    {output.labor_rate_override_at&&<p className="text-xs text-muted-foreground">Rate source selected {output.labor_rate_override_at.slice(0,10)}</p>}
                  </section>
                </div>
              </SheetContent>
            </Sheet>
          </div>;
        })}</div>}
    </div>
  </section>;
}
