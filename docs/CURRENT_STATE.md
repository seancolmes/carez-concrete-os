# Carez Concrete OS — Current State

Last reconciled: 2026-09-26
Canonical development / QA line: `staging`  
Production line: `main`  
User QA target: stable `staging` Vercel alias

## Execution model

### FINAL-2026-09-26 local completion program — incomplete

The current instruction authorizes local implementation and local commits on `staging`; it does not authorize push, deployment, or provider writes. Earlier accepted milestones below are historical evidence, not proof that V1 is complete.

- Approved Change Order reference RPC correction committed locally (`a4824f01`), with the original recovery migration preserved.
- Stale legacy assembly creation RPC retired; profile authority columns protected from caller updates; nine definer search paths hardened (`71744385`).
- Isolated release replay and source dependency checking implemented (`e0d9aa5e`). A fresh 53-migration replay, 29 database assertions, and SQL lint pass. The gate correctly fails on **155 missing application dependencies: 117 relations and 38 functions across 498 call sites**. Source completeness is not established by migration replay alone. See `docs/workflow/RELEASE_GATE.md` for gate coverage and remaining gaps.
- The earlier light translation (`ffbcd08e`) was explicitly rejected. The current theme correction adopts Steam Sleek V28 dark tokens and layered chrome, labelled primary navigation, shared controls, Change Orders proof composition, and public proposal styling. All saved appearance preferences normalize to dark while preserving density. Browser acceptance remains **unverified** following the earlier automatic approval rejection. Manual acceptance checks are recorded in the component pack. The user has separated V1 completion into another workstream; this correction changes presentation only.
- EDGE Condition parity beyond the three pilot families, partial/negotiated acceptance, and the full downstream execution/finance lineage remain open. V1 and release readiness are **not complete**.

Evidence from the isolated database gate is retained outside the repository under `C:\Users\nikca\Documents\Carez-Rehearsal\release-gate\carez-release-1790408703932-b63c10`. No production or QA database was mutated by this program.

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
- stronger shared tabs, meaningful domain icons, three depth levels, and no competing component system.
- current ADR-025 palette authority: **CAREZ STEAM SLEEK V28**, explicitly directed on 2026-09-26, superseding the Indigo Harbor palette accepted on 2026-09-21. Dark layered surfaces, steel separators, and cyan interactions preserve the Command Deck / Spatial Blueprint workflow philosophy. Visual acceptance of the new implementation remains outstanding.

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

### P1.4 Review, release, and Proposal issuance — accepted runtime state

Stable `staging` browser/runtime QA passed the sequence **BLOCKED → Customer destination → REVIEW → acknowledgement → RELEASE READY → Proposal issuance → public view → customer question/NEEDS REPLY**. Accepted staging commit: `daba9a6c8460f33cce8d20be11433817981ba43a`.

Issued Proposal release evidence preserved the commercial fingerprint, warning fingerprint, and acknowledgement lineage. Customer Acceptance/Award → Project and Create Next Revision remain deferred and are **not** part of this acceptance. This records acceptance of the P1.4 runtime slice; it does not claim P1 Estimating is complete.

The local Proposal UI now follows the authority cutover: public proposals support questions, change requests, option interest, and decline responses, while online acceptance and Create Next Revision are not offered. Existing historical accepted records remain readable. The Projects empty state identifies direct-job creation as the currently available entry path.

### REL-2026-09-25-RC1 — V1 commercial handoff foundation

The source-controlled migration `20260926010000_job_spine_award_foundation.sql` adds tenant-scoped Job Spine identity, exact-revision internal Award, immutable Accepted Scope Snapshot, original frozen commercial baseline, and Create Next Revision. Create Next Revision is available before Award; Award freezes the exact issued Proposal/Estimate revision used for the Snapshot and baseline. Post-award scope/value changes use authorized appended lineage/deltas, while ordinary revisions of an awarded Proposal are rejected. This is a later implementation slice; it does not change the historical P1.4 acceptance above. Public Proposal responses do not create Projects. Historical customer acceptances without trustworthy frozen internal evidence remain held.

Local verification on 2026-09-26: the complete migration chain replayed successfully against a fresh isolated local Supabase project; the commercial runtime fixture passed award, repeat-award idempotency, draft revision lineage/parent immutability, explicit historical evidence hold, tenant RLS, and least-privilege assertions. Authenticated UI acceptance passed for Proposal → Award → Project, including repeat-Award idempotence and post-award freeze. The issued-evidence P1 fix passed targeted regression coverage; targeted tests, typecheck, `pnpm check`, and `git diff --check` passed. No P0/P1 blocker remains for this commercial foundation.

Final staging acceptance: **PASS** on Carez Concrete OS QA at source/deployment commit `7f6c03631963c843a3df268687acef55b27367ba`. Ordered Supabase migrations applied successfully, and provider mutation safety passed with zero Plaid or Outlook sync calls. Create Next Revision created the exact linked Estimate R2; R2 passed Ready for Review and exact-warning acknowledgement; Proposal `P-QA-26-002-R2` was issued with frozen internal commercial evidence; and internal Award created Project `JOB-2026-0001` on the existing Job Spine. The exact Proposal R2 → Estimate R2 → Award Decision → Accepted Scope Snapshot → Commercial Baseline → Project lineage was verified. The frozen baseline records Direct Cost of $224.59 and Sell of $1,121.17 as separate values. Staging contains exactly one Project, Award Decision, Snapshot, and Baseline for the awarded QA Proposal. The repository runtime fixture independently verifies repeat-Award idempotence and `already_awarded` behavior. A second Award was not re-invoked in staging because the post-Award UI removes the action and read-only SQL has no authenticated application identity; this is a validation-environment limitation, not a release blocker or product defect. No P0/P1/P2 product defects were observed. This PASS is staging-only and does not indicate production deployment or promotion.

Issue #39 is closed. `main` remains untouched.

## Environment / blockers

- `staging` remains bound to isolated Supabase QA.
- `main` remains production.
- Local validation and local browser/runtime QA precede Nik acceptance and the GitHub Desktop local commit; accepted work enters staging in batched releases.
- Issue #59 production bridge application completed and verified: all 34 authorized `SAFE_TO_APPLY` migrations were applied in canonical source order. Production history uses application-time versions `20260925021524` through `20260925022046`, with canonical migration names matching the manifest 1:1; `20260924083100_proposal_authority_cutover` ran last. Proposal guard, ACL, and deferred-capability checks passed. Branding and the pricing provenance legacy backfill passed for 12 priced Takeoff outputs and 12 one-to-one linked Estimate items. No production data incompatibility or remediation requirement was identified. Issue #59 is no longer a production-release blocker. This documentation task authorizes no further production write.
- Issue #58 stable-staging acceptance passed on staging commit `8fee33de221fbab316b476d6cc28749d7757e156`: QA Estimate `QA-26-001-R1 — QA Takeoff Persistence` saved with HTTP 200, and target margin 30%, retailing B&O reserve consistent with the governed 0.471% rate, processing reserve 0%, and $4,079.65 sell persisted after reopening. Takeoff lineage remained intact for `QA FTG Line Pump 100 LF · QA Zone A · QA-1` (100 LF), including generated Takeoff-linked Ready-mix concrete at 6.36 CY. All four acceptance criteria passed. No production/main change is implied.
- A read-only QA schema check on 2026-09-25 confirmed `public.next_opportunity_number()` exists and `authenticated` has EXECUTE. The former missing-function blocker is resolved at the schema/ACL level; direct-job creation and populated Project Overview still need transaction-level browser acceptance.
- GPU-capable manual browser QA has passed for the accepted Takeoff 2D / Split / 3D workstation behavior and for the final P0.5E stable-staging cutover.

## Active workstreams

One cross-cutting UI workstream remains open:

1. **Issue #76 — ADR-025 application-wide Experience System rollout.** The reference slice is accepted; broad propagation, richer purposeful motion, and explicitly deferred spatial/3D experience work remain unfinished.

The P0.5 Concrete Condition foundation, including Issue #39 P0.5E legacy migration and formula-first UI retirement, is accepted on `staging`. The next domain phase is **P1 Estimating** when authorized.

The Issue #59 production migration bridge is applied and verified; it no longer blocks a production release on migration-bridge reconciliation. Other release acceptance and action-specific production authorization requirements still apply.

## Production rule

Promotion from `staging` to `main` is an explicit production release action after acceptance. This Issue #59 documentation update authorizes no additional production write.
