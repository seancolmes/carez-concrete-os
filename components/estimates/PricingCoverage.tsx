import { WarningRegular as AlertTriangle, CheckmarkCircleRegular as CheckCircle2, MoneyRegular as CircleDollarSign, DocumentQuestionMarkRegular as FileQuestion } from '@fluentui/react-icons';
import Link from 'next/link';
import { selectEstimateSupplierQuoteLine } from '@/app/estimates/actions';
import { Button, Card, CardHeader } from '@fluentui/react-components';
import { formatTakeoffMeasurement } from '@/lib/takeoff/lengthFormat';
import { PricingExceptionGrid, type PricingExceptionRow } from '@/components/estimates/PricingExceptionGrid';
import {
  getPricingCoverageSummary,
  isPricingQuoteExpired,
} from '@/lib/estimating/pricingCoverage';

type Measurement = {
  id: string;
  takeoff_set_id?: string | null;
  name: string;
  location?: string | null;
  drawing_reference?: string | null;
};

type TakeoffOutput = {
  id: string;
  measurement_id: string;
  generated_estimate_item_id?: string | null;
  label?: string | null;
  estimate_item_type?: string | null;
  production_quantity?: number | string | null;
  production_unit?: string | null;
  unit_cost?: number | string | null;
  pricing_status?: string | null;
  cost_source?: string | null;
  price_source_kind?: string | null;
  price_source_id?: string | null;
  price_source_label?: string | null;
  price_source_reference?: string | null;
  price_effective_date?: string | null;
};

type SupplierQuoteSet = {
  id: string;
  estimate_id: string;
  name: string;
  bid_zone?: string | null;
  scope_note?: string | null;
  status: string;
  created_at?: string | null;
};

type SupplierQuote = {
  id: string;
  quote_set_id: string;
  supplier_name: string;
  supplier_quote_number?: string | null;
  quote_date: string;
  expires_at?: string | null;
  status: string;
  notes?: string | null;
};

type SupplierQuoteLine = {
  id: string;
  quote_id: string;
  source_takeoff_output_id: string;
  generated_estimate_item_id?: string | null;
  description: string;
  quoted_unit: string;
  quoted_unit_cost: number | string;
  freight_tax_fee_notes?: string | null;
  source_reference?: string | null;
};

const money = (value: unknown) => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
}).format(Number(value || 0));


function CoverageMetric({
  label,
  value,
  detail,
  tone = 'neutral',
  progress,
}: {
  label: string;
  value: string;
  detail: string;
  tone?: 'neutral' | 'brand' | 'warning';
  progress?: number;
}) {
  return <div className="pricing-metric-card min-w-0" data-tone={tone} data-zero={value === '0' || value === '0.0%' ? 'true' : undefined} data-primary={label === 'Priced' || label === 'Missing price' ? 'true' : undefined}>
    <div className="pricing-metric-label">{label}</div>
    <div className="pricing-metric-value font-mono tabular-nums">{value}</div>
    <div className="pricing-metric-detail">{detail}</div>
    {progress !== undefined ? <div className="pricing-metric-track" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} /></div> : null}
  </div>;
}

function PricingStatusBadge({
  output,
  expired,
}: {
  output: TakeoffOutput;
  expired: boolean;
}) {
  const status=String(output.pricing_status||'').toLowerCase();
  const kind=String(output.price_source_kind||'').toLowerCase();
  const warning=expired||status==='missing_price'||status==='missing_labor_rate';
  const missing=status==='missing_input';
  const complete=status==='priced'||status==='manual_override';
  const label=expired?'Expired quote':missing?'No input':status==='missing_price'?'Missing price':status==='missing_labor_rate'?'Missing labor rate':kind==='manual_override'?'Manual override':kind==='supplier_quote'?'Supplier quote':complete?'Complete':'Review status';
  const tone=missing?'text-destructive':warning?'text-warning':complete?'text-success':'text-muted-foreground';
  const Icon=missing?FileQuestion:warning?AlertTriangle:complete?CheckCircle2:CircleDollarSign;
  return <span data-pricing-status={missing?'danger':warning?'warning':complete?'complete':'neutral'} className={`inline-flex min-h-6 w-fit items-center gap-1.5 whitespace-nowrap text-[11px] font-semibold leading-none ${tone}`}><Icon className="size-3" aria-hidden="true"/>{label}</span>;
}

export function PricingCoverage({
  estimateId,
  measurements,
  outputs,
  quoteSets,
  quotes,
  quoteLines,
  locked,
  today,
}: {
  estimateId: string;
  measurements: Measurement[];
  outputs: TakeoffOutput[];
  quoteSets: SupplierQuoteSet[];
  quotes: SupplierQuote[];
  quoteLines: SupplierQuoteLine[];
  locked: boolean;
  today: string;
}) {
  const measurementById = new Map(measurements.map(row => [row.id, row]));
  const quoteById = new Map(quotes.map(row => [row.id, row]));
  const lineById = new Map(quoteLines.map(row => [row.id, row]));
  const quoteLinesForCoverage = quoteLines.map(line => {
    const quote = quoteById.get(line.quote_id);
    return {
      id: line.id,
      source_takeoff_output_id: line.source_takeoff_output_id,
      expires_at: quote?.expires_at || null,
      quote_status: quote?.status || null,
    };
  });
  const summary = getPricingCoverageSummary({ outputs, quoteLines: quoteLinesForCoverage, today });

  const pricingRows = [...outputs].sort((a, b) => {
    const rank = (output: TakeoffOutput) => {
      const selectedLine = output.price_source_id ? lineById.get(output.price_source_id) : undefined;
      const selectedQuote = selectedLine ? quoteById.get(selectedLine.quote_id) : undefined;
      if (selectedQuote?.expires_at && isPricingQuoteExpired(selectedQuote.expires_at, today)) return 0;
      if (output.pricing_status === 'missing_price' || output.pricing_status === 'missing_labor_rate' || output.pricing_status === 'missing_input') return 1;
      if (quoteLines.some(line => line.source_takeoff_output_id === output.id && line.id !== output.price_source_id)) return 2;
      if (output.price_source_kind === 'manual_override') return 3;
      return 4;
    };
    return rank(a) - rank(b) || String(a.label || '').localeCompare(String(b.label || ''));
  });

  const exceptionRows: PricingExceptionRow[] = pricingRows.map(output => {
    const measurement = measurementById.get(output.measurement_id);
    const selectedLine = output.price_source_id ? lineById.get(output.price_source_id) : undefined;
    const selectedQuote = selectedLine ? quoteById.get(selectedLine.quote_id) : undefined;
    const selectedExpired = Boolean(selectedQuote?.expires_at && isPricingQuoteExpired(selectedQuote.expires_at, today));
    const candidates = quoteLines.filter(line => line.source_takeoff_output_id === output.id);
    const measurementLabel = [measurement?.name || 'Takeoff measurement', measurement?.location, measurement?.drawing_reference].filter(Boolean).join(' · ');
    const sourceLabel = selectedQuote?.supplier_name || output.price_source_label || output.cost_source;
    const source = <div className="space-y-1 text-sm">
      <div>{sourceLabel || 'No pricing source recorded.'}{selectedLine ? ` · ${money(selectedLine.quoted_unit_cost)}/${selectedLine.quoted_unit}` : ''}</div>
      {output.price_source_reference ? <div className="text-xs text-muted-foreground">Reference: {output.price_source_reference}</div> : null}
      {output.price_effective_date ? <div className="text-xs text-muted-foreground">Effective {output.price_effective_date}</div> : null}
    </div>;
    const quoteCandidates = output.estimate_item_type === 'labor' ? <span className="text-xs text-muted-foreground">Labor pricing is handled in the Labor step.</span> :
      candidates.length === 0 ? <span className="text-xs text-muted-foreground">No supplier quote lines recorded.</span> :
        <div className="grid gap-2">{candidates.map(line => {
          const quote = quoteById.get(line.quote_id);
          const expired = Boolean(quote?.expires_at && isPricingQuoteExpired(quote.expires_at, today));
          const unitMatch = String(line.quoted_unit).trim().toUpperCase() === String(output.production_unit || '').trim().toUpperCase();
          const selected = output.price_source_kind === 'supplier_quote' && output.price_source_id === line.id;
          const unavailable = expired || quote?.status === 'declined' || !unitMatch;
          return <div key={line.id} className="flex items-center justify-between gap-3 rounded-md border bg-background px-2.5 py-2">
            <div className="min-w-0">
              <div className="truncate text-xs font-medium">{quote?.supplier_name || 'Supplier'}{quote?.supplier_quote_number ? ` · ${quote.supplier_quote_number}` : ''}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">{money(line.quoted_unit_cost)} / {line.quoted_unit}{quote?.expires_at ? ` · expires ${quote.expires_at}` : ''}{!unitMatch ? ` · unit mismatch with ${output.production_unit}` : ''}</div>
            </div>
            {selected ? <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-success"><CheckCircle2 className="size-3.5"/>Selected</span> :
              <form action={selectEstimateSupplierQuoteLine}>
                <input type="hidden" name="estimate_id" value={estimateId}/>
                <input type="hidden" name="quote_line_id" value={line.id}/>
                <Button type="submit" appearance="outline" size="small" disabled={locked || unavailable}>Select quote</Button>
              </form>}
          </div>;
        })}</div>;
    return {
      id: output.id,
      conditionId: output.measurement_id,
      conditionName: measurement?.name || 'Unassigned condition',
      name: output.label || 'Generated resource',
      measurement: measurementLabel,
      production: formatTakeoffMeasurement(output.production_quantity, output.production_unit),
      productionValue: Number(output.production_quantity || 0),
      statusKey: selectedExpired ? 'expired' : output.pricing_status || 'unknown',
      searchText: [output.label, measurementLabel, sourceLabel, output.price_source_reference].filter(Boolean).join(' '),
      sourceHref: output.pricing_status === 'missing_input' && measurement?.takeoff_set_id
        ? `/takeoff/${encodeURIComponent(measurement.takeoff_set_id)}?measurement=${encodeURIComponent(output.measurement_id)}`
        : output.pricing_status === 'missing_labor_rate' ? `/estimates/${encodeURIComponent(estimateId)}#labor-review` : undefined,
      sourceAction: output.pricing_status === 'missing_input' ? 'Open Condition' : output.pricing_status === 'missing_labor_rate' ? 'Labor review' : undefined,
      costHref: output.pricing_status === 'missing_price' && output.generated_estimate_item_id ? `/estimates/${encodeURIComponent(estimateId)}?costOutput=${encodeURIComponent(output.id)}#estimate-lines` : undefined,
      badge: <PricingStatusBadge output={output} expired={selectedExpired} />,
      source,
      quoteCandidates,
    };
  });
  const attentionRows = exceptionRows.filter(row => ['missing_input', 'missing_price', 'missing_labor_rate', 'expired'].includes(row.statusKey));
  const missingInputCount = outputs.filter(output => output.pricing_status === 'missing_input').length;
  const otherStatusCount = Math.max(0, summary.total - summary.priced - summary.missingPrice - summary.missingLaborRate - missingInputCount);
  const statusLabel: Record<string, string> = { missing_input: 'No input', missing_price: 'Missing price', missing_labor_rate: 'Missing labor rate', expired: 'Expired quote' };

  return <section className="space-y-4" aria-labelledby="pricing-coverage-title">
    <div className="carez-page-heading"><h2 id="pricing-coverage-title">Pricing coverage</h2></div>

    <div className="pricing-metric-grid grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4" aria-label="Pricing coverage summary">
      <CoverageMetric label="Priced" value={`${summary.pricedPercent.toFixed(1)}%`} detail={`${summary.priced} of ${summary.total} outputs`} tone={summary.priced ? 'brand' : 'neutral'} progress={summary.pricedPercent} />
      <CoverageMetric label="Missing price" value={String(summary.missingPrice)} detail={`${summary.missingPrice} of ${summary.total} outputs`} tone={summary.missingPrice ? 'warning' : 'neutral'} progress={summary.total ? summary.missingPrice / summary.total * 100 : 0} />
      <CoverageMetric label="Generated outputs" value={String(summary.total)} detail="Current estimate" />
      <CoverageMetric label="Missing labor" value={String(summary.missingLaborRate)} detail={`${summary.missingLaborRate} of ${summary.total} outputs`} tone={summary.missingLaborRate ? 'warning' : 'neutral'} progress={summary.total ? summary.missingLaborRate / summary.total * 100 : 0} />
      <CoverageMetric label="Supplier quote" value={String(summary.supplierQuote)} detail={`${summary.supplierQuote} selected outputs`} progress={summary.total ? summary.supplierQuote / summary.total * 100 : 0} />
      <CoverageMetric label="Expired" value={String(summary.expiredSupplierQuote)} detail={`${summary.expiredSupplierQuote} selected quotes`} tone={summary.expiredSupplierQuote ? 'warning' : 'neutral'} progress={summary.supplierQuote ? summary.expiredSupplierQuote / summary.supplierQuote * 100 : 0} />
      <CoverageMetric label="Unselected quotes" value={String(summary.availableUnselectedQuoteLines)} detail="Available quote lines" />
      <CoverageMetric label="Manual overrides" value={String(summary.manualOverride)} detail={`${summary.manualOverride} of ${summary.total} outputs`} progress={summary.total ? summary.manualOverride / summary.total * 100 : 0} />
    </div>

    {attentionRows.length ? <section className="pricing-attention" aria-labelledby="pricing-attention-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-3 py-2"><h3 id="pricing-attention-title" className="text-sm font-semibold">{attentionRows.length} output{attentionRows.length === 1 ? '' : 's'} need attention</h3><p className="text-[11px] text-muted-foreground">{summary.priced} priced · {summary.missingPrice} missing price · {summary.missingLaborRate} missing labor · {missingInputCount} no input{otherStatusCount ? ` · ${otherStatusCount} other` : ''}</p></div>
      <ul className="divide-y divide-border">{attentionRows.slice(0, 5).map(row => <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs"><div className="min-w-0"><span className="font-semibold">{row.conditionName}</span><span className="mx-1.5 text-muted-foreground">/</span><span>{row.name}</span><span className="ml-2 font-medium text-warning">{statusLabel[row.statusKey] || row.statusKey}</span></div><div className="flex shrink-0 items-center gap-3">{row.sourceHref || row.costHref ? <a className="font-semibold text-primary underline-offset-2 hover:underline" href={row.sourceHref || row.costHref}>{row.sourceAction || 'Edit unit cost'}</a> : null}<a className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" href={`/estimates/${encodeURIComponent(estimateId)}?pricingOutput=${encodeURIComponent(row.id)}#pricing-coverage`}>Review output</a></div></li>)}</ul>
      {attentionRows.length > 5 ? <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">{attentionRows.length - 5} more outputs need attention. Use the grid’s “Needs attention” filter to see all.</p> : null}
    </section> : summary.total ? <p className="border-y border-border px-3 py-2 text-xs text-muted-foreground">No pricing holds in the current outputs.{otherStatusCount ? ` ${otherStatusCount} output${otherStatusCount === 1 ? ' has' : 's have'} another status to review.` : ''}</p> : null}

    <Card className="pricing-output-region rounded-none border-x-0 bg-transparent shadow-none">
      <CardHeader className="gap-1 pb-2">
        <h3 className="text-sm font-semibold">Pricing outputs</h3>
      </CardHeader>
      <div className="px-3 pb-3">
        {exceptionRows.length === 0 ? <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">No generated Takeoff outputs are available for pricing yet.</div> : <PricingExceptionGrid rows={exceptionRows} />}
      </div>
    </Card>

    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#222222] bg-[#0A0A0A] px-4 py-3"><div><h3 className="text-sm font-semibold">Vendor Quotes</h3><p className="mt-1 text-xs text-muted-foreground">{quoteSets.length} quote set{quoteSets.length===1?"":"s"} · supplier entry and links are managed in Bid Intelligence.</p></div><Link href={`/vendor-quotes?estimate=${encodeURIComponent(estimateId)}`} className="rounded-md border border-[#333333] bg-[#111111] px-3 py-2 text-xs font-semibold text-white shadow-[inset_0px_1px_0px_rgba(255,255,255,0.05)]">Open Vendor Quotes</Link></div>
  </section>;
}
