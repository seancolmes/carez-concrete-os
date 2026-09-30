# Plan 001: Give embedded Takeoff outputs stable identity

> Executor: Read the current working tree before editing. This plan was written at commit 4a0f104d while relevant files had uncommitted changes. Do not reset, stash, switch branches, commit, or overwrite that work. Stop if the cited current-state excerpts have changed materially.

## Status

- Priority: P1
- Effort: S
- Risk: Low; changing the selected projection can expose another missing-column or RLS error
- Depends on: none
- Category: correctness
- Confidence: High

## Why this matters

The recorded embedded Takeoff raised a duplicate React key warning for legacy:undefined. Nonunique keys can duplicate or omit historical output rows while the estimator is reviewing saved quantities and cost. The dedicated Takeoff route already selects the identity and labor fields expected by the recap, but the embedded route does not.

## Current state

- components/opportunities/views/TakeoffView.tsx:49-50 selects measurement_id, component_key, label, quantity/cost/status fields from takeoff_measurement_outputs but omits id, generated_estimate_item_id, baseline_man_hours_per_unit, and job_man_hours_per_unit.
- app/takeoff/[setId]/page.tsx:48-50 selects those four fields from the same source. It is the current projection exemplar.
- components/takeoff/IntegratedTakeoffConditionWorkspace.tsx:98-105 declares LegacyOutputRow.id and the labor assumptions; :615-616 constructs the historical row key from row.id; :753-755 renders the recap rows.

## Scope

In scope: the embedded Takeoff query in components/opportunities/views/TakeoffView.tsx and a meaningful regression check if the existing test harness can render two historical outputs.

Out of scope: Takeoff geometry, persistence schema, calculation formulas, generated estimate item semantics, 3D, published history, and unrelated Opportunity sections.

## Steps and gates

1. Align the embedded output projection with the dedicated route's current projection for identity and labor fields. Verify by reading both select lists side by side; every field consumed by LegacyOutputRow must be present.
2. Exercise an estimate with at least two active historical outputs through /opportunities?tab=takeoff. Confirm no duplicate-key console warning and two distinct recap rows. Also open /takeoff/[setId] and confirm the same output count. If there are no suitable records in the local QA profile, stop and report that the runtime gate is unverified; do not manufacture production data.
3. Run pnpm typecheck. Expected: exit 0. Inspect the final diff; expected: only the scoped projection (and a meaningful focused regression test if one was possible).

## Done criteria

- The embedded query selects stable output IDs and all recap-consumed fields.
- Two historical outputs render as distinct rows without the legacy:undefined warning.
- Embedded and dedicated routes agree on output count for the same set.
- pnpm typecheck passes and no unrelated source changes appear in the diff.

## Stop conditions

- Current query/recap shape differs from the excerpts above.
- The needed columns do not exist or the query returns a provider error.
- The correction requires changing persisted outputs, tenant isolation, or pricing calculations.

## Maintenance note

Future recap fields must be added to both projections or a deliberately shared typed projection; keep the current fix small.
