# Carez local Codex workstation

This document owns the current **development-agent runtime architecture**. It does not change Carez product/runtime architecture in `docs/ARCHITECTURE.md`.

## Canonical implementation path

```text
Browser
→ Codex Web UI (loopback :3001)
→ real OpenAI Codex app-server
→ isolated CODEX_HOME
→ OmniRoute (loopback :20128)
→ Ollama (loopback :11434)
→ local gpt-oss:20b inference
→ Carez staging checkout
```

The current Carez workstation uses:

- Codex Web UI as the full-screen browser interface;
- the real Codex `app-server` as the coding agent/runtime;
- an isolated Codex home (convention: `%USERPROFILE%\.codex-omniroute`);
- OmniRoute as the OpenAI-compatible local gateway;
- Ollama as the local inference server;
- `gpt-oss:20b` as the current default local coding model.

OpenCode is not part of the canonical Carez workflow.

## Repository boundary

None of the workstation components above are Carez application dependencies.

Do not commit:

- OmniRoute API keys or provider credentials;
- Codex `auth.json`, sessions, model cache, or isolated `CODEX_HOME`;
- Ollama model files/state;
- Codex Web UI installation/build output;
- user-specific absolute paths;
- OpenCode configuration.

The repository owns `AGENTS.md`, `CODEX.md`, source, tests, migrations, and workflow documentation. The workstation owns how Codex reaches an inference backend.

## Why the boundary exists

The coding model/provider can be replaced without changing Carez source. Carez behavior must be deterministic from repository code, Supabase state, and explicit human decisions—not from a particular AI vendor, plan, or model.

The isolated Codex home also prevents the Carez workstation from depending on normal ChatGPT/Codex hosted authentication.

## Usage verification

When routing assurance is needed, OmniRoute usage logs are the evidence source. A successful local request should identify:

```text
provider: ollama-local
model: gpt-oss:20b
status: 200
```

Token accounting may be unavailable for streamed local Ollama requests; routing identity is established by provider/model/status.

Do not require this verification before every coding task. Re-check after runtime/provider configuration changes or when usage routing is in doubt.

## Start

The version-controlled launcher is:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-local-codex.ps1
```

It starts missing local services, launches Codex Web UI with the isolated Carez Codex home, and opens `http://127.0.0.1:3001`.

The launcher expects the workstation prerequisites to already be installed/configured. By default it expects Codex Web UI at:

```text
%USERPROFILE%\Documents\Development\codex-webui
```

Override that location with `CAREZ_CODEX_WEBUI_DIR`.

## Carez execution loop

Once the UI is open:

1. Select the Carez repository working directory.
2. Confirm the session model remains the intended local model after intentional runtime changes.
3. Follow root `CODEX.md`.
4. Work from current `staging`.
5. Run targeted validation.
6. Commit/push the bounded change.
7. Use GitHub Actions, Vercel staging, Supabase QA, and browser QA as the acceptance chain.

## Hosted services

ChatGPT with connected GitHub/Vercel/Supabase tools remains useful as the Carez control room for planning, inspection, research, review, and bounded direct maintenance.

Hosted Codex Cloud is not the canonical implementation runtime. It may be used intentionally as a fallback, but local workstation operation must not silently depend on it.
