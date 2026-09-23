import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const migrationPath = 'supabase/migrations/20260923120000_reconcile_proposal_conversion_schema.sql';

const requireMigration = () => {
  assert.equal(existsSync(migrationPath), true, 'Proposal schema reconciliation migration must exist');
  return readFileSync(migrationPath, 'utf8');
};

test('proposal schema reconciliation restores only the missing historical proposal contract', () => {
  const sql = requireMigration();

  for (const table of [
    'proposal_access_tokens',
    'proposal_acceptances',
    'proposal_settings',
    'proposal_clarifications',
    'proposal_engagement_events',
  ]) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}`, 'i'));
  }

  assert.doesNotMatch(sql, /create table if not exists public\.proposal_presentations/i);
  assert.match(sql, /alter table public\.proposal_presentations enable row level security/i);
  assert.match(sql, /proposal_presentations[\s\S]*foreign key \(proposal_access_token_id\)[\s\S]*proposal_access_tokens\(id\)/i);
});

test('proposal reconciliation preserves the historical public proposal behavior surface', () => {
  const sql = requireMigration();

  for (const fn of [
    'protect_proposal_presentation_snapshot',
    'sync_proposal_token_revocation',
    'get_public_proposal',
    'track_public_proposal_view',
    'submit_public_proposal_response',
    'accept_public_proposal',
    'create_estimate_revision',
  ]) {
    assert.match(sql, new RegExp(`create or replace function public\\.${fn}`, 'i'));
  }

  assert.match(sql, /create or replace view public\.proposal_conversion_queue/i);
  assert.match(sql, /Sent proposal snapshot cannot be rewritten\. Create a proposal revision instead\./i);
  assert.match(sql, /interval '15 minutes'/i);
  assert.match(sql, /insert into public\.proposal_acceptances/i);
  assert.match(sql, /status='accepted'/i);
  assert.match(sql, /status=case when status='accepted' then status else 'superseded' end/i);
});

test('proposal reconciliation keeps tenant/RLS boundaries and current application columns', () => {
  const sql = requireMigration();

  assert.match(sql, /proposal_access_tokens[\s\S]*proposal_number text/i);
  assert.match(sql, /proposal_settings[\s\S]*schedule_summary text[\s\S]*payment_summary text[\s\S]*terms_text text/i);
  assert.match(sql, /proposal_engagement_events[\s\S]*handled_at timestamptz[\s\S]*handled_by uuid/i);
  assert.match(sql, /public\.get_my_company_id\(\)/i);
  assert.match(sql, /public\.get_my_role\(\)[\s\S]*<>\s*'employee'/i);
  assert.match(sql, /grant select,insert,update,delete on public\.proposal_settings/i);
  assert.match(sql, /grant select on public\.proposal_conversion_queue to authenticated/i);
});
