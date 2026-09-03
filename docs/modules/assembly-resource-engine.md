# Module Spec — Assembly & Resource Engine

Status: approved P1 foundation

## Purpose

Provide a concrete-native engine in which each company owns reusable **Concrete Scope Recipes**, resolves project-specific **Scope Variants**, composes repeatable concrete **System Blocks**, and produces deterministic material/labor/equipment outputs from Takeoff geometry.

Canonical lineage:

`Job Spine -> Takeoff Geometry -> Published Scope Recipe Version -> Project Scope Variant -> Deterministic Resource Outputs -> Estimate Items -> Proposal Revision -> Accepted Scope Snapshot -> Frozen Commercial Baseline / Budget`

## Product invariants

- No hard-coded Carez production recipes are silently created for new companies.
- System templates are separate from company recipes and must be explicitly copied to a company draft before publication/use.
- Published company recipe versions are immutable.
- Historical referenced versions remain preserved for exact lineage even when retired from new work.
- Plan facts, estimator method decisions, production assumptions, and commercial assumptions remain distinguishable.
- Missing required inputs, rates, or prices become explicit holds rather than fabricated zeros.
- Quantity and cost calculations remain deterministic and server-authoritative.
- One formula engine governs preview, Takeoff calculation, estimating, and recalculation.
- Production Quantity, Direct Cost, and Sell remain separate.
- Humans remain authoritative for scope, plan interpretation, means/methods, production rates, pricing, margin, and publication.

## Product concepts

### Concrete Scope Recipe

Product-facing name for the reusable company-owned assembly identity/version. Examples include Slab on Grade, Strip Footing, Foundation Wall, Grade Beam, Pad Footing, Sidewalk, Driveway, and other concrete scope.

A recipe may contain typed variables, direct scope items/resources, labor operations, equipment/subcontract outputs, child recipes, formula dependencies, conditions, and production assumptions.

A recipe defines the **possible logic of the scope**, not one fixed job condition. A single Slab recipe can support different thickness, reinforcement, vapor, form, finish, placement, and production configurations through variables and repeatable systems.

### Project Scope Variant

A takeoff-set/job-specific, versioned configuration of one published Scope Recipe. Typical names may follow the drawings: `S1`, `S2`, `F1`, `F2`, `W1`, etc.

A variant can preserve:

- plan facts/dimensions;
- reinforcement configuration;
- optional systems such as vapor barrier or insulation;
- estimator-approved means/methods;
- production assumptions;
- commercial/waste assumptions where applicable;
- exact published Scope Recipe version.

Project Scope Variants prevent global recipe proliferation. They are not new published company recipes and do not mutate the recipe version they configure.

Existing `takeoff_method_profiles` may provide the persistence foundation when extended compatibly with a profile kind/variant code. Historical verified method profiles remain valid.

### Variable

A named typed input or derived value. Supported families include dimension, number/quantity, percentage/factor, boolean, enum/choice, spacing, resource reference, text/note, and derived numeric values.

Variables may be classified as:

- plan fact;
- method decision;
- production assumption;
- commercial assumption;
- derived.

Canonical execution namespaces such as `Takeoff.*`, `Project.*`, `Parent.*`, `PlanFact.*`, and `Properties.*` remain internal calculation concepts. Ordinary estimator UI uses human labels.

### Scope Item / Resource Output

A calculated material, labor, equipment, rental, subcontract, inventory, or other output produced by the recipe.

Resources remain first-class and independently priceable. A Scope Item may bind to a company/catalog product with supplier/SKU/unit/provenance information, but current price is not embedded into physical quantity math.

### System Block

A repeatable concrete-specific calculation primitive that accelerates recipe building without imposing a complete job assembly.

Required System Block families:

- concrete volume;
- continuous reinforcing;
- spaced/transverse reinforcing;
- rebar grid/mat;
- WWF/WWR;
- dowels/starters;
- fiber;
- vapor barrier/retarder;
- formwork/edge forms/wall forms;
- labor operation;
- pump/placement/equipment;
- custom item.

System Blocks may create editable variables, scope items, and deterministic starter formulas. They do not silently approve dimensions, bar size/count/spacing, layers, production rates, waste, prices, products, or means/methods.

Multiple instances are allowed. A footing can contain three continuous bars plus a transverse reinforcing set. A slab can contain one or two rebar mats, WWF, fiber, or no reinforcing. Unique component/property keys must be generated deterministically for repeated blocks.

## Reinforcement model

Reinforcing must not be reduced to a single yes/no variable.

Supported patterns should include:

- **Continuous bars** — bar size + count along measured length;
- **Spaced/transverse bars** — bar size + spacing + individual bar length/source geometry;
- **Grid/mat** — bar size + spacing + directions + layers/mats;
- **WWF/WWR** — area coverage plus overlap/waste/product;
- **Dowels/starters** — spacing/count + bar length;
- **Stirrups/ties** — count/spacing and piece length where appropriate;
- **Fiber** — dosage per concrete quantity;
- **Custom** — estimator-authored deterministic math.

The UI should expose concrete language such as `#5 @ 18 in O.C. each way · 2 mats` while preserving exact underlying variables/formulas.

## Formula engine

Carez retains the deterministic formula AST as authoritative. No arbitrary JavaScript, `eval`, SQL expression strings, or independent math.js runtime may become commercial calculation authority.

Required capabilities include arithmetic; min/max; ceil/floor/round; comparisons; conditionals; enum-driven activation; piecewise/lookup rules; explicit conversions; dependency tracking; cycle rejection; tracing; and publish validation.

Ordinary users must not need to type internal tokens such as `Takeoff.Length`. The guided composer should expose:

- Measured length;
- Measured area;
- Measured count;
- Measured volume;
- Measured perimeter when available;
- named recipe variables;
- numeric constants;
- +, -, ×, ÷, parentheses;
- common conversions such as inches-to-feet and cubic-feet-to-cubic-yards;
- round/round-up/min/max;
- advanced conditional/lookup controls when needed.

Carez hard-codes reliable calculation primitives/helpers, not a closed catalog of job-specific formulas. Generated formulas remain visible/editable to the estimator before publication.

The engine should become unit-aware across common concrete units including IN, FT, LF, SF, CF, CY, EA, LB, TON, HR, MH, GAL, and package/purchase units.

## Formula Composer UX contract

The default estimator-facing formula experience is a **Concrete Formula Composer**, not a raw formula textarea. It combines the following approved interaction model:

1. **Sentence-style calculation building.** The estimator reads and assembles human-labeled tokens such as `Measured length × Sides formed × Form height × Form labor rate`. Internal namespaces remain hidden in normal use.
2. **Concrete calculation blocks.** The composer offers reusable calculation primitives such as measured quantity, continuous runs, spaced locations, stock-length/lap math, coverage, form contact area, volume, labor production, rounding, and custom math. These are helpers, not job assumptions.
3. **Visual conditions.** Optional/conditional outputs are authored as visible `When / And / Then` conditions rather than forcing nested textual `if()` syntax. Multiple conditions may be combined where supported by the canonical rule engine.
4. **Context-aware measurement browser.** Only authoritative geometry available for the Takeoff context is offered. The UI uses labels such as `Measured length`, `Measured area`, `Measured count`, `Measured volume`, and `Measured perimeter` when that geometry is actually available.
5. **Named intermediate calculations.** Complex math may be broken into estimator-named steps such as `Splices per run`, `Added lap`, `Bar length`, and `Total steel`. Named steps are authoring metadata that compile/inline into the final canonical AST; they do not create a second runtime engine.
6. **Unit-aware guidance and validation.** The composer tracks known unit families, flags incompatible addition/subtraction and incompatible final result dimensions, and makes common conversions explicit. Unit guidance must never silently change physical meaning.
7. **Easy + Advanced modes.** Easy mode is the default visual/sentence composer. Advanced mode exposes the synchronized human-readable expression for experienced estimators. Both compile to the same canonical AST; Advanced mode is not a separate calculation engine.

### Formula Composer behavior

- Existing formulas remain editable and can be opened in Advanced mode even when no authoring metadata exists.
- Easy mode may reconstruct a readable calculation from the canonical AST when possible and otherwise fall back to an explicit `Advanced calculation` state without losing the formula.
- Formula tokens reference stable variable keys internally but display estimator-facing labels.
- Unknown variable references are rejected before save and again before publish.
- Named calculation steps must reject duplicate names, unresolved references, and dependency cycles.
- Formula conditions reuse the canonical rule/activation engine rather than embedding business logic in UI-only state.
- The final persisted `quantity_formula` / `labor_rate_formula` AST remains sufficient for authoritative calculation even if authoring metadata is unavailable.
- Authoring metadata may preserve Easy-mode step labels/layout, but it cannot override or replace the canonical AST.
- Formula preview/Test Bench and production calculation must evaluate the same AST and resolved property context.
- Published recipe formulas and their authoring metadata are immutable; edits require a new draft revision.
- Publish is blocked by invalid AST, unresolved variables, invalid/cyclic named steps, or deterministic unit-validation errors that make the result dimensionally incompatible.

### Example reading model

A complex reinforcing calculation should be understandable without reading programming syntax:

`WHEN Bars in run > 0 AND Stock length > 0`

- `Splices per run = max(0, round up(Measured length ÷ Stock length) - 1)`
- `Added lap = Splices per run × Lap length`
- `Bar length = Measured length + Added lap`
- `Total steel = Bar length × Bars in run`

The estimator may inspect/edit the synchronized Advanced expression, but the normal workflow remains the readable calculation sequence above.

## Quantity separation

Keep distinct:

1. installed/theoretical quantity;
2. procurement quantity after waste/package/stock/minimum-order/rental rounding;
3. reusable inventory demand.

Examples: slab vapor installed SF -> procurement rolls; rebar installed LF/LB -> stock bars/bundles/tons; concrete theoretical CY -> order quantity -> later placed/returned actuals; reusable form hardware -> required inventory without pretending every piece is consumed.

## Labor and production

Labor is an operation/resource, not a generic allowance. Preserve physical production quantity/unit, baseline MH/unit/source, historical evidence when available, estimator-reviewed job MH/unit, resulting MH, loaded labor rate/provenance, and direct labor cost.

Changing productivity changes man-hours, not material quantity unless the method explicitly changes physical demand.

## Recipe Editor UX contract

Primary authoring is a **movable/resizable popup Recipe Editor inside the Takeoff workstation**.

It must:

- remain on the same Takeoff route;
- leave the live plan visible behind it;
- leave the permanent Quantity Worksheet as the normal bottom worksheet;
- be draggable from its title bar;
- be resizable horizontally and vertically within safe workstation bounds;
- persist useful local size/position where practical;
- support Focus/Maximize and Restore as the same editor/state;
- preserve sheet, viewport, zoom/pan, calibration, selected measurement, and draft state;
- never mutate geometry merely by opening/moving/resizing/focusing/closing;
- avoid turning the permanent Inspector into the full authoring surface.

The Inspector remains contextual: selected recipe/version/variant, current inputs, holds, key outputs, and commands to create/edit/open the Recipe Editor.

### Entry paths

Support:

- Create Blank Scope Recipe;
- Start From Template;
- Duplicate Company Recipe;
- Edit Existing Draft;
- Create Revision from Published Version.

A small movable setup dialog may collect recipe name/code/category/primary measurement before opening the Recipe Editor.

### Default recipe reading order

Normal UI should use plain construction language:

- **Variables** / plan inputs;
- **Systems**;
- **Materials & labor**;
- **Test Bench**.

Advanced dependencies, namespace details, and JSON remain progressive disclosure/expert territory.

### System Block experience

The Recipe Editor must provide a concrete-focused `+ Add system` experience with the required System Block families. Adding the same family multiple times must work. Each inserted block opens a focused configuration editor appropriate to that pattern.

Examples:

- `Continuous rebar` -> bar size, count, measured basis, allowance/product;
- `Rebar grid/mat` -> bar size, spacing, directions, layers;
- `WWF/WWR` -> area basis, overlap/waste, product;
- `Vapor barrier` -> area basis, overlap/waste, product;
- `Formwork` -> measured basis, height/depth, sides, reusable/consumed resources;
- `Labor operation` -> production quantity/unit and MH/unit;
- `Concrete volume` -> area/length geometry plus thickness/width/depth as applicable.

### Focus Builder

Focus Builder maximizes the same popup Recipe Editor to most of the Takeoff workspace. Restore returns to the prior position/size with all draft state retained. It is not a separate route or second authoring implementation.

### Test Bench

A draft can test representative manual inputs or an eligible live/current Takeoff measurement and preview resolved variables, children, concrete, reinforcing, formwork, vapor/insulation, labor MH, equipment/subcontract, quantity separation, holds, trace, and provenance through the same production engine.

## Project Scope Variant UX

After a recipe is published and selected for a job, the estimator can save reusable project-specific variants such as `S1` or `F2`.

Variant editing should present the active plan facts and estimator decisions in compact groups and save a versioned verified configuration. Selecting a Project Scope Variant applies its resolved inputs to new Takeoff measurements. If its governed values change, Carez requires a new verified variant revision rather than silently changing prior measurements.

Historical legacy build-method profiles remain selectable/traceable during transition.

## Template experience

Templates are optional structural starting patterns organized by concrete scope. They may include example variables/formulas/resource roles and source notes but never silently become company pricing or production truth. `Use Template` creates an independent company draft.

## Concrete-native resource coverage

Support ready-mix; reinforcing bars/mesh/fiber/dowels/chairs/tie wire; vapor materials; insulation; form panels/lumber/ties/brackets/walers/strongbacks/stakes/braces/release agents/reusable hardware; joints/fillers/sealants/dowel systems/sawcuts; embeds/anchors/inserts; curing; finishing; pumps/placement equipment; rentals; subcontractors; consumables; and other explicit resources.

Reference values from books/manufacturers may be shown with provenance but never silently promoted to company defaults.

## Removal of legacy hard-coded assemblies

Stop creating seeded Carez production assemblies for companies; remove them from active new-work selectors; preserve referenced historical versions as hidden/retired lineage; remove unreferenced seed records only after dependency-safe verification; recreate useful examples as Templates rather than live company recipes.

## Integration boundaries

Takeoff owns authoritative physical geometry. The Assembly & Resource Engine converts that geometry plus resolved Scope Variant inputs into physical resource/labor outputs. Estimating consumes those outputs and owns pricing review/Sell; it does not create a second recipe/formula engine.

At award, the Accepted Scope Snapshot preserves exact recipe versions, variants/assumptions, Takeoff outputs, and pricing provenance used by the accepted commercial state.

## Acceptance

Representative acceptance includes:

- empty company recipe library works;
- create from blank/template/duplicate/revision without SQL/code;
- popup Recipe Editor moves/resizes and retains useful state;
- Focus/Restore preserves plan and draft context;
- Quantity Worksheet remains available during normal authoring;
- typed variables can be created/edited;
- System Blocks can be inserted repeatedly;
- slab/footing examples can represent no reinforcing, WWF, continuous bars, spaced bars, one/two mats, vapor yes/no, and multiple reinforcing sets;
- Formula Composer Easy mode can build nontrivial concrete math without internal namespace typing;
- context measurement browser only offers available authoritative geometry;
- visual multi-condition rules can activate/deactivate outputs;
- named intermediate calculation steps persist as authoring metadata, reject cycles/unresolved references, and compile to the canonical AST;
- unit-aware guidance catches dimensionally invalid calculations before publish;
- Advanced mode remains synchronized with the same deterministic formula authority;
- sample/live Takeoff Test Bench uses the production engine;
- Project Scope Variants such as S1/F1 can be saved, selected, revised, and bound to measurements;
- published recipe versions remain immutable;
- exact recipe/variant/component/resource/estimate lineage remains traceable;
- no hard-coded Carez production recipe is silently required or inserted.