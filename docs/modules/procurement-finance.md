# Module Spec — Procurement / Finance / Changes / Billing

Status: P5 target

## Purpose
Give Carez operational financial control on the persistent Job Spine from accepted project need through purchasing, commitments, actuals, changes, billing, and forecast.

## Core financial states
Budget, Committed, Actual, Forecast remain distinct and traceable.

## Procurement
Accepted Scope Snapshot / approved change scope → project/work-package need → requisition/quote → PO/subcontract → receipt/delivery → vendor bill → matching/cost actual.

Resource demand may be allocated and scheduled through Work Packages, Operations, and Production Work Units, but procurement records retain lineage to the exact accepted or later authorized scope source.

## Changes and billing
Changes preserve the immutable Accepted Scope Snapshot and original frozen commercial baseline, carry approval/status history, and flow into current authorized scope, revised forecast, and billing without mutating accepted historical records.

## Invariants
- Carez is not the statutory general ledger.
- Project financials remain linked to the same Job Spine as the Opportunity, Accepted Scope Snapshot, and Project without merging those entity identities.
- The original budget is derived from the Accepted Scope Snapshot, not from a later mutable estimate or current work-unit allocation state.
- Every project dollar should drill to a source transaction or explicit assumption.
- Financial calculations are server-authoritative.
- Supplier/vendor pricing and actual cost history may inform future estimates but never overwrite historical estimates automatically.

