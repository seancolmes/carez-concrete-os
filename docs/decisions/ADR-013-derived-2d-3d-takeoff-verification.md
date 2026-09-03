# ADR-013 — Derived 2D/3D Takeoff Verification

Status: Accepted  
Date: 2026-09-03

## Context

Concrete estimators make quantity decisions from 2D drawings, but plan-only review can hide wrong elevations, missing height/depth, disconnected walls, duplicate overlaps, incorrect step geometry, and missed openings. HAQQ Takeoff demonstrates useful concrete-specific behavior: the same takeoff can be viewed in 2D and 3D, plan inputs drive color/elevation/shape, and selection/property changes remain synchronized.

Carez needs the quality-control benefit without creating a separate BIM model, a competing quantity source, or a second editing engine.

## Decision

### Authority

Persisted normalized 2D/vector plan geometry remains Takeoff geometry authority.

The 3D scene is a deterministic projection of:

- the same Takeoff measurement IDs and geometry;
- their measurement roles;
- the selected Project Concrete Condition version;
- typed dimensions/profile;
- elevation value and reference;
- holes/openings;
- segment/step metadata.

A mesh, scene node, or rendered solid never becomes an independent quantity record. No quantity may be created solely because a 3D renderer produced a volume or surface area.

### Synchronized views

The drawing workspace exposes:

- **2D** — authoritative plan drawing/editing;
- **3D** — derived concrete verification;
- **Split** — synchronized 2D and 3D review.

Selection, Condition color, visibility, filters, grouping, zones, and review state synchronize by stable domain IDs. Selecting a Condition, measurement, output, or 3D object highlights the corresponding representations and worksheet rows.

### Required dimensional contract

A 3D-capable Condition declares the minimum fields needed for a deterministic solid:

- shape/profile;
- width, depth, height, thickness, or diameter as applicable;
- elevation value;
- elevation reference: top, bottom, or centerline;
- extrusion/sweep direction;
- segment elevation/profile overrides for steps or transitions;
- holes/openings where applicable.

Missing required dimensions do not invent geometry. The affected object remains visible as a 2D measurement with a clear **3D input required** hold.

### Initial derivation rules

| Concrete family | Derived representation |
| --- | --- |
| Slab / mat / paving | Polygon extruded by thickness at governed elevation; cutouts subtract |
| Strip footing / grade beam | Rectangular or governed profile swept along run geometry |
| Wall | Wall profile swept along run; governed openings subtract |
| Pad footing | Shape/profile extruded at each count/location |
| Pier / column | Governed round, rectangular, or supported custom profile at each location |
| Thickened edge / curb | Governed section swept along its measurement role |
| Step / transition | Segment-level profile/elevation transition linked to the same parent Condition |

The same Condition algorithms that calculate outputs supply dimensional facts to the projection service. Quantity math is not reimplemented in the graphics client.

### Quality-control checks

The derived view may flag:

- missing elevation, height, thickness, depth, or profile;
- overlapping duplicate solids;
- unexpected gaps/disconnections;
- floating or implausibly offset elements;
- conflicting top/bottom elevation relationships;
- cutout/opening inconsistencies;
- stepped-run discontinuities;
- revision-to-revision spatial changes.

Flags are review evidence, not automatic scope changes. An estimator confirms corrections.

### Editing phases

1. **Phase A — Read-only verification:** orbit/pan/zoom, synchronized selection, colors, filters, isolate/hide, section/level filters, issue list, and click-through to Condition Properties.
2. **Phase B — Controlled property editing:** edit governed dimensions, elevation, elevation reference, profile, and supported module properties from the 3D selection. The edit updates the same Condition/measurement command path and undo history as 2D.
3. **Phase C — Optional 3D geometry editing:** only after vertex/segment commands, snapping, validation, persistence, undo/redo, collaboration, and lineage have proven parity with 2D.

Carez does not begin with freeform 3D modeling.

### Reinforcing

Reinforcing quantities remain deterministic Condition-module outputs. A future rebar preview may visualize governed bars, mats, dowels, cages, spacing, hooks, and lap assumptions, but it must be labeled as estimating visualization—not structural engineering or fabrication authority—unless a separately approved engineering-grade workflow exists.

### Revision and commercial lineage

3D projection is revision-aware. It may compare current and prior authorized drawing/Condition versions, but it never mutates prior geometry, issued proposals, Accepted Scope Snapshots, or frozen commercial baselines.

## Rationale

A shared-ID derived projection provides visual error detection without introducing two truths. Beginning read-only keeps the initial risk bounded and lets Carez prove usefulness, performance, and quantity reconciliation before enabling more powerful editing.

## Consequences

- 3D becomes an estimator quality-control feature, not a presentation gimmick.
- All view modes reconcile to one measurement/output total.
- Conditions require explicit elevation semantics.
- Rendering technology is an implementation choice; the domain contract must not depend on a specific graphics library.
- Large-plan performance, object picking, mesh generation, accessibility, and fallback behavior require representative browser verification.

## Protected invariants

This decision does not change 2D/vector geometry authority, calculation authority, RLS, tenant isolation, immutable versioning, accepted-scope rules, or human approval boundaries.

## Canonical owners

- docs/ARCHITECTURE.md
- docs/modules/takeoff.md
- docs/concrete-condition-3d-workstation-target.md
