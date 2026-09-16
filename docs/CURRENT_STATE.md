# Carez Concrete OS — Current State

Last reconciled: 2026-09-15  
Canonical development / QA line: `staging`  
Production line: `main`  
User QA target: stable `staging` Vercel alias defined in `BRANCH_AND_RELEASE_MODEL.md`

## Repository / release model

- `staging` is the single normal development, integration, QA, and user-acceptance line.
- `main` is production only.
- Temporary implementation branches are exceptional/internal and must start from current `staging`, merge into `staging`, and be deleted before user QA.
- Nik tests only the stable staging Vercel URL.
- Unaccepted work is never pushed to `main` merely to simplify testing.

## Protected implemented baseline

- Supabase/PostgreSQL tenant model and RLS remain authoritative.
- PDF is Takeoff visual reference; persisted stable page-coordinate vector geometry is quantity authority.
- Scale/calibration, LF/SF/EA geometry, polygon cutouts, editing, duplication, keyboard nudge, and committed undo/redo are established behavior.
- Takeoff → Concrete Condition/module output → estimate recalculation is server-authoritative and preserves exact lineage plus referenced compatibility/history.
- Platform Condition Archetype → Company Condition Template → Project Concrete Condition ownership is versioned; published/verified history remains immutable.
- Pricing overrides and commercial-document issuance snapshots remain preserved.
- Production Quantity, Direct Cost, and Sell remain separate concepts.
- ADR-024 Precision Grid is the active application visual/theme/token/density authority. ADR-016 remains the currently implemented shell until the dedicated role-adaptive shell/navigation subproject replaces it; ADR-020 plus the active Takeoff module spec remain authoritative for Takeoff/workstation/domain invariants.
- Accepted Job Spine / bid-to-field commercial and execution lineage remains the architecture baseline.
- Derived 3D is verification from authoritative persisted 2D/Condition facts, not a second quantity engine.

## Environment / database authority

Staging QA isolation is verified:

- `main` / production remains bound to the production Supabase project.
- Vercel `staging` remains bound to the isolated Carez QA Supabase project.
- QA/local migration history is the canonical replay chain for staging development.
- Production Supabase migration history remains divergent and is governed by Issue #59; do not force-align or replay the QA bootstrap into production.

## Accepted Takeoff / Concrete Condition baseline

Issue #55 is **accepted/passed** as of 2026-09-07.

Accepted pilot-parity state includes:

- Concrete Condition domain and governed pilot-family workflow.
- Condition-first active Takeoff authoring; legacy recipe/formula authoring is not part of normal governed workflow.
- Integrated `/takeoff/[setId]` estimator workstation with `Plans | Conditions | Zones`, dominant drawing surface, fixed-width independently collapsible side panes, one Condition Properties surface, `2D | 3D | Split`, and vertically resizable Quantity Worksheet.
- Condition Properties Direction A refinement with archetype-aware tabs/fields, explicit switches, progressive-disclosure calculated outputs, hold visibility, and Save & recalculate round-trip.
- Strip / Wall Footing Contract v5 physical form-board model: estimator selects the actual board/system choice and Carez derives installed board LF from authoritative run geometry, formed sides, approved bulkheads, footing dimensions, and board courses. No duplicate footing LF input is required.
- Strip End bulkheads / pour stops use governed derived/explicit/none count sources and no longer misuse unit-only Pad / Column Footing compatibility identity.
- Repeatable reinforcing/anchors/misc module instances, measurement-role binding, pricing/commercial reconciliation, draft deletion/reset behavior, and post-geometry-edit Condition invalidation/recalculation are implemented in staging.
- Geometry edits invalidate stale Condition projections and trigger recalculation of the affected projected draft Condition instead of leaving stale output authority.

Issue #55 is no longer an active sequencing gate. Do not reopen or re-test it without a new regression or explicit follow-on requirement.

## Global UI / shared system state

Issue #44 is **accepted/closed** at staging SHA `388b8f35682ddd23c9c9f69a907d65d724e63fa2`; the prior dark-shadcn route conversion, compatibility-layer removal, and route-family browser acceptance are historical baseline, not an active implementation gate.

Implemented on staging:

- source-owned shadcn/Base UI primitives, Tailwind v4, semantic dark tokens, and shared Carez components;
- ADR-016 compact top menubar in `components/AppShell.tsx`;
- permanent global desktop left rail removed;
- shared Carez Data Grid, Number Field, Date/Time Field/Range, Condition Tree, Toolbar, Resizable Workspace, File Upload, Loading States, Motion helpers, Related Tools, and Switch patterns;
- `/schedule` source conversion exists but rendered acceptance remains pending;
- Settings/company branding is implemented with tenant-scoped storage/RLS and commercial-document snapshot preservation;
- `app/carez-shadcn-compat.css` and remaining legacy structural presentation are still temporary migration debt and must be removed before Issue #44 closes.

A successful source/build/deployment checkpoint is not rendered acceptance. Pending Issue #44 surfaces still require authenticated browser QA on the stable staging URL.

## Derived 3D verification

Issue #41 remains open. The accepted architecture uses server-resolved facts, deterministic validated projections, shared plan/model selection and visibility, modern footing profiles, scoped quantity references, and explicit partial/unavailable states.

Signed-in stable-staging browser acceptance and bounded expansion remain pending. Cross-sheet registration and governed segment/instance overrides remain unsupported.

## Active priorities

Issue #63 — Precision Grid canonical authority + token foundation — is accepted on staging. The accepted foundation includes first-class Light/Dark/System preference, pre-hydration theme resolution, device-local appearance persistence, Inter + IBM Plex Mono typography roles, Precision Grid semantic light/dark tokens, root default/compact/comfortable density state, and Settings appearance controls. This does not imply that the later role-adaptive shell, project-context layer, shared-component expansion, or route/module redesign slices are implemented.

1. Continue the approved Carez OS major UI/UX redesign through the next independently planned subproject: Global shell + navigation context. Preserve ADR-024 and the accepted Issue #63 foundation while doing so.
2. Continue Issue #41 derived-3D acceptance/expansion from the accepted current Condition contracts and authoritative persisted 2D geometry.
3. Resolve Issue #59 before any production migration promotion or `staging` → `main` release that depends on the canonical QA migration chain.
4. Preserve only active canonical/supporting documentation in the repository tree. Superseded working documents and completed implementation checkpoint files should be deleted after their surviving truth is absorbed by canonical owners; Git history and closed issues preserve historical evidence.

## Production rule

All user acceptance occurs on `staging`. Promotion from `staging` to `main` is an explicit production release action after acceptance and, where migrations are involved, after Issue #59 production-bridge requirements are satisfied.
