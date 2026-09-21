# Carez token-efficient agent routing

This document owns the **premium-model usage policy** for Carez development tooling. It does not change Carez product/runtime architecture.

## Goal

Use premium intelligence only where it materially improves the result.

```text
Nik / Carez control room
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

## Policy

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
- GitHub Actions inspection;
- Vercel/deployment monitoring or waiting;
- optional cleanup or a second polish pass.

The Carez control room performs acceptance separately using connected GitHub, Vercel, Supabase, browser tooling, CI results, or cheaper workers.

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
- interruption context suppressed.

OpenAI's current Codex configuration supports named profile files under `CODEX_HOME`, `default_subagent_model`, `default_subagent_reasoning_effort`, and a concurrent child-thread limit. Project/provider credentials remain outside this repository.

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

Then start a **new** ChatGPT-authenticated Codex session with:

```powershell
codex --profile carez-astra
```

GPT-6 Astra requires a current Codex client. Keep Codex updated before using this profile.

## Work mode

ChatGPT Work does not read a workstation `CODEX_HOME`. Use the compact prompt footer in:

```text
tools/codex/carez-astra/WORK_PROMPT_SUFFIX.md
```

The same rule applies: premium Work implements and stops; the Carez control room validates separately.

## Usage discipline

Before a premium run:

1. choose Astra Low/Light rather than a higher effort by default;
2. keep Fast mode off unless speed is explicitly worth additional allowance;
3. provide exact file paths and hard scope;
4. provide the approved design/architecture decision instead of asking Astra to rediscover it;
5. append the premium Work footer when using Work;
6. do not ask the premium model to “make sure everything works.”

If a lower-cost model can do the task, use it instead of Astra.
