# Carez Branch and Release Model

This document defines the permanent branch/test model for Carez Concrete OS.

## Permanent branches

Carez has exactly two permanent branches:

- `staging` — development, integration, QA, and user acceptance.
- `main` — production only.

Do not create long-lived module, experiment, archive, QA, governance, or release-candidate branches.

## Source authority

Online GitHub is authoritative. A local checkout is only a replaceable mirror.

If local and remote history disagree, inspect/fetch the online repository and align the mirror to GitHub. Never force authoritative remote history from a stale local checkout.

## One user-facing QA build

Nik tests only the stable Vercel deployment for `staging`:

`https://carez-concrete-os-git-staging-seancolmes-projects.vercel.app`

Do not ask Nik to choose a commit preview, PR preview, or alternate Vercel URL for normal staging acceptance.

## Normal change flow

1. Discuss/approve the idea in the Carez control room or canonical issue/spec when material.
2. Verify current online `staging`.
3. Implement with connected control-room tools or ChatGPT Work/Codex cloud at the lowest suitable model cost.
4. Run required targeted checks, normally `pnpm typecheck` + relevant tests.
5. Commit/push to `staging` or a temporary branch targeting `staging`.
6. Require the matching GitHub Actions validation to pass.
7. Wait for the stable staging Vercel deployment to update.
8. Nik tests the stable staging URL.
9. Record browser acceptance and update `CURRENT_STATE.md` when verified state changes.
10. Promote `staging` to `main` only as an explicit production release after acceptance.

All agent execution is cloud-hosted and may consume credits/allowance; model routing is a development-cost concern, not a branch/release concern.

## Temporary branches

A temporary branch is allowed only when technically necessary for substantial isolated work or risk containment.

If required:

- start from current online `staging`;
- target `staging`;
- keep it internal to implementation/review;
- merge after required validation;
- retire it after integration;
- normal user browser QA still occurs on stable `staging`.

## History and rollback

Git commits, merged PRs, issues, ADRs, module specs, and release history preserve historical evidence. Do not retain stale branches or working documents solely as archives.

If a rollback point needs a durable label, use a Git tag/release rather than another permanent branch.

## Vercel

- `staging` is the canonical QA branch alias.
- `main` is the production deployment line.
- Feature-branch deployments may exist transiently but are not the normal acceptance target.

## Database authority

- `main`/production remains bound to the production Supabase project.
- `staging` remains bound to the isolated QA Supabase project.
- Never blur production and QA authority to simplify deployment routing.
