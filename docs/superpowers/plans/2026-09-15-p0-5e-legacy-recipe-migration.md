# P0.5E Legacy Recipe Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile supported active legacy Scope Recipe / Project Variant / method-profile work into Concrete Conditions, preserve every referenced historical lineage record, and retire formula-first authoring from the normal Takeoff workflow without deleting legacy compatibility storage.

**Architecture:** Treat legacy assembly/recipe data as a compatibility and historical layer, never as a second future authoring model. First record a tenant-scoped migration ledger and deterministic read-only classification; then migrate only editable supported pilot records through the existing server-authoritative Concrete Condition calculation/persistence path, prove output/estimate parity, and only then remove active legacy authoring entry points. Published/verified/issued history remains immutable and readable.

**Tech Stack:** Next.js 15, React 19, TypeScript, Supabase/PostgreSQL, existing Carez Concrete Condition engine, Node `node:test`, GitHub Actions/Vercel staging.

**Spec:** GitHub Issue #39; `docs/decisions/ADR-012-concrete-condition-engine.md`; `docs/concrete-condition-3d-workstation-target.md`; `docs/CURRENT_STATE.md`.

## Global Constraints

- Work only on canonical `staging`; do not touch `main`.
- Persisted 2D Takeoff geometry and server/domain calculation remain authoritative.
- Do not mutate published/verified Condition history or issued/approved/accepted/superseded estimate/proposal history.
- Do not delete legacy assembly/recipe tables in P0.5E.
- Do not add any new 3D authoring/editing work while P0.5E is open.
- Existing Condition calculation must remain the only source of new Condition quantities; legacy projection remains one-way compatibility persistence.
- Every migration operation must be tenant-scoped, idempotent, auditable, and dry-runnable.
- Issue #59 remains a hard blocker for production migration promotion; P0.5E database changes are QA/staging only until the production bridge is separately resolved.
- Run focused tests during tasks; run `pnpm check` once at the final staging gate.

---

### Task 1: Add the migration ledger and classification contract

**Files:**
- Create: `supabase/migrations/20260915231000_condition_legacy_migration_ledger.sql`
- Create: `lib/takeoff/conditions/legacyMigration.ts`
- Create: `tests/condition-legacy-migration.test.ts`

**Interfaces:**
- Produces SQL tables `condition_legacy_migration_runs` and `condition_legacy_migration_items`.
- Produces `LegacyMigrationClassification`, `LegacyMigrationStatus`, and `classifyLegacyMigrationCandidate()` for later server tasks.

- [ ] **Step 1: Write the failing migration-contract test**

Add a test that reads the migration SQL and requires tenant ownership, dry-run/apply modes, the four Issue #39 classifications, explicit item result/error state, RLS enablement, and a unique idempotency key per run/object.

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sql = readFileSync('supabase/migrations/20260915231000_condition_legacy_migration_ledger.sql', 'utf8');

test('P0.5E migration ledger is tenant-scoped, classified, auditable, and idempotent', () => {
  assert.match(sql, /create table public\.condition_legacy_migration_runs/i);
  assert.match(sql, /mode text not null.*dry_run.*apply/is);
  assert.match(sql, /create table public\.condition_legacy_migration_items/i);
  assert.match(sql, /mapped.*historical_only.*unsupported_review.*unreferenced/is);
  assert.match(sql, /error_text text/i);
  assert.match(sql, /unique\s*\(run_id,object_type,legacy_id\)/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /get_my_company_id\(\)/i);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/condition-legacy-migration.test.ts
```

Expected: FAIL because the migration file does not exist.

- [ ] **Step 3: Add the additive migration ledger**

Use this shape; do not add delete cascades from historical business records into the ledger:

```sql
create table public.condition_legacy_migration_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  takeoff_set_id uuid references public.takeoff_sets(id) on delete restrict,
  mode text not null check (mode in ('dry_run','apply')),
  status text not null default 'running' check (status in ('running','completed','failed')),
  source_snapshot jsonb not null default '{}'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  error_text text,
  created_by uuid references public.profiles(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.condition_legacy_migration_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  run_id uuid not null references public.condition_legacy_migration_runs(id) on delete cascade,
  object_type text not null check (object_type in ('assembly_version','method_profile','measurement','output','estimate_item','proposal_snapshot')),
  legacy_id uuid not null,
  classification text not null check (classification in ('mapped','historical_only','unsupported_review','unreferenced')),
  target_kind text,
  target_id uuid,
  result_status text not null default 'pending' check (result_status in ('pending','exact','held','mismatch','skipped','error')),
  details jsonb not null default '{}'::jsonb,
  error_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(run_id,object_type,legacy_id)
);
```

Enable RLS and add tenant policies using `company_id = public.get_my_company_id()`. Allow authenticated office users to read; restrict insert/update execution to the server/RPC path used by later tasks. Do not grant delete as part of the migration workflow.

- [ ] **Step 4: Add the pure classification contract**

```ts
export type LegacyMigrationClassification =
  | 'mapped'
  | 'historical_only'
  | 'unsupported_review'
  | 'unreferenced';

export type LegacyMigrationStatus =
  | 'pending'
  | 'exact'
  | 'held'
  | 'mismatch'
  | 'skipped'
  | 'error';

export function classifyLegacyMigrationCandidate(input: {
  referencedByIssuedHistory: boolean;
  activeMeasurementRefs: number;
  templateMappingCount: number;
  supportedPilotFamily: boolean;
}) : LegacyMigrationClassification {
  if (input.referencedByIssuedHistory) return 'historical_only';
  if (input.activeMeasurementRefs > 0 && input.supportedPilotFamily && input.templateMappingCount > 0) return 'mapped';
  if (input.activeMeasurementRefs > 0) return 'unsupported_review';
  return 'unreferenced';
}
```

Add table-driven tests for all four outcomes.

- [ ] **Step 5: Run the focused test and typecheck**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/condition-legacy-migration.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260915231000_condition_legacy_migration_ledger.sql lib/takeoff/conditions/legacyMigration.ts tests/condition-legacy-migration.test.ts
git commit -m "feat(takeoff): add legacy migration audit ledger"
```

---

### Task 2: Build deterministic read-only inventory and dry-run classification

**Files:**
- Create: `lib/takeoff/conditions/legacyMigration.server.ts`
- Create: `app/takeoff/[setId]/conditionMigrationActions.ts`
- Modify: `tests/condition-legacy-migration.test.ts`

**Interfaces:**
- Consumes `classifyLegacyMigrationCandidate()` from Task 1.
- Produces `buildLegacyMigrationInventory()` and server action `dryRunLegacyConditionMigration({takeoffSetId})`.
- Dry-run writes only the migration ledger; it must not mutate measurements, outputs, estimate items, Conditions, or proposals.

- [ ] **Step 1: Add RED tests for safety gates**

Require source assertions that dry-run:
- loads the estimate status and proposal count;
- classifies issued/locked work as `historical_only`;
- reads `condition_legacy_output_mappings` and legacy measurement/output/estimate lineage;
- never calls `carez_commit_project_condition_calculation` or updates `takeoff_measurements`.

- [ ] **Step 2: Implement `buildLegacyMigrationInventory()`**

Return records with this explicit shape:

```ts
export type LegacyMigrationCandidate = {
  objectType: 'assembly_version' | 'method_profile' | 'measurement' | 'output' | 'estimate_item' | 'proposal_snapshot';
  legacyId: string;
  classification: LegacyMigrationClassification;
  supportedPilotFamily: 'pad_column_footing' | 'strip_wall_footing' | 'slab_on_grade' | null;
  sourceAssemblyVersionId: string | null;
  targetTemplateVersionId: string | null;
  targetCompatibilityAssemblyVersionId: string | null;
  details: Record<string, unknown>;
};
```

Use exact current database references, not names alone, to determine whether a legacy assembly version has a published Condition template/output mapping.

- [ ] **Step 3: Implement owner/office dry-run action**

Use the same authentication/tenant checks as `conditionActions.ts`. Create one `condition_legacy_migration_runs` row with `mode='dry_run'`, upsert each inventory item using `(run_id,object_type,legacy_id)`, store counts by classification in `summary`, and mark the run completed. On failure, set run status/error and rethrow.

Do not change domain records in this task.

- [ ] **Step 4: Run focused tests and typecheck**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/condition-legacy-migration.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/takeoff/conditions/legacyMigration.server.ts app/takeoff/[setId]/conditionMigrationActions.ts tests/condition-legacy-migration.test.ts
git commit -m "feat(takeoff): add condition migration dry run"
```

---

### Task 3: Add supported pilot migration preparation without changing geometry

**Files:**
- Modify: `lib/takeoff/conditions/legacyMigration.server.ts`
- Modify: `app/takeoff/[setId]/conditionMigrationActions.ts`
- Modify: `tests/condition-legacy-migration.test.ts`
- Test alongside: `tests/condition-legacy-adapter.test.ts`

**Interfaces:**
- Produces `prepareLegacyPilotMigration()`.
- Reuses `createProjectConcreteConditionPilot`/Condition template contracts and `prepareConcreteConditionPilotPersistence` concepts, but migration execution must be one explicit server-owned command.

- [ ] **Step 1: Add RED tests for migration eligibility**

Require:
- only `draft` estimates with zero proposals can be applied;
- issued/approved/accepted/superseded work is never mutated;
- geometry JSON, raw quantity, raw unit, sheet ID, scale region ID, and measurement ID are preserved;
- source assembly/version IDs are captured into the ledger before any compatibility reassignment;
- unsupported family/mapping gaps remain `unsupported_review`.

- [ ] **Step 2: Prepare one existing measurement as the Condition primary role**

For supported editable pilot records, use the existing measurement ID and geometry. Do not clone or recompute 2D geometry. Resolve the latest approved pilot template/contract for the family and build the Condition role/module/input payload from governed source facts only.

If legacy assembly identity differs from the template compatibility assembly, do not silently rewrite it in preparation. Return an explicit compatibility-rebind operation containing old/new assembly version IDs so execution can validate and audit the change transactionally.

- [ ] **Step 3: Preserve migration provenance**

The ledger item details must include:

```ts
{
  source_measurement_id,
  source_assembly_version_id,
  target_template_version_id,
  target_compatibility_assembly_version_id,
  raw_quantity,
  raw_unit,
  geometry_hash,
  source_output_ids,
  source_estimate_item_ids
}
```

No browser-supplied quantity is accepted.

- [ ] **Step 4: Run focused regression**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/condition-legacy-migration.test.ts tests/condition-legacy-adapter.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/takeoff/conditions/legacyMigration.server.ts app/takeoff/[setId]/conditionMigrationActions.ts tests/condition-legacy-migration.test.ts
git commit -m "feat(takeoff): prepare supported legacy condition migration"
```

---

### Task 4: Execute an idempotent pilot migration and reconcile exact lineage

**Files:**
- Create: `supabase/migrations/20260915232000_condition_legacy_migration_commit.sql`
- Modify: `lib/takeoff/conditions/legacyMigration.server.ts`
- Modify: `app/takeoff/[setId]/conditionMigrationActions.ts`
- Modify: `tests/condition-legacy-migration.test.ts`
- Test alongside: `tests/qa-commercial-reconciliation.test.ts`

**Interfaces:**
- Produces transactional RPC `carez_commit_legacy_condition_migration(...)` for the narrow compatibility rebind + ledger state transition.
- Condition quantities still come from `prepareConcreteConditionPilotPersistence` / `carez_commit_project_condition_calculation`; the migration RPC must not calculate quantities.

- [ ] **Step 1: Add RED tests for transaction and authority boundaries**

Require the migration SQL to:
- lock the run/item/measurement;
- verify same tenant/takeoff set and editable estimate;
- reject proposal/locked estimate history;
- compare expected `updated_at`/source assembly before rebinding;
- preserve measurement ID/geometry/raw quantity/raw unit;
- record old/new assembly identity in ledger details;
- never accept or calculate a replacement quantity.

- [ ] **Step 2: Implement the transactional compatibility rebind RPC**

The RPC may update only compatibility identity fields necessary for the existing measurement to become the Condition anchor; it must not alter `geometry`, `raw_quantity`, `raw_unit`, `sheet_id`, or scale calibration. It must fail if the current row differs from the dry-run snapshot.

- [ ] **Step 3: Execute Condition persistence using the existing server calculator**

After a successful rebind, create/bind the Project Concrete Condition, call the existing server preparation, then call `carez_commit_project_condition_calculation`. Re-read `condition_legacy_reconciliation` and require each mapped output to be `exact`, `held`, or intentionally inactive; any `mismatch` marks the migration item/run failed and leaves the legacy authoring cutover gate closed.

- [ ] **Step 4: Prove estimate lineage**

Require exactly one generated estimate item per estimate-visible active output and no orphan/duplicate `source_takeoff_output_id`, `source_takeoff_measurement_id`, or `generated_estimate_item_id` relationships.

- [ ] **Step 5: Run focused tests**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/condition-legacy-migration.test.ts tests/condition-legacy-adapter.test.ts tests/qa-commercial-reconciliation.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260915232000_condition_legacy_migration_commit.sql lib/takeoff/conditions/legacyMigration.server.ts app/takeoff/[setId]/conditionMigrationActions.ts tests/condition-legacy-migration.test.ts
git commit -m "feat(takeoff): migrate supported legacy condition records"
```

---

### Task 5: Retire legacy formula-first authoring from normal Takeoff after parity proof

**Files:**
- Modify: `app/takeoff/[setId]/page.tsx`
- Modify: `components/takeoff/TakeoffDrawingWorkspace.tsx`
- Modify: `components/takeoff/TakeoffQuantityDock.tsx`
- Modify: `tests/condition-first-cutover.test.ts`
- Delete after repository dependency proof:
  - `components/takeoff/TakeoffAssemblyBuilderShell.tsx`
  - `components/takeoff/AssemblyBuilderComposer.tsx`
  - `components/takeoff/AssemblySystemPresetBar.tsx`
  - `components/takeoff/ConcreteFormulaComposer.tsx`
  - active-only action modules no longer referenced by any authorized history/admin surface

**Interfaces:**
- Normal `/takeoff/[setId]` always mounts `TakeoffConditionWorkflowShell`.
- Legacy assembly data remains readable through a historical/admin surface until all referenced history is proven reproducible.

- [ ] **Step 1: Flip the cutover regression to RED**

Replace the old fallback assertion with:

```ts
test('normal Takeoff is permanently Condition-first after P0.5E parity', () => {
  assert.match(page, /<TakeoffConditionWorkflowShell/);
  assert.doesNotMatch(page, /TakeoffAssemblyBuilderShell|conditionAuthoringActive/);
  assert.doesNotMatch(workspace, /buildPlan|Legacy recipes and Build Methods stay out of the active workflow/);
  assert.doesNotMatch(quantityDock, /openLibrary|builderButton/);
});
```

Run the test and confirm it fails before changing source.

- [ ] **Step 2: Remove the runtime fallback gate**

Delete `TakeoffAssemblyBuilderShell` import/loading path and the Condition-contract fallback branch from `app/takeoff/[setId]/page.tsx`. Continue loading compatibility assembly/version/mapping data only where the Condition server persistence layer still requires it.

- [ ] **Step 3: Remove normal-workflow recipe/build-plan launchers**

Delete the active Build Plan/recipe authoring controls from the drawing workspace and worksheet. Do not change PDF, geometry, calibration, Condition Properties, worksheet quantities, or R3F behavior.

- [ ] **Step 4: Repository dependency audit before deleting files**

Search for each candidate component/action import. Delete only files with no remaining authorized runtime/history dependency. If an action is still needed by a read-only historical/admin surface, keep the read path and remove/disable mutation UI rather than deleting blindly.

- [ ] **Step 5: Run focused tests and typecheck**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/condition-first-cutover.test.ts tests/condition-legacy-migration.test.ts tests/qa-condition-workstation.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/takeoff/[setId]/page.tsx components/takeoff tests/condition-first-cutover.test.ts
git commit -m "refactor(takeoff): retire active legacy recipe authoring"
```

---

### Task 6: Convert the assembly library to historical/read-only audit semantics

**Files:**
- Modify: `app/takeoff/assemblies/page.tsx`
- Modify or delete mutation actions only after dependency audit:
  - `app/takeoff/[setId]/assemblyActions.ts`
  - `app/takeoff/[setId]/assemblySystemActions.ts`
  - `app/takeoff/[setId]/scopeVariantActions.ts`
- Modify: `tests/condition-first-cutover.test.ts`

**Interfaces:**
- `/takeoff/assemblies` may display referenced published recipe/assembly history and compatibility IDs, but must not be a normal authoring route.

- [ ] **Step 1: Add RED assertions for read-only history**

Require the route copy to identify it as compatibility/history, retain published version/output visibility, and contain no create/edit/revise/formula authoring controls.

- [ ] **Step 2: Make the route read-only**

Keep published recipe/version/resource/output inspection required for audit. Remove mutation affordances and normal-workflow wording such as “Build the first concrete recipe”. Do not remove referenced database rows.

- [ ] **Step 3: Remove mutation action modules only when unreferenced**

Repository-search each exported function. Delete an action module only when there is no remaining active caller and no accepted admin workflow requiring it.

- [ ] **Step 4: Run focused tests and typecheck**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/condition-first-cutover.test.ts tests/condition-legacy-migration.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/takeoff/assemblies app/takeoff/[setId] tests/condition-first-cutover.test.ts
git commit -m "refactor(takeoff): make legacy assembly history read only"
```

---

### Task 7: Final P0.5E reconciliation, docs, and staging acceptance

**Files:**
- Modify only after verified implementation facts: `docs/CURRENT_STATE.md`
- Modify: `docs/modules/takeoff.md`
- Modify: `docs/modules/assembly-resource-engine.md` if it still describes normal recipe-first authoring
- Modify: `tests/condition-legacy-migration.test.ts`

**Interfaces:**
- Produces the final migration report used to close Issue #39 and advance parent #43.

- [ ] **Step 1: Run the QA dry-run after all source changes**

Require summary counts for `mapped`, `historical_only`, `unsupported_review`, and `unreferenced`, with zero unexplained errors.

- [ ] **Step 2: Apply only supported editable pilot candidates in QA**

For every `mapped` item, require exact/held/intentionally-inactive reconciliation and no orphan/duplicate estimate lineage. Leave historical/unsupported/unreferenced records untouched.

- [ ] **Step 3: Run the full verification gate once**

```bash
pnpm check
```

Expected: typecheck PASS, full domain tests PASS, production build PASS.

- [ ] **Step 4: Authenticated staging browser QA**

Verify:
- normal Takeoff has no recipe/formula-first entry point;
- existing migrated measurements keep exact 2D geometry and quantities;
- Condition Properties/worksheet/estimate remain synchronized;
- 2D/3D behavior from closed #41 is unchanged;
- `/takeoff/assemblies` is historical/read-only only;
- locked/issued history remains reproducible and unmodified.

- [ ] **Step 5: Update canonical docs only from verified results**

Update `CURRENT_STATE.md` from actual final staging SHA/QA evidence. Remove stale statements that #41 is open or that `2D | 3D | Split` is active.

- [ ] **Step 6: Commit and stop for final acceptance**

```bash
git add docs tests/condition-legacy-migration.test.ts
git commit -m "docs(takeoff): record P0.5E condition cutover state"
```

Push `staging`, verify exact-SHA CI/Vercel, then stop for user browser acceptance. Do not close #39 or start any 3D authoring/editing until that acceptance passes.

---

## Self-review

- **Spec coverage:** inventory/classification, compatibility mappings, supported pilot migration, controlled reconciliation, historical immutability, active UI retirement, read-only legacy history, idempotency/logging, RLS, dry run, count/lineage checks, and final browser acceptance are each assigned to a task.
- **Authority check:** no task makes mesh, browser, or legacy formula output a new quantity authority; Condition calculation remains server-authoritative.
- **Destructive-change check:** no legacy schema deletion is part of P0.5E; only active authoring code may be deleted after dependency proof.
- **Production check:** Issue #59 remains an explicit production release blocker; this plan authorizes QA/staging work only.
