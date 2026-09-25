# Carez Concrete OS — Current State

Last reconciled: 2026-09-23
Canonical development / QA line: `staging`  
Production line: `main`  
User QA target: stable `staging` Vercel alias

## Execution model

Carez implementation follows the normal local workflow:

```text
ChatGPT control room
→ local Codex
→ local validation
→ local browser/runtime QA
→ Nik acceptance
→ GitHub Desktop local commit
→ batched staging release
```

Local working-tree changes and local commits are authoritative for in-progress work; `origin/staging` is the shared integration baseline. `staging` remains the development/integration/QA/UAT line, and `main` remains production.

Codex does not commit, push, deploy, mutate remote Supabase/Vercel/GitHub, create or switch branches, reset, rebase, stash, or discard work.

## Command Center / Phase 8

The local Command Center knowledge + observation layer is now implemented through the Phase 8A-8E architecture in `docs/workflow/COMMAND_CENTER_RUNTIME.md`.

Verified local state:

- Phase 8A knowledge/observation authority boundary and eval infrastructure is accepted locally; the canonical live suite passes **18/18** with the repository unchanged.
- Phase 8B codebase-memory is installed locally, the Carez repository was explicitly indexed, background auto-index/watch/UI behavior is disabled, and the Codex MCP is restricted to the inspection-oriented `analysis` profile.
- Phase 8C ai-memory is accepted locally on loopback `127.0.0.1:49374`: allowlist capture, prompt capture omitted, embeddings/auto-improve disabled, approval required for proposals, sticky Carez project routing, user-level scheduled startup, and repository-owned `.ai-memory.toml`. The isolated eval runner produces **0 captured sessions / 0 observations**. A real Carez session was captured, a later Codex session recalled it through the ai-memory MCP, then verified current `package.json` directly and treated current source as authority. Normal interactive Codex still requires its one-time hook-trust review.
- Phase 8D BrowserSkill is accepted locally: CLI/daemon and Codex skill are healthy, the compatible Chrome extension is labeled exactly **Carez QA**, and a bounded local Carez `/login` observation captured DOM/console/network evidence with no business mutation and a clean session stop.
- Phase 8E reconciles the development workflow and model/token-efficiency policy with the local-authority execution model.
- Phase 9 **Bounded Execution Orchestration** is locally accepted: source/memory/browser/provider evidence routing is defined in `COMMAND_CENTER_ORCHESTRATION.md`, and the canonical orchestration suite passes **12/12** with the repository unchanged.
- Phase 10 **Explicit Mutation Gate** architecture is locally accepted: `COMMAND_CENTER_MUTATION_GATE.md` defines explicit provider/environment/action/target authorization, destructive recovery and unknown-effect handling, and the canonical mutation-gate suite passes **14/14** with the repository unchanged.
- Provider-write capability remains disabled. Strict Command Center health confirms no raw GitHub/Supabase/Vercel MCP is enabled in local Codex.
- Command Center strict health passes with the dedicated **Carez QA** BrowserSkill profile connected, bounded codebase-memory, loopback allowlisted ai-memory, and the provider-mutation guard intact.
- Fresh final canonical repository validation for the combined Phase 8-10 batch passes: `pnpm check` -> typecheck PASS, **271 tests PASS / 1 skipped / 0 failed**, Next.js production build PASS.
- No GitHub, Supabase, or Vercel mutation was performed while implementing or accepting Phases 8-10. ai-memory's private local SQLite schema is tool-internal and is not Carez product database state.

The Command Center architecture is now complete through Phase 10. Phase 10 architecture does not itself enable provider writes; any future mutation capability requires a separate explicitly authorized enablement task.

## UI / ADR-025

ADR-025 — Carez Operations Workspace / Experience System is the active staging presentation authority.

The accepted design direction is:

- approximately **80% Command Deck**;
- approximately **20% Spatial Blueprint**;
- purposeful motion only when it communicates state, continuity, focus, activity, or workflow;
- selective spatial/3D treatment where it improves technical or customer-facing experiences;
- Inter-led hierarchy with IBM Plex Mono reserved for technical alignment;
- stronger shared tabs, meaningful domain icons, three depth levels, first-class light/dark/system, and no competing component system.
- final accepted ADR-025 theme: **Indigo Harbor** — pale blue-white/white light workspaces, deep harbor-navy shell, near-black dark mode, Indigo interaction color, Inter primary UI typography, and IBM Plex Mono for technical contexts. Nik visually approved this final theme on 2026-09-21.

### Accepted reference implementation

PR #77 merged the UI candidate at `457be2068a2b42f7883286a4f467f819e7fc049a`. The accepted Experience System reference pass covers:

- shared masthead/workspace/favorites language;
- Today — Daily Command Center;
- Projects — Operations Board;
- Documents — Evidence Hub;
- shared experience tabs, section hierarchy, icon language, empty states, and restrained transition-level interaction treatment.

Nik visually accepted that reference slice.

### Important correction: the full rewrite is not complete

Issue #76 originally authorized a **complete custom Carez UI/UX rewrite** across the application. The later Experience System refinement was intentionally narrower: it implemented only shared experience primitives plus Today, Projects, and Documents.

The following were explicitly outside that final bounded reference task and therefore must not be claimed complete:

- Takeoff route-level redesign;
- Estimate;
- Proposal/commercial surfaces;
- Billing/finance;
- Owner Reports;
- Settings;
- Client Package Studio;
- Markup Sheet;
- Quick Estimate;
- login/landing;
- broad route migration.

Issue #76 is open again so the repository does not claim the entire UI program is finished.

The current code includes restrained transitions/state treatment, but the broader motion language discussed for Carez has not been propagated application-wide. The final three-page reference task also did **not** authorize or deliver a new immersive 3D layer across the UI.

Spatial/3D treatment remains appropriate for Takeoff, markup/customer review, selected hero/landing experiences, and future field-estimating surfaces. It is not a requirement for accounting/forms/tables and must never create a second quantity engine.

## Takeoff / Concrete Condition foundation

Established invariants:

- persisted page-coordinate 2D/vector geometry is Takeoff quantity authority;
- server/domain calculation remains quantity/cost/pricing authority;
- 3D is synchronized derived verification only;
- Production Quantity, Direct Cost, and Sell remain separate;
- human authority remains explicit for scope, Conditions, means/methods, reinforcing, production assumptions, pricing, margin, budgets, and approvals.

Issue #55 Concrete Condition pilot parity is accepted.

Issue #41 synchronized derived 2D/3D verification is closed/completed. Its accepted architecture uses the active PDF plan plane, authoritative persisted 2D geometry, stable shared IDs/selection, governed physical inputs, and derived verification solids. Cross-sheet stacking/registration and direct freeform 3D geometry authoring remain deferred follow-on work.

## P0.5E legacy migration — complete on staging

Issue #39 is complete on `staging` under Epic #43. Tasks 1–7 are implemented, reconciled, and browser-accepted.

Verified staging / QA evidence:

- Task 1 migration ledger/classification contract is deployed in QA.
- Task 2 deterministic inventory/dry-run path is implemented.
- Task 3 supported pilot migration preparation is implemented without changing authoritative measurement geometry.
- Task 4 transactional supported-pilot migration/reconciliation is implemented and deployed in QA.
- Task 5 permanent Condition-first Takeoff cutover is merged and browser-accepted.
- Task 6 legacy Assembly History is read-only, merged, and browser QA **PASS**.
- Task 6 merge commit on `staging`: `bb5b61be53244a0e8daa8d1c01dcbfa71aa1d9d4`.
- Task 7 final reconciliation/documentation is merged at `a377f72893492443e0763a026e00838070186f47` and final stable-staging browser QA **PASS**.
- Final QA classification dry-run after the Task 6 source changes produced **62 mapped**, **2 historical_only**, **17 unsupported_review**, and **1 unreferenced** candidates with zero unexplained migration errors.
- All **17 unsupported_review** candidates trace to a single pre-Condition QA fixture (`QA FTG Line Pump 100 LF`: one legacy assembly version, one measurement, eight outputs, and seven estimate items). The fixture is intentionally left untouched for unsupported-path regression coverage and is not treated as a supported migration candidate.
- The controlled editable mapped pilot remains reconciled across **27** outputs: **2 held**, **25 intentionally inactive**, **0 mismatch/unmapped**, with exactly **2** generated estimate items for **2** estimate-visible active outputs and zero orphan/duplicate lineage failures.
- Pilot raw quantity, raw unit, and geometry hash remain unchanged; Task 4 idempotent replay **PASS** after the Task 6 merge.
- A mapped measurement on the non-draft `ready` QA estimate is already Condition-managed and is not eligible for migration apply because Task 4 correctly requires an editable draft estimate.
- No destructive legacy schema deletion is authorized by P0.5E. Referenced published/history records remain preserved.

The **EDGE-style Condition-first estimator workflow** remains the estimating UX contract: named Concrete Conditions, concrete-native module/property organization, direct Takeoff-to-Estimate lineage, and no normal formula-first authoring. Carez retains its own visual system, deterministic engine, versioning, Job Spine, commercial lineage, and production-learning architecture.

Final staging acceptance is complete. Issue #39 is closed. No production promotion is implied; `main` remains untouched and Issue #59 still blocks migration-dependent production release.

## Environment / blockers

- `staging` remains bound to isolated Supabase QA.
- `main` remains production.
- Local validation and local browser/runtime QA precede Nik acceptance and the GitHub Desktop local commit; accepted work enters staging in batched releases.
- Issue #59 production bridge application completed and verified: all 34 authorized `SAFE_TO_APPLY` migrations were applied in canonical source order. Production history uses application-time versions `20260925021524` through `20260925022046`, with canonical migration names matching the manifest 1:1; `20260924083100_proposal_authority_cutover` ran last. Proposal guard, ACL, and deferred-capability checks passed. Branding and the pricing provenance legacy backfill passed for 12 priced Takeoff outputs and 12 one-to-one linked Estimate items. No production data incompatibility or remediation requirement was identified. Issue #59 is no longer a production-release blocker. This documentation task authorizes no further production write.
- Issue #58 remains open pending authenticated staging browser acceptance of the already-implemented Estimate pricing-save fix.
- QA still lacks `public.next_opportunity_number()`, which blocks successful direct-job creation/populated Project Overview acceptance in that environment.
- GPU-capable manual browser QA has passed for the accepted Takeoff 2D / Split / 3D workstation behavior and for the final P0.5E stable-staging cutover.

## Active workstreams

One cross-cutting UI workstream remains open:

1. **Issue #76 — ADR-025 application-wide Experience System rollout.** The reference slice is accepted; broad propagation, richer purposeful motion, and explicitly deferred spatial/3D experience work remain unfinished.

The P0.5 Concrete Condition foundation, including Issue #39 P0.5E legacy migration and formula-first UI retirement, is accepted on `staging`. The next domain phase is **P1 Estimating** when authorized.

The Issue #59 production migration bridge is applied and verified; it no longer blocks a production release on migration-bridge reconciliation. Other release acceptance and action-specific production authorization requirements still apply.

## Production rule

Promotion from `staging` to `main` is an explicit production release action after acceptance. This Issue #59 documentation update authorizes no additional production write.
