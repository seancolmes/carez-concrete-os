# Carez Concrete OS — Current State

Last reconciled: 2026-09-21  
Canonical development / QA line: `staging`  
Production line: `main`  
User QA target: stable `staging` Vercel alias

## Execution model

Carez implementation is cloud-based.

```text
Nik / Carez control room
→ connected GitHub/Supabase/Vercel tools and/or ChatGPT Work/Codex cloud
→ GitHub staging
→ GitHub Actions
→ Vercel staging
→ browser QA
```

Supabase QA is the staging database authority. Online GitHub is repository authority. The Windows checkout is only a replaceable mirror.

There is no canonical local Codex/Ollama/OmniRoute path. All model execution may consume credits or allowance. Luna/Terra are lower-cost routing options, not free. Astra is reserved for premium high-value work.

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

## P0.5E legacy migration — final staging acceptance pending

Issue #39 remains open only for Task 7 final reconciliation/documentation and stable-staging acceptance under Epic #43. Tasks 1–6 are implemented.

Verified staging / QA evidence:

- Task 1 migration ledger/classification contract is deployed in QA.
- Task 2 deterministic inventory/dry-run path is implemented.
- Task 3 supported pilot migration preparation is implemented without changing authoritative measurement geometry.
- Task 4 transactional supported-pilot migration/reconciliation is implemented and deployed in QA.
- Task 5 permanent Condition-first Takeoff cutover is merged and browser-accepted.
- Task 6 legacy Assembly History is read-only, merged, and browser QA **PASS**.
- Task 6 merge commit on `staging`: `bb5b61be53244a0e8daa8d1c01dcbfa71aa1d9d4`.
- Final QA classification dry-run after the Task 6 source changes produced **62 mapped**, **2 historical_only**, **17 unsupported_review**, and **1 unreferenced** candidates with zero unexplained migration errors.
- All **17 unsupported_review** candidates trace to a single pre-Condition QA fixture (`QA FTG Line Pump 100 LF`: one legacy assembly version, one measurement, eight outputs, and seven estimate items). The fixture is intentionally left untouched for unsupported-path regression coverage and is not treated as a supported migration candidate.
- The controlled editable mapped pilot remains reconciled across **27** outputs: **2 held**, **25 intentionally inactive**, **0 mismatch/unmapped**, with exactly **2** generated estimate items for **2** estimate-visible active outputs and zero orphan/duplicate lineage failures.
- Pilot raw quantity, raw unit, and geometry hash remain unchanged; Task 4 idempotent replay **PASS** after the Task 6 merge.
- A mapped measurement on the non-draft `ready` QA estimate is already Condition-managed and is not eligible for migration apply because Task 4 correctly requires an editable draft estimate.
- No destructive legacy schema deletion is authorized by P0.5E. Referenced published/history records remain preserved.

The **EDGE-style Condition-first estimator workflow** remains the estimating UX contract: named Concrete Conditions, concrete-native module/property organization, direct Takeoff-to-Estimate lineage, and no normal formula-first authoring. Carez retains its own visual system, deterministic engine, versioning, Job Spine, commercial lineage, and production-learning architecture.

Final staging acceptance pending: merge the Task 7 documentation/reconciliation branch, verify the exact staging SHA, and obtain Nik's final browser acceptance before closing Issue #39.

## Environment / blockers

- `staging` remains bound to isolated Supabase QA.
- `main` remains production.
- Issue #59 remains a hard production-release blocker until production Supabase migration history is safely bridged to the canonical staging/QA migration model.
- Issue #58 remains open pending authenticated staging browser acceptance of the already-implemented Estimate pricing-save fix.
- QA still lacks `public.next_opportunity_number()`, which blocks successful direct-job creation/populated Project Overview acceptance in that environment.
- GPU-capable manual browser QA has passed for the accepted Takeoff 2D / Split / 3D workstation behavior; Task 7 still requires final stable-staging acceptance for the completed P0.5E cutover.

## Active workstreams

Two workstreams are legitimately open:

1. **Issue #76 — ADR-025 application-wide Experience System rollout.** The reference slice is accepted; broad propagation, richer purposeful motion, and explicitly deferred spatial/3D experience work remain unfinished.
2. **Issue #39 — P0.5E legacy recipe migration.** Tasks 1–6 are implemented and accepted; Task 7 final reconciliation/documentation and stable-staging acceptance remain before closure.

Do not claim either workstream finished. Nik decides which stream receives the next cloud implementation budget.

After #39 and P0.5 end-to-end acceptance, advance to P1 Estimating. Issue #59 must be resolved before any migration-dependent `staging` → `main` production release.

## Production rule

Promotion from `staging` to `main` is an explicit production release action after acceptance. No production migration promotion occurs while Issue #59 remains unresolved.
