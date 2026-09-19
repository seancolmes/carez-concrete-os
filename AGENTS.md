# Carez Concrete OS — agent rules

Carez is a concrete-native modular monolith. Repository source + Supabase are implementation truth.

## Execution

Use current `staging` for development/QA; `main` is production only. Make the smallest coherent change. Read only target files and direct dependencies; add the owning module/ADR only when needed. Do not restart accepted work or refactor unrelated code.

The canonical development loop is:

```text
Carez control chat / connected tools
→ local Codex workstation
→ current staging checkout
→ GitHub staging
→ GitHub Actions
→ Vercel staging
→ browser QA
```

Root `CODEX.md` is the sole repository execution contract for Codex. The current primary implementation runtime is local Codex Web UI using the real Codex `app-server`, an isolated `CODEX_HOME`, OmniRoute, and local Ollama inference. Runtime/provider/model configuration lives outside this repository and must not become an application dependency.

Do not load or apply repository-external implementation workflows. OpenCode is not part of the Carez implementation workflow. Do not gate normal repository work on local model/provider checks; workstation startup owns runtime readiness.

When connected GitHub/Vercel/Supabase tools are available, ChatGPT may inspect, coordinate, review, or implement directly. Hosted Codex Cloud is optional, not the canonical Carez implementation path.

## Protect

- Supabase/PostgreSQL authority, RLS, tenant isolation, auditability, source-controlled migrations.
- Server-authoritative quantities, cost, pricing, and financial values.
- Immutable/versioned commercial records, Condition-template history, referenced legacy history.
- Opportunity/takeoff → estimate → proposal → award → project → production → cost/forecast lineage.
- Production Quantity, Direct Cost, and Sell remain distinct.
- Persisted stable page-coordinate 2D/vector geometry is Takeoff quantity authority; derived 3D is verification only.
- Humans remain authoritative for scope, Conditions, means/methods, reinforcing, production rates, pricing, margin, budgets, approvals.

## UI

ADR-024 is the active Precision Grid visual/theme/token/density and implemented global shell/navigation authority. Issue #71 is accepted on staging; ADR-016 is retained only for compatible historical principles. ADR-020 remains the Takeoff workstation authority. Reuse `docs/design-system/CAREZ_COMPONENT_PACK.md`. Preserve true light/dark/system semantic tokens; do not revive legacy B2 styling, permanent global desktop left rail, compatibility UI layers, hard-coded alternate palettes outside governed tokens, or a second component system.

## Validate

Localized edit: targeted check. Normal implementation: `pnpm typecheck` + relevant tests. High-risk data/domain change: add migration/RLS/security verification. GitHub Actions is comprehensive post-push validation; Vercel is staging deployment authority; browser QA is required for rendered acceptance.

## Documentation

Durable behavior → owning module/ADR. Verified implementation state → `docs/CURRENT_STATE.md`. Development runtime/workflow → `docs/workflow/`. Remove superseded working/checkpoint docs once surviving truth is canonical; Git history preserves evidence.
