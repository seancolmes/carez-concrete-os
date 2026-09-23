# Carez Branch and Release Model

This document defines the permanent branch/test model for Carez Concrete OS.

## Permanent branches

Carez has exactly two permanent branches:

- `staging` — development, integration, QA, and user acceptance.
- `main` — production only.

Do not create long-lived module, experiment, archive, QA, governance, or release-candidate branches.

## Source authority

Local working-tree changes and local commits are authoritative for in-progress work. `origin/staging` is the shared integration baseline. Never auto-reset, rebase, stash, discard, or overwrite intentional local work merely to match remote state. Query GitHub, Supabase, or Vercel only when current provider truth materially affects the task; READ access does not authorize WRITE actions.

## One user-facing QA build

Nik tests only the stable Vercel deployment for `staging`:

`https://carez-concrete-os-git-staging-seancolmes-projects.vercel.app`

Do not ask Nik to choose a commit preview, PR preview, or alternate Vercel URL for normal staging acceptance.

## Normal change flow

1. Discuss/approve the idea in the Carez control room or canonical issue/spec when material.
2. Implement locally and run local validation.
3. Perform local browser/runtime QA, then obtain Nik acceptance where required.
4. Create the local commit through GitHub Desktop.
5. Run the release gate. `GO` means ready to publish; it is not authorization to publish.
6. Publish to `staging` through GitHub Desktop under human control.
7. GitHub Actions validates applicable pushes; the existing Git integration drives the staging Vercel deployment.
8. Test the stable staging URL and record verified acceptance/current state as applicable.
9. Promote `staging` to `main` only as an explicitly authorized production release after acceptance.

The normal execution path is:

```text
ChatGPT control room
→ local Codex
→ local validation
→ local browser/runtime QA
→ Nik acceptance
→ GitHub Desktop local commit
→ release gate
→ human-authorized staging publication
→ GitHub Actions
→ existing Git-integrated Vercel staging deployment
```

## Temporary branches

A temporary branch is allowed only when technically necessary for substantial isolated work or risk containment.

If required:

- start from the shared `origin/staging` integration baseline;
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
