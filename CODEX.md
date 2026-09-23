# Carez Concrete OS - local Codex execution contract

## Standard cycle

IMPLEMENT -> VALIDATE -> REVIEW -> STOP

## Start

- Work in the current local Carez repository.
- Expected normal branch: `staging`.
- Preserve intentional current work.
- If the branch is unexpected, Git state is surprising, requirements conflict, or a remote reconciliation would be required, stop and report the exact state.
- Do not create or switch branches unless explicitly instructed.

## Inspect

- Start with files named in the task.
- Read direct imports/dependencies only when required.
- Read an owning ADR/spec only when named or when target behavior is genuinely ambiguous.
- No broad repository scans, unrelated Git-history exploration, or web/plugin research unless required by the task.

## Subagents

- Single-agent execution is the default.
- Spawn a specialist only when its description's trigger is actually met and its read-heavy work can reduce ambiguity or context pollution.
- Do not spawn subagents for clear, bounded implementation with known files/direct dependencies.
- Use at most three concurrent subagents; prefer one or two.
- Specialists investigate/review only; the parent remains the sole application-code writer unless the task explicitly says otherwise.
- Never ask a subagent to spawn another agent.
- Wait for requested specialist results, distill only actionable evidence into the parent context, then close/stop the specialist thread.

## Worktrees

- Local is the foreground integration/QA workspace; managed worktrees are isolated background workspaces.
- Use a managed worktree only for independent, risky/experimental, or long-running work that benefits from isolation.
- Do not create a worktree for a clear small sequential edit.
- Normal worktree base is local `staging`; run the `Worktree Preflight` action before intentional parallel work.
- Prefer one active writable Carez worktree and use at most two when tasks are genuinely independent.
- Do not let Local and a writable worktree edit the same files or tightly coupled feature surface.
- Keep managed worktrees detached; do not create a branch for the normal Carez handoff path.
- Use **Hand off -> Local** for final IDE inspection, browser QA, acceptance, and the GitHub Desktop commit path.
- Full workflow: `docs/workflow/CODEX_WORKTREES.md`.

## Implement

- Make the smallest coherent change.
- Reuse existing helpers, components, schema patterns, and workflows.
- No unrelated refactors or dependencies.
- Preserve RLS, tenant isolation, auditability, lineage, deterministic calculations, and existing customer data.
- Database changes require source-controlled migrations.
- For UI work, implement the supplied design direction precisely; do not reopen approved design decisions.

## Validate

Use the smallest relevant validation.

Normally:
- targeted tests for changed scope when applicable
- `pnpm typecheck`
- `git diff --check`

Use `pnpm check` only for broad/high-risk work, architecture-sensitive changes,
release checkpoints, repository contract requirements, or explicit requests.

Do not repeat successful validation without a concrete reason.

## Review

Inspect the final diff for:
- requested scope
- unintended changes
- regressions
- unresolved blockers
- accidental formatting/churn

## Stop

Do not commit or push.
Do not deploy.
Do not mutate remote Supabase, Vercel, GitHub, or other connected systems.

Return:

CAREZ REVIEW PACKET

Branch:
Files changed:
Implementation summary:
Validation performed:
Validation results:
git diff --stat:
Known blocker:
Recommended local QA:
Suggested commit message:
