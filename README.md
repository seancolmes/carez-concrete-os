# Carez Concrete OS

Private concrete-contractor operating system covering preconstruction, plans, Takeoff, estimating, proposals, projects, scheduling, field/production, pour control, procurement, finance, documents, and AI assistance.

## Start here

- `docs/README.md` — documentation map
- `docs/ARCHITECTURE.md` — stable architecture/invariants
- `docs/CURRENT_STATE.md` — current verified state
- `docs/ROADMAP.md` — sequence
- `docs/modules/` — product/module contracts
- `docs/decisions/` — durable architecture decisions
- `docs/workflow/DEVELOPMENT_WORKFLOW.md` — development/release loop
- `docs/workflow/LOCAL_CODEX_WORKSTATION.md` — current local Codex implementation architecture
- `AGENTS.md` — connected-agent rules
- `CODEX.md` — canonical Codex execution contract

## Product architecture

Concrete-native modular monolith; Supabase/PostgreSQL source of truth; server-authoritative deterministic calculations; RLS/tenant isolation; immutable/versioned commercial lineage; desktop professional workstation and mobile field-first.

## Development architecture

The primary interactive implementation path is local-first:

```text
Carez control chat / connected tools
→ Codex Web UI
→ Codex app-server
→ isolated CODEX_HOME
→ OmniRoute
→ local Ollama inference
→ staging
→ GitHub Actions
→ Vercel staging
→ browser QA
```

The Codex/Ollama workstation is development tooling, not a Carez runtime dependency. Secrets and provider configuration stay outside the repository. OpenCode and hosted Codex Cloud are not required by the canonical workflow.


## Validation

```text
pnpm typecheck
pnpm test
pnpm build
```

Use `pnpm check` for the full local validation chain. UI work additionally requires browser verification of the changed rendered behavior.

## Environment

Keep secrets in the hosting/development environment. Never commit service-role keys, DB passwords, banking tokens, model-provider keys, local Codex auth, or production secrets.

Common variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `PLAID_CLIENT_ID`, `PLAID_SECRET`.
