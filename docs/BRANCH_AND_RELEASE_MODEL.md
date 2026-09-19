# Carez Branch and Release Model

This document defines the permanent branch/test model for Carez Concrete OS.

## Permanent branches

Carez has exactly two permanent branches:

- `staging` — the single development, integration, QA, and user-acceptance line.
- `main` — production only.

Do not create long-lived module, feature, experiment, archive, QA, governance, or release-candidate branches.

## One user-facing QA build

Nik tests only the stable Vercel deployment for `staging`:

`https://carez-concrete-os-git-staging-seancolmes-projects.vercel.app`

Do not ask Nik to choose a commit, branch preview, PR preview, or alternate Vercel URL.

The build identity may show the current staging commit for diagnostics, but the URL stays the same.

## Normal change flow

1. Discuss/approve the idea in the Carez control chat or canonical issue/spec when material.
2. Start from current `staging`.
3. Implement with the local Codex workstation; connected ChatGPT/GitHub tools may handle bounded repository maintenance directly when appropriate.
4. Run the required targeted checks, normally `pnpm typecheck` + relevant tests.
5. Commit/push to `staging`.
6. Require the staging GitHub Actions validation to pass.
7. Wait for the stable staging Vercel deployment to update.
8. Nik tests the same staging URL.
9. Record browser acceptance and update `CURRENT_STATE.md` when verified state changes.
10. Promote `staging` to `main` only as an explicit production release after acceptance.

The local AI runtime/provider is not a branch or release concern. See `docs/workflow/LOCAL_CODEX_WORKSTATION.md`.

## Temporary branches

A temporary branch is allowed only when technically necessary for substantial isolated coding, a migration that needs review, or work where direct staging changes would create unreasonable risk.

If one is required:

- it is an internal implementation detail;
- it must start from current `staging`;
- prefer a `carez-*` name so normal CI runs automatically;
- Nik is not asked to test its preview;
- it is merged into `staging` after automated validation;
- it is deleted immediately after integration;
- user browser QA happens only on the stable staging URL.

## History and rollback

Git commits, merged PRs, issues, ADRs, module specs, and release history preserve historical evidence. Do not keep stale branches solely as archives.

If a rollback point needs a durable label, use a Git tag/release rather than another permanent branch.

## Vercel

- `staging` is the only QA branch alias Nik should use.
- `main` is the production deployment line.
- Feature-branch deployments may exist transiently because of Git integration, but they are not user-facing test targets and should disappear with temporary branch cleanup.

## Database authority

- `main`/production remains bound to the production Supabase project.
- `staging` remains bound to the isolated QA Supabase project.
- Never blur production and QA authority to simplify deployment routing.
