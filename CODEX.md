# Carez Concrete OS — Codex execution contract

This is the repository execution contract for Codex. Do not load repository-external implementation workflows.

## Read scope

- Start with files named in the task.
- Read direct imports/dependencies only when required.
- Read an owning module/ADR only when named or when the target code is ambiguous.
- Do not preload `docs/`, old history, unrelated migrations, or unrelated routes.
- Do not use web research, broad repository scans, or unrelated plugins unless the task requires them.
- Superpowers and Impeccable are approved development plugins, but use only the skill/command relevant to the current task.

## Branch

- `staging` = development/QA.
- `main` = production only.
- Start repository work from current `staging`.
- Temporary branches are exceptional; when needed, branch from `staging` and target `staging`.
- Never promote to `main` without Nik's explicit production-release authorization.

## Preserve

- Concrete-native modular-monolith architecture.
- Supabase/PostgreSQL authority, RLS, tenant isolation, auditability, source-controlled migrations.
- Server-authoritative quantities, cost, pricing, and financial values.
- Immutable/versioned commercial records and lineage.
- Production Quantity, Direct Cost, and Sell as distinct concepts.
- Persisted page-coordinate 2D/vector geometry as Takeoff quantity authority; derived 3D is verification only.
- Human authority over scope, Conditions, means/methods, reinforcing, production rates, pricing, margin, budgets, and approvals.
- Current governed UI/Takeoff authorities referenced by root `AGENTS.md`.

## Plugin coordination

Carez policy controls how installed plugins are used.

### Superpowers

- Use Superpowers for unresolved design, planning, systematic debugging, and other relevant process work.
- If the current task explicitly says a design/spec/plan is approved, do not re-run brainstorming or rewrite the approved artifact.
- Any Superpowers subagent dispatch must obey the Carez worker routing below: Luna first, Terra only when justified, never Astra as a child.
- In a premium implementation turn, do not invoke subagent-driven-development review chains, requesting-code-review, verification-before-completion, TDD/reviewer loops, or branch-finishing verification unless the user explicitly assigns that work in the current task.
- Superpowers does not authorize work after the premium stop boundary.

### Impeccable

- Use Impeccable only for design-relevant frontend work.
- Load its project context once per UI session and use the narrow command/playbook that serves the assigned scope.
- During premium implementation, Impeccable may inform the implementation itself; do not append a separate critique, audit, polish, adapt, or detector pass unless the user explicitly requests it.
- Automatic detector findings may be handled inline only when they concern the currently edited scope. They do not authorize a new review cycle.
- The premium launcher disables Impeccable automatic hooks for that process so explicit Impeccable skills remain available without a Stop-hook polish loop.

## Execution modes

### Routine/local

The canonical routine workstation remains the isolated local Codex Web UI → app-server → OmniRoute → Ollama path documented in `docs/workflow/LOCAL_CODEX_WORKSTATION.md`.

For routine/local implementation:

1. Inspect only targets and direct dependencies.
2. Make the smallest coherent diff; no unrelated refactor/dependency.
3. Reuse existing helpers/components/schema patterns.
4. Database changes use source-controlled migrations and preserve RLS/lineage.
5. Run targeted tests plus `pnpm typecheck`; use `pnpm check` only for broad/high-risk work or when requested.
6. Update durable docs only when the contract/current state changes.
7. Commit/push when the bounded task includes delivery.

Routine/local work may use Superpowers verification/TDD/review or Impeccable detector/audit flows when they are appropriate because those are not premium Astra implementation turns.

### Premium hosted

Premium routing is opt-in and documented in `docs/workflow/CAREZ_TOKEN_EFFICIENCY.md`.

Default premium profile:

- parent: GPT-6 Astra at low effort;
- default worker: GPT-5.6 Luna at medium effort;
- escalation worker: GPT-5.6 Terra at medium effort;
- never spawn Astra as a child;
- normally one worker, maximum two independent workers;
- fresh bounded child brief; use `fork_turns: none` when exposed.

For an authorized **premium implementation** task, the execution contract is absolute:

```text
IMPLEMENT -> COMMIT -> PUSH -> STOP
```

Unless the current user task explicitly asks the premium run to validate, Astra must **not** continue into tests, typecheck, lint, browser/visual QA, regression sweeps, auto-review/reviewer passes, GitHub Actions inspection, Vercel/deployment monitoring, waiting, optional cleanup, a second polish pass, or plugin-driven finish workflows.

Carez control-room tooling, CI, connected systems, local Codex, or cheaper workers perform acceptance after the premium implementation turn has stopped.

Use `scripts/install-carez-astra-routing.ps1` to install the source-controlled `carez-astra` profile. Use `scripts/start-carez-astra.ps1` to start a premium CLI session with Impeccable automatic hooks disabled for that process. Do not install the premium profile into `.codex-omniroute`.

## Runtime boundary

Provider credentials, auth, `CODEX_HOME`, OmniRoute/Ollama state, MCP credentials, plugin installation state, and machine-specific runtime state stay outside the Carez repository. Repository-owned routing templates contain no secrets and are development tooling, not product architecture.

OpenCode is not part of the Carez workflow.

## Final response

Maximum 6 lines / 90 words unless the user requests more. State changed files/behavior, validation only if actually performed, blocker/risk, and commit/ref when available.
