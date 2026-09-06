import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync('supabase/migrations/20260906054504_condition_repeatable_module_commit.sql', 'utf8');
const workspace = readFileSync('components/takeoff/IntegratedTakeoffConditionWorkspace.tsx', 'utf8');

test('atomic Condition commit keeps one default module while allowing governed repeatable instances', () => {
  assert.match(migration, /exactly one default instance for every published module/);
  assert.match(migration, /count\(distinct \(item->>'module_key'\) \|\| ':' \|\| \(item->>'instance_key'\)\)/);
  assert.match(migration, /coalesce\(\(definition->>'repeatable'\)::boolean,false\)/);
  assert.match(migration, /only explicit instances for repeatable modules/);
  assert.match(migration, /security-invoker behavior/);
});

test('drawing a Condition role binds only the newly created matching measurement into the working draft', () => {
  assert.match(workspace, /type PendingRoleDraw=/);
  assert.match(workspace, /pendingRoleDrawRef=useRef<PendingRoleDraw\|null>/);
  assert.match(workspace, /existingMeasurementIds:new Set\(measurements\.map/);
  assert.match(workspace, /!pending\.existingMeasurementIds\.has\(String\(measurement\.id\)\)/);
  assert.match(workspace, /conditionMeasurementMatchesRole\(measurement,role,compatibilityAssemblyVersionId\)/);
  assert.match(workspace, /if\(candidates\.length!==1\)return/);
  assert.match(workspace, /next\[role\.key\]=measurementId/);
  assert.match(workspace, /assigned · save & recalculate/);
});
