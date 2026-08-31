> **Document status:** ACCEPTED DETAILED DESIGN  
> **Canonical owner:** `docs/modules/takeoff.md`, `docs/modules/estimating.md`, `docs/ARCHITECTURE.md`  
> **Use:** Supporting integrated estimator-workstation product contract and implementation sequencing.  
> **Supersession:** Active until explicitly superseded; present implementation status belongs in `docs/CURRENT_STATE.md`.

# Carez Concrete OS — Integrated Takeoff + Estimating Workstation

Status: target architecture for the modernization branch

## Decision

Carez Takeoff and Estimating will operate as one estimator workstation rather than two disconnected applications.

Product direction:

- zzTakeoff-style drawing speed, worksheet immediacy, formula/variable flexibility, revision ergonomics, and keyboard-first interaction.
- The EDGE-style trade-specific assemblies, labor/material/equipment estimating depth, and direct takeoff-to-estimate population.
- Carez-specific concrete domain model, commercial lineage, field/production integration, procurement/finance traceability, and estimate-to-actual learning.

This is an evolution of the completed P0 foundation, not a rewrite. Existing normalized vector geometry, calibration, atomic Takeoff-to-Estimate lineage, published assembly immutability, RLS, server-authoritative calculations, and commercial freeze boundaries remain authoritative.

## Product invariant

The estimator should be able to spend the working day in one screen:

```text
[ permanent Carez app rail ]
[ plans / sheets ] [ drawing + vector geometry ] [ takeoff / assembly inspector ]
[ permanent resizable quantity + estimate worksheet ]
```

The workstation must allow the estimator to move continuously through:

```text
Scope -> Plans -> Measure -> Resolve assumptions -> Price -> Review -> Proposal
```

without re-entering quantities or repeatedly leaving the drawing surface.

## Source-derived design principles

The zzTakeoff reference material and workbooks establish useful mechanics that Carez should adopt in a governed form:

- Built-in measurement outputs should be used before inventing custom properties.
- Takeoff types can expose more than one useful derived measurement: area, perimeter, volume, wall area, count, section count, and related quantities.
- Variables and formulas should cascade from the takeoff/assembly into child material, labor, equipment, subcontract, and other estimate items.
- Formula inputs should be reusable and explicit rather than hidden magic numbers.
- A worksheet should remain visible during takeoff and should support estimator review without leaving the drawing.
- Batch/product libraries, saved assemblies, copy/duplicate workflows, revision migration, overlays, and keyboard workflows materially reduce estimator friction.
- Formula/property governance matters. Carez should prefer a small reusable vocabulary over uncontrolled custom-property proliferation.

The EDGE reference reinforces the commercial side:

- Takeoff and estimating are one continuous operation.
- Trade-specific conditions/assemblies should generate material, reinforcement, formwork, equipment, and labor requirements.
- Production rates and labor assumptions remain estimator-controlled and adjustable.
- Supplier/material pricing must be reviewable and should retain provenance.

## Domain model

### 1. Measurement

Measurement is authoritative physical geometry plus deterministic derived quantities.

Examples:

- Count / point count
- Linear / segment length
- Area before cutouts
- Net area
- Cutout area
- Perimeter / perimeter before cutouts
- Wall contact area
- Volume
- Section count
- Vertical length where the takeoff type provides it

PDF remains visual reference. Stable normalized vector geometry remains authoritative.

Measurement does not own final pricing.

### 2. Assembly

An assembly converts measurement outputs plus controlled estimator inputs into production quantities.

Concrete assemblies may produce:

- Ready-mix CY
- Rebar LF / LB / EA
- Form contact area / form material
- Embeds / dowels / joints
- Pump or equipment quantities
- Carpenter / laborer / finisher / operator man-hours
- Other concrete-specific production quantities

Published assembly versions remain immutable.

### 3. Estimate output

Each generated output becomes an estimate line with exact source lineage:

```text
Takeoff Measurement
  -> Published Assembly Version
    -> Assembly Component
      -> Takeoff Output
        -> Estimate Item
```

The estimate layer owns commercial review:

- Production Quantity
- Direct Cost
- Cost Source / provenance
- Man-hours and production-rate assumptions
- Waste / rounding where applicable
- Manual price override
- Markup / sell strategy
- Tax / B&O / reserves
- Alternates / inclusions / exclusions
- Customer price

Production Quantity, Direct Cost, and Sell remain separate values.

## Input and property governance

Carez will use three input classes.

### Built-in measurement values

Preferred whenever geometry can determine the value.

Examples: LF, SF, CY, perimeter, point count, wall area.

### Assembly inputs

Reusable estimator-controlled assumptions needed by a published assembly.

Examples:

- Thickness
- Width / depth when the selected measurement type cannot derive them
- Bars in run
- Bar size / lb-per-foot mapping
- Rebar lb/SF or lb/EA when the design is supplied as density
- Vertical bar spacing
- Horizontal courses
- Dowel spacing / length
- Formed sides / formed perimeter
- Concrete waste
- MH per SF / LF / EA / CY
- Equipment production rate

### Project / estimate controls

Inputs that should cascade across many measurements rather than be repeated on every object.

Examples:

- Crew/labor profile
- L&I risk class
- Supplier quote set
- Pricing date / pricing basis
- Project-level waste or logistics rules when explicitly adopted

Rules:

1. Do not create a custom input if a built-in measurement already provides the value.
2. Do not hard-code production rates into formulas when they are estimator assumptions; use explicit reusable inputs.
3. Keep the number of rebar drivers small. Separate bar-size inputs only when the reinforcing design genuinely requires independent sizes.
4. Published assembly formulas may reference only declared built-ins and declared assembly inputs.
5. Missing assumptions are workflow holds, not reasons to discard valid geometry.

## Hold semantics

A valid measurement must save even when a downstream assembly component cannot yet calculate.

Example: a pad footing has enough information to calculate concrete, form contact area, and some labor, but the rebar density has not been decided.

Correct behavior:

```text
Pad footing geometry       READY
Concrete quantity          READY
Form quantity              READY
Concrete-place labor       READY
Rebar material             HOLD — Rebar per footing required
Rebar labor                HOLD — Rebar per footing required
```

Incorrect behavior:

```text
Reject the entire measurement because rebar density is blank.
```

A hold must preserve the exact component lineage and must be resolvable by entering the missing assumption and recalculating the assembly. Geometry must not be redrawn.

Hold categories will be surfaced distinctly in the workstation:

- INPUT REQUIRED
- PRICE REQUIRED
- LABOR RATE REQUIRED
- REVIEW / MANUAL OVERRIDE

A hold prevents an estimate from being considered commercially ready, but it does not prevent the estimator from continuing takeoff.

## Workstation interaction contract

### Plans / sheets

- Fast sheet navigation
- List and thumbnail modes
- Scale state
- Logical sheet identity and revision identity
- Bookmarks/search later
- Revision overlay and migration later

### Drawing surface

- Count, linear, area
- Segment and richer concrete measurement types as the engine matures
- Cutouts
- Arc geometry
- Snap / ortho
- Vertex editing
- Whole-object movement
- Multi-select / clipboard
- Box mode
- Persistent undo / redo

### Assembly inspector

Starting a takeoff should be fast:

1. Choose or search concrete assembly.
2. Enter only assumptions that are known and material to the current measurement.
3. Measure.
4. Save immediately.
5. Unresolved dependent outputs appear as holds.

Selecting an existing measurement must allow its assembly inputs to be reviewed and changed. Recalculation updates every dependent output and linked estimate item atomically while preserving reviewed manual price overrides.

### Bottom quantity / estimate worksheet

The permanent dock evolves from a quantity summary into the primary estimator worksheet.

Required columns/views include:

- Scope / folder
- Sheet / drawing reference
- Measurement
- Assembly
- Production quantity and unit
- Concrete
- Rebar
- Formwork
- Equipment
- Man-hours
- Unit cost
- Direct cost
- Cost source
- Sell / markup in the Estimating phase
- Status / hold

It must support sorting, grouping, filtering, saved views, and targeted editing. Editing a governed assumption must call server-authoritative recalculation rather than mutate derived numbers directly.

## Pricing provenance

Material and equipment pricing must never be silently fabricated.

Priority sources remain:

1. Latest applicable vendor bill / actual purchase history
2. Applicable purchase order / quoted supplier price
3. Company cost catalog
4. Assembly-version default when intentionally published with one
5. Explicit manual override

Every priced output should retain source description and effective date where available.

A missing price remains a visible hold rather than becoming a zero-dollar priced line.

## Concrete-specific assembly direction

The zzTakeoff Division 03 reference workbooks support the following preferred patterns, adapted to Carez rather than copied mechanically:

- Slab on grade: area/depth geometry -> concrete volume, vapor barrier, mesh/rebar, forms/joints, placing/finishing labor, pump/equipment as applicable.
- Continuous footing / grade beam: linear + section geometry -> concrete CY, longitudinal steel, dowels, formwork, labor.
- Pad / column footing: count + pad geometry -> concrete CY, formwork, rebar, labor.
- Wall / stem wall: linear/segment + wall section -> concrete CY, wall contact area, vertical/horizontal reinforcing, forms, labor.
- Pier / sonotube: count + diameter/depth -> concrete CY, cage steel, ties, labor.
- Curb / sidewalk: linear/area section geometry -> concrete, reinforcing, forms/joints, labor.
- Embeds / anchor bolts / blockouts: count-driven child outputs.

Carez remains concrete-native: the assembly library should model the physical work a concrete estimator actually bids rather than expose generic construction-SaaS abstractions.

## Revision model

Plan revisions must eventually preserve logical sheet identity separately from exact uploaded revision.

For changed sheets the estimator should be able to choose, per sheet or batch:

- Move existing takeoff to the new revision
- Copy existing takeoff to the new revision
- Leave takeoff on the prior revision

Carez should preserve original geometry/history and support overlay comparison. AI may suggest sheet matching and revision changes, but the estimator approves scope-impacting migration.

## Carez digital thread

The workstation is only the front of a longer operating thread:

```text
Drawing Geometry
-> Takeoff Measurement
-> Assembly Outputs
-> Estimate Items
-> Proposal
-> Customer Acceptance
-> Frozen Budget
-> Work Package
-> Operation
-> Schedule
-> Crew / Time
-> Production
-> Actual Cost
-> Forecast / Variance
-> Future estimating intelligence
```

Accepted commercial records remain immutable. Future estimate-to-actual intelligence may suggest better production or price assumptions, but it never overwrites estimator authority.

## Implementation sequence

### Slice T/E-01 — Non-blocking assembly holds

- Save valid geometry when a declared required assembly input is missing.
- Calculate unaffected components normally.
- Mark only dependent outputs as INPUT REQUIRED.
- Allow inputs on an existing measurement to be edited and recalculated without redrawing geometry.
- Preserve manual price overrides through recalculation.
- Show input holds in the inspector and permanent worksheet.

### Slice T/E-02 — Unified worksheet contract

- Promote the quantity dock into an estimator worksheet.
- Add output-level drill-down and editable governed assumptions.
- Add cost source / unit cost / direct cost / hold columns.
- Keep drawing selection and worksheet selection synchronized.

### Slice T/E-03 — Concrete measurement/property expansion

- Introduce governed concrete measurement modes beyond the current LF/SF/EA primitives where they reduce repeated data entry.
- Prefer derived built-ins for width/depth/volume/wall area over duplicate custom inputs.
- Expand formula vocabulary only through deterministic, tested server-side operations.

### Slice T/E-04 — Pricing workspace

- Supplier/catalog/manual pricing provenance.
- Bulk pricing review.
- Missing-price queue.
- Production-rate/labor review.
- Markup/sell without collapsing Direct Cost and Sell.

### Slice T/E-05 — Scope / templates / library ergonomics

- Concrete scope hierarchy and folders.
- Saved assembly presets/templates.
- Batch insert/import mappings.
- Duplicate / convert / copy-paste workflows.

### Slice T/E-06 — Bid review / proposal handoff

- Exception review.
- Alternates, allowances, exclusions, inclusions.
- Commercial readiness checks.
- Proposal issuance and immutable revision boundary.

### Slice T/E-07 — Plan revision ergonomics

- Sheet identity/versioning.
- Overlay/compare.
- Move/copy/leave takeoff migration.
- Batch review.

## Acceptance criteria

The direction is successful when a concrete estimator can:

1. Open a plan set and identify the working sheet quickly.
2. Select a concrete assembly and measure with minimal setup.
3. Save geometry even when some downstream assumptions are unresolved.
4. See concrete/rebar/forms/labor quantities update immediately.
5. Resolve missing assumptions from the same workstation without redrawing.
6. Review pricing provenance and open holds from the bottom worksheet.
7. Move from scope through pricing/review/proposal without duplicate quantity entry.
8. Trace every commercial line back to the exact measurement and published assembly version.
9. Accept a proposal and preserve the exact historical commercial baseline into project execution.
10. Eventually compare estimate assumptions with actual field production without mutating historical estimates.
