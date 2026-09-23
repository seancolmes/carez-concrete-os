---
name: carez-takeoff-change
description: Implement or review an actual Carez Takeoff or Concrete Condition change while preserving measurement authority, calculation lineage, workstation behavior, and 2D/3D boundaries. Use when the requested scope explicitly involves /takeoff, measurement geometry, calibration, Conditions, measurement roles, worksheet behavior, derived 3D, Takeoff outputs, Takeoff-to-estimate lineage, or legacy-to-Concrete-Condition migration. Do not select merely because Takeoff could exist somewhere upstream of an unrelated workflow.
---

# Carez Takeoff Change

Preserve Takeoff domain authority while changing only the requested slice.

## Workflow

1. Start with the named Takeoff target and direct persistence/calculation/UI dependencies only. Project instructions are already loaded; do not reread `AGENTS.md` or `CODEX.md`.
2. Classify the slice: geometry/editor, calibration, Concrete Condition, measurement role, worksheet, derived 3D, estimate lineage, or legacy migration.
3. Read the relevant ADR-020 section when the slice changes geometry/calibration, quantity authority, measurement roles, 2D/3D behavior, or when authority is ambiguous. Do not read the full ADR for a bounded presentation-only change.
4. Read the relevant `docs/modules/takeoff.md` section only when the task depends on module behavior or persisted Takeoff contracts.
5. Read `docs/ARCHITECTURE.md` only when the change actually crosses Takeoff into Estimate, award, Project, production, or accepted-scope lineage.
6. Implement the smallest coherent change while preserving the invariants below.
7. Run targeted domain tests plus the proportional validation already defined by `CODEX.md`.
8. For UI presentation changes, also use `carez-ui-implementation` without allowing presentation work to override Takeoff domain rules.

## Core invariants

- Persisted 2D/vector page geometry is quantity authority.
- 3D is a deterministic verification projection, never an independent quantity/commercial engine.
- Geometry/calibration remain deterministic across zoom/render changes.
- Missing dimensions/elevation create explicit holds; do not invent inputs.
- Concrete Conditions and measurement roles preserve version/provenance lineage.
- Production Quantity, Direct Cost, and Sell remain distinct.
- Human authority remains final for scope, means/methods, reinforcing, production rates, waste, pricing, margin, and commercial decisions.
- Referenced published/accepted legacy history is never silently deleted or rewritten.

## Progressive detail

Read `references/authority-map.md` before action only when the task affects quantity/calibration/measurement/2D-3D authority and the correct source set is not already clear, or when multiple authorities/cross-module lineage are involved. Do not load it for a bounded change whose owning files and authority are already explicit, a presentation-only change, or an interaction bug that does not question those authorities.
