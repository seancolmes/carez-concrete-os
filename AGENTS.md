# Carez Concrete OS — Agent Operating Rules

This repository is the canonical product and implementation source of truth for Carez Concrete OS.

## Read before changing code

1. Read `docs/README.md`.
2. Read `docs/CURRENT_STATE.md`.
3. Read the applicable file under `docs/modules/`.
4. Read relevant ADRs under `docs/decisions/`.
5. Inspect the existing implementation and migrations.
6. Reproduce the problem before changing code.

## Architecture invariants

- Concrete-specific operating system, not generic construction SaaS.
- Preserve the digital thread: Job Spine → Opportunity/ITB → Takeoff → Estimate Revision → Proposal Revision → Award Decision → Accepted Scope Snapshot → Frozen Commercial Baseline/Budget → Project → Work Package → Operation → Production Work Unit → Versioned Scope Allocation → Schedule/Readiness → Assignment → Timecard + Actual Work Context → Completion/Production Evidence → Cost/Forecast.
- Opportunity and Project remain distinct phase records linked by the persistent Job Spine; award never mutates one entity into the other.
- Constraint, Blocker Event, Timecard, Actual Work Context, Completion Evidence, and Production Evidence remain separate, linked records.
- PostgreSQL/Supabase is the source of truth.
- Prefer a modular monolith.
- Server-authoritative calculations for quantities, costs, pricing lineage, and financial values.
- Preserve RLS, tenant isolation, auditability, immutable/versioned commercial records, and safe migrations.
- Published assembly versions are immutable.
- Production Quantity, Direct Cost, and Sell remain distinct.
- PDF is visual reference; stable page-coordinate vector geometry is authoritative for Takeoff.
- AI assists setup, recognition, retrieval, repetition, comparison, and QA. Humans remain authoritative for scope, assemblies, production rates, pricing, margin, budgets, and approvals.

## Implementation rules

- Continue the existing modernization; do not restart it or redo completed P0 work without evidence.
- Make the smallest coherent change that solves the confirmed problem.
- Do not modify unrelated code.
- Protect domain and data lineage.
- Use source-controlled Supabase migrations for schema or database behavior changes.
- Do not create a second client-side calculation engine that diverges from server/domain logic.
- Do not introduce microservices, Kubernetes, Kafka, or event sourcing without a demonstrated requirement.

## UI verification

Rendered behavior is authoritative for UI acceptance.

For UI work:
1. reproduce in a browser;
2. implement the smallest fix;
3. run relevant tests/typecheck/build;
4. browser-verify the exact acceptance behavior.

Do not claim a browser defect is fixed from source inspection or build success alone.

Desktop shell invariant at desktop width:

```text
OPEN:   [ permanent app rail ][ context drawer ][ workspace ]
CLOSED: [ permanent app rail ][ workspace ]
```

Only the context drawer may be transient.

## Required implementation report

For implementation/debugging work report:
- observed evidence;
- confirmed root cause;
- files changed;
- implemented fix;
- tests/typecheck/build performed;
- browser verification performed for UI changes;
- remaining risks;
- git status / resumable checkpoint.

## Documentation rule

Chats and experiments are not canonical architecture. When a product, UX, domain, or architecture decision is approved, update the applicable canonical document in the same workstream. Follow `docs/workflow/APPROVAL_TO_DOCUMENTATION.md`.

