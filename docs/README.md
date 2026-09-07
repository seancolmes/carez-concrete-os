# Carez Concrete OS — Documentation Control

Use the source that owns the question. Do not preload the entire documentation tree.

## Canonical source hierarchy

1. `supabase/` schema and migrations — persisted database truth.
2. Repository source code — implemented application behavior.
3. `docs/ARCHITECTURE.md` and active ADRs — approved architecture and durable decisions.
4. `docs/modules/` — approved module behavior and product contracts.
5. `docs/CURRENT_STATE.md` — concise current implementation/verification state.
6. `docs/ROADMAP.md` — prioritized modernization sequence.
7. GitHub issues / PRs — active and historical implementation evidence.
8. Browser/Vercel evidence — rendered UI acceptance evidence.
9. ChatGPT Project sources — concrete, estimating, regulatory, brand, and company reference evidence.
10. Chat conversations — exploration until promoted into canonical docs.

When sources conflict, prefer the higher authority and record the conflict if it affects implementation.

## Task-based reading map

| Task / question | Read first | Add only when needed |
| --- | --- | --- |
| Bounded coding task with approved behavior | `AGENTS.md`, target implementation/files | relevant module spec/ADR or migration only when needed |
| Current priority / what should happen next | `CURRENT_STATE.md`, then `ROADMAP.md` | active owning issue |
| Branch, QA target, production promotion | `BRANCH_AND_RELEASE_MODEL.md` | `CURRENT_STATE.md` if deployment state matters |
| Product/domain behavior | applicable `modules/*.md` | relevant active ADR(s) |
| Database/RLS/migration behavior | relevant `supabase/` migrations and server/domain code | relevant module/ADR when interpretation is required |
| UI implementation | current source plus ADR-015/ADR-016/shared component docs | module spec or focused active ADR when needed |
| Historical evidence | Git history, closed issues/PRs | only when current canonical truth is insufficient |

### Context discipline

- Read the smallest authoritative source set that answers the task.
- Do not recursively search the documentation tree when the owning file is already known.
- Do not reread unchanged documents merely to reconfirm a conclusion already established in the same task.
- Superseded working documents are not retained in the active tree after their surviving truth is absorbed into canonical owners.

See `KNOWLEDGE_SOURCE_ROUTING.md` for source-domain routing.

## Core documents

- [Architecture](ARCHITECTURE.md)
- [Current State](CURRENT_STATE.md)
- [Roadmap](ROADMAP.md)
- [Branch and Release Model](BRANCH_AND_RELEASE_MODEL.md)
- [Document Status Registry](DOCUMENT_STATUS.md)
- [Knowledge Source Routing](KNOWLEDGE_SOURCE_ROUTING.md)
- [ChatGPT Project Instructions](CHATGPT_PROJECT_INSTRUCTIONS.md)
- [Chat Workspace Map](CHAT_WORKSPACE_MAP.md)
- [Chat Starter Pack](CHAT_STARTER_PACK.md)
- [Carez Shared Component Pack](design-system/CAREZ_COMPONENT_PACK.md)
- [Approval → Documentation Workflow](workflow/APPROVAL_TO_DOCUMENTATION.md)
- [Development Workflow](workflow/DEVELOPMENT_WORKFLOW.md)
- [QA and Acceptance](workflow/QA_AND_ACCEPTANCE.md)
- [Concrete Condition + 3D Workstation Target](concrete-condition-3d-workstation-target.md)

## Implementation authority

When connected GitHub, Vercel, and Supabase tools are available, ChatGPT performs bounded repository/database/deployment work directly. Do not route routine implementation to obsolete local-agent/OpenCode workflows.

Root `AGENTS.md` contains the compact execution-critical invariants and boundaries for repository implementation.

## Global UI authority

ADR-015 is the Carez-wide dark shadcn presentation authority. ADR-016 owns the desktop shell: one compact top application menubar with anchored global category menus and module-specific contextual panes. ADR-020 owns the accepted integrated Takeoff workstation.

`docs/design-system/CAREZ_COMPONENT_PACK.md` defines the shared Carez component pack. All modules reuse/extend the same source-owned shadcn workspace instead of introducing local design systems, compatibility layers, alternate palettes, or parallel component libraries.

While Issue #44 remains open, it owns the remaining full dark shadcn conversion, legacy presentation removal, and rendered acceptance.

## Branch / user-test rule

Permanent branches are only `staging` and `main`.

Nik tests Carez only on the single stable staging QA URL defined in `BRANCH_AND_RELEASE_MODEL.md`. Do not route user acceptance through feature-branch or PR preview links.

## Module specifications

- [Takeoff](modules/takeoff.md)
- [Concrete Condition & Resource Engine](modules/assembly-resource-engine.md)
- [Estimating](modules/estimating.md)
- [CRM / Preconstruction](modules/crm-preconstruction.md)
- [Projects / Work Packages / Scheduling](modules/projects-work-packages-scheduling.md)
- [Field / Production / Pour Control](modules/field-production-pour-control.md)
- [Procurement / Finance / Changes / Billing](modules/procurement-finance.md)
- [Documents / Search / Knowledge](modules/documents-knowledge.md)
- [AI Assistance](modules/ai-assistance.md)

## Decision records

See `docs/decisions/`.

ADRs document active durable decisions. Superseded ADRs whose surviving constraints are fully represented by newer canonical owners should be removed from the active tree; Git history preserves them.

## Chat workspace governance

Use `CHAT_WORKSPACE_MAP.md` to route product/domain discussion. Approved product truth must be promoted into canonical GitHub documentation.

Historical implementation evidence belongs in Git history, closed issues/PRs, tags/releases, or source migrations—not in the hot documentation path.
