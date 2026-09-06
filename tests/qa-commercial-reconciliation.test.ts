import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { conditionOutputStatus } from '../lib/takeoff/conditions/issues.ts';

const estimateActions = readFileSync('app/estimates/actions.ts', 'utf8');
const migration = readFileSync('supabase/migrations/20260906023000_condition_commercial_reconciliation_and_contract_upgrade.sql', 'utf8');

test('manual Condition price overrides are commercially ready', () => {
  assert.equal(conditionOutputStatus({ status: 'ready', pricing_status: 'manual_override' }), 'Ready');
});

test('estimate pricing no longer reads nonexistent company B&O columns', () => {
  assert.doesNotMatch(estimateActions, /retailing_bo_rate_percent|wholesaling_bo_rate_percent|default_bo_classification/);
  assert.match(estimateActions, /const BO_RATE_PERCENT=\{retailing:0\.471,wholesaling:0\.484\}/);
  assert.match(estimateActions, /bo===current\.bo_classification/);
});

test('explicit output pricing reconciles Condition, Takeoff, and Estimate commercial state', () => {
  assert.match(migration, /create or replace function public\.carez_update_takeoff_output_price/);
  assert.match(migration, /update public\.takeoff_measurement_outputs/);
  assert.match(migration, /update public\.estimate_items/);
  assert.match(migration, /update public\.project_condition_outputs condition_output/);
  assert.match(migration, /pricing_status='manual_override'/);
  assert.match(migration, /condition_version\.status='verified'/);
});

test('Strip contract upgrade is draft-only and clears stale projection state', () => {
  assert.match(migration, /carez_upgrade_strip_condition_draft_to_v3/);
  assert.match(migration, /Only a draft Project Condition can be upgraded/);
  assert.match(migration, /compatibility_projection_version_id=null/);
  assert.match(migration, /module_key'<>'reinforcing'/);
  assert.match(migration, /requires_recalculation',true/);
});
