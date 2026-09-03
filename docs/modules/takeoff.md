# Module Spec — Takeoff

Status: active flagship workstation

## Purpose
Convert plan geometry into authoritative physical measurements with exact lineage into estimating.

## Core workflow
Plans → calibrate/verify scale → select published company assembly/method → measure/edit → resolve holds → worksheet review → estimate outputs.

## Invariants
- PDF is visual reference; stable page-coordinate vector geometry is authoritative.
- Deterministic calculations and persisted geometry.
- Persistent undo/redo.
- Cutouts/holes, arcs, editing, duplication, calibration, and quantity worksheet preserve lineage.
- Geometry may save when downstream component assumptions are missing; dependent outputs become explicit holds.
- Permanent resizable bottom quantity/estimate worksheet on desktop.
- Takeoff consumes published company-owned assemblies; assembly draft/version/resource/formula authority remains owned by the Assembly & Resource Engine.
- The Takeoff Inspector remains focused on the selected measurement, job-specific method/profile inputs, holds, key outputs, and assembly commands. It must not become a long-form assembly builder.
- Primary assembly authoring remains inside the Takeoff workstation through a dedicated resizable Assembly Builder composer, normally expanding from the permanent bottom worksheet/workstation region so the live plan remains in context.
- The Assembly Builder is not a separate browser window, separate application route, or disconnected full-page studio.
- Complex assemblies may use Focus Builder, which temporarily expands the same integrated composer while preserving Takeoff sheet, viewport, zoom/pan, selection, calibration context, and draft state. Exiting focus returns to the prior drawing state.
- Accepted Scope Snapshots preserve the exact Takeoff measurement/output versions used by the awarded Proposal revision; later Takeoff edits or revisions never mutate accepted scope.

## Assembly selection and authoring boundary

- No hard-coded Carez production assembly is required for new Takeoff work.
- Only published company-owned assemblies are selectable for production Takeoff.
- System templates are not selectable directly; they must first be copied into a company-owned draft and published through the integrated Assembly Builder.
- Historical measurements continue to reference the exact immutable assembly version they were created with, even if that version is later retired/hidden from new selection.
- The Inspector may expose lightweight actions such as Create Assembly, Start From Template, Edit Draft, Create Revision, Open Builder, and Return to Builder when authorized.
- Creating a new assembly may use a small setup dialog for assembly identity and takeoff measurement type, after which authoring occurs in the integrated builder.
- Editing a published assembly always creates a new draft revision; published versions remain immutable.
- Builder mode may reduce the visible plan height while open but must preserve enough drawing context for the estimator to understand and test the assembly against the current Takeoff.
- Focus Builder may temporarily occupy most of the Takeoff workspace, but it remains the same builder state and same Takeoff route rather than a second authoring experience.

## Builder/plan state contract

Entering normal Assembly Builder mode or Focus Builder must not mutate Takeoff geometry or discard drawing context.

Where valid, preserve:

- current Takeoff set;
- active sheet/page;
- scale/calibration context;
- plan viewport and zoom/pan state;
- selected measurement;
- selected assembly and method/profile context;
- unsaved assembly draft state.

An eligible selected/current Takeoff measurement may be used as Test Bench input so the estimator can validate assembly outputs against real plan geometry without retyping the authoritative physical quantity.

## Sheet naming and indexing
- Imported PDF pages should be auto-named when reliable sheet metadata can be extracted from the page text/title block.
- Persist the recognized sheet number and sheet title in `takeoff_sheets.sheet_number` and `title`; the left sheet pane should prefer a professional label such as `S100.4 — Foundation Framing Plan` over generic `PDF Page 4` when metadata exists.
- Automatic naming is low-risk clerical/indexing assistance. It must never change measurement geometry, scale/calibration, assembly selection, quantities, commercial records, or plan-document authority.
- Prefer deterministic PDF text/title-block extraction before OCR/vision. A likely title-block region may be prioritized, with whole-page text as a fallback when needed.
- Low-confidence or incomplete extraction must fall back safely to the existing page-number label rather than inventing metadata.
- Existing non-empty user/accepted sheet metadata must not be silently overwritten by a later automatic naming pass. Re-running automatic naming may fill unresolved/generic pages but must preserve explicit user corrections.
- The estimator must remain able to identify the underlying PDF page number even when a sheet number/title is shown.

## Drawing interaction contract
- Saved Takeoff geometry remains the dominant visual element on the plan.
- Floating measurement detail is transient and hover-driven: no persistent measurement banner is pinned to the drawing merely because a Takeoff is selected.
- Hovering directly over saved LF, SF, or EA Takeoff geometry may show a compact estimator detail card with measurement name, quantity/unit, assembly, selected key physical properties, a small number of important derived outputs, and hold/status summary.
- Moving the pointer off the geometry hides the hover card. Selection styling and Edit handles may remain without pinning the card.
- Persistent selected-object detail belongs in the right Inspector and Quantity Worksheet rather than an oversized drawing overlay.
- Hover/detail presentation must never mutate normalized page-coordinate geometry, calibration, persisted measurement data, or Takeoff → assembly → estimate lineage.

## Workstation information hierarchy and declutter contract
- The visual priority is `Plan / geometry → active takeoff decision → quantity / hold state`. Persistent UI must not compete with the drawing without an operational reason.
- Persistent text should identify an object, communicate current state or a problem, or enable a current estimator decision. Explanatory narration, provenance paragraphs, duplicate selection summaries, and repeated zero-state metadata should not occupy permanent workstation space.
- Assembly provenance such as `source_label`, `source_reference`, and version lineage remains persisted and auditable but is not shown as an always-visible Inspector card. Provenance belongs in contextual detail/audit surfaces when needed.
- The Takeoffs tab should present one compact assembly-selection surface, search, and the current-sheet measurement list. Do not repeat the selected assembly again in a separate persistent `Active Assembly` card when selection state is already clear.
- Helper copy such as explanations of what a concrete assembly is should be omitted from the normal dense workstation. Use progressive disclosure/tooltips only when needed.
- The desktop sheet pane is a quiet, resizable document navigator. Each row should present the page/sheet identity only; do not repeat scale state, scale-region counts, `0 TAKEOFFS`, takeoff counts, warning boxes, or red status borders in sheet rows. Scale state and scale actions belong in the drawing status/toolbar and Properties scale controls where they are actionable. Resizing uses the sheet/Inspector vertical boundaries and must preserve a usable minimum drawing workspace.
- Persistent status/chrome must not duplicate the same Snap/Ortho/tool state in multiple locations. Keyboard help belongs in contextual help/shortcuts rather than a long always-visible instruction string.
- The Takeoff page should minimize stacked horizontal chrome above the drawing. Project/module identity, takeoff-set identity, and drawing tools remain necessary, but redundant header bands should be consolidated where possible without removing the permanent app rail or project/module navigation contract.
- Declutter work is presentation-only unless separately approved. It must not change geometry authority, calibration, published assembly selection semantics, deterministic formulas, quantity outputs, pricing, RLS, tenant isolation, or Takeoff → estimate lineage.

## Inputs
Plans/sheets, calibration, measurement geometry, published company assembly version, verified method profile, declared estimator inputs.

## Outputs
Measurements, derived quantities, assembly/resource outputs, holds, estimate-item lineage.

## Award and execution lineage

- Takeoff remains the physical measurement authority; it does not infer which proposal alternates or negotiated scope the customer accepted.
- Awarded physical scope enters execution only through an immutable Accepted Scope Snapshot item or a later approved change-scope item.
- A Production Work Unit may partition that authorized scope through one or more versioned Scope Allocations rather than assuming one whole Takeoff measurement equals one field work unit.
- Every Scope Allocation retains the exact accepted Takeoff measurement/output version, quantity, unit, and authorization source. Allocation revision never edits the accepted Takeoff quantity in place.

## Current foundation
P0 geometry/editor/atomic recalculation foundation is implemented. Additional B2 workstation work exists. Fresh authenticated/browser acceptance remains required for current staging behavior.

The current Build Plan Inspector/workbench is a job-specific method verification surface for existing assemblies. It is not the approved drag-and-drop Assembly Builder and should not be treated as satisfying the integrated Assembly Builder/Focus Builder contract.

## Deferred/next
Multi-select, whole-object pointer movement, clipboard, layers, snapping, revision overlay/migration, thumbnails/batch sheet operations, assisted plan intelligence.
