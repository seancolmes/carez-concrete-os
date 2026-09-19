# Carez Concrete OS — Current State

Last reconciled: 2026-09-19  
Canonical development / QA line: `staging`  
Production line: `main`  
User QA target: stable `staging` Vercel alias defined in `BRANCH_AND_RELEASE_MODEL.md`

## Repository / release model

- `staging` is the single normal development, integration, QA, and user-acceptance line.
- `main` is production only.
- Temporary implementation branches are exceptional/internal and must start from current `staging`, merge into `staging`, and be deleted before user QA.
- Nik tests only the stable staging Vercel URL.
- Unaccepted work is never pushed to `main` merely to simplify testing.

## Development-agent architecture

- The primary interactive implementation path is the local Carez Codex workstation.
- Codex Web UI provides the browser interface while the real Codex `app-server` remains the coding agent/runtime.
- The isolated Codex home routes through local OmniRoute to Ollama; the current default local model is `gpt-oss:20b`.
- OmniRoute routing was verified with successful `provider=ollama-local`, `model=gpt-oss:20b`, `status=200` requests.
- Workstation provider/auth/model state remains outside the repository; Carez source has no runtime dependency on Codex Web UI, OmniRoute, Ollama, OpenCode, or a hosted AI plan.
- Root `CODEX.md` is now the canonical model-independent Codex execution contract; `docs/workflow/LOCAL_CODEX_WORKSTATION.md` owns the current workstation topology.
- GitHub Actions → Vercel staging → browser QA remains the acceptance chain after local implementation.

## Protected implemented baseline


- Supabase/PostgreSQL tenant model and RLS remain authoritative.
- PDF is Takeoff visual reference; persisted stable page-coordinate vector geometry is quantity authority.
- Scale/calibration, LF/SF/EA geometry, polygon cutouts, editing, duplication, keyboard nudge, and committed undo/redo are established behavior.
- Takeoff → Concrete Condition/module output → estimate recalculation is server-authoritative and preserves exact lineage plus referenced compatibility/history.
- Platform Condition Archetype → Company Condition Template → Project Concrete Condition ownership is versioned; published/verified history remains immutable.
- Pricing overrides and commercial-document issuance snapshots remain preserved.
- Production Quantity, Direct Cost, and Sell remain separate concepts.
- ADR-024 Precision Grid is the active application visual/theme/token/density and implemented global shell/navigation authority. Issue #71's role-adaptive Hybrid command shell is accepted on staging; ADR-016 is retained only for compatible historical principles. ADR-020 plus the active Takeoff module spec remain authoritative for Takeoff/workstation/domain invariants.
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

Issue #44 is **accepted/closed** at staging SHA `388b8f35682ddd23c9c9f69a907d65d724e63fa2`; that broad shadcn route-conversion effort is historical baseline, not an active implementation gate.

Issue #63 — Precision Grid token/theme/density foundation — is **accepted** on staging.

Issue #71 — role-adaptive global shell + navigation context — is **accepted/passed** as of 2026-09-19 at staging SHA `876737182fc3eec1ea38e67a04cf87dfa0d6ed1f`. Matching GitHub Actions validation passed, the matching Vercel staging deployment reached READY, and authenticated browser QA passed desktop, project-context/switching, navigation personalization, command palette, responsive/mobile behavior, and light/dark presentation.

Issue #72 — shared component/state foundation — is **accepted/passed** as of 2026-09-19 at staging SHA `40259ae36e11091239841e5bfadc7c3dd24623c0`. GitHub Actions run `35443858878` passed typecheck, domain/UI tests, and build; matching Vercel staging deployment `dpl_5sRWx1uBUNVzCDQfcaNqPBmMpKB2` reached READY; authenticated browser QA passed the bounded Project Overview Record Header, preserved project-context behavior, light/dark, responsive desktop/mobile, and keyboard-focus acceptance matrix.

Implemented on staging:

- source-owned shadcn/Base UI primitives, Tailwind v4, ADR-024 Precision Grid semantic light/dark tokens, density controls, and shared Carez components;
- ADR-024 Hybrid command shell in `components/AppShell.tsx`: company identity, 3–5 role-priority destinations, structured `More`, command/search, notifications affordance, and account/system access;
- canonical navigation model and deterministic shell logic in `lib/ui/navigation.ts`;
- versioned device-local navigation personalization scoped by authenticated user + company, with pin/unpin/reorder/reset and bounded role defaults;
- command palette navigation plus accessible-project and recent-workspace/project sources;
- project context row only for authoritative `/projects/[id]` and `/job-setup/[projectId]` routes, with safe project-switch route preservation/fallback;
- role-priority mobile bottom navigation plus touch-safe `More` sheet;
- permanent global desktop left rail and ADR-016 static category shell are not part of the accepted runtime;
- shared Carez Data Grid, Number Field, Date/Time Field/Range, Condition Tree, Toolbar, Resizable Workspace, File Upload, Loading States, Motion helpers, Related Tools, and Switch patterns;
- Issue #72 shared state contracts and components: Status, Save State, Authority State, Feedback, Provenance, Empty/Error composition, Inspector, Record Header, shared Project Context Bar, semantic Number Field variants, and Data Grid selection/sort/loading/empty/error/accessibility foundations;
- `/projects/[id]` uses the shared Record Header as the representative bounded consumer without changing its project queries/actions or redesigning the rest of Project Overview;
- Settings/company branding remains implemented with tenant-scoped storage/RLS and commercial-document snapshot preservation.

ADR-016 is now historical for compatible retained principles; ADR-024 governs the accepted global shell/navigation behavior. Do not regress to the old static category shell or a permanent desktop left rail.

## Derived 3D verification

Issue #41 remains open. The accepted architecture uses server-resolved facts, deterministic validated projections, shared plan/model selection and visibility, modern footing profiles, scoped quantity references, and explicit partial/unavailable states.

Signed-in stable-staging browser acceptance and bounded expansion remain pending. Cross-sheet registration and governed segment/instance overrides remain unsupported.

## Active priorities

Issues #63, #71, and #72 are accepted on staging. Together they establish the current application-wide Precision Grid theme/token/density foundation, role-adaptive project-aware shell, and shared component/state/accessibility foundation. The refined-operations and specialist reference slices are not yet accepted.

1. Independently plan and execute Subproject 4 — the refined-operations reference slice `Today → Project → Project Overview` — from the accepted Issues #63 + #71 + #72 foundation. Preserve existing domain/query behavior and prove the Overview/Record archetypes, balanced density, dual theme, project context, role-aware shell, shared state components, and responsive behavior before broader route migration.
2. Continue Issue #41 derived-3D acceptance/expansion from the accepted current Condition contracts and authoritative persisted 2D geometry.
3. Resolve Issue #59 before any production migration promotion or `staging` → `main` release that depends on the canonical QA migration chain.
4. Preserve only active canonical/supporting documentation in the repository tree. Superseded working documents and completed implementation checkpoint files should be deleted after their surviving truth is absorbed by canonical owners; Git history and closed issues preserve historical evidence.

## Production rule

All user acceptance occurs on `staging`. Promotion from `staging` to `main` is an explicit production release action after acceptance and, where migrations are involved, after Issue #59 production-bridge requirements are satisfied.
