# ADR-005 — PDF as Visual Reference, Vector Geometry as Measurement Authority

Status: Accepted

## Decision
Takeoff measurements are stored and edited as stable normalized/vector page-coordinate geometry. The PDF renderer is a visual reference, not the authoritative measurement model.

## Rationale
Measurement geometry must survive zoom, viewport, renderer, and display changes while remaining deterministic and editable.

## Consequences
- Calibration and derived quantities operate against stable page coordinates.
- Geometry validation occurs before persistence.
- Undo/redo and editing operate on persisted domain geometry.
- PDF/vector snapping and AI suggestions may assist geometry creation but do not replace the authoritative stored geometry.
