# Carez Concrete OS — Agent Operating Rules

This repository is the canonical product and implementation source of truth for Carez Concrete OS.

## Execution rule

Follow `docs/workflow/CODEX_EXECUTION_WORKFLOW.md` and ADR-017.

Codex is a code executor, not the primary Carez product-reasoning, release-management, or documentation-coordination surface.

When a supplied implementation packet already defines approved behavior, implement that packet directly unless contradictory repository evidence makes the change unsafe. Do not reopen architecture merely to rediscover decisions already made.

Local Codex using Ollama + `gpt-oss:20b` is the default Codex execution path for bounded implementation. Cloud Codex is reserved for justified high-risk or difficult work.

Before a task intended to use local inference, verify that the active provider is local Ollama and the selected model is `gpt-oss:20b`.

## Read only what the task requires

Always honor repository canonical truth, but avoid broad archaeology for localized work.

Read the following when needed to execute safely:

- `docs/README.md` for source hierarchy;
- `docs/CURRENT_STATE.md` and `docs/ROADMAP.md` when current priority/state matters;
- `docs/BRANCH_AND_RELEASE_MODEL.md` for branch/release behavior;
- the applicable module spec and relevant ADRs when the task requires domain/architecture interpretation;
- existing implementation and migrations directly related to the requested change.

If the task is a bounded implementation with approved behavior already stated, do not independently audit unrelated modules or ADRs.

## Branch discipline

Permanent branches are only `staging` and `main`.

- `staging` is the development/integration/QA/user-acceptance line.
- `main` is production only.
- Routine approved work should use current `staging` when safe.
- Temporary branches are exceptional internal details for substantial/risky isolated work; start from current `staging`, merge into `staging`, and delete before user QA.
- Never use `main` to test speculative work.
- Nik tests only the stable staging Vercel URL defined in `docs/BRANCH_AND_RELEASE_MODEL.md`.

## Protected architecture invariants

- Carez is a concrete-specific operating system, not generic construction SaaS.
- PostgreSQL/Supabase is source of truth.
- Preserve RLS, tenant isolation, auditability, and safe source-controlled migrations.
- Preserve server-authoritative quantities, costs, pricing lineage, and financial values.
- Preserve immutable/versioned commercial records, published Company Condition Template versions, and referenced legacy assembly/recipe versions.
- Preserve the digital thread from opportunity/takeoff through estimate, proposal, award, project, production, and cost/forecast.
- Production Quantity, Direct Cost, and Sell remain distinct.
- PDF is visual reference; persisted stable page-coordinate 2D/vector geometry is Takeoff quantity authority.
- Concrete Condition/module outputs remain traceable to primary/secondary measurements and estimate lineage.
- Derived 3D is verification only and never a second quantity engine.
- Humans remain authoritative for scope, Conditions, templates/defaults, means/methods, reinforcing interpretation, production rates, pricing, margin, budgets, and approvals.

## Implementation rules

- Continue the existing modernization; do not restart it or redo verified work without evidence.
- Make the smallest coherent change that solves the bounded problem.
- Do not modify unrelated code.
- Protect domain, data, and commercial lineage.
- Use source-controlled Supabase migrations for schema/database behavior changes.
- Do not introduce a second client-side calculation engine that diverges from server/domain logic.
- Do not introduce microservices, Kubernetes, Kafka, or event sourcing without a demonstrated requirement.
- When local validation fails, allow one focused correction using the exact failure. After a second failed local attempt, stop and return evidence for re-scoping or cloud escalation.

## UI rules

ADR-015 is the Carez-wide dark shadcn presentation authority. ADR-016 owns the desktop shell.

- Desktop uses the compact top application header + animated global category navigation + module-specific contextual panes.
- The previous permanent global desktop left app rail is superseded and must not be reintroduced.
- Use the shared source-owned shadcn workspace and `docs/design-system/CAREZ_COMPONENT_PACK.md`.
- Do not revive B2/light styling, legacy route-local design systems, compatibility layers, alternate palettes, or parallel component libraries.
- Use normal sentence/title case for ordinary headings, statuses, actions, and helper text.
- A successful source change/build is not rendered UI acceptance; browser acceptance occurs separately on stable staging.

## Validation boundary

Run task-appropriate local validation, not automatically the full repository build for every small change.

Typical guidance:

- small/localized edit: targeted test or typecheck as appropriate;
- normal implementation: typecheck plus relevant targeted tests;
- high-risk domain change: typecheck plus relevant domain tests and any additional focused validation required by the invariant.

GitHub Actions is the comprehensive post-push validation path. Codex should normally stop after implementation, appropriate local validation, and checkpoint reporting rather than polling Vercel or performing release management.

## Completion report

Report only what is needed to hand work back cleanly:

- files changed;
- concise implementation summary;
- validation run/results;
- commit SHA when committed/pushed;
- unresolved failure/risk, if any.

Then stop.

## Documentation rule

Chats and Codex threads are not canonical architecture. Significant approved decisions are promoted through `docs/workflow/APPROVAL_TO_DOCUMENTATION.md`. Routine coding tasks should not update unrelated documentation unless the implementation packet explicitly includes a documentation change.
