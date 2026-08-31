# Module Spec — Documents / Search / Knowledge

Status: P6 target

## Purpose
Provide one evidence-backed document and retrieval system across opportunities, estimates, projects, purchasing, billing, and field execution.

## Core model
- A document may link to multiple business entities.
- Drawings separate logical sheet identity from exact uploaded revision.
- Search spans drawings, specifications, RFIs, estimates, proposals, POs, bills, changes, photos, and related records.

## Invariants
- Source documents remain immutable evidence.
- Extracted/AI-derived facts retain page/region/source evidence.
- AI-derived metadata never silently overwrites the source document.
- Revision history and entity linkage remain traceable.
