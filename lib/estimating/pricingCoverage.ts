export type PricingCoverageOutput = {
  id: string;
  pricing_status?: string | null;
  price_source_kind?: string | null;
  price_source_id?: string | null;
};

export type PricingCoverageQuoteLine = {
  id: string;
  source_takeoff_output_id: string;
  expires_at?: string | null;
  quote_status?: string | null;
};

export type PricingCoverageSummary = {
  total: number;
  priced: number;
  pricedPercent: number;
  missingPrice: number;
  missingLaborRate: number;
  supplierQuote: number;
  expiredSupplierQuote: number;
  availableUnselectedQuoteLines: number;
  manualOverride: number;
};

const normalizedDate = (value?: string | null) => value ? value.slice(0, 10) : null;

export function isPricingQuoteExpired(expiresAt: string | null | undefined, today: string) {
  const expiry = normalizedDate(expiresAt);
  return Boolean(expiry && expiry < today);
}

export function getPricingCoverageSummary({
  outputs,
  quoteLines,
  today,
}: {
  outputs: PricingCoverageOutput[];
  quoteLines: PricingCoverageQuoteLine[];
  today: string;
}): PricingCoverageSummary {
  const outputById = new Map(outputs.map(output => [output.id, output]));
  const quoteLineById = new Map(quoteLines.map(line => [line.id, line]));

  let priced = 0;
  let missingPrice = 0;
  let missingLaborRate = 0;
  let supplierQuote = 0;
  let expiredSupplierQuote = 0;
  let manualOverride = 0;

  for (const output of outputs) {
    const status = String(output.pricing_status || '').toLowerCase();
    const sourceKind = String(output.price_source_kind || '').toLowerCase();

    if (status === 'priced' || status === 'manual_override') priced += 1;
    if (status === 'missing_price') missingPrice += 1;
    if (status === 'missing_labor_rate') missingLaborRate += 1;
    if (status === 'manual_override' || sourceKind === 'manual_override') manualOverride += 1;

    if (sourceKind === 'supplier_quote') {
      supplierQuote += 1;
      const selectedLine = output.price_source_id ? quoteLineById.get(output.price_source_id) : undefined;
      if (selectedLine && isPricingQuoteExpired(selectedLine.expires_at, today)) {
        expiredSupplierQuote += 1;
      }
    }
  }

  const availableUnselectedQuoteLines = quoteLines.reduce((count, line) => {
    const output = outputById.get(line.source_takeoff_output_id);
    if (!output) return count;
    if (String(line.quote_status || '').toLowerCase() === 'declined') return count;
    if (isPricingQuoteExpired(line.expires_at, today)) return count;
    if (output.price_source_kind === 'supplier_quote' && output.price_source_id === line.id) return count;
    return count + 1;
  }, 0);

  return {
    total: outputs.length,
    priced,
    pricedPercent: outputs.length ? Math.round((priced / outputs.length) * 1000) / 10 : 0,
    missingPrice,
    missingLaborRate,
    supplierQuote,
    expiredSupplierQuote,
    availableUnselectedQuoteLines,
    manualOverride,
  };
}
