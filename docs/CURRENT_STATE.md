# Carez Concrete OS — Current State

Last reconciled: 2026-09-06  
Canonical development / QA line: `staging`  
Production line: `main`  
User QA target: stable `staging` Vercel alias defined in `BRANCH_AND_RELEASE_MODEL.md`

This file is the concise current implementation/verification checkpoint. It does not duplicate detailed closed-issue history, implementation transcripts, or architecture rationale. Those remain available in the owning module specs, ADRs, GitHub issues/PRs, commits, tags/releases, and Git history.

## Repository / release model

- `staging` is the single normal development, integration, QA, and user-acceptance line.
- `main` is production only.
- Temporary implementation branches are exceptional/internal and must start from current `staging`, merge into `staging`, and be deleted before user QA.
- Nik tests only the stable staging Vercel URL; do not route acceptance through feature/PR/commit-specific previews.
- Never push unaccepted work to `main` merely to simplify testing.

## Protected implemented baseline

Preserve the existing modernization and digital thread unless new evidence demonstrates a need to change it:

- Supabase/PostgreSQL tenant model and RLS remain authoritative.
- PDF is Takeoff visual reference; persisted stable page-coordinate vector geometry is quantity authority.
- Scale/calibration, LF/SF/EA geometry, polygon cutouts, editing, duplication, keyboard nudge, and committed undo/redo are established behavior.
- Takeoff → Concrete Condition/module output → estimate recalculation is server-authoritative and preserves exact lineage plus referenced legacy compatibility/history.
- Platform Condition Archetype → Company Condition Template → Project Concrete Condition ownership is versioned; published/verified history remains immutable.
- Pricing overrides and commercial-document issuance snapshots remain preserved.
- Production Quantity, Direct Cost, and Sell remain separate concepts.
- ADR-015 dark shadcn presentation and ADR-016 Option D compact desktop menubar are the active global UI authorities.
- ADR-020 integrated Takeoff workstation is the accepted flagship workstation baseline.
- Accepted Job Spine / bid-to-field commercial and execution lineage remains the architecture baseline.
- Derived 3D is verification from authoritative persisted 2D/Condition facts, not a second quantity engine.

## Environment / database authority

Staging QA isolation is verified:

- `main` / production remains bound to the production Supabase project.
- Vercel `staging` remains bound to the isolated Carez QA Supabase project.
- The staging UI/browser has been verified with QA-only identity/data; mutation-heavy QA may occur there.

The canonical QA/local migration baseline is verified:

- repository history is a 30-migration canonical replay chain;
- clean local reset/replay succeeds through all 30 migrations;
- replayed local `public` schema SHA-256 matches live QA: `222FE00A31FDCD50657F181B78B5A1F5055E993936A3A9C86E5505E715441E44`;
- migration SQL is LF-normalized through `.gitattributes`;
- `pnpm check` passes the configured typecheck, test suite, and production build;
- linked-QA `supabase db push --dry-run` reports `Remote database is up to date`;
- production Supabase was not modified by the QA/local reconciliation.

Issue #59 is the production-release blocker for reconciling production migration history with the canonical QA/local baseline. Production migration history must not be repaired, reset, force-aligned, or replayed from the QA bootstrap without the explicit bridge/recovery evidence required by that issue.

## Global UI / shared system state

Issue #44 remains open as the Carez-wide dark shadcn route-conversion and rendered-acceptance owner.

Implemented on canonical staging:

- source-owned shadcn/Base UI primitives, Tailwind v4, semantic dark tokens, and the shared Carez component pack are present;
- `components/AppShell.tsx` implements the ADR-016 Option D compact top menubar; the permanent global desktop left rail remains removed;
- module-specific contextual panes remain allowed inside their workspaces;
- shared Carez Data Grid, Number Field, Date/Time Field/Range, Condition Tree, Toolbar, Resizable Workspace, File Upload, Loading States, Motion helpers, and related shared compositions exist and are being reused;
- `/schedule` has the Operations Grid source conversion while rendered authenticated acceptance remains pending;
- Settings/company branding is implemented with tenant-scoped storage/RLS and commercial-document snapshot preservation; broader rendered acceptance remains pending;
- `app/carez-shadcn-compat.css` and remaining legacy global structural CSS are still a temporary migration bridge and must be removed before Issue #44 closes.

A successful source/build/deployment checkpoint is not rendered acceptance. Pending Issue #44 surfaces still require authenticated browser QA on the stable staging URL.

## Accepted Takeoff / Concrete Condition baselines

The following are accepted and should not be reopened or re-tested without a new regression or explicit follow-on requirement:

- Issue #40 — Concrete Condition domain and the three governed pilot families are authenticated stable-staging accepted, including server-only persistence, typed modules/inputs, measurement roles, outputs/holds, optimistic concurrency, compatibility projection, and exact estimate lineage.
- Issue #50 — Condition-first active Takeoff authoring is accepted: normal governed authoring no longer exposes Scope Recipe / Formula Composer, Build Plan / Build Method, direct legacy assembly creation, or duplicate paths that bypass Condition role lineage; referenced legacy history remains preserved.
- Issue #51 / ADR-020 — `/takeoff/[setId]` integrated estimator workstation is browser-accepted with `Plans | Conditions | Zones`, dominant drawing surface, fixed-width independently collapsible side panes, one Condition Properties surface, `2D | 3D | Split`, and the vertically resizable Quantity Worksheet.
- Issue #57 — Condition Properties Direction A refinement is browser-accepted, including archetype-aware tabs/fields, shadcn/Base UI Switch controls, progressive-disclosure Calculated Outputs, hold visibility, and successful Save & recalculate round-trip.
- The accepted Takeoff pass showed no observed geometry/calculation/lineage regression; specialized measurement behavior remains authoritative unless a new regression is observed.

Detailed acceptance evidence and implementation checkpoints remain in the owning closed issues/ADRs and Git history rather than being repeated here.

## Derived 3D verification

The Issue #41 source update implements the accepted derived-3D architecture using server-resolved facts, deterministic validated projections, shared plan/model selection and visibility, modern footing profiles, scoped quantity references, and explicit partial/unavailable states.

Signed-in stable-staging browser acceptance remains pending. Cross-sheet registration and governed segment/instance overrides remain unsupported. Do not advance Strip-specific derived 3D by bypassing unresolved Condition/estimating acceptance.

## Active P0.5 pilot parity — Issue #55

Issue #55 is the current pilot-parity owner for expanding the Concrete Condition shell into the concrete-native estimating workstation while preserving the accepted Condition persistence and Takeoff baselines.

Current Strip / Wall Footing state:

- ADR-021 governs current output authority, reinforcing semantics, installed-versus-procurement separation, labor productivity, calculation/commercial states, and categorized issues.
- Strip Contract v4 End bulkheads / pour stops is authenticated browser-accepted.
- Strip Contract v5 / ADR-023 is the newest immutable Strip contract on staging: the estimator chooses the physical wood form board and Carez derives installed form-board LF from authoritative run geometry, formed sides, approved bulkheads, footing dimensions, and board courses.
- v5 does not fabricate board LF for Panel/Other systems; contact-area facts remain authoritative until an explicit resource model exists.
- older published Strip v1-v4 history remains unchanged/readable; older editable drafts use governed upgrades rather than in-place contract mutation.
- Strip v5 source/build/deployment validation is complete, but authenticated rendered acceptance is still pending; Issue #55 remains open and v5 must not be called accepted yet.
- remaining pilot parity, including Pad / Column Footing and Slab on Grade completion where required by Issue #55, remains active.

## Pending acceptance / bounded follow-up

Current pending work relevant to sequencing:

- Issue #55 — Strip v5 authenticated browser QA and remaining P0.5 pilot-family parity.
- Issue #44 — remaining route conversion plus pending Schedule / ADR-016 / company-branding rendered acceptance.
- Issue #41 — derived-3D signed-in browser acceptance and later bounded expansion from accepted Condition contracts.
- Issue #59 — production Supabase migration-history bridge before production migration promotion.
- Issue #17 — optional free pan when rendered PDF is smaller than the viewport.
- Issue #18 — investigate the Server Component render error if it reappears.
- Issue #29 — expose active outputs beyond Concrete/Reinforcing/Formwork through bounded selected-measurement detail rather than an ever-growing fixed worksheet.

## Current sequence

1. Complete Issue #55 focused Strip Contract v5 authenticated browser QA and the remaining P0.5 pilot-family parity required by the issue. Do not advance Strip-specific derived 3D by bypassing unresolved Condition/estimating acceptance.
2. Continue Issue #44 route conversion and the still-pending Schedule / ADR-016 / company-branding browser acceptance on the single stable staging URL, while treating the accepted `/takeoff/[setId]` workstation as a protected route baseline rather than redesigning it again.
3. Continue the P0.5 derived-3D sequence only from accepted current Condition contracts and authoritative persisted 2D geometry. Remaining legacy data/schema retirement stays dependency-gated, recoverable, and lineage-safe.

## Production rule

All user acceptance occurs on `staging`. Promotion from `staging` to `main` is an explicit production release action after acceptance and, where migrations are involved, after Issue #59 production-bridge requirements are satisfied.
