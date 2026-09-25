# Carez Concrete OS - agent router

Carez is a concrete-native modular monolith.

## Authority

- `staging` is development/integration/QA/UAT.
- `main` is production only.
- The explicit current task outranks this file; this file and `CODEX.md` govern normal repository work.
- Local working-tree changes and local commits are authoritative for in-progress work.
- `origin/staging` is the shared integration baseline. Never auto-reset, rebase, stash, discard, or overwrite local work to match it.
- Read named targets and required direct dependencies only.
- Do not restart accepted work, broaden scope, or refactor unrelated code.

## Architecture

Preserve:
- Next.js 15 / TypeScript / Tailwind application architecture.
- Supabase/PostgreSQL authority, `company_id` tenant isolation, RLS, auditability, and source-controlled migrations.
- Deterministic server-authoritative quantity, cost, pricing, and financial calculations.
- Opportunity/Takeoff -> Estimate -> Proposal -> Award -> Project -> Production -> Cost/Forecast lineage.
- Production Quantity, Direct Cost, and Sell as distinct concepts.
- Persisted page-coordinate 2D/vector Takeoff geometry as quantity authority.
- Derived 3D as verification/visualization only.
- Human final authority for scope, Concrete Conditions, means/methods, reinforcing interpretation, production rates, pricing, margin, budgets, approvals, billing, retainage, and commercial decisions.

## UI authority

- ADR-025 and the accepted Carez implementation define the active presentation language.
- ADR-020 owns Takeoff quantity/domain invariants unless explicitly superseded.
- Preserve the accepted Command Rail / Domain Deck / contextual Command Bar / large-workspace approach.
- Use Impeccable for design-relevant work when requested or when design direction is unresolved; do not append automatic critique/polish loops after an approved brief.
- Avoid generic SaaS card clutter, redundant sidebars, fake metrics, gratuitous rounding, decorative gradients, and permanent inspector clutter.

## Execution model

Normal implementation is local:

ChatGPT control room
-> local Codex
-> local validation
-> local browser/runtime QA
-> Nik acceptance
-> GitHub Desktop local commit
-> batched staging release

Codex must not commit, push, merge, rebase, reset, stash, discard work, create/switch branches,
deploy Vercel, mutate remote Supabase, or perform remote GitHub actions unless the current task explicitly authorizes it.

## Context routing

Load only what the task requires:
- local execution/validation -> already-loaded `CODEX.md`; do not reread it from skills
- cross-cutting architecture -> `docs/ARCHITECTURE.md` only when the task actually crosses module boundaries
- approved bounded UI edit -> target + direct dependencies first; read the relevant ADR-025/design-system section only when presentation hierarchy, shell/shared ownership, or design authority is ambiguous
- Takeoff -> target + direct dependencies first; read relevant ADR-020/current Takeoff contracts only when quantity/geometry/role/2D-3D authority or cross-module lineage is involved
- durable workflow -> the relevant `docs/workflow/` document only when workflow behavior is the task
- GitHub/Supabase/Vercel external state -> `docs/workflow/EXTERNAL_STATE_BOUNDARY.md` only when current remote truth/action is materially required
- derived structural knowledge / work memory / browser-runtime observation -> `docs/workflow/KNOWLEDGE_AND_OBSERVATION_BOUNDARY.md` only when that information source is materially required
- mixed source/memory/browser/provider orchestration -> `docs/workflow/COMMAND_CENTER_ORCHESTRATION.md` only when the task genuinely combines evidence channels or action boundaries
- GitHub/Supabase/Vercel write, production, rollback, repair, or destructive provider action -> `docs/workflow/COMMAND_CENTER_MUTATION_GATE.md` in addition to the external-state boundary; tool availability never grants the write
- local Command Center installation/runtime health -> `docs/workflow/COMMAND_CENTER_RUNTIME.md` only when installing, debugging, or changing local Command Center tooling

Do not preload old history, unrelated migrations, unrelated routes, full ADRs for trivial edits, or superseded design artifacts.

## Documentation

- Durable behavior -> owning module/spec/ADR.
- Verified implementation state -> `docs/CURRENT_STATE.md`.
- Product future sequence -> `docs/ROADMAP.md`.
- Command Center implementation sequence -> `docs/workflow/COMMAND_CENTER_ROADMAP.md`.
- Development/runtime workflow -> `docs/workflow/`.
- Chat, Project, context-loading, and knowledge-promotion governance -> `docs/workflow/KNOWLEDGE_GOVERNANCE.md`.
- Git history preserves implementation evidence; do not create checkpoint documents merely because a task occurred.
