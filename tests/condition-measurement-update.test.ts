import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { persistDrawingMeasurementWithConditions } from '../lib/takeoff/conditions/measurementPersistence.ts';
import { projectConditionWorksheet } from '../lib/takeoff/conditionWorksheet.ts';

function client(projected = ['v1'], failQuery = false) {
  return { from(table: string) {
    const filters: Record<string, unknown> = {};
    const query: any = {
      select() { return query; },
      eq(key: string, value: unknown) { filters[key] = value; return query; },
      in() { return query; },
      then(resolve: (value: any) => void) {
        assert.equal(filters.company_id, 'tenant');
        const data = table === 'project_condition_measurement_roles'
          ? [{ condition_version_id: 'v1' }, { condition_version_id: 'v2' }]
          : table === 'project_concrete_condition_versions'
            ? [{ id: 'v1' }, { id: 'v2' }]
            : projected.map(id => ({ compatibility_projection_version_id: id }));
        resolve({ data, error: failQuery ? { message: 'lookup failed' } : null });
      },
    };
    return query;
  } };
}

test('4.43 → 13.72 edit recalculates the former projection after authoritative persistence', async () => {
  let quantity = 4.43;
  const events: string[] = [];
  const result = await persistDrawingMeasurementWithConditions({
    supabase: client(), companyId: 'tenant', measurementId: 'run',
    persistMeasurement: async () => { quantity = 13.72; events.push('persist'); },
    recalculateCondition: async id => { assert.equal(quantity, 13.72); events.push(id); },
  });
  assert.deepEqual(events, ['persist', 'v1']); // Shared unprojected v2 cannot claim ownership.
  assert.deepEqual(result.pendingConditionVersionIds, []);
});

test('failed automatic calculation preserves the save and refreshable uncalculated state', async () => {
  let outputs: any[] = [{ production_quantity: 4.43 }];
  const result = await persistDrawingMeasurementWithConditions({
    supabase: client(['v1', 'v2']), companyId: 'tenant', measurementId: 'run',
    persistMeasurement: async () => { outputs = []; },
    recalculateCondition: async id => { if (id === 'v1') throw new Error('concurrent edit'); },
  });
  assert.deepEqual(result.pendingConditionVersionIds, ['v1']);
  const worksheet = projectConditionWorksheet({ measurementId: 'run', conditionVersionId: 'v1', conditionName: 'Strip', calculated: outputs.length > 0, outputs, holds: [] });
  assert.equal(worksheet.status, 'Not calculated');
  assert.equal(worksheet.concrete, '—');
  assert.equal(worksheet.cost, 0);
});

test('rejected persistence or tenant lookup never starts recalculation', async () => {
  for (const failQuery of [false, true]) {
    await assert.rejects(persistDrawingMeasurementWithConditions({
      supabase: client(['v1'], failQuery), companyId: 'tenant', measurementId: 'run',
      persistMeasurement: async () => { assert.equal(failQuery, false); throw new Error('verified'); },
      recalculateCondition: async () => { assert.fail('must not recalculate'); },
    }), failQuery ? /lookup failed/ : /verified/);
  }
});

test('uncalculated shared drafts remain uncalculated after geometry persistence', async () => {
  let saved = false;
  await persistDrawingMeasurementWithConditions({
    supabase: client([]), companyId: 'tenant', measurementId: 'run',
    persistMeasurement: async () => { saved = true; },
    recalculateCondition: async () => { assert.fail('must preserve projection ownership'); },
  });
  assert.equal(saved, true);
});

const migration = readFileSync('supabase/migrations/20260907004754_condition_measurement_invalidation.sql', 'utf8');
test('measurement action uses the existing server calculator and transactional invalidation RPC', () => {
  const actions = readFileSync('app/takeoff/[setId]/actions.ts', 'utf8');
  assert.match(actions, /persistDrawingMeasurementWithConditions\(/);
  assert.match(actions, /prepareConcreteConditionPilotPersistence\(/);
  assert.match(actions, /carez_commit_project_condition_calculation/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /version.status = 'verified'/);
  assert.match(migration, /cardinality\(v_version_ids\) = 0/);
  assert.doesNotMatch(migration, /delete from public\.(takeoff_measurements|project_condition_measurement_roles)/);
});

// Optional PostgreSQL runtime without adding a product dependency. Supply an
// installed @electric-sql/pglite module path to execute the real PL/pgSQL RPC.
const pgModule = process.env.CAREZ_TEST_PGLITE_PATH;
test('PostgreSQL regression: transactional invalidation, shared roles, RLS, history and rollback', { skip: !pgModule }, async () => {
  const { PGlite } = await import(pgModule!);
  const db = new PGlite();
  const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
  try {
    await db.exec(readFileSync('tests/fixtures/condition-measurement-update.sql', 'utf8'));
    const predecessor = readFileSync('supabase/migrations/20260831012827_takeoff_scale_regions.sql', 'utf8');
    const oldRpc = predecessor.slice(predecessor.indexOf('create function public.carez_update_drawing_measurement('), predecessor.indexOf('create or replace function public.carez_save_takeoff_sheet_calibration('));
    await db.exec(oldRpc);
    const guards = readFileSync('supabase/migrations/20260904135826_condition_persistence_reconciliation.sql', 'utf8');
    await db.exec(guards.slice(guards.indexOf('create or replace function public.carez_guard_project_condition_child()'), guards.indexOf('create or replace function public.carez_validate_project_condition_measurement_role()')));
    await db.exec(`create trigger output_guard before delete on project_condition_outputs for each row execute function carez_guard_project_condition_child(); create trigger hold_guard before delete on project_condition_holds for each row execute function carez_guard_project_condition_child();`);
    const reset = async () => {
      await db.exec(`reset role; truncate estimates,proposal_presentations,takeoff_measurements,takeoff_scale_regions,project_concrete_condition_versions,project_concrete_conditions,project_condition_measurement_roles,estimate_items,takeoff_measurement_outputs,project_condition_outputs,project_condition_holds,test_sync_calls cascade;
        insert into estimates values ('${id(20)}','${id(10)}','draft');
        insert into takeoff_scale_regions values ('${id(30)}','${id(10)}','${id(40)}',true,'{}');
        insert into takeoff_measurements values ('${id(50)}','${id(10)}','${id(20)}','drawing','${id(40)}','${id(30)}',4.43,'LF','{}','{}','2026-09-01');
        insert into project_concrete_conditions values ('${id(60)}','${id(10)}','${id(70)}',now());
        insert into project_concrete_condition_versions values ('${id(70)}','${id(10)}','${id(60)}','draft','${id(51)}','2026-09-01');
        insert into project_condition_measurement_roles values ('${id(80)}','${id(10)}','${id(70)}','${id(50)}');
        insert into estimate_items values ('${id(90)}','${id(10)}','${id(100)}');
        insert into takeoff_measurement_outputs values ('${id(100)}','${id(10)}','${id(51)}','{"condition_version_id":"${id(70)}"}','${id(90)}');
        insert into project_condition_outputs values ('${id(110)}','${id(10)}','${id(70)}','${id(100)}','${id(90)}');
        insert into project_condition_holds values ('${id(120)}','${id(10)}','${id(70)}');
        set role authenticated;`);
    };
    const update = (measurement = id(50)) => db.query(`select carez_update_drawing_measurement($1,'{"points":[]}',13.72,'LF','{}','[]',$2)`, [measurement, id(30)]);
    const count = async (table: string) => Number((await db.query(`select count(*) as n from ${table}`)).rows[0].n);
    await reset();
    await update();
    // Reproduce the exact pre-fix split: geometry changed, Condition stayed ready.
    assert.equal(Number((await db.query('select raw_quantity from takeoff_measurements')).rows[0].raw_quantity), 13.72);
    assert.equal(await count('project_condition_outputs'), 1);
    await db.exec('reset role');
    await db.exec(migration);
    await reset();
    // A second draft shares the geometry; its output must also be invalidated.
    await db.exec(`insert into project_concrete_condition_versions values ('${id(71)}','${id(10)}','${id(61)}','draft',null,now()); insert into project_condition_measurement_roles values ('${id(81)}','${id(10)}','${id(71)}','${id(50)}'); insert into project_condition_outputs values ('${id(111)}','${id(10)}','${id(71)}',null,null);`);
    await update();
    for (const table of ['project_condition_outputs', 'project_condition_holds', 'takeoff_measurement_outputs', 'estimate_items', 'test_sync_calls']) assert.equal(await count(table), 0, table);
    assert.equal(await count('project_condition_measurement_roles'), 2);
    assert.equal(await count('takeoff_measurements'), 1);
    assert.equal((await db.query('select compatibility_projection_version_id from project_concrete_conditions')).rows[0].compatibility_projection_version_id, null);
    assert.equal(Number((await db.query('select raw_quantity from takeoff_measurements')).rows[0].raw_quantity), 13.72);
    assert.equal((await db.query(`select compatibility_anchor_measurement_id from project_concrete_condition_versions where id='${id(70)}'`)).rows[0].compatibility_anchor_measurement_id, id(51));
    assert.equal((await db.query(`select updated_at > '2026-09-01'::timestamptz as changed from project_concrete_condition_versions where id='${id(70)}'`)).rows[0].changed, true);
    for (const status of ['verified', 'accepted', 'approved', 'superseded', 'issued']) {
      await reset();
      if (status === 'verified') await db.exec("update project_concrete_condition_versions set status='verified'");
      else if (status === 'issued') await db.exec(`insert into proposal_presentations values ('${id(130)}','${id(10)}','${id(20)}')`);
      else await db.exec(`update estimates set status='${status}'`);
      await assert.rejects(update(), /verified|locked/);
      assert.equal(await count('project_condition_outputs'), 1);
      assert.equal(Number((await db.query('select raw_quantity from takeoff_measurements')).rows[0].raw_quantity), 4.43);
    }
    await reset();
    await db.exec(`insert into project_concrete_condition_versions values ('${id(71)}','${id(10)}','${id(61)}','verified',null,now()); insert into project_condition_measurement_roles values ('${id(81)}','${id(10)}','${id(71)}','${id(50)}');`);
    await assert.rejects(update(), /verified/);
    assert.equal(await count('project_condition_outputs'), 1);
    await reset();
    await db.exec(`reset role; insert into takeoff_measurements values ('${id(52)}','${id(11)}','${id(20)}','drawing','${id(40)}','${id(30)}',9,'LF','{}','{}',now()); insert into project_condition_outputs values ('${id(112)}','${id(11)}','${id(72)}',null,null); insert into project_condition_outputs values ('${id(113)}','${id(10)}','${id(73)}',null,null); set role authenticated;`);
    await assert.rejects(update(id(52)), /not found/);
    await update();
    await db.exec('reset role');
    assert.equal(Number((await db.query(`select raw_quantity from takeoff_measurements where id='${id(52)}'`)).rows[0].raw_quantity), 9);
    assert.equal(await count('project_condition_outputs'), 2); // Other tenant and unrelated Condition survived.
    await reset();
    await db.exec(`reset role; create function fail_item_delete() returns trigger language plpgsql as $$ begin raise exception 'injected cleanup failure'; end $$; create trigger fail_cleanup before delete on estimate_items for each row execute function fail_item_delete(); set role authenticated;`);
    await assert.rejects(update(), /injected cleanup failure/);
    assert.equal(await count('project_condition_outputs'), 1);
    assert.equal(await count('takeoff_measurement_outputs'), 1);
    assert.equal(Number((await db.query('select raw_quantity from takeoff_measurements')).rows[0].raw_quantity), 4.43);
    await db.exec('reset role; drop trigger fail_cleanup on estimate_items');
    await reset();
    await db.exec(`delete from project_condition_measurement_roles; update project_concrete_condition_versions set compatibility_anchor_measurement_id='${id(50)}'`);
    await update(); // Anchor-only linkage is protected, too.
    assert.equal(await count('project_condition_outputs'), 0);
    await reset();
    await db.exec(`delete from project_condition_measurement_roles; update project_concrete_condition_versions set compatibility_anchor_measurement_id=null`);
    await update(); // Unlinked legacy measurement retains its original sync path.
    assert.equal(await count('test_sync_calls'), 1);
  } finally { await db.close(); }
});


test('direct canvas reports committed stable measurement ids before consuming the role request', () => {
  const canvas = readFileSync('components/takeoff/TakeoffDrawingCanvas.tsx', 'utf8');
  const committed = canvas.indexOf('props.onMeasurementCommitted(String(result.id))');
  const consumed = canvas.indexOf('props.onRoleMeasurementRequestConsumed(props.roleMeasurementRequest.requestId)');
  assert.ok(committed >= 0);
  assert.ok(consumed > committed);
  assert.doesNotMatch(canvas, /carez:start-condition-takeoff|CustomEvent/);
});
