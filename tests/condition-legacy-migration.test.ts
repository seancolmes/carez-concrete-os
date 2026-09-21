import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import {
  classifyLegacyMigrationCandidate,
  type LegacyMigrationClassification,
} from '../lib/takeoff/conditions/legacyMigration.ts';

const migrationPath = 'supabase/migrations/20260915231000_condition_legacy_migration_ledger.sql';
const serverPath = 'lib/takeoff/conditions/legacyMigration.server.ts';
const actionPath = 'app/takeoff/[setId]/conditionMigrationActions.ts';
const commitMigrationPath = 'supabase/migrations/20260915232000_condition_legacy_migration_commit.sql';
const sql = readFileSync(migrationPath, 'utf8');

test('P0.5E migration ledger is tenant-scoped, classified, auditable, and idempotent', () => {
  assert.match(sql, /create table public\.condition_legacy_migration_runs/i);
  assert.match(sql, /mode text not null[\s\S]*dry_run[\s\S]*apply/i);
  assert.match(sql, /create table public\.condition_legacy_migration_items/i);
  assert.match(sql, /mapped[\s\S]*historical_only[\s\S]*unsupported_review[\s\S]*unreferenced/i);
  assert.match(sql, /error_text text/i);
  assert.match(sql, /unique\s*\(run_id,\s*object_type,\s*legacy_id\)/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /get_my_company_id\(\)/i);
});

test('legacy migration classification protects history before cleanup eligibility', () => {
  const cases: Array<{
    input: Parameters<typeof classifyLegacyMigrationCandidate>[0];
    expected: LegacyMigrationClassification;
  }> = [
    {
      input: {referencedByIssuedHistory: true, activeMeasurementRefs: 0, templateMappingCount: 0, supportedPilotFamily: false},
      expected: 'historical_only',
    },
    {
      input: {referencedByIssuedHistory: false, activeMeasurementRefs: 1, templateMappingCount: 1, supportedPilotFamily: true},
      expected: 'mapped',
    },
    {
      input: {referencedByIssuedHistory: false, activeMeasurementRefs: 1, templateMappingCount: 0, supportedPilotFamily: false},
      expected: 'unsupported_review',
    },
    {
      input: {referencedByIssuedHistory: false, activeMeasurementRefs: 0, templateMappingCount: 0, supportedPilotFamily: false},
      expected: 'unreferenced',
    },
  ];

  for (const row of cases) assert.equal(classifyLegacyMigrationCandidate(row.input), row.expected);
});

test('legacy migration dry run inventories lineage without mutating domain records', () => {
  assert.equal(existsSync(serverPath), true, 'legacy migration inventory server module must exist');
  assert.equal(existsSync(actionPath), true, 'legacy migration dry-run server action must exist');

  const serverSource = readFileSync(serverPath, 'utf8');
  const actionSource = readFileSync(actionPath, 'utf8');

  assert.match(serverSource, /buildLegacyMigrationInventory/);
  assert.match(serverSource, /condition_legacy_output_mappings/);
  assert.match(serverSource, /takeoff_measurements/);
  assert.match(serverSource, /takeoff_measurement_outputs/);
  assert.match(serverSource, /estimate_items/);
  assert.match(serverSource, /proposal_presentations/);
  assert.match(serverSource, /historical_only/);
  assert.match(actionSource, /dryRunLegacyConditionMigration/);
  assert.match(actionSource, /mode\s*:\s*['"]dry_run['"]/);
  assert.match(actionSource, /condition_legacy_migration_runs/);
  assert.match(actionSource, /condition_legacy_migration_items/);
  const dryRunActionSource = actionSource.split('export async function applyLegacyConditionMigration')[0];
  assert.doesNotMatch(`${serverSource}\n${dryRunActionSource}`, /carez_commit_project_condition_calculation/);
  assert.doesNotMatch(serverSource, /from\(['"]takeoff_measurements['"]\)[\s\S]{0,180}\.update\(/);
});


test('supported pilot migration preparation is editable-only, geometry-preserving, and provenance-complete', () => {
  const serverSource = readFileSync(serverPath, 'utf8');
  const actionSource = readFileSync(actionPath, 'utf8');

  assert.match(serverSource, /prepareLegacyPilotMigration/);
  assert.match(serverSource, /estimateStatus[\s\S]{0,240}draft/);
  assert.match(serverSource, /proposalCount[\s\S]{0,180}>\s*0/);
  assert.match(serverSource, /sheet_id/);
  assert.match(serverSource, /scale_region_id/);
  assert.match(serverSource, /geometry/);
  assert.match(serverSource, /raw_quantity/);
  assert.match(serverSource, /raw_unit/);
  assert.match(serverSource, /source_measurement_id/);
  assert.match(serverSource, /source_assembly_version_id/);
  assert.match(serverSource, /target_template_version_id/);
  assert.match(serverSource, /target_compatibility_assembly_version_id/);
  assert.match(serverSource, /geometry_hash/);
  assert.match(serverSource, /source_output_ids/);
  assert.match(serverSource, /source_estimate_item_ids/);
  assert.match(serverSource, /compatibilityRebind/);
  assert.match(actionSource, /prepareLegacyPilotMigration/);
  assert.match(actionSource, /migration_preparation/);

  const dryRunActionSource = actionSource.split('export async function applyLegacyConditionMigration')[0];
  assert.doesNotMatch(`${serverSource}\n${dryRunActionSource}`, /carez_commit_project_condition_calculation/);
  assert.doesNotMatch(serverSource, /from\(['"]takeoff_measurements['"]\)[\s\S]{0,240}\.update\(/);
});


test('pilot migration commit is transactional, idempotent, and preserves measurement quantity authority', () => {
  assert.equal(existsSync(commitMigrationPath), true, 'Task 4 transactional migration must exist');
  const commitSql = readFileSync(commitMigrationPath, 'utf8');

  assert.match(commitSql, /create or replace function public\.carez_commit_legacy_condition_migration/i);
  assert.match(commitSql, /security invoker/i);
  assert.match(commitSql, /condition_legacy_migration_runs[\s\S]{0,500}for update/i);
  assert.match(commitSql, /condition_legacy_migration_items[\s\S]{0,500}for update/i);
  assert.match(commitSql, /takeoff_measurements[\s\S]{0,500}for update/i);
  assert.match(commitSql, /mode\s*(?:<>|!=)\s*['"]apply['"]/i);
  assert.match(commitSql, /estimate[\s\S]{0,300}status[\s\S]{0,120}draft/i);
  assert.match(commitSql, /proposal_presentations/i);
  assert.match(commitSql, /updated_at/i);
  assert.match(commitSql, /source_assembly_version_id/i);
  assert.match(commitSql, /target_compatibility_assembly_version_id/i);
  assert.match(commitSql, /assembly_version_id\s*=\s*v_target_assembly_version_id/i);
  assert.match(commitSql, /method_profile_id\s*=\s*null/i);
  assert.match(commitSql, /old_assembly_version_id/i);
  assert.match(commitSql, /new_assembly_version_id/i);
  assert.match(commitSql, /measurement_updated_at/i);
  assert.match(commitSql, /v_applied->>['"]measurement_updated_at['"]/i);
  assert.match(commitSql, /dry_run_id/i);
  assert.match(commitSql, /create unique index[\s\S]{0,320}source_snapshot[\s\S]{0,120}dry_run_id/i);

  assert.doesNotMatch(commitSql, /set[\s\S]{0,220}(?:geometry|raw_quantity|raw_unit|sheet_id|scale_region_id)\s*=/i);
  assert.doesNotMatch(commitSql, /p_(?:new|replacement|calculated)_quantity/i);
});

test('pilot migration apply uses the existing Condition calculator and closes only on exact lineage', () => {
  const serverSource = readFileSync(serverPath, 'utf8');
  const actionSource = readFileSync(actionPath, 'utf8');

  assert.match(actionSource, /applyLegacyConditionMigration/);
  assert.match(actionSource, /carez_commit_legacy_condition_migration/);
  assert.match(actionSource, /carez_create_project_concrete_condition/);
  assert.match(actionSource, /prepareConcreteConditionPilotPersistence/);
  assert.match(actionSource, /carez_commit_project_condition_calculation/);
  assert.match(actionSource, /condition_legacy_reconciliation/);
  assert.match(actionSource, /reconciliation_status/);
  assert.match(actionSource, /condition_legacy_migration_items/);
  assert.match(actionSource, /condition_legacy_migration_runs/);

  assert.match(serverSource, /assertLegacyMigrationEstimateLineage/);
  assert.match(serverSource, /estimate_visible/);
  assert.match(serverSource, /source_takeoff_output_id/);
  assert.match(serverSource, /source_takeoff_measurement_id/);
  assert.match(serverSource, /generated_estimate_item_id/);
  assert.match(serverSource, /duplicate/i);
  assert.match(serverSource, /orphan/i);

  assert.doesNotMatch(actionSource, /production_quantity\s*:/);
  assert.doesNotMatch(actionSource, /raw_quantity\s*:/);
});


test('P0.5E final docs preserve the EDGE-style Condition-first estimator contract and verified cutover state', () => {
  const currentState = readFileSync('docs/CURRENT_STATE.md', 'utf8');
  const takeoffSpec = readFileSync('docs/modules/takeoff.md', 'utf8');
  const resourceSpec = readFileSync('docs/modules/assembly-resource-engine.md', 'utf8');

  assert.match(takeoffSpec, /EDGE-style estimating workbench/);
  assert.match(takeoffSpec, /EDGE-style Condition-first estimator workflow/i);
  assert.match(resourceSpec, /Condition-first estimator workflow/i);
  assert.match(resourceSpec, /legacy assembly history/i);

  assert.match(currentState, /Task 6[^\n]*browser[^\n]*PASS/i);
  assert.match(currentState, /62 mapped/i);
  assert.match(currentState, /17 unsupported_review/i);
  assert.match(currentState, /single pre-Condition QA fixture/i);
  assert.match(currentState, /idempotent replay[^\n]*PASS/i);
  assert.match(currentState, /final staging acceptance pending/i);

  assert.doesNotMatch(currentState, /Tasks 1–2 are implemented; Task 3 is the next/);
  assert.doesNotMatch(currentState, /prepareLegacyPilotMigration\(\)[^\n]*not implemented/i);
});
