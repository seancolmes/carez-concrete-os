import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {signedChangeOrderCost, signedChangeOrderSell} from '../lib/change-orders/contracts.ts';

const migrationPath='supabase/migrations/20260926020000_change_order_contract_recovery.sql';

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

test('Change Order views enforce caller-scoped access and narrow reference grants',()=>{
  const sql=readFileSync(migrationPath,'utf8');
  for(const view of ['change_order_financial_summary','project_authorized_contract_summary','commercial_baseline_item_references'])
    assert.match(sql,new RegExp(`create or replace view public\\.${view} with \\(security_invoker=true\\) as`,'i'));
  assert.match(sql,/create or replace view public\.approved_change_order_references with \(security_barrier=true\) as/i);
  assert.match(sql,/revoke all on public\.change_order_financial_summary,[\s\S]*?from public,anon,authenticated/i);
  assert.match(sql,/grant select on public\.change_order_financial_summary,[\s\S]*?to authenticated/i);
});
