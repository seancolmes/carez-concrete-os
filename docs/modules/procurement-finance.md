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

## V1 baseline persistence

Migration `20260926010000_job_spine_award_foundation.sql` provides the original frozen commercial baseline because the current source-controlled schema has no canonical accepted-scope baseline table to reuse. It is created transactionally from the immutable Accepted Scope Snapshot and records total Direct Cost and total Sell separately with exact revision provenance. Later scope changes must add new lineage; they do not edit this original baseline. Downstream procurement, Work Package budget allocation, and actual-cost integration remain separate work.

After Award, contracted scope or value changes append authorized commercial lineage/deltas. They do not create ordinary revisions of the awarded Proposal; that path awaits the dedicated Change Order or authorized-commercial-delta workflow.

