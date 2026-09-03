> **Document status:** RESEARCH CONTRACT  
> **Canonical owner:** `docs/modules/estimating.md`, `docs/modules/takeoff.md`, `docs/ARCHITECTURE.md`  
> **Use:** Source hierarchy and domain corrections that inform P1 means/methods design. It is not the primary implementation-status document.  
> **Supersession:** Domain/source conclusions remain supporting evidence. ADR-012 supersedes the assembly/method-profile product vocabulary and the former Method Studio/Build Plan UX; active implementation uses Concrete Conditions and modules.

# Estimating P1 — Construction Method Research Contract

## Purpose

Carez OS must estimate concrete as a builder without pretending to be the structural engineer or formwork engineer. The Concrete Condition & Resource Engine therefore separates design facts, Carez means-and-method decisions, physical resources, production, procurement, and commercial pricing.

This document records the source hierarchy and domain corrections established during P1 research.

## Source hierarchy

When sources disagree or provide different levels of authority, Carez should use this order:

1. **Project contract documents, structural drawings and specifications** — authoritative for what must be built: dimensions, reinforcing, splice locations/lengths when specified, concrete requirements, finishes and other design requirements.
2. **Engineered/manufacturer form-system information and recognized formwork guidance** — authoritative for validated system limits and layouts: panel capability, ties, studs, wales, strongbacks, bracing, pressure envelope, reusable hardware and installation rules.
3. **Carez verified means and methods** — authoritative for how Carez intends to execute the job within the valid system envelope: earth formed vs board formed, formed sides, selected form system, stake spacing, placement method, access approach, crew/equipment choices.
4. **Carez production history** — preferred source for actual labor productivity once enough internal history exists.
5. **Cost books / generic estimating references** — benchmark and sanity-check sources for pricing and productivity, never a substitute for project design facts or an engineered form layout.

The project library sources reviewed for this P1 contract include CE-020 Concrete Construction, Concrete Manual, ACI 302 slab excerpts, Formwork Guide to Good Practice, National Estimator — Concrete, and the Carez architecture/handoff documents. External cross-checks included CRSI reinforcing guidance, APA concrete-plyform guidance, and Dayton Superior Jahn/snap-tie literature.

## Reinforcing — lap steel and waste are separate

The previous `rebar_lap/waste` percentage is not acceptable as the Carez target model.

CRSI reinforcing guidance states that the engineer is responsible for indicating lap-splice locations and lengths on the structural drawings. Generic estimating references sometimes bundle lap and waste as one estimating allowance, but Carez intentionally does not use that shortcut as its canonical model.

Canonical reinforcing quantity chain:

```text
Base design bar LF
= measured run LF × number of continuous bars

Engineer-required lap LF
= lap splice count × engineer lap length

Installed/design rebar LF
= base design bar LF + engineer-required lap LF

Installed/design rebar LB
= installed/design rebar LF × selected bar weight LB/LF

Procurement rebar LB
= installed/design rebar LB × (1 + estimator waste %)

Rebar installation labor basis
= installed/design rebar LB
```

Rules:

- `reinforcement_method`, bar count and bar size are plan/design facts.
- Engineer lap-splice count and lap length are separate plan/design facts.
- Estimator waste is a commercial/procurement assumption and never includes design lap steel.
- Procurement waste does not create additional installation labor.
- If future fabrication/stock-length planning creates extra splice requirements, model that separately as a verified fabrication/method decision; do not hide it in waste.
- Carez OS does not calculate required ACI development/lap length as a design service. It records the project requirement and traces the source.

## Formwork — source-supported method model

### Board-form footing

For a verified board-form method, geometry plus method decisions can deterministically count resources such as board LF and stakes EA. Example:

```text
Installed board LF = footing LF × formed sides
Stake EA = (ceil(footing LF / verified maximum stake spacing) + 1) × formed sides
Form-contact area = footing LF × footing depth × formed sides
```

Form-contact area remains useful as a labor-production basis. It is not a substitute for physical lumber/hardware quantities.

### Plywood wall form / Jahn-type system

Project and manufacturer sources support modeling a wall form as a system rather than a generic SFCA allowance. Candidate resource outputs include:

- plywood/Plyform sheets or panels
- studs
- single or double wales depending on the validated system
- snap ties
- Jahn A brackets where that arrangement is selected
- Jahn C / strongback brackets where that arrangement is selected
- long-end ties where required by the selected strongback detail
- strongbacks
- braces and brace anchorage
- reusable shoes/hardware
- form release and other explicit consumables
- erect, place-support, strip and repair/clean labor operations

CE-020 describes ties at stud/wale intersections and deterministic stud/wale counts from validated spacings. Dayton Superior literature defines the actual hardware arrangements for Jahn A and Jahn C brackets. APA guidance makes clear that allowable panel/framing spacing depends on form pressure, panel properties and framing properties.

### Engineering envelope

Carez OS may **count a verified layout**. It must not invent a safe wall-form layout from length and height alone.

The method profile should therefore retain the validated form-system source/envelope and relevant project conditions where they matter, including as applicable:

- wall height and thickness
- selected panel/sheathing system and rating/thickness
- tie type and approved tie pattern
- stud spacing
- wale arrangement/spacing
- strongback arrangement/spacing
- bracing method
- kicker/kickerless condition
- concrete mix/admixture information relevant to form pressure
- concrete temperature
- rate of placement / vertical rate of rise
- vibration/consolidation assumptions
- tie-hole/finish requirements
- site access and placement method

If the job falls outside the validated method envelope, the method should block verification and require an engineered/manufacturer-reviewed layout rather than extrapolating.

## UX architecture — Condition modules, not method/formula studios

The domain research remains valid, but ADR-012 supersedes the former Method Library/Method Studio, Job Build Plan Workbench, and assembly-first Inspector as the active product contract.

Current target:

1. Company means/method defaults live in versioned Company Condition Templates.
2. Job-specific facts and verified decisions live in a versioned Project Concrete Condition.
3. Relevant method controls appear within readable Condition Properties tabs/modules such as Forms, Rebar, Excavation, Placement/Equipment, and Labor.
4. Safety- or cost-critical decisions show their source/envelope and block only dependent outputs when unresolved.
5. Standard work uses typed fields, toggles, dropdowns, and compact resource previews; Formula Composer is not part of normal Takeoff.
6. The window may dock, float, drag, resize, maximize/focus, and restore without losing the plan context or draft.
7. Existing measurements retain the exact Condition/template or legacy method-profile lineage used when created.

## Estimate Lines disclosure

Takeoff-generated estimate groups are hierarchical by Concrete Condition and measurement role and must render as disclosure groups. Clicking the group header collapses/expands all generated child cost lines and the measurement subtotal while preserving the group identity, measured quantity and group direct-cost total.

This is required for estimates with many takeoffs and should later be extended with `Expand all`, `Collapse all`, search/filter and remembered user view state if needed.

## Release rule

Research-driven recipe changes must follow the existing immutable-version rule:

- never mutate a published Company Condition Template or referenced legacy assembly version
- author the correction as a new draft template/version
- validate formulas and source assumptions
- review the UX and method semantics
- publish only after QA
- existing measurements retain their prior version/profile lineage
