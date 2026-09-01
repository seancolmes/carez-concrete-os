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

Authenticated scale/calibration persistence QA is also **PASS** on staging:

- an existing saved drawing scale remained present after switching sheets and returning;
- the existing scale remained present after a hard browser refresh;
- a controlled manual calibration using a printed 2'-6" dimension entered as `2.5 FT` was successfully assigned to a bounded scale region;
- the new manual scale region remained present after sheet navigation and hard refresh;
- the same controlled 2.5 FT calibration was then applied with **Use whole sheet**; the page reported `SCALE SET`, the whole-sheet scale remained present after sheet navigation, and it remained present after a hard refresh.

Controlled calibrated measurement QA is also **PASS with a whole-sheet/default scale present**:

- `QA - 2.5 FT calibration check` was measured across the same printed 2'-6" dimension using an LF assembly;
- the saved raw result matched the known dimension at `2.50 LF` / 2'-6";
- the measurement remained present after sheet navigation and hard refresh;
- the saved geometry remained aligned to the same PDF endpoints.

Controlled geometry editing / committed history QA is also **PASS** on staging:

- a saved LF measurement could be selected and entered into Edit mode;
- moving an endpoint and saving updated the persisted geometry and displayed measurement quantity;
- the Quantity Worksheet recalculated to the same edited quantity without creating a duplicate measurement;
- committed undo restored the prior geometry and quantity;
- committed redo restored the edited geometry and quantity;
- the final redone geometry and quantity remained present after a hard refresh.

Backend lineage inspection is **PARTIAL PASS / BLOCKED**:

- the latest edited `FTG-STRIP` v7 measurement persists at `5.0105 LF` against the accepted Page 4 default scale;
- its active ready-mix output recalculates to `0.3186 CY`;
- the generated estimate item points back to the exact source Takeoff output, source measurement, and published assembly version;
- however, required `formwork_method`, `placement_method`, and `reinforcement_method` values are unresolved, `method_profile_id` is null, and the dependent nested child outputs are silently inactive / `not_priced` at zero quantity instead of surfacing explicit missing-input holds.

Four separate Takeoff QA discoveries remain open:

- **Issue #17 — allow free pan when the rendered PDF is smaller than the viewport.** This is a Takeoff UX enhancement caused by the current scroll-container pan model having no scroll range when the paper is smaller than the viewport. It must remain a visual viewport transform only and must not mutate stable page-coordinate geometry. It does not by itself reopen Issue #14.
- **Issue #18 — Server Component render error appears during scale-region QA.** The error was observed once in authenticated Takeoff QA while calibration persistence still succeeded. The exact triggering action/request has not yet been reproduced or confirmed, so the issue remains open and should be investigated immediately if it reappears.
- **Issue #19 — regional scale cannot start measurement until whole-sheet scale is set.** Authenticated QA showed that a bounded regional calibration alone did not accept LF/SF measurement clicks, while the same workflow worked after setting a whole-sheet/default scale. Current source is intended to accept geometry wholly inside a valid regional scale without requiring a default page scale, so this is an open interaction/scale-resolution defect rather than an intended requirement.
- **Issue #20 — missing required method choices silently deactivate child outputs instead of creating holds.** Authenticated backend inspection confirmed that unresolved required footing method selectors can leave formwork / placement / reinforcement branches inactive without explicit `missing_input` holds, even though direct root output lineage remains correct. This blocks full Takeoff → assembly → estimate lineage acceptance.

## Current priority

1. Resolve and browser/domain-verify Issue #20 so unresolved required method choices cannot silently remove dependent assembly outputs from estimator review.
2. Continue authenticated Takeoff P0 QA for Quantity Worksheet and exact lineage once method/output completeness is explicit.
3. Reproduce and diagnose Issue #18 if the Server Component render error reappears during the next controlled QA action.
4. Diagnose Issue #19 without blocking unrelated Takeoff QA that can proceed under a valid whole-sheet scale.
5. Evaluate/schedule Issue #17 as a Takeoff workstation UX enhancement without blocking unrelated P0 acceptance unless testing shows it prevents representative estimator workflows.
6. Reconcile active Takeoff/Estimating foundation documents into the canonical module specs.
7. Continue Estimating/P1 implementation only from the accepted lineage and builder-method foundation.

## Validation baseline

- B2 desktop shell invariant: PASS on authenticated staging desktop QA.
- Permanent rail retained through context drawer open/close on Dashboard and the Takeoff drawing workstation.
- Takeoff workstation reflow preserves sheet pane, drawing canvas, inspector, and Quantity Worksheet containment.
- Takeoff Issue #14 two-axis pan / vertical viewport containment: **PASS on deployed `7eeb26e`**; issue closed.
- Takeoff Issue #16 wheel zoom/native scroll interaction: **PASS on deployed `ddd61ed`**; issue closed.
- Existing drawing-scale persistence through sheet navigation and hard refresh: **PASS**.
- Controlled manual calibration-region creation and persistence through sheet navigation and hard refresh: **PASS** using a printed 2'-6" dimension / `2.5 FT` calibration.
- Controlled whole-sheet manual calibration and persistence: **PASS** using the same printed 2'-6" dimension / `2.5 FT` calibration.
- Controlled LF measurement accuracy and persistence with a whole-sheet/default scale present: **PASS** at `2.50 LF` / 2'-6" with geometry remaining aligned after navigation and hard refresh.
- Controlled saved-geometry edit / Quantity Worksheet recalculation / committed undo-redo / hard-refresh persistence: **PASS**.
- Direct root Takeoff output → estimate-item provenance on the inspected `FTG-STRIP` v7 measurement: **PASS**; active ready-mix output and estimate item retain exact measurement/output/assembly-version lineage.
- Full nested assembly-output completeness / missing-input behavior: **BLOCKED by Issue #20**.
- `ddd61ed` Vercel staging deployment: success.
- `ddd61ed` Carez OS Branch Build run 525: PASS, including typecheck, domain tests, and optimized build.
- Takeoff Issue #17 free pan below fit-size: OPEN UX enhancement.
- Takeoff Issue #18 intermittent Server Component render error during scale-region QA: OPEN; exact trigger not yet reproduced.
- Takeoff Issue #19 regional-only scale measurement path: OPEN; whole-sheet scale is a current workaround, not the intended long-term requirement.
- Takeoff Issue #20 unresolved required method selections / silent child-output deactivation: OPEN P0 lineage blocker.
- Public desktop/mobile browser QA: PASS for the then-current public-entry surfaces.

Authenticated Takeoff P0 behavioral QA remains open; full downstream assembly-output completeness, exact nested lineage, broader worksheet behavior, regional-scale measurement resolution, and authenticated estimating workflows are not fully accepted yet.

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
