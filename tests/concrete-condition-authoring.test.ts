import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { conditionArchetype } from '../lib/takeoff/conditions/catalog.ts';
import {
  conditionCodeFromName,
  conditionMeasurementMatchesRole,
  prepareConditionAuthoringInputs,
  prepareConditionRoleAssignments,
} from '../lib/takeoff/conditions/authoring.ts';

test('Condition codes stay separate and normalize from the user-facing name', () => {
  assert.equal(conditionCodeFromName('  Slab on Grade — Area A  '), 'SLAB-ON-GRADE-AREA-A');
});

test('primary Condition roles require matching geometry and compatibility assembly', () => {
  const role = conditionArchetype('slab_on_grade').roles.find(item => item.primary)!;
  const measurement = {
    id: 'measurement-1',
    sheet_id: 'sheet-1',
    assembly_version_id: 'assembly-version-1',
    measurement_type: 'area',
    raw_quantity: 720,
    raw_unit: 'SF',
  };
  assert.equal(conditionMeasurementMatchesRole(measurement, role, 'assembly-version-1'), true);
  assert.equal(conditionMeasurementMatchesRole(measurement, role, 'assembly-version-2'), false);
  assert.equal(conditionMeasurementMatchesRole({ ...measurement, measurement_type: 'linear' }, role, 'assembly-version-1'), false);
});

test('secondary roles enforce unit and geometry without forcing the primary assembly', () => {
  const role = conditionArchetype('strip_wall_footing').roles.find(item => item.key === 'anchors_embeds')!;
  const measurement = {
    id: 'measurement-2',
    sheet_id: 'sheet-2',
    assembly_version_id: 'any-ea-version',
    measurement_type: 'count',
    raw_quantity: 14,
    raw_unit: 'EA',
  };
  assert.equal(conditionMeasurementMatchesRole(measurement, role, 'different-primary-version'), true);
  assert.equal(conditionMeasurementMatchesRole({ ...measurement, raw_unit: 'LF' }, role, 'different-primary-version'), false);
});

test('authoring payload omits blank values and records project-value provenance', () => {
  const result = prepareConditionAuthoringInputs({
    planFacts: { width_ft: 2, depth_ft: '', anchor_count_per_lf: 0 },
    commercial: { concrete_waste_pct: 5 },
    drawing: { elevation_reference: 'top' },
  });
  assert.deepEqual(result.inputs, {
    planFacts: { width_ft: 2, anchor_count_per_lf: 0 },
    commercial: { concrete_waste_pct: 5 },
    drawing: { elevation_reference: 'top' },
  });
  assert.equal(result.provenance.planFacts?.width_ft.mode, 'project_value');
  assert.equal(result.provenance.planFacts?.depth_ft, undefined);
});

test('role payload is stable, ordered, and excludes unassigned optional roles', () => {
  const roles = conditionArchetype('strip_wall_footing').roles;
  assert.deepEqual(prepareConditionRoleAssignments(roles, {
    run: 'measurement-lf',
    anchors_embeds: 'measurement-ea',
  }), [
    { roleKey: 'run', roleInstanceKey: 'run-1', measurementId: 'measurement-lf', sortOrder: 10 },
    { roleKey: 'anchors_embeds', roleInstanceKey: 'anchors_embeds-1', measurementId: 'measurement-ea', sortOrder: 30 },
  ]);
});

test('Condition duplication uses one transactional RPC without direct row mutation', () => {
  const action = readFileSync(new URL('../app/takeoff/[setId]/conditionActions.ts', import.meta.url), 'utf8');
  const duplicate = action.slice(action.indexOf('export async function duplicateProjectConcreteConditionPilot'), action.indexOf('export async function deleteProjectConcreteCondition'));
  assert.match(duplicate, /carez_duplicate_project_concrete_condition/);
  assert.equal(duplicate.match(/\.rpc\(/g)?.length, 1);
  assert.doesNotMatch(duplicate, /\.from\(|\.delete\(|\.insert\(/);
  assert.match(duplicate, /copied_measurement_roles: 0/);
  assert.match(duplicate, /copied_outputs: 0/);
});

test('transactional Condition duplication copies modules but no calculated or geometry lineage', () => {
  const migration = readFileSync(new URL('../supabase/migrations/20260920210000_transactional_condition_duplication.sql', import.meta.url), 'utf8');
  assert.match(migration, /carez_duplicate_project_concrete_condition/);
  assert.match(migration, /carez_create_project_concrete_condition/);
  assert.match(migration, /delete from public\.project_condition_module_instances/);
  assert.match(migration, /insert into public\.project_condition_module_instances/);
  assert.match(migration, /auth\.uid\(\)/);
  assert.doesNotMatch(migration, /insert into public\.(project_condition_measurement_roles|project_condition_outputs|project_condition_holds|takeoff_measurements|estimate_items)/);
});
