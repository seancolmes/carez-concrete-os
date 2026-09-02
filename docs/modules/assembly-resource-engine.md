# Module Spec — Assembly & Resource Engine

Status: approved P1 foundation

## Purpose

Provide a concrete-native engine in which each company builds and owns its own assemblies, properties, formulas, resources, production assumptions, and published recipes.

Carez must not ship or seed hard-coded selectable production assemblies into a company's working library. System-provided examples belong in a separate template catalog and become company-owned assemblies only when an estimator explicitly creates a draft from a template.

Canonical lineage:

`Takeoff Geometry -> Published Company Assembly Version -> Deterministic Resource Outputs -> Estimate Items -> Proposal -> Frozen Budget`

## Product invariants

- No hard-coded Carez production assemblies are created for new companies.
- Hard-coded assembly seed/initialization behavior is removed from the product runtime and migrations going forward.
- System templates are not live assemblies and cannot be selected for Takeoff until copied into a company-owned draft and published.
- Published company assembly versions are immutable.
- Existing published assembly versions already referenced by historical Takeoff, estimate, proposal, or budget records must retain lineage. They may be retired and hidden from new work but must not be destructively deleted while referenced.
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

The Assembly Studio should make formula authoring readable and visual while compiling to the same deterministic AST used by the server.

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

## Assembly Studio UX contract

Assembly creation is too complex for the Takeoff right Inspector and must not be implemented as a long stack of ordinary form fields inside that pane.

The primary authoring experience is a dedicated full-page **Assembly Studio** inside the permanent Carez desktop shell.

Takeoff should provide only lightweight assembly selection, method/profile interaction, status/holds, and a clear command to open the selected assembly in Assembly Studio when authorized.

### Interaction model

The Studio should feel like assembling a concrete recipe rather than filling out a database form.

Core interaction patterns:

- drag blocks from a palette onto a structured builder canvas;
- reorder blocks by drag-and-drop;
- connect property/output dependencies with constrained visual links or explicit mapping chips;
- add a child assembly by dragging it into the recipe;
- drag resources into output/labor/equipment sections;
- configure a selected block inline, in a focused popover/sheet, or an expandable block rather than relying on a permanent overloaded right pane;
- show inherited parent values as compact source chips;
- show units and provenance directly on blocks;
- show missing inputs and invalid formulas at the block that causes them;
- provide undo/redo while editing a draft;
- keep published versions read-only.

The canvas should be structured enough to avoid free-form node-graph spaghetti. A recommended organization is a compact vertical recipe with clear lanes for **Inputs / Methods**, **Logic / Child Assemblies**, and **Resource Outputs**, with a live result shelf or Test Bench below.

### Test Bench

A draft assembly must support sample testing before publication.

The estimator can enter representative Takeoff quantities/properties and immediately inspect:

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

Assembly Studio should provide:

- Create Blank Assembly;
- Start From Template;
- Duplicate Company Assembly;
- Create Revision from Published Version.

Templates should be visually browsable by concrete scope such as foundations, walls, slabs/flatwork, reinforcement, formwork methods, placement, finishing, joints, curing, embeds, and specialty concrete.

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

Estimating consumes those outputs, pricing provenance, labor build-up, and holds for commercial review. Estimating does not own a second assembly or formula engine.

## Acceptance

The module is acceptable when an estimator can:

- start with an empty company assembly library;
- create an assembly from scratch without developer-written SQL/code;
- create an assembly from a template without inheriting future template changes;
- add and configure typed parent properties;
- drag resources and child assemblies into a recipe;
- bind child properties to parent/Takeoff/project/plan-fact sources;
- build formulas through the interactive UI;
- receive dimensional/formula validation before publication;
- test sample quantities in the same calculation engine used in production;
- publish an immutable version;
- select the published version in Takeoff;
- trace every resource/labor output to the exact measurement, property source, child component, formula, version, and pricing/production source;
- revise by creating a new draft version without changing prior jobs;
- work without any hard-coded Carez assembly being required or silently inserted into the company library.
