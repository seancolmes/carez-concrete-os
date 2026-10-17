import assert from 'node:assert/strict';
import test from 'node:test';
import { conditionArchetype } from '../lib/takeoff/conditions/catalog.ts';
import {
  conditionCodeFromName,
  conditionMeasurementMatchesRole,
  conditionAuthoringInputErrors,
  prepareConditionAuthoringInputs,
  prepareConditionRoleAssignments,
  conditionRoleOccurrences,
  appendConditionRole,
  replaceConditionRole,
  conditionRoleSignature,
  conditionRoleAnchor,
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

test('repeated role occurrences survive an unrelated save and reload without losing keys or order', () => {
  const roles=conditionArchetype('strip_wall_footing').roles;
  const recorded=[{roleKey:'run',roleInstanceKey:'west-footing',measurementId:'west',sortOrder:12},{roleKey:'run',roleInstanceKey:'east-footing',measurementId:'east',sortOrder:27}];
  const loaded=conditionRoleOccurrences(roles,recorded);
  const payload=prepareConditionRoleAssignments(roles,loaded);
  assert.deepEqual(payload,recorded);
  assert.deepEqual(conditionRoleSignature(conditionRoleOccurrences(roles,payload)),conditionRoleSignature(loaded));
  const added=appendConditionRole(loaded,'run','north-footing');
  const linked=replaceConditionRole(added,'run','north-footing','north');
  assert.deepEqual(prepareConditionRoleAssignments(roles,linked).slice(0,2),recorded);
  const unlinked=replaceConditionRole(linked,'run','west-footing','');
  assert.deepEqual(prepareConditionRoleAssignments(roles,unlinked).map(row=>[row.roleInstanceKey,row.measurementId,row.sortOrder]),[['east-footing','east',27],['north-footing','north',added.at(-1)!.sortOrder]]);
  assert.equal(linked[0].measurementId,'west','unlink is a draft assignment change, never a geometry mutation');
});

test('replacing a role does not steal another link and identities include the role key', () => {
  const rows=[{roleKey:'run',roleInstanceKey:'same-key',measurementId:'west',sortOrder:10},{roleKey:'anchors_embeds',roleInstanceKey:'same-key',measurementId:'anchors',sortOrder:20}];
  assert.throws(()=>replaceConditionRole(rows,'run','same-key','anchors'),/already linked/);
  assert.deepEqual(rows.map(row=>row.measurementId),['west','anchors']);
  assert.deepEqual(replaceConditionRole(rows,'run','same-key','east').map(row=>row.measurementId),['east','anchors']);
  assert.throws(()=>prepareConditionRoleAssignments(conditionArchetype('strip_wall_footing').roles,[...rows,{...rows[0],roleInstanceKey:'another'}]),/only once/);
});

test('the persisted compatibility anchor does not become the first or last repeated primary role', () => {
  const roles=conditionArchetype('strip_wall_footing').roles;
  const rows=conditionRoleOccurrences(roles,[{roleKey:'run',roleInstanceKey:'west',measurementId:'west'},{roleKey:'run',roleInstanceKey:'east',measurementId:'east'}]);
  assert.equal(conditionRoleAnchor(rows,roles,'east'),'east');
  assert.equal(conditionRoleAnchor(replaceConditionRole(rows,'run','west','north'),roles,'east'),'east');
  assert.equal(conditionRoleAnchor(replaceConditionRole(rows,'run','east',''),roles,'east'),'');
  assert.equal(conditionRoleAnchor(rows,roles,null),'','missing anchor is never inferred from array order');
});

test('slab base depth rejects explicit zero before saving, matching its typed server contract', () => {
  const inputs = conditionArchetype('slab_on_grade').inputs;
  assert.deepEqual(conditionAuthoringInputErrors(inputs, { planFacts: { base_depth_in: 0 } }), [
    'Base depth must be greater than zero. Leave unused inputs blank.',
  ]);
  assert.deepEqual(conditionAuthoringInputErrors(inputs, { planFacts: { base_depth_in: 4 } }), []);
});

test('cleared optional dimensions remain absent while valid zero quantities remain recorded', () => {
  const draft = { planFacts: { base_depth_in: '' }, commercial: { concrete_waste_pct: 0 } };
  assert.deepEqual(conditionAuthoringInputErrors(conditionArchetype('slab_on_grade').inputs, draft), []);
  assert.deepEqual(prepareConditionAuthoringInputs(draft).inputs, { commercial: { concrete_waste_pct: 0 } });
});

test('authoring preflight rejects nonfinite, fractional integer and out-of-range supplied inputs', () => {
  const inputs = conditionArchetype('slab_on_grade').inputs;
  assert.match(conditionAuthoringInputErrors(inputs, { commercial: { concrete_waste_pct: Infinity } })[0], /finite number/);
  const count = { key: 'count', label: 'Count', group: 'planFacts' as const, valueType: 'integer' as const, minimum: 0, maximum: 2 };
  assert.match(conditionAuthoringInputErrors([count], { planFacts: { count: 1.5 } })[0], /whole number/);
  assert.match(conditionAuthoringInputErrors([count], { planFacts: { count: 3 } })[0], /at most 2/);
  assert.match(conditionAuthoringInputErrors([count], { planFacts: { count: -1 } })[0], /at least 0/);
});
