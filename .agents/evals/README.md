# Carez Command Center routing evals

This folder evaluates the routing policy for the five project-scoped Carez skills and five task-scoped specialist agents. It does not change skill or agent definitions.

## Files

- `command-center-routing.jsonl` — 45 golden routing cases.
- `smoke-cases.jsonl` — 10 case IDs for the low-usage smoke subset.
- `schemas/routing-result.schema.json` — structured result schema consumed by `codex exec --output-schema`.
- `../../scripts/codex-eval-routing.ps1` — safe-by-default local runner.

## What is graded

Each case grades routing invariants:

- required skills plus optional allowed/forbidden alternatives
- required specialist agents plus optional allowed/forbidden alternatives
- routing decision
- required/allowed/forbidden initial progressive-disclosure references
- whether a remote action is required

Strict equality remains the default. A case opts into an allowed set only when more than one route is genuinely safe and architecturally valid. The runner records allowed extras as telemetry rather than hiding them. The free-form `reason` is recorded but not graded.

Unnecessary specialist use remains a failure unless the golden case explicitly permits it; single-agent execution is the default.

## Suites

- **Smoke (10)** — run after changes to AGENTS.md, CODEX.md, skill descriptions, agent descriptions, agent model routing, or subagent policy.
- **All (45)** — 25 skill cases, 15 specialist-agent cases, and 5 composition/escalation cases.

Do not run the full suite after routine application edits.

## Safe usage

The runner is dry-run by default. This validates the dataset and prints selected cases without a model call:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/codex-eval-routing.ps1 -Suite Smoke
```

Run one live case:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/codex-eval-routing.ps1 -CaseId skill.ui.direct.01 -Run
```

Run the 10-case smoke suite:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/codex-eval-routing.ps1 -Suite Smoke -Run
```

Rescore a saved live result without another model call:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/codex-eval-routing.ps1 -CaseId skill.ui.direct.01 -ReplayDir "<saved-run-directory>"
```

Replay is fingerprint-safe: every new live case records the prompt hash and the effective Carez routing-config hash (AGENTS/CODEX, project skill tree, project agent configs). Replay is refused when either fingerprint changed, so old model output cannot be presented as evidence for a newer routing configuration.

Run the full 45-case suite only when routing policy itself changed:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/codex-eval-routing.ps1 -Suite All -Run
```

Defaults:

- model: `gpt-6-luna`
- reasoning: `medium`
- Codex session: `--ephemeral`
- sandbox: `read-only`
- approval policy: `never`
- web search: disabled
- result output: `%TEMP%\carez-codex-evals\<timestamp>\`

The live evaluator tells Codex not to execute the simulated task, edit files, run tools, spawn agents, or use remote services. It asks only for the routing decision a real task should use.

The runner refuses live evaluation on a dirty working tree unless `-AllowDirty` is explicitly supplied. It also compares Git status before and after a live suite and fails if the repository changes.

## Result artifacts

Each live run stores outside the repository:

- `<case>.result.json` — structured final routing decision
- `<case>.events.jsonl` — raw Codex JSONL event stream for later usage/latency inspection
- `<case>.meta.json` — prompt/routing-config fingerprints plus model settings for safe replay
- `results.jsonl` — scored case results
- `summary.json` — suite totals and metadata

Token/usage events are retained and the runner totals input, cached-input, output, and reasoning-output tokens. No hard budget is enforced; establish thresholds only after representative baseline runs.
