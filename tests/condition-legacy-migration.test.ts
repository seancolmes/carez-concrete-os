import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const migrationPath = 'supabase/migrations/20260915231000_condition_legacy_migration_ledger.sql';
const classifierPath = 'lib/takeoff/conditions/legacyMigration.ts';

test('P0.5E migration ledger is tenant-scoped, classified, auditable, and idempotent', () => {
  assert.equal(existsSync(migrationPath), true, 'P0.5E migration ledger SQL must exist');
  const sql = readFileSync(migrationPath, 'utf8');
  assert.match(sql, /create table public\.condition_legacy_migration_runs/i);
  assert.match(sql, /mode text not null[\s\S]*'dry_run'[\s\S]*'apply'/i);
  assert.match(sql, /create table public\.condition_legacy_migration_items/i);
  assert.match(sql, /'mapped'[\s\S]*'historical_only'[\s\S]*'unsupported_review'[\s\S]*'unreferenced'/i);
  assert.match(sql, /error_text text/i);
  assert.match(sql, /unique\s*\(run_id\s*,\s*object_type\s*,\s*legacy_id\s*\)/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /get_my_company_id\(\)/i);
});

test('legacy migration classification is deterministic for the four governed outcomes', async () => {
  assert.equal(existsSync(classifierPath), true, 'P0.5E legacy migration classifier must exist');
  const { classifyLegacyMigrationCandidate } = await import('../lib/takeoff/conditions/legacyMigration.ts');

  assert.equal(classifyLegacyMigrationCandidate({
    referencedByIssuedHistory: true,
    activeMeasurementRefs: 1,
    templateMappingCount: 10,
    supportedPilotFamily: true,
  }), 'historical_only');

  assert.equal(classifyLegacyMigrationCandidate({
    referencedByIssuedHistory: false,
    activeMeasurementRefs: 1,
    templateMappingCount: 10,
    supportedPilotFamily: true,
  }), 'mapped');

  assert.equal(classifyLegacyMigrationCandidate({
    referencedByIssuedHistory: false,
    activeMeasurementRefs: 1,
    templateMappingCount: 0,
    supportedPilotFamily: false,
  }), 'unsupported_review');

  assert.equal(classifyLegacyMigrationCandidate({
    referencedByIssuedHistory: false,
    activeMeasurementRefs: 0,
    templateMappingCount: 0,
    supportedPilotFamily: false,
  }), 'unreferenced');
});
