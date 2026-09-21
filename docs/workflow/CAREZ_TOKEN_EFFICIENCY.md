# Carez cloud model routing and token efficiency

This document owns Carez model-cost routing. It does not change product/runtime architecture.

## Core rule

All Carez agent execution is cloud-hosted and may consume credits or allowance.

There is no canonical local/free Codex path. Do not describe Luna, Terra, Codex, Work, or any other cloud model as free.

```text
Nik / Carez control room
        |
        +--> connected tools for inspection / acceptance / bounded maintenance
        |
        +--> Work/Codex cloud for substantial implementation
                |
                +--> Luna: default lower-cost helper
                +--> Terra: escalation helper
                +--> Astra: premium parent only when explicitly justified
```

## Authority order

```text
Nik / explicit current task
→ AGENTS.md + CODEX.md
→ approved Carez specs / ADRs / routing policy
→ Superpowers + Impeccable
→ model execution
```

Plugins provide methods; they do not redefine scope, model tier, validation ownership, or the premium stop boundary.

## Cost policy

Use the least expensive capable route.

### Control room / connected tools

Prefer for:

- architecture/product decisions;
- task definition;
- GitHub/Supabase/Vercel inspection;
- issue/PR coordination;
- acceptance and status reconciliation;
- bounded direct maintenance.

### Luna

Default helper for:

- targeted repository reads;
- dependency tracing;
- file/symbol inventory;
- extraction/classification;
- routine bounded edits;
- narrow checks.

### Terra

Use only when Luna is insufficient but the task still does not justify Astra.

### Astra

Reserve for:

- major visual invention;
- difficult cross-cutting architecture;
- ambiguous high-value product/design decisions;
- implementation where premium capability materially improves quality.

Never spawn Astra as a child. Normally use one helper; use two only for truly independent work.

## Superpowers

Use when its process materially helps:

- brainstorming when design is genuinely unresolved;
- planning when no approved plan exists;
- systematic debugging;
- receiving/reconciling review feedback.

If the current task already names an approved design/spec/plan, do not re-run brainstorming or planning merely because a skill would normally start there.

Any helper dispatch follows Carez routing: Luna first, Terra only when justified, never Astra as child.

## Impeccable

Use for design-relevant frontend work inside the assigned scope.

ADR-025 and the Carez component pack are the visual authority. Impeccable can guide implementation, but it does not authorize unrelated redesign or a second automatic polish/review loop.

## Premium Astra stop rule

For an authorized Astra implementation task:

```text
IMPLEMENT -> COMMIT -> PUSH -> STOP
```

Unless Nik explicitly assigns validation to that run, Astra must not continue into:

- tests/typecheck/lint;
- browser or visual QA;
- regression sweeps;
- auto-review/reviewer passes;
- Superpowers completion/reviewer workflows;
- Impeccable audit/critique/polish passes;
- GitHub Actions inspection;
- Vercel/deployment monitoring or waiting;
- optional cleanup or a second polish pass.

The Carez control room or explicitly assigned lower-cost cloud execution handles acceptance afterward.

## Premium Work prompt footer

When Astra is justified, append this compact boundary:

```text
CAREZ PREMIUM EXECUTION RULE

Use Astra only for the requested high-value implementation/decision work.
The explicit task plus AGENTS.md/CODEX.md and approved specs/ADRs outrank plugin defaults.
Do not re-brainstorm or re-plan approved work.
Read only named targets and direct dependencies.

If helper work is needed, use Luna first and Terra only if Luna is insufficient. Never spawn Astra.

Do not perform post-implementation validation unless explicitly assigned:
no tests/typecheck/lint, browser QA, regression sweep, auto-review, GitHub Actions inspection, Vercel monitoring, optional cleanup, or second polish pass.

IMPLEMENT -> COMMIT -> PUSH -> STOP.

Return only commit SHA, files changed, and blocker.
```

## Usage discipline

Before a premium run:

1. confirm the task genuinely benefits from Astra;
2. keep the brief narrow and name exact files/scope;
3. provide approved design/architecture instead of asking Astra to rediscover it;
4. route helper work to Luna first;
5. do not ask Astra to “make sure everything works” unless validation is intentionally the premium task;
6. stop after commit/push and perform acceptance separately.
