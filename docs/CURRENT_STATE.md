# Carez Concrete OS — Current State

Last reconciled: 2026-08-31
Canonical release line: `staging`
Governance work branch: `carez-governance-foundation`

## Repository state

- Private repository: `seancolmes/carez-concrete-os`.
- `staging` is the canonical modernization/release-candidate line.
- Production `main` remains protected from unverified promotion.
- Current observed `staging` head at browser verification: `17b745863cc8bbb3f555784e27146ff56b1de40f` (`docs: add mandatory Chat Work Codex routing`).
- Current B2 shell/UI implementation is present on this line through the earlier accepted shell/B2 commits, including `60d10f383e74961db9d2ccaec024d0785ad17575` (`fix(shell): restore B2 rail context menus`) and `f9f81dbb8ccddee872d8d3154d42ae01e96ceccc` (`feat(ui): apply B2 estimator focus surfaces`).
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

The prior architecture snapshot documented a blocking desktop shell defect where closing the context drawer also removed the permanent app rail. Fresh authenticated browser evidence on the current `staging` deployment at SHA `17b7458` now confirms that the historical defect is **not present in the tested desktop state**.

Observed browser evidence at a 1920×1032 Chrome window:

- Dashboard with Projects context drawer open: permanent app rail remains visible at left and the workspace remains to the right of the drawer.
- Dashboard with Dashboard context drawer open: permanent app rail remains visible and interactive.
- Authenticated Takeoff drawing workstation with Takeoff context drawer open: rail, drawer, sheet pane, canvas, inspector, and workstation chrome coexist without rail overlap.
- Same Takeoff drawing workstation after the context drawer closes: the permanent rail remains visible and the workstation reclaims only the drawer width.

Desktop shell invariant is therefore browser-verified **PASS** for the tested staging build and viewport:

```text
OPEN:   [ app rail ][ context drawer ][ workspace ]
CLOSED: [ app rail ][ workspace ]
```

This acceptance is specific to the tested staging SHA and desktop viewport. Rendered-UI verification must be repeated after later shell/UI changes.

## Current priority

1. Complete authenticated Takeoff P0 QA against production-like records.
2. Reconcile active Takeoff/Estimating foundation documents into the canonical module specs.
3. Continue Estimating/P1 implementation only from the accepted lineage and builder-method foundation.

## Validation baseline

- B2 desktop shell invariant: PASS on authenticated `staging` SHA `17b7458` at 1920×1032 Chrome viewport.
- Permanent rail retained through context drawer open/close on Dashboard and the Takeoff drawing workstation.
- Takeoff workstation reflow preserved sheet pane, drawing canvas, and inspector when the context drawer closed.
- Last documented modernization TypeScript/typecheck: PASS.
- Last documented domain/lineage tests: PASS.
- Last documented optimized build: PASS.
- Public desktop/mobile browser QA: PASS for the then-current public-entry surfaces.

Authenticated Takeoff P0 behavioral QA remains open; the shell acceptance above does not by itself verify geometry editing, calibration, persistence, lineage, worksheet behavior, or authenticated estimating workflows.

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
