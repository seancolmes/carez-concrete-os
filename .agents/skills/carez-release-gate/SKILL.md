---
name: carez-release-gate
description: Perform the Carez staging release gate after a coherent batch of local commits is ready to publish. Use only when the user explicitly asks to prepare, verify, or execute the staging release gate. Confirm branch and working-tree state, intended commits, final validation, migration review, and deployment-path readiness without silently committing, pushing, deploying, or mutating remote systems. Produce a concise GO/BLOCKED evidence packet for Nik's final decision.
---

# Carez Release Gate

Verify that a coherent local staging batch is ready for the human publish step.

## Authority

Use current `AGENTS.md` and `CODEX.md` as execution authority. Some older workflow documents still contain cloud-first language; do not let them override the current local-first contract.

## Workflow

1. Confirm current branch is `staging`.
2. Confirm the working tree contains no unexpected uncommitted implementation work for the release batch.
3. Identify the intended local commits and any migration files included.
4. Run/verify final repository validation appropriate to the batch. For broad release checkpoints, `pnpm check` is the canonical package script.
5. If migrations are included, invoke/use `carez-db-migration` review criteria before release readiness.
6. Confirm the intended staging deployment path is known; do not assume an unaudited migration/deploy ordering.
7. Report GO or BLOCKED with evidence. Stop before push unless the user explicitly authorizes the human/remote publish action.

## Progressive detail

Read `references/gate-checklist.md` only while performing the release gate.
