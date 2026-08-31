# Carez Concrete OS — Current State

Last reconciled: 2026-08-31
Canonical release line: `staging`
Governance work branch: `carez-governance-foundation`

## Repository state

- Private repository: `seancolmes/carez-concrete-os`.
- `staging` is the canonical modernization/release-candidate line.
- Production `main` remains protected from unverified promotion.
- Current observed `staging` head at governance start: `f9f81dbb8ccddee872d8d3154d42ae01e96ceccc` (`feat(ui): apply B2 estimator focus surfaces`).
- CI validates `main`, `staging`, and `carez-*` branches with frozen install, typecheck, domain tests, and build.

## Architecture already established

Completed P0 foundation includes:

- reproducible pnpm/Next.js build baseline;
- Supabase/PostgreSQL tenant model and RLS foundation;
- persisted Takeoff geometry in stable page coordinates;
- polygon holes/cutouts, arcs, geometry validation, vertex editing, duplication and keyboard nudging;
- committed geometry undo/redo;
- atomic server-side Takeoff → assembly → estimate recalculation;
- exact published assembly/version/component lineage;
- pricing override preservation through quantity recalculation;
- permanent resizable quantity worksheet;
- source/live migration reconciliation and focused function security hardening;
- domain/lineage tests.

Additional accepted foundation exists for custom assembly authoring, property bindings, nested immutable child assemblies, builder means/method profiles, concrete resource outputs, and B2 estimator-focused UI direction. These are continued architecture, not a rewrite target.

## Current UI state

Recent `staging` commits include B2 redesign work for dashboard/jobs/shell surfaces and restoration of rail context menus.

The prior architecture snapshot documented a blocking desktop shell defect where closing the context drawer also removed the permanent app rail. Because `staging` has received subsequent shell/B2 commits, that defect must now be treated as **requiring fresh browser verification**, not assumed open or assumed fixed from source history alone.

Desktop acceptance invariant remains:

```text
OPEN:   [ app rail ][ context drawer ][ workspace ]
CLOSED: [ app rail ][ workspace ]
```

## Current priority

1. Reconcile and browser-verify the current B2 desktop shell behavior on `staging`.
2. Complete authenticated Takeoff P0 QA against production-like records.
3. Reconcile active Takeoff/Estimating foundation documents into the canonical module specs.
4. Continue Estimating/P1 implementation only from the accepted lineage and builder-method foundation.

## Validation baseline

Last documented modernization validation before later B2 commits:

- TypeScript/typecheck: PASS.
- Domain/lineage tests: PASS.
- Optimized build: PASS.
- Public desktop/mobile browser QA: PASS for the then-current public-entry surfaces.

Because later UI commits exist, browser acceptance must be re-run for the affected B2 surfaces. Do not carry forward rendered-UI verification across later UI commits without evidence.

## Known deferred work

Takeoff/plan workstation items intentionally deferred from initial P0 include portions of:

- multi-select and clipboard workflows;
- whole-object pointer movement;
- layers;
- vector snapping;
- OCR/AI suggestions;
- revision overlays and migration;
- thumbnails and batch sheet operations.

Broader module modernization remains phased: Estimating, CRM/preconstruction, Projects/work packages/scheduling, Field/production/pour control, Procurement/finance/changes/billing, Documents/search/knowledge, AI plan intelligence, then final hardening.

## Rule for updating this file

Update `CURRENT_STATE.md` when a verified implementation milestone, active blocker, release-line change, or validation state changes. Do not use this file for long-term architecture rationale; use module specs or ADRs for that.
