# Carez development workflow

## Branches

- `staging`: development, integration, QA, user acceptance.
- `main`: production only.
- Temporary branches are exceptional; if used, start from `staging`, merge back, delete before user QA.
- Nik tests only the stable staging Vercel alias from `docs/BRANCH_AND_RELEASE_MODEL.md`.

## Standard cycle

1. Read only the files needed for the bounded task.
2. Inspect the target implementation and direct dependencies.
3. Confirm root cause when practical.
4. Make the smallest coherent change.
5. For DB changes, add a source-controlled migration and apply to QA only unless production is explicitly authorized.
6. Validate proportionally: targeted checks for local edits; typecheck + relevant tests for normal work; add DB/RLS/security checks for high-risk data changes.
7. Push/checkpoint to `staging`.
8. Inspect GitHub Actions and the matching Vercel staging deployment.
9. Browser-verify rendered UI when applicable.
10. Update the owning module/ADR/`CURRENT_STATE.md` only when durable behavior or verified state changed.
11. Delete superseded working/checkpoint docs after surviving truth is captured canonically.

## Acceptance evidence

- Source inspection proves implementation only.
- Typecheck/build proves compile/integration only.
- Domain tests prove calculation/lineage contracts.
- DB inspection proves persistence/security behavior.
- Vercel proves deployed build/runtime state.
- Browser QA proves rendered user-visible behavior.

UI is not accepted as fixed until the exact behavior is re-tested in browser. Data/domain changes must preserve deterministic calculations, tenant isolation, mutation boundaries, and historical lineage.

## Approval → documentation

When a material decision is approved/final/locked:

- product/module behavior → owning `docs/modules/*.md`;
- cross-cutting architecture → `docs/ARCHITECTURE.md` and usually ADR;
- global UX/design rule → canonical design-system doc/ADR;
- sequence → `docs/ROADMAP.md`;
- verified implementation/blocker → `docs/CURRENT_STATE.md`;
- execution/process rule → `AGENTS.md`, `CODEX.md`, or this file.

Do not promote brainstorms, temporary hypotheses, or one-off private data.

## Release

Promote `staging` to `main` only after explicit production authorization and required acceptance. Production DB changes remain gated by Issue #59 while it is open.
