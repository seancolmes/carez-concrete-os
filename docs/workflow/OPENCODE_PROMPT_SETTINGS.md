# Carez Local Prompt Routing

Status: Canonical prompt-routing rule

## Purpose

Whenever ChatGPT gives Nik a prompt to run in the local Codex/Carez environment, ChatGPT must clearly state the intended Carez execution behavior without inventing UI controls that do not exist.

`Carez-Read`, `Carez-Build`, and reasoning levels are Carez prompt-routing instructions unless the active UI has a separately verified selectable control with that exact name. They are not assumed to be Codex profile or reasoning selectors.

## Required execution header

Every local Carez prompt begins with this block:

```text
CAREZ EXECUTION
Task mode: <Carez-Read | Carez-Build | future Carez task mode>
Reasoning intent: <Low | Medium | High>
Provider / model: <actual provider and model in use>
Branch: <branch>
UI changes required: <None | exact verified control change>
Why: <one short sentence explaining the routing>
```

### Important distinction

- `Task mode` is an instruction carried inside the prompt. It tells the local agent whether repository edits are permitted.
- `Reasoning intent` is an instruction carried inside the prompt. It describes how carefully the task should be reasoned about; do not tell Nik to select a reasoning control unless one has been verified to exist and be selectable in the active UI.
- `Provider / model` and `Branch` should reflect the actual environment. If a UI change is genuinely required, name only the control that is known to exist.
- A displayed label or status value is not proof that it is user-selectable.

## Task-mode routing

### Carez-Read

Use `Carez-Read` when the task is inspection, diagnosis, research, review, planning, root-cause analysis, or implementation scoping and no repository edits are intended.

Typical examples:

- inspect canonical docs and source;
- reproduce or diagnose a defect;
- compare implementations;
- identify the smallest safe fix;
- review a diff or test failure;
- prepare an implementation plan without changing files.

The prompt must explicitly say that repository edits, commits, pushes, resets, stashes, and destructive git operations are not allowed unless separately authorized.

### Carez-Build

Use `Carez-Build` whenever the prompt is expected or permitted to modify repository files or otherwise perform implementation work.

Typical examples:

- edit React/TypeScript/CSS;
- add or update tests;
- refactor bounded code;
- apply a confirmed bug fix;
- run validation associated with a code change;
- make documentation changes that are part of the implementation task.

A build task may include bounded investigation needed to implement the requested change, but uncertain or high-risk root-cause work should normally be separated into a `Carez-Read` task first.

## Reasoning-intent routing

ChatGPT chooses and states the reasoning intent for every local Carez prompt. This is prompt guidance, not an assumed UI setting.

- `High` — debugging with an unconfirmed root cause; cross-file behavior; architecture-sensitive work; Takeoff geometry/measurement behavior; persistence/concurrency/RLS/commercial lineage; difficult test failures; or any task where an incorrect assumption could cause broad rework.
- `Medium` — normal bounded implementation with approved behavior, known target files, and clear acceptance criteria.
- `Low` — genuinely mechanical, low-risk edits where the exact change is already obvious and no substantive reasoning is required.

When uncertain between two levels, choose the higher reasoning intent. If a future local UI exposes a verified selectable reasoning control, ChatGPT may additionally state the exact control value to choose. Until then, reasoning intent stays inside the prompt.

## Provider, model, and branch

Unless the canonical execution workflow says otherwise, local execution uses Ollama + `gpt-oss:20b` and current `staging`. Verify provider/model identity from the active environment before execution. `main` is production only and is never used for speculative implementation or testing.

Cloud or stronger-model escalation follows `docs/workflow/CODEX_EXECUTION_WORKFLOW.md` and the current Carez project instructions. Any escalation must be explicit.

## Prompt discipline

- One coherent objective per local Carez task.
- Do not instruct Nik to change a UI control unless that control has been verified to exist and be selectable.
- Do not present `Carez-Read` or `Carez-Build` as UI profiles unless actual profiles with those exact names are later created.
- Do not present `Low`, `Medium`, or `High` as selectable reasoning settings unless the active UI exposes a verified control.
- Put task mode and reasoning intent in the prompt itself so the local agent receives the instruction even when the UI has no corresponding selector.
- If the task changes from read-only diagnosis to implementation, issue a new execution header and prompt rather than assuming the prior mode still applies.
- Future Carez task modes or actual UI profiles must be named explicitly and distinguished from each other.
