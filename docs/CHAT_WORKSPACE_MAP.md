# Carez Concrete OS — Chat Workspace Map

Status: Canonical workflow document

## Purpose

ChatGPT chats are working rooms, not permanent product memory. Approved Carez truth belongs in canonical GitHub documentation.

Use a small set of permanent domain chats. Perform implementation directly in the owning chat when connected GitHub, Vercel, and Supabase tools can safely do the work.

## Permanent chats

| Chat | Owns | Primary canonical docs |
|---|---|---|
| `00 — Carez Control Room` | current priority, roadmap, cross-module decisions, release coordination, repository cleanup | `docs/CURRENT_STATE.md`, `docs/ROADMAP.md`, `docs/ARCHITECTURE.md` |
| `10 — Takeoff Workstation` | plans, calibration, geometry, measurement tools, worksheet, Takeoff lineage | `docs/modules/takeoff.md`, Takeoff ADRs/designs |
| `20 — Concrete Condition & Resource Engine` | archetypes, templates, project Conditions, modules, roles, resources, production/resource logic | `docs/modules/assembly-resource-engine.md`, Condition/3D target, ADR-012/013/021-023 |
| `30 — Estimating & Proposals` | Takeoff → Pricing → Labor → Review → Proposal | `docs/modules/estimating.md` |
| `40 — CRM & Preconstruction` | leads, opportunities, ITBs, bid calendar, customers | `docs/modules/crm-preconstruction.md` |
| `50 — Projects, Work Packages & Scheduling` | award handoff, frozen budget, work packages, operations, readiness, schedule | `docs/modules/projects-work-packages-scheduling.md` |
| `60 — Field, Production & Pour Control` | field mobile, crews/time/work context, production, blockers, pour readiness/control | `docs/modules/field-production-pour-control.md` |
| `70 — Procurement, Finance & Billing` | vendors, procurement, POs, commitments, actuals, changes, billing, banking/accounting | `docs/modules/procurement-finance.md` |
| `80 — Documents, Drawings & Knowledge` | document linking, drawing revisions, search, retrieval, project knowledge | `docs/modules/documents-knowledge.md` |
| `90 — AI & Plan Intelligence` | plan intelligence, assisted Takeoff, extraction, evidence-backed AI suggestions | `docs/modules/ai-assistance.md` |
| `95 — UX & Design System` | global shell, navigation, typography, color, density, shared components, responsive rules | ADR-015, ADR-016, component pack, Issue #44 while open |
| `99 — QA, Release & Debugging` | cross-module acceptance, browser QA, staging verification, release/promotion defects | `docs/CURRENT_STATE.md`, QA/release workflow docs |

## Routing rules

1. Every idea gets one primary owning chat.
2. Cross-module consequences are recorded in all affected canonical GitHub docs after approval; the conversation stays in the primary owner.
3. Global visual/system patterns belong in `95`; module-specific workflows remain in their owning module.
4. Banking, payroll, AP, AR, POs, vendor bills, changes, and similar finance features begin under `70`.
5. New ideas with unclear ownership begin in `00`.
6. Current implementation priority is never inferred from chat order. Read `CURRENT_STATE.md` and `ROADMAP.md`.
7. Any rendered UI change must use the accepted shared dark shadcn system and may not revive the old global left rail, B2/light styling, compatibility presentation layers, alternate palettes, or a parallel component library.

## QA discovery funnel

During `99` testing:

- defect/regression against accepted behavior → investigate in `99`;
- small improvement/new idea → capture its owning module and continue the active QA pass unless immediate exploration is useful;
- major module-specific product/UX idea → route design discussion to the owning module;
- Carez-wide visual/system idea → route to `95`.

A new preference is not automatically a failed test.

## Temporary ChatGPT/Work threads

Create a temporary thread only when a coherent research/file/artifact objective benefits from isolated context. Temporary threads are narrow and disposable and do not become sources of product truth.

At completion, reconcile decisions/issues/verification into GitHub, return to the owning permanent chat, and archive the temporary thread when safe.

## Continuation rule

When a permanent chat becomes too long, create a continuation using the same domain identity and bootstrap from current GitHub truth rather than treating the old transcript as authority.

## Approval and closeout

Idea → brainstorm/research → proposed → approved → canonical GitHub docs updated → implementation → tests/browser QA → verified → `CURRENT_STATE.md` updated when appropriate.

Completed implementation/checkpoint documents and superseded design records should be removed from the active repository tree after durable truth is captured by canonical owners. Git history and closed issues preserve the evidence.
