# Carez Concrete OS — Agent Operating Rules

This repository is the canonical product and implementation source of truth for Carez Concrete OS.

## Read before changing code

1. Read `docs/README.md`.
2. Read `docs/CURRENT_STATE.md`.
3. Read `docs/BRANCH_AND_RELEASE_MODEL.md`.
4. Read the applicable file under `docs/modules/`.
5. Read relevant ADRs under `docs/decisions/`.
6. Inspect the existing implementation and migrations.
7. Reproduce the problem before changing code.

## Branch / test discipline

Permanent branches are only `staging` and `main`.

- `staging` is the single development/integration/QA/user-acceptance line.
- `main` is production only.
- Nik tests only the stable staging Vercel URL defined in `docs/BRANCH_AND_RELEASE_MODEL.md`.
- Never ask Nik to choose among feature branches, PR previews, commit-specific links, or alternate Vercel deployments.
- Do not create long-lived module/feature/QA/archive/governance branches.
- A temporary branch is allowed only when technically necessary; it must start from current staging, remain internal, merge into staging, and be deleted before user browser QA.
- Git history, issues, PRs, ADRs, module specs, tags, and releases preserve history; stale branches are not archives.

## Architecture invariants

- Concrete-specific operating system, not generic construction SaaS.
- Preserve the digital thread: Job Spine → Opportunity/ITB → Takeoff → Estimate Revision → Proposal Revision → Award Decision → Accepted Scope Snapshot → Frozen Commercial Baseline/Budget → Project → Work Package → Operation → Production Work Unit → Versioned Scope Allocation → Schedule/Readiness → Assignment → Timecard + Actual Work Context → Completion/Production Evidence → Cost/Forecast.
- Opportunity and Project remain distinct phase records linked by the persistent Job Spine; award never mutates one entity into the other.
- Constraint, Blocker Event, Timecard, Actual Work Context, Completion Evidence, and Production Evidence remain separate, linked records.
- PostgreSQL/Supabase is the source of truth.
- Prefer a modular monolith.
- Server-authoritative calculations for quantities, costs, pricing lineage, and financial values.
- Preserve RLS, tenant isolation, auditability, immutable/versioned commercial records, and safe migrations.
- Published Company Condition Template versions and all referenced legacy assembly/recipe versions are immutable.
- The primary daily Takeoff object is a Concrete Condition with typed concrete modules; normal Takeoff must not require Formula Composer.
- One primary and optional secondary measurement roles remain independently persisted and traceable to the same Condition.
- Persisted normalized 2D/vector geometry remains quantity authority; 3D is a synchronized derived verification view and never a second quantity engine.
- Production Quantity, Direct Cost, and Sell remain distinct.
- PDF is visual reference; stable page-coordinate vector geometry is authoritative for Takeoff.
- AI assists setup, recognition, retrieval, repetition, comparison, and QA. Humans remain authoritative for scope, Conditions, company templates/defaults, means/methods, reinforcing interpretation, production rates, pricing, margin, budgets, and approvals.

## Implementation rules

- Continue the existing modernization; do not restart it or redo completed P0 work without evidence.
- Make the smallest coherent change that solves the confirmed problem.
- Do not modify unrelated code.
- Protect domain and data lineage.
- Migrate the legacy recipe/formula workflow additively: prove Condition parity and reconcile references before retiring UI; never delete published/accepted history.
- Use source-controlled Supabase migrations for schema or database behavior changes.
- Do not create a second client-side calculation engine that diverges from server/domain logic.
- Do not introduce microservices, Kubernetes, Kafka, or event sourcing without a demonstrated requirement.

## UI / writing rules

Rendered behavior is authoritative for UI acceptance.

For UI work: reproduce in browser, implement the smallest fix, run relevant tests/typecheck/build, then browser-verify on the stable staging URL.

Carez uses normal sentence/title case for ordinary UI headings, statuses, actions, and helper text. Do not default to ALL CAPS. Uppercase is reserved for true codes/acronyms or source-document text where it materially belongs.

Do not claim a browser defect is fixed from source inspection or build success alone.

Desktop shell invariant at desktop width:

```text
OPEN:   [ permanent app rail ][ context drawer ][ workspace ]
CLOSED: [ permanent app rail ][ workspace ]
```

Only the context drawer may be transient.

The estimator workstation follows the approved light, modern, minimal, readable Condition layout: permanent rail; resizable Plans/Conditions/Zones pane; dominant 2D/3D/Split drawing surface; one dockable/floatable/resizable Condition Properties window; and permanent resizable Quantity/Estimate Worksheet. Avoid tiny text, cramped chrome, decorative card walls, and uncontrolled overlapping dialogs.

## Required implementation report

Report observed evidence, confirmed root cause, files changed, implemented fix, tests/typecheck/build, browser verification, remaining risks, and the staging checkpoint.

## Documentation rule

Chats and experiments are not canonical architecture. When a product, UX, domain, or architecture decision is approved, update the applicable canonical document in the same workstream. Follow `docs/workflow/APPROVAL_TO_DOCUMENTATION.md`.
