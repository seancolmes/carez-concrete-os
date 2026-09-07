# Carez Concrete OS

Private concrete-contractor operating system covering preconstruction, plans, Takeoff, estimating, proposals, projects, scheduling, field/production, pour control, procurement, finance, documents, and AI assistance.

## Start here

- `docs/README.md` — documentation map
- `docs/ARCHITECTURE.md` — stable architecture/invariants
- `docs/CURRENT_STATE.md` — current verified state
- `docs/ROADMAP.md` — sequence
- `docs/modules/` — product/module contracts
- `docs/decisions/` — durable architecture decisions
- `AGENTS.md` — connected-agent implementation rules
- `CODEX.md` — low-token Codex Cloud implementation contract

## Architecture

Concrete-native modular monolith; Supabase/PostgreSQL source of truth; server-authoritative deterministic calculations; RLS/tenant isolation; immutable/versioned commercial lineage; desktop professional workstation and mobile field-first.

## Validation

```text
pnpm typecheck
pnpm test
pnpm build
```

Use `pnpm check` for the full local validation chain. UI work additionally requires browser verification of the changed rendered behavior.

## Environment

Keep secrets in the hosting/development environment. Never commit service-role keys, DB passwords, banking tokens, or production secrets.

Common variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `PLAID_CLIENT_ID`, `PLAID_SECRET`.
