import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const migrationPath = 'supabase/migrations/20260921231000_estimate_labor_production_overrides.sql';
const stickyMigrationPath = 'supabase/migrations/20260921231500_labor_rate_selection_sticky_marker.sql';
const helperPath = 'lib/estimating/laborReview.ts';
const componentPath = 'components/estimates/LaborReview.tsx';
const pagePath = 'app/estimates/[estimateId]/page.tsx';
const actionsPath = 'app/estimates/actions.ts';

const requireFile = (path: string, message: string) => {
  assert.equal(existsSync(path), true, message);
  return readFileSync(path, 'utf8');
};

test('P1.3 stores job MH/unit and independent labor-rate selection audit state', () => {
  const sql = requireFile(migrationPath, 'P1.3 labor production override migration must exist');

  for (const table of ['takeoff_measurement_outputs', 'estimate_items']) {
    for (const column of [
      'job_man_hours_per_unit',
      'labor_assumption_override_by',
      'labor_assumption_override_at',
      'labor_rate_override_by',
      'labor_rate_override_at',
    ]) {
      assert.match(sql, new RegExp(`alter table public\\.${table}[\\s\\S]{0,1800}${column}`, 'i'));
    }
  }

  assert.match(sql, /job_man_hours_per_unit[\s\S]{0,500}check[\s\S]{0,300}>=\s*0/i);
});

test('job production override is estimate-scoped, labor-only and cannot accept quantity or direct cost', () => {
  const sql = requireFile(migrationPath, 'P1.3 labor production override migration must exist');
  const signature = sql.match(/create or replace function public\.carez_update_takeoff_labor_assumption\([\s\S]*?\)\s*returns void/i)?.[0] || '';

  assert.match(signature, /p_estimate_id\s+uuid/i);
  assert.match(signature, /p_output_id\s+uuid/i);
  assert.match(signature, /p_man_hours_per_unit\s+numeric/i);
  assert.doesNotMatch(signature, /quantity|direct_cost/i);
  assert.match(sql, /This estimate revision is locked/i);
  assert.match(sql, /does not belong to this estimate/i);
  assert.match(sql, /generated labor output/i);
  assert.match(sql, /Verified Project Concrete Condition labor is immutable/i);
  assert.match(sql, /job_man_hours_per_unit=p_man_hours_per_unit/i);
  assert.match(sql, /estimated_man_hours=v_new_hours/i);
  assert.match(sql, /direct_cost=v_new_direct/i);
  const updateStart = sql.indexOf('create or replace function public.carez_update_takeoff_labor_assumption');
  const updateEnd = sql.indexOf('create or replace function public.carez_restore_takeoff_labor_assumption', updateStart);
  const updateFunction = sql.slice(updateStart, updateEnd);
  assert.match(updateFunction, /update public\.estimate_items[\s\S]{0,2200}job_man_hours_per_unit=p_man_hours_per_unit/i);
  assert.match(updateFunction, /update public\.project_condition_outputs[\s\S]{0,2600}'labor_assumption'/i);
  assert.doesNotMatch(updateFunction, /production_quantity\s*=/i);
});

test('restore baseline is explicit and leaves physical quantity authoritative', () => {
  const sql = requireFile(migrationPath, 'P1.3 labor production override migration must exist');
  const signature = sql.match(/create or replace function public\.carez_restore_takeoff_labor_assumption\([\s\S]*?\)\s*returns void/i)?.[0] || '';

  assert.match(signature, /p_estimate_id\s+uuid/i);
  assert.match(signature, /p_output_id\s+uuid/i);
  assert.doesNotMatch(signature, /quantity|man_hours_per_unit|direct_cost/i);
  assert.match(sql, /job_man_hours_per_unit=null/i);
  assert.match(sql, /labor_assumption_override_by=null/i);
  assert.match(sql, /labor_assumption_override_at=null/i);
  assert.match(sql, /coalesce\(v_output\.baseline_man_hours_per_unit,0\)/i);
});

test('labor rate profile selection is independent from production quantity and MH/unit', () => {
  const sql = requireFile(migrationPath, 'P1.3 labor production override migration must exist');
  const signature = sql.match(/create or replace function public\.carez_select_takeoff_labor_profile\([\s\S]*?\)\s*returns void/i)?.[0] || '';

  assert.match(signature, /p_estimate_id\s+uuid/i);
  assert.match(signature, /p_output_id\s+uuid/i);
  assert.match(signature, /p_labor_profile_id\s+uuid/i);
  assert.doesNotMatch(signature, /quantity|man_hours_per_unit|direct_cost/i);
  assert.match(sql, /price_source_kind='labor_profile'/i);
  assert.match(sql, /price_source_id=p_labor_profile_id/i);
  assert.match(sql, /labor_rate_override_by=auth\.uid\(\)/i);
  const profileStart = sql.indexOf('create or replace function public.carez_select_takeoff_labor_profile');
  const profileEnd = sql.indexOf('revoke all on function public.carez_update_takeoff_labor_assumption', profileStart);
  const profileFunction = sql.slice(profileStart, profileEnd);
  assert.doesNotMatch(profileFunction, /(production_quantity|job_man_hours_per_unit)\s*=/i);
});

test('Takeoff resync preserves explicit job MH/unit and explicit labor profile selections', () => {
  const primarySql = requireFile(migrationPath, 'P1.3 labor production override migration must exist');
  const stickySql = requireFile(stickyMigrationPath, 'P1.3 sticky labor-rate follow-up migration must exist');
  const syncStart = primarySql.indexOf('create or replace function public.carez_sync_takeoff_measurement_outputs');
  const syncEnd = primarySql.indexOf('create or replace function public.carez_update_takeoff_labor_assumption', syncStart);
  const sync = primarySql.slice(syncStart, syncEnd);

  assert.match(sync, /job_man_hours_per_unit/i);
  assert.match(sync, /labor_assumption_override_by/i);
  assert.match(sync, /labor_rate_override_by/i);
  assert.match(sync, /v_hours:=round\(v_qty\*v_job_man_hours_per_unit,4\)/i);
  assert.match(stickySql, /v_output\.labor_rate_override_at is not null/i);
  assert.match(stickySql, /v_unit_cost:=greatest\(coalesce\(v_output\.unit_cost,0\),0\)/i);
});

test('labor review summary distinguishes baseline, overrides and holds', async () => {
  requireFile(helperPath, 'P1.3 labor review helper must exist');
  const { getLaborReviewSummary, getEffectiveManHoursPerUnit } = await import('../lib/estimating/laborReview.ts');

  assert.equal(getEffectiveManHoursPerUnit({ baseline_man_hours_per_unit: 0.12, job_man_hours_per_unit: null }), 0.12);
  assert.equal(getEffectiveManHoursPerUnit({ baseline_man_hours_per_unit: 0.12, job_man_hours_per_unit: 0.15 }), 0.15);

  const summary = getLaborReviewSummary([
    {
      estimate_item_type: 'labor',
      estimated_man_hours: 12,
      direct_cost: 600,
      baseline_man_hours_per_unit: 0.12,
      job_man_hours_per_unit: null,
      pricing_status: 'priced',
    },
    {
      estimate_item_type: 'labor',
      estimated_man_hours: 20,
      direct_cost: 1100,
      baseline_man_hours_per_unit: 0.1,
      job_man_hours_per_unit: 0.14,
      pricing_status: 'priced',
    },
    {
      estimate_item_type: 'labor',
      estimated_man_hours: 4,
      direct_cost: 0,
      baseline_man_hours_per_unit: 0.2,
      job_man_hours_per_unit: null,
      pricing_status: 'missing_labor_rate',
    },
    {
      estimate_item_type: 'labor',
      estimated_man_hours: 0,
      direct_cost: 0,
      baseline_man_hours_per_unit: null,
      job_man_hours_per_unit: null,
      pricing_status: 'not_priced',
    },
    { estimate_item_type: 'material', estimated_man_hours: 0, direct_cost: 50 },
  ]);

  assert.deepEqual(summary, {
    operations: 4,
    totalManHours: 36,
    totalDirectCost: 1700,
    jobOverrides: 1,
    missingLaborRate: 1,
    missingAssumption: 1,
  });
});

test('Estimate Labor workspace exposes production assumption and rate provenance without quantity editing', () => {
  const component = requireFile(componentPath, 'P1.3 LaborReview component must exist');
  const page = requireFile(pagePath, 'Estimate page must exist');
  const actions = requireFile(actionsPath, 'Estimate actions must exist');

  for (const phrase of [
    'Labor review',
    'Baseline MH / unit',
    'Job MH / unit',
    'Estimated MH',
    'Burdened rate',
    'Direct Cost',
    'Job override',
    'Restore baseline',
    'Missing labor rate',
  ]) assert.match(component, new RegExp(phrase, 'i'));

  assert.doesNotMatch(component, /name="(?:quantity|production_quantity|direct_cost)"/i);

  for (const column of [
    'job_man_hours_per_unit',
    'labor_assumption_override_by',
    'labor_assumption_override_at',
    'labor_rate_override_by',
    'labor_rate_override_at',
  ]) assert.match(page, new RegExp(column));

  assert.match(page, /estimating_labor_profiles/);
  assert.match(page, /<LaborReview/);

  for (const action of [
    'updateGeneratedLaborAssumption',
    'restoreGeneratedLaborAssumption',
    'selectGeneratedLaborProfile',
  ]) assert.match(actions, new RegExp(`export async function ${action}`));

  assert.match(actions, /carez_update_takeoff_labor_assumption/);
  assert.match(actions, /carez_restore_takeoff_labor_assumption/);
  assert.match(actions, /carez_select_takeoff_labor_profile/);
  assert.doesNotMatch(actions.slice(actions.indexOf('export async function updateGeneratedLaborAssumption')), /fd\.get\(['"](?:quantity|production_quantity|direct_cost)['"]\)/);
});
