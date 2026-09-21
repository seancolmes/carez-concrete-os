# Carez Concrete OS — Current State

## Issue #76 / ADR-025 accepted — 2026-09-21

Issue #76 and ADR-025 — Carez Operations Workspace are **accepted on staging** at merge commit `457be2068a2b42f7883286a4f467f819e7fc049a` through PR #77 after Nik's visual approval. ADR-025 is now the active application presentation authority on staging. It supersedes ADR-024 presentation and ADR-016 shell arrangement where ADR-025 speaks; ADR-020 and the active Takeoff module contracts continue to protect Takeoff quantity/domain invariants.

The accepted Carez Experience System reference implementation establishes the shared masthead/workspace language plus the approved Today — Daily Command Center, Projects — Operations Board, and Documents — Evidence Hub experiences. The implementation preserves existing domain actions, database schema, RLS, tenant isolation, deterministic quantity/cost/pricing/financial calculations, and commercial lineage.

Validation for the exact staging merge commit passed GitHub Actions run `35572008076`, and Vercel reported success for the same commit. Branch-preview acceptance covered the reference experiences across desktop/mobile responsive layouts and light/dark presentation before Nik approved integration. The prior preview-environment correction remains historical evidence: after the initial preview inherited production Supabase defaults, branch-specific Preview overrides were corrected to the QA project before acceptance work continued.

Acceptance did **not** manufacture unrelated workflow evidence. QA still lacks `public.next_opportunity_number()`, which blocked populated direct-job creation acceptance, and the review browser did not provide GPU/WebGL rendering for graphical 3D. Those are separate environment/product follow-ups and are not claims made by the Issue #76 presentation acceptance.

Last reconciled: 2026-09-21  
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
- ADR-025 Carez Operations Workspace is the active application presentation/shell authority on staging as of `457be2068a2b42f7883286a4f467f819e7fc049a`. ADR-024 and ADR-016 remain historical/compatible foundations where not superseded. ADR-020 plus the active Takeoff module spec remain authoritative for Takeoff/workstation/domain invariants.
- Accepted Job Spine / bid-to-field commercial and execution lineage remains the architecture baseline.
- Derived 3D is verification from authoritative persisted 2D/Condition facts, not a second quantity engine.
- User-selected Takeoff visual/interaction baseline is source tree `09d39d3fc5f38d2387941b33f90b8834fdc22628`. The later specialist implementation commits were intentionally removed from `staging` and are not implementation authority. The left `Plans | Conditions | Zones` navigator, dominant drawing area, Condition Properties surface, and bottom Quantity Worksheet remain the protected Takeoff composition unless Nik explicitly approves a replacement.

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

Subproject 4 — refined-operations reference slice `Today → Project → Project Overview` — is **accepted/passed** as of 2026-09-19 at staging SHA `c3fce78688a8b7002d3641c9a78a48d4355ddfd5`. GitHub Actions run `35447375963` passed typecheck, domain/UI tests, and build; matching Vercel staging deployment `dpl_Afh47FBy3LfA9dC11MpJ8MFmfKqX` reached READY; authenticated browser QA passed the Today exception-first hierarchy, Projects select → inspect → act workflow, Project Overview operating-record hierarchy, responsive/mobile ordering, keyboard interaction, project-context continuity, and light/dark presentation.

Issue #76 / ADR-025 — Carez Operations Workspace — is **accepted/passed** as of 2026-09-21 at staging SHA `457be2068a2b42f7883286a4f467f819e7fc049a`. GitHub Actions run `35572008076` passed for the merge commit, Vercel reported success for the same commit, and Nik visually accepted the Today, Projects, and Documents reference experiences before PR #77 was merged.

Implemented on staging:

- source-owned shadcn/Base UI primitives, Tailwind v4, ADR-025 semantic light/dark tokens, density controls, and shared Carez components;
- ADR-025 Carez Operations Workspace / Experience System is the active visual direction: premium construction command center with selective Spatial Blueprint accents, Manrope-led hierarchy, meaningful icons, stronger shared tabs, three depth levels, restrained functional motion, and first-class light/dark/system presentation;
- ADR-025 application shell in `components/AppShell.tsx`: company identity/masthead, workspace directory, favorite destinations, command/search, notifications affordance, account/system access, and project context without a permanent global desktop left rail;
- canonical navigation model and deterministic shell logic in `lib/ui/navigation.ts`;
- versioned device-local navigation personalization scoped by authenticated user + company, with pin/unpin/reorder/reset and bounded role defaults;
- command palette navigation plus accessible-project and recent-workspace/project sources;
- project context row only for authoritative `/projects/[id]` and `/job-setup/[projectId]` routes, with safe project-switch route preservation/fallback;
- role-priority mobile bottom navigation plus touch-safe `More` sheet;
- permanent global desktop left rail and ADR-016 static category shell are not part of the accepted runtime;
- shared Carez Data Grid, Number Field, Date/Time Field/Range, Condition Tree, Toolbar, Resizable Workspace, File Upload, Loading States, Motion helpers, Related Tools, and Switch patterns;
- Issue #72 shared state contracts and components: Status, Save State, Authority State, Feedback, Provenance, Empty/Error composition, Inspector, Record Header, shared Project Context Bar, semantic Number Field variants, and Data Grid selection/sort/loading/empty/error/accessibility foundations;
- `/projects/[id]` uses the shared Record Header as the representative bounded consumer without changing its project queries/actions or redesigning the rest of Project Overview;
- shared operational presentation mappings and compact operating-metric primitives are source-owned under the Carez UI foundation;
- the accepted refined-operations reference slice now establishes the first rendered operational expression across Today, Projects, and Project Overview without changing quantity, cost, pricing, commercial, RLS, or lineage authority;
- Projects uses the shared Data Grid plus responsive Inspector/Sheet select → inspect → act pattern with keyboard selection/open behavior and explicit unavailable-state handling;
- Project Overview uses the approved operating-record hierarchy: attention, operating position, field/production, cost/forecast, commercial/billing, and next-job action, with mobile ordering that promotes the next action earlier;
- Settings/company branding remains implemented with tenant-scoped storage/RLS and commercial-document snapshot preservation.

ADR-016 and ADR-024 are historical/compatible foundations where not superseded; ADR-025 governs the accepted staging presentation and global shell/navigation behavior. ADR-020 continues to govern Takeoff quantity/domain invariants. Do not regress to the old static category shell, a permanent desktop left rail, or a competing presentation system.

## Derived 3D verification

Issue #41 — Unified synchronized 2D/3D Takeoff workstation — is **closed/completed** as of 2026-09-15. The accepted architecture and implementation use authoritative persisted 2D geometry, shared stable IDs/selection, server-resolved facts, deterministic validated projections, the active PDF plan plane, governed elevations/profiles, and explicit partial/unavailable states. 3D remains verification and never becomes a second quantity engine.

Cross-sheet building registration/stacking, direct 3D geometry authoring, and other deferred expansion remain outside the accepted #41 scope and require explicit follow-on work rather than reopening #41 by assumption.

## Active priorities

Issue #76 / ADR-025 is accepted and no longer an implementation gate. P0.5 Epic #43 remains open, and its sequence now controls the next product work.

1. **Issue #39 — P0.5E legacy recipe migration and active formula-UI retirement** is the next sequenced product priority. Inventory and classify referenced legacy recipe/variant/formula records, add stable compatibility mappings, migrate supported records, reconcile outputs/estimate lineage, preserve published/accepted history, and retire active legacy UI only after dependency proof.
2. Complete P0.5 end-to-end reconciliation and stable-staging browser acceptance after #39, then close Epic #43 only when its non-negotiable acceptance criteria are proven.
3. Continue into **P1 — Estimating** only after the P0.5 physical quantity/Condition foundation is accepted end-to-end.
4. **Issue #59** remains a production-release blocker. Resolve the production Supabase migration bridge before any migration-dependent `staging` → `main` promotion.
5. Preserve only active canonical/supporting documentation; Git history and closed issues preserve superseded implementation evidence.

## Production rule

All user acceptance occurs on `staging`. Promotion from `staging` to `main` is an explicit production release action after acceptance and, where migrations are involved, after Issue #59 production-bridge requirements are satisfied.
