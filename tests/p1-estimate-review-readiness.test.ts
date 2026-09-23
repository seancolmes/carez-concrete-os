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
