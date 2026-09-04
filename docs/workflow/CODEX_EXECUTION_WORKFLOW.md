# Carez Codex Execution Workflow

Status: Canonical execution workflow

## Purpose

Use Codex as a code executor, not as the primary Carez product-reasoning or release-management surface.

Carez uses a local-first coding model:

1. The owning ChatGPT Carez chat performs product reasoning, canonical-document review, repository inspection, task scoping, acceptance-definition, QA coordination, deployment/release inspection, and documentation reconciliation.
2. Local Codex using Ollama + `gpt-oss:20b` is the default Codex executor for bounded implementation work.
3. Cloud Codex is an escalation path for difficult/high-risk work that materially benefits from a stronger model or hosted tooling.
4. GitHub Actions is the comprehensive validation authority after push.
5. User browser QA occurs only on the stable `staging` Vercel URL.

This workflow supplements `DEVELOPMENT_WORKFLOW.md` and does not change the `staging` / `main` branch model.

## Execution ownership

### ChatGPT / connected tools own

- current-priority and roadmap review;
- canonical docs, ADRs, issues, PRs, and repository inspection;
- product and architecture decisions;
- screenshot and QA analysis;
- root-cause framing before implementation when practical;
- implementation-packet preparation;
- GitHub Actions, Vercel, and Supabase inspection when available;
- browser QA coordination and acceptance;
- issue/doc/current-state reconciliation;
- release management.

### Local Codex owns by default

- bounded React/TypeScript implementation;
- shadcn/component conversion;
- CSS/Tailwind work;
- forms, tables, grids, routes, and straightforward API handlers;
- repetitive or mechanical refactoring;
- targeted tests and straightforward test additions;
- known-fix debugging where the failure and acceptance criteria are already bounded;
- other implementation where the approved behavior is already defined.

### Cloud Codex is reserved for escalation

Use cloud Codex when the work includes one or more of the following and local execution is not clearly sufficient:

- difficult cross-file root-cause discovery;
- Takeoff geometry or measurement math;
- concurrency or reconciliation logic;
- RLS/security-sensitive work;
- complex Supabase migrations;
- Concrete Condition persistence/domain logic;
- immutable commercial or estimate lineage;
- difficult performance problems;
- complex browser automation/debugging;
- large refactors requiring broad repository understanding;
- a bounded local task that fails twice and still requires stronger implementation reasoning.

Do not spend cloud Codex usage on routine repository archaeology, docs review, Vercel polling, release bookkeeping, or simple mechanical edits.

## Local provider verification

Before beginning a task intended to avoid hosted Codex usage, verify that the active Codex provider is the local Ollama provider and the selected model is `gpt-oss:20b`.

If provider/model identity is uncertain, stop before execution. Do not assume a session is local because a previous session was local.

Use clear task naming that distinguishes local from cloud execution when practical.

## One objective per Codex task

A Codex task should normally contain one coherent implementation objective.

Prefer a fresh bounded task over a long-running general Carez coding thread. Do not append unrelated work merely because an existing Codex thread already has repository context.

Long-running task history is execution evidence, not canonical Carez product memory.

## Implementation packet

The owning Carez chat should prepare a self-contained packet before Codex execution whenever practical.

Minimum packet:

```text
CAREZ IMPLEMENTATION TASK

Execution: Local Codex / Cloud Codex
Branch: staging
Objective: <one bounded outcome>

Confirmed behavior / root cause:
- <what is already known>

Target files / area:
- <known paths or bounded subsystem>

Required change:
1. <requirement>
2. <requirement>

Do not:
- reopen approved architecture unless contradictory repository evidence makes implementation unsafe
- modify unrelated code
- change protected domain/data behavior outside the task
- perform release management or Vercel polling
- update unrelated documentation

Validation:
- <smallest appropriate local checks>

Completion:
- report changed files
- report validation results
- provide commit SHA when committed/pushed
- STOP
```

When an implementation packet already states approved architecture and behavior, Codex should implement that packet rather than independently re-auditing Carez architecture. It may read a referenced canonical file when needed to safely resolve an implementation dependency or contradiction.

## Two-attempt local stop rule

For a bounded local task:

1. Attempt the implementation once with `gpt-oss:20b`.
2. If validation fails, provide the exact failure and allow one focused corrective attempt.
3. If the second attempt fails, stop the local loop.
4. Return the evidence to the owning Carez chat.
5. Re-scope the packet or escalate the narrowed problem to cloud Codex when justified.

Do not allow repeated speculative local retries to replace root-cause analysis.

## Validation policy

Run the cheapest validation that is sufficient to catch likely implementation errors before push.

Typical guidance:

- small/localized edit: targeted test or typecheck as appropriate;
- normal implementation: typecheck plus relevant targeted tests;
- high-risk domain change: typecheck plus relevant domain tests and any additional focused validation needed for the changed invariant.

Do not require every Codex task to run the complete production build when the change does not justify it.

After push, GitHub Actions remains the comprehensive repository validation path and currently performs install, typecheck, domain tests, and production build. A local pass does not replace CI.

## Deployment and QA boundary

Codex should normally stop after implementation, appropriate local validation, and push/checkpoint reporting.

Codex should not sit idle polling Vercel or repeatedly checking CI unless the task explicitly requires execution-time investigation of a deployment failure.

After Codex stops:

1. GitHub Actions validates the pushed change.
2. ChatGPT/connected tools inspect CI and deployment state.
3. The stable `staging` deployment updates.
4. Nik/browser QA verifies rendered behavior where applicable.
5. The owning chat reconciles issues and canonical documentation.

A successful build is not rendered UI acceptance.

## Branch rule

Permanent branches remain only `staging` and `main`.

Routine approved implementation should use current `staging` when safe. A temporary branch remains an exceptional internal implementation detail for substantial/risky isolated work and must be merged into `staging` and deleted before user QA.

Never use `main` to test speculative work.

## Protected invariants

Regardless of execution environment, preserve:

- Supabase/PostgreSQL authority and tenant/RLS isolation;
- server-authoritative quantity, cost, and commercial calculations;
- immutable/versioned commercial and published Condition/template history;
- Production Quantity, Direct Cost, and Sell separation;
- PDF as Takeoff visual reference with stable page-coordinate vector geometry as measurement authority;
- Takeoff → Condition/module output → estimate lineage;
- derived 3D as verification, never a second quantity engine;
- the accepted ADR-015 dark shadcn system and ADR-016 top-navigation shell;
- the single stable `staging` QA target.

## Escalation principle

Cloud Codex is an expert escalation budget. Local Codex is the default coding worker. ChatGPT remains the coordination and reasoning surface. GitHub Actions remains the comprehensive validation surface.
