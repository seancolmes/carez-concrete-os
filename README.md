# Carez Concrete OS

Carez Concrete OS is a concrete-native operating platform that connects preconstruction, Takeoff, estimating, proposals, project execution, field production, procurement, finance, billing, retainage, and production learning without breaking source lineage.

## Product thread

```text
Job Spine
-> Opportunity / ITB
-> Plans
-> Takeoff / Concrete Conditions
-> Estimate Revision
-> Proposal Revision
-> Award Decision / Customer Acceptance
-> Accepted Scope Snapshot
-> Frozen Commercial Baseline / Budget
-> Project
-> Work Packages / Operations / Production Work Units
-> Readiness / Schedule / Assignments
-> Field and Production Evidence
-> Actual Cost / Forecast / Variance
-> Changes / Billing / Retainage
-> Future estimating intelligence
```

Carez preserves the relationship between physical scope, commercial decisions, and field execution instead of re-entering the same quantity or scope in disconnected modules.

## Current product architecture

- **Concrete-native modular monolith** built with Next.js 15, React 19, TypeScript, Tailwind CSS, and Supabase/PostgreSQL.
- **Server-authoritative deterministic calculations** for quantity, cost, pricing, and financial logic.
- **Tenant isolation and RLS** rooted in `company_id`.
- **Persistent Job Spine** linking Opportunity, Estimate, Proposal, Award, Project, production, changes, billing, and closeout history without mutating one lifecycle entity into another.
- **Condition-first Takeoff** with named Concrete Conditions and versioned archetype/template/project lineage.
- **Persisted 2D/vector plan geometry is quantity authority**; synchronized 3D is derived verification/visualization only.
- **Production Quantity, Direct Cost, and Sell remain separate concepts.**
- **Accepted commercial history is immutable/versioned** through Accepted Scope Snapshot and Frozen Commercial Baseline/Budget contracts.
- **Humans remain final authority** for scope, means/methods, production assumptions, pricing, margin, budgets, approvals, billing, and retainage.

## Seven operating surfaces

ADR-026 organizes Carez around seven primary workspaces rather than exposing every implementation route as a peer destination:

1. **Today** - daily operating command center
2. **Preconstruction** - opportunities, plans, Takeoff, estimating, and proposals
3. **Projects** - active-job and project control
4. **Field** - schedule, readiness, crews, and field control
5. **Production** - work packages, concrete placement, scope/production evidence, and forecast
6. **Finance** - cashflow, billing, payables, procurement, banking, payroll, and job cost
7. **System** - company and platform administration

Internal views, contextual tools, record-detail routes, and compatibility entries remain deep-linkable where supported.

## Experience system

ADR-025 is the active presentation authority.

- **Indigo Harbor** semantic theme
- Command Deck / Spatial Blueprint composition appropriate to each surface
- Inter-led operational typography with IBM Plex Mono reserved for technical alignment
- open, line-driven workstation layouts rather than generic SaaS card walls
- shared Carez-owned shadcn-compatible primitives
- first-class light, dark, and system appearance
- purposeful motion only when it communicates state, continuity, focus, or activity

The application-wide ADR-025 rollout is still an active program; the accepted visual system must not be mistaken for a completed rewrite of every route.

## Takeoff and estimating

The accepted estimator workflow is:

```text
Concrete Conditions
-> Takeoff
-> Pricing
-> Labor
-> Review / Recap
-> Proposal Revision
```

Shared `staging` includes the Condition-first Takeoff foundation plus P1 estimating foundations for structured pricing provenance, Estimate-scoped supplier quote sets/pricing coverage, and labor production-rate/job-override behavior.

The next/current P1 checkpoint is the server-authoritative **Estimate Review / Recap** contract. Do not treat Review readiness as a client-side checklist or fabricate zero values for missing price/labor/input state. See the owning P1.4 spec/plan and `docs/modules/estimating.md` for current implementation authority.

## Engineering workflow

Carez development is local-authority-first:

```text
ChatGPT control room
-> local Codex
-> local validation
-> local browser/runtime QA when required
-> Nik acceptance
-> GitHub Desktop local commit
-> release gate
-> human-authorized staging publication
-> GitHub Actions
-> existing Vercel staging integration
```

### Branches

- `staging` - shared development / integration / QA / UAT baseline
- `main` - production only

Intentional local working-tree changes and local commits are authoritative for in-progress work. `origin/staging` is the shared integration baseline; agents must not auto-reset, rebase, stash, discard, or overwrite local work merely to match it.

Normal local Codex execution is:

```text
IMPLEMENT -> VALIDATE -> REVIEW -> STOP
```

Publication is human-controlled. A passing release gate means ready to publish, not authorized to publish.

## Carez Command Center

The local Command Center accelerates engineering without replacing repository or human authority.

- **codebase-memory-mcp** - derived structural discovery/impact analysis; current source wins conflicts
- **ai-memory** - bounded derived session/handoff history; current source wins freshness conflicts
- **BrowserSkill** - observational runtime evidence through the dedicated `Carez QA` browser profile
- **project-scoped Carez skills** - bounded workflows for UI implementation, Takeoff changes, DB migrations, browser debugging, and release gating
- **policy/eval suites** - routing, outcome, execution, external-state, knowledge/observation, orchestration, and mutation-gate behavior

Command Center Phase 8-10 architecture is accepted on `staging`. Provider-write capability remains disabled by default. GitHub, Supabase, and Vercel writes require explicit provider/environment/action/target authorization; normal staging publication remains GitHub Desktop + existing Git integration.

## Source authority

Use the source that owns the question.

```text
current explicit task
-> current local implementation evidence when in scope
-> shared staging source + source-controlled migrations
-> Architecture / accepted ADRs
-> owning module contract
-> Current State
-> Roadmap
-> workflow contracts
-> issues / PRs / history when needed
-> runtime/provider observations when intentionally queried
```

Derived memory, browser observations, old Project files, and historical PR text do not override current owning source.

## Start here

- [`AGENTS.md`](AGENTS.md) - repository agent routing and authority
- [`CODEX.md`](CODEX.md) - local Codex execution contract
- [`docs/README.md`](docs/README.md) - documentation map
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) - canonical architecture and invariants
- [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md) - verified implementation state and blockers
- [`docs/ROADMAP.md`](docs/ROADMAP.md) - product modernization sequence
- [`docs/decisions/ADR-025-carez-operations-workspace.md`](docs/decisions/ADR-025-carez-operations-workspace.md) - active presentation authority
- [`docs/decisions/ADR-026-seven-surface-workspace-architecture.md`](docs/decisions/ADR-026-seven-surface-workspace-architecture.md) - seven-surface information architecture
- [`docs/modules/`](docs/modules/) - module/product contracts
- [`docs/workflow/DEVELOPMENT_WORKFLOW.md`](docs/workflow/DEVELOPMENT_WORKFLOW.md) - local-authority development/release loop
- [`docs/workflow/COMMAND_CENTER_RUNTIME.md`](docs/workflow/COMMAND_CENTER_RUNTIME.md) - local Command Center runtime
- [`docs/workflow/EXTERNAL_STATE_BOUNDARY.md`](docs/workflow/EXTERNAL_STATE_BOUNDARY.md) - provider read/write boundary
- [`docs/workflow/COMMAND_CENTER_ORCHESTRATION.md`](docs/workflow/COMMAND_CENTER_ORCHESTRATION.md) - mixed-evidence routing
- [`docs/workflow/COMMAND_CENTER_MUTATION_GATE.md`](docs/workflow/COMMAND_CENTER_MUTATION_GATE.md) - explicit remote mutation authorization
- [`docs/workflow/CAREZ_TOKEN_EFFICIENCY.md`](docs/workflow/CAREZ_TOKEN_EFFICIENCY.md) - model/context efficiency policy

## Local development

Requirements:

- Node.js `>=22 <25`
- pnpm `11.19.0`

```bash
pnpm install
pnpm dev
```

### Validation

Use proportional validation during implementation:

```bash
pnpm typecheck
pnpm test
```

Full repository validation:

```bash
pnpm check
```

`pnpm check` runs typecheck, domain tests, and the production build.

## Environment and secrets

Keep credentials in approved local/hosting environments. Never commit service-role keys, database passwords, banking tokens, model-provider credentials, or production secrets.

Common application variables include:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `PLAID_CLIENT_ID`
- `PLAID_SECRET`

Source-controlled migrations remain the only Carez schema-change authority. Remote database mutation requires explicit target/action authorization and must not bypass the repository migration history.

## Current state

This README is an orientation page, not the fast-changing implementation ledger. Use [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md) for the latest verified status, open blockers, acceptance evidence, and active workstreams. Production promotion remains explicit and must respect the current production migration blockers documented there.
