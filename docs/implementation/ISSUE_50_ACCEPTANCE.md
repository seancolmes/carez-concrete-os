# Issue #50 — Condition-first Takeoff cutover acceptance

Accepted by Nik on authenticated stable `staging` browser QA on 2026-09-04 local time.

## Accepted behavior

- Build Plan / Build Method authoring is absent from the active Condition-first Takeoff workflow.
- Direct legacy assembly creation is absent from active Condition-first Takeoff.
- The legacy `Scope Recipes` launcher is absent from the Quantity Worksheet after fix `c9889f746f0ed6fad8a286b90f8c11456679afa8`.
- Remaining Condition-first cutover checks passed.
- The separate Assemblies destination under Estimating remains only as preserved compatibility/history and does not restore active legacy Takeoff authoring.

This acceptance satisfies the browser-verification gate for Issue #50. The issue is closed as completed.

This closes Issue #50's active-UI retirement scope. It does not authorize destructive deletion of historical assembly/formula/method/measurement/output/estimate lineage.
