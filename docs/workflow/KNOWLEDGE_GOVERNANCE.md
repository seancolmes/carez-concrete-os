# Carez Knowledge Governance

This document is the canonical repository contract for Carez chat lifecycle, project boundaries, context loading, handoffs, and promotion or archival of knowledge. It complements the provider, orchestration, worktree, and evidence boundaries listed below; it does not replace them.

## Governing model

| Source | Role | Authority |
| --- | --- | --- |
| Chats | Disposable execution sessions for bounded work | No durable policy or implementation authority by themselves |
| Carez repository | Durable institutional and software authority: accepted contracts, source, migrations, and verified implementation state | Canonical; current accepted source wins |
| ChatGPT Project files | Governed supporting references that provide scoped context | Supporting; provenance and authority must be recorded, and conflicts defer to repository authority |
| Runtime/provider inspection | Evidence of current external state under the relevant read boundary | Current only for its recorded provider, target, scope, and time; a read never authorizes a write |
| Archives | Historical evidence of past execution and decisions | Historical only; never current implementation authority |

Current repository source, accepted specifications/ADRs, and workflow contracts retain the existing Carez authority hierarchy. Git history and issues preserve implementation history. Derived memory and browser observations remain governed by [KNOWLEDGE_AND_OBSERVATION_BOUNDARY.md](KNOWLEDGE_AND_OBSERVATION_BOUNDARY.md).

## Human-memory independence

Nik must never be expected to remember an undocumented follow-up step. Every actionable Codex or local-agent prompt must be immediately followed by a separate **What you do next** section. That section tells Nik exactly what to do, what to return, what remains unauthorized, and whether to stay in the current chat. If no human action is needed, say so explicitly and identify the next automatic/local step. A Carez development response may then finish with **Next recommended action:** followed by a concise recommendation.

Every required chat transition must provide all of the following in the handoff itself:

1. the exact destination chat title;
2. the exact destination Project and logical section;
3. a copy-ready bootstrap prompt containing the objective, Work ID, accepted facts, source links, current state, boundaries, and first action;
4. the action for the source chat: continue it, close/archive it, or leave it open as a named dependency;
5. local/worktree preservation guidance: repository root, branch/worktree, dirty files to preserve, and any named external workspace.

Do not require Nik to infer a title, find a prompt in an old chat, remember a file path, or decide whether a worktree is safe to remove.

## Chat lifecycle

### Work identity and action

Each development chat has exactly one primary Work ID. Keep that ID while continuing the same coherent work unit, even if its stage changes. A distinct objective or independently closable outcome gets its own Work ID and chat. Related Work IDs may link to one another but must not be merged into one chat merely because they share a feature, issue, or Project.

At a decision point, state exactly one lifecycle action:

- **CONTINUE THIS CHAT** — same Work ID, objective, and coherent working context; state the next concrete task and boundaries.
- **START NEW CHAT** — continuity or scope requires a new session; provide the complete transition packet above.
- **CLOSE AND ARCHIVE THIS CHAT** — retirement gate passed; record durable outcomes and give any follow-up work its own complete transition packet.

### Mandatory new-chat triggers

Start a new chat when any of these applies:

- the primary Work ID or independently closable objective changes;
- a new product/repository/security authority boundary is required;
- a production mutation is proposed (use a dedicated `PROD` authority chat, separate from discovery, QA, release readiness, or rehearsal);
- the current context contains competing objectives or enough unrelated history that the next operator cannot reconstruct the active state from the continuation packet;
- a required new chat must isolate a different provider, environment, or authorization boundary;
- a completed/retired work unit is being reopened for a materially new objective.

Do not use an estimated token count as a transition rule. Apply the **continuity gate**: continue only when the objective, decisions, current state, authority boundaries, and next action remain coherent and reconstructable from the current chat plus a short continuation packet. Start a new chat when that fails, even if the session is short; continue when it passes, even if the session is long.

### Production boundary

Every production mutation work unit uses a dedicated chat titled with stage `PROD`. Keep production inspection, authorization, and action scope explicit there. State provider, production target, operation, object/resource, expected effect, source authority, preflight, verification, and recovery needs as applicable. Authorization is limited to the action and target named in the current request and does not carry through a chat transition. Follow [EXTERNAL_STATE_BOUNDARY.md](EXTERNAL_STATE_BOUNDARY.md) and [COMMAND_CENTER_MUTATION_GATE.md](COMMAND_CENTER_MUTATION_GATE.md); this governance document grants no provider capability.

### Dormant work and retirement

If a development chat is inactive for **more than 14 calendar days** and no preserved active worktree remains, externalize any durable or open state, then close and archive the chat. Resume later in a new chat using a continuation packet and **Carez rehydrate this session**. Do not leave unfinished work only in an inactive chat. A deliberately preserved active worktree may justify keeping the work active or waiting, but its state and owner must be explicit. Do not let age change source authority or imply that unaccepted work may be discarded.

Pass the **retirement gate** before closing and archiving a chat:

- outcome and acceptance state are explicit;
- durable decisions and verified state are promoted to their owning repository source;
- issue/Git history remains the implementation record where applicable;
- local dirty work and worktree disposition are named, with no unaccepted work presumed safe to discard;
- unresolved dependencies, follow-ups, and owners are either closed or transferred in a complete continuation packet;
- the archive destination and exact archive action are stated.

Archive only after this gate. A chat may be closed without claiming its objective succeeded; mark outcome as blocked, superseded, or abandoned and preserve the reason.

## Naming convention

Use this exact title shape:

```text
CAREZ | <Domain> | <Work ID> | <Short Objective> | <Stage>
```

Allowed stages are `DISCOVERY`, `DESIGN`, `IMPLEMENT`, `QA`, `RELEASE`, `PROD`, `INCIDENT`, and `CLOSEOUT`. Keep the Work ID stable across stages. Use a concise domain and objective that distinguish the chat in active lists; do not encode secrets, customer identifiers, or unnecessary personal data in titles.

## Control Room and archive organization

Organize chats in these approved logical sections inside the Carez Control Room; sections are not separate Projects:

- **Architecture & Governance**
- **Active Development / Preconstruction**
- **Active Development / Projects**
- **Active Development / Field**
- **Active Development / Production**
- **Active Development / Finance**
- **Active Development / Platform**
- **Database & Data**
- **Release & Environments**
- **QA & Incidents**
- **Tooling & Command Center**

Place each chat in the section matching its primary Work ID and authority. If nested sections are unavailable, encode that classification in the chat title. Keep production mutation work in its dedicated `PROD` chat even when its section is Active Development / Production.

Use this yearly archive hierarchy:

```text
Carez Archive
└── <YYYY>
    ├── Architecture & Governance
    ├── Preconstruction
    ├── Projects
    ├── Field
    ├── Production
    ├── Finance
    ├── Database & Release
    ├── Platform & Tooling
    └── Incidents
```

Place a closed chat in its completion year and matching category. Preserve links/provenance when references are superseded. Archived chats are historical evidence only; they must never become current implementation authority. Revalidate archived claims against current repository source before reuse.

## Handoff and rehydration

Every continuation handoff uses a **Carez continuation packet** with these fields:

```text
Work ID and exact chat title:
Stage and disposition:
Objective and acceptance criteria:
Current status and next action:
Accepted decisions / deferred scope:
Authoritative repository paths and relevant symbols/sections:
Branch, repository root, worktree, and dirty files to preserve:
Validation performed and results:
Evidence source, environment, scope, and observed time:
Provider actions authorized / explicitly not authorized:
External workspace or artifacts and retention:
Exact transition action and destination (if any):
What you do next:
```

Keep the packet concise but sufficient to reconstruct the work. Link large evidence artifacts instead of pasting them. Label memory, archive, and browser evidence by authority class; do not present them as current source facts.

The command **“Carez rehydrate this session”** means reconstruct the current task from the continuation packet, current repository instructions/source, current Git state, and only the narrowly required current evidence. It does not mean resume from chat memory alone. Verify freshness-sensitive claims against their owning authority. If the required state cannot be reconstructed safely, stop and report the missing item rather than guessing.

## Project governance

A new ChatGPT Project represents a durable **authority, product, repository, or security boundary**. It is not a folder for a topic, issue, feature, phase, or team activity. A new Carez issue, feature, or phase remains in the existing Carez Project unless it changes one of those boundaries.

Minimum governance for a ChatGPT Project:

- a clear purpose, owner, included/excluded scope, and boundary from other Projects;
- instructions that identify current repository/source authority, local-first workflow, and READ/WRITE separation;
- a source manifest for every supporting Project file, with title, repository/source path or origin, owner, version/commit or capture date, authority class, provenance, and review/expiry condition;
- no credentials, secrets, or ungoverned sensitive production/customer data;
- a review date and owner for updating or removing stale supporting files.

Minimum governance for a software repository:

- root `AGENTS.md` or equivalent routing for authority, preservation, scope, and required workflows;
- a `CODEX.md` or equivalent local execution/validation contract where used;
- durable behavior in the owning source/specification/ADR/workflow, verified state in the designated current-state record, and migration authority in source-controlled migrations;
- traceable ownership and review for permanent directories and generated/supporting artifacts;
- provider reads and writes kept separate under the existing external-state and mutation contracts.

Project files support repository work; they do not fork the canonical implementation. For each file, record its version/provenance and reconcile it when the repository or accepted authority changes. Remove or mark superseded references rather than letting two copies appear current.

## Local/Codex context loading

Attach or open the Carez repository root once. Avoid attaching both the repository root and overlapping nested folders, duplicate checkout/worktree copies, or broad machine directories such as an entire Documents tree. Keep external evidence/workspaces separate from repository source. Load only the task target and the direct context needed to act.

| Task | Load first | Add only when needed |
| --- | --- | --- |
| Local implementation | `AGENTS.md`, `CODEX.md`, named target | Direct imports/dependencies and owning contract |
| Database/persistence | Migration skill and named migration/schema contract | Direct schema/function dependencies and relevant QA/prod evidence, only under task authorization |
| UI or domain change | Matching skill and named route/module | Direct components and applicable accepted ADR/domain contract |
| Browser/runtime investigation | Browser-debug skill and supplied runtime evidence | Owning source path after reproducing/capturing the bounded observation |
| Release readiness | Release-gate skill and intended commit/tree | Migration/deployment evidence required by that gate |
| Provider or production action | External-state boundary; mutation gate for writes/production/destructive actions | Exact target/current evidence and source authority for the requested action |
| Continuation/rehydration | Continuation packet and current Git state | Current owning source plus only stale-sensitive evidence needed to resume |
| Cross-source orchestration | Orchestration contract | Only the evidence channels materially needed for the task |

This matrix routes context; it does not authorize provider access. Use the more specific skill and boundary contracts when they apply.

## Directory expansion and external workspaces

Create a permanent repository directory only for a stable ownership boundary that has distinct maintainers, lifecycle, or source authority. A work item, issue number, one-off rehearsal, final review, or miscellaneous artifact is not a permanent boundary. Do not create per-issue `temp`, `final`, `misc`, or checkpoint trees inside the repository.

Put disposable rehearsal databases, dumps, logs, and generated evidence in a clearly named external workspace, for example:

```text
<user documents>/Carez-Rehearsal/<system-or-issue>/<work-id>/
```

Keep secrets and business-row data out of source control and follow the task's data boundary. External workspace contents are not canonical repository authority. Reuse or remove them only under their owning task's preservation and cleanup instructions.

Every non-canonical README or workspace manifest must identify purpose, owner, authority status, included/excluded contents, provenance, expected lifecycle/retention, and the canonical source to consult. A README must not create a competing product contract.

## Knowledge promotion and archival

Promote a durable decision or verified behavior to its owning repository source: module/specification for behavior, ADR for accepted cross-cutting architecture, workflow doc for process, `AGENTS.md`/`CODEX.md` for small routing/execution rules, migration for schema change, and `CURRENT_STATE.md` for verified implementation state. Do not promote unverified memory or observation as fact.

Git history and issues preserve implementation and review history. A closed chat may link to those records, but must not duplicate them in a checkpoint document. Avoid redundant archive trees, session transcripts, and “final” copies when the owning source and Git history already preserve the durable result. Archive the chat as historical evidence after promotion; never use it as current implementation authority.

## Governance cadence

- **Per work unit:** assign one Work ID and stage; check Project boundary; load narrow context; state preservation and provider boundaries; immediately follow actionable prompts with **What you do next**; update the continuation packet on transition; promote durable outcomes before retirement.
- **Weekly:** review active sections and waiting work; identify stale next actions, owners, dates, and chats approaching the 14-day inactivity rule; check pending transitions are explicit.
- **Monthly:** review Project source manifests and stale references; remove accidental duplicate/overlapping context; inspect new permanent directories and non-canonical artifacts for ownership/provenance/lifecycle; confirm closed work has passed its retirement gate.
- **Quarterly:** audit Project boundaries, instructions, source provenance, archive organization, and chat lifecycle; review that authority hierarchy and provider READ/WRITE separation still match the external-state, mutation, orchestration, worktree, and knowledge/observation contracts.

Record governance changes in this document or its owning contract, not as an untracked chat-only rule.

## Decision matrix

| If… | Then… |
| --- | --- |
| The objective and Work ID remain coherent and reconstructable | Continue the existing chat and state the next action |
| Work ID, authority boundary, or independently closable objective changes | Start a new chat and provide the complete continuation packet/transition instructions |
| The work proposes a production mutation | Use a dedicated `PROD` chat and the current-task provider/action authorization gate |
| A development chat is inactive for more than 14 days and has no preserved active worktree | Externalize durable/open state, close and archive it; resume later in a new chat from a continuation/rehydration packet |
| A development chat is inactive but a preserved active worktree remains | It may remain active or waiting only when the worktree state and owner are explicit |
| A chat is complete, blocked for retirement, superseded, or abandoned | Pass the retirement gate, promote durable facts, then close/archive with disposition |
| A Project is proposed for a new issue, feature, phase, or topic | Keep it in the existing Project |
| A genuinely new product/repository/security authority boundary is established | Create a Project with instructions and a versioned/provenanced source manifest |
| More context seems helpful | Load the narrow task target and direct dependencies; do not attach overlapping roots or broad machine directories |
| A folder is proposed for an issue or one-time artifact | Use the owning source or external rehearsal workspace; do not add a permanent repo directory |
| A chat, memory page, browser observation, or archive conflicts with current accepted source | Verify against the owning current source and treat the other item as historical/derived evidence |
| A provider read or release gate succeeded | Treat it as evidence/readiness only; require separate current-task write authorization for mutation |

## Related contracts

- [DEVELOPMENT_WORKFLOW.md](DEVELOPMENT_WORKFLOW.md) — local-authority-first development and release cycle.
- [KNOWLEDGE_AND_OBSERVATION_BOUNDARY.md](KNOWLEDGE_AND_OBSERVATION_BOUNDARY.md) — authority classes for repository source, derived memory, observation, and provider state.
- [COMMAND_CENTER_ORCHESTRATION.md](COMMAND_CENTER_ORCHESTRATION.md) — narrow multi-source evidence routing.
- [CODEX_WORKTREES.md](CODEX_WORKTREES.md) — managed worktree, handoff, and preservation lifecycle.
- [EXTERNAL_STATE_BOUNDARY.md](EXTERNAL_STATE_BOUNDARY.md) and [COMMAND_CENTER_MUTATION_GATE.md](COMMAND_CENTER_MUTATION_GATE.md) — provider READ/WRITE and production/destructive authorization.
