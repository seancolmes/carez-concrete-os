---
name: carez-takeoff-change
description: Implement or review Carez Takeoff and Concrete Condition changes while preserving measurement authority, calculation lineage, workstation behavior, and 2D/3D boundaries. Use for `/takeoff`, measurement geometry, calibration, Conditions, roles, worksheet, derived 3D, Takeoff outputs, estimate lineage, or legacy-to-Concrete-Condition migration work. Load only the Takeoff authority needed for the requested slice and never invent dimensions, methods, reinforcing, production rates, pricing, or commercial decisions.
---

# Carez Takeoff Change

Preserve Takeoff domain authority while changing only the requested slice.

## Workflow

1. Read `AGENTS.md`, `CODEX.md`, `docs/decisions/ADR-020-integrated-takeoff-workstation-and-precision-cursor.md`, and `docs/modules/takeoff.md`.
2. Read `docs/ARCHITECTURE.md` only when the change crosses Takeoff into Estimate, award, Project, production, or accepted-scope lineage.
3. Classify the change: geometry/editor, Concrete Condition, measurement role, worksheet, derived 3D, estimate lineage, or legacy migration.
4. Trace only the direct persistence/calculation/UI path for that slice.
5. Implement the smallest coherent change while preserving the invariants below.
6. Run targeted domain tests plus the normal validation from `CODEX.md`.
7. For UI-only presentation changes, also invoke/use `carez-ui-implementation` without allowing presentation work to override Takeoff domain rules.

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

Read `references/authority-map.md` only when deciding which Takeoff authority applies to a mixed or ambiguous change.
