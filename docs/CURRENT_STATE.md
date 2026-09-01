# Carez Concrete OS — Current State

Last reconciled: 2026-08-31
Canonical release line: `staging`
Governance work branch: `carez-governance-foundation`

## Repository state

- Private repository: `seancolmes/carez-concrete-os`.
- `staging` is the canonical modernization/release-candidate line.
- Production `main` remains protected from unverified promotion.
- Last browser-verified Takeoff workstation implementation commit: `ddd61edc088127202a1057d3b2ccb620cb53a4ac` (`fix(takeoff): prevent native wheel scroll during zoom`).
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

The prior architecture snapshot documented a blocking desktop shell defect where closing the context drawer also removed the permanent app rail. Fresh authenticated browser evidence confirmed that historical defect is not present in the tested desktop state.

Desktop shell invariant remains browser-verified **PASS**:

```text
OPEN:   [ app rail ][ context drawer ][ workspace ]
CLOSED: [ app rail ][ workspace ]
```

Takeoff Issue #14 — drawing viewport vertical containment / two-axis panning — is **browser-verified PASS and closed** on canonical staging implementation commit `7eeb26e`.

Confirmed final authenticated browser acceptance:

- middle-mouse drag pans left/right and up/down;
- explicit Pan tool pans left/right and up/down;
- Space + left-drag pans left/right and up/down;
- panning remains correct after Quantity Worksheet collapse/expand;
- panning remains correct after Takeoff context drawer open/close;
- permanent app rail, sheet pane, drawing canvas, inspector, and Quantity Worksheet remain contained inside the desktop workstation.

The accepted root cause was workstation-shell height containment, not the Takeoff pan handler. The desktop workstation shell/main now receives a definite viewport-height boundary while normal long-form pages retain document scrolling.

Takeoff Issue #16 — mouse-wheel zoom also scrolling the PDF vertically — is now **browser-verified PASS and closed** on canonical staging implementation commit `ddd61ed`.

Confirmed final authenticated browser acceptance:

- wheel input performs anchored zoom without independent vertical PDF/document scrolling;
- the existing `setZoomAt(...)` cursor/focal-point anchor behavior remains in use;
- the React `onWheel` path was replaced by a native wheel listener on the actual drawing viewport registered with `{ passive:false }`;
- existing two-axis panning remains accepted;
- Vercel deployment for `ddd61ed` reports success;
- Carez OS Branch Build run 525 passed typecheck, domain tests, and optimized build.

One separate Takeoff QA discovery remains open:

- **Issue #17 — allow free pan when the rendered PDF is smaller than the viewport.** This is a Takeoff UX enhancement caused by the current scroll-container pan model having no scroll range when the paper is smaller than the viewport. It must remain a visual viewport transform only and must not mutate stable page-coordinate geometry. It does not by itself reopen Issue #14.

## Current priority

1. Resume authenticated Takeoff P0 QA against production-like records.
2. Evaluate/schedule Issue #17 as a Takeoff workstation UX enhancement without blocking unrelated P0 acceptance unless testing shows it prevents representative estimator workflows.
3. Reconcile active Takeoff/Estimating foundation documents into the canonical module specs.
4. Continue Estimating/P1 implementation only from the accepted lineage and builder-method foundation.

## Validation baseline

- B2 desktop shell invariant: PASS on authenticated staging desktop QA.
- Permanent rail retained through context drawer open/close on Dashboard and the Takeoff drawing workstation.
- Takeoff workstation reflow preserves sheet pane, drawing canvas, inspector, and Quantity Worksheet containment.
- Takeoff Issue #14 two-axis pan / vertical viewport containment: **PASS on deployed `7eeb26e`**; issue closed.
- Takeoff Issue #16 wheel zoom/native scroll interaction: **PASS on deployed `ddd61ed`**; issue closed.
- `ddd61ed` Vercel staging deployment: success.
- `ddd61ed` Carez OS Branch Build run 525: PASS, including typecheck, domain tests, and optimized build.
- Takeoff Issue #17 free pan below fit-size: OPEN UX enhancement.
- Public desktop/mobile browser QA: PASS for the then-current public-entry surfaces.

Authenticated Takeoff P0 behavioral QA remains open; geometry editing, calibration, persistence, lineage, worksheet behavior, and authenticated estimating workflows are not fully accepted yet.

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
