import { AlertTriangle, CheckCircle2, CircleDollarSign, FileQuestion, Quote } from 'lucide-react';
import {
  createEstimateSupplierQuote,
  createEstimateSupplierQuoteLine,
  createEstimateSupplierQuoteSet,
  selectEstimateSupplierQuoteLine,
} from '@/app/estimates/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatTakeoffMeasurement } from '@/lib/takeoff/lengthFormat';
import {
  getPricingCoverageSummary,
  isPricingQuoteExpired,
} from '@/lib/estimating/pricingCoverage';

type Measurement = {
  id: string;
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

const selectClass = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-shadow focus:border-ring focus:ring-3 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50';
const textareaClass = 'min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-shadow focus:border-ring focus:ring-3 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50';

function CoverageMetric({
  label,
  value,
  detail,
  tone = 'default',
}: {
  label: string;
  value: string;
  detail?: string;
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
    {detail ? <div className="mt-0.5 text-[11px] text-muted-foreground">{detail}</div> : null}
  </div>;
}

function QuoteSourceLabel({
  output,
  line,
  quote,
  expired,
}: {
  output: TakeoffOutput;
  line?: SupplierQuoteLine;
  quote?: SupplierQuote;
  expired: boolean;
}) {
  if (output.pricing_status === 'missing_labor_rate') return <span className="font-medium text-warning">Missing labor rate</span>;
  if (output.pricing_status === 'missing_price') return <span className="font-medium text-warning">Missing price</span>;
  if (output.pricing_status === 'missing_input') return <span className="font-medium text-warning">Input required</span>;
  if (expired) return <span className="font-medium text-warning">Expired quote selection</span>;
  if (output.price_source_kind === 'manual_override') return <span className="font-medium text-primary">Manual override</span>;
  if (output.price_source_kind === 'supplier_quote') {
    return <span className="font-medium text-success">{quote?.supplier_name || output.price_source_label || 'Supplier quote'}{line ? ` · ${money(line.quoted_unit_cost)}/${line.quoted_unit}` : ''}</span>;
  }
  return <span className="font-medium text-foreground">{output.price_source_label || output.cost_source || 'Priced'}</span>;
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
  const outputUnits = [...new Set(outputs
    .filter(output => output.estimate_item_type !== 'labor' && output.production_unit)
    .map(output => String(output.production_unit).toUpperCase()))].sort();
  const quoteableOutputs = outputs.filter(output => output.estimate_item_type !== 'labor' && output.generated_estimate_item_id);
  const quoteSetsSorted = [...quoteSets].sort((a, b) => String(a.name).localeCompare(String(b.name)));

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

  return <section className="space-y-4" aria-labelledby="pricing-coverage-title">
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pricing</p>
      <h2 id="pricing-coverage-title" className="mt-1 text-lg font-semibold">Pricing coverage</h2>
      <p className="mt-1 text-sm text-muted-foreground">Resolve supplier evidence and price exceptions against authoritative Takeoff outputs. Quote activity never changes Production Quantity.</p>
    </div>

    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
      <CoverageMetric label="Generated outputs" value={String(summary.total)} />
      <CoverageMetric label="Priced" value={`${summary.pricedPercent.toFixed(1)}%`} detail={`${summary.priced} of ${summary.total}`} tone={summary.priced === summary.total && summary.total > 0 ? 'success' : 'primary'} />
      <CoverageMetric label="Missing price" value={String(summary.missingPrice)} tone={summary.missingPrice ? 'warning' : 'success'} />
      <CoverageMetric label="Missing labor" value={String(summary.missingLaborRate)} tone={summary.missingLaborRate ? 'warning' : 'success'} />
      <CoverageMetric label="Supplier quote" value={String(summary.supplierQuote)} tone="primary" />
      <CoverageMetric label="Expired" value={String(summary.expiredSupplierQuote)} tone={summary.expiredSupplierQuote ? 'warning' : 'success'} />
      <CoverageMetric label="Unselected quotes" value={String(summary.availableUnselectedQuoteLines)} />
      <CoverageMetric label="Manual overrides" value={String(summary.manualOverride)} />
    </div>

    <Card className="shadow-none">
      <CardHeader className="gap-1">
        <CardTitle>Pricing exceptions</CardTitle>
        <CardDescription>Exception-first review of current source, quantity, quote candidates and unresolved holds.</CardDescription>
      </CardHeader>
      <CardContent>
        {pricingRows.length === 0 ? <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">No generated Takeoff outputs are available for pricing yet.</div> :
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[1050px] border-collapse text-sm">
              <thead className="bg-muted/60 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Condition / output</th>
                  <th className="px-3 py-2 text-right font-semibold">Production</th>
                  <th className="px-3 py-2 text-left font-semibold">Current source</th>
                  <th className="px-3 py-2 text-left font-semibold">Quote candidates</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pricingRows.map(output => {
                  const measurement = measurementById.get(output.measurement_id);
                  const selectedLine = output.price_source_id ? lineById.get(output.price_source_id) : undefined;
                  const selectedQuote = selectedLine ? quoteById.get(selectedLine.quote_id) : undefined;
                  const selectedExpired = Boolean(selectedQuote?.expires_at && isPricingQuoteExpired(selectedQuote.expires_at, today));
                  const candidates = quoteLines.filter(line => line.source_takeoff_output_id === output.id);
                  return <tr key={output.id} className={selectedExpired || output.pricing_status?.startsWith('missing') ? 'bg-warning/5 align-top' : 'align-top'}>
                    <td className="px-3 py-3">
                      <div className="font-medium">{output.label || 'Generated resource'}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{measurement?.name || 'Takeoff measurement'}{measurement?.location ? ` · ${measurement.location}` : ''}{measurement?.drawing_reference ? ` · ${measurement.drawing_reference}` : ''}</div>
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-xs font-semibold tabular-nums">{formatTakeoffMeasurement(output.production_quantity, output.production_unit)}</td>
                    <td className="px-3 py-3">
                      <QuoteSourceLabel output={output} line={selectedLine} quote={selectedQuote} expired={selectedExpired} />
                      <div className="mt-1 text-xs text-muted-foreground">{output.price_source_reference || ''}{output.price_effective_date ? `${output.price_source_reference ? ' · ' : ''}effective ${output.price_effective_date}` : ''}</div>
                    </td>
                    <td className="px-3 py-3">
                      {output.estimate_item_type === 'labor' ? <span className="text-xs text-muted-foreground">Labor pricing is handled in the Labor step.</span> :
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
                                  <Button type="submit" variant="outline" size="sm" disabled={locked || unavailable}>Select quote</Button>
                                </form>}
                            </div>;
                          })}</div>}
                    </td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>}
      </CardContent>
    </Card>

    <Card className="shadow-none">
      <CardHeader className="gap-1">
        <CardTitle className="flex items-center gap-2"><Quote className="size-4"/>Supplier quote sets</CardTitle>
        <CardDescription>Estimate-scoped supplier responses and unit prices. These records remain commercial evidence separate from downstream procurement.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!locked ? <details className="rounded-lg border">
          <summary className="cursor-pointer list-none px-3 py-3 text-sm font-medium">Create quote set</summary>
          <form action={createEstimateSupplierQuoteSet} className="grid gap-3 border-t p-3 md:grid-cols-3">
            <input type="hidden" name="estimate_id" value={estimateId}/>
            <div className="grid gap-1.5"><Label htmlFor="quote-set-name">Name</Label><Input id="quote-set-name" name="name" required placeholder="Ready-mix · Rebar · Form lumber"/></div>
            <div className="grid gap-1.5"><Label htmlFor="quote-set-zone">Bid zone</Label><Input id="quote-set-zone" name="bid_zone" placeholder="Building A · Site concrete"/></div>
            <div className="grid gap-1.5"><Label htmlFor="quote-set-scope">Scope note</Label><Input id="quote-set-scope" name="scope_note" placeholder="4000 psi mix, pump included..."/></div>
            <div className="md:col-span-3"><Button type="submit" size="sm">Create quote set</Button></div>
          </form>
        </details> : null}

        {quoteSetsSorted.length === 0 ? <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">No supplier quote sets yet. Create a set when vendor pricing is needed for this Estimate revision.</div> :
          quoteSetsSorted.map(quoteSet => {
            const setQuotes = quotes.filter(quote => quote.quote_set_id === quoteSet.id);
            return <details key={quoteSet.id} className="rounded-lg border" open={quoteSet.status === 'draft'}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3">
                <div><div className="text-sm font-medium">{quoteSet.name}</div><div className="mt-0.5 text-xs text-muted-foreground">{[quoteSet.bid_zone, quoteSet.status, `${setQuotes.length} supplier response${setQuotes.length === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}</div></div>
                <CircleDollarSign className="size-4 text-muted-foreground"/>
              </summary>
              <div className="space-y-3 border-t p-3">
                {quoteSet.scope_note ? <div className="text-xs text-muted-foreground">{quoteSet.scope_note}</div> : null}

                {!locked && quoteSet.status !== 'archived' ? <details className="rounded-md border bg-muted/10">
                  <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium">Add supplier response</summary>
                  <form action={createEstimateSupplierQuote} className="grid gap-3 border-t p-3 md:grid-cols-4">
                    <input type="hidden" name="estimate_id" value={estimateId}/>
                    <input type="hidden" name="quote_set_id" value={quoteSet.id}/>
                    <div className="grid gap-1.5"><Label>Supplier</Label><Input name="supplier_name" required placeholder="Supplier name"/></div>
                    <div className="grid gap-1.5"><Label>Quote / reference</Label><Input name="supplier_quote_number" placeholder="Q-10284"/></div>
                    <div className="grid gap-1.5"><Label>Quote date</Label><Input name="quote_date" type="date" defaultValue={today} required/></div>
                    <div className="grid gap-1.5"><Label>Expires</Label><Input name="expires_at" type="date"/></div>
                    <div className="grid gap-1.5"><Label>Status</Label><select className={selectClass} name="status" defaultValue="received"><option value="requested">Requested</option><option value="received">Received</option><option value="declined">Declined</option></select></div>
                    <div className="grid gap-1.5 md:col-span-3"><Label>Notes</Label><Input name="notes" placeholder="Delivery, minimum order, exclusions..."/></div>
                    <div className="md:col-span-4"><Button type="submit" variant="outline" size="sm">Add supplier response</Button></div>
                  </form>
                </details> : null}

                {setQuotes.length === 0 ? <div className="text-xs text-muted-foreground">No supplier responses recorded in this set.</div> :
                  <div className="grid gap-2">{setQuotes.map(quote => {
                    const lines = quoteLines.filter(line => line.quote_id === quote.id);
                    const expired = Boolean(quote.expires_at && isPricingQuoteExpired(quote.expires_at, today));
                    return <div key={quote.id} className={`rounded-md border px-3 py-3 ${expired ? 'border-warning/30 bg-warning/5' : 'bg-background'}`}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div><div className="text-sm font-medium">{quote.supplier_name}</div><div className="mt-0.5 text-xs text-muted-foreground">{quote.supplier_quote_number || 'No quote number'} · {quote.quote_date}{quote.expires_at ? ` · expires ${quote.expires_at}` : ''} · {quote.status}</div></div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">{expired ? <><AlertTriangle className="size-3.5 text-warning"/>Expired</> : <>{lines.length} line{lines.length === 1 ? '' : 's'}</>}</div>
                      </div>

                      {lines.length > 0 ? <div className="mt-3 divide-y rounded-md border">{lines.map(line => {
                        const output = outputs.find(row => row.id === line.source_takeoff_output_id);
                        return <div key={line.id} className="grid gap-1 px-2.5 py-2 text-xs md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                          <div><span className="font-medium">{line.description}</span><span className="text-muted-foreground">{output ? ` · ${formatTakeoffMeasurement(output.production_quantity, output.production_unit)}` : ''}{line.source_reference ? ` · ${line.source_reference}` : ''}</span></div>
                          <div className="font-mono font-semibold tabular-nums">{money(line.quoted_unit_cost)} / {line.quoted_unit}</div>
                        </div>;
                      })}</div> : null}

                      {!locked && quote.status !== 'declined' && quoteSet.status !== 'archived' ? <details className="mt-3 rounded-md border">
                        <summary className="cursor-pointer list-none px-2.5 py-2 text-xs font-medium">Add quoted price line</summary>
                        <form action={createEstimateSupplierQuoteLine} className="grid gap-3 border-t p-3 md:grid-cols-4">
                          <input type="hidden" name="estimate_id" value={estimateId}/>
                          <input type="hidden" name="quote_id" value={quote.id}/>
                          <div className="grid gap-1.5 md:col-span-2"><Label>Takeoff resource</Label><select className={selectClass} name="output_id" required defaultValue=""><option value="" disabled>Select generated resource</option>{quoteableOutputs.map(output => {const measurement=measurementById.get(output.measurement_id);return <option key={output.id} value={output.id}>{measurement?.name || 'Takeoff'} — {output.label || 'Resource'} — {formatTakeoffMeasurement(output.production_quantity, output.production_unit)}</option>;})}</select></div>
                          <div className="grid gap-1.5"><Label>Quoted unit</Label><select className={selectClass} name="quoted_unit" required defaultValue={outputUnits[0] || ''}>{outputUnits.map(unit => <option key={unit} value={unit}>{unit}</option>)}</select></div>
                          <div className="grid gap-1.5"><Label>Unit cost</Label><Input name="quoted_unit_cost" type="number" min="0" step="0.0001" required placeholder="0.00"/></div>
                          <div className="grid gap-1.5 md:col-span-2"><Label>Description override</Label><Input name="description" placeholder="Optional; defaults to Takeoff resource"/></div>
                          <div className="grid gap-1.5"><Label>Source reference</Label><Input name="source_reference" placeholder="Line 4 · mix code"/></div>
                          <div className="grid gap-1.5"><Label>Freight / tax / fee notes</Label><Input name="freight_tax_fee_notes" placeholder="Freight included; tax extra"/></div>
                          <div className="md:col-span-4"><Button type="submit" variant="outline" size="sm">Add price line</Button></div>
                        </form>
                      </details> : null}
                    </div>;
                  })}</div>}
              </div>
            </details>;
          })}
      </CardContent>
    </Card>

    {summary.expiredSupplierQuote || summary.missingPrice || summary.missingLaborRate ? <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2.5 text-sm">
      <FileQuestion className="mt-0.5 size-4 shrink-0 text-warning"/>
      <div><strong>Pricing review remains open.</strong> <span className="text-muted-foreground">Resolve missing prices, missing labor rates, and expired supplier selections before Estimate Review / Recap.</span></div>
    </div> : null}
  </section>;
}
