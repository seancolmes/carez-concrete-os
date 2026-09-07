# Carez Development Workflow

## Branch model

Permanent branches are only:
- `staging` — development, integration, QA, and user acceptance;
- `main` — production.

Nik tests only the stable `staging` Vercel URL. Temporary branches are exceptional internal implementation details. If technically necessary, create from current `staging`, validate, merge into `staging`, and delete before user browser QA.

## Execution model

The owning Carez ChatGPT conversation is the normal implementation and coordination surface when connected GitHub, Vercel, and Supabase tools are available.

Default division of labor:

- ChatGPT + GitHub: inspect source, edit repository files, commit/push to `staging`, manage issues, inspect CI.
- ChatGPT + Supabase: inspect QA schema/data, apply source-controlled QA migrations, validate RLS/security/database behavior.
- ChatGPT + Vercel: inspect staging deployments/build/runtime logs and verify the stable QA deployment.
- Browser/user QA: final rendered acceptance for user-visible behavior.

Do not hand routine Carez implementation back to Nik as a local coding prompt when the connected tools can perform the work directly.

## Work cycle

1. Read only the canonical docs needed for the bounded objective.
2. Inspect the relevant source/database behavior.
3. Separate observed evidence from hypothesis and confirm root cause when practical.
4. Make the smallest coherent implementation change on current `staging` when safe.
5. For database behavior, add/apply the source-controlled migration to isolated QA only unless production promotion is explicitly authorized.
6. Run or inspect task-appropriate validation.
7. Push/checkpoint the change.
8. Inspect GitHub Actions and the matching Vercel staging deployment.
9. Browser-verify rendered UI behavior when applicable.
10. Update canonical docs/issues when approved behavior or verified state changed.
11. Remove superseded working/checkpoint documentation once its surviving truth has been absorbed by canonical owners.
12. Leave a clean resumable checkpoint.

## Validation policy

Use proportional validation:

- small/localized edit: targeted check/typecheck as appropriate;
- normal implementation: typecheck plus relevant tests;
- high-risk domain/database change: typecheck plus relevant domain tests, migration/RLS/security verification, and staging runtime inspection.

GitHub Actions remains the comprehensive post-push validation authority. A source/build pass does not replace browser acceptance for rendered behavior.

## Documentation and release

Use GitHub issues for active work, module specs/ADRs for durable product truth, and `CURRENT_STATE.md` for concise verified implementation status.

Do not retain superseded design drafts, finished implementation checklists, old QA scripts, or obsolete execution-workflow documents in the active tree once their durable facts are captured elsewhere. Git history and closed issues preserve historical evidence.

Promote `staging` to `main` only after the intended release scope is accepted and production promotion is explicitly authorized. Never test speculative work by pushing it to `main`.
