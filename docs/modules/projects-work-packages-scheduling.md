# Module Spec — Projects / Work Packages / Scheduling

Status: P3 target

## Purpose
Translate an awarded/frozen commercial baseline into concrete execution units and scheduled operations.

## Operating model
Project → Work Package → Operation → Schedule → Crew/Field → Production → Cost/Forecast.

## Work package contents
Scope, frozen budget allocation, drawings/revisions, operations, readiness constraints, crew needs, production targets, material needs, pour linkage, inspections, notes, photos, and cost/forecast lineage.

## Scheduling
Operations expose readiness and constraint state. Use READY / AT RISK / BLOCKED where useful. Schedule changes must not silently rewrite frozen commercial baselines.

## Invariants
- Award/frozen budget is the lineage source.
- Work packages represent physical execution scope, not generic task containers.
- Production and cost actuals trace back through operation/work package to the awarded estimate baseline.
