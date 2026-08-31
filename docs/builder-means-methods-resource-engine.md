# Carez Builder Means, Methods & Resource Engine

## Purpose

Carez does not estimate concrete by attaching generic allowances to measured geometry. It estimates the way a concrete builder plans the work:

`What do the plans require? -> How will Carez build it? -> What resources does that method consume or require? -> How much labor does the method take? -> What does it cost?`

This document is the P1 architecture contract for Takeoff and Estimating. It extends the immutable custom-assembly architecture; it does not replace it.

The canonical lineage remains:

`Plan Facts -> Verified Job Method Profile -> Takeoff Geometry -> Published Assembly Version -> Deterministic Resource Outputs -> Estimate Items -> Proposal -> Frozen Budget`

A published assembly version defines the available construction recipe. A verified job method profile records which means-and-method assumptions the estimator accepted for this particular takeoff set before measuring work.

## Four kinds of inputs

Every assembly property should be classifiable as one of the following roles.

### 1. Plan fact

A fact supplied by the drawings/specifications or explicitly confirmed from plan intelligence.

Examples:

- footing width = 24 in
- footing depth = 10 in
- wall thickness = 8 in
- wall height = 9 ft
- reinforcing = #5 at 12 in O.C.

Plan facts describe **what must be built**. They do not silently dictate Carez means and methods.

### 2. Method decision

A Carez field/estimating decision describing **how the work will be built**.

Examples:

- earth formed vs formed footing
- form two sides
- 2x10 Douglas-fir board form system
- stakes at 4 ft O.C.
- 3/4 in plywood + Jahn bracket wall-form system
- tie grid and wale/strongback system selected from a validated method profile
- direct chute vs line pump

Method decisions can have published defaults or recommendations, but values marked `requires_verification` must be explicitly accepted in a job method profile before the profile becomes verified.

### 3. Production assumption

A productivity assumption used to convert physical work into labor hours.

Examples:

- form footing sides = MH/SFCA
- set reinforcing = MH/LB
- place concrete = MH/CY
- strip forms = MH/SFCA

The published assembly carries a baseline. P1 should also surface Carez production history and permit an estimator-reviewed job assumption without destroying the baseline or its provenance.

### 4. Commercial assumption

A value that affects price rather than physical construction.

Examples:

- material unit cost
- rental rate
- subcontractor rate
- waste/replenishment allowance when it is a commercial rather than geometric rule

Commercial overrides must retain provenance and must not change the physical resource quantity.

## Verified job method profiles

A method profile belongs to one Takeoff set and one immutable assembly version. It is the pre-takeoff record of the estimator's accepted means-and-method assumptions.

Examples:

- `Garage strip footings - 2x10 DF / 4 ft stakes`
- `Basement walls - 3/4 Plyform / Jahn system`
- `Exterior sidewalk - steel forms / direct chute`

A profile starts as `draft`. Once verified, the construction assumptions are immutable. A different method is a new profile/revision; existing measurements continue to reference the exact verified profile used when they were created.

This prevents a global assembly-default change from silently rewriting what an older bid assumed.

## Resource outputs: no generic material allowances

Every meaningful physical resource should be its own assembly component whenever its quantity can be deterministically derived.

Canonical `resource_behavior` meanings for P1 are:

- `consumed_material` - concrete, rebar, lumber that is charged as consumed for the bid, snap ties, nails, form oil, etc.
- `reusable_inventory` - Jahn brackets, flat shoes, reusable stakes, owned form panels, braces, strongback hardware, etc.
- `labor` - labor operation with production quantity and man-hours.
- `owned_equipment` - Carez-owned equipment allocation.
- `rented_equipment` - rented forms/equipment whose commercial quantity follows the build method.
- `subcontractor` - pump, specialty subcontractor, or other subcontracted operation.

`estimate_visible=false` remains valid for a physical resource that must be counted for procurement/readiness but is not itself a direct estimate line.

A resource has three different quantities that must not be conflated:

1. **Installed/theoretical quantity** - the resource required by geometry and the method.
2. **Procurement quantity** - what must actually be purchased/rented after stock-size rounding, waste, package quantities, or rental units.
3. **Inventory demand** - reusable items required on site even when they are not expensed as if newly purchased on every job.

P1 starts with deterministic installed quantities. Stock optimization, reuse cycles, and inventory availability are downstream procurement/readiness concerns and must retain lineage to the same resource output.

## Strip-footing example

Plan facts:

- width = 24 in
- depth = 10 in

Verified method decisions for one job profile:

- formwork = formed footing
- formed sides = 2
- board system = 2x10 Douglas fir
- stake spacing = 4 ft O.C.

For measured length `L`:

```text
Concrete CY
= L * (24/12) * (10/12) / 27 * concrete waste factor

Form contact area (labor basis)
= L * (10/12) * 2

Installed 2x10 DF form board LF
= L * 2

Stake demand EA
= (ceil(L / 4) + 1) * 2
```

The exact board product comes from the selected immutable form-method assembly and its catalog item. It is priced by LF when that is how Carez buys/prices it. Stakes can be represented as reusable inventory rather than pretending every stake is consumed on every footing.

There is no `Form lumber / hardware allowance` resource in the target model. If a piece of hardware is required by the chosen method, it should be named and counted. If it cannot yet be reliably derived, it remains an explicit estimator input/hold rather than an anonymous SFCA dollar bucket.

### Important rounding rule

For a continuous run with a stake at each end and maximum spacing `S`, one side requires:

`ceil(L / S) + 1`

This is a **Carez method rule**, not a universal formwork engineering standard. The published method profile must make the spacing visible and verifiable.

## Wall-form example: 3/4 in plywood + Jahn hardware

A future wall-form method assembly can contain components such as:

- 3/4 in Plyform sheets
- 2x4 studs/wales
- standard snap ties
- long-end snap ties where required by the strongback method
- Jahn A brackets
- Jahn C/strongback brackets when that method is selected
- flat shoes / strongback hardware
- braces/stakes
- form release agent and other consumed accessories
- form/set/strip labor operations

Geometry provides wall length and height. The selected method profile supplies the verified sheet orientation, tie grid, wale spacing, strongback spacing and other system assumptions. The deterministic formula engine can then derive sheet rows/columns, tie intersections, bracket counts, waler LF, strongback counts, etc.

### Form-pressure and system-envelope rule

Tie spacing, stud/wale spacing, panel thickness and strongback layout are not universal constants. Form pressure is affected by conditions including concrete placement rate, temperature, slump/mix/admixtures, vibration, concrete density, form height and placement method. Manufacturer and engineered system limits govern allowable layouts.

Carez OS therefore must **not pretend to be the formwork engineer**. A wall-form method profile should record the validated system envelope/source and warn or block when project assumptions fall outside that envelope. The software can count the hardware for a verified layout; it should not invent an unsafe layout from geometry alone.

Research basis for this architectural rule includes APA concrete-forming guidance, ACI 347 formwork guidance and Dayton Superior Jahn-system literature.

## Pre-takeoff UX contract

Selecting an assembly should eventually open a compact **Build Plan** step before drawing:

```text
STRIP FOOTING

KNOWN FROM PLANS
Width                  24 in        confirmed
Depth                  10 in        confirmed
Reinforcing            #4 / 2 cont. confirmed

HOW WE WILL BUILD IT
Formwork                Formed footing
Board system            2x10 Douglas fir
Formed sides            2
Stake spacing           4 ft O.C.
Placement               Line pump

PRODUCTION
Form sides              0.05 MH/SFCA  baseline
Place concrete          0.40 MH/CY    job assumption

RESOURCE PREVIEW
2x10 DF                 calculated from measured LF
Stakes                   calculated at 4 ft O.C.
Concrete                 calculated from section
Rebar                    calculated from structural detail

[ Verify Method & Start Takeoff ]
```

The estimator should be able to save multiple verified profiles for the same assembly when a job genuinely uses different methods in different areas.

## Production-rate model

Labor must remain separate from material quantities.

Each labor component should preserve:

- production task
- physical production quantity/unit
- immutable published baseline MH/unit
- baseline source
- Carez historical production evidence when available
- estimator-reviewed job MH/unit
- resulting man-hours
- crew/labor cost basis

P1 should display the calculation as a build-up, for example:

```text
Form footing sides
12.67 SFCA
Baseline             0.050 MH/SFCA
Job assumption       0.050 MH/SFCA
Calculated labor     0.63 MH
Field labor rate     $75.00/MH
Direct labor         $47.50
```

Changing the job production assumption changes man-hours, not the physical form-material count.

## Pricing and override behavior

Physical resource quantity and commercial price are independent.

- Takeoff/method recalculation can change resource quantities.
- A manual unit-price override survives quantity recalculation.
- Saving an unchanged catalog price must not create a manual override.
- P1 should add `Reset to Catalog/Assembly` to restore inherited pricing provenance.
- Production-rate overrides need equivalent baseline/job provenance.

## Architecture boundaries

1. Keep one deterministic formula engine. Do not create a second estimator-only calculator.
2. Keep published assembly versions immutable.
3. Keep child method assemblies reusable.
4. Keep every output traceable to its exact component path.
5. Keep plan facts separate from Carez method decisions.
6. Require explicit verification for safety/cost-critical method decisions.
7. Count reusable resources even when they do not become direct-cost lines.
8. Never hide an unknown physical resource behind a generic allowance merely to make the estimate look complete.
9. Never treat a manufacturer example tie grid as a universal safe design.
10. Preserve the accepted Takeoff -> Estimate -> Proposal -> Budget lineage.

## P1 implementation sequence

### P1A - Builder-method foundation

- input-role metadata on assembly variables
- `requires_verification` metadata
- verified takeoff method profiles
- measurement-to-method-profile lineage
- deterministic strip-footing board/stake formulas and tests

### P1B - Strip-footing resource recipe

Create a new immutable formed-footing method revision in QA that replaces the generic SFCA material allowance with explicit resources. Verify with real Takeoff recalculation before production promotion.

### P1C - Production build-up UI

Expose physical quantity, baseline MH/unit, Carez history, job MH/unit, crew/labor rate and resulting labor cost in Estimate.

### P1D - Resource/procurement drill-down

Expose consumed vs reusable resources, stock/package quantities, inventory demand and catalog/reset pricing.

### P1E - Wall-form systems

Implement wall-form method modules only after the system/profile inputs and manufacturer/engineering envelope are explicit. Start with one Carez-verified wall system rather than trying to model every form system at once.
