import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const migrationPath = 'supabase/migrations/20260921210000_estimate_pricing_provenance.sql';
const indexMigrationPath = 'supabase/migrations/20260921211000_estimate_pricing_provenance_indexes.sql';
const assemblyEnginePath = 'lib/takeoff/assemblyEngine.server.ts';
const legacyAdapterPath = 'lib/takeoff/conditions/legacyAdapter.ts';
const persistencePath = 'lib/takeoff/conditions/persistence.server.ts';
const estimatePagePath = 'app/estimates/[estimateId]/page.tsx';
const worksheetPath = 'components/estimates/EstimateWorksheet.tsx';

test('P1.1 stores structured price provenance on generated outputs and estimate items', () => {
  assert.equal(existsSync(migrationPath), true, 'P1.1 pricing provenance migration must exist');
  const sql = readFileSync(migrationPath, 'utf8');

  for (const column of [
    'price_source_kind',
    'price_source_id',
    'price_source_label',
    'price_source_reference',
    'price_effective_date',
    'price_override_by',
    'price_override_at',
  ]) {
    assert.match(sql, new RegExp(`takeoff_measurement_outputs[\\s\\S]{0,2200}${column}`, 'i'));
    assert.match(sql, new RegExp(`estimate_items[\\s\\S]{0,2200}${column}`, 'i'));
  }

  assert.match(sql, /vendor_bill_history/);
  assert.match(sql, /purchase_order_history/);
  assert.match(sql, /company_catalog/);
  assert.match(sql, /labor_profile/);
  assert.match(sql, /template_default/);
  assert.match(sql, /supplier_quote/);
  assert.match(sql, /manual_override/);
});

test('Takeoff pricing resolvers emit source kind, identity, label and effective date', () => {
  const source = readFileSync(assemblyEnginePath, 'utf8');

  assert.match(source, /sourceKind:\s*'labor_profile'/);
  assert.match(source, /sourceId:\s*profile\.id/);
  assert.match(source, /effectiveDate:\s*profile\.effective_date/);

  assert.match(source, /sourceKind:\s*'vendor_bill_history'/);
  assert.match(source, /sourceKind:\s*'purchase_order_history'/);
  assert.match(source, /sourceKind:\s*'company_catalog'/);
  assert.match(source, /sourceKind:\s*'template_default'/);
  assert.match(source, /sourceReference/);
});

test('Condition compatibility adapter carries structured price provenance without accepting quantity from pricing UI', () => {
  const adapter = readFileSync(legacyAdapterPath, 'utf8');
  const persistence = readFileSync(persistencePath, 'utf8');

  assert.match(adapter, /price_source_kind/);
  assert.match(adapter, /price_source_id/);
  assert.match(adapter, /price_source_label/);
  assert.match(adapter, /price_source_reference/);
  assert.match(adapter, /price_effective_date/);
  assert.match(persistence, /priceSourceKind:/);
  assert.match(persistence, /priceEffectiveDate:/);
});

test('sync and manual override atomically preserve provenance across Takeoff, Estimate and Condition', () => {
  const sql = readFileSync(migrationPath, 'utf8');

  assert.match(sql, /create or replace function public\.carez_sync_takeoff_measurement_outputs/);
  assert.match(sql, /v_output\.pricing_status='manual_override'[\s\S]{0,1200}v_price_source_kind:=coalesce\(v_output\.price_source_kind,'manual_override'\)/i);
  assert.match(sql, /insert into public\.estimate_items\([\s\S]{0,1600}price_source_kind/);
  assert.match(sql, /update public\.estimate_items set[\s\S]{0,1600}price_source_kind=v_price_source_kind/i);

  assert.match(sql, /create or replace function public\.carez_update_takeoff_output_price\(p_output_id uuid,\s*p_unit_cost numeric\)/);
  assert.match(sql, /price_source_kind='manual_override'/);
  assert.match(sql, /price_override_by=auth\.uid\(\)/);
  assert.match(sql, /v_override_at timestamptz:=now\(\)/);
  assert.match(sql, /price_override_at=v_override_at/);
  assert.match(sql, /update public\.project_condition_outputs condition_output[\s\S]{0,1800}'source_kind','manual_override'/i);
  assert.doesNotMatch(sql, /p_(?:quantity|production_quantity|raw_quantity)/i);
});

test('Estimate worksheet presents structured price provenance without database IDs', () => {
  const page = readFileSync(estimatePagePath, 'utf8');
  const worksheet = readFileSync(worksheetPath, 'utf8');

  assert.match(page, /price_source_kind/);
  assert.match(page, /price_source_label/);
  assert.match(page, /price_source_reference/);
  assert.match(page, /price_effective_date/);
  assert.match(worksheet, /price_source_label/);
  assert.match(worksheet, /price_effective_date/);
  assert.match(worksheet, /price_source_reference/);
  assert.doesNotMatch(worksheet, /price_source_id/);
});


test('current price resolution follows P1 source precedence before template fallback', () => {
  const source = readFileSync(assemblyEnginePath, 'utf8');
  const resolverStart = source.indexOf('export async function resolveTakeoffCurrentUnitCost');
  const resolverEnd = source.indexOf('export async function prepareAssemblyOutputs', resolverStart);
  const resolver = source.slice(resolverStart, resolverEnd);

  const vendorBill = resolver.indexOf("sourceKind: 'vendor_bill_history'");
  const purchaseOrder = resolver.indexOf("sourceKind: 'purchase_order_history'");
  const catalog = resolver.indexOf("sourceKind: 'company_catalog'");
  const templateDefault = resolver.indexOf("sourceKind: 'template_default'");

  assert.ok(vendorBill >= 0 && purchaseOrder > vendorBill && catalog > purchaseOrder && templateDefault > catalog);
});


test('pricing provenance override foreign keys have covering indexes', () => {
  assert.equal(existsSync(indexMigrationPath), true, 'P1.1 pricing provenance index migration must exist');
  const sql = readFileSync(indexMigrationPath, 'utf8');
  assert.match(sql, /create index if not exists takeoff_outputs_price_override_by_idx[\s\S]*takeoff_measurement_outputs\s*\(price_override_by\)/i);
  assert.match(sql, /create index if not exists estimate_items_price_override_by_idx[\s\S]*estimate_items\s*\(price_override_by\)/i);
});


test('template default remains a fallback when no compatible catalog source exists', () => {
  const source = readFileSync(assemblyEnginePath, 'utf8');
  const resolverStart = source.indexOf('export async function resolveTakeoffCurrentUnitCost');
  const resolverEnd = source.indexOf('export async function prepareAssemblyOutputs', resolverStart);
  const resolver = source.slice(resolverStart, resolverEnd);

  assert.doesNotMatch(resolver, /if \(!component\.catalog_item_id\) return null/);
  assert.doesNotMatch(resolver, /if \(!catalog \|\|[^\n]+\) return null/);
  assert.match(resolver, /if \(Number\(component\.default_unit_cost \|\| 0\) > 0\)[\s\S]*sourceKind:\s*'template_default'/);
});
