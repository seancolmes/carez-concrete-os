# Carez Concrete OS

Private concrete-contractor operating system covering preconstruction, plans, Takeoff, estimating, proposals, projects, work packages, scheduling, field/production, pour control, procurement, operational finance, documents, and AI assistance.

## Start here

The repository documentation is the canonical product/architecture source of truth:

- [`docs/README.md`](docs/README.md) — documentation control/index
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — stable architecture and product invariants
- [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md) — current implementation/blocker/validation state
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — modernization sequence
- [`AGENTS.md`](AGENTS.md) — implementation/AI-agent rules
- [`docs/modules/`](docs/modules/) — module specifications
- [`docs/decisions/`](docs/decisions/) — architectural decision records

Do not use the legacy v0.x sequence as the active roadmap. The canonical sequence is maintained in `docs/ROADMAP.md`.

## Architecture stance

- Concrete-native product and workflows.
- Modular monolith.
- PostgreSQL/Supabase source of truth.
- Server-authoritative deterministic calculations.
- RLS, tenant isolation, auditability, and safe migrations.
- Immutable/versioned commercial lineage.
- Desktop professional workstation; mobile field-first.

## Development validation

Branch CI runs:

```text
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
```

UI work additionally requires browser verification of the exact rendered behavior being changed.

## Required environment variables

Configure secrets through the hosting/development environment. Never commit service-role keys, database passwords, bank tokens, or production secrets.

Common application variables include:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `PLAID_CLIENT_ID`
- `PLAID_SECRET`
