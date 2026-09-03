# Module Spec — Takeoff

Status: active flagship workstation

## Purpose
Convert plan geometry into authoritative physical measurements with exact lineage into estimating.

## Core workflow
Plans → calibrate/verify scale → select published company Scope Recipe + Project Scope Variant → measure/edit → resolve holds → worksheet review → estimate outputs.

## Invariants
- PDF is visual reference; stable page-coordinate vector geometry is authoritative.
- Deterministic calculations and persisted geometry.
- Persistent undo/redo.
- Cutouts/holes, arcs, editing, duplication, calibration, and quantity worksheet preserve lineage.
- Geometry may save when downstream assumptions are missing; dependent outputs become explicit holds.
- Permanent resizable bottom Quantity Worksheet on desktop.
- Quantity Worksheet column boundaries are independently horizontally resizable; useful widths may persist locally.
- Takeoff consumes published company-owned Scope Recipes; recipe draft/version/resource/formula authority remains owned by the Assembly & Resource Engine.
- The Takeoff Inspector remains focused on selected measurement, Project Scope Variant/job inputs, holds, key outputs, and recipe commands. It is not the full recipe editor.
- Primary recipe authoring remains on the same Takeoff route through a movable/resizable popup Recipe Editor over the live plan.
- The popup does not replace the permanent Quantity Worksheet during normal authoring.
- Focus Builder maximizes the same Recipe Editor; Restore returns to its prior position/size and drawing context.
- Accepted Scope Snapshots preserve the exact Takeoff measurement/output versions used by the awarded Proposal revision; later edits never mutate accepted scope.

## Scope Recipe selection and authoring boundary

- No hard-coded Carez production recipe is required for new Takeoff work.
- Only published company-owned Scope Recipe versions are selectable for production Takeoff.
- System Templates are not directly selectable; they must be copied into a company draft and published first.
- Historical measurements continue to reference the exact immutable recipe version they were created with even if retired from new work.
- The Inspector may expose actions such as Create Recipe, Start From Template, Edit Draft, Create Revision, Open Recipe Editor, and Return to Recipe Editor.
- Creating a new recipe may use a small movable setup dialog for identity and primary measurement type.
- Editing a published recipe creates a new draft revision.
- The Recipe Editor can be moved/resized so an estimator can uncover drawing details without leaving Takeoff.
- Focus Builder may occupy most of the workspace but remains the same editor state and route.

## Project Scope Variants

A **Project Scope Variant** is a takeoff-set-specific configuration of one published Scope Recipe. It exists for plan conditions such as `S1`, `S2`, `F1`, `F2`, or any estimator-defined variant.

A variant can resolve:

- plan facts such as thickness, width, depth, bar size/count/spacing, mats/layers, vapor requirement, finish, or detail-specific options;
- means/method decisions;
- production assumptions;
- commercial/waste assumptions where applicable.

Takeoff measurements may reference the exact verified variant record used when they were created. Changing governed variant values creates a new verified variant revision rather than silently changing historical measurements.

Legacy verified Build Method profiles remain traceable during transition and may continue under the compatibility model.

## Recipe Editor / plan state contract

Opening, moving, resizing, maximizing, restoring, or closing the Recipe Editor must not mutate geometry or discard drawing context.

Where valid, preserve current Takeoff set, active sheet/page, scale/calibration, viewport/zoom/pan, selected measurement, selected recipe/variant, and unsaved recipe draft state.

An eligible selected/current Takeoff measurement may be used as Test Bench input without retyping authoritative physical quantity.

## Measurement variables available to recipes

The geometry engine should expose deterministic measurement facts appropriate to Takeoff type rather than forcing manual recreation.

### Area / polygon
- net area;
- gross area before cutouts;
- cutout area;
- perimeter;
- cutout perimeter when available;
- deterministic segment/section counts when supported.

### Linear / polyline
- measured length;
- segment count.

### Count
- point/count quantity.

These are geometry-derived inputs, not separately entered commercial quantities.

## Sheet naming and indexing
- Imported PDF pages should be auto-named when reliable sheet metadata can be extracted from page text/title block.
- Persist recognized sheet number/title and prefer professional sheet labels over generic page numbers when reliable.
- Automatic naming never changes geometry, scale, recipe selection, quantities, commercial records, or plan-document authority.
- Prefer deterministic PDF text/title-block extraction before OCR/vision.
- Low-confidence extraction falls back safely.
- Existing explicit user metadata is not silently overwritten.
- Underlying PDF page number remains discoverable.

## Drawing interaction contract
- Saved Takeoff geometry remains the dominant visual element.
- Floating measurement detail is transient/hover-driven; no persistent oversized measurement banner.
- Hovering saved geometry may show measurement name, quantity/unit, recipe/variant, selected key physical properties, bounded important outputs, and hold/status summary.
- Moving off geometry hides the hover card.
- Persistent selected-object detail belongs in the Inspector/Quantity Worksheet.
- Hover/detail presentation never mutates geometry, calibration, or lineage.

## Workstation information hierarchy and declutter contract
- Visual priority is `Plan / geometry → active takeoff decision → quantity / hold state`.
- Persistent text must identify an object, communicate actionable/current state/problem, or enable a decision.
- Recipe provenance remains persisted but belongs in contextual audit/detail surfaces, not permanent narration.
- Avoid duplicate selected-recipe cards/helper explanations.
- Sheet pane remains a quiet resizable document navigator.
- Scale state/actions stay in drawing status/toolbar and Properties scale controls.
- The Quantity Worksheet remains a dense estimator grid with user-resizable columns.
- Do not duplicate Snap/Ortho/tool state across chrome.
- Minimize stacked horizontal chrome above the drawing.
- Declutter/popup presentation changes do not change geometry authority, calibration, published recipe semantics, formulas, quantity outputs, pricing, RLS, tenant isolation, or Takeoff → estimate lineage.

## Inputs
Plans/sheets, calibration, measurement geometry, published Scope Recipe version, verified Project Scope Variant/legacy method profile, declared estimator inputs.

## Outputs
Measurements, derived geometry facts, recipe/resource outputs, holds, estimate-item lineage.

## Award and execution lineage
- Takeoff remains physical measurement authority; it does not infer what Proposal scope was accepted.
- Awarded physical scope enters execution through an immutable Accepted Scope Snapshot item or approved change-scope item.
- Production Work Units may partition authorized scope through versioned Scope Allocations rather than assuming one whole measurement equals one field work unit.
- Each allocation retains exact accepted measurement/output version, quantity, unit, and authorization source.

## Current foundation
P0 geometry/editor/atomic recalculation foundation is implemented. Additional B2 workstation and Assembly/Resource Engine UX is under staging acceptance.

The existing Build Plan Inspector/workbench is a job-specific verification surface. It is not the complete Scope Recipe editor. Its verified-profile persistence may be evolved compatibly into Project Scope Variants.

## Deferred/next
Multi-select, whole-object pointer movement, clipboard, layers, snapping, revision overlay/migration, thumbnails/batch sheet operations, assisted plan intelligence.
