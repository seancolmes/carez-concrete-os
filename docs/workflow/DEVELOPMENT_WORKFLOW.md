# Carez Development Workflow

## Branch model

Read `BRANCH_AND_RELEASE_MODEL.md` first.

Permanent branches are only:
- `staging` — development, integration, QA, and user acceptance;
- `main` — production.

Nik tests only the stable `staging` Vercel URL. Never send him to a feature-branch or PR preview to determine which build is current.

Temporary branches are exceptional internal implementation details. If technically necessary, create from current `staging`, validate, merge into `staging`, and delete before user browser QA.

## Work cycle

1. Read canonical docs.
2. Identify one coherent objective.
3. Inspect current implementation.
4. Reproduce/understand the issue or gap.
5. Separate observed evidence from hypothesis and confirm root cause.
6. Make the smallest coherent change.
7. Preserve architecture, tenant isolation, data/domain/commercial lineage, and unrelated behavior.
8. Run relevant tests, typecheck, and build.
9. Confirm the stable staging deployment updated.
10. Browser-verify rendered UI changes on the one staging QA URL.
11. Update canonical docs when approved behavior or verified state changed.
12. Leave a clean resumable checkpoint.

Use GitHub issues for work to be done, module specs/ADRs for product truth, and `CURRENT_STATE.md` for verified implementation status. Pull requests are optional implementation/review records, not separate user-facing builds.

## Release

Promote `staging` to `main` only after the intended release scope is accepted and production promotion is explicitly authorized. Never test speculative work by pushing it to `main`.
