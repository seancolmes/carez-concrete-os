# Carez OpenCode Prompt Settings

Status: Canonical prompt-routing rule

## Purpose

Whenever ChatGPT gives Nik a prompt to run in OpenCode Desktop, ChatGPT must also state the exact OpenCode settings to use before the prompt body. Nik should never have to infer which Carez profile, reasoning level, model/provider, or branch the prompt expects.

## Required settings header

Every OpenCode prompt begins with this block:

```text
OPENCODE SETTINGS
Profile: <Carez-Read | Carez-Build | future configured Carez profile>
Reasoning: <exact reasoning level to select>
Provider / model: <exact provider and model>
Branch: <branch>
Why: <one short sentence explaining the choice>
```

If a future Carez OpenCode profile is added, use its exact configured name in the header when it becomes the better fit for the task.

## Profile routing

### Carez-Read

Use `Carez-Read` when the task is inspection, diagnosis, research, review, planning, root-cause analysis, or implementation scoping and no repository edits are intended.

Typical examples:

- inspect canonical docs and source;
- reproduce or diagnose a defect;
- compare implementations;
- identify the smallest safe fix;
- review a diff or test failure;
- prepare an implementation plan without changing files.

### Carez-Build

Use `Carez-Build` whenever the prompt is expected or permitted to modify repository files or otherwise perform implementation work.

Typical examples:

- edit React/TypeScript/CSS;
- add or update tests;
- refactor bounded code;
- apply a confirmed bug fix;
- run validation associated with a code change;
- make documentation changes that are part of the implementation task.

A build task may include the bounded investigation necessary to implement the requested change, but uncertain or high-risk root-cause work should normally be separated into a `Carez-Read` task first.

## Reasoning routing

ChatGPT chooses and states the reasoning level for every OpenCode prompt.

- `High` — debugging with an unconfirmed root cause; cross-file behavior; architecture-sensitive work; Takeoff geometry/measurement behavior; persistence/concurrency/RLS/commercial lineage; difficult test failures; or any task where an incorrect assumption could cause broad rework.
- `Medium` — normal bounded implementation with approved behavior, known target files, and clear acceptance criteria.
- `Low` — only for genuinely mechanical, low-risk edits where the exact change is already obvious and no substantive reasoning is required.

When uncertain between two levels, choose the higher level. If OpenCode exposes different reasoning labels in the active model/profile, ChatGPT must state the exact selectable label rather than making Nik translate the recommendation.

## Provider, model, and branch

Unless the canonical execution workflow says otherwise, local execution uses Ollama + `gpt-oss:20b` and current `staging`. Verify provider/model identity before execution. `main` is production only and is never used for speculative implementation or testing.

Cloud or stronger-model escalation follows `docs/workflow/CODEX_EXECUTION_WORKFLOW.md` and the current Carez project instructions; the settings header must make any escalation explicit.

## Prompt discipline

- One coherent objective per OpenCode task.
- Do not send a bare implementation prompt without the settings header.
- If the task changes from read-only diagnosis to implementation, issue a new settings header and prompt rather than assuming the prior profile remains appropriate.
- Future profiles must be named explicitly; do not make Nik infer them from task wording.
