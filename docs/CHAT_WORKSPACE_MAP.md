# Carez Concrete OS — Chat Workspace Map

Status: Canonical workflow document

## Purpose

ChatGPT chats are working rooms, not permanent product memory. Approved Carez truth belongs in canonical GitHub documentation.

Use a small set of permanent domain chats for exploration and coordination. Create temporary implementation chats only for focused build/debugging work. Do not create a new permanent chat for every page, feature, or PR.

## Permanent chats

| Chat | Owns | Primary canonical docs |
|---|---|---|
| `00 — Carez Control Room` | current priority, roadmap, cross-module decisions, release coordination, routing new ideas | `docs/CURRENT_STATE.md`, `docs/ROADMAP.md`, `docs/ARCHITECTURE.md` |
| `10 — Takeoff Workstation` | plans, calibration, geometry, measurement tools, takeoff worksheet, takeoff lineage | `docs/modules/takeoff.md`, Takeoff ADRs and accepted detailed designs |
| `20 — Assembly & Resource Engine` | assembly authoring, properties, resources, builder methods, production/resource logic, assembly creator UX | `docs/modules/estimating.md`, custom assembly and builder-method accepted designs |
| `30 — Estimating & Proposals` | Scope → Takeoff → Pricing → Review → Proposal, cost/pricing provenance, labor/crew buildup, bid review | `docs/modules/estimating.md` |
| `40 — CRM & Preconstruction` | leads, opportunities, ITBs, bid calendar, customers, preconstruction pipeline | `docs/modules/crm-preconstruction.md` |
| `50 — Projects, Work Packages & Scheduling` | award handoff, frozen budget, work packages, operations, readiness, schedule | `docs/modules/projects-work-packages-scheduling.md` |
| `60 — Field, Production & Pour Control` | field mobile, crews/time/tasks, production, issues, pour readiness/control | `docs/modules/field-production-pour-control.md` |
| `70 — Procurement, Finance & Billing` | vendors, procurement, POs, commitments, actuals, changes, billing, banking/accounting integrations | `docs/modules/procurement-finance.md` |
| `80 — Documents, Drawings & Knowledge` | document linking, drawing revisions, search, retrieval, project knowledge | `docs/modules/documents-knowledge.md` |
| `90 — AI & Plan Intelligence` | plan intelligence, assisted Takeoff, extraction, evidence-backed AI suggestions | `docs/modules/ai-assistance.md` and accepted Plan Intelligence contracts |
| `95 — UX & Design System` | global shell, navigation, typography, color, iconography, density, shared components, responsive rules | architecture/design-system rules and accepted B2 design documents |
| `99 — QA, Release & Debugging` | cross-module acceptance, browser QA, staging verification, release/promotion defects | `docs/CURRENT_STATE.md`, QA/release workflow docs |

## Routing rules

1. Every idea gets one primary owning chat. Do not duplicate the same brainstorm across multiple chats.
2. Cross-module consequences are recorded in all affected canonical GitHub docs after approval; the conversation stays in the primary owning chat.
3. Global visual/system patterns belong in `95`; module-specific screen/workflow decisions remain in that module's chat.
4. Banking, payroll, AP, AR, POs, vendor bills, changes, and similar finance features begin under `70` unless their scope later justifies a focused temporary chat.
5. New ideas with unclear ownership begin in `00`; route them before substantial design work.
6. Current implementation priority is never inferred from chat order. Read `CURRENT_STATE.md` and `ROADMAP.md`.

## Temporary implementation chats

Create a temporary chat only when a coherent implementation/debugging objective benefits from isolated context.

Naming:

`<domain number><letter> — <objective> — Implementation`

Examples:
- `20A — Assembly Creator — Implementation`
- `20B — Builder Methods — Implementation`
- `30A — Pricing Review — Implementation`
- `60A — Mobile Timeclock — Implementation`
- `60B — Pour Control — Implementation`

Temporary chats should be narrow. They do not become new sources of product truth.

Before implementation they must read canonical docs and inspect existing code. At completion, reconcile decisions/issues/PRs/verification into GitHub. After that they may be archived without creating a transcript handoff.

## Continuation rule

When a permanent chat becomes too long, create a continuation chat using the same domain identity, for example:

`20 — Assembly & Resource Engine — Continuation 2`

Do not summarize the entire old chat as authority. Bootstrap the continuation from current GitHub truth:

1. `docs/README.md`
2. `docs/CURRENT_STATE.md`
3. applicable module spec
4. applicable ADRs / accepted detailed designs
5. relevant open issues / PRs
6. repository implementation evidence

Only include unresolved conversational context that has not yet become a canonical decision.

## Approval and closeout

When a significant decision is approved:

Idea → brainstorm/research → proposed → approved → canonical GitHub docs updated → issue/implementation → tests/browser QA → verified → `CURRENT_STATE.md` updated when appropriate.

Before archiving a temporary implementation chat, confirm:
- approved product decisions are in module/architecture/ADR docs;
- implementation work is represented by an issue/PR or merged code;
- UI claims have browser evidence;
- remaining work is captured in GitHub;
- current-state documentation is updated only when verified state changed.

## Chat lifecycle

Permanent domain chats may remain for long-term exploration. Temporary implementation/debugging chats should be archived after reconciliation. Old chats whose approved truth is already canonical may remain historical but should not be used as current authority.
