import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const migration = readFileSync('supabase/migrations/20260929210000_takeoff_sheet_metadata_correction.sql', 'utf8');
const actionSource = readFileSync('app/takeoff/[setId]/sheetMetadataActions.ts', 'utf8');
const workspaceSource = readFileSync('components/takeoff/TakeoffDrawingWorkspace.tsx', 'utf8');
const editorSource = readFileSync('components/takeoff/TakeoffSheetMetadataEditor.tsx', 'utf8');

const ids = {
  company: '00000000-0000-0000-0000-000000000001',
  set: '00000000-0000-0000-0000-000000000002',
  estimate: '00000000-0000-0000-0000-000000000003',
  sheet: '00000000-0000-0000-0000-000000000004',
};
const updatedAt = '2026-09-29T20:10:38.760478+00:00';

function loadActions(client: unknown, paths: string[]) {
  const compiled = ts.transpileModule(actionSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports: Record<string, Function> = {};
  vm.runInNewContext(compiled, {
    exports,
    require: (name: string) => {
      if (name === 'next/cache') return { revalidatePath: (path: string) => paths.push(path) };
      if (name === '@/lib/supabase/server') return { createClient: async () => client };
      throw new Error(`Unexpected module ${name}`);
    },
  });
  return exports;
}

function subject(options: {
  role?: string;
  setStatus?: string;
  estimateStatus?: string;
  issued?: number | null;
  updatedAt?: string;
  number?: string | null;
  title?: string | null;
  rpcError?: { code: string; message: string };
} = {}) {
  const rows: Record<string, unknown> = {
    profiles: { company_id: ids.company, role: options.role ?? 'owner' },
    takeoff_sets: { id: ids.set, status: options.setStatus ?? 'active', estimate_id: ids.estimate },
    estimates: { id: ids.estimate, status: options.estimateStatus ?? 'draft' },
    takeoff_sheets: {
      id: ids.sheet, page_number: 1, sheet_number: options.number ?? 'E402',
      title: options.title ?? 'ELECTRICAL DETAILS', updated_at: options.updatedAt ?? updatedAt,
    },
  };
  const filters: Record<string, Array<[string, unknown]>> = {};
  const rpcCalls: Array<{ name: string; payload: Record<string, unknown> }> = [];
  const paths: string[] = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }) },
    from(table: string) {
      const query = {
        select() { return query; },
        eq(key: string, value: unknown) { (filters[table] ||= []).push([key, value]); return query; },
        maybeSingle: async () => ({ data: rows[table] ?? null, error: null }),
        then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
          return Promise.resolve({ count: options.issued ?? 0, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
    rpc: async (name: string, payload: Record<string, unknown>) => {
      rpcCalls.push({ name, payload });
      return { error: options.rpcError ?? null };
    },
  };
  const exports = loadActions(client, paths);
  return { correct: exports.correctTakeoffSheetMetadata, filters, rpcCalls, paths };
}

function automaticSubject(concurrentCorrection = false) {
  const selected = { id: ids.sheet, page_number: 1, sheet_number: null as string | null, title: null as string | null, updated_at: updatedAt };
  let current = { ...selected };
  let readColumns = '';
  const updateFilters: Array<[string, unknown]> = [];
  const paths: string[] = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
    from(table: string) {
      let mode: 'read' | 'update' = 'read';
      let patch: Record<string, string> = {};
      const query = {
        select(columns: string) {
          if (table === 'takeoff_sheets' && mode === 'read') readColumns = columns;
          if (table === 'takeoff_sheets' && mode === 'update') {
            const stillCurrent = updateFilters.some(([field, value]) => field === 'updated_at' && value === current.updated_at);
            if (stillCurrent) current = { ...current, ...patch, updated_at: '2026-09-29T20:11:00+00:00' };
            return Promise.resolve({ data: stillCurrent ? [{ id: ids.sheet }] : [], error: null });
          }
          return query;
        },
        update(value: Record<string, string>) { mode = 'update'; patch = value; return query; },
        eq(field: string, value: unknown) { if (table === 'takeoff_sheets' && mode === 'update') updateFilters.push([field, value]); return query; },
        single: async () => ({ data: { company_id: ids.company, role: 'owner' } }),
        maybeSingle: async () => ({ data: table === 'takeoff_sets'
          ? { id: ids.set, status: 'active', estimate_id: ids.estimate }
          : { id: ids.estimate, status: 'draft' } }),
        then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
          if (table === 'takeoff_sheets') {
            if (concurrentCorrection) current = { ...current, sheet_number: 'G001', title: 'Human correction', updated_at: '2026-09-29T20:10:59+00:00' };
            return Promise.resolve({ data: [selected], error: null }).then(resolve, reject);
          }
          return Promise.resolve({ count: 0 }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  const exports = loadActions(client, paths);
  return { apply: exports.applyAutomaticSheetMetadata, current: () => current, readColumns: () => readColumns, updateFilters, paths };
}

const correction = {
  takeoffSetId: ids.set, sheetId: ids.sheet, pageNumber: 1, expectedUpdatedAt: updatedAt,
  sheetNumber: 'G000', title: 'Cover Sheet',
};

test('human correction sends only selected page labels through the audited RPC', async () => {
  const run = subject();
  assert.equal((await run.correct(correction)).updated, true);
  assert.equal(run.rpcCalls.length, 1);
  assert.equal(run.rpcCalls[0].name, 'carez_correct_takeoff_sheet_metadata');
  assert.deepEqual(JSON.parse(JSON.stringify(run.rpcCalls[0].payload)), {
    p_takeoff_set_id: ids.set, p_sheet_id: ids.sheet, p_page_number: 1,
    p_expected_updated_at: updatedAt, p_sheet_number: 'G000', p_title: 'Cover Sheet',
  });
  assert.ok(run.filters.takeoff_sheets.some(([field, value]) => field === 'company_id' && value === ids.company));
  assert.deepEqual(run.paths, [`/takeoff/${ids.set}`, '/takeoff', '/takeoff/plans']);
});

test('unauthorized, locked, issued and stale corrections never reach the RPC', async () => {
  for (const options of [
    { role: 'employee' }, { setStatus: 'archived' },
    { estimateStatus: 'approved' }, { issued: 1 }, { updatedAt: '2026-09-30T00:00:00+00:00' },
  ]) {
    const run = subject(options);
    await assert.rejects(run.correct(correction));
    assert.equal(run.rpcCalls.length, 0);
    assert.equal(run.paths.length, 0);
  }
});

test('unchanged labels do not create an audit event or touch the sheet', async () => {
  const run = subject({ number: 'G000', title: 'Cover Sheet' });
  assert.equal((await run.correct(correction)).updated, false);
  assert.equal(run.rpcCalls.length, 0);
});

test('missing migration gives a clear label-editing error without changing the sheet', async () => {
  const run = subject({ rpcError: { code: 'PGRST202', message: 'function not found' } });
  await assert.rejects(run.correct(correction), /pending the database migration/);
  assert.equal(run.rpcCalls.length, 1);
  assert.equal(run.paths.length, 0);
});

test('automatic naming counts a successful fill and skips a concurrent human correction', async () => {
  const candidates = [{ pageNumber: 1, sheetNumber: 'A101', title: 'Foundation Plan' }];
  const filled = automaticSubject();
  assert.equal((await filled.apply(ids.set, candidates)).updated, 1);
  assert.equal(filled.current().sheet_number, 'A101');
  assert.equal(filled.current().title, 'Foundation Plan');
  assert.ok(filled.readColumns().includes('updated_at'));
  assert.ok(filled.updateFilters.some(([field, value]) => field === 'updated_at' && value === updatedAt));
  assert.deepEqual(filled.paths, [`/takeoff/${ids.set}`, '/takeoff', '/takeoff/plans']);

  const raced = automaticSubject(true);
  assert.equal((await raced.apply(ids.set, candidates)).updated, 0);
  assert.equal(raced.current().sheet_number, 'G001');
  assert.equal(raced.current().title, 'Human correction');
  assert.deepEqual(raced.paths, []);
});

test('database guard preserves page identity, active revision and tenant authority while auditing old and new labels', () => {
  const guard = migration.slice(migration.indexOf('create function public.carez_guard_takeoff_sheet_metadata()'), migration.indexOf('create trigger carez_guard_takeoff_sheet_metadata'));
  const audit = migration.slice(migration.indexOf('create function public.carez_audit_takeoff_sheet_metadata()'), migration.indexOf('create trigger carez_audit_takeoff_sheet_metadata'));
  assert.match(guard, /new\.page_number is distinct from old\.page_number/);
  assert.match(guard, /new\.company_id is distinct from old\.company_id/);
  assert.match(guard, /new\.takeoff_set_id is distinct from old\.takeoff_set_id/);
  assert.match(guard, /new\.sheet_number is not distinct from old\.sheet_number[\s\S]*return new;[\s\S]*auth\.uid\(\)/);
  assert.match(guard, /new\.company_id is distinct from public\.get_my_company_id\(\)/);
  assert.match(guard, /public\.get_my_role\(\) = 'employee'/);
  assert.match(guard, /v_set_status <> 'active'/);
  assert.match(guard, /for update of ts, e/);
  assert.match(guard, /'accepted', 'approved', 'superseded'/);
  assert.match(guard, /public\.proposal_presentations/);
  assert.match(audit, /old\.sheet_number, new\.sheet_number, old\.title, new\.title, auth\.uid\(\)/);
  assert.match(migration, /after update of sheet_number, title on public\.takeoff_sheets/);
  assert.doesNotMatch(migration, /as restrictive for update to authenticated/);
  assert.match(migration, /Sheet metadata history is append-only/);
  assert.match(migration, /revoke all on public\.takeoff_sheet_metadata_events from public, anon, authenticated/);
  assert.match(migration, /security invoker set search_path = pg_catalog, public/);
});

test('sheet initialization and calibration keep their existing writes; editor changes labels only', () => {
  const guard = migration.slice(migration.indexOf('create function public.carez_guard_takeoff_sheet_metadata()'), migration.indexOf('create trigger carez_guard_takeoff_sheet_metadata'));
  assert.match(guard, /new\.sheet_number is not distinct from old\.sheet_number[\s\S]*new\.title is not distinct from old\.title then[\s\S]*return new/);
  assert.match(migration, /before update on public\.takeoff_sheets/);
  assert.doesNotMatch(migration, /before insert on public\.takeoff_sheets/);
  assert.match(actionSource, /if \(!existingNumber && inferredNumber\) patch\.sheet_number/);
  assert.match(actionSource, /if \(!existingTitle && inferredTitle\) patch\.title/);
  assert.match(workspaceSource, /<TakeoffSheetMetadataEditor takeoffSetId=\{takeoffSet\.id\} sheet=\{currentSheet\}/);
  assert.match(editorSource, /expectedUpdatedAt: editing\.updated_at/);
  assert.doesNotMatch(editorSource, /page_width|page_height|geometry|calibration/);
});
