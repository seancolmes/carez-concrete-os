# Carez Concrete OS — Current State

Last reconciled: 2026-09-04
Canonical development / QA line: `staging`
Production line: `main`
User QA target: stable `staging` Vercel alias defined in `BRANCH_AND_RELEASE_MODEL.md`

## Repository / release model

Carez uses a two-branch permanent model:

- `staging` — all normal development, integration, QA, and user acceptance;
- `main` — production only.

Nik must not be asked to select among feature branches, PR previews, or commit-specific Vercel URLs. Temporary implementation branches are exceptional/internal and must be merged/deleted before user QA.

Historical development evidence remains available through Git history, merged/closed PRs, issues, ADRs, module specs, tags, and releases rather than stale archive branches/files.

## Architecture already established

Preserve the existing Carez modernization and digital thread. Key accepted foundation includes:

- Supabase/PostgreSQL tenant model and RLS;
- stable page-coordinate Takeoff vector geometry with PDF as visual reference;
- scale regions/calibration, LF/SF/EA geometry, polygon cutouts, editing, duplication, keyboard nudge, undo/redo;
- atomic server-authoritative Takeoff → assembly/scope → estimate recalculation;
- immutable published assembly/version/component lineage;
- custom assembly authoring, nested assemblies, builder means/method profiles, and concrete resource outputs;
- pricing override preservation;
- permanent resizable Quantity Worksheet;
- ADR-016 compact top application header + global category navigation shell with module-specific contextual panes;
- accepted Concrete Condition / derived 2D+3D Takeoff target;
- accepted Job Spine / bid-to-field commercial and execution lineage documented in Architecture/ADRs.

Do not restart or replace this architecture without demonstrated need.

## Environment authority

Staging QA isolation is verified and Issue #30 is closed:

- `main` / production uses the production Supabase project;
- Vercel `staging` uses branch-specific overrides to the isolated Carez QA Supabase project;
- the staging UI/browser has been verified with QA-only identity/data;
- mutation-heavy QA may occur on the stable staging QA deployment.

## Dark shadcn application redesign + ADR-016 shell

Issue #44 is the implementation and rendered-acceptance owner for the Carez-wide UI replacement.

ADR-015 is the Carez-wide presentation authority. ADR-016 is the desktop shell authority and supersedes the permanent global desktop left rail. `docs/design-system/CAREZ_COMPONENT_PACK.md` defines the first shared Carez component pack. ADR-014 remains useful for source-owned shadcn composition architecture where not superseded.

Implemented on canonical staging:

- current shadcn/ui source is installed in-repository under `components/ui` with Tailwind CSS v4, Base UI, semantic CSS variables, and the shadcn composition model;
- `components.json` uses the current shadcn Base Nova configuration with CSS variables enabled;
- `app/globals.css` now uses dark-first black/graphite semantic tokens for the authenticated application, neutral high-contrast primary actions, restrained semantic success/warning/destructive color, compact radii, and reduced-motion handling;
- the old B2/light visual override stack remains removed from the active `app/layout.tsx` import chain and the superseded B2/light presentation files remain absent from the active staging tree;
- `app/carez-shadcn-compat.css` and legacy global structural CSS imports still exist as a temporary migration bridge for unmigrated routes. They are not accepted final architecture and must be removed before Issue #44 closes;
- `components/AppShell.tsx` now implements the ADR-016 desktop shell: compact top application header, authentic Carez wordmark, global category navigation row, wide animated category panels, global command/search, notifications/account controls, and mobile Sheet navigation;
- the permanent global desktop left app rail is removed from the current shell source. Module-specific contextual panes remain allowed inside module workspaces;
- global category navigation currently groups Today, Preconstruction, Estimating, Projects, Field, Finance, and Documents; Settings remains under system/account navigation;
- category panels use a shared container with approximately 180 ms functional motion, pointer-intent delay, outside-click close, Escape close/focus return, keyboard left/right category traversal, ArrowDown panel entry, animated chevrons/indicators, and reduced-motion support;
- Ctrl/Cmd+K continues to open the Carez command palette;
- `components/carez/` now contains the first shared source foundation: Carez Data Grid, Number Field, Date/Time Field/Range, Condition Tree, Toolbar, Resizable Workspace, File Upload, Loading States, and Motion helpers;
- `components/estimates/EstimateGrid.tsx` now consumes the shared Carez Data Grid while preserving estimate filtering, selection, keyboard navigation, pricing values, stage behavior, and estimate/proposal/job routing;
- `components/documents/DocumentUpload.tsx` now consumes Carez File Upload, Date/Time Field, Number Field, Loading State, and shadcn controls while preserving Supabase upload/metadata behavior and cleanup on failure;
- `components/takeoff/TakeoffPlanUpload.tsx` now consumes Carez File Upload and Loading State while preserving PDF-only intake, plan-attachment lineage, and the revision rule;
- the previous literal shadcn migrations for Login, Dashboard/Today, Owner Reports, Projects, Leads/Lead Inbox, Estimates, Proposals, Takeoff list/workbench, Assembly Library, Field Control, Cashflow, Billing, and Settings remain in place and will continue moving from page-local compositions toward the shared Carez pack when the interaction matches;
- specialized Takeoff drawing geometry/calculation code has not been rewritten. PDF visual reference, stable page-coordinate vector geometry, calibration, scale regions, geometry editing, quantity authority, and downstream lineage remain protected while presentation conversion proceeds.

Code checkpoint `cba54dd7bebafdb474ab6afd3148682a0b2ec349` passed the repository Typecheck, Domain tests, and full Next.js production Build in GitHub Actions run 828. Vercel produced a READY `staging` deployment for the same code SHA and associated it with the canonical staging branch alias. A fetch-level smoke of the stable staging URL returned HTTP 200 and the matching `cba54dd` build identity before the unauthenticated application routed to Login.

This is an implementation/build/deployment checkpoint, not rendered authenticated acceptance. Browser QA is still required for the top-shell pointer/keyboard/focus behavior, actual category-panel motion, account/project context, contrast, overflow, responsive/mobile behavior, route presentation, and Takeoff workstation interactions. Issue #44 remains open.

## Verified Takeoff baseline

The following representative Takeoff behavior has already been browser-verified on canonical staging and should not be redone unless a regression is observed:

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
- automatic PDF sheet naming/indexing.

The earlier permanent-app-rail containment verification is historical shell evidence and is superseded by ADR-016. It does not authorize reintroducing the rail.

See Git history/issues for detailed acceptance evidence from earlier checkpoints.

## Current Takeoff UX work

Issue #35 remains the bounded Takeoff presentation/behavior acceptance item and must be checked under the ADR-016 top-navigation shell without reopening already verified measurement behavior.

Previously implemented behavior still required:

- sheet rows remain visually quiet regardless of scale state; the sheet pane does not show `Set scale`, `Not Scaled`, `Scaled`, scale-region counts, takeoff counts, warning boxes, or red status borders;
- scale state/actions remain in the drawing toolbar/status area and Properties scale controls where they are actionable;
- ordinary Carez UI headings/status/actions use sentence/title case;
- assembly/condition provenance remains persisted for audit/lineage but is not permanently narrated in the Takeoff Inspector;
- duplicate helper/selection/status text is removed through progressive disclosure;
- Sheets and Inspector panes resize horizontally from their shared drawing boundaries while preserving a usable center drawing workspace;
- the Takeoff-set identity strip uses a compact professional hierarchy rather than stacked microtext;
- Quantity Worksheet LF quantities use decimal LF in the quantity column while architectural formatting remains available in drawing/detail contexts.

The dark shadcn/ADR-016 redesign must not regress these behaviors or the newer Concrete Condition / derived 2D+3D workstation target.

## Concrete Condition foundation (Issue #40 — in progress)

This checkpoint begins the accepted Concrete Condition runtime without replacing working Takeoff behavior:

- an additive, versioned Platform Archetype → Company Template → Project Concrete Condition domain is present;
- module instances, typed input compartments, independent primary/secondary measurement roles, outputs, holds, provenance, and legacy IDs are explicit records;
- published platform/company versions and verified project versions are immutable;
- Pad / Column Footing, Strip / Wall Footing, and Slab on Grade are seeded as the first governed pilot families;
- the deterministic Condition kernel produces EA, LF, SF, CY, LB, and HR outputs, including cutout-adjusted slab area, isolated dependent holds, and traceable explicit overrides;
- a one-way adapter maps governed Condition results into the existing atomic Takeoff/output/estimate payload;
- the additive migrations are applied to the isolated QA Supabase project, all 11 new tables have RLS, and Supabase reports no Condition-domain security or uncovered-foreign-key advisories;
- deterministic pilot fixtures currently pass 7 tests.

The existing assembly/formula/measurement/output/estimate runtime remains active as the compatibility layer. This checkpoint does not switch the Takeoff UI, delete legacy schema, infer structural engineering requirements, or claim full Issue #40 acceptance.

Still open under Issue #40: end-to-end persistence/recalculation wiring, authenticated pilot CRUD and cross-sheet browser QA, representative old/new reconciliation, orphan checks, and the later UI transition coordinated with Issue #39.

## Known bounded follow-up

- Issue #17 — optional free pan when the rendered PDF is smaller than the viewport.
- Issue #18 — investigate the Server Component render error if it reappears.
- Issue #29 — expose active outputs beyond Concrete/Reinforcing/Formwork through bounded selected-measurement detail rather than an ever-growing fixed worksheet.

## Current sequence

1. Browser-QA the ADR-016 top shell on the single stable staging URL: category pointer intent, keyboard traversal, focus return, Escape/outside-click behavior, command menu, mobile Sheet, contrast, and overflow.
2. Continue Issue #44 route conversion using the shared Carez component pack, prioritizing Takeoff contextual panes/toolbar/workspace, Estimate Worksheet, Projects/Schedule grids, Documents, and remaining secondary/detail routes; remove compatibility/legacy CSS only when no runtime consumer remains.
3. Re-verify and close Issue #35 when Takeoff pane/header/readability behavior is confirmed under the new shell without measurement regressions.
4. Continue the accepted Concrete Condition / derived 2D+3D Takeoff implementation sequence and remaining controlled acceptance gates from `ROADMAP.md`.

## Production rule

Do not push unaccepted work to `main` merely to simplify testing. All user acceptance occurs on `staging`; production promotion is an explicit release action after acceptance.