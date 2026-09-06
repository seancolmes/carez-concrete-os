import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync('supabase/migrations/20260906102000_strip_footing_form_resources_v5.sql', 'utf8');
const actions = readFileSync('app/takeoff/[setId]/conditionActions.ts', 'utf8');
const editor = readFileSync('components/takeoff/ConditionModuleEditor.tsx', 'utf8');
const schema = readFileSync('lib/takeoff/conditions/moduleSchema.ts', 'utf8');
const calculator = readFileSync('lib/takeoff/conditions/stripFootingV4.ts', 'utf8');

test('Strip v5 migration publishes physical form-board schema without mutating v4', () => {
  assert.match(migration, /version_no=4/);
  assert.match(migration, /version_no=5/);
  assert.match(migration, /form_resource_model/);
  assert.match(migration, /physical_boards_v5/);
  assert.match(migration, /form_board_size/);
  assert.match(migration, /form_board_custom_course_height_in/);
  assert.match(migration, /input->>'key'<>'form_material_factor_lf_per_lf'/);
  assert.match(migration, /carez_ensure_strip_footing_v5_template/);
  assert.match(migration, /carez_upgrade_strip_condition_draft_to_v5/);
});

test('new and upgraded Strip Conditions route to v5', () => {
  assert.match(actions, /carez_ensure_strip_footing_v5_template/);
  assert.match(actions, /carez_upgrade_strip_condition_draft_to_v5/);
  assert.doesNotMatch(actions, /carez_upgrade_strip_condition_draft_to_v4/);
});

test('v5 form editor uses the physical schema and hides implementation marker', () => {
  assert.match(editor, /STRIP_FOOTING_V5_DEFINITION/);
  assert.match(editor, /STRIP_FOOTING_V5_RESOURCE_MODEL/);
  assert.match(schema, /field\.key === 'form_resource_model'\) return false/);
  assert.match(schema, /field\.key === 'form_board_size'/);
  assert.match(schema, /form_board_custom_course_height_in/);
});

test('v5 runtime derives form board courses instead of consuming a user LF\/LF factor', () => {
  assert.match(calculator, /PHYSICAL_FORM_BOARD_RESOURCE_MODEL/);
  assert.match(calculator, /form_material_factor_lf_per_lf: 1/);
  assert.match(calculator, /Math\.ceil\(\(depthFt \* 12\) \/ courseHeightIn\)/);
  assert.match(calculator, /forms\.form_board_courses/);
  assert.match(calculator, /forms\.formed_edge_lf/);
  assert.match(calculator, /strip-form-board-installed-v5/);
});
