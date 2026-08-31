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

## Inputs
Plans/sheets, calibration, measurement geometry, published assembly version, verified method profile, declared estimator inputs.

## Outputs
Measurements, derived quantities, assembly outputs, holds, estimate-item lineage.

## Current foundation
P0 geometry/editor/atomic recalculation foundation is implemented. Additional B2 workstation work exists. Fresh authenticated/browser acceptance remains required for current staging behavior.

## Deferred/next
Multi-select, whole-object pointer movement, clipboard, layers, snapping, revision overlay/migration, thumbnails/batch sheet operations, assisted plan intelligence.
