# Module Spec — Assembly & Resource Engine

Status: approved P1 foundation

## Purpose

Provide a concrete-native engine in which each company builds and owns its own assemblies, properties, formulas, resources, production assumptions, and published recipes.

Carez must not ship or seed hard-coded selectable production assemblies into a company's working library. System-provided examples belong in a separate template catalog and become company-owned assemblies only when an estimator explicitly creates a draft from a template.

Canonical lineage:

`Job Spine -> Takeoff Geometry -> Published Company Assembly Version -> Deterministic Resource Outputs -> Estimate Items -> Proposal Revision -> Accepted Scope Snapshot -> Frozen Commercial Baseline / Budget`

## Product invariants

- No hard-coded Carez production assemblies are created for new companies.
- Hard-coded assembly seed/initialization behavior is removed from the product runtime and migrations going forward.
- System templates are not live assemblies and cannot be selected for Takeoff until copied into a company-owned draft and published.
- Published company assembly versions are immutable.
- Existing published assembly versions already referenced by historical Takeoff, estimate, proposal, Accepted Scope Snapshot, or budget records must retain lineage. They may be retired and hidden from new work but must not be destructively deleted while referenced.
- Plan facts, estimator method decisions, production assumptions, and commercial assumptions remain distinguishable.
- Missing required inputs, production assumptions, resource prices, or labor rates become explicit holds rather than fabricated zeros.
- Production Quantity, Direct Cost, and Sell remain separate.
- Quantity and cost calculations remain server-authoritative and deterministic.
- One formula engine governs authoring preview, Takeoff calculation, estimating, and recalculation.
- Resources remain independently priceable and traceable from the assemblies that consume or require them.
- Humans remain authoritative for scope, means and methods, production rates, pricing, margin, and publication.

## Core entities

### Company Assembly

A user-owned concrete recipe identity organized in the company's Assembly Library.

Each assembly has immutable published versions and may contain:

- typed properties;
- property bindings;
- direct resource outputs;
- labor operations;
- equipment/subcontract outputs;
- nested published child assemblies;
- formula dependencies;
- method decisions and production assumptions;
- provenance and notes.

### Assembly Template

A read-only starting pattern supplied by Carez or another approved source.

Templates are separate from company assemblies. They may contain example properties, block structure, formulas, resource-role placeholders, and source references, but do not become commercial truth automatically.

Using a template performs an explicit copy operation:

`Template -> New Company Draft Assembly -> Estimator Review/Edit -> Publish`

The copied draft belongs to the company and is independent of future template changes.

### Resource

A reusable company resource that assemblies reference rather than duplicating price logic.

First-class resource behaviors:

- consumed material;
- reusable inventory;
- labor;
- owned equipment;
- rented equipment;
- subcontractor;
- other.

A resource may preserve purchasing/pricing metadata, unit conversions, supplier/catalog identity, effective dates, tax/delivery behavior, and provenance without embedding current price into the assembly formula.

### Property

A named typed input or derived value used by an assembly.

Supported property families should include:

- dimension;
- quantity;
- percentage/factor;
- boolean;
- enum/choice;
- spacing;
- resource reference;
- text/note;
- derived numeric property.

Properties may be grouped for estimator readability, exposed or hidden from Takeoff, marked required, marked as estimator-overridable, and classified by input role.

### Property Binding

A deterministic source mapping into an assembly property.

Supported namespaces remain:

- `Takeoff.*`;
- `Project.*`;
- `Parent.*`;
- `PlanFact.*`;
- `Properties.*`.

Child assemblies inherit only through explicit bindings. Cycles are invalid.

## Formula engine

Carez retains a deterministic formula AST as the authoritative execution model. Arbitrary JavaScript, `eval`, SQL expression strings, and an independent math.js runtime are not commercial calculation authorities.

The Assembly Builder should make formula authoring readable and visual while compiling to the same deterministic AST used by the server.

Required engine capabilities:

- arithmetic;
- min/max;
- ceil/floor/round;
- comparisons;
- if/then/else and conditional activation;
- enum/choice-driven branches;
- piecewise/lookup rules;
- explicit unit conversions;
- dependency tracking;
- circular-reference detection;
- formula tracing;
- publish-time validation.

The engine should become unit-aware so invalid dimensional operations are rejected before publication. Common concrete units include IN, FT, LF, SF, CF, CY, EA, LB, TON, HR, MH, GAL, and package/purchase units.

The UI may display estimator-friendly expressions such as:

`Concrete Volume = Takeoff.Area * Properties.Thickness`

but execution must compile to and run through the canonical deterministic formula engine.

## Quantity separation

Resource calculations must distinguish:

1. **Installed / theoretical quantity** — physical quantity required by geometry and method.
2. **Procurement quantity** — purchase/rental quantity after package size, stock length, waste, minimum order, or rental-unit rounding.
3. **Inventory demand** — reusable items required on site regardless of whether they are newly expensed.

These quantities share lineage but are not interchangeable.

Examples:

- slab vapor retarder: installed SF -> procurement rolls;
- reinforcing: installed LB -> stock bars/bundles/tons;
- concrete: theoretical CY -> order quantity -> later placed/returned quantity;
- form hardware: inventory demand EA without pretending all owned hardware is consumed.

## Labor and production

Labor is a resource/operation, not a magic dollar allowance embedded in an assembly.

Each labor output preserves:

- production task;
- physical production quantity and unit;
- baseline MH/unit and source;
- company historical production evidence when available;
- estimator-reviewed job MH/unit;
- resulting man-hours;
- loaded labor rate and provenance;
- direct labor cost.

Changing a production assumption changes man-hours; it does not change the physical resource quantity unless a method/property explicitly requires that relationship.

## Assembly Builder UX contract

Assembly creation is too complex for the Takeoff right Inspector and must not be implemented as a long stack of ordinary form fields inside that pane.

The primary authoring experience is a dedicated **Assembly Builder composer integrated into the Takeoff workstation**. Normal authoring keeps the live plan visible and preserves the estimator's current drawing context.

The preferred desktop model is:

`Takeoff Plan + compact Inspector + resizable bottom workstation`

where the permanent Quantity Worksheet region can expand into Assembly Builder mode. The builder may reduce the visible plan height while active, but it must not navigate the estimator to a separate route, open a separate browser window, or replace the product with a disconnected Assembly Studio.

### Inspector boundary

The Takeoff Inspector remains contextual and lightweight. It may expose:

- selected assembly and published/draft version;
- selected job method/profile;
- required job-specific properties;
- holds and warnings;
- a bounded set of key outputs;
- commands such as Create Assembly, Edit Assembly, Create Revision, Open Builder, or Return to Builder.

The Inspector is not the primary recipe-authoring canvas and must not contain the full property/resource/formula editor.

### Builder entry and draft lifecycle

Assembly Builder supports these entry paths:

- Create Blank Assembly;
- Start From Template;
- Duplicate Company Assembly;
- Create Revision from Published Version;
- Edit Existing Draft.

Creating a new assembly may use a small setup dialog for identity and measurement type. After creation, the draft opens in the integrated builder.

Published versions remain read-only. Editing published work requires `Create Revision`, producing a new mutable draft without changing any prior published version or historical Takeoff lineage.

### Interaction model

The builder should feel like assembling a concrete recipe rather than filling out a database form.

Core interaction patterns:

- drag blocks from a palette onto a structured builder canvas;
- reorder blocks by drag-and-drop;
- connect property/output dependencies with constrained visual links or explicit mapping chips;
- add a child assembly by dragging it into the recipe;
- drag resources into material/labor/equipment/subcontract sections;
- configure a selected block inline, in a focused popover/sheet, or an expandable block rather than relying on a permanent overloaded right pane;
- show inherited parent values as compact source chips;
- show units and provenance directly on blocks;
- show missing inputs and invalid formulas at the block that causes them;
- provide draft undo/redo;
- keep published versions read-only.

The builder must be structured enough to avoid free-form node-graph spaghetti. The default recipe organization should use bounded lanes/sections such as:

- **Inputs / Properties**;
- **Methods / Decisions**;
- **Logic / Child Assemblies**;
- **Resource Outputs**;
- **Labor / Production**;
- **Test / Validation**.

### Focus Builder

Complex assemblies may require more workspace than the normal bottom composer provides.

The integrated builder therefore supports **Focus Builder** mode.

Focus Builder requirements:

- remains on the same Takeoff route and within the permanent Carez desktop shell;
- temporarily expands the Assembly Builder to occupy most of the available workspace;
- may collapse or minimize nonessential Takeoff panes while focused;
- uses the same draft state, formula engine, resources, undo/redo stack, Test Bench, and publish controls as normal builder mode;
- does not create a second assembly-authoring implementation;
- preserves current sheet, selected measurement, plan viewport, zoom/pan, calibration context, and relevant selection state;
- `Exit Focus` returns to the prior Takeoff drawing state and normal builder size without reloading or losing draft edits;
- does not mutate Takeoff geometry merely by entering or leaving focus mode.

Focus Builder is an enlargement of the same integrated composer, not a separate Assembly Studio.

### Live plan context

When normal Assembly Builder mode is open, the plan should remain visible and usable enough to preserve measurement context. The estimator should be able to use a current or selected Takeoff measurement as Test Bench input without recreating its quantity.

Builder entry/exit must preserve:

- current Takeoff set;
- active sheet;
- current page position;
- zoom/pan state;
- selected measurement where valid;
- selected assembly/method context;
- unsaved assembly draft state.

### Test Bench

A draft assembly must support sample testing before publication.

The estimator may use either representative manual inputs or an eligible live/current Takeoff measurement and immediately inspect:

- resolved parent and child properties;
- concrete CY;
- reinforcing LB;
- formwork SFCA/LF/EA;
- vapor barrier/insulation/mesh quantities;
- labor production quantities and MH;
- equipment/subcontract quantities;
- installed vs procurement vs inventory demand;
- missing-input and missing-price holds;
- calculation trace and source provenance.

Preview must use the same canonical formula/property engine as server calculation.

### Template experience

The integrated Assembly Builder should provide:

- Create Blank Assembly;
- Start From Template;
- Duplicate Company Assembly;
- Create Revision from Published Version.

Templates should be visually browsable by concrete scope such as foundations, walls, slabs/flatwork, reinforcement, formwork methods, placement, finishing, joints, curing, embeds, and specialty concrete.

Template browsing may use a modal/library overlay because it is a selection task, but `Use Template` must return the estimator to the integrated Assembly Builder with a new company-owned draft.

A template is a learning/acceleration device, not an imposed Carez estimating assumption.

## Concrete-native resource coverage

The engine must support common Division 03 outputs without requiring hard-coded assemblies, including:

- ready-mix concrete;
- reinforcing bars, mesh, fibers, dowels, chairs/supports, tie wire;
- vapor barriers/retarders and seam/accessory materials;
- insulation;
- form facing, lumber, panels, ties, brackets, walers, strongbacks, stakes, braces, release agents and reusable hardware;
- joints, fillers, sealants, dowel systems and sawcut operations;
- embeds, anchor bolts and inserts;
- curing materials;
- finishing operations;
- pumps and placement equipment;
- owned/rented equipment;
- specialty subcontractors;
- consumables and other explicit resources.

Reference values from books or manufacturer literature may be offered with provenance but never silently promoted to company defaults.

## Removal of legacy hard-coded assemblies

Implementation must remove the hard-coded assembly catalog as a product behavior.

Required transition:

1. Stop creating seeded Carez production assemblies for companies.
2. Remove hard-coded assemblies from new-work selectors and active company libraries.
3. Preserve referenced historical published versions as hidden/retired lineage records until safe retention rules permit deletion.
4. Remove unreferenced seeded records when a migration can prove they are not required for lineage.
5. Recreate any useful examples as separate, read-only Assembly Templates rather than live company assemblies.
6. New companies begin with an empty company Assembly Library plus optional access to the Template Catalog.

## Integration with Takeoff and Estimating

Takeoff owns authoritative physical geometry.

The Assembly & Resource Engine converts that geometry plus declared properties/methods into deterministic resource outputs.

The Assembly Builder is visually integrated into the Takeoff workstation, but assembly draft/version/resource/formula authority remains owned by the Assembly & Resource Engine. This prevents the Takeoff Inspector or drawing component from becoming a second assembly engine.

Estimating consumes assembly outputs, pricing provenance, labor build-up, and holds for commercial review. Estimating does not own a second assembly or formula engine.

At award, the Accepted Scope Snapshot preserves the exact published assembly versions and deterministic outputs accepted for execution. Later assembly revisions or production-history recommendations do not alter that snapshot, the frozen commercial baseline, or existing production-scope allocations.

## Acceptance

The module is acceptable when an estimator can:

- start with an empty company assembly library;
- create an assembly from scratch without developer-written SQL/code;
- create an assembly from a template without inheriting future template changes;
- create a new revision from a published assembly without changing prior jobs;
- author the assembly while remaining in the Takeoff workstation with the live plan in context;
- enter and exit Focus Builder without losing plan viewport/selection context or draft state;
- add and configure typed parent properties;
- drag resources and child assemblies into a recipe;
- bind child properties to parent/Takeoff/project/plan-fact sources;
- build formulas through the interactive UI;
- receive dimensional/formula validation before publication;
- test sample or eligible live Takeoff quantities in the same calculation engine used in production;
- publish an immutable version;
- select the published version in Takeoff;
- trace every resource/labor output to the exact measurement, property source, child component, formula, version, and pricing/production source;
- work without any hard-coded Carez assembly being required or silently inserted into the company library.
