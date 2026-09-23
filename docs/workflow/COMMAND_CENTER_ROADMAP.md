# Carez Command Center roadmap

This roadmap is for the Carez engineering Command Center. It is separate from the Carez product roadmap in `docs/ROADMAP.md`.

## Authority

The Command Center accelerates engineering work; it does not replace repository, product, database, release, or human authority.

Current owning contracts:

- `AGENTS.md`
- `CODEX.md`
- `docs/workflow/DEVELOPMENT_WORKFLOW.md`
- `docs/workflow/EXTERNAL_STATE_BOUNDARY.md`
- `docs/workflow/KNOWLEDGE_AND_OBSERVATION_BOUNDARY.md`
- `docs/workflow/COMMAND_CENTER_ORCHESTRATION.md`
- `docs/workflow/COMMAND_CENTER_MUTATION_GATE.md`
- `docs/workflow/COMMAND_CENTER_RUNTIME.md`

## Completed phases

### Phase 1-2 — Operating model and audit

Established the Command Center documentation model, authority boundaries, and repository/process audit.

**State: complete.**

### Phase 3 — Local execution policy

Established bounded local Codex execution, hooks/policy enforcement, progressive disclosure, and the rule that local in-progress work is not discarded to match remote state.

**State: complete.**

### Phase 4 — Specialist routing

Established bounded specialist routing for browser, database, design, and related investigations without recursive or unnecessary delegation.

**State: complete.**

### Phase 5 — Managed worktree boundary

Established worktree usage only for genuinely independent, risky, or long-running isolated work.

**State: complete.**

### Phase 6 — Behavioral confidence

Delivered routing, outcome, and execution evals so the Command Center is tested against expected behavior rather than trusted by prose alone.

**State: complete.**

### Phase 7 — External-state safety

Delivered:

- local/remote authority reconciliation;
- GitHub/Supabase/Vercel read-write separation;
- staging/production separation;
- external-state safety evals;
- release readiness versus publication authorization.

**State: complete and published.**

### Phase 8 — Knowledge and observation layer

Delivered:

- codebase-memory structural intelligence;
- ai-memory bounded durable work memory;
- BrowserSkill browser/runtime evidence;
- knowledge/observation authority contract;
- 18-case knowledge/observation safety eval;
- isolated eval execution that cannot pollute project memory;
- local runtime health checks;
- reconciled local-authority workflow and token/context routing.

**State: locally accepted; release batch not yet published.**

## Accepted remaining architecture

### Phase 9 — Bounded execution orchestration

**State: locally accepted.** Canonical Phase 9 orchestration eval: **12/12 PASS**, repository unchanged.

Goal: compose authoritative source, derived knowledge, memory, browser observation, and current remote READ evidence into one bounded execution plan without silently expanding action authority.

Required capabilities:

1. **Intent routing**
   - source question -> local source;
   - unknown ownership/call path -> codebase-memory then source verification;
   - interrupted work -> ai-memory then freshness/source reconciliation;
   - runtime symptom -> BrowserSkill then source verification;
   - current provider truth -> explicit provider READ under the external-state boundary.

2. **Evidence envelope**
   Every non-trivial orchestration result identifies:
   - source;
   - authority class;
   - environment;
   - scope;
   - freshness;
   - side-effect class;
   - provenance;
   - unresolved uncertainty.

3. **Read-only provider adapters**
   GitHub, Supabase, and Vercel reads remain separate from writes and are invoked only when current remote truth materially affects the task.

4. **No duplicate deployment path**
   Normal Vercel staging remains Git-driven.

5. **No database side channel**
   Source-controlled migrations remain the only Carez database-change authority.

6. **Execution-orchestration evals**
   Prove that mixed-source tasks choose the narrowest necessary evidence path and stop before unauthorized mutation.

Completion gate:

- orchestration contract source-controlled;
- orchestration evals green;
- Phase 7 external-state evals green;
- Phase 8 knowledge/observation evals green;
- local Command Center health PASS;
- canonical `pnpm check` PASS;
- no hidden provider writes.

### Phase 10 — Explicit mutation gate

**State: architecture locally accepted; provider-write capability remains disabled.** Canonical Phase 10 mutation-gate eval: **14/14 PASS**, repository unchanged.

Goal: define and, only when explicitly authorized in a later capability-enablement task, expose narrowly scoped WRITE operations without weakening Phase 7-9 boundaries.

The contract and eval architecture are implemented now. Completing Phase 10 architecture does **not** install or authorize a provider-write capability.

Mutation rules:

- READ and WRITE remain separate tools/capabilities.
- Every write requires explicit provider, target environment, and requested action.
- Staging authorization never implies production authorization.
- Production writes require explicit production-target authorization in the current task.
- Supabase writes require a source-controlled migration/change first.
- GitHub staging publication remains human-controlled through GitHub Desktop unless a specific alternate method is explicitly authorized.
- Normal Vercel staging deployment remains the existing Git integration; no second deploy trigger is added.
- Destructive repair, rollback, history rewrite, force push, branch deletion, migration repair, or production rollback requires explicit named authorization plus a recovery plan.
- Where supported, future write tools must expose preview/dry-run and auditable side effects.
- A successful release gate is readiness evidence, never write authorization.

Before any Phase 10 provider-write capability is enabled:

- extend the existing mutation evals for that exact provider operation;
- verify least-privilege credentials;
- verify staging/production identity;
- prove a dry-run/preview path where supported;
- prove failure and unknown-effect behavior;
- prove the capability cannot be invoked through a read-only route.

### Steady state

After Phase 10 architecture is accepted, the Command Center enters steady-state maintenance rather than accumulating more autonomous authority.

Steady-state responsibilities:

- keep local runtimes healthy;
- update tools deliberately rather than silently widening permissions;
- rerun the owning eval suite after material policy/tool changes;
- keep derived indexes rebuildable;
- keep memory non-authoritative;
- keep browser content untrusted;
- keep external reads sparse and purposeful;
- keep provider writes explicit and exceptional;
- preserve Nik as acceptance/release authority.

## Current next gate

The combined Phase 8-10 Command Center batch has passed local acceptance: Phase 7 regression **18/18**, Phase 8 **18/18**, Phase 9 **12/12**, Phase 10 **14/14**, strict Command Center health PASS, and canonical `pnpm check` PASS. The next gate is the normal GitHub Desktop **local commit only**, followed by release-readiness review before any push. Provider-write capability remains disabled until a later explicitly authorized enablement task.
