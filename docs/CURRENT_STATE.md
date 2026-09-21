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

## P0.5E legacy migration — active

Issue #39 is the current unfinished P0.5 dependency under Epic #43.

Verified staging state:

- Task 1 migration ledger/classification contract exists.
- Task 2 deterministic read-only inventory + dry-run action exists.
- `prepareLegacyPilotMigration()` / Task 3 migration preparation is not implemented yet.
- legacy recipe/formula compatibility cannot be deleted yet because referenced measurement/output/estimate history still exists.
- no destructive legacy schema deletion is authorized by P0.5E.

Next bounded domain checkpoint: **Issue #39 plan Task 3 — supported pilot migration preparation without changing authoritative geometry.**

## Environment / blockers

- `staging` remains bound to isolated Supabase QA.
- `main` remains production.
- Issue #59 remains a hard production-release blocker until production Supabase migration history is safely bridged to the canonical staging/QA migration model.
- Issue #58 remains open pending authenticated staging browser acceptance of the already-implemented Estimate pricing-save fix.
- QA still lacks `public.next_opportunity_number()`, which blocks successful direct-job creation/populated Project Overview acceptance in that environment.
- The prior cloud review browser lacked WebGL, so graphical 3D rendering still requires GPU-capable browser evidence when that visual acceptance is next required.

## Active workstreams

Two workstreams are legitimately open:

1. **Issue #76 — ADR-025 application-wide Experience System rollout.** The reference slice is accepted; broad propagation, richer purposeful motion, and explicitly deferred spatial/3D experience work remain unfinished.
2. **Issue #39 — P0.5E legacy recipe migration.** Tasks 1–2 are implemented; Task 3 is the next domain-engineering checkpoint.

Do not claim either workstream finished. Nik decides which stream receives the next cloud implementation budget.

After #39 and P0.5 end-to-end acceptance, advance to P1 Estimating. Issue #59 must be resolved before any migration-dependent `staging` → `main` production release.

## Production rule

Promotion from `staging` to `main` is an explicit production release action after acceptance. No production migration promotion occurs while Issue #59 remains unresolved.
