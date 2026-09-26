import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const migration = fs.readFileSync('supabase/migrations/20260926220000_acceptance_resolution_contract.sql', 'utf8');

test('acceptance resolution stores the complete Issue #28 decision vocabulary', () => {
  assert.match(migration, /create table public\.proposal_acceptance_resolutions/i);
  for (const value of ['full', 'partial', 'negotiated']) assert.match(migration, new RegExp(`'${value}'`));
  for (const key of ['alternate_resolution', 'allowances', 'unit_prices', 'inclusions', 'exclusions', 'clarifications', 'terms', 'evidence']) {
    assert.match(migration, new RegExp(key));
  }
  assert.match(migration, /proposal_acceptance_resolutions_immutable/i);
  assert.match(migration, /company_id.*proposal_revision_id/i);
});

test('acceptance resolution is created through a tenant-scoped guarded RPC', () => {
  assert.match(migration, /create or replace function public\.carez_resolve_proposal_acceptance/i);
  assert.match(migration, /get_my_company_id\(\)/i);
  assert.match(migration, /auth\.uid\(\)/i);
  assert.match(migration, /for update/i);
  assert.match(migration, /evidence/i);
  assert.match(migration, /proposal_acceptance_resolutions[\s\S]*unique/i);
  assert.match(migration, /grant execute on function public\.carez_resolve_proposal_acceptance/i);
  assert.match(migration, /carez_get_proposal_acceptance_facts/i);
  assert.match(migration, /carez_award_proposal_and_create_project[\s\S]*effective_sell/i);
});
