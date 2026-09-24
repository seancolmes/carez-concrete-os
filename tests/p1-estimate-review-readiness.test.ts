import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const ackMigrationPath = 'supabase/migrations/20260921232000_estimate_review_acknowledgements.sql';
const ackHardeningMigrationPath = 'supabase/migrations/20260923123000_estimate_review_acknowledgement_hardening.sql';

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

test('P1.4 acknowledgement follow-up limits authenticated access and indexes the Estimate foreign key', () => {
  const sql = requireFile(ackHardeningMigrationPath, 'P1.4 acknowledgement hardening migration must exist');

  assert.match(sql, /revoke all\s+on table public\.estimate_review_acknowledgements\s+from authenticated/i);
  assert.match(sql, /revoke all[\s\S]*?grant select\s+on table public\.estimate_review_acknowledgements\s+to authenticated/i);
  for (const privilege of ['insert', 'update', 'delete', 'truncate']) {
    assert.doesNotMatch(sql, new RegExp(`grant\\s+${privilege}\\b[\\s\\S]*?to authenticated`, 'i'));
  }
  assert.match(sql, /create index if not exists estimate_review_ack_estimate_id_fk_idx\s+on public\.estimate_review_acknowledgements\s*\(\s*estimate_id\s*\)/i);
});

const evaluatorMigrationPath = 'supabase/migrations/20260923121000_estimate_release_readiness.sql';
const billingProfileMigrationPath = 'supabase/migrations/20260923120500_reconcile_company_billing_profiles.sql';
const ackRpcMigrationPath = 'supabase/migrations/20260923122000_estimate_review_acknowledgement_rpc.sql';
const proposalGuardMigrationPath = 'supabase/migrations/20260923122500_proposal_release_guard.sql';
const proposalReconciliationMigrationPath = 'supabase/migrations/20260924083000_reconcile_proposal_conversion_schema.sql';
const reviewPagePath = 'app/estimates/audit/page.tsx';
const estimateActionsPath = 'app/estimates/actions.ts';
const estimatePagePath = 'app/estimates/[estimateId]/page.tsx';
const proposalPagePath = 'app/proposals/[estimateId]/page.tsx';
const proposalActionsPath = 'app/proposals/actions.ts';
const estimatingSpecPath = 'docs/modules/estimating.md';

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

test('release readiness presentation helper preserves database state without recomputing it', async () => {
  const { parseEstimateReleaseReadiness, releaseStateLabel } =
    await import('../lib/estimating/releaseReadiness.ts');

  const parsed = parseEstimateReleaseReadiness({
    estimate_id: 'e1',
    workflow_state: 'review',
    release_state: 'review',
    blocker_count: 0,
    warning_count: 1,
    blockers: [],
    warnings: [{ finding_key:'margin_below_target', severity:'warning', category:'margin', title:'Margin below target', detail:'26.8% vs 30%', record_id:null, next_action:'margin' }],
    commercial_fingerprint: 'abc',
    warning_fingerprint: 'def',
    acknowledgement_valid: false,
    acknowledgement_id: null,
    acknowledged_at: null,
    acknowledged_by: null,
    latest_acknowledgement_id: null,
    latest_acknowledged_at: null,
  });

  assert.equal(parsed.release_state, 'review');
  assert.equal(parsed.warning_count, 1);
  assert.equal(releaseStateLabel(parsed.release_state), 'REVIEW REQUIRED');
});

test('Estimate Review consumes authoritative readiness and avoids obsolete audit views', () => {
  const page = requireFile(reviewPagePath, 'Estimate Review page must exist');
  assert.match(page, /carez_get_estimate_release_readiness/);
  assert.match(page, /parseEstimateReleaseReadiness/);
  assert.doesNotMatch(page, /estimate_audit_(?:summary|findings)/);
  for (const section of ['Release state', 'Commercial Recap', 'Blockers', 'Warnings', 'Commercial Decisions', 'Scope Recap', 'Pricing Recap', 'Labor Recap', 'Proposal preparation', 'Estimate Trace']) {
    assert.match(page, new RegExp(section, 'i'));
  }
  assert.match(page, /Reviewed \/ proceed/);
  assert.match(page, /latest_acknowledgement_id[\s\S]*acknowledgement_valid[\s\S]*stale/i);
  assert.match(page, /readiness\.release_state==='review'&&readiness\.blocker_count===0&&readiness\.warning_count>0/);
  const sectionOrder = ['Release state', 'Commercial Recap', 'Blockers', 'Warnings', 'Commercial Decisions', 'Scope Recap', 'Pricing Recap', 'Labor Recap', 'Proposal preparation', 'Estimate Trace'].map(section => page.indexOf(section));
  assert.deepEqual(sectionOrder, [...sectionOrder].sort((a, b) => a - b));
  const warningsSection = page.indexOf('<FindingSection title="Warnings"');
  const acknowledgement = page.indexOf('Reviewed / proceed');
  const commercialDecisions = page.indexOf('Commercial Decisions</h2>');
  assert.ok(warningsSection < acknowledgement && acknowledgement < commercialDecisions, 'Acknowledgement follows Warnings and precedes Commercial Decisions');
  for (const destination of ['/estimates/${estimateId}#pricing-coverage', '/estimates/${estimateId}#labor-review', '/estimates/${estimateId}#scope-cost', '/estimates/${estimateId}#price-margin', '/proposals/${estimateId}', "return '/takeoff'"]) {
    assert.ok(page.includes(destination), `Expected finding destination ${destination}`);
  }
});

test('Estimate Review recap scopes active source data and shows connected commercial lineage', () => {
  const page = requireFile(reviewPagePath, 'Estimate Review page must exist');
  assert.match(page, /takeoff_measurements'[\s\S]*\.eq\('status','active'\)/);
  assert.match(page, /measurementIds\.length\?[\s\S]*takeoff_measurement_outputs'[\s\S]*\.in\('measurement_id',measurementIds\)/);
  assert.match(page, /item\.source_takeoff_output_id\|\|activeOutputIds\.includes\(item\.source_takeoff_output_id\)/);
  assert.match(page, /item\.source_takeoff_measurement_id\|\|measurementIds\.includes\(item\.source_takeoff_measurement_id\)/);
  assert.match(page, /labor_rate_override_at!==null&&output\.labor_rate_override_at!==undefined/);
  assert.doesNotMatch(page, /explicitLaborRates=activeOutputs\.filter\(output=>output\.estimate_item_type==='labor'&&output\.price_source_kind==='labor_profile'/);
  assert.match(page, /project_condition_measurement_roles'[\s\S]*\.in\('measurement_id',measurementIds\)/);
  assert.match(page, /estimate_supplier_quote_lines'[\s\S]*\.in\('quote_id',quoteIds\)/);
  assert.match(page, /activeOutputs/);
  assert.match(page, /B&O classification \/ rate/);
  assert.match(page, /Payment \/ transaction reserve assumption/);
  assert.match(page, /bo_classification[\s\S]*bo_rate_percent/);
  assert.match(page, /payment_processing_rate_percent/);
  for (const scopeFact of ['Condition\(s\)', 'active Takeoff measurement\(s\)', 'active generated output\(s\)', 'Estimate item\(s\)']) assert.ok(page.includes(scopeFact));
  for (const count of ['Generated resources', 'Priced', 'Missing price', 'Supplier quote selected', 'Catalog source', 'Template \/ default source', 'Manual override', 'Expired selected quote', 'Unused supplier evidence']) {
    assert.ok(page.includes(count), `Expected pricing recap count ${count}`);
  }
  for (const count of ['Labor operations', 'Estimated MH', 'Direct Labor Cost', 'Baseline assumptions', 'Job MH\/unit overrides', 'Explicit labor-rate selections', 'Missing assumptions', 'Missing rates']) {
    assert.ok(page.includes(count), `Expected labor recap count ${count}`);
  }
  for (const lineage of ['Condition:', 'Measurement / drawing:', 'Output:', 'Production Quantity:', 'Price source:', 'Labor assumption / rate:', 'Direct Cost']) {
    assert.ok(page.includes(lineage), `Expected connected Estimate Trace field ${lineage}`);
  }
  assert.match(page, /legacy_takeoff_output_id===output\?\.id\|\|row\.generated_estimate_item_id===item\.id/);
  for (const decision of ['Manual price override', 'Selected supplier quote', 'Expired selected supplier quote', 'Job MH/unit override', 'Explicit labor-rate selection', 'Customer Sell below target']) assert.ok(page.includes(decision));
  assert.match(page, /Commercial Decisions[\s\S]*commercialDecisions\.map/);
  assert.match(page, /condition_code_snapshot[\s\S]*revision_no/);
  assert.match(page, /template_code_snapshot[\s\S]*template_name_snapshot[\s\S]*templateVersion\.version_no/);
  assert.match(page, /archetype_code_snapshot[\s\S]*archetype_name_snapshot[\s\S]*archetypeVersion\.version_no/);
  assert.match(page, /Condition module \+ [Oo]utput/);
  assert.match(page, /Generated Estimate item:/);
  assert.doesNotMatch(page, /Sell allocation/);
  assert.match(page, /latestReviewer\?\.full_name\|\|latestReviewer\?\.email/);
  assert.match(page, /from\('profiles'\)\.select\('full_name,email'\)[\s\S]*\.eq\('company_id',companyId\)/);
  assert.doesNotMatch(page, /previous review by \{latestAck\?\.acknowledged_by/);
});

test('Estimate review acknowledgement action delegates authority to the RPC', () => {
  const actions = requireFile(estimateActionsPath, 'Estimate actions must exist');
  assert.match(actions, /export async function acknowledgeEstimateReview/);
  assert.match(actions, /carez_acknowledge_estimate_review/);
  const action = actions.slice(actions.indexOf('export async function acknowledgeEstimateReview'));
  const body = action.split('export async function', 2)[0] || action;
  assert.doesNotMatch(body, /fingerprint|warning_snapshot|warning_count/);
  assert.match(body, /\.eq\('company_id',companyId\)/);
  assert.match(body, /revalidatePath\('\/estimates\/audit'\)/);
  assert.match(body, /revalidatePath\(`\/proposals\/\$\{estimateId\}`\)/);
});

test('Estimate UI uses Ready for Review and Review terminology', () => {
  const page = requireFile(estimatePagePath, 'Estimate page must exist');
  assert.match(page, /Ready for Review/);
  assert.doesNotMatch(page, /Ready for Audit \/ Proposal/);
  assert.match(page, /'Review'/);
  for (const anchor of ['scope-cost', 'price-margin', 'pricing-coverage', 'labor-review']) {
    assert.match(page, new RegExp(`id=["']${anchor}["']`));
  }
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

test('P1.4 Proposal presentations persist and enforce fresh Estimate release evidence', () => {
  const sql = requireFile(proposalGuardMigrationPath, 'P1.4 proposal release guard migration must exist');
  for (const column of ['release_commercial_fingerprint', 'release_warning_fingerprint', 'release_acknowledgement_id']) {
    assert.match(sql, new RegExp(`add column ${column}`, 'i'));
  }
  assert.match(sql, /release_acknowledgement_id uuid[\s\S]*references public\.estimate_review_acknowledgements\(id\)/i);
  assert.match(sql, /create or replace function public\.carez_guard_proposal_release\(\)/i);
  assert.match(sql, /before insert on public\.proposal_presentations/i);
  assert.match(sql, /carez_get_estimate_release_readiness\(new\.estimate_id\)/i);
  assert.match(sql, /release_state[\s\S]*is distinct from 'release_ready'/i);
  assert.match(sql, /new\.release_commercial_fingerprint is distinct from \(v_readiness->>'commercial_fingerprint'\)/i);
  assert.match(sql, /new\.release_warning_fingerprint is distinct from \(v_readiness->>'warning_fingerprint'\)/i);
  assert.match(sql, /v_warning_count>0[\s\S]*new\.release_acknowledgement_id is distinct from/i);
  assert.match(sql, /v_warning_count=0[\s\S]*new\.release_acknowledgement_id:=null/i);
});

test('Proposal schema reconciliation restores the conversion contract without replacing P1.4 authority', () => {
  const sql = requireFile(proposalReconciliationMigrationPath, 'Proposal schema reconciliation migration must exist');

  for (const object of [
    'proposal_access_tokens', 'proposal_acceptances', 'proposal_settings', 'proposal_clarifications',
    'proposal_engagement_events', 'opportunity_sequences', 'next_opportunity_number',
    'proposal_conversion_queue', 'get_public_proposal', 'track_public_proposal_view',
    'lead_activities', 'lead_bid_intelligence', 'bid_value_options',
  ]) assert.ok(sql.includes(object), `Expected reconciled Proposal contract: ${object}`);

  assert.doesNotMatch(sql, /drop\s+table\s+(?:if\s+exists\s+)?public\.proposal_presentations|truncate\s+(?:table\s+)?public\.proposal_presentations|create\s+table(?:\s+if\s+not\s+exists)?\s+public\.proposal_presentations/i);
  assert.match(sql, /proposal_access_token_id[\s\S]*references public\.proposal_access_tokens\(id\)/i);
  assert.match(sql, /proposal_presentations_proposal_access_token_id_key[\s\S]*c\.conkey=array\[v_token_attnum\]/i);
  assert.match(sql, /proposal_presentations must retain the accepted single-column UNIQUE key/i);
  assert.doesNotMatch(sql, /create unique index if not exists proposal_presentations_access_token_key/i);
  assert.match(sql, /proposal_presentations is incompatible[\s\S]*missing expected columns/i);
  for (const column of ['release_commercial_fingerprint', 'release_warning_fingerprint', 'release_acknowledgement_id']) {
    assert.match(sql, new RegExp(`new\\.${column} is distinct from old\\.${column}`, 'i'));
  }
  assert.match(sql, /protect_proposal_presentation_snapshot/i);
  assert.match(sql, /create trigger protect_proposal_presentation_snapshot before update/i);
  assert.doesNotMatch(sql, /create or replace function public\.carez_guard_proposal_release|drop trigger[^;]*guard_proposal_release/i);
  assert.match(sql, /guard_proposal_release[\s\S]*raise exception/i);
  assert.match(sql, /create policy "office access proposal settings"[\s\S]*get_my_company_id[\s\S]*get_my_role[\s\S]*employee/i);
  assert.ok(sql.indexOf('drop policy if exists "qa company access proposal_presentations"') < sql.indexOf('create policy "office access proposal presentations"'));
  assert.match(sql, /revoke all on table[\s\S]*public\.proposal_settings[\s\S]*public\.proposal_presentations[\s\S]*public\.proposal_engagement_events[\s\S]*from public, anon, authenticated/i);
  assert.match(sql, /revoke all on table[\s\S]*from public, anon, authenticated/i);
  assert.match(sql, /grant select, insert, update on table public\.proposal_settings to authenticated/i);
  assert.doesNotMatch(sql, /grant\s+[^;]*(?:truncate|references|trigger)[^;]*\s+to authenticated/i);
  assert.doesNotMatch(sql, /grant all on table[^;]*to authenticated/i);
  assert.match(sql, /security_invoker\s*=\s*true/i);
  assert.doesNotMatch(sql, /\b(?:accept_public_proposal|award_accepted_estimate)\b/i);
  assert.match(sql, /create_estimate_revision remains deferred pending a current lineage-safe Estimate revision contract/i);
  assert.doesNotMatch(sql, /create\s+(?:or replace\s+)?function\s+public\.create_estimate_revision\s*\(/i);
});

test('Proposal page and issue action consume authoritative release readiness', () => {
  const page = requireFile(proposalPagePath, 'Proposal page must exist');
  const actions = requireFile(proposalActionsPath, 'Proposal actions must exist');
  assert.match(page, /carez_get_estimate_release_readiness/);
  assert.match(page, /parseEstimateReleaseReadiness/);
  assert.match(page, /release\.release_state==='release_ready'&&!locked/);
  assert.doesNotMatch(page, /readyCount/);

  const issue = actions.slice(actions.indexOf('export async function createProposalLink'), actions.indexOf('export async function revokeProposalLink'));
  assert.match(issue, /carez_get_estimate_release_readiness/);
  assert.match(issue, /parseEstimateReleaseReadiness/);
  assert.match(issue, /release\.release_state!=='release_ready'/);
  assert.match(issue, /release_commercial_fingerprint:release\.commercial_fingerprint/);
  assert.match(issue, /release_warning_fingerprint:release\.warning_fingerprint/);
  assert.match(issue, /release_acknowledgement_id:release\.warning_count>0\?release\.acknowledgement_id:null/);
});

test('Estimating module documents the implemented P1.4 Review and Proposal release contract', () => {
  const docs = requireFile(estimatingSpecPath, 'Estimating module spec must exist');
  assert.match(docs, /`ready` means \*\*Ready for Review\*\*/i);
  assert.match(docs, /BLOCKED/);
  assert.match(docs, /REVIEW REQUIRED/);
  assert.match(docs, /RELEASE READY/);
  assert.match(docs, /Not ready/);
  assert.match(docs, /complete current warning set/i);
  assert.match(docs, /commercial fingerprint/i);
  assert.match(docs, /warning fingerprint/i);
  assert.match(docs, /append-only audit evidence/i);
  assert.match(docs, /stale acknowledgements remain available as audit evidence but have no current release authority/i);
  assert.match(docs, /Proposal issuance re-evaluates readiness immediately before/i);
  assert.match(docs, /stores the release commercial fingerprint, release warning fingerprint, and applicable acknowledgement ID/i);
  assert.match(docs, /database insertion guard[\s\S]*final Proposal release authority/i);
  assert.match(docs, /exception-first/i);
  assert.match(docs, /does not own another quantity, pricing, labor, or financial calculation engine/i);
  assert.match(docs, /Production Quantity, Direct Cost, and Sell remain separate concepts/i);
  assert.match(docs, /does not introduce per-line Sell allocation/i);
});
