# ADR-004 — Immutable Commercial Lineage

Status: Accepted
Updated: 2026-09-03

## Decision
Issued and accepted commercial records preserve exact historical lineage. Customer acceptance creates an explicit immutable Accepted Scope Snapshot, and that snapshot—not the later mutable state of an Estimate or Proposal—becomes the source of the frozen commercial baseline/project budget.

## Canonical thread

```text
Job Spine
→ Takeoff Measurement / Output Version
→ Published Assembly Version
→ Deterministic Output
→ Estimate Item
→ Proposal Revision
→ Award Decision / Customer Acceptance
→ Accepted Scope Snapshot
→ Frozen Commercial Baseline / Budget
→ Work Package / Operation
→ Production Work Unit / Versioned Scope Allocation
→ Production Evidence / Actual / Forecast
```

## Consequences
- Published assembly versions are immutable.
- Accepted/issued commercial records are mutation-protected.
- The Accepted Scope Snapshot explicitly records accepted/rejected alternates, partial or negotiated scope, quantities, terms, clarifications, inclusions, exclusions, allowances, unit prices, Takeoff/assembly lineage, production/direct-cost/sell assumptions, and pricing provenance.
- Opportunity, Project, and other phase records remain distinct entities linked by the same Job Spine.
- The original commercial baseline is distinct from schedule and production-assumption baselines.
- Changes, forecast revisions, and actuals append new state rather than rewriting the original baseline.
- Later authorized scope reaches execution through versioned Scope Allocations sourced from approved change scope; it does not edit the accepted snapshot in place.
- Future estimate-to-actual learning may suggest improved assumptions but never rewrites historical estimates automatically.

## Related decisions

- ADR-007 — Persistent Job Spine Identity
- ADR-008 — Accepted Scope Snapshot and Frozen Commercial Baseline
- ADR-009 — Versioned Production Scope Allocation
- ADR-010 — Separate Field Truth and Production Evidence Records

