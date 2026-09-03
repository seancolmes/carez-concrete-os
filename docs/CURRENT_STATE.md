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

Issue #35 is the active bounded Takeoff presentation acceptance item.

Implemented on staging:

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

The corrective divider/header changes are implemented but are not accepted as fixed until the stable staging deployment is browser-verified. Issue #35 remains open until that acceptance occurs.

## Known bounded follow-up

- Issue #17 — optional free pan when the rendered PDF is smaller than the viewport.
- Issue #18 — investigate the Server Component render error if it reappears.
- Issue #29 — expose active outputs beyond Concrete/Reinforcing/Formwork through bounded selected-measurement detail rather than an ever-growing fixed worksheet.

## Current sequence

1. Complete rendered acceptance of Issue #35 on the single staging QA link.
2. Complete the remaining controlled EA Count / Takeoff P0 acceptance gate if still outstanding.
3. Reconcile Takeoff P0 completion in canonical specs/current state.
4. Continue P1 Estimating according to `ROADMAP.md`.

## Production rule

Do not push unaccepted work to `main` merely to simplify testing. All user acceptance occurs on `staging`; production promotion is an explicit release action after acceptance.
