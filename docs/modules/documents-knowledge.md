# Module Spec — Documents / Search / Knowledge

Status: P6 target

## Purpose
Provide one evidence-backed document and retrieval system across the persistent Job Spine, Opportunities, Estimates, Proposals, Accepted Scope Snapshots, Projects, purchasing, billing, and field execution.

## Core model
- A document may link to the Job Spine and multiple phase-specific business entities without requiring duplicate uploads.
- Drawings separate logical sheet identity from exact uploaded revision.
- Accepted Scope Snapshot items retain the exact document/drawing revision and Takeoff evidence used for award where applicable; later revisions never overwrite that reference.
- Search spans drawings, specifications, RFIs, estimates, proposals, POs, bills, changes, photos, and related records.

## Invariants
- Source documents remain immutable evidence.
- Opportunity and Project remain distinct document-link targets beneath the same Job Spine.
- Extracted/AI-derived facts retain page/region/source evidence.
- AI-derived metadata never silently overwrites the source document.
- Revision history and entity linkage remain traceable.

