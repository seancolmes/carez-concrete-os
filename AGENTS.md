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

Issue #76 authorizes ADR-025 — Carez Operations Workspace on `astra/complete-ui-rewrite`. It supersedes ADR-024 presentation, ADR-016 shell arrangement, and ADR-020 pane composition. Preserve all protected domain/measurement behavior and light/dark/system preferences. Reuse the source-owned component pack and semantic tokens; do not introduce competing presentation systems. Nik must visually approve the branch preview before staging integration.

## Validate

Localized edit: targeted check. Normal implementation: `pnpm typecheck` + relevant tests. High-risk data/domain change: add migration/RLS/security verification. GitHub Actions is comprehensive post-push validation; Vercel is staging deployment authority; browser QA is required for rendered acceptance.

## Documentation

Durable behavior → owning module/ADR. Verified implementation state → `docs/CURRENT_STATE.md`. Development runtime/workflow → `docs/workflow/`. Remove superseded working/checkpoint docs once surviving truth is canonical; Git history preserves evidence.
