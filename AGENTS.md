# Carez Concrete OS — agent rules

Carez is a concrete-native modular monolith. Repository source + Supabase are implementation truth.

## Execution

Use current `staging` for development/QA; `main` is production only. Make the smallest coherent change. Read only target files and direct dependencies; add the owning module/ADR only when needed. Do not restart accepted work or refactor unrelated code.

When connected GitHub/Vercel/Supabase tools are available, ChatGPT may implement directly. When Nik explicitly asks for a Codex Cloud task, generate/use the compact `CODEX.md` contract instead of a long handoff prompt.

## Protect

- Supabase/PostgreSQL authority, RLS, tenant isolation, auditability, source-controlled migrations.
- Server-authoritative quantities, cost, pricing, and financial values.
- Immutable/versioned commercial records, Condition-template history, referenced legacy history.
- Opportunity/takeoff → estimate → proposal → award → project → production → cost/forecast lineage.
- Production Quantity, Direct Cost, and Sell remain distinct.
- Persisted stable page-coordinate 2D/vector geometry is Takeoff quantity authority; derived 3D is verification only.
- Humans remain authoritative for scope, Conditions, means/methods, reinforcing, production rates, pricing, margin, budgets, approvals.

## UI

ADR-015 = dark shadcn system. ADR-016 = compact desktop top shell. ADR-020 = integrated Takeoff workstation. Reuse `docs/design-system/CAREZ_COMPONENT_PACK.md`. Do not revive B2/light styling, permanent global desktop left rail, alternate palettes, compatibility UI layers, or parallel component systems.

## Validate

Localized edit: targeted check. Normal implementation: `pnpm typecheck` + relevant tests. High-risk data/domain change: add migration/RLS/security verification. GitHub Actions is comprehensive post-push validation; Vercel is staging deployment authority; browser QA is required for rendered acceptance.

## Documentation

Durable behavior → owning module/ADR. Verified implementation state → `docs/CURRENT_STATE.md`. Remove superseded working/checkpoint docs once surviving truth is canonical; Git history preserves evidence.
