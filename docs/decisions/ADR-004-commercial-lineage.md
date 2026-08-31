# ADR-004 — Immutable Commercial Lineage

Status: Accepted

## Decision
Accepted estimate/proposal records preserve exact historical lineage and become the basis of a frozen project budget rather than being silently mutated later.

## Canonical thread

```text
Takeoff Measurement
→ Published Assembly Version
→ Deterministic Output
→ Estimate Item
→ Proposal
→ Customer Acceptance
→ Frozen Budget
→ Work Package / Operation
→ Production / Actual / Forecast
```

## Consequences
- Published assembly versions are immutable.
- Accepted/issued commercial records are mutation-protected.
- Changes, forecast revisions, and actuals append new state rather than rewriting the original baseline.
- Future estimate-to-actual learning may suggest improved assumptions but never rewrites historical estimates automatically.
