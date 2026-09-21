# Carez Concrete OS — agent router

Carez is a concrete-native modular monolith. Repository source + connected Supabase/Vercel/GitHub environments are implementation truth.

## Always

- `staging` is development/QA; `main` is production only.
- Start substantive repository work from current online `staging`.
- Make the smallest coherent change. Read named targets and direct dependencies only.
- Do not restart accepted work, refactor unrelated code, or invent repository/database/deployment state.
- Protect Supabase/PostgreSQL authority, RLS, tenant isolation, auditability, source-controlled migrations, deterministic quantities/cost/pricing/financials, immutable commercial lineage, Production Quantity / Direct Cost / Sell separation, 2D Takeoff quantity authority, and human commercial authority.
- The Windows checkout is a replaceable mirror only. Online GitHub is authoritative when local and remote disagree.

## Cloud execution model

Carez development execution is cloud-based:

```text
Nik / Carez control room
→ connected ChatGPT tools and/or ChatGPT Work/Codex cloud
→ GitHub staging
→ GitHub Actions
→ Vercel staging
→ browser QA
```

Supabase QA is the staging database authority.

There is no canonical local Codex/Ollama/OmniRoute implementation path. Do not route work to a supposed free/local agent. All model execution may consume credits or allowance. Luna/Terra are lower-cost routing options, not free execution.

## Route before loading context

Load only the route needed for the task:

- Codex/Work execution, validation, model routing, branches → `CODEX.md`
- Development/release workflow → `docs/workflow/DEVELOPMENT_WORKFLOW.md`
- Premium-model/token routing → `docs/workflow/CAREZ_TOKEN_EFFICIENCY.md`
- Cross-cutting product architecture → `docs/ARCHITECTURE.md`
- General UI → ADR-025 + `docs/design-system/CAREZ_COMPONENT_PACK.md` + Impeccable when design-relevant
- Takeoff → ADR-020 + current Takeoff module contracts
- Development process/debugging/planning → installed Superpowers skills when relevant

Do not preload old history, unrelated migrations, unrelated routes, or obsolete supporting docs.

## Authority and plugin precedence

```text
Nik / explicit current task
→ AGENTS.md + CODEX.md
→ approved Carez specs / ADRs / routing policy
→ Superpowers + Impeccable
→ model execution
```

User and repository instructions outrank plugin defaults.

- If a design/spec/plan is already approved, do not re-brainstorm or reopen it.
- Superpowers may structure unresolved planning/debugging, but its dispatch/review/verification workflows must obey Carez model-routing and premium-stop rules.
- Impeccable may guide design-relevant implementation, but it does not authorize work outside the assigned scope.

## Model routing

- Use ChatGPT control-room tools for planning, inspection, coordination, acceptance, and bounded direct maintenance.
- Use cloud Work/Codex for substantial implementation.
- Use Luna first for bounded helper work when available.
- Escalate to Terra only when Luna is insufficient.
- Use Astra only for major architecture, high-value design invention, or difficult implementation that materially benefits from premium capability.
- Never spawn Astra as a child.

For authorized premium Astra implementation:

```text
IMPLEMENT -> COMMIT -> PUSH -> STOP
```

Unless Nik explicitly assigns validation to the Astra run, Astra does not continue into tests, typecheck, browser QA, review loops, GitHub Actions, Vercel monitoring, or optional polish.

## UI

ADR-025 — Carez Operations Workspace / Experience System is the active staging presentation authority.

The accepted reference implementation covers the shared experience language plus Today, Projects, and Documents. Issue #76 remains open because the original complete application-wide rewrite is not fully propagated. Do not claim the full UI program is complete merely because the reference slice is accepted.

The approved direction is approximately 80% Command Deck / 20% Spatial Blueprint, with purposeful motion and selective spatial/3D treatment where it improves the workflow. ADR-020 plus the active Takeoff module contracts remain authoritative for Takeoff quantity/domain invariants; persisted 2D geometry remains quantity authority and 3D remains derived verification.

## Documentation

Durable behavior → owning module/ADR. Verified implementation state → `docs/CURRENT_STATE.md`. Sequence → `docs/ROADMAP.md`. Development/runtime workflow → `docs/workflow/`. Git history/issues preserve superseded implementation evidence.
