# Carez Concrete OS — Current State

Last reconciled: 2026-09-02
Canonical release line: `staging`
Governance work branch: `carez-governance-foundation`

## Repository state

- Private repository: `seancolmes/carez-concrete-os`.
- `staging` is the canonical modernization/release-candidate line.
- Production `main` remains protected from unverified promotion.
- Latest browser-accepted Takeoff P0 QA/UX implementation is PR #24 from `carez-takeoff-p0-qa-ux-hardening`, branch head `9e2d8b995b25ba883788209ba224a6897e65dbe0` before reconciliation.
- Current B2 shell/UI implementation remains on this line through the accepted shell/B2 commits, including `60d10f383e74961db9d2ccaec024d0785ad17575` (`fix(shell): restore B2 rail context menus`) and `f9f81dbb8ccddee872d8d3154d42ae01e96ceccc` (`feat(ui): apply B2 estimator focus surfaces`).
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

Takeoff Issue #16 — mouse-wheel zoom also scrolling the PDF vertically — is **browser-verified PASS and closed** on canonical staging implementation commit `ddd61ed`.

Confirmed final authenticated browser acceptance:

- wheel input performs anchored zoom without independent vertical PDF/document scrolling;
- the existing `setZoomAt(...)` cursor/focal-point anchor behavior remains in use;
- the React `onWheel` path was replaced by a native wheel listener on the actual drawing viewport registered with `{ passive:false }`;
- existing two-axis panning remains accepted.

Authenticated scale/calibration persistence QA is **PASS**:

- existing saved drawing scales persist after sheet navigation and hard refresh;
- controlled manual calibration using a printed 2'-6" dimension entered as `2.5 FT` persists as both regional and whole-sheet/default calibration;
- Page scale correctly reports `SCALE SET` when a whole-sheet calibration is saved.

Controlled calibrated measurement QA is **PASS**:

- `QA - 2.5 FT calibration check` measured the known 2'-6" dimension at `2.50 LF` with a whole-sheet/default scale;
- saved geometry remained aligned to the PDF endpoints after navigation and hard refresh;
- Issue #19 regional-only measurement is now browser-verified PASS: a persisted bounded regional scale alone can authorize measurement creation without any whole-sheet/default scale present.

Controlled geometry editing / committed history QA is **PASS**:

- a saved LF measurement can be selected and edited;
- moving an endpoint and saving updates geometry and displayed quantity;
- Quantity Worksheet recalculates to the same edited quantity without duplication;
- committed undo/redo restores the expected geometry and quantity;
- the final state persists after hard refresh.

## Accepted Takeoff P0 QA/UX hardening — PR #24

Issues #20–#23 are browser-accepted and closed.

- **Issue #20 — missing required method choices / nested output holds: PASS.** Geometry may save while unresolved required `formwork_method`, `placement_method`, and `reinforcement_method` decisions remain explicit `missing_input` holds. The persistence path no longer collapses unresolved inactive branches to `not_priced`. Supplying method choices clears the applicable hold and preserves exact Takeoff → assembly → estimate lineage.
- **Issue #21 — hover-only measurement detail card: PASS.** The prior pinned measurement banner is removed. Saved LF/SF/EA geometry shows a compact estimator detail card only while directly hovered; selection/editing alone does not pin the card. Inspector and Quantity Worksheet remain the persistent-detail surfaces.
- **Issue #22 — B2 typography/readability: PASS.** Shared B2 workstation typography now generally uses the ~13px operational / ~12px helper-meta hierarchy while preserving dense estimator-workstation layout and shell containment.
- **Issue #23 — automatic PDF sheet naming/indexing: PASS.** Positioned PDF text/title-block inference populates `takeoff_sheets.sheet_number` and `title` when confidence is sufficient, preserves existing accepted metadata, keeps ambiguous sheets on `PDF Page N`, and does not change page identity/order, scale, geometry, or commercial lineage.

Automated validation for the accepted branch head `9e2d8b9` passed GitHub Actions typecheck, 46 focused/domain tests, and production build. The Issue #20 synchronization migration was also applied to the QA Supabase project and verified to preserve `missing_input` status.

## Remaining open Takeoff QA discoveries

- **Issue #17 — allow free pan when the rendered PDF is smaller than the viewport.** This remains a non-blocking Takeoff UX enhancement. It must remain a visual viewport transform only and must not mutate stable page-coordinate geometry.
- **Issue #18 — Server Component render error appears during scale-region QA.** Observed once; exact triggering action/request remains unconfirmed. Investigate immediately if it reappears.

Issue #19 is now closed as browser-verified PASS; no code change was required because the current staging behavior already satisfies the regional-scale contract.

## Current priority

1. Continue authenticated Takeoff P0 QA for broader Quantity Worksheet behavior and exact nested lineage using the accepted explicit-hold foundation.
2. Reproduce and diagnose Issue #18 if the Server Component render error reappears during controlled QA.
3. Evaluate/schedule Issue #17 as a non-blocking workstation UX enhancement.
4. Reconcile active Takeoff/Estimating foundation documents into canonical module specs as needed.
5. Continue Estimating/P1 implementation only from the accepted Takeoff lineage and builder-method foundation.

## Validation baseline

- B2 desktop shell invariant: **PASS** on authenticated desktop QA.
- Permanent rail retained through context drawer open/close on Dashboard and Takeoff.
- Takeoff workstation containment: **PASS**.
- Issue #14 two-axis pan / viewport containment: **PASS**, closed.
- Issue #16 wheel zoom/native-scroll interaction: **PASS**, closed.
- Drawing-scale persistence: **PASS**.
- Regional calibration creation/persistence: **PASS**.
- Regional-only LF/SF measurement creation without a whole-sheet/default scale: **PASS**, Issue #19 closed.
- Whole-sheet calibration creation/persistence: **PASS**.
- Controlled LF measurement accuracy/persistence: **PASS** at `2.50 LF` / 2'-6".
- Saved-geometry edit / worksheet recalculation / committed undo-redo / refresh persistence: **PASS**.
- Direct root Takeoff output → estimate-item provenance: **PASS**.
- Nested required-input hold behavior / output completeness: **PASS** under Issue #20 acceptance.
- Hover-only saved-measurement detail interaction: **PASS** under Issue #21 acceptance.
- B2 typography/readability pass: **PASS** under Issue #22 acceptance.
- Automatic PDF sheet naming/indexing: **PASS** under Issue #23 acceptance.
- GitHub Actions branch validation for `9e2d8b9`: **PASS**, including typecheck, 46 tests, and optimized build.
- Issue #17 free pan below fit-size: **OPEN**, non-blocking UX enhancement.
- Issue #18 intermittent Server Component error: **OPEN**, exact trigger not reproduced.

Authenticated Takeoff P0 behavioral QA can now continue from an accepted scale, nested-output, and UX foundation. The intermittent Server Component error if reproduced, broader worksheet behavior, and authenticated estimating workflows remain open work.

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