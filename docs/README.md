# Carez documentation

Use the source that owns the question. Do not preload the repository.

## Authority

1. Repository source + Supabase schema/migrations — implemented truth.
2. `docs/ARCHITECTURE.md` + active ADRs — architecture and durable decisions.
3. `docs/modules/` — module/product contracts.
4. `docs/CURRENT_STATE.md` — current verified implementation, open work, blockers.
5. `docs/ROADMAP.md` — sequence.
6. `AGENTS.md` + `CODEX.md` + `docs/workflow/` — local-authority development and runtime workflow.
7. GitHub issues/PRs/history — active and historical implementation evidence.
8. Vercel/browser evidence — deployment/rendered acceptance.

## Read map

| Need | Start with |
| --- | --- |
| Bounded implementation task | `AGENTS.md`, `CODEX.md`, target files |
| Development/release workflow | `workflow/DEVELOPMENT_WORKFLOW.md` |
| Model/token efficiency | `workflow/CAREZ_TOKEN_EFFICIENCY.md` |
| Current priority | `CURRENT_STATE.md`, then `ROADMAP.md` |
| Branch/release | `BRANCH_AND_RELEASE_MODEL.md` |
| Module behavior | owning `modules/*.md` |
| Architecture/invariant | `ARCHITECTURE.md`, relevant ADR |
| UI | ADR-025, ADR-020 for Takeoff invariants, `design-system/CAREZ_COMPONENT_PACK.md` |
| DB/RLS | relevant migration + server/domain code |
| Historical evidence | Git history/issues/PRs only when current sources are insufficient |

## Core

- `ARCHITECTURE.md`
- `CURRENT_STATE.md`
- `ROADMAP.md`
- `BRANCH_AND_RELEASE_MODEL.md`
- `modules/`
- `decisions/`
- `design-system/CAREZ_COMPONENT_PACK.md`
- `workflow/DEVELOPMENT_WORKFLOW.md`
- `workflow/CAREZ_TOKEN_EFFICIENCY.md`
- root `AGENTS.md`
- root `CODEX.md`

## Documentation discipline

Keep active documentation small.

Delete superseded designs, finished implementation plans, duplicate workflow files, chat handoffs, and checkpoint documents after their surviving truth is absorbed into canonical owners. Git history/issues preserve evidence.

Supporting `docs/superpowers/` files may remain only while they own unresolved implementation behavior. They never override Architecture, active ADRs, module contracts, Current State, Roadmap, or repository execution contracts.

P0.5 / P0.5E Condition-first foundation is complete and accepted on `staging`; Issue #39 is closed. P1 Estimating is the active domain phase, and P1.4 Review / Recap remains implementation work. Completed/superseded planning artifacts are historical evidence unless they still own unresolved behavior.

## UI authority

ADR-025 — Carez Operations Workspace / Experience System is the active presentation authority, including the accepted Indigo Harbor theme. ADR-026 owns the seven-surface workspace model.

The approved direction is approximately 80% Command Deck / 20% Spatial Blueprint with purposeful motion and selective spatial/3D treatment where useful. The accepted reference implementation covers shared experience primitives plus Today, Projects, and Documents. Issue #76 remains open because application-wide propagation is incomplete.

ADR-020 plus the active Takeoff module spec remain authoritative for Takeoff quantity/domain invariants. Persisted 2D geometry remains quantity authority; 3D remains derived verification.
