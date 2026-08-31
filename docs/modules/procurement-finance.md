# Module Spec — Procurement / Finance / Changes / Billing

Status: P5 target

## Purpose
Give Carez operational financial control from project need through purchasing, commitments, actuals, changes, billing, and forecast.

## Core financial states
Budget, Committed, Actual, Forecast remain distinct and traceable.

## Procurement
Project/work-package need → requisition/quote → PO/subcontract → receipt/delivery → vendor bill → matching/cost actual.

## Changes and billing
Changes preserve the original frozen baseline, carry approval/status history, and flow into revised forecast/billing without mutating accepted historical records.

## Invariants
- Carez is not the statutory general ledger.
- Every project dollar should drill to a source transaction or explicit assumption.
- Financial calculations are server-authoritative.
- Supplier/vendor pricing and actual cost history may inform future estimates but never overwrite historical estimates automatically.
