# Carez Concrete OS — Documentation Control

Use the source that owns the question. Do not preload the entire documentation tree.

For coding-agent work, start with root `AGENTS.md`; it contains the compact execution-critical boundaries. Then read only the additional canonical sources required by the bounded task.

## Canonical source hierarchy

1. `supabase/` schema and migrations — persisted database truth.
2. Repository source code — implemented application behavior.
3. `docs/ARCHITECTURE.md` and ADRs — approved architecture and important decisions.
4. `docs/modules/` — approved module behavior and product contracts.
5. `docs/CURRENT_STATE.md` — concise current implementation and verification state.
6. `docs/ROADMAP.md` — prioritized modernization sequence.
7. GitHub issues / PRs — proposed, active, and historical implementation evidence.
8. Browser/Vercel evidence — rendered UI acceptance evidence.
9. ChatGPT Project files — concrete, estimating, regulatory, brand, and company reference evidence.
10. Chat conversations — exploration until promoted into canonical docs.

When sources conflict, prefer the higher authority and record the conflict if it affects implementation.

## Task-based reading map

Use the smallest authoritative set that answers the task:

| Task / question | Read first | Add only when needed |
| --- | --- | --- |
| Bounded coding task with approved behavior | root `AGENTS.md`, target implementation/files | explicitly referenced spec/ADR or migration if the change depends on it |
| Current priority / what should happen next | `CURRENT_STATE.md`, then `ROADMAP.md` | active GitHub issue(s) owning the work |
| Branch, QA target, deployment line, production promotion | `BRANCH_AND_RELEASE_MODEL.md` | `CURRENT_STATE.md` only if current deployment state matters |
| Product/domain behavior | applicable `modules/*.md` | relevant ADR(s), then current implementation evidence |
| Architecture decision | `ARCHITECTURE.md`, relevant ADR(s) | applicable module spec and implementation evidence |
| Current bug / implementation status | relevant source code, `CURRENT_STATE.md` | tests/build output and browser evidence |
| Database/RLS/migration behavior | relevant `supabase/` migrations/schema and server/domain code | relevant ADR/module contract and current environment evidence |
| UI implementation | relevant source code plus applicable ADR-015/ADR-016/shared component docs | module spec or focused ADR only when behavior requires interpretation |
| Historical/supporting rationale | `DOCUMENT_STATUS.md` | the specifically classified supporting/superseded document |

### Context discipline

- Do not automatically read `README.md`, `CURRENT_STATE.md`, `ROADMAP.md`, `BRANCH_AND_RELEASE_MODEL.md`, every module spec, and every ADR for each coding task.
- When the user or implementation packet names source files, treat that list as the initial source boundary. Broaden only for a concrete contradiction, missing dependency, or safety concern.
- Do not recursively grep/glob the whole `docs/` tree when the owning document is already known.
- Do not reread unchanged documents in the same bounded task merely to reconfirm a conclusion already established.
- Supporting and superseded documents are read on demand only; they never override canonical owners.
- If a bounded local-inference task approaches its context limit because of documentation retrieval, reduce unnecessary context before increasing the model context window.

See `KNOWLEDGE_SOURCE_ROUTING.md` for source-domain routing and ADR-017 for local-agent context-budget discipline.

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
- [Codex Execution Workflow](workflow/CODEX_EXECUTION_WORKFLOW.md)
- [QA and Acceptance](workflow/QA_AND_ACCEPTANCE.md)
- [Concrete Condition + 3D Workstation Target](concrete-condition-3d-workstation-target.md)

## Agent execution authority

ADR-017 and `docs/workflow/CODEX_EXECUTION_WORKFLOW.md` define the local-first coding model: ChatGPT/connected tools own Carez reasoning, scoping, QA/release inspection, and documentation reconciliation; local Codex with Ollama + `gpt-oss:20b` remains the approved default bounded code executor; cloud Codex is reserved for justified high-risk/difficult escalation; GitHub Actions is the comprehensive post-push validation path.

The context-budget rules in ADR-017 apply to any local inference harness used for bounded Carez work. That does not make another harness the canonical default executor without a separate approved decision.

Root `AGENTS.md` intentionally contains only the execution-critical invariants and boundaries needed by coding agents. Do not expand it back into a duplicate of the documentation tree.

## Global UI authority

`docs/decisions/ADR-015-dark-minimal-shadcn-application-system.md` is the Carez-wide dark shadcn presentation authority. `docs/decisions/ADR-016-top-navigation-shell-and-component-pack.md` owns the desktop shell: compact top application header + animated global category navigation + module-specific contextual panes. The previous permanent global desktop left rail is superseded.

`docs/design-system/CAREZ_COMPONENT_PACK.md` defines the first shared Carez component pack: Data Grid, Number Field, Date/Time Field, Condition Tree, Toolbar, Resizable Workspace, File Upload, Loading States, and Motion. All module chats must reuse/extend the shared source-owned shadcn workspace instead of introducing local design systems, compatibility layers, alternate palettes, or parallel component libraries.

While Issue #44 remains open, it is the implementation/completion owner for the full dark shadcn migration, ADR-016 shell replacement, legacy-UI removal, and initial shared-component rollout.

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

ADRs document why high-impact decisions exist. Module specs document how the product behaves. `CURRENT_STATE.md` documents what is actually implemented/verified now; it intentionally does not duplicate closed-issue implementation history.

## Chat workspace governance

Use `CHAT_WORKSPACE_MAP.md` to route work into permanent domain chats and temporary execution threads when needed. Chats remain working rooms; approved product truth must be promoted into canonical GitHub documentation.

## Supporting / historical documents

Supporting documents may add detail but may not override canonical architecture, ADRs, module specifications, Current State, or the branch/release model. Use `DOCUMENT_STATUS.md` before relying on a supporting document.

Historical implementation evidence belongs in Git history, closed PRs/issues, archived snapshots, tags/releases, or explicitly historical documents — not in the hot context path for routine implementation.
