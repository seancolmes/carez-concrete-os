import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const ackMigrationPath = 'supabase/migrations/20260921232000_estimate_review_acknowledgements.sql';

const requireFile = (path: string, message: string) => {
  assert.equal(existsSync(path), true, message);
  return readFileSync(path, 'utf8');
};

test('P1.4 stores append-only tenant-scoped Estimate review acknowledgements', () => {
  const sql = requireFile(ackMigrationPath, 'P1.4 acknowledgement migration must exist');

  for (const column of [
    'company_id',
    'estimate_id',
    'commercial_fingerprint',
    'warning_fingerprint',
    'warning_count',
    'warning_snapshot',
    'acknowledged_by',
    'acknowledged_at',
  ]) assert.match(sql, new RegExp(column, 'i'));

  assert.match(sql, /create table public\.estimate_review_acknowledgements/i);
  assert.match(sql, /alter table public\.estimate_review_acknowledgements enable row level security/i);
  assert.match(sql, /company_id\s*=\s*\(select public\.get_my_company_id\(\)\)/i);
  assert.match(sql, /public\.get_my_role\(\)[\s\S]*<>\s*'employee'/i);
  assert.doesNotMatch(sql, /grant\s+(insert|update|delete)[\s\S]*estimate_review_acknowledgements\s+to\s+authenticated/i);
  assert.match(sql, /raise exception 'Estimate review acknowledgements are immutable\.'/i);
});

const evaluatorMigrationPath = 'supabase/migrations/20260923121000_estimate_release_readiness.sql';
const billingProfileMigrationPath = 'supabase/migrations/20260923120500_reconcile_company_billing_profiles.sql';
const ackRpcMigrationPath = 'supabase/migrations/20260923122000_estimate_review_acknowledgement_rpc.sql';

test('P1.4 company billing profile prerequisite reconciles the tenant-scoped defaults contract', () => {
  const sql = requireFile(billingProfileMigrationPath, 'Company billing profile prerequisite migration must exist');

  assert.match(sql, /create table if not exists public\.company_billing_profiles/i);
  assert.match(sql, /company_id uuid primary key references public\.companies\(id\) on delete cascade/i);
  assert.match(sql, /default_terms_text text/i);
  assert.match(sql, /default_due_days integer not null default 0 check \(default_due_days >= 0\)/i);
  assert.match(sql, /alter table public\.company_billing_profiles enable row level security/i);
  assert.match(sql, /create policy "company access billing profile"[\s\S]*for all[\s\S]*using \(company_id=public\.get_my_company_id\(\)\)[\s\S]*with check \(company_id=public\.get_my_company_id\(\)\)/i);
});

test('P1.4 readiness evaluator reads tenant company default terms directly', () => {
  const sql = requireFile(evaluatorMigrationPath, 'P1.4 readiness evaluator migration must exist');

  assert.match(sql, /from public\.company_billing_profiles billing_profile[\s\S]*where billing_profile\.company_id=v_company_id/i);
  assert.doesNotMatch(sql, /to_regclass\s*\(\s*'public\.company_billing_profiles'/i);
  assert.match(sql, /where nullif\(trim\(coalesce\(v_proposal_terms,''\)\),''\) is null\s+and nullif\(trim\(coalesce\(v_default_terms,''\)\),''\) is null/i);
});

test('P1.4 readiness evaluator is tenant-scoped, deterministic and Estimate-scoped', () => {
  const sql = requireFile(evaluatorMigrationPath, 'P1.4 readiness evaluator migration must exist');

  assert.match(sql, /create or replace function public\.carez_get_estimate_release_readiness\(p_estimate_id uuid\)/i);
  assert.match(sql, /returns jsonb/i);
  assert.match(sql, /digest\([\s\S]*'sha256'/i);
  assert.match(sql, /takeoff_measurements[\s\S]*estimate_id\s*=\s*p_estimate_id/i);
  assert.match(sql, /takeoff_measurement_outputs[\s\S]*measurement_id/i);
  assert.doesNotMatch(sql, /from public\.takeoff_measurement_outputs\s+where\s+company_id=v_company_id\s*(?:;|\))/i);
  assert.match(sql, /and commercial_fingerprint=v_commercial_fingerprint[\s\S]*and warning_fingerprint=v_warning_fingerprint/i);

  for (const state of ['not_ready', 'blocked', 'review', 'release_ready']) {
    assert.match(sql, new RegExp(`'${state}'`, 'i'));
  }

  for (const blocker of [
    'customer_sell_missing',
    'scope_missing',
    'generated_price_missing',
    'required_input_missing',
    'labor_assumption_missing',
    'labor_rate_missing',
    'manual_cost_missing',
    'labor_classification_missing',
    'generated_lineage_missing',
    'terms_missing',
    'customer_destination_missing',
  ]) assert.match(sql, new RegExp(blocker, 'i'));

  for (const warning of [
    'margin_below_target',
    'manual_price_override',
    'labor_job_override',
    'labor_rate_selection',
    'supplier_quote_expired',
    'supplier_quote_available',
    'scope_unassigned',
    'proposal_schedule_missing',
    'proposal_payment_missing',
  ]) assert.match(sql, new RegExp(warning, 'i'));
});

test('P1.4 acknowledgement RPC re-evaluates current state and never accepts client fingerprints', () => {
  const sql = requireFile(ackRpcMigrationPath, 'P1.4 acknowledgement RPC migration must exist');
  const signature = sql.match(/create or replace function public\.carez_acknowledge_estimate_review\([\s\S]*?\)\s*returns jsonb/i)?.[0] || '';

  assert.match(signature, /p_estimate_id\s+uuid/i);
  assert.doesNotMatch(signature, /fingerprint|warning_count|warning_snapshot|release_state/i);
  assert.match(sql, /security definer/i);
  assert.match(sql, /public\.get_my_company_id\(\)/i);
  assert.match(sql, /public\.get_my_role\(\)[\s\S]*employee/i);
  assert.match(sql, /from public\.estimates[\s\S]*where id=p_estimate_id\s+and company_id=v_company_id[\s\S]*for update/i);
  assert.match(sql, /carez_get_estimate_release_readiness\(p_estimate_id\)/i);
  assert.match(sql, /Cannot acknowledge Estimate review while blockers remain\./i);
  assert.match(sql, /Estimate must be Ready for Review before acknowledgement\./i);
  assert.match(sql, /No current warnings require acknowledgement\./i);
  assert.match(sql, /acknowledgement_valid[\s\S]*Current Estimate review warnings are already acknowledged\.[\s\S]*insert into public\.estimate_review_acknowledgements/i);
  assert.match(sql, /insert into public\.estimate_review_acknowledgements/i);
  assert.match(sql, /commercial_fingerprint[\s\S]*warning_fingerprint[\s\S]*warning_count[\s\S]*warning_snapshot/i);
  assert.match(sql, /created_acknowledgement_id/i);
  assert.match(sql, /revoke all on function public\.carez_acknowledge_estimate_review\(uuid\) from public,anon/i);
  assert.match(sql, /grant execute on function public\.carez_acknowledge_estimate_review\(uuid\) to authenticated,service_role/i);
});

test('P1.4 fingerprints aggregate ordered canonical records', () => {
  const sql = requireFile(evaluatorMigrationPath, 'P1.4 readiness evaluator migration must exist');
  assert.match(sql, /jsonb_agg\([\s\S]*order by/i);
  assert.match(sql, /commercial_fingerprint/i);
  assert.match(sql, /warning_fingerprint/i);
  assert.match(sql, /estimate_review_acknowledgements/i);
});

test('P1.4 commercial fingerprint includes customer-visible Estimate scope text', () => {
  const sql = requireFile(evaluatorMigrationPath, 'P1.4 readiness evaluator migration must exist');
  assert.match(sql, /'sections'[\s\S]*?'name',section\.name/i);
  assert.match(sql, /'items'[\s\S]*?'description',item\.description/i);
});

test('P1.4 evaluator scopes generated outputs through Estimate measurements', () => {
  const sql = requireFile(evaluatorMigrationPath, 'P1.4 readiness evaluator migration must exist');
  assert.match(sql, /join public\.takeoff_measurements[\s\S]*measurement_id/i);
  assert.match(sql, /measurements?\.estimate_id\s*=\s*p_estimate_id/i);
});

test('P1.4 evaluator resolves release contact through the Estimate customer without inventing Lead contact columns', () => {
  const sql = requireFile(evaluatorMigrationPath, 'P1.4 readiness evaluator migration must exist');
  assert.match(sql, /from public\.leads[\s\S]*join public\.customers/i);
  assert.match(sql, /customer_id/i);
  assert.match(sql, /customer_destination_missing/i);
});

test('P1.4 labor classification follows the current active company class contract', () => {
  const sql = requireFile(evaluatorMigrationPath, 'P1.4 readiness evaluator migration must exist');
  assert.match(sql, /from public\.li_risk_classes[\s\S]*company_id\s*=\s*v_company_id[\s\S]*tax_year\s*=\s*2026[\s\S]*active/i);
  assert.match(sql, /labor_classification_missing/i);
});
