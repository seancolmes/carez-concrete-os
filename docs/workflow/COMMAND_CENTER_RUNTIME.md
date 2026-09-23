# Carez Command Center runtime

This document records the local Command Center runtime that supports Carez development. It does not redefine product architecture, repository authority, release authorization, or provider mutation boundaries.

## Authority

The runtime is an accelerator around the authoritative Carez sources.

- Current repository source, accepted ADRs/specifications, and source-controlled migrations remain authoritative.
- codebase-memory and ai-memory are derived.
- BrowserSkill evidence is observational.
- GitHub, Supabase, and Vercel state is current external state only when explicitly queried under `EXTERNAL_STATE_BOUNDARY.md`.
- Tool installation, authentication, or availability never grants mutation authority.

The owning policy is `KNOWLEDGE_AND_OBSERVATION_BOUNDARY.md`.

## Local runtime layout

The current Windows runtime uses user-local paths rather than repository binaries:

```text
%LOCALAPPDATA%\Carez\CommandCenter\
├─ codebase-memory-mcp\
├─ ai-memory\
├─ ai-memory-data\
├─ bsk\
└─ bsk-home\
```

Codex integration lives in the user's normal Codex configuration/skill locations. These global integration files are runtime configuration, not Carez repository authority.

## codebase-memory-mcp

Verified Phase 8 runtime:

- native Windows binary installed under `%LOCALAPPDATA%\Carez\CommandCenter\codebase-memory-mcp`;
- Carez repository indexed explicitly as `carez-concrete-os`;
- automatic indexing disabled;
- automatic watching disabled;
- watcher daemon disabled;
- graph UI disabled;
- Codex MCP uses `--tool-profile=analysis`, exposing an inspection-oriented positive allowlist rather than the full mutation-capable surface;
- installed Codex skill plus Scout/Verify/Auditor graph profiles may narrow structural exploration.

Graph results are derived. Verify current Carez source before implementation, root-cause, security, quantity, financial, or architecture conclusions.
## ai-memory

Verified Phase 8 runtime:

- native Windows binary installed under `%LOCALAPPDATA%\Carez\CommandCenter\ai-memory`;
- private data lives under `%LOCALAPPDATA%\Carez\CommandCenter\ai-memory-data`;
- HTTP/MCP server binds only to `127.0.0.1:49374`;
- server is started by the user-level scheduled task `Carez Command Center - AI Memory`;
- LLM consolidation and embeddings are disabled;
- automatic improvement scheduling is disabled and manual proposals require approval;
- capture mode is `allowlist`;
- Codex MCP and bounded lifecycle hooks are installed; the prompt-capture hook is intentionally absent;
- `.ai-memory.toml` opts this repository in and excludes secrets, transient output, and authoritative Carez policy/ADR/workflow records from capture;
- session-start briefing is disabled so durable memory is retrieved deliberately rather than injected every turn;
- mid-session routing is sticky to the Carez project so one session cannot silently drift into another project scope.

The ai-memory SQLite schema and migrations exist only in its private local tool data directory. They are not Carez PostgreSQL/Supabase migrations and must never be treated as product database state.

Memory may recover handoffs, investigations, failed approaches, and prior context. Current source and current explicit instructions always win.

### Codex hook trust

ai-memory lifecycle hooks require Codex hook trust. Review the installed hooks in an interactive Codex session and trust only the expected local `ai-memory.exe hook` commands. Do not use trust bypass as the normal interactive workflow.

The Phase 8 eval runner uses an isolated temporary working directory plus an isolated temporary `CODEX_HOME` containing only the operator's authentication token. It does not load the operator's normal MCP or hook configuration, and canonical acceptance verified **0 captured eval sessions / 0 observations** in ai-memory.

## BrowserSkill

Verified local runtime:

- Windows CLI/daemon installed under `%LOCALAPPDATA%\Carez\CommandCenter\bsk`;
- runtime state isolated under `%LOCALAPPDATA%\Carez\CommandCenter\bsk-home`;
- Codex `browser-skill` installed;
- daemon/protocol checks pass.

Current browser state: one compatible Chrome extension is connected under the explicit BrowserSkill label **`Carez QA`**. A bounded local Carez Agent Window navigated to `http://127.0.0.1:3000`, followed the application redirect to `/login`, captured DOM/console/network evidence, performed no business mutation, and shut down cleanly.

Use BrowserSkill only for the bounded browser/runtime work described in `KNOWLEDGE_AND_OBSERVATION_BOUNDARY.md` and `.agents/skills/carez-browser-debug/SKILL.md`.
## Phase 8 ledger

### Phase 8A — Knowledge + observation authority

**State: accepted locally.**

Delivered:

- knowledge/observation boundary;
- 18-case golden safety suite;
- 6-case smoke suite;
- structured response schema and local runner;
- isolated eval execution that does not capture itself into ai-memory.

Acceptance evidence: canonical full live suite **18/18 PASS**, repository unchanged.

### Phase 8B — Structural code intelligence

**State: accepted locally.**

Delivered:

- codebase-memory installed;
- Carez repository explicitly indexed;
- read-oriented Codex integration;
- background indexing/watching/UI disabled by default;
- structural architecture query verified.

### Phase 8C — Durable work memory

**State: accepted locally.**

Delivered and verified:

- ai-memory installed and initialized;
- loopback MCP server;
- scheduled user-level server startup;
- allowlist capture;
- Carez scope/exclusion marker;
- Codex MCP/hooks installed with prompt capture intentionally omitted;
- autonomous improvement and embedding behavior disabled;
- Phase 8 eval isolation verified with zero captured eval sessions/observations;
- a real Carez read-only Codex session produced a bounded session page;
- a later Codex session used the ai-memory MCP to recall that session, then read current `package.json` directly and correctly treated current source as authoritative.

Normal interactive Codex still requires its one-time hook trust review. Automation-only validation may use the explicit hook-trust bypass only after the installed local hook commands have been reviewed.

### Phase 8D — Browser observation

**State: accepted locally.**

Delivered and verified:

- BrowserSkill CLI/daemon installed;
- Codex skill installed;
- daemon/protocol/extension checks pass;
- the dedicated browser is labeled exactly **`Carez QA`**;
- one bounded local Carez `/login` observation captured DOM/console/network evidence without business mutation;
- the BrowserSkill session stopped cleanly after the observation.

### Phase 8E — Workflow reconciliation

**State: implemented locally in this batch.**

The development workflow and token-efficiency policy now use the same local-authority model as `AGENTS.md`, `CODEX.md`, and `CURRENT_STATE.md`. Old cloud-first/local-mirror language is retired.

## Phase 9 — Bounded execution orchestration

**State: accepted locally.**

`COMMAND_CENTER_ORCHESTRATION.md` now owns the mixed-evidence execution path across authoritative source, codebase-memory, ai-memory, BrowserSkill, and current provider READ state. The canonical Phase 9 suite passes **12/12** with the repository unchanged.

Phase 9 keeps source authority, derived knowledge, browser observation, and provider state distinct; uses the narrowest useful evidence route; preserves source-controlled migration authority; keeps the normal Vercel staging path Git-driven; and stops at any ungranted provider-write boundary.

## Phase 10 — Explicit mutation gate

**State: architecture accepted locally; provider-write capability disabled.**

`COMMAND_CENTER_MUTATION_GATE.md` defines the authorization envelope for future GitHub, Supabase, and Vercel writes: provider, environment, operation, target, preflight/preview, unknown-effect handling, recovery plan, least privilege, and audit evidence.

The canonical Phase 10 suite passes **14/14** with the repository unchanged. The local health check confirms no raw GitHub/Supabase/Vercel MCP is enabled. No provider write was performed to accept this architecture.

A future provider mutation becomes active only through a separate explicitly authorized capability-enablement task. Phase 10 architecture is not standing authorization.

## Local health check

Use `scripts/carez-command-center-health.ps1` for a read-only local runtime check. It must not query or mutate GitHub, Supabase, or Vercel.

Expected healthy steady state:

- Carez repository available;
- codebase-memory installed with background automation disabled;
- ai-memory loopback server answering with allowlist capture;
- bounded Codex knowledge MCPs/hooks intact;
- ai-memory autonomous embedding/auto-improve behavior disabled;
- BrowserSkill daemon healthy with the dedicated `Carez QA` profile connected when browser work is required;
- no raw GitHub/Supabase/Vercel MCP enabled while Phase 10 provider-write capability is disabled;
- no hidden remote side effects.
