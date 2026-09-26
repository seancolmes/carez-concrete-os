import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const removedOrphanPath = 'supabase/migrations/20260923120000_reconcile_proposal_conversion_schema.sql';
const canonicalPath = 'supabase/migrations/20260924083000_reconcile_proposal_conversion_schema.sql';
const bridgePath = 'supabase/migrations/20260924083100_proposal_authority_cutover.sql';
const manifestPath = 'docs/workflow/PRODUCTION_MIGRATION_BRIDGE.md';
const source = (path: string) => {
  assert.equal(existsSync(path), true, `Expected source contract ${path}`);
  return readFileSync(path, 'utf8');
};

test('orphaned Proposal migration is absent from the canonical QA chain', () => {
  assert.equal(existsSync(removedOrphanPath), false, 'QA never applied 20260923120000; it must not remain in the source migration chain');
  const manifest = source(manifestPath);
  assert.match(manifest, /20260923120000[\s\S]*NOT_APPLICABLE[\s\S]*removed from (?:the )?canonical (?:QA )?chain/i);
});

test('canonical reconciliation remains the current Proposal schema authority', () => {
  const sql = source(canonicalPath);
  assert.match(sql, /release_commercial_fingerprint/i);
  assert.match(sql, /release_warning_fingerprint/i);
  assert.match(sql, /release_acknowledgement_id/i);
  assert.match(sql, /guard_proposal_release/i);
  assert.doesNotMatch(sql, /create or replace function public\.carez_guard_proposal_release/i);
  assert.doesNotMatch(sql, /accept_public_proposal|award_accepted_estimate/i);
  assert.match(sql, /create_estimate_revision remains deferred/i);
});

test('Issue #59 manifest classifies migration handling and explicit deferrals', () => {
  const manifest = source(manifestPath);
  for (const classification of ['ALREADY_MATERIALIZED', 'SAFE_TO_APPLY', 'BRIDGE_ONLY', 'NOT_APPLICABLE']) {
    assert.match(manifest, new RegExp(classification));
  }
  assert.match(manifest, /Customer Acceptance[\s\S]*Award[\s\S]*deferred/i);
  assert.match(manifest, /Create Next Revision[\s\S]*deferred/i);
  assert.match(manifest, /never run a blind `?supabase db push`? against production/i);
  assert.match(manifest, /20260906175305_reconcile_identity_helper_rpc_lockdown[\s\S]*ALREADY_MATERIALIZED/i);
  assert.match(manifest, /production bridge acceptance requires[\s\S]*ACL-faithful production-schema clone rehearsal/i);
  assert.match(manifest, /Issue #59 production bridge: applied and verified[\s\S]*all 34[\s\S]*production application completed successfully/i);
  assert.match(manifest, /application-time versions `20260925021524` through `20260925022046`[\s\S]*canonical migration names match the manifest entries 1:1/i);
  assert.match(manifest, /proposal_authority_cutover` was applied last/i);
  assert.match(manifest, /production row-dependent preflight — read-only[\s\S]*expected legacy backfill — pass/i);
  assert.match(manifest, /production write authorization: \*\*not granted\*\*/i);
  for (const migration of [
    '20260901044057_takeoff_nested_activation_missing_input',
    '20260903040801_assembly_builder_revision_clone',
    '20260903044953_qa_reconcile_custom_assembly_create_rpc',
    '20260903052242_scope_recipe_project_variants',
    '20260903061837_formula_composer_authoring',
    '20260904210858_company_branding',
    '20260905155018_strip_footing_edge_modules_v2',
    '20260905205715_strip_footing_estimator_model_v3',
    '20260906150633_strip_footing_bulkheads_v4',
    '20260906150800_strip_footing_bulkheads_v4_upgrade_order',
    '20260906160338_strip_footing_form_resources_v5',
  ]) {
    assert.match(manifest, new RegExp(`${migration}[\\s\\S]*SAFE_TO_APPLY`));
  }
});

test('Proposal authority bridge checks the P1.4 guard before removing historical authority', () => {
  const sql = source(bridgePath);
  const guardCheck = sql.search(/if\s+not\s+exists[\s\S]*?guard_proposal_release[\s\S]*?carez_guard_proposal_release/i);
  const historicalRemoval = sql.search(/drop trigger if exists carez_proposal_audit_gate on public\.proposal_presentations/i);
  assert.notEqual(guardCheck, -1, 'Bridge must verify trigger guard_proposal_release invokes public.carez_guard_proposal_release()');
  assert.match(sql, /trigger_row\.tgenabled\s*=\s*'O'/i, 'Accepted guard trigger must be enabled for origin sessions');
  assert.match(sql, /trigger_row\.tgtype\s*=\s*7/i, 'Accepted guard trigger must be BEFORE ROW INSERT');
  assert.notEqual(historicalRemoval, -1, 'Bridge must conditionally remove the historical trigger');
  assert.ok(guardCheck < historicalRemoval, 'P1.4 authority verification must precede historical trigger removal');
  for (const signature of [
    'public.accept_public_proposal(uuid,text,text,text)',
    'public.award_accepted_estimate(uuid)',
    'public.create_estimate_revision(uuid)',
  ]) {
    assert.ok(sql.toLowerCase().includes(signature.toLowerCase()), `Bridge must identify ${signature}`);
    assert.ok(sql.toLowerCase().includes(`revoke execute on function ${signature.toLowerCase()} from public, anon, authenticated`), `Bridge must revoke app-role EXECUTE on ${signature}`);
  }
  assert.doesNotMatch(sql, /grant\s+.*service_role|revoke\s+.*service_role/i);
  for (const relation of ['proposal_presentations', 'estimates', 'projects']) {
    assert.doesNotMatch(sql, new RegExp(`\\binsert\\s+into\\s+public\\.${relation}\\b`, 'i'));
    assert.doesNotMatch(sql, new RegExp(`\\bupdate\\s+public\\.${relation}\\b`, 'i'));
    assert.doesNotMatch(sql, new RegExp(`\\bdelete\\s+from\\s+public\\.${relation}\\b`, 'i'));
    assert.doesNotMatch(sql, new RegExp(`\\btruncate\\s+(?:table\\s+)?public\\.${relation}\\b`, 'i'));
  }
  assert.doesNotMatch(sql, /drop function|create or replace function|perform\s+public\.(?:accept_public_proposal|award_accepted_estimate|create_estimate_revision)/i);
});

test('Proposal UI exposes only actions supported after the authority cutover', () => {
  const publicPage = source('app/proposal/[token]/page.tsx');
  const publicActions = source('app/proposal/[token]/actions.ts');
  const ownerPage = source('app/proposals/[estimateId]/page.tsx');
  const ownerActions = source('app/proposals/actions.ts');
  assert.doesNotMatch(publicPage, /Accept Proposal|action=\{acceptProposal\}/);
  assert.doesNotMatch(publicActions, /accept_public_proposal/);
  assert.match(publicPage, /online acceptance is not available/);
  assert.match(publicPage, /action=\{submitProposalResponse\}/);
  assert.match(ownerPage, /Create Next Revision/);
  assert.match(ownerPage, /Award \/ Create Project/);
  assert.match(ownerActions, /carez_create_next_proposal_revision/);
  assert.match(ownerActions, /carez_award_proposal_and_create_project/);
  assert.doesNotMatch(publicActions, /carez_award_proposal_and_create_project|carez_create_next_proposal_revision/);
});
