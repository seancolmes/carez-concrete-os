# P0.5E Legacy Recipe Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile supported legacy Scope Recipe / Project Variant / assembly-driven Takeoff data into the Concrete Condition model, preserve referenced history, and retire active formula-first authoring paths without creating a second quantity or commercial truth.

**Architecture:** Treat the existing legacy assembly/takeoff tables as immutable compatibility/history records while new normal work uses Concrete Conditions. Use the existing `legacy_assembly_version_id`, `legacy_takeoff_output_id`, `legacy_method_profile_id`, compatibility-anchor/projection fields, `condition_legacy_output_mappings`, and reconciliation views as the bridge; do not invent a parallel migration model. Cut over presentation only after deterministic read-only inventory and reconciliation prove that every referenced record is mapped or explicitly historical-only/unsupported-review.

**Tech Stack:** Next.js 15, TypeScript, Supabase/PostgreSQL, Node test runner, existing Carez Condition/Takeoff domain.

**Spec:** `docs/concrete-condition-3d-workstation-target.md` plus GitHub Issue #39 and ADR-012.

## Global Constraints

- `staging` is the canonical QA line; `main` remains untouched until separate production promotion approval.
- Persisted 2D Takeoff geometry and server/domain quantities remain authoritative.
- Do not mutate or delete referenced published/accepted legacy records.
- No destructive legacy schema removal in this workstream.
- Migration must be idempotent, tenant-scoped, RLS-safe, and auditable.
- Referenced legacy history remains inspectable read-only after cutover.
- No additional 3D authoring/editing work is part of P0.5E.
- `docs/CURRENT_STATE.md` changes only after stable-staging browser acceptance.

---

### Task 1: Deterministic legacy inventory and classification

**Files:**
- Create: `scripts/condition-legacy-inventory.mjs`
- Create: `tests/condition-legacy-migration.test.ts`
- Reference: `supabase/migrations/20260904054917_concrete_condition_foundation.sql`
- Reference: `supabase/migrations/20260904135826_condition_persistence_reconciliation.sql`

**Interfaces:**
- Consumes: legacy assembly/version/component/variable/child/profile/measurement/output/estimate references and existing Condition compatibility fields.
- Produces: deterministic per-record classification: `mapped`, `historical_only`, `unsupported_review`, or `unreferenced`, with reference counts and blocking reasons.

- [ ] **Step 1: Write the failing classification test**

```ts
assert.equal(classifyLegacyRecord({referenced:true, mapped:true, supported:true}), 'mapped');
assert.equal(classifyLegacyRecord({referenced:true, mapped:false, supported:false}), 'unsupported_review');
assert.equal(classifyLegacyRecord({referenced:true, mapped:false, supported:true, historicalOnly:true}), 'historical_only');
assert.equal(classifyLegacyRecord({referenced:false, mapped:false, supported:false}), 'unreferenced');
```

- [ ] **Step 2: Run the targeted test and verify RED**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/condition-legacy-migration.test.ts
```

Expected: FAIL because `classifyLegacyRecord` does not exist.

- [ ] **Step 3: Implement `scripts/condition-legacy-inventory.mjs`**

Implement pure helpers that consume already-fetched rows and emit stable JSON. The executable path must require explicit `SUPABASE_URL`/service credentials and perform SELECT-only queries. Include counts for assembly versions, variables, components, children, method/scope variants, measurements, legacy outputs, estimate items, proposal/snapshot references, Condition template mappings, Condition projections, and reconciliation rows.

- [ ] **Step 4: Run the targeted test and verify GREEN**

Use the same command; expected PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/condition-legacy-inventory.mjs tests/condition-legacy-migration.test.ts
git commit -m "feat(takeoff): add legacy condition migration inventory"
```

### Task 2: Add an idempotent server-side migration/reconciliation boundary

**Files:**
- Create: `supabase/migrations/20260915231000_condition_legacy_migration.sql`
- Modify: `tests/domain.test.ts`
- Test: `tests/condition-legacy-migration.test.ts`

**Interfaces:**
- Consumes: existing compatibility mappings and pilot Condition templates.
- Produces: tenant-scoped dry-run/classification functions plus an explicitly invoked idempotent migration action for supported pilot records; no implicit bulk mutation.

- [ ] **Step 1: Add failing migration-contract assertions**

Assert the migration defines:

```ts
assert.match(sql, /carez_condition_legacy_inventory/);
assert.match(sql, /carez_migrate_supported_legacy_condition/);
assert.match(sql, /security invoker/);
assert.match(sql, /get_my_company_id\(\)/);
assert.doesNotMatch(sql, /drop table|truncate table/i);
```

- [ ] **Step 2: Run targeted tests and verify RED**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/condition-legacy-migration.test.ts tests/domain.test.ts
```

- [ ] **Step 3: Implement the migration**

Add a SELECT-oriented inventory function that returns stable classification/reconciliation data and an explicit migration function that:
1. locks one legacy source measurement/project scope at a time;
2. resolves the compatible published Company Condition Template via `legacy_assembly_version_id`;
3. creates or reuses exactly one Project Concrete Condition/version for the migration identity;
4. preserves the existing measurement as geometry/quantity authority and binds it through `project_condition_measurement_roles`;
5. writes compatibility anchors and output mappings using existing Condition commit semantics;
6. reconciles Condition output vs legacy `takeoff_measurement_outputs` and `estimate_items`;
7. returns `exact`, `held`, `mismatch`, or `unsupported_review` without deleting legacy rows;
8. is safe to call repeatedly without duplicate Conditions, roles, outputs, or estimate items.

Do not auto-migrate unsupported assembly families or published/accepted history.

- [ ] **Step 4: Run targeted tests and verify GREEN**

Use the same targeted command.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260915231000_condition_legacy_migration.sql tests/domain.test.ts tests/condition-legacy-migration.test.ts
git commit -m "feat(takeoff): add governed legacy condition migration"
```

### Task 3: Make standard Takeoff Condition-first and legacy authoring read-only

**Files:**
- Modify: `components/AppShell.tsx`
- Modify: `app/takeoff/assemblies/page.tsx`
- Modify: `components/takeoff/TakeoffDrawingWorkspace.tsx`
- Modify: `components/takeoff/TakeoffBuildPlanPanel.tsx`
- Modify: `components/takeoff/TakeoffAssemblyInputEditor.tsx`
- Modify: `tests/qa-condition-workstation.test.ts`

**Interfaces:**
- Consumes: accepted integrated Condition workstation (#42/#51) and existing legacy history routes.
- Produces: no recipe/formula-first path for normal Takeoff; referenced legacy assemblies remain inspectable but cannot initiate new standard authoring.

- [ ] **Step 1: Add failing source-surface assertions**

```ts
assert.doesNotMatch(appShell, /hint:'Concrete scope recipes and resources'/);
assert.doesNotMatch(workspace, /<TakeoffBuildPlanPanel/);
assert.doesNotMatch(workspace, /<TakeoffAssemblyInputEditor/);
assert.match(assemblyPage, /Legacy history|Read-only/);
```

- [ ] **Step 2: Run QA workstation test and verify RED**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/qa-condition-workstation.test.ts
```

- [ ] **Step 3: Implement the presentation cutover**

Remove the active recipe/build-plan editor from the normal drawing workflow. Keep `/takeoff/assemblies` as an office-only read-only legacy/history surface while any referenced rows remain. Rename navigation/help copy away from “scope recipes” and clearly label the page as historical compatibility data. Do not remove data tables, compatibility calculators, or legacy read paths used by issued/accepted history.

- [ ] **Step 4: Run QA workstation test and verify GREEN**

Use the same command.

- [ ] **Step 5: Commit**

```bash
git add components/AppShell.tsx app/takeoff/assemblies/page.tsx components/takeoff/TakeoffDrawingWorkspace.tsx components/takeoff/TakeoffBuildPlanPanel.tsx components/takeoff/TakeoffAssemblyInputEditor.tsx tests/qa-condition-workstation.test.ts
git commit -m "refactor(takeoff): retire active legacy recipe authoring"
```

### Task 4: Prove reconciliation on QA before any production migration

**Files:**
- Modify: `tests/condition-legacy-migration.test.ts`
- Create: `docs/qa/p05e-legacy-reconciliation.md`

**Interfaces:**
- Consumes: Task 1 inventory + Task 2 governed migration action.
- Produces: audited QA evidence with counts/sums and a no-duplicate/no-orphan result.

- [ ] **Step 1: Capture pre-migration QA inventory**

Record counts and identities for referenced legacy measurements/outputs/estimate items, Condition mappings, and any proposal/snapshot references.

- [ ] **Step 2: Run dry-run inventory and classify every referenced QA record**

No record may remain unclassified.

- [ ] **Step 3: Migrate only the supported pilot QA record(s)**

Invoke the explicit migration action; do not bulk-update tables manually.

- [ ] **Step 4: Re-run the action to prove idempotency**

Counts of Conditions, roles, outputs, and estimate items must not increase on the second run.

- [ ] **Step 5: Verify reconciliation**

Check quantity, unit, holds, pricing state, man-hours/direct cost where applicable, estimate-item lineage, and source measurement IDs. Record mismatches as blockers rather than forcing parity.

- [ ] **Step 6: Commit QA evidence**

```bash
git add docs/qa/p05e-legacy-reconciliation.md tests/condition-legacy-migration.test.ts
git commit -m "test(takeoff): record p0.5e legacy reconciliation"
```

### Task 5: Full regression and stable-staging browser gate

**Files:**
- Modify only if a regression exposes a P0.5E defect.

- [ ] **Step 1: Run targeted regression**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/condition-legacy-migration.test.ts tests/qa-condition-workstation.test.ts
```

- [ ] **Step 2: Run the full gate once**

```bash
pnpm check
```

Expected: typecheck PASS, all non-environment tests PASS, production build PASS.

- [ ] **Step 3: Stable-staging browser acceptance**

Verify normal Takeoff starts Condition-first, no Formula Composer/recipe-first entry is exposed, legacy assembly history is read-only, migrated pilot Takeoff quantity/worksheet/estimate identity is unchanged, and issued/history views remain reproducible.

- [ ] **Step 4: Update current-state documentation only after browser acceptance**

Modify `docs/CURRENT_STATE.md` with verified facts only.

- [ ] **Step 5: Update #39/#43 and stop before production mutation**

Record exact staging SHA, QA reconciliation report, CI/Vercel status, browser acceptance, and any production blockers. Production data migration/promotion requires a separate explicit approval and must first account for production migration-history state.
