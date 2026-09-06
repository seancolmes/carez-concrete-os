import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Strip v4 derives run endpoints on the server and never accepts browser endpoint quantity', () => {
  const source = read('lib/takeoff/conditions/persistence.server.ts');
  assert.match(source, /select\('id,takeoff_set_id,sheet_id,assembly_version_id,measurement_type,raw_quantity,raw_unit,geometry,/);
  assert.match(source, /openPolylineEndpointCount\(measurement\.geometry\)/);
  assert.match(source, /roleKey:\s*STRIP_FOOTING_V4_ENDPOINT_ROLE/);
  assert.match(source, /calculationRoles:\s*ConditionMeasurementRole\[]\s*=\s*\[\.\.\.persistedCalculationRoles\]/);
  assert.doesNotMatch(source, /p_measurement_roles:[\s\S]*STRIP_FOOTING_V4_ENDPOINT_ROLE/);
});

test('Strip v4 removes the end_forms drawing role and replaces unit-only EA lookup for new secondary drawings', () => {
  const source = read('components/takeoff/IntegratedTakeoffConditionWorkspace.tsx');
  assert.match(source, /stripV4\?STRIP_FOOTING_V4_DEFINITION/);
  assert.match(source, /COND-STRIP-ANCHOR-EMBED-RUNTIME/);
  assert.match(source, /if\(stripV4\)\{[\s\S]*const code=v4RoleAssemblyCode\(role\);if\(!code\)return null;/);
  assert.match(source, /definition\.roles\.map\(role=>/);
});

test('Strip v4 migration preserves v1-v3 and publishes immutable bulkhead semantics', () => {
  const source = read('supabase/migrations/20260906150633_strip_footing_bulkheads_v4.sql');
  assert.match(source, /version_no=3/);
  assert.match(source, /version_no=4/);
  assert.match(source, /role->>'key'<>'end_forms'/);
  assert.match(source, /bulkhead_count_source/);
  assert.match(source, /bulkhead_explicit_count/);
  assert.match(source, /strip-end-bulkhead-v4/);
  assert.match(source, /carez_ensure_strip_v4_anchor_role_assembly/);
  assert.match(source, /carez_upgrade_strip_condition_draft_to_v4/);
  assert.match(source, /Converted from Strip v3 End forms role/);
});
