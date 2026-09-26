import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import test from 'node:test';
import {signedChangeOrderCost, signedChangeOrderSell} from '../lib/change-orders/contracts.ts';

const migrationPath='supabase/migrations/20260926020000_change_order_contract_recovery.sql';
const referenceMigrationPath='supabase/migrations/20260926080000_change_order_reference_rpc.sql';

test('Change Order signs keep physical quantity separate from Sell and Direct Cost direction',()=>{
  assert.equal(signedChangeOrderSell('deductive',125),-125);
  assert.equal(signedChangeOrderSell('additive',125),125);
  assert.equal(signedChangeOrderSell('no_cost',125),0);
  assert.equal(signedChangeOrderCost('cost',40),40);
  assert.equal(signedChangeOrderCost('credit',40),-40);
});

test('Change Order migration captures immutable tenant-scoped approval lineage',()=>{
  const sql=readFileSync(migrationPath,'utf8');
  for(const object of ['change_orders','change_order_items','change_order_events','approved_commercial_deltas','approved_commercial_delta_items'])
    assert.match(sql,new RegExp(`create table public\\.${object}\\s*\\([\\s\\S]*?company_id uuid`,'i'));
  assert.match(sql,/approve_change_order\(p_change_order_id uuid\)[\s\S]*?security definer[\s\S]*?auth\.uid\(\)[\s\S]*?for update/i);
  assert.match(sql,/unique\s*\(company_id\s*,\s*change_order_id\)/i);
  assert.match(sql,/p\.role in \('owner','office'\)/i);
  assert.match(sql,/commercial_baselines[\s\S]*?total_sell/i);
  assert.match(sql,/original Commercial Baseline/i);
  assert.match(sql,/create trigger projects_preserve_awarded_contract_value[\s\S]*?carez_preserve_awarded_project_contract_value/i);
  assert.match(sql,/Original Award contract_value is immutable/i);
});

test('Change Order pricing views enforce caller-scoped access',()=>{
  const sql=readFileSync(migrationPath,'utf8');
  for(const view of ['change_order_financial_summary','project_authorized_contract_summary','commercial_baseline_item_references'])
    assert.match(sql,new RegExp(`create or replace view public\\.${view} with \\(security_invoker=true\\) as`,'i'));
});

test('approved operational references use an authenticated tenant-scoped RPC instead of a definer view',()=>{
  assert.ok(existsSync(referenceMigrationPath),'additive reference RPC migration is missing');
  const sql=readFileSync(referenceMigrationPath,'utf8');
  assert.match(sql,/drop view public\.approved_change_order_references/i);
  assert.match(sql,/create or replace function public\.carez_list_approved_change_order_references\(p_project_id uuid default null\)[\s\S]*?returns table\s*\(\s*id uuid,\s*project_id uuid,\s*co_number text,\s*title text,\s*status text,\s*field_work_status text\s*\)/i);
  assert.match(sql,/security definer\s+set search_path=pg_catalog,public/i);
  assert.match(sql,/auth\.uid\(\) is null/i);
  assert.match(sql,/public\.carez_commercial_actor_company\(\)/i);
  assert.match(sql,/p\.id=p_project_id and p\.company_id=v_company/i);
  assert.match(sql,/co\.company_id=v_company[\s\S]*?co\.status='approved'/i);
  assert.match(sql,/revoke all on function public\.carez_list_approved_change_order_references\(uuid\) from public,anon/i);
  assert.match(sql,/grant execute on function public\.carez_list_approved_change_order_references\(uuid\) to authenticated/i);
  assert.doesNotMatch(sql,/create (?:or replace )?view public\.approved_change_order_references/i);

  for(const file of ['app/field/actions.ts','app/pour-control/actions.ts','app/pour-control/page.tsx']) {
    const source=readFileSync(file,'utf8');
    assert.match(source,/\.rpc\('carez_list_approved_change_order_references'/i);
    assert.doesNotMatch(source,/\.from\('approved_change_order_references'\)/i);
  }
  const fixture=readFileSync('tests/fixtures/commercial-foundation-runtime.sql','utf8');
  assert.match(fixture,/carez_list_approved_change_order_references/i);
  assert.match(fixture,/approved_change_order_references view was not removed/i);
});
