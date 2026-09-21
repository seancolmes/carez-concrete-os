# Carez Concrete OS

Private concrete-contractor operating system covering preconstruction, plans, Takeoff, estimating, proposals, projects, scheduling, field/production, pour control, procurement, finance, documents, and AI assistance.

## Start here

- `docs/README.md` — documentation map
- `docs/ARCHITECTURE.md` — stable architecture/invariants
- `docs/CURRENT_STATE.md` — current verified state
- `docs/ROADMAP.md` — sequence
- `docs/modules/` — product/module contracts
- `docs/decisions/` — durable architecture decisions
- `docs/workflow/DEVELOPMENT_WORKFLOW.md` — current cloud development/release loop
- `docs/workflow/CAREZ_TOKEN_EFFICIENCY.md` — cloud model routing / premium usage policy
- `AGENTS.md` — agent routing rules
- `CODEX.md` — canonical cloud execution contract

## Product architecture

Concrete-native modular monolith; Supabase/PostgreSQL source of truth; server-authoritative deterministic calculations; RLS/tenant isolation; immutable/versioned commercial lineage; persisted 2D Takeoff geometry as quantity authority; derived 3D verification only; desktop professional workstation and mobile field-first.

## Development architecture

Carez implementation is cloud-based:

```text
Carez control room / connected tools
→ ChatGPT Work/Codex cloud
→ GitHub staging
→ GitHub Actions
→ Vercel staging
→ browser QA
```

Supabase QA is the staging database authority. All model execution may consume credits or allowance. Luna/Terra are lower-cost routing choices, not free execution. Astra is reserved for premium high-value work.

A local Windows checkout may be used as a replaceable mirror, but online GitHub remains authoritative. There is no canonical local Codex/Ollama/OmniRoute implementation stack.

## Validation

```text
pnpm typecheck
pnpm test
pnpm build
```

Use `pnpm check` for the full validation chain. UI work additionally requires browser verification of changed rendered behavior.

## Environment

Keep secrets in hosting/connected environments. Never commit service-role keys, DB passwords, banking tokens, model-provider credentials, or production secrets.

Common variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `PLAID_CLIENT_ID`, `PLAID_SECRET`.
