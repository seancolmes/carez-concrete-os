# Carez Concrete OS — Current State

Last reconciled: 2026-09-03
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
- permanent desktop app rail;
- accepted Concrete Condition / derived 2D+3D Takeoff target;
- accepted Job Spine / bid-to-field commercial and execution lineage documented in Architecture/ADRs.

Do not restart or replace this architecture without demonstrated need.

## Environment authority

Staging QA isolation is verified and Issue #30 is closed:

- `main` / production uses the production Supabase project;
- Vercel `staging` uses branch-specific overrides to the isolated Carez QA Supabase project;
- the staging UI/browser has been verified with QA-only identity/data;
- mutation-heavy QA may occur on the stable staging QA deployment.

## shadcn/ui application redesign

Issue #44 is the implementation and rendered-acceptance owner for the Carez-wide UI replacement.

ADR-014 supersedes ADR-011 as the shared presentation/component authority. The previous B2/light visual system is no longer authoritative.

Implemented on canonical staging:

- current shadcn/ui source is installed in-repository under `components/ui` with Tailwind CSS v4, Base UI, semantic CSS variables, and the shadcn composition model;
- `components.json` uses the current shadcn Base Nova configuration with CSS variables enabled;
- `app/globals.css` is the Carez semantic shadcn theme: light neutral application surfaces, restrained Carez blue interaction color, semantic success/warning/destructive states, and permanent dark sidebar tokens;
- the old B2/light visual override stack is removed from the active `app/layout.tsx` import chain;
- superseded B2/light presentation files were physically removed from the active staging tree, including the former B2 theme/module/workstation files, light-workstation override files, and page-specific commercial/CRM/review visual override files;
- `app/carez-shadcn-compat.css` is a temporary migration bridge for unmigrated legacy markup; it is not a second design system and must shrink as route components move to literal shadcn primitives;
- `components/AppShell.tsx` is rebuilt with the actual shadcn `Sidebar` system (`SidebarProvider`, `Sidebar`, `SidebarContent`, groups/menus, `SidebarFooter`, `SidebarRail`, `SidebarInset`, `SidebarTrigger`) plus shadcn Breadcrumb, Command, Button, Separator, and Tooltip behavior;
- the permanent desktop rail remains intact and collapses to the shadcn icon rail; mobile uses the same Sidebar/Sheet foundation;
- Ctrl/Cmd+K opens a shadcn Command route palette;
- Login is rebuilt with shadcn Card/Input/Label/Button;
- Dashboard / Today is rebuilt with shadcn Card, Badge, Table, Empty, Progress, and Button primitives while preserving its management/readiness/cash logic;
- Owner Reports is rebuilt with shadcn Card, Badge, Table, Empty, and Button primitives while preserving current authoritative report queries;
- Projects and the Jobs Operations Board are rebuilt with shadcn Card, Table, Badge, Input, Progress, Dialog, Dropdown Menu, Sheet, Empty, and Button primitives while preserving job-readiness and financial calculations;
- Leads and Lead Inbox are rebuilt with shadcn Card, Badge, Dialog, Input, Label, Textarea, Table, Empty, and Button primitives while preserving opportunity numbering, lead-to-estimate lineage, Outlook classification, candidate review, activity, follow-up, and conversion behavior;
- Estimates and the Estimate Grid are rebuilt with shadcn Card, Table, Tabs, Checkbox, Badge, Input, Dialog, Sheet, Empty, and Button primitives while preserving estimate revision, selection, stage, audit/proposal/job routing, and pricing calculations;
- Proposals is rebuilt with shadcn Card, Badge, Empty, and Button primitives while preserving immutable issued proposal state, engagement events, customer responses, follow-up, accepted-job linkage, and commercial values;
- the Takeoff list/workbench is rebuilt with shadcn Card, Badge, Input, Empty, and Button primitives while preserving Takeoff set creation, plan attachment, pricing-hold handling, manual verified-quantity fallback, and exact downstream lineage;
- Assembly Library is rebuilt with shadcn Card, Badge, Dialog, Input, Label, Empty, and Button primitives while preserving published version/resource/variable lineage and owner-reviewed labor/risk settings;
- Field Control is rebuilt with shadcn Card, Dialog, Input, Label, Textarea, Badge, Table, Empty, and Button primitives while preserving GPS evidence, employee shift review, manual correction, daily logs, and production-source boundaries;
- Cashflow is rebuilt with shadcn Card and Button primitives while preserving bank cash, protected money, payroll, AP, commitments, expenses, reserves, and safe-to-spend calculations;
- Billing is rebuilt with shadcn Card, Badge, Table, Empty, and Button primitives while preserving authorized contract, billing, A/R, retainage, and cash-collected values;
- Settings is rebuilt with shadcn Card, Badge, Button, and Table primitives while preserving Outlook/Plaid state, labor tax settings, L&I risk classes, overhead routing, and authentication behavior;
- specialized Takeoff drawing geometry/calculation code has not been rewritten as part of the visual replacement. Its chrome is temporarily normalized through the shadcn theme/compatibility bridge until bounded component migration can occur without risking measurement authority.

The shadcn direction is based on the current shadcn/ui installation, theming, Sidebar, Table/Data Table, Resizable, Tabs, Dialog/Sheet/Popover/Dropdown Menu, form, and block patterns. Carez owns the generated component source and composes it into concrete-native workstations rather than imitating shadcn appearance with a separate custom theme.

Automated code validation at the current shadcn checkpoint has confirmed Typecheck and Domain tests. The matching staging deployment completed the full Next.js production build and is READY on the canonical staging alias.

This is an implementation/build checkpoint, not rendered visual acceptance. Authenticated cross-route QA is still required for contrast, spacing, overflow, mobile behavior, Takeoff workstation chrome, and any legacy-markup selectors still served through the temporary compatibility bridge.

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
- automatic PDF sheet naming/indexing.

See Git history/issues for detailed acceptance evidence from earlier checkpoints.

## Current Takeoff UX work

Issue #35 remains the bounded Takeoff presentation/behavior acceptance item and must be checked under the new shadcn shell without reopening already verified measurement behavior.

Previously implemented behavior still required:

- sheet rows remain visually quiet regardless of scale state; the sheet pane does not show `Set scale`, `Not Scaled`, `Scaled`, scale-region counts, takeoff counts, warning boxes, or red status borders;
- scale state/actions remain in the drawing toolbar/status area and Properties scale controls where they are actionable;
- ordinary Carez UI headings/status/actions use sentence/title case;
- assembly/condition provenance remains persisted for audit/lineage but is not permanently narrated in the Takeoff Inspector;
- duplicate helper/selection/status text is removed through progressive disclosure;
- Sheets and Inspector panes resize horizontally from their shared drawing boundaries while preserving a usable center drawing workspace;
- the Takeoff-set identity strip uses a compact professional hierarchy rather than stacked microtext;
- Quantity Worksheet LF quantities use decimal LF in the quantity column while architectural formatting remains available in drawing/detail contexts.

The shadcn redesign must not regress these behaviors or the newer Concrete Condition / derived 2D+3D workstation target.

## Known bounded follow-up

- Issue #17 — optional free pan when the rendered PDF is smaller than the viewport.
- Issue #18 — investigate the Server Component render error if it reappears.
- Issue #29 — expose active outputs beyond Concrete/Reinforcing/Formwork through bounded selected-measurement detail rather than an ever-growing fixed worksheet.

## Current sequence

1. Browser-QA Dashboard / Today, Projects, Leads / Lead Inbox, Takeoff list, Takeoff drawing workspace, Estimates, Proposals, Owner Reports, Field, Billing/Cashflow, Settings, and representative remaining routes on the single stable staging URL.
2. Correct route-specific visual/interaction regressions under Issue #44; continue replacing temporary compatibility selectors with literal shadcn components on remaining secondary/detail routes.
3. Re-verify and close Issue #35 when Takeoff pane/header/readability behavior is confirmed under the shadcn shell.
4. Continue the accepted Concrete Condition / derived 2D+3D Takeoff implementation sequence and remaining controlled acceptance gates from `ROADMAP.md`.

## Production rule

Do not push unaccepted work to `main` merely to simplify testing. All user acceptance occurs on `staging`; production promotion is an explicit release action after acceptance.
