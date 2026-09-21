# Carez Concrete OS — agent router

Carez is a concrete-native modular monolith. Repository source + Supabase are implementation truth.

## Always

- `staging` is development/QA; `main` is production only.
- Make the smallest coherent change. Read named targets and direct dependencies only.
- Do not restart accepted work, refactor unrelated code, or invent repository/database/deployment state.
- Protect Supabase/PostgreSQL authority, RLS, tenant isolation, auditability, source-controlled migrations, deterministic quantities/cost/pricing/financials, immutable commercial lineage, Production Quantity / Direct Cost / Sell separation, 2D Takeoff quantity authority, and human commercial authority.

## Route before loading context

Load only the route needed for the task:

- Codex execution, validation, model routing, branches → `CODEX.md`
- Cross-cutting product architecture → `docs/ARCHITECTURE.md`
- Local OmniRoute/Ollama workstation → `docs/workflow/LOCAL_CODEX_WORKSTATION.md`
- Premium Astra/Luna/Terra routing and plugin coordination → `docs/workflow/CAREZ_TOKEN_EFFICIENCY.md`
- General UI → ADR-024 + `docs/design-system/CAREZ_COMPONENT_PACK.md` + Impeccable when the task is design-relevant
- Takeoff → ADR-020 + current Takeoff module contracts
- Development process/debugging/planning → installed Superpowers skills when relevant

Do not preload `docs/`, old history, unrelated migrations, unrelated routes, or unrelated plugins.

## Authority and plugin precedence

For Carez development work:

```text
Nik / explicit task
→ AGENTS.md + CODEX.md
→ Carez routing / approved specs and ADRs
→ Superpowers + Impeccable
→ model execution
```

User and repository instructions outrank plugin defaults.

- If the task says a design/spec/plan is already approved, do not re-brainstorm, rewrite it, or reopen settled product decisions.
- Superpowers may structure unresolved design, planning, or debugging, but its subagent/review/verification workflows must obey Carez model-routing and premium-stop rules.
- Impeccable may guide design-relevant implementation, but automatic or explicit review/polish work does not extend a premium run beyond the assigned implementation scope.

## Execution modes

Routine implementation uses the local Carez Codex path and normal validation in `CODEX.md`.

Premium hosted implementation is opt-in. When Astra is explicitly selected, follow the premium rule:

```text
IMPLEMENT -> COMMIT -> PUSH -> STOP
```

The premium implementation turn does not perform post-implementation QA, CI/deployment monitoring, review passes, optional polish, or plugin-driven finish loops unless the current task explicitly assigns that work. Carez control-room tooling handles acceptance separately.

## UI

On `astra/complete-ui-rewrite`, Issue #76 and ADR-025 — Carez Operations Workspace — are the approved presentation authority for the rewrite. They supersede ADR-024 presentation and ADR-016 shell arrangement on this branch while preserving protected domain behavior, light/dark/system semantics, and the governed component system. ADR-020 remains authoritative for Takeoff quantity/domain invariants; Takeoff presentation changes are limited by the approved rewrite scope. Nik must visually approve this branch before staging integration.

## Documentation

Durable behavior → owning module/ADR. Verified implementation state → `docs/CURRENT_STATE.md`. Development/runtime workflow → `docs/workflow/`. Git history preserves completed evidence.
