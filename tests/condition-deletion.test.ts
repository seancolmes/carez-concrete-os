import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync('supabase/migrations/20260905162500_condition_draft_deletion.sql', 'utf8');
const actions = readFileSync('app/takeoff/[setId]/conditionActions.ts', 'utf8');
const manager = readFileSync('components/takeoff/ConditionDeletionManager.tsx', 'utf8');
const shell = readFileSync('components/takeoff/TakeoffConditionWorkflowShell.tsx', 'utf8');

test('draft Condition deletion preserves verified and issued history', () => {
  assert.match(migration, /carez_delete_project_concrete_condition/);
  assert.match(migration, /version\.status = 'verified'/);
  assert.match(migration, /Verified Concrete Conditions are immutable/);
  assert.match(migration, /proposal_presentations/);
  assert.match(migration, /accepted','approved','superseded/);
  assert.match(migration, /p_delete_linked_measurements boolean default true/);
});

test('Condition deletion removes dependent records in dependency-safe order and preserves shared takeoffs', () => {
  const outputDelete = migration.indexOf('delete from public.project_condition_outputs output', migration.indexOf('carez_delete_project_concrete_condition'));
  const roleDelete = migration.indexOf('delete from public.project_condition_measurement_roles role', migration.indexOf('carez_delete_project_concrete_condition'));
  const versionDelete = migration.indexOf('delete from public.project_concrete_condition_versions version', migration.indexOf('carez_delete_project_concrete_condition'));
  assert.ok(outputDelete >= 0 && roleDelete > outputDelete && versionDelete > roleDelete);
  assert.match(migration, /Never delete geometry still used by another Condition/);
  assert.match(migration, /preserved_measurements/);
  assert.match(migration, /carez_delete_takeoff_measurement\(v_measurement_id\)/);
});

test('deleting a Condition-linked takeoff invalidates stale Condition projections before deleting geometry', () => {
  const measurementFunction = migration.slice(0, migration.indexOf('create or replace function public.carez_delete_project_concrete_condition'));
  assert.match(measurementFunction, /project_condition_measurement_roles/);
  assert.match(measurementFunction, /delete from public.project_condition_outputs output/);
  assert.match(measurementFunction, /generated_estimate_item_id/);
  assert.match(measurementFunction, /compatibility_anchor_measurement_id/);
  assert.match(measurementFunction, /compatibility_projection_version_id = null/);
});

test('Condition-first UI exposes guarded draft deletion and resets stale drawing selection after cascade delete', () => {
  assert.match(actions, /export async function deleteProjectConcreteCondition/);
  assert.match(actions, /carez_delete_project_concrete_condition/);
  assert.match(shell, /ConditionDeletionManager/);
  assert.match(manager, /Delete Condition \+ takeoffs/);
  assert.match(manager, /Takeoffs shared with another Condition are preserved/);
  assert.match(manager, /row\.version_status === 'draft'/);
  assert.match(manager, /Delete draft Condition\?/);
  assert.match(manager, /<Select /);
  assert.match(manager, /window\.location\.reload\(\)/);
  assert.doesNotMatch(manager, /DropdownMenu/);
  assert.doesNotMatch(manager, /<select/);
});
