# Carez Concrete OS — Current State

Last reconciled: 2026-09-06
Canonical development / QA line: `staging`
Production line: `main`
User QA target: stable `staging` Vercel alias defined in `BRANCH_AND_RELEASE_MODEL.md`

## Repository / release model

Carez uses a two-branch permanent model:

- `staging` — all normal development, integration, QA, and user acceptance;
- `main` — production only.

Nik must not be asked to select among feature branches, PR previews, or commit-specific Vercel URLs. Temporary implementation branches are exceptional/internal and must be merged/deleted before user QA.

Historical development evidence remains available through Git history, merged/closed PRs, issues, ADRs, module specs, tags, and releases rather than stale archive branches/files.

## Derived 3D verification implementation

The Issue #41 source update applies the accepted [3D implementation architecture](takeoff-3d-implementation-architecture.md): server-resolved facts, deterministic validated projections, shared plan/model selection and visibility, modern footing profiles, scoped quantity references, and explicit partial/unavailable states. Signed-in staging browser acceptance is pending. Cross-sheet registration and governed segment/instance overrides remain unsupported.

## Architecture already established

Preserve the existing Carez modernization and digital thread. Key accepted foundation includes:

- Supabase/PostgreSQL tenant model and RLS;
- stable page-coordinate Takeoff vector geometry with PDF as visual reference;
- scale regions/calibration, LF/SF/EA geometry, polygon cutouts, editing, duplication, keyboard nudge, undo/redo;
- atomic server-authoritative Takeoff → Concrete Condition/module output → estimate recalculation, with legacy assembly/scope compatibility lineage preserved where still referenced;
- immutable published legacy assembly/version/component history retained as compatibility/history rather than active standard authoring;
- versioned Platform Condition Archetype → Company Condition Template → Project Concrete Condition ownership with typed modules, provenance, holds, and exact output lineage;
- pricing override preservation;
- permanent vertically resizable Quantity Worksheet;
- ADR-016 Option D compact desktop application menubar with module-specific contextual panes;
- tenant-configurable company branding with immutable commercial-document branding snapshots;
- accepted Concrete Condition / derived 2D+3D Takeoff target;
- accepted ADR-020 integrated Takeoff workstation with fixed-width collapsible side panes and Carez precision cursor;
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

ADR-015 is the Carez-wide presentation authority. ADR-016 is the desktop shell authority and supersedes the permanent global desktop left rail and the earlier two-row top-navigation implementation. `docs/design-system/CAREZ_COMPONENT_PACK.md` defines the first shared Carez component pack. ADR-014 remains useful for source-owned shadcn component architecture where not superseded.

Implemented on canonical staging:

- current shadcn/ui source is installed in-repository under `components/ui` with Tailwind CSS v4, Base UI, semantic CSS variables, and the shadcn composition model;
- `components.json` uses the current shadcn Base Nova configuration with CSS variables enabled;
- `app/globals.css` now uses dark-first black/graphite semantic tokens for the authenticated application, neutral high-contrast primary actions, restrained semantic success/warning/destructive color, compact radii, and reduced-motion handling;
- the old B2/light visual override stack remains removed from the active `app/layout.tsx` import chain and the superseded B2/light presentation files remain absent from the active staging tree;
- `app/carez-shadcn-compat.css` and legacy global structural CSS imports still exist as a temporary migration bridge for unmigrated routes. They are not accepted final architecture and must be removed before Issue #44 closes;
- `components/AppShell.tsx` now implements ADR-016 Option D on desktop: one compact 44 px application menubar with tenant-configurable company logo / repository Carez fallback, inline Today / Preconstruction / Estimating / Projects / Field / Finance / Documents categories, global command/search, notifications/account controls, and no permanently stacked second global category row;
- global desktop categories now open compact anchored shadcn/Base UI dropdown menus rather than full-width mega-panels. Menus use dense destination rows without persistent explanatory copy; long categories use a bounded two-column treatment, and active categories/routes receive restrained emphasis;
- menubar/menu motion uses short functional transitions in the accepted ADR-016 range, while Base UI menu behavior supplies outside-click, Escape/focus handling, and keyboard menu navigation. Left/right category trigger traversal is retained and switching an already-open category by pointer reuses the same compact navigation scope;
- the permanent global desktop left app rail remains removed. Module-specific contextual panes remain allowed inside module workspaces;
- mobile navigation remains the accepted left-side Sheet/drawer pattern from ADR-016 rather than reproducing the desktop menubar on narrow screens;
- Settings remains under system/account navigation;
- Ctrl/Cmd+K continues to open the Carez command palette;
- `components/carez/` now contains the first shared source foundation: Carez Data Grid, Number Field, Date/Time Field/Range, Condition Tree, Toolbar, Resizable Workspace, File Upload, Loading States, and Motion helpers;
- `components/estimates/EstimateGrid.tsx` now consumes the shared Carez Data Grid while preserving estimate filtering, selection, keyboard navigation, pricing values, stage behavior, and estimate/proposal/job routing;
- `components/documents/DocumentUpload.tsx` now consumes Carez File Upload, Date/Time Field, Number Field, Loading State, and shadcn controls while preserving Supabase upload/metadata behavior and cleanup on failure;
- `components/takeoff/TakeoffPlanUpload.tsx` now consumes Carez File Upload and Loading State while preserving PDF-only intake, plan-attachment lineage, and the revision rule;
- `/takeoff/[setId]` now implements the browser-accepted ADR-020 integrated estimator workstation under closed Issue #51: `Plans | Conditions | Zones` contextual navigation, dominant drawing surface, one Condition Properties pane, 2D/3D/Split coordination, readable Quantity Worksheet, fixed-width independently collapsible side panes, no horizontal dock drag affordance, normal-size Carez cursor/precision crosshair, compact takeoff hover treatment, and scoped semantic shadcn/Base UI theming while preserving PDF.js/vector geometry authority;
- `/takeoff/[setId]` Condition Properties Direction A cleanup is browser-accepted under closed Issue #57: duplicate inspector inputs/search/chrome are removed, view modes occupy their own non-overlapping drawing rail, Calculated Outputs uses progressive disclosure, module and boolean controls use the shared labeled shadcn/Base UI Switch, OFF/ON states are immediately distinguishable by track/thumb contrast plus thumb position, and Save & recalculate round-trips the Condition without changing server-authoritative calculation or lineage;
- `/schedule` now implements the accepted Operations Grid presentation using the shared Carez Data Grid plus source-owned shadcn/Base UI Toggle Group, native select, dialog, dropdown menu, checkbox, input, badge, card, and empty-state primitives. It provides Work plan / Crew loading modes, a compact interactive 14-day date strip, search/readiness/type/range filtering, pinned Date/Job/Work context, resizable and sortable columns, row selection/keyboard navigation, semantic readiness treatment, consolidated row actions, a Related tools menu, and `+ Add work` as the primary action while preserving existing schedule/readiness/crew/domain records and server actions;
- the accepted `/schedule` render path no longer depends on the legacy `contractor-page`, `command-card`, `section`, or `industrial-grid-*` markup systems. Legacy global CSS remains loaded elsewhere until Issue #44 dependency checks prove all remaining consumers are migrated;
- Settings now includes a Company Branding control built from shared Carez File Upload and Loading State primitives. Authorized non-employee company users can upload PNG/JPEG/WebP branding up to 5 MB or reset to the repository Carez-wordmark fallback;
- branding metadata is stored in the RLS-protected `company_branding` table and logo files use the dedicated `carez-branding` bucket under tenant-owned `<company_id>/logos/...` paths with tenant-scoped write/delete policies;
- the authenticated top shell and mobile drawer load the active company logo and respond immediately to a successful Settings branding change without requiring a full sign-out/reload cycle;
- the active company logo is synchronized into the existing commercial billing-profile logo path where that module is present so newly created proposal/invoice snapshots continue using the existing commercial-document branding path; already-issued commercial records remain governed by their issuance snapshot and are not retroactively rewritten by a later Settings change;
- the company-branding migration includes purchase-order logo snapshot support when the purchase-order table is present. This conditional path is not yet browser-accepted on the isolated QA schema;
- the previous literal shadcn migrations for Login, Dashboard/Today, Owner Reports, Projects, Leads/Lead Inbox, Estimates, Proposals, Takeoff list/workbench, Assembly Library, Field Control, Cashflow, Billing, and Settings remain in place and will continue moving from page-local compositions toward the shared Carez pack when the interaction matches;
- specialized Takeoff drawing geometry/calculation code has not been rewritten. PDF visual reference, stable page-coordinate vector geometry, calibration, scale regions, geometry editing, quantity authority, and downstream lineage remain protected while presentation conversion proceeds.

Schedule Operations Grid code checkpoint `8d33584e63eec1634f03a14434efadd9a6ed7369` passed repository Typecheck, Domain tests, and the full Next.js production Build in GitHub Actions run 865. Its direct Vercel deployment was superseded/cancelled by the immediately following docs-only staging commit, but that next staging commit `f0a038f5f6262b9afa3034e90a440077390bc7a2` has `8d33584e...` as its parent and reached `READY` on the canonical stable staging alias, so the deployed staging tree includes the Schedule implementation.

Option D code checkpoint `1fd1b95662cc17c58dddfd9081cb079d07332463` passed repository Typecheck, Domain tests, and the full Next.js production Build in GitHub Actions run 853. Vercel produced a READY `staging` deployment for the same SHA and associated it with the canonical staging branch alias. A fetch of the stable staging URL returned HTTP 200 and the matching `1fd1b95` build identity before the unauthenticated application routed to Login.

Company-branding code checkpoint `00f4808d5f90e1a42b66071e9b655259d044ec26` passed repository Typecheck, Domain tests, and the full Next.js production Build in GitHub Actions run 837. The additive company-branding migration is applied to the isolated QA Supabase project; `company_branding` has RLS enabled and the `carez-branding` bucket is limited to PNG/JPEG/WebP at 5 MB with tenant-scoped write/delete policies.

These are implementation/build/deployment checkpoints, not rendered authenticated acceptance for the newly converted Schedule surface. Browser QA is still required for Schedule proportions, Work plan/Crew loading switching, date-strip single-day/range behavior, filters, pinned/resizable columns, row selection/actions, Add work, Related tools, empty state, responsive behavior, and preservation of readiness/crew scheduling behavior. Browser QA also remains required for the broader Option D/company-branding and remaining Issue #44 route-conversion scope. The stable deployment redirects unauthenticated tool requests to authentication, so automated source/deployment checks do not substitute for Nik's authenticated browser acceptance.

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
- automatic PDF sheet naming/indexing;
- authenticated Concrete Condition authoring/runtime acceptance for the three governed pilot families under closed Issue #40;
- authenticated dependency-gated Condition-first Takeoff cutover acceptance under closed Issue #50: no Scope Recipes launcher in the active Quantity Worksheet, no Build Plan / Build Method authoring, no direct legacy assembly creation, and legacy compatibility/history preserved outside active authoring;
- authenticated ADR-020 Direction A workstation acceptance under closed Issue #51: integrated contextual navigation + drawing + Condition Properties + Quantity Worksheet composition, fixed-width collapsible side panes, readable worksheet, compact hover treatment, normal-size Carez cursor, and scoped semantic shadcn/Base UI chrome;
- authenticated Condition Properties Direction A refinement acceptance under closed Issue #57: one Conditions search, non-overlapping view rail, duplicate inputs removed, archetype-aware fields, collapsible Calculated Outputs, labeled Switch controls with clearly distinct OFF/ON states, and successful Save & recalculate round-trip;
- accepted Takeoff UI pass showed no observed geometry/calculation/lineage regression; existing specialized measurement behavior remains authoritative unless a new regression is observed.

The earlier permanent-app-rail containment verification is historical shell evidence and is superseded by ADR-016. It does not authorize reintroducing the rail.

See Git history/issues for detailed acceptance evidence from earlier checkpoints.

## Integrated Takeoff workstation (Issue #51 — accepted)

The flagship `/takeoff/[setId]` workstation is browser-accepted on canonical staging under ADR-020 and Issue #51 is closed as completed.

Accepted presentation/interaction state:

- left contextual navigator is `Plans | Conditions | Zones`;
- center drawing surface remains dominant and continues using PDF.js plus stable page-coordinate vector geometry as measurement authority;
- right Condition Properties is the single normal property surface with estimator-facing tabs `General | Rebar | Forms | Excavation | Labor | Drawing | More`;
- left navigator and right Condition Properties use stable expanded widths and collapse/restore independently; no horizontal draggable dock boundary or legacy body-level pane-resize hook remains;
- Quantity Worksheet remains vertically resizable and its data-grid columns remain resizable;
- Quantity Worksheet typography is in the readable workstation range rather than legacy 6–8 px microtext;
- Carez arrow cursor is normal OS-scale, while measurement/calibration/editing uses the tighter precision crosshair and pan keeps native grab/grabbing behavior;
- takeoff hover uses a compact tooltip-like summary rather than the previous large card;
- specialized Takeoff chrome is scoped to Carez semantic shadcn/Base UI tokens rather than the older navy/bright-blue local palette;
- ReUI, HextaUI, JolyUI, and beUI are reference sources only; source-owned Carez/shadcn components remain the implementation authority;
- Issue #35 is closed with its remaining horizontal-resize criteria explicitly superseded by ADR-020 / Issue #51.

The final UX implementation checkpoint is `cfe406f2dbecfadea099ad4f1d3a01afd2cd5611`. Current staging is a descendant of that checkpoint, so the accepted workstation remains in the active development line.

## Concrete Condition foundation and persistence (Issue #40 — accepted)

The Concrete Condition domain and three governed pilot families are now an authenticated stable-staging browser-accepted baseline:

- an additive, versioned Platform Archetype → Company Template → Project Concrete Condition domain is present;
- module instances, typed input compartments, independent primary/secondary measurement roles, outputs, holds, provenance, and legacy IDs are explicit records;
- published platform/company versions and verified project versions are immutable;
- Pad / Column Footing, Strip / Wall Footing, and Slab on Grade are seeded as the first governed pilot families;
- the deterministic Condition kernel produces EA, LF, SF, CY, LB, and HR outputs, including cutout-adjusted slab area, isolated dependent holds, and traceable explicit overrides;
- the authenticated server-only persistence path loads measurement quantity/unit/geometry facts from Supabase rather than accepting calculated quantities from the browser;
- one transaction persists Condition inputs, module state, primary/secondary role assignments, outputs, holds, the legacy Takeoff compatibility projection, and generated estimate-item lineage;
- each projected Condition designates one compatibility anchor measurement; non-anchor role measurements keep their own geometry while their duplicate estimate lines are hidden, and detached role measurements restore their legacy output projection;
- optimistic concurrency rejects stale Condition or measurement snapshots;
- current versus superseded compatibility lineage and exact/held/inactive/mismatch states are exposed through reconciliation views;
- verification requires the current projected revision, every governed output, explicit holds, and a reconciled compatibility projection;
- source migration `20260904135826_condition_persistence_reconciliation.sql` is applied to the isolated QA Supabase project;
- deterministic pilot fixtures pass 10 tests;
- a rolled-back authenticated QA fixture passed exact projection, held-output persistence, stale-write rejection, multi-sheet secondary suppression, detach restoration, and zero orphan/duplicate estimate-line checks;
- the Condition authoring UI and server-action boundary are deployed on canonical `staging`; runtime defect `A "use server" file can only export async functions, found object` was resolved by `d179675e124a137df92d18fba1483af60a2c585f`, with GitHub Actions run 856 passing install/typecheck/domain tests/build and the matching Vercel deployment reaching `READY`;
- Nik accepted Issue #40 authenticated browser QA on the stable staging URL, and Issue #40 is closed as completed.

## Condition-first active-authoring cutover (Issue #50 — accepted)

The dependency-gated retirement of legacy Scope Recipe / Build Method authoring from the active governed Takeoff workflow is now browser-accepted on canonical staging:

- when every governed pilot archetype is active and has a published `concrete_condition_v1` version, active Takeoff mounts the Condition-first shell instead of `TakeoffAssemblyBuilderShell`;
- the active Condition-first workflow does not mount Scope Recipe / Formula Composer authoring;
- the Inspector does not expose Build Plan / Build Method authoring or direct legacy assembly creation;
- Measure / `M` routes through Concrete Conditions;
- direct duplicate paths that would bypass Condition role lineage remain blocked;
- the Quantity Worksheet no longer renders the legacy `Scope Recipes` launcher in Condition-first mode; the final launcher-leak fix is `c9889f746f0ed6fad8a286b90f8c11456679afa8`;
- Nik completed authenticated browser QA on the stable staging URL and accepted the final launcher fix;
- Issue #50 is closed as completed.

The existing assembly/formula/measurement/output/estimate runtime remains preserved as the compatibility/history layer. No legacy table, published version, measurement, output, or estimate history was deleted. The separate Assemblies destination may remain readable as compatibility/history outside the active Takeoff authoring workflow. Remaining physical schema/data retirement is dependency-gated and requires explicit proof that historical references and compatibility runtime dependencies are safe to remove. Destructive schema rollback or deletion is not allowed without a dedicated preservation/recovery plan.

Later 2D/derived-3D workstation work, broader Condition-family expansion, and dependency-gated data/schema retirement continue under the roadmap and follow-on issues; they are not reopeners of Issue #40, Issue #50, or the accepted Issue #51 UX baseline.

## Strip / Wall Footing P0.5C.1 (Issue #55 — active)

Issue #55 is the current pilot-parity owner for expanding the thin pilot Condition shell into a concrete-native estimating workstation while preserving the accepted Condition persistence and Takeoff workstation baselines.

Current Strip state on canonical staging:

- ADR-021 establishes current Condition output authority, construction-native reinforcing semantics, installed-versus-procurement separation, factor/crew-rate labor productivity, distinct calculation/commercial states, and categorized issues;
- Strip Contract v4 implements ADR-022: the duplicate drawable `End forms` EA role is removed from normal authoring and replaced by **End bulkheads / pour stops** using estimator-selected `Run endpoints`, `Explicit count`, or `None`; the run-endpoint candidate is derived server-side from authoritative saved Strip geometry rather than redrawn;
- Nik accepted the v4 End bulkheads / pour stops workflow in authenticated stable-staging browser QA;
- Strip Contract v5 implements ADR-023 and is the newest immutable Strip contract on staging: the old abstract `form_material_factor_lf_per_lf` input is removed from normal wood-lumber authoring; the estimator chooses the physical form board and Carez derives installed form-board LF from saved run geometry, formed sides, approved bulkheads, footing width/depth, and board courses;
- v5 does not fabricate board LF for Panel/Other systems; contact-area facts remain authoritative until an explicit panel/resource model exists;
- the v5 upgrader does not silently translate an older abstract LF/LF factor into a physical board choice; estimator review is required;
- published Strip v1-v4 history remains unchanged/readable and editable older drafts use governed upgrades rather than in-place contract mutation;
- current v5 implementation/deployment checkpoint is `d6a4e19d8343881f1722876d931ace36dacbeb05`; GitHub Actions run `34044445544` passed Typecheck, domain tests, and production build, and the matching stable staging deployment reached READY;
- rendered authenticated browser acceptance for Strip v5 is still pending, so Issue #55 remains open and v5 must not be called accepted yet;
- remaining pilot parity, including Pad / Column Footing and Slab on Grade completion where still required by Issue #55, remains active; additional Strip derived-3D expansion stays gated behind the accepted estimating/Condition contract rather than reopening the older model.

## Known bounded follow-up

- Issue #17 — optional free pan when the rendered PDF is smaller than the viewport.
- Issue #18 — investigate the Server Component render error if it reappears.
- Issue #29 — expose active outputs beyond Concrete/Reinforcing/Formwork through bounded selected-measurement detail rather than an ever-growing fixed worksheet.

## Current sequence

1. Complete Issue #55 focused Strip Contract v5 authenticated browser QA and the remaining P0.5 pilot-family parity required by the issue. Do not advance Strip-specific derived 3D by bypassing unresolved Condition/estimating acceptance.
2. Continue Issue #44 route conversion and the still-pending Schedule / ADR-016 / company-branding browser acceptance on the single stable staging URL, while treating the accepted `/takeoff/[setId]` workstation as a protected route baseline rather than redesigning it again.
3. Continue the P0.5 derived-3D sequence only from accepted current Condition contracts and authoritative persisted 2D geometry. Remaining legacy data/schema retirement stays dependency-gated, recoverable, and lineage-safe.

## Production rule

Do not push unaccepted work to `main` merely to simplify testing. All user acceptance occurs on `staging`; production promotion is an explicit release action after acceptance.
