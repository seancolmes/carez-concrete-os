# Carez Development Workflow

## Branch model

Read `BRANCH_AND_RELEASE_MODEL.md` first.

Permanent branches are only:
- `staging` — development, integration, QA, and user acceptance;
- `main` — production.

Nik tests only the stable `staging` Vercel URL. Never send him to a feature-branch or PR preview to determine which build is current.

Temporary branches are exceptional internal implementation details. If technically necessary, create from current `staging`, validate, merge into `staging`, and delete before user browser QA.

## Execution model

Carez uses the local-first Codex workflow defined in `CODEX_EXECUTION_WORKFLOW.md` and ADR-017.

Default division of labor:

- ChatGPT/connected tools: canonical-doc/repository inspection, product/architecture reasoning, issue triage, implementation scoping, QA coordination, CI/deployment inspection, documentation reconciliation, and release management.
- Local Codex with Ollama + `gpt-oss:20b`: default bounded coding executor.
- Cloud Codex: escalation for difficult/high-risk implementation, complex debugging, migrations/RLS/security-sensitive work, Takeoff geometry/math, Condition persistence/domain logic, commercial lineage, major refactors, or justified browser automation.
- GitHub Actions: comprehensive post-push validation.
- Stable `staging`: only user-facing QA target.

Before work intended to use local inference, verify the active provider/model is actually local Ollama + `gpt-oss:20b`.

## Work cycle

1. Read only the canonical docs needed to understand current state, priority, and the bounded change.
2. Identify one coherent objective.
3. Inspect the relevant implementation and reproduce/understand the issue or gap.
4. Separate observed evidence from hypothesis and confirm root cause when practical before coding.
5. Prepare a bounded implementation packet with objective, target area/files, required behavior, protected boundaries, and validation.
6. Execute the change locally by default when the task fits `gpt-oss:20b`; use cloud Codex only when escalation criteria are met.
7. Make the smallest coherent change and preserve architecture, tenant isolation, data/domain/commercial lineage, and unrelated behavior.
8. Run task-appropriate local validation rather than automatically running every check for every small edit.
9. Push/checkpoint the change and stop the coding task.
10. Let GitHub Actions perform comprehensive typecheck/tests/build validation.
11. Confirm the stable staging deployment updated.
12. Browser-verify rendered UI changes on the one staging QA URL.
13. Update canonical docs/issues when approved behavior or verified state changed.
14. Leave a clean resumable checkpoint.

## Local retry rule

For a bounded local Codex task:

1. Make one implementation attempt.
2. If validation fails, provide the exact failure and allow one focused corrective attempt.
3. If the second attempt fails, stop.
4. Return the evidence to the owning Carez chat for re-scoping or cloud escalation.

Repeated speculative local retries are not a substitute for root-cause analysis.

## Validation policy

Use proportional local validation:

- small/localized edit: targeted test or typecheck as appropriate;
- normal implementation: typecheck plus relevant targeted tests;
- high-risk domain change: typecheck plus relevant domain tests and any additional focused validation needed for the changed invariant.

GitHub Actions remains the comprehensive validation authority after push. A local pass does not replace CI.

## Documentation and release

Use GitHub issues for work to be done, module specs/ADRs for product truth, and `CURRENT_STATE.md` for verified implementation status. Pull requests are optional implementation/review records, not separate user-facing builds.

Codex should normally not poll Vercel, perform release bookkeeping, or update unrelated documentation. Those responsibilities return to the owning ChatGPT Carez chat after implementation.

Promote `staging` to `main` only after the intended release scope is accepted and production promotion is explicitly authorized. Never test speculative work by pushing it to `main`.
