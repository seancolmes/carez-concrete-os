# Carez Concrete OS — Current State

Last reconciled: 2026-09-03
Canonical development / QA line: `staging`
Production line: `main`
User QA target: stable `staging` Vercel alias defined in `BRANCH_AND_RELEASE_MODEL.md`

## Repository / release model

Carez now uses a two-branch permanent model:

- `staging` — all normal development, integration, QA, and user acceptance;
- `main` — production only.

Nik must not be asked to select among feature branches, PR previews, or commit-specific Vercel URLs. Temporary implementation branches are exceptional/internal and must be merged/deleted before user QA.

Historical development evidence remains available through Git history, merged/closed PRs, issues, ADRs, module specs, tags, and releases rather than stale archive branches/files.

## Architecture already established

Preserve the existing Carez modernization and digital thread. Key accepted foundation includes:

- Supabase/PostgreSQL tenant model and RLS;
- stable page-coordinate Takeoff vector geometry with PDF as visual reference;
- scale regions/calibration, LF/SF/EA geometry, polygon cutouts, editing, duplication, keyboard nudge, undo/redo;
- atomic server-authoritative Takeoff → assembly → estimate recalculation;
- immutable published assembly/version/component lineage;
- custom assembly authoring, nested assemblies, builder means/method profiles, and concrete resource outputs;
- pricing override preservation;
- permanent resizable Quantity Worksheet;
- B2 estimator-focused desktop workstation and permanent app rail;
- accepted Job Spine / bid-to-field commercial and execution lineage documented in Architecture/ADRs.

Do not restart or replace this architecture without demonstrated need.

## Environment authority

Staging QA isolation is verified and Issue #30 is closed:

- `main` / production uses the production Supabase project;
- Vercel `staging` uses branch-specific overrides to the isolated Carez QA Supabase project;
- the staging UI/browser has been verified with QA-only identity/data;
- mutation-heavy QA may occur on the stable staging QA deployment.

## Carez-wide light visual system

Issue #37 is the implementation owner for the newly approved Carez-wide light workstation visual system.

Implemented on canonical staging:

- ADR-011 now governs one shared light presentation system across authenticated desktop Carez pages while preserving purpose-specific mobile/field and customer-document treatment;
- `app/carez-light-workstation.css` supplies the shared light tokens, legacy variable compatibility, permanent dark navy app rail, light topbar/context drawer, common page hierarchy, surfaces, tables, controls, statuses, empty states, Dashboard / Today treatment, Owner Reports treatment, login treatment, and compatibility styling for Takeoff CSS modules;
- `app/carez-light-module-overrides.css` bridges legacy estimator/Takeoff/estimate surfaces that still contained hard-coded dark colors;
- `app/layout.tsx` loads both new presentation layers after the legacy styles so existing page behavior can migrate without rewriting domain components;
- `app/reports/page.tsx` now uses the approved Owner Reports visual hierarchy, semantic metric icons, clearer empty states, and existing-route CTAs without inventing unsupported reporting features;
- the approved Dashboard / Today and Owner Reports concepts remain reference surfaces for the rest of the application.

Automated validation for staging commit `e1f3481` passed Typecheck, Domain tests, and Next.js Build. Vercel reports that same staging commit READY on the single stable staging alias.

This is an implementation checkpoint, not visual acceptance. The shared system reaches authenticated routes through the common shell/tokens, but representative pages from every module still require rendered browser QA for contrast, overflow, density, special-purpose component overrides, and route-specific regressions. No page should be described as visually accepted solely from source/CI evidence.

## Verified Takeoff baseline

The following representative Takeoff behavior has already been browser-verified on canonical staging and should not be redone unless a regression is observed:

- permanent desktop app rail containment;
- two-axis Pan / middle-mouse / Space-drag behavior;
- anchored wheel zoom without accidental document scrolling;
- persisted whole-sheet and bounded regional calibration;
- LF measurement accuracy and persistence;
- geometry editing plus committed undo/redo;
- resolved-method nested resource outputs and exact estimate lineage;
- multi-measurement isolation;
- measurement deletion cleanup/isolation;
- cross-sheet `This Sheet` / `All Sheets` worksheet isolation;
- SF polygon + cutout calculation and exact downstream lineage;
- missing method-input holds;
- hover-only measurement detail behavior;
- B2 workstation readability baseline;
- automatic PDF sheet naming/indexing.

See Git history/issues for detailed acceptance evidence from earlier checkpoints.

## Current Takeoff UX work

Issue #35 remains the active bounded Takeoff presentation acceptance item and must be rechecked against the new light visual layer.

Implemented on staging before the light-system pass:

- PR #34 declutter/chrome changes merged into staging (`0ad693a`);
- pane/readability and decimal-LF worksheet behavior from superseded PR #36 consolidated directly into staging (`3abfb16`);
- sheet-row casing/status refinement consolidated directly into staging (`a1339ae`);
- sheet rows were reduced to quiet page/sheet identity with scale-status/count clutter removed;
- pane divider handling was corrected from clipped pane-local resize targets to workspace-level captured-pointer separators (`253cc38`);
- the cramped two-line Takeoff identity header was replaced with a compact horizontal set-name + estimate/revision hierarchy (`b7e06f8`, `0b8ecfa`).

Approved behavior:

- all sheet rows remain visually quiet regardless of scale state; the sheet pane does not show `Set scale`, `Not Scaled`, `Scaled`, scale-region counts, takeoff counts, warning boxes, or red status borders;
- scale state/actions remain in the drawing toolbar/status area and Properties scale controls where they are actionable;
- ordinary Carez UI headings/status/actions use sentence/title case, not automatic ALL CAPS;
- assembly provenance remains persisted for audit/lineage but is not permanently narrated in the Takeoff Inspector;
- duplicate helper/selection/status text is removed through progressive disclosure;
- Sheets and Inspector panes resize horizontally from their shared drawing boundaries while preserving a usable center drawing workspace;
- the Takeoff-set identity strip uses a compact professional hierarchy rather than stacked microtext;
- Quantity Worksheet LF quantities use decimal LF in the quantity column while architectural formatting remains available in drawing/detail contexts.

The corrective divider/header changes and the new light visual layer are implemented but are not accepted as fixed until the stable staging deployment is browser-verified. Issue #35 remains open until that acceptance occurs.

## Known bounded follow-up

- Issue #17 — optional free pan when the rendered PDF is smaller than the viewport.
- Issue #18 — investigate the Server Component render error if it reappears.
- Issue #29 — expose active outputs beyond Concrete/Reinforcing/Formwork through bounded selected-measurement detail rather than an ever-growing fixed worksheet.

## Current sequence

1. Browser-QA the Carez-wide light system on the stable staging alias, starting with Dashboard / Today, Owner Reports, Takeoff, and representative module routes; record route-specific corrections under Issue #37.
2. Re-verify and close Issue #35 when Takeoff pane/header/readability behavior is confirmed under the new light system.
3. Complete the remaining controlled EA Count / Takeoff P0 acceptance gate if still outstanding.
4. Reconcile Takeoff P0 completion in canonical specs/current state.
5. Continue P1 Estimating according to `ROADMAP.md` while using the approved light system as the presentation baseline.

## Production rule

Do not push unaccepted work to `main` merely to simplify testing. All user acceptance occurs on `staging`; production promotion is an explicit release action after acceptance.
