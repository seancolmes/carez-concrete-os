# Carez Concrete OS — Codex rules

This file is the sole implementation workflow for Codex Cloud tasks in this repository. Do not load or apply repository-external implementation workflows, and do not gate work on local runtime/provider/model checks.

Use this repository for fast, bounded implementation. Do not use web research, plugins, external browsing, or broad repository scans unless the task explicitly requires them.

## Read scope

- Start with files named in the prompt.
- Read direct imports/dependencies only as needed.
- Read an owning module/ADR only when the prompt names it or the target code is ambiguous.
- Do not preload `docs/`, old history, unrelated migrations, or unrelated routes.

## Branch

- `staging` = development/QA.
- `main` = production only.
- Work from current `staging`. If the cloud runner requires a task branch, keep it temporary and target `staging`.

## Preserve

- Concrete-native scope and modular-monolith architecture.
- Supabase/PostgreSQL authority, RLS, tenant isolation, auditability, and source-controlled migrations.
- Server-authoritative quantities, costs, pricing, and financial values.
- Immutable/versioned commercial records, Condition-template history, and referenced legacy history.
- Production Quantity, Direct Cost, and Sell as distinct values.
- Persisted page-coordinate 2D/vector geometry as Takeoff quantity authority; derived 3D is verification only.
- Human authority over scope, Conditions, means/methods, reinforcing interpretation, production rates, pricing, margin, budgets, and approvals.
- UI authority: ADR-024 + `docs/design-system/CAREZ_COMPONENT_PACK.md`; ADR-016 remains the implemented shell until its dedicated replacement slice, and ADR-020/current Takeoff module contracts remain authoritative for Takeoff invariants. Preserve true light/dark/system semantic tokens; do not revive legacy B2 styling, a permanent global desktop left rail, compatibility UI layers, hard-coded alternate palettes outside governed semantic tokens, or a second component system.

## Execute

1. Inspect only the target and direct dependencies.
2. Make the smallest coherent diff; no unrelated refactor or dependency. Add a dependency only when the task prompt or an approved repository spec explicitly authorizes it, and add only the authorized packages.
3. Reuse existing helpers, components, and schema patterns.
4. Database changes use source-controlled migrations and preserve RLS/lineage.
5. Run targeted tests plus `pnpm typecheck`. Run `pnpm check` only for broad/high-risk changes or when requested.
6. Update docs only when a durable contract/current-state fact changes or the task asks for it.
7. Source/build success is not browser acceptance.

## Final response

Maximum 6 lines / 90 words: changed files/behavior, validation, blocker or risk if any, and commit/ref if available. No tutorial, long recap, full diff, or research summary unless requested.
