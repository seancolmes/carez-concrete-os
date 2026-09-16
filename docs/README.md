# Carez documentation

Use the source that owns the question. Do not preload the repository.

## Authority

1. `supabase/` migrations/schema and repository source — implemented truth.
2. `docs/ARCHITECTURE.md` + active ADRs — architecture and durable decisions.
3. `docs/modules/` — module/product contracts.
4. `docs/CURRENT_STATE.md` — current verified implementation/blockers.
5. `docs/ROADMAP.md` — sequence.
6. GitHub issues/PRs/history — active and historical implementation evidence.
7. Vercel/browser evidence — deployment/rendered acceptance.

## Read map

| Need | Start with |
| --- | --- |
| Bounded code task | `AGENTS.md` or `CODEX.md`, target files |
| Current priority | `CURRENT_STATE.md`, then `ROADMAP.md` |
| Branch/release | `BRANCH_AND_RELEASE_MODEL.md` |
| Module behavior | owning `modules/*.md` |
| Architecture/invariant | `ARCHITECTURE.md`, relevant ADR |
| UI | current source, ADR-015/016/020, `design-system/CAREZ_COMPONENT_PACK.md` |
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
- root `AGENTS.md` — connected-agent implementation rules
- root `CODEX.md` — Codex Cloud low-token implementation rules

## Documentation discipline

Keep active documentation small. Remove superseded designs, finished checklists, duplicate workflow files, chat handoffs, and implementation checkpoints after their surviving truth is absorbed into canonical owners. Git history preserves the evidence.

Supporting detailed designs may remain only while they still own unresolved implementation behavior. They cannot override Architecture, active ADRs, module contracts, Current State, or the branch/release model.

## UI authority

ADR-024 owns the Precision Grid visual/theme/token/density architecture and approved end-state Carez OS interaction direction. ADR-016 remains the current implemented desktop-shell contract until the dedicated shell/navigation subproject replaces it. ADR-020 plus the active Takeoff module spec remain authoritative for Takeoff/workstation/domain invariants. Shared UI belongs in `design-system/CAREZ_COMPONENT_PACK.md`; modules must not create competing design systems or revive legacy presentation layers.
