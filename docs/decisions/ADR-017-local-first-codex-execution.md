# ADR-017 — Local-first Codex execution

Status: Accepted
Date: 2026-09-04
Updated: 2026-09-06

## Context

Carez development uses ChatGPT for product/architecture coordination and Codex for repository implementation. Hosted Codex usage can be consumed quickly when Codex is asked to perform broad repository archaeology, architecture rediscovery, full validation, deployment polling, QA, documentation, and coding inside the same task.

A local Codex environment using Ollama + `gpt-oss:20b` is available and should be used to shift routine implementation away from hosted usage without weakening Carez architecture, tenant isolation, lineage, validation, or release discipline.

The prior root `AGENTS.md` also contained stale UI guidance that conflicted with ADR-015/ADR-016, including the superseded permanent global desktop left rail and light presentation direction. Agent instructions must not force a coding executor to reconcile obsolete architecture before routine work.

Local inference also has a finite context budget. Loading broad overlapping documentation, repeatedly rereading unchanged files, or searching the full documentation tree for a bounded task can consume that budget without improving implementation quality. The repository must therefore make the minimum authoritative source set easy to identify.

## Decision

Carez adopts a local-first Codex execution model.

1. The owning ChatGPT Carez chat is the primary reasoning and coordination surface. It owns canonical-document review, repository inspection, task scoping, architecture/product decisions, QA coordination, deployment/release inspection, and documentation reconciliation.
2. Local Codex using Ollama + `gpt-oss:20b` is the default Codex executor for bounded implementation where approved behavior is already known.
3. Cloud Codex is reserved for difficult/high-risk work that materially benefits from stronger implementation reasoning or hosted tooling, including complex geometry/domain logic, RLS/security-sensitive work, complex migrations, concurrency/reconciliation, commercial lineage, difficult cross-file debugging, major refactors, and justified browser automation.
4. Each Codex task should normally have one coherent objective and a self-contained implementation packet. When the packet already defines approved behavior, Codex implements it rather than reopening Carez architecture unless contradictory repository evidence makes the implementation unsafe.
5. Local tasks follow a two-attempt stop rule: one implementation attempt, one focused correction using the exact failure, then stop and return evidence for re-scoping or cloud escalation.
6. Local validation is proportional to risk. GitHub Actions remains the comprehensive post-push validation path. Codex does not need to run the full production build for every localized change.
7. Codex normally stops after implementation, appropriate local validation, and push/checkpoint reporting. ChatGPT/connected tools own CI/Vercel/Supabase inspection, user-QA coordination, documentation reconciliation, and release management.
8. Before a task intended to use local inference, provider/model identity must be verified as local Ollama + `gpt-oss:20b` rather than assumed from prior sessions.
9. Permanent branches remain only `staging` and `main`; user QA remains on the single stable `staging` Vercel target.
10. Context is a constrained execution resource. Any local inference harness operating under this ADR must start from root `AGENTS.md` for coding-agent boundaries, then load only the canonical sources required by the bounded task. It must not preload the full documentation set or broaden into unrelated documentation archaeology by default.

The detailed operating procedure is canonical in `docs/workflow/CODEX_EXECUTION_WORKFLOW.md`. Task-based source selection is routed by `docs/README.md` and `docs/KNOWLEDGE_SOURCE_ROUTING.md`.

## Context-budget discipline

These rules apply to local inference regardless of the client or harness used to invoke the local model; they do not change local Codex as the currently approved default code executor.

- For coding work, read root `AGENTS.md` first and treat it as the compact execution boundary.
- If the user or implementation packet names specific source files, read those files and the directly relevant implementation. Do not expand the source set unless a contradiction, missing dependency, or safety question requires it.
- Read `CURRENT_STATE.md` and `ROADMAP.md` only when current implementation status or priority materially affects the task.
- Read `BRANCH_AND_RELEASE_MODEL.md` only when branch, deployment, QA-target, or promotion behavior matters.
- Read a module spec and relevant ADRs only when product/domain/architecture interpretation is needed; a bounded approved implementation packet does not require a fresh architecture audit.
- Do not recursively grep or glob the entire `docs/` tree when the owning source is already known.
- Do not reread unchanged documents merely to restate conclusions already established in the same task.
- Supporting and superseded documents are read on demand only, according to `DOCUMENT_STATUS.md`; they are not normal implementation context.
- If a bounded local task is approaching context limits primarily because of source retrieval, reduce unnecessary context before increasing the model context window.

## Consequences

### Positive

- Hosted Codex usage is concentrated on genuinely difficult work.
- Local inference handles routine coding and repetitive conversions.
- Coding tasks start with smaller, higher-quality context.
- Product decisions remain in canonical docs and owning chats rather than becoming accidental agent-thread memory.
- GitHub Actions performs comprehensive validation once after push instead of forcing repeated full builds in every task.
- Long-running coding tasks are less likely to hang on deployment polling, repository archaeology, or unrelated analysis.
- Local model context is spent on the bounded problem and relevant implementation rather than duplicated governance text.

### Tradeoffs

- Local `gpt-oss:20b` may require more explicit implementation packets than stronger hosted models.
- Some problems will still need cloud escalation.
- A local task can be computationally inexpensive in hosted-usage terms while still wasting human time if allowed to retry indefinitely; the two-attempt rule is therefore mandatory for bounded failures.
- Provider identity must be checked before local work to avoid accidental hosted execution.
- Read-on-demand retrieval requires the documentation index and status registry to stay accurate.

## Alternatives considered

### Use cloud Codex for all coding

Rejected because routine implementation unnecessarily consumes hosted usage and encourages broader agent tasks than needed.

### Use local Codex for all work, including architecture and high-risk debugging

Rejected because model capability should be matched to risk. Carez architecture, RLS, geometry, commercial lineage, migrations, and difficult debugging may justify stronger hosted execution.

### Keep long-lived coding threads for repository context

Rejected as the default because accumulated context increases noise and encourages unrelated work. Fresh bounded tasks are preferred; canonical repository docs preserve durable truth.

### Compensate for broad retrieval only by increasing the model context window

Rejected as the first response. A larger context window can be useful, but it should not mask avoidable duplication, broad archaeology, or poor source routing.

## Protected constraints

This ADR does not alter Carez product architecture. All existing architecture invariants remain in force, including Supabase/PostgreSQL authority, RLS/tenant isolation, server-authoritative calculations, immutable/versioned records, Takeoff vector-geometry authority, Condition/estimate lineage, Production Quantity/Direct Cost/Sell separation, ADR-015/ADR-016 UI authority, and the `staging`/`main` release model.
