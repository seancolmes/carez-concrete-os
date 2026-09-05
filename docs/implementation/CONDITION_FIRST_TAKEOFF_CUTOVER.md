# Condition-first Takeoff cutover

Status: accepted on authenticated stable `staging` browser QA; Issue #50 is complete.

Canonical decision: `docs/decisions/ADR-012-concrete-condition-engine.md`.
Implementation issue: #50.
Acceptance record: `docs/implementation/ISSUE_50_ACCEPTANCE.md`.
Validated implementation SHA: `84e24f4d5cc6984b0a7b3c2f8d5c21d3525985a8`.
Final launcher-leak fix SHA: `c9889f746f0ed6fad8a286b90f8c11456679afa8`.

## Dependency gate

The active Takeoff workflow switches from legacy Scope Recipe / Build Method authoring to Concrete Conditions only when every governed pilot archetype has:

- an active `platform_condition_archetypes` record; and
- a published `platform_condition_archetype_versions` record using `engine_key = concrete_condition_v1`.

The governed pilot set is `CONDITION_ARCHETYPE_KEYS` and currently covers the three P0.5 pilot families.

If the dependency gate is not satisfied or the gate query fails, Carez retains the legacy shell as an operational fallback. This is deliberate fail-closed behavior for the cutover; it is not permission to delete historical legacy data.

## Active Condition-first workflow

When the gate passes:

- `TakeoffConditionWorkflowShell` mounts the drawing workspace and Concrete Condition authoring without the Assembly Builder provider or Scope Recipe editor;
- full legacy builder-authoring data is not loaded for the active route;
- the Takeoff toolbar and `M` shortcut open Concrete Conditions instead of starting a direct legacy assembly measurement;
- the Inspector no longer exposes the legacy concrete assembly selector, Build Plan tab/workbench, TakeoffAssemblyInputEditor, or new legacy assembly-property authoring;
- the Quantity Worksheet does not expose the legacy `Scope Recipes` launcher when the Condition-first shell is active;
- Condition-required geometry is started from the Condition role and uses the hidden compatibility assembly/version only as an internal measurement/output bridge;
- the compatibility selection is one-shot and is cleared on completion, Escape/cancellation, or page change;
- direct duplication is not exposed in Condition-first mode through either the visible Duplicate action or the `D` keyboard shortcut because it would create geometry outside Condition role lineage;
- existing legacy takeoffs remain visible and editable as geometry/history but are labeled as legacy and do not regain legacy authoring controls.

## Preserved compatibility

This cutover intentionally does **not** delete:

- published assembly/recipe versions;
- formula ASTs;
- Build Method records;
- historical measurement/output lineage;
- accepted estimate/proposal references;
- compatibility assemblies used internally by the Condition bridge.

Physical schema/data retirement requires separate dependency proof and migration work after historical references and active runtime dependencies are proven safe. The read-only Assemblies destination outside the active Takeoff authoring workflow remains a compatibility/history surface until those later gates are satisfied.

## Validation checkpoint

QA dependency evidence confirms all three governed pilot archetypes are active and each has a published `concrete_condition_v1` version. Authenticated RLS permits reading the platform archetypes and published/retired archetype versions required by the server gate.

GitHub Actions run `33943617700` validated the final shortcut/lifecycle state with:

- dependency-safe source patch application;
- TypeScript typecheck;
- the domain suite including `condition-first-cutover.test.ts`;
- full Next.js production build;
- cleanup of the one-shot patch assets; and
- successful final push to `staging`.

The temporary validation workflow and patch script are absent from the resulting staging tree.

The final rendered QA exposed one remaining active-workflow leak: the Quantity Worksheet still rendered a `Scope Recipes` button even though the Condition-first shell did not mount the legacy Assembly Builder. Commit `c9889f746f0ed6fad8a286b90f8c11456679afa8` gates that launcher on actual Assembly Builder availability and adds regression coverage.

## Browser acceptance

Nik completed authenticated browser acceptance on the single stable `staging` Vercel URL after the final launcher fix. Accepted behavior:

- no Build Plan / Build Method tab or workbench;
- no direct legacy assembly creation in the active Condition-first Takeoff workflow;
- no `Scope Recipes` launcher beside the Quantity Worksheet;
- the remaining Condition-first workflow checks passed;
- the separate Assemblies destination under Estimating remains available only as preserved compatibility/history and is not considered active Takeoff legacy authoring.

Issue #50 is closed as completed. This acceptance does not authorize destructive deletion of legacy tables, published versions, formula/method records, or historical commercial lineage.

## Verification contract

Automated validation must include typecheck, domain tests, production build, and the `condition-first-cutover.test.ts` contract test. Final acceptance additionally requires authenticated browser verification on the single stable `staging` Vercel URL defined in `docs/BRANCH_AND_RELEASE_MODEL.md`.

That acceptance has now been completed for Issue #50. Future changes that touch the Condition-first shell, Quantity Worksheet launcher gating, or legacy compatibility boundary must preserve the accepted behavior or explicitly reopen the relevant QA scope.
