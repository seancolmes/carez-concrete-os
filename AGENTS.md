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
- Premium Astra/Luna/Terra routing → `docs/workflow/CAREZ_TOKEN_EFFICIENCY.md`
- General UI → ADR-024 + `docs/design-system/CAREZ_COMPONENT_PACK.md`
- Takeoff → ADR-020 + current Takeoff module contracts

Do not preload `docs/`, old history, unrelated migrations, or unrelated routes.

## Execution modes

Routine implementation uses the local Carez Codex path and normal validation in `CODEX.md`.

Premium hosted implementation is opt-in. When Astra is explicitly selected, follow the premium rule:

```text
IMPLEMENT -> COMMIT -> PUSH -> STOP
```

The premium implementation turn does not perform post-implementation QA, CI/deployment monitoring, review passes, or optional polish unless the current task explicitly assigns that work. Carez control-room tooling handles acceptance separately.

## UI

ADR-024 is the active staging visual/theme/token/density authority. Issue #71 is accepted on staging; ADR-016 is historical except where compatible. ADR-020 remains Takeoff authority. Preserve true light/dark/system semantic tokens and the governed component system.

## Documentation

Durable behavior → owning module/ADR. Verified implementation state → `docs/CURRENT_STATE.md`. Development/runtime workflow → `docs/workflow/`. Git history preserves completed evidence.
