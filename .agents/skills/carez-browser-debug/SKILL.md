---
name: carez-browser-debug
description: Diagnose Carez browser/runtime failures from evidence before editing application code. Use for UI behavior that is broken, inconsistent, intermittent, console-erroring, network-failing, hydration-related, or difficult to reproduce. Reproduce the failure, capture the smallest useful browser evidence, trace only the owning code path, then implement a fix only when requested and the failure mode is supported by evidence. Avoid broad repo scans, speculative rewrites, and repeated browser passes.
---

# Carez Browser Debug

Turn a browser symptom into a bounded, evidence-backed diagnosis.

## Workflow

1. Read `AGENTS.md` and `CODEX.md`.
2. Record the route, exact interaction, expected result, and observed failure.
3. Reproduce once. Capture only relevant console, network, DOM/state, and screenshot evidence.
4. Trace from the failing interaction to the smallest owning route/component/action/server boundary. Read direct dependencies only.
5. Separate observed evidence from hypotheses.
6. If root cause is still ambiguous, stop with the smallest next diagnostic step; do not compensate with a broad scan.
7. If a fix is requested and the root cause is supported, make the smallest coherent patch.
8. Re-run the exact reproduction once, then run the smallest relevant code validation from `CODEX.md`.

## Tool discipline

- Prefer browser/DevTools evidence for browser claims.
- Do not use external plugins or production services unless the failure depends on remote truth.
- Do not edit code during the evidence-gathering phase unless the user explicitly asks for an exploratory instrumentation change.
- Stop after one confirmatory browser pass unless new evidence contradicts the diagnosis.

## Progressive detail

Read `references/evidence-template.md` only when reporting a diagnosis or handing the task to an implementation agent.
