# Module Spec — Takeoff

Status: active flagship workstation

## Purpose
Convert plan geometry into authoritative physical measurements with exact lineage into estimating.

## Core workflow
Plans → calibrate/verify scale → select assembly/method → measure/edit → resolve holds → worksheet review → estimate outputs.

## Invariants
- PDF is visual reference; stable page-coordinate vector geometry is authoritative.
- Deterministic calculations and persisted geometry.
- Persistent undo/redo.
- Cutouts/holes, arcs, editing, duplication, calibration, and quantity worksheet preserve lineage.
- Geometry may save when downstream component assumptions are missing; dependent outputs become explicit holds.
- Permanent resizable bottom quantity/estimate worksheet on desktop.

## Drawing interaction contract
- Saved Takeoff geometry remains the dominant visual element on the plan.
- Floating measurement detail is transient and hover-driven: no persistent measurement banner is pinned to the drawing merely because a Takeoff is selected.
- Hovering directly over saved LF, SF, or EA Takeoff geometry may show a compact estimator detail card with measurement name, quantity/unit, assembly, selected key physical properties, a small number of important derived outputs, and hold/status summary.
- Moving the pointer off the geometry hides the hover card. Selection styling and Edit handles may remain without pinning the card.
- Persistent selected-object detail belongs in the right Inspector and Quantity Worksheet rather than an oversized drawing overlay.
- Hover/detail presentation must never mutate normalized page-coordinate geometry, calibration, persisted measurement data, or Takeoff → assembly → estimate lineage.

## Inputs
Plans/sheets, calibration, measurement geometry, published assembly version, verified method profile, declared estimator inputs.

## Outputs
Measurements, derived quantities, assembly outputs, holds, estimate-item lineage.

## Current foundation
P0 geometry/editor/atomic recalculation foundation is implemented. Additional B2 workstation work exists. Fresh authenticated/browser acceptance remains required for current staging behavior.

## Deferred/next
Multi-select, whole-object pointer movement, clipboard, layers, snapping, revision overlay/migration, thumbnails/batch sheet operations, assisted plan intelligence.