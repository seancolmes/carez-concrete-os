# Carez Concrete OS — Documentation Control

Start here before product, architecture, implementation, QA, or AI-agent work.

## Canonical source hierarchy

1. `supabase/` schema and migrations — persisted database truth.
2. Repository source code — implemented application behavior.
3. `docs/ARCHITECTURE.md` and ADRs — approved architecture and irreversible/important decisions.
4. `docs/modules/` — approved module behavior and product contracts.
5. `docs/CURRENT_STATE.md` — current implementation status, active blocker, validation state.
6. `docs/ROADMAP.md` — prioritized modernization sequence.
7. GitHub issues / PRs — proposed and active work.
8. Browser/Vercel evidence — rendered UI acceptance evidence.
9. ChatGPT Project files — concrete, estimating, regulatory, brand, and company evidence/reference.
10. Chat conversations — exploration and brainstorming only until promoted into canonical docs.

When sources conflict, do not silently reconcile them. Prefer the higher authority and record the conflict if it affects implementation.

## Core documents

- [Architecture](ARCHITECTURE.md)
- [Current State](CURRENT_STATE.md)
- [Roadmap](ROADMAP.md)
- [Document Status Registry](DOCUMENT_STATUS.md)
- [Knowledge Source Routing](KNOWLEDGE_SOURCE_ROUTING.md)
- [ChatGPT Project Instructions](CHATGPT_PROJECT_INSTRUCTIONS.md)
- [Approval → Documentation Workflow](workflow/APPROVAL_TO_DOCUMENTATION.md)
- [Development Workflow](workflow/DEVELOPMENT_WORKFLOW.md)
- [QA and Acceptance](workflow/QA_AND_ACCEPTANCE.md)

## Module specifications

- [Takeoff](modules/takeoff.md)
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

## Supporting and legacy documents

Every retained root-level design/history document in `docs/` must have an explicit status header and registry entry in `DOCUMENT_STATUS.md`.

Supporting documents may add detail but may not silently override canonical architecture, ADRs, module specifications, or current-state records. Durable approved changes are promoted through the approval → documentation workflow rather than left only in a supporting file or chat.
