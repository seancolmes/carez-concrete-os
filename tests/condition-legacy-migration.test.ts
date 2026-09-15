import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  classifyLegacyMigrationCandidate,
  type LegacyMigrationClassification,
} from '../lib/takeoff/conditions/legacyMigration.ts';

const sql = readFileSync('supabase/migrations/20260915231000_condition_legacy_migration_ledger.sql', 'utf8');

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
