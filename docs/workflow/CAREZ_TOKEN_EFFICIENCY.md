# Carez token-efficient agent routing

This document owns the **premium-model usage policy** for Carez development tooling. It does not change Carez product/runtime architecture.

## Goal

Use premium intelligence only where it materially improves the result, while keeping process and design plugins useful without allowing them to create premium-model review loops.

```text
Nik / Carez control room
        |
        v
Carez repository authority
        |
        +--> Superpowers process skills
        +--> Impeccable design skills
        |
        v
GPT-6 Astra / low
architecture + difficult decisions + high-value implementation
        |
   +----+----+
   |         |
   v         v
Luna       Terra
default    escalation
worker     worker
```

The local OmniRoute/Ollama workstation remains a separate low-cost implementation path. This profile is an opt-in hosted Codex path for tasks that justify Astra.

## Authority order

For Carez work, precedence is:

```text
Nik / explicit current task
→ AGENTS.md + CODEX.md
→ approved Carez specs / ADRs / routing policy
→ Superpowers + Impeccable
→ model execution
```

Plugins provide methods; they do not redefine scope, model tier, validation ownership, or the premium stop boundary.

If the user says a design, spec, or plan is already approved, that approval is authoritative. Do not re-brainstorm it, re-plan it, or reopen settled product decisions merely because a process plugin would normally begin there.

## Model policy

### Astra keeps

- architecture and cross-cutting product decisions;
- ambiguous design decisions;
- difficult integration decisions;
- implementation where Astra materially improves quality.

### Luna takes by default

- targeted repository reads;
- dependency tracing;
- file/symbol inventory;
- bounded routine edits;
- extraction/classification;
- explicitly assigned narrow checks.

### Terra is the escalation worker

Use Terra only when the bounded worker task needs more capability than Luna but does not justify Astra.

### Never clone the premium parent

- Never spawn GPT-6 Astra as a child.
- Give children a fresh self-contained brief; use `fork_turns: none` when the spawn interface exposes it.
- Normally use one worker. Two is the maximum and only for truly independent work.
- Workers never spawn more workers.
- Any plugin-driven dispatch, including Superpowers, must obey this routing.

## Superpowers policy

Superpowers is an approved Carez process plugin.

Use it when its process materially helps the task, especially:

- brainstorming when the design is genuinely unresolved;
- writing plans when a plan is actually needed and not already approved;
- systematic debugging for a real defect;
- receiving review feedback when Carez is acting on external review.

For **premium Astra implementation runs**:

- do not re-run brainstorming or planning when the task already names an approved design/spec/plan;
- do not let `subagent-driven-development` create implementer/reviewer chains unless the user explicitly requests that workflow;
- do not invoke `requesting-code-review`, `verification-before-completion`, TDD/reviewer loops, or `finishing-a-development-branch` as automatic completion steps;
- if a Superpowers skill dispatches a helper, route it to Luna first and Terra only when justified;
- Superpowers never authorizes another Astra child or work after the premium stop boundary.

Routine/local work may use the fuller Superpowers engineering workflow because it is not spending the premium Astra implementation budget.

## Impeccable policy

Impeccable is an approved Carez frontend-design plugin.

For design-relevant work:

- load Impeccable context once per UI session;
- use the narrowest command/playbook that serves the requested change;
- preserve Carez visual authority from ADR-024, ADR-020 where applicable, and the Carez component pack;
- use Impeccable as design intelligence during implementation, not as permission to redesign outside the approved brief.

For **premium Astra implementation runs**:

- explicit Impeccable design commands are allowed when they directly serve the assigned UI scope;
- do not automatically append `critique`, `audit`, `polish`, `adapt`, or a detector pass after implementation;
- do not start a second visual iteration loop because a plugin recommends one;
- automatic detector findings may be handled inline only when they concern the current edit and are necessary to complete that edit;
- the premium CLI launcher sets `IMPECCABLE_HOOK_DISABLED=1` for that process, disabling automatic hooks without disabling explicit Impeccable skills or manual commands.

For routine/local or cheaper QA work, Impeccable hooks/audit/polish may be enabled when appropriate.

## Premium stop rule

For an authorized premium implementation run:

```text
IMPLEMENT -> COMMIT -> PUSH -> STOP
```

Astra must not continue into:

- tests, typecheck, lint, or broad checks unless the task explicitly assigns them;
- browser/visual QA;
- regression sweeps;
- auto-review/reviewer passes;
- Superpowers completion/reviewer workflows;
- Impeccable audit/critique/polish completion passes;
- GitHub Actions inspection;
- Vercel/deployment monitoring or waiting;
- optional cleanup or a second polish pass.

The Carez control room performs acceptance separately using connected GitHub, Vercel, Supabase, browser tooling, CI results, local Codex, or cheaper workers.

This separation is intentional: the expensive model builds the high-value change; verification is handled outside the premium implementation turn.

## Codex profile

The source-controlled templates are:

```text
tools/codex/carez-astra/carez-astra.config.toml
tools/codex/carez-astra/agents/luna-worker.toml
tools/codex/carez-astra/agents/terra-worker.toml
```

The profile pins:

- parent: `gpt-6-astra`, reasoning `low`;
- plan reasoning: `low`;
- default child: `gpt-5.6-luna`, reasoning `medium`;
- escalation child: `gpt-5.6-terra`, reasoning `medium`;
- maximum open child threads: 2;
- multi-agent tools enabled for Superpowers/explicit worker dispatch;
- interruption context suppressed.

Current Codex supports a selected profile at `$CODEX_HOME/<name>.config.toml`, plus `[agents]` defaults for spawned subagent model, effort, and concurrency. Project/provider credentials remain outside this repository.

## Plugin prerequisites

Before installing/using the premium profile in the hosted Codex home:

1. install/enable **Superpowers** from `/plugins`;
2. install/enable **Impeccable** from `/plugins`;
3. start a fresh Codex session after plugin changes;
4. keep the local `.codex-omniroute` home separate.

Plugin versions are machine/runtime state and are intentionally not pinned in the repository.

## Install

From the Carez repository on Windows:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-carez-astra-routing.ps1 -DryRun
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-carez-astra-routing.ps1
```

The installer writes only:

```text
$CODEX_HOME/carez-astra.config.toml
$CODEX_HOME/agents/luna-worker.toml
$CODEX_HOME/agents/terra-worker.toml
```

If `CODEX_HOME` is unset it uses `%USERPROFILE%\.codex`.

It refuses to install into the canonical local `.codex-omniroute` home. Existing target files are backed up before replacement.

It does **not** modify:

- `config.toml`;
- global `AGENTS.md`;
- `auth.json`;
- MCP servers;
- plugins;
- provider configuration;
- notification settings;
- secrets.

## Start premium Codex

Use the Carez launcher:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-carez-astra.ps1
```

The launcher:

- starts Codex with `--profile carez-astra`;
- applies `IMPECCABLE_HOOK_DISABLED=1` only to that premium process;
- restores the caller's previous Impeccable hook environment value afterward;
- does not disable explicit `$impeccable` skills;
- does not alter plugin installation or project config.

Direct invocation remains available when automatic Impeccable hooks are intentionally desired:

```powershell
codex --profile carez-astra
```

## Work mode

ChatGPT Work does not read a workstation `CODEX_HOME`. Use the compact prompt footer in:

```text
tools/codex/carez-astra/WORK_PROMPT_SUFFIX.md
```

The same rule applies: premium Work implements and stops; the Carez control room validates separately. Superpowers and Impeccable may help inside the assigned implementation, but neither may create a post-implementation review loop.

## Usage discipline

Before a premium run:

1. choose Astra Low/Light rather than a higher effort by default;
2. keep Fast mode off unless speed is explicitly worth additional allowance;
3. provide exact file paths and hard scope;
4. provide the approved design/architecture decision instead of asking Astra to rediscover it;
5. append the premium Work footer when using Work;
6. do not ask the premium model to “make sure everything works”;
7. do not request plugin-driven audit/review/polish unless that is the actual premium task.

If a lower-cost model can do the task, use it instead of Astra.
