# Carez Concrete OS — Documentation Control

Start here before product, architecture, implementation, QA, or AI-agent work.

## Canonical source hierarchy

1. `supabase/` schema and migrations — persisted database truth.
2. Repository source code — implemented application behavior.
3. `docs/ARCHITECTURE.md` and ADRs — approved architecture and important decisions.
4. `docs/modules/` — approved module behavior and product contracts.
5. `docs/CURRENT_STATE.md` — current implementation and verification state.
6. `docs/ROADMAP.md` — prioritized modernization sequence.
7. GitHub issues / PRs — proposed and active work.
8. Browser/Vercel evidence — rendered UI acceptance evidence.
9. ChatGPT Project files — concrete, estimating, regulatory, brand, and company reference evidence.
10. Chat conversations — exploration until promoted into canonical docs.

When sources conflict, prefer the higher authority and record the conflict if it affects implementation.

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
- [Approval → Documentation Workflow](workflow/APPROVAL_TO_DOCUMENTATION.md)
- [Development Workflow](workflow/DEVELOPMENT_WORKFLOW.md)
- [QA and Acceptance](workflow/QA_AND_ACCEPTANCE.md)
- [Concrete Condition + 3D Workstation Target](concrete-condition-3d-workstation-target.md)

## Global UI authority

`docs/decisions/ADR-015-dark-minimal-shadcn-application-system.md` is the Carez-wide presentation authority. It applies to UI work performed from every module chat, not only `95 — UX & Design System`. While Issue #44 remains open, it is the implementation/completion owner for the full dark shadcn migration. No module may introduce or revive a competing light/B2/legacy visual system, compatibility layer, route-specific design framework, or parallel component library.

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

ADRs document why high-impact decisions exist. Module specs document how the product behaves. `CURRENT_STATE.md` documents what is actually implemented now.

## Chat workspace governance

Use `CHAT_WORKSPACE_MAP.md` to route work into permanent domain chats and temporary execution threads when needed. Chats remain working rooms; approved product truth must be promoted into canonical GitHub documentation.

## Supporting / historical documents

Supporting documents may add detail but may not override canonical architecture, ADRs, module specifications, Current State, or the branch/release model.

Historical implementation evidence belongs in Git history, closed PRs/issues, archived snapshots, tags/releases, or explicitly historical documents — not in a forest of permanent branches.
