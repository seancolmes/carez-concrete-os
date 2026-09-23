---
name: carez-release-gate
description: Perform the Carez staging release gate after a coherent batch of local commits is ready to publish. Use only when the user explicitly asks to prepare, verify, or execute staging release readiness. Confirm branch/tree state, intended commits, final validation, migration review, and deployment-path readiness without silently committing, pushing, deploying, or mutating remote systems. Do not activate for routine typecheck/test requests or vague language that does not clearly authorize a release-readiness gate.
---

# Carez Release Gate

Verify that a coherent local staging batch is ready for the human publish step.

## Authority

Follow the already-loaded current `AGENTS.md` and `CODEX.md`. Older workflow documents do not override the current local-first contract.

## Workflow

1. Read `references/gate-checklist.md`; this reference is part of the release gate itself.
2. Confirm current branch is `staging`.
3. Confirm the working tree contains no unexpected uncommitted implementation work for the release batch.
4. Identify the intended local commits and any migration files included.
5. Run/verify final repository validation appropriate to the batch. For broad release checkpoints, `pnpm check` is canonical.
6. If migrations are included, also use `carez-db-migration` review criteria before release readiness. Do not spawn `reviewer` for an ordinary clean release gate; use it only when the batch itself contains high-risk database, security, financial, quantity-authority, architecture-sensitive work, or when an explicit review is requested.
7. Confirm the intended staging deployment path is known; do not assume an unaudited migration/deploy ordering.
8. Report GO or BLOCKED with evidence. Stop before push unless the user explicitly authorizes the remote publish action.

## Boundary

Release readiness is not release authorization. Never infer permission to push, deploy, or mutate a remote database from a successful gate.
