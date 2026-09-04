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
| `95 — UX & Design System` | global shell, top navigation, animated category panels, contextual-pane rules, typography, color, iconography, density, shared components, responsive rules | ADR-015, ADR-016, `docs/design-system/CAREZ_COMPONENT_PACK.md`, ADR-014 component architecture where not superseded, Issue #44 while open |
| `99 — QA, Release & Debugging` | cross-module acceptance, browser QA, staging verification, release/promotion defects | `docs/CURRENT_STATE.md`, QA/release workflow docs |

## Mode and execution routing

### Regular Chat

Regular Chat is the default for permanent domain chats. Use it for brainstorming, product/architecture decisions, GitHub inspection, screenshots, scoped research, planning, QA reasoning, implementation scoping, and preparing bounded execution packets.

If the work remains discussion/analysis, stay in the owning permanent chat. Do not create a temporary thread merely because a new idea appears.

### Work

Use Work selectively for a bounded objective that is large/multi-step, research-heavy, document/file-heavy, artifact-heavy, or benefits from persistent agentic execution. Work is not the default home for permanent domain conversations.

When Work is appropriate, start a separate focused Work thread inside the Carez Project, give it a governed temporary name such as `60A — Field Workflow Research — Work`, complete the objective, reconcile the result into GitHub, then return to the owning permanent chat.

### Codex

Codex is a separate code-execution surface. It is **not a mode that an existing ChatGPT Project chat can be switched into**.

Follow ADR-017 and `docs/workflow/CODEX_EXECUTION_WORKFLOW.md`.

Carez uses a local-first Codex model:

- **Local Codex — default for bounded implementation:** Ollama + `gpt-oss:20b` handles routine React/TypeScript work, shadcn conversions, styling, forms/grids, mechanical refactors, straightforward handlers/tests, and known-fix debugging.
- **Cloud Codex — escalation only:** use for difficult cross-file debugging, Takeoff geometry/math, RLS/security-sensitive work, complex migrations, Condition persistence/domain logic, concurrency/reconciliation, immutable commercial lineage, major refactors, difficult performance work, or justified browser automation.

The owning permanent chat remains the product/QA coordination room. It should inspect canonical truth, determine the objective, and prepare a bounded implementation packet before Codex execution whenever practical.

When Codex is appropriate:

1. Keep the owning permanent ChatGPT chat as the coordination room.
2. Prepare one self-contained implementation/debugging packet.
3. Choose **Local Codex** by default unless cloud escalation criteria are met.
4. For a local task, verify the active provider is Ollama and the model is `gpt-oss:20b` before execution.
5. Open Codex separately and create one focused task/thread.
6. Run the supplied implementation packet.
7. After implementation and task-appropriate local validation, Codex reports changed files/results/checkpoint and stops.
8. Return to the owning permanent chat for CI/deployment inspection, browser QA, reconciliation, and next routing.

Local bounded failures use a two-attempt stop rule: one implementation attempt, one focused correction using the exact failure, then stop and return evidence for re-scoping or cloud escalation.

Never tell the user to “switch this chat to Codex.” Say exactly which separate Codex task to open and whether it should use **Local Codex** or **Cloud Codex**.

Do not use Codex for routine GitHub/docs archaeology, Vercel polling, release bookkeeping, or documentation reconciliation when ChatGPT/connected tools can perform those tasks directly.

## Mandatory routing footer

Every substantive Carez response must tell the user exactly where and how to continue. Use:

CAREZ ROUTING
CHAT: exact owning permanent chat name or `Stay in this chat`
MODE: `Regular Chat`, `Work`, or `Codex`
TEMP CHAT: `No` or exact temporary ChatGPT/Work thread name
CODEX TASK: `No` or exact separate Codex task name, prefixed `Local —` or `Cloud —` when Codex is used
WHY: one short sentence
NEXT ACTION: exact action the user should take next
RETURN TO: owning permanent chat after temporary Work/Codex activity, or `N/A`

Routing semantics:
- Regular Chat: normally `TEMP CHAT: No`, `CODEX TASK: No`.
- Work: normally name the focused Work thread under `TEMP CHAT`; `CODEX TASK: No`.
- Codex: normally `TEMP CHAT: No`; give the exact separate Codex task and execution class under `CODEX TASK`.
- Never make the user infer whether to stay, create a Work thread, use local Codex, or escalate to cloud Codex.

## Routing rules

1. Every idea gets one primary owning chat. Do not duplicate the same brainstorm across multiple chats.
2. Cross-module consequences are recorded in all affected canonical GitHub docs after approval; the conversation stays in the primary owning chat.
3. Global visual/system patterns belong in `95`; module-specific screen/workflow decisions remain in that module's chat.
4. Banking, payroll, AP, AR, POs, vendor bills, changes, and similar finance features begin under `70` unless their scope later justifies focused execution.
5. New ideas with unclear ownership begin in `00`; route them before substantial design work.
6. Current implementation priority is never inferred from chat order. Read `CURRENT_STATE.md` and `ROADMAP.md`.
7. Any chat that changes rendered UI must use ADR-015 + ADR-016 + `docs/design-system/CAREZ_COMPONENT_PACK.md`: compact top application header, animated global category navigation, module-specific contextual panes, and the shared Carez shadcn components. Module chats may compose domain-specific screens, but they may not introduce or revive the old permanent global left rail, a light/B2/legacy design system, compatibility layer, route-local framework, alternate palette, or parallel component library. New global patterns route through `95` for canonicalization.

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
