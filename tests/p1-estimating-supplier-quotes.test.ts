import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const migrationPath = 'supabase/migrations/20260921224000_estimate_supplier_quotes.sql';
const coveragePath = 'lib/estimating/pricingCoverage.ts';
const panelPath = 'components/estimates/PricingCoverage.tsx';
const pagePath = 'app/estimates/[estimateId]/page.tsx';
const actionsPath = 'app/estimates/actions.ts';

const requireFile = (path: string, message: string) => {
  assert.equal(existsSync(path), true, message);
  return readFileSync(path, 'utf8');
};

test('P1.2 creates Estimate-scoped supplier quote entities with tenant RLS', () => {
  const sql = requireFile(migrationPath, 'P1.2 supplier quote migration must exist');

  for (const table of [
    'estimate_supplier_quote_sets',
    'estimate_supplier_quotes',
    'estimate_supplier_quote_lines',
  ]) {
    assert.match(sql, new RegExp(`create table(?: if not exists)? public\\.${table}`, 'i'));
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
  }

  assert.match(sql, /estimate_supplier_quote_sets[\s\S]{0,1800}status[\s\S]{0,500}'draft'[\s\S]{0,500}'complete'[\s\S]{0,500}'archived'/i);
  assert.match(sql, /estimate_supplier_quotes[\s\S]{0,2200}status[\s\S]{0,800}'requested'[\s\S]{0,800}'received'[\s\S]{0,800}'declined'[\s\S]{0,800}'selected'/i);
  assert.match(sql, /company_id\s+uuid\s+not null/i);
  assert.match(sql, /estimate_id\s+uuid\s+not null/i);
  assert.doesNotMatch(sql, /references\s+public\.vendors/i);
});

test('quote selection is server-authoritative, estimate-scoped and cannot accept quantity', () => {
  const sql = requireFile(migrationPath, 'P1.2 supplier quote migration must exist');
  const signature = sql.match(/create or replace function public\.carez_select_estimate_supplier_quote_line\([\s\S]*?\)\s*returns void/i)?.[0] || '';

  assert.match(signature, /p_quote_line_id\s+uuid/i);
  assert.doesNotMatch(signature, /quantity/i);
  assert.match(sql, /This estimate revision is locked/i);
  assert.match(sql, /does not belong to this estimate/i);
  assert.match(sql, /Quoted unit must match/i);
  assert.match(sql, /Verified Project Concrete Condition pricing is immutable/i);
  assert.match(sql, /price_source_kind='supplier_quote'/i);
  assert.match(sql, /price_source_id=p_quote_line_id/i);
  assert.match(sql, /update public\.estimate_items[\s\S]{0,1800}price_source_kind='supplier_quote'/i);
  assert.match(sql, /update public\.project_condition_outputs[\s\S]{0,2200}'source_kind','supplier_quote'/i);
  assert.doesNotMatch(sql, /update public\.takeoff_measurement_outputs[\s\S]{0,1800}production_quantity\s*=/i);
});

test('pricing coverage distinguishes holds, source selections, expiry and unused candidates', async () => {
  requireFile(coveragePath, 'P1.2 pricing coverage helper must exist');
  const { getPricingCoverageSummary } = await import('../lib/estimating/pricingCoverage.ts');

  const summary = getPricingCoverageSummary({
    today: '2026-09-21',
    outputs: [
      { id: 'missing', pricing_status: 'missing_price' },
      { id: 'labor', pricing_status: 'missing_labor_rate' },
      { id: 'manual', pricing_status: 'manual_override', price_source_kind: 'manual_override' },
      { id: 'quote-current', pricing_status: 'priced', price_source_kind: 'supplier_quote', price_source_id: 'line-current' },
      { id: 'quote-expired', pricing_status: 'priced', price_source_kind: 'supplier_quote', price_source_id: 'line-expired' },
      { id: 'catalog', pricing_status: 'priced', price_source_kind: 'company_catalog' },
    ],
    quoteLines: [
      { id: 'line-current', source_takeoff_output_id: 'quote-current', expires_at: '2026-09-30' },
      { id: 'line-expired', source_takeoff_output_id: 'quote-expired', expires_at: '2026-09-01' },
      { id: 'line-unused-a', source_takeoff_output_id: 'missing', expires_at: '2026-09-30' },
      { id: 'line-unused-b', source_takeoff_output_id: 'missing', expires_at: '2026-09-30' },
    ],
  });

  assert.deepEqual(summary, {
    total: 6,
    priced: 4,
    pricedPercent: 66.7,
    missingPrice: 1,
    missingLaborRate: 1,
    supplierQuote: 2,
    expiredSupplierQuote: 1,
    availableUnselectedQuoteLines: 2,
    manualOverride: 1,
  });
});

test('Estimate workspace exposes supplier quote entry, coverage and explicit selection without quantity editing', () => {
  const panel = requireFile(panelPath, 'P1.2 PricingCoverage component must exist');
  const page = requireFile(pagePath, 'Estimate page must exist');
  const actions = requireFile(actionsPath, 'Estimate actions must exist');

  assert.match(panel, /Pricing coverage/i);
  assert.match(panel, /Supplier quote sets/i);
  assert.match(panel, /Missing price/i);
  assert.match(panel, /Expired/i);
  assert.match(panel, /Quote candidates/i);
  assert.match(panel, /Select quote/i);
  assert.match(panel, /supplier_name/i);
  assert.match(panel, /supplier_quote_number/i);
  assert.doesNotMatch(panel, /name="(?:quantity|production_quantity)"/i);

  assert.match(page, /estimate_supplier_quote_sets/i);
  assert.match(page, /estimate_supplier_quotes/i);
  assert.match(page, /estimate_supplier_quote_lines/i);
  assert.match(page, /<PricingCoverage/i);

  for (const action of [
    'createEstimateSupplierQuoteSet',
    'createEstimateSupplierQuote',
    'createEstimateSupplierQuoteLine',
    'selectEstimateSupplierQuoteLine',
  ]) assert.match(actions, new RegExp(`export async function ${action}`));

  const selection = actions.slice(actions.indexOf('export async function selectEstimateSupplierQuoteLine'));
  assert.match(selection, /carez_select_estimate_supplier_quote_line/);
  assert.doesNotMatch(selection.split('export async function', 2)[0] || selection, /fd\.get\(['"]quantity['"]\)/);
});
