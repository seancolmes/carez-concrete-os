# Condition-first Takeoff cutover

Status: implemented on `staging`; browser acceptance is required before this is treated as fully verified.

Canonical decision: `docs/decisions/ADR-012-concrete-condition-engine.md`.

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
- Condition-required geometry is started from the Condition role and uses the hidden compatibility assembly/version only as an internal measurement/output bridge;
- the compatibility selection is one-shot and is cleared on completion, cancellation, or page change;
- direct duplication is not exposed in Condition-first mode because it would create geometry outside Condition role lineage;
- existing legacy takeoffs remain visible and editable as geometry/history but are labeled as legacy and do not regain legacy authoring controls.

## Preserved compatibility

This cutover intentionally does **not** delete:

- published assembly/recipe versions;
- formula ASTs;
- Build Method records;
- historical measurement/output lineage;
- accepted estimate/proposal references;
- compatibility assemblies used internally by the Condition bridge.

Physical schema/data retirement requires separate dependency proof and migration work after historical references and active runtime dependencies are proven safe.

## Verification contract

Automated validation must include typecheck, domain tests, production build, and the `condition-first-cutover.test.ts` contract test. Final acceptance additionally requires browser verification on the single stable `staging` Vercel URL defined in `docs/BRANCH_AND_RELEASE_MODEL.md`.
