# ADR-023 — Physical Strip form resources

Status: Accepted  
Date: 2026-09-06  
Builds on: ADR-021, ADR-022

## Context

Strip / Wall Footing Contract v4 correctly derives End bulkheads / pour stops from authoritative run geometry, but the Forms module still inherits the older `Form material factor` input measured in LF/LF.

That factor multiplies already-known formed-edge geometry by an estimator-entered ratio. It is mathematically deterministic, but it does not identify the physical forming resource and forces the estimator to translate a construction choice into an abstract multiplier. This conflicts with the Assembly & Resource Engine rule that resources are first-class and that unknown resources are not hidden behind generic allowances.

The estimator already provides the authoritative footing run, footing depth, formed sides, bulkhead source/count, and form system. The remaining human decision for wood-lumber formwork is the physical board/course choice, not another measurement of footing length.

## Decision

### 1. Replace the normal LF/LF factor with a physical form-board choice

For the next immutable Strip / Wall Footing contract revision, the normal wood-lumber workflow no longer exposes `Form material factor`.

When `Track form material` is enabled and `Form system = Wood lumber`, the estimator selects the form board:

- 2x4
- 2x6
- 2x8
- 2x10
- 2x12
- Custom

`Custom` requires an explicit effective course height in inches. Standard choices use their nominal course heights (4, 6, 8, 10, or 12 inches). Carez does not choose a board size from footing depth; that remains a means-and-methods decision by the estimator.

### 2. Installed board LF is derived from authoritative geometry

For wood-lumber tracking, the server calculates:

- run formed edge LF = footing run LF × formed sides;
- bulkhead formed edge LF = approved bulkhead count × footing width;
- total formed edge LF = run formed edge LF + bulkhead formed edge LF;
- board courses = ceiling(footing depth inches ÷ selected effective course height inches);
- installed form-board LF = total formed edge LF × board courses.

The estimator never re-enters the footing LF. The authoritative Takeoff geometry remains the length basis.

### 3. Installed demand is not procurement

This contract calculates **installed form-board LF**. Stock length, cutting optimization, reusable inventory availability, purchasing allowance, and procurement pieces are separate logistics/procurement concerns and are not inferred from installed LF in this slice.

This preserves ADR-021's separation between installed production demand and procurement/logistics demand.

### 4. Do not fabricate LF for non-lumber systems

`forms.form_material_lf` becomes a wood-lumber installed-board output in the new contract. When the selected form system is `panel` or `other`, Carez does not fabricate a linear-foot material quantity from contact area.

Side and end/bulkhead contact area remain authoritative production facts for form labor and later panel/resource mapping. A future explicit panel/resource catalog may convert those physical facts into reusable panel demand, inventory readiness, or procurement without changing this contract's geometry authority.

### 5. Preserve history and estimator authority

Published Strip v1-v4 contracts remain immutable and readable. The new behavior is introduced as Strip / Wall Footing Contract v5.

Editable older Strip drafts may use the governed upgrade path. If an upgraded v4 draft was tracking wood-lumber material with the old LF/LF factor, Carez does not silently convert that abstract factor into a board choice. The draft moves to v5 and requires the estimator to select the physical form board before the installed board quantity is authoritative.

## Consequences

- `Track form material` remains an intentional inclusion choice.
- Wood-lumber tracking asks what board is used, not how many LF/LF to multiply.
- Footing depth affects course count automatically after the estimator chooses the board.
- The output remains compatible with the existing LF form-material projection but is construction-native and traceable as installed form-board LF.
- Panel/other systems continue to use contact-area outputs without a fake LF material demand until an explicit resource model exists.
- Current v4 browser acceptance remains valid for bulkheads; v5 requires focused browser acceptance for the new form-resource workflow.

## Acceptance requirements

1. A fresh Strip Condition is Contract v5.
2. Wood lumber + Track form material shows `Form board` and no normal `Form material factor` field.
3. Standard board choices derive course count from footing depth server-side.
4. Custom board requires effective course height and uses it deterministically.
5. Installed board LF uses saved footing-run geometry, formed sides, approved bulkheads, footing width, and board courses.
6. Changing footing run length changes board LF without entering any second length.
7. Panel/other systems do not produce a fabricated LF board demand.
8. Existing v1-v4 records remain unchanged and reproducible.
9. Typecheck, domain tests, production build, database migration/upgrade validation, and stable-staging authenticated browser QA pass before the rendered behavior is called verified.

## Canonical owners

- `docs/modules/assembly-resource-engine.md`
- `docs/modules/takeoff.md`
- `docs/decisions/ADR-021-condition-estimating-semantics.md`
- `docs/decisions/ADR-022-derived-geometry-facts-and-strip-bulkheads.md`
- GitHub Issue #55
