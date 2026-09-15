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
  assert.doesNotMatch(`${serverSource}\n${actionSource}`, /carez_commit_project_condition_calculation/);
  assert.doesNotMatch(serverSource, /from\(['"]takeoff_measurements['"]\)[\s\S]{0,180}\.update\(/);
});
