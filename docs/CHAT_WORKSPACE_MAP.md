# Carez Concrete OS — Chat Workspace Map

Status: Canonical workflow document

## Purpose

ChatGPT chats are working rooms, not permanent product memory. Approved Carez truth belongs in canonical GitHub documentation.

Use a small set of permanent domain chats for exploration and coordination. Create temporary ChatGPT threads only for focused implementation/debugging/research work that benefits from isolated context. Codex tasks are separate execution threads, not ChatGPT chats.

## Permanent chats

| Chat | Owns | Primary canonical docs |
|---|---|---|
| `00 — Carez Control Room` | current priority, roadmap, cross-module decisions, release coordination, routing new ideas | `docs/CURRENT_STATE.md`, `docs/ROADMAP.md`, `docs/ARCHITECTURE.md` |
| `10 — Takeoff Workstation` | plans, calibration, geometry, measurement tools, takeoff worksheet, takeoff lineage | `docs/modules/takeoff.md`, Takeoff ADRs and accepted detailed designs |
| `20 — Concrete Condition & Resource Engine` | archetypes, company templates, project Conditions, modules, measurement roles, resources, advanced logic, builder methods, production/resource logic | `docs/modules/assembly-resource-engine.md`, `docs/concrete-condition-3d-workstation-target.md`, ADR-012/ADR-013 |
| `30 — Estimating & Proposals` | Scope → Takeoff → Pricing → Review → Proposal, cost/pricing provenance, labor/crew buildup, bid review | `docs/modules/estimating.md` |
| `40 — CRM & Preconstruction` | leads, opportunities, ITBs, bid calendar, customers, preconstruction pipeline | `docs/modules/crm-preconstruction.md` |
| `50 — Projects, Work Packages & Scheduling` | award handoff, frozen budget, work packages, operations, readiness, schedule | `docs/modules/projects-work-packages-scheduling.md` |
| `60 — Field, Production & Pour Control` | field mobile, crews/time/tasks, production, issues, pour readiness/control | `docs/modules/field-production-pour-control.md` |
| `70 — Procurement, Finance & Billing` | vendors, procurement, POs, commitments, actuals, changes, billing, banking/accounting integrations | `docs/modules/procurement-finance.md` |
| `80 — Documents, Drawings & Knowledge` | document linking, drawing revisions, search, retrieval, project knowledge | `docs/modules/documents-knowledge.md` |
| `90 — AI & Plan Intelligence` | plan intelligence, assisted Takeoff, extraction, evidence-backed AI suggestions | `docs/modules/ai-assistance.md` and accepted Plan Intelligence contracts |
| `95 — UX & Design System` | global shell, navigation, typography, color, iconography, density, shared components, responsive rules | architecture/design-system rules and accepted B2 design documents |
| `99 — QA, Release & Debugging` | cross-module acceptance, browser QA, staging verification, release/promotion defects | `docs/CURRENT_STATE.md`, QA/release workflow docs |

## Mode and execution routing

### Regular Chat

Regular Chat is the default for permanent domain chats. Use it for brainstorming, product/architecture decisions, GitHub inspection, screenshots, scoped research, planning, QA reasoning, and preparing execution prompts.

If the work remains discussion/analysis, stay in the owning permanent chat. Do not create a temporary thread merely because a new idea appears.

### Work

Use Work selectively for a bounded objective that is large/multi-step, research-heavy, document/file-heavy, artifact-heavy, or benefits from persistent agentic execution. Work is not the default home for permanent domain conversations.

When Work is appropriate, start a separate focused Work thread inside the Carez Project, give it a governed temporary name such as `60A — Field Workflow Research — Work`, complete the objective, reconcile the result into GitHub, then return to the owning permanent chat.

### Codex

Codex is a separate code-execution surface. It is **not a mode that an existing ChatGPT Project chat can be switched into**.

Use Codex when actual repository coding is required and the objective involves substantial implementation, difficult cross-file debugging, migrations, complex domain logic, or browser automation. Routine GitHub/docs inspection and simple localized work should be handled directly when possible.

When Codex is appropriate:
1. Keep the owning permanent ChatGPT chat as the product/QA coordination room.
2. Prepare one self-contained implementation/debugging prompt in that chat.
3. Open Codex separately.
4. Create a focused Codex task/thread with a governed name, for example `99A — Takeoff Vertical Pan`.
5. Paste/run the supplied implementation prompt in Codex.
6. When Codex finishes, return to the owning permanent ChatGPT chat with the result/checkpoint for review, QA, reconciliation, and next routing.

Never tell the user to “switch this chat to Codex.” Say exactly: “Open Codex separately, create the named Codex task, and paste the supplied prompt.”

## Mandatory routing footer

Every substantive Carez response must tell the user exactly where and how to continue. Use:

CAREZ ROUTING
CHAT: exact owning permanent chat name or `Stay in this chat`
MODE: `Regular Chat`, `Work`, or `Codex`
TEMP CHAT: `No` or exact temporary ChatGPT/Work thread name
CODEX TASK: `No` or exact Codex task name
WHY: one short sentence
NEXT ACTION: exact action the user should take next
RETURN TO: owning permanent chat after temporary Work/Codex activity, or `N/A`

Routing semantics:
- Regular Chat: normally `TEMP CHAT: No`, `CODEX TASK: No`.
- Work: normally name the focused Work thread under `TEMP CHAT`; `CODEX TASK: No`.
- Codex: normally `TEMP CHAT: No`; give the exact separate Codex task under `CODEX TASK`.
- Never make the user infer whether to stay, create a Work thread, or open Codex separately.

## Routing rules

1. Every idea gets one primary owning chat. Do not duplicate the same brainstorm across multiple chats.
2. Cross-module consequences are recorded in all affected canonical GitHub docs after approval; the conversation stays in the primary owning chat.
3. Global visual/system patterns belong in `95`; module-specific screen/workflow decisions remain in that module's chat.
4. Banking, payroll, AP, AR, POs, vendor bills, changes, and similar finance features begin under `70` unless their scope later justifies focused execution.
5. New ideas with unclear ownership begin in `00`; route them before substantial design work.
6. Current implementation priority is never inferred from chat order. Read `CURRENT_STATE.md` and `ROADMAP.md`.

## QA discovery funnel

`99 — QA, Release & Debugging` is allowed to discover bugs and new ideas while testing without forcing constant chat switching.

When something is noticed during QA, classify it before routing:
- **Defect/regression against accepted behavior:** keep investigating in `99`.
- **Small improvement/new idea:** capture its owning module and continue the active QA session unless the user wants to explore it immediately.
- **Major module-specific product/UX idea:** route design discussion to the owning module chat when appropriate.
- **Carez-wide visual/system idea:** route design discussion to `95`.

A new preference discovered during QA is not automatically a failed test. Preserve the distinction between accepted-behavior defects and new product ideas. Do not interrupt a coherent QA pass merely to move every enhancement idea into another chat.

## Temporary ChatGPT/Work threads

Create a temporary ChatGPT/Work thread only when a coherent implementation/debugging/research objective benefits from isolated conversational context. Do not call a Codex task a temporary ChatGPT chat.

Naming:
- `<domain number><letter> — <objective> — Implementation` for a focused ChatGPT implementation/debugging thread when one is actually useful.
- `<domain number><letter> — <objective> — Work` for focused Work execution.

Examples:
- `20A — Concrete Condition Foundation — Implementation`
- `60A — Field Workflow Research — Work`
- `95A — Design System Audit — Work`

Temporary threads are narrow and disposable. They do not become sources of product truth. At completion, reconcile decisions/issues/PRs/verification into GitHub, return to the owning permanent chat, and archive the temporary thread when safe.

## Continuation rule

When a permanent chat becomes too long, create a continuation using the same domain identity, for example `20 — Concrete Condition & Resource Engine — Continuation 2`.

Bootstrap from current GitHub truth: `docs/README.md`, `docs/CURRENT_STATE.md`, applicable module specs, ADRs/accepted designs, relevant issues/PRs, and repository evidence. Do not summarize the entire old transcript as authority. Carry forward only unresolved conversational context that has not yet become canonical.

## Approval and closeout

Idea → brainstorm/research → proposed → approved → canonical GitHub docs updated → issue/implementation → tests/browser QA → verified → `CURRENT_STATE.md` updated when appropriate.

Before closing temporary Work/Codex execution, confirm approved decisions are canonical, implementation is represented in GitHub, UI claims have browser evidence, remaining work is captured, and current-state documentation reflects only verified changes.

## Chat lifecycle

Permanent domain chats may remain for long-term exploration. Temporary ChatGPT/Work threads should be archived after reconciliation. Codex tasks may remain as execution history but are not canonical product memory. Old chats whose approved truth is already canonical may remain historical but should not be used as current authority.
