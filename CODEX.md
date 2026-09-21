# Carez Concrete OS — cloud execution contract

This is the repository execution contract for ChatGPT Work/Codex cloud. Carez has no canonical local Codex/Ollama/OmniRoute execution path.

## Read scope

- Start with files named in the task.
- Read direct imports/dependencies only when required.
- Read an owning module/ADR only when named or when the target code is ambiguous.
- Do not preload old history, unrelated migrations, unrelated routes, or superseded design artifacts.
- Do not use broad repository scans, web research, or unrelated plugins unless the task requires them.
- Superpowers and Impeccable are approved, but use only the narrow skill/command relevant to the current task.

## Branch and source authority

- `staging` = development/integration/QA/UAT.
- `main` = production only.
- Start from current online GitHub `staging`.
- Temporary branches are exceptional and must target `staging`.
- Never promote to `main` without Nik's explicit production-release authorization.
- A local Windows checkout is only a replaceable mirror; never reconcile authoritative GitHub state from stale local history.

## Preserve

- Concrete-native modular-monolith architecture.
- Supabase/PostgreSQL authority, RLS, tenant isolation, auditability, source-controlled migrations.
- Server-authoritative quantities, cost, pricing, and financial values.
- Immutable/versioned commercial records and lineage.
- Production Quantity, Direct Cost, and Sell as distinct concepts.
- Persisted page-coordinate 2D/vector geometry as Takeoff quantity authority; derived 3D is verification only.
- Human authority over scope, Conditions, means/methods, reinforcing, production rates, pricing, margin, budgets, approvals, and final commercial decisions.
- ADR-025 as presentation authority and ADR-020 as Takeoff quantity/domain authority.

## Cloud model routing

All implementation models are cloud-hosted and may consume credits or allowance.

- **Control room / connected tools:** planning, architecture, source-of-truth inspection, issue/PR coordination, acceptance, and bounded maintenance.
- **Work/Codex cloud:** substantial repository implementation.
- **Luna:** default lower-cost helper for bounded reads, classification, routine edits, and narrow checks.
- **Terra:** escalation when Luna is insufficient.
- **Astra:** premium architecture, major visual invention, or difficult high-value implementation.
- Never treat Luna/Terra as free.
- Never spawn Astra as a child.

## Standard cloud implementation

For normal cloud implementation:

1. Inspect only targets and direct dependencies.
2. Make the smallest coherent diff; no unrelated refactor/dependency.
3. Reuse existing helpers/components/schema patterns.
4. DB changes require source-controlled migrations and preservation of RLS, tenant isolation, auditability, and lineage.
5. Run targeted tests plus `pnpm typecheck`; use `pnpm check` for broad/high-risk work or when explicitly requested.
6. Update durable docs only when product contracts/current verified state changed.
7. Commit/push only to the assigned development branch, normally `staging` or a temporary branch targeting `staging`.
8. GitHub Actions, Vercel staging, Supabase QA, and browser QA are acceptance evidence after push.

## Premium Astra implementation

Astra is opt-in. For an authorized premium implementation task:

```text
IMPLEMENT -> COMMIT -> PUSH -> STOP
```

Unless Nik explicitly assigns validation to the premium run, Astra must not continue into:

- tests/typecheck/lint;
- browser or visual QA;
- regression sweeps;
- auto-review/reviewer passes;
- Superpowers completion/reviewer chains;
- Impeccable audit/critique/polish passes;
- GitHub Actions inspection;
- Vercel/deployment monitoring or waiting;
- optional cleanup or a second polish pass.

Acceptance is handled afterward by the Carez control room, CI, connected systems, or explicitly assigned lower-cost cloud execution.

## Plugin coordination

### Superpowers

- Use for unresolved design, planning, systematic debugging, and other relevant process work.
- Do not re-run brainstorming/planning when the current task already names an approved design/spec/plan.
- Any helper dispatch follows Carez routing: Luna first, Terra only when justified, never Astra as child.
- Premium Astra runs do not automatically invoke review/TDD/completion loops.

### Impeccable

- Use for design-relevant frontend work only.
- ADR-025 and the Carez component pack define the visual authority.
- During premium implementation, use Impeccable only inside the assigned build scope; do not append an automatic critique/audit/polish cycle.

## Final response

Maximum 6 lines / 90 words unless Nik requests more. State changed files/behavior, validation only if actually performed, blocker/risk, and commit/ref when available.
