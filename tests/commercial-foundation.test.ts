import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const migration=readFileSync('supabase/migrations/20260926010000_job_spine_award_foundation.sql','utf8');
const proposalPage=readFileSync('app/proposals/[estimateId]/page.tsx','utf8');
const proposalActions=readFileSync('app/proposals/actions.ts','utf8');
const publicActions=readFileSync('app/proposal/[token]/actions.ts','utf8');
const projectPage=readFileSync('app/projects/[id]/page.tsx','utf8');

test('commercial handoff owns a tenant-scoped Job Spine across existing V1 phases',()=>{
  for(const table of ['job_spines','job_spine_migration_reviews','award_decisions','accepted_scope_snapshots','accepted_scope_snapshot_items','commercial_baselines','commercial_baseline_items']){
    assert.match(migration,new RegExp(`create table public\\.${table}\\s*\\([\\s\\S]*?company_id uuid`, 'i'));
    assert.match(migration,new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
  }
  for(const phase of ['leads','estimates','proposal_presentations','projects']) assert.match(migration,new RegExp(`alter table public\\.${phase} add column job_spine_id uuid`,'i'));
  assert.match(migration,/No trustworthy Opportunity relationship existed during backfill/);
  assert.match(migration,/No unambiguous source Estimate relationship existed during backfill/);
  assert.match(migration,/leads_assign_job_spine[\s\S]*estimates_assign_job_spine[\s\S]*projects_assign_job_spine/);
});

test('issued customer evidence and frozen internal commercial evidence have separate immutable authority',()=>{
  assert.match(migration,/internal_commercial_snapshot jsonb/);
  assert.match(migration,/carez_capture_proposal_commercial_snapshot[\s\S]*financial_summary[\s\S]*measurement_outputs[\s\S]*condition_outputs/);
  assert.match(migration,/carez_protect_proposal_commercial_snapshot[\s\S]*internal_commercial_snapshot is distinct from old\.internal_commercial_snapshot/);
  assert.match(migration,/if new\.internal_commercial_snapshot is distinct from old\.internal_commercial_snapshot[\s\S]*raise exception 'Issued Proposal commercial evidence and lineage are immutable\.'/);
  assert.doesNotMatch(migration,/old\.internal_commercial_snapshot is not null and new\.internal_commercial_snapshot is distinct from old\.internal_commercial_snapshot/);
  assert.match(migration,/Historical customer acceptance has no trustworthy frozen internal cost and production evidence; award is held/);
  assert.match(migration,/Award held: this historical Proposal has no trustworthy frozen internal cost and production evidence/);
  assert.match(migration,/source_fingerprint text not null/);
  assert.match(migration,/total_direct_cost numeric not null, total_sell numeric not null/);
});

test('award is exact-revision, full-scope, internal, transactional and idempotent',()=>{
  assert.match(migration,/award_type text not null default 'full_exact_revision' check\(award_type='full_exact_revision'\)/);
  assert.match(migration,/unique\(company_id,proposal_revision_id\)/);
  assert.match(migration,/carez_award_proposal_and_create_project[\s\S]*security definer[\s\S]*auth\.uid\(\)[\s\S]*get_my_company_id\(\)[\s\S]*for update/);
  assert.match(migration,/if exists\(select 1 from public\.award_decisions[\s\S]*already_awarded/);
  assert.match(migration,/insert into public\.accepted_scope_snapshots[\s\S]*v_facts->'items'/);
  assert.match(migration,/insert into public\.commercial_baselines[\s\S]*'accepted_scope_snapshot'/);
  assert.match(migration,/p\.base_sell_price/);
  assert.match(migration,/carez_get_proposal_award_hold[\s\S]*options[\s\S]*alternates/);
  assert.match(migration,/revoke all on public\.award_decisions[\s\S]*commercial_baseline_items from public,anon,authenticated/);
  assert.match(migration,/grant execute on function public\.carez_award_proposal_and_create_project\(uuid,timestamptz,text\) to authenticated/);
  assert.doesNotMatch(publicActions,/carez_award_proposal_and_create_project/);
});

test('next revision copies editable pricing and scope with origin references while starting in draft',()=>{
  assert.match(migration,/parent_proposal_revision_id uuid/);
  assert.match(migration,/e\.name,'draft',v_version/);
  assert.match(migration,/revision_source_estimate_item_id uuid references/);
  assert.match(migration,/revision_source_takeoff_output_id uuid references/);
  assert.match(migration,/revision_source_takeoff_measurement_id uuid references/);
  assert.match(migration,/values\(v_company,v_new_estimate[\s\S]*null,null[\s\S]*v_item\.id,v_item\.source_takeoff_output_id,v_item\.source_takeoff_measurement_id/);
  assert.match(migration,/approval_required,'suggested'/);
  assert.match(migration,/create or replace function public\.carez_create_next_proposal_revision[\s\S]*parent_proposal_revision_id/);
  assert.match(proposalActions,/createNextProposalRevision[\s\S]*carez_create_next_proposal_revision/);
  assert.match(proposalPage,/action=\{createNextProposalRevision\}/);
});

test('Project exposes the exact awarded Proposal, snapshot and separate Direct Cost and Sell baseline',()=>{
  assert.match(projectPage,/Commercial handoff lineage/);
  assert.match(projectPage,/proposal_revision_id/);
  assert.match(projectPage,/accepted_scope_snapshot_id/);
  assert.match(projectPage,/total_direct_cost/);
  assert.match(projectPage,/total_sell/);
});
