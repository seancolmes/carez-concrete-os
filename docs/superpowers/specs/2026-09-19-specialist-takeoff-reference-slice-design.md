# Specialist Takeoff Reference Slice Design

Status: Conversational design approved; written spec awaiting review  
Date: 2026-09-19  
Subproject: 5 — Specialist reference slice  
Reference journey: `Project → Takeoff`  
Planning base: `b319f5152246e33f06d22785f5d10cffa73473fe`  
Repository: `seancolmes/carez-concrete-os`  
Branch: `staging`

## 1. Purpose

Subproject 5 proves the accepted Carez OS UI foundation inside the highest-density specialist estimating workflow:

```text
Project / Estimate lineage
        ↓
Takeoff Set
        ↓
Plans / Conditions / Zones
        ↓
2D authoritative measurement
        ↓
Condition Properties
        ↓
Quantity / Estimate Worksheet
        ↓
Estimate lineage
```

This slice is not a cosmetic restyle of the current Takeoff workstation. It is the specialist reference implementation for the approved Carez major UI/UX redesign.

The design combines:

- the estimator workflow patterns that make The EDGE useful for concrete estimating;
- Carez Concrete Condition domain authority;
- ADR-024 Precision Grid visual/theme/token/density authority;
- ADR-020 workstation invariants that remain current;
- the active Takeoff module contract;
- persisted normalized page-coordinate 2D/vector geometry as quantity authority;
- derived 3D as synchronized verification only;
- explicit Production Quantity, Direct Cost, and Sell separation;
- existing immutable/versioned Estimate and Takeoff lineage.

The target is one coherent professional estimating workbench where the estimator can answer, without leaving the workstation:

- what sheet is active;
- what concrete Condition is active;
- what physical properties define it;
- what measurement roles it requires;
- what geometry has been measured;
- what production/resource/labor outputs were generated;
- what direct-cost state exists;
- what remains unresolved;
- what Estimate revision the Takeoff feeds;
- and, when present, what Project lineage the Estimate belongs to.

## 2. Authority and governing documents

The following remain authoritative throughout this slice:

- ADR-024 for Precision Grid visual/theme/token/density and current shell behavior;
- ADR-020 for integrated Takeoff workstation invariants that have not been superseded;
- the active `docs/modules/takeoff.md` contract for current Takeoff behavior;
- newer accepted 3D decisions/contracts where they supersede older ADR-020 assumptions;
- `docs/design-system/CAREZ_COMPONENT_PACK.md` for shared Carez component responsibilities;
- root `AGENTS.md` and `CODEX.md` for repository/execution rules;
- Supabase/PostgreSQL as source of truth;
- existing `company_id` tenant isolation and RLS;
- existing server-authoritative quantity, resource, labor, cost, pricing, and Estimate reconciliation logic;
- immutable/versioned Estimate, Proposal, Award, Project, and Takeoff lineage.

The active Takeoff contract supersedes older ADR-020 wording that described a `2D | 3D | Split` estimator view. The approved specialist reference exposes:

```text
2D | 3D
```

There is no Split mode in Subproject 5.

## 3. EDGE-informed product direction

The EDGE is a workflow reference, not a visual template and not a domain authority.

Carez preserves the useful estimator mental model:

```text
Choose Condition
      ↓
confirm plan facts + means/methods
      ↓
measure
      ↓
see quantity/resource/labor/cost effects
      ↓
resolve holds
      ↓
verify in 2D / 3D
      ↓
continue estimating
```

The reference slice therefore favors:

- named concrete Conditions rather than generic formulas;
- direct plan/Condition/properties/worksheet continuity;
- immediate takeoff-to-estimate population;
- persistent Condition organization;
- concrete-native property areas;
- a dense desktop workbench with simultaneous context;
- progressive disclosure for uncommon configuration;
- fast review of unresolved scope, labor, resource, and pricing state.

Carez intentionally differs from traditional desktop estimating software by preserving explicit authority, provenance, immutable lineage, dual-theme accessibility, server-authoritative calculation, synchronized 2D/3D verification, and modern keyboard/state behavior.

## 4. Scope

### 4.1 In scope

Subproject 5 includes the active specialist reference path centered on `/takeoff/[setId]`:

- outer Takeoff identity and Estimate/optional Project lineage presentation;
- Plans / Conditions / Zones contextual navigator;
- one governed Condition Properties surface;
- dominant authoritative 2D canvas;
- derived 3D verification view;
- specialist view rail and toolbar;
- Condition-role-driven measurement initiation;
- synchronized selection across navigator, 2D/3D, Properties, and Worksheet;
- explicit save/recalculate and trust-state presentation;
- Quantity / Estimate Worksheet with purpose-built views;
- removal of active reference-path dependence on duplicate legacy Inspector composition;
- removal of active reference-path dependence on DOM-repurposing and broad compatibility-theme selectors;
- adoption of ADR-024 semantic light/dark specialist presentation;
- keyboard/focus/accessibility hardening;
- desktop/laptop/tablet/mobile containment behavior;
- minimal Project Overview / Estimate entry actions needed to prove the approved lineage journey;
- focused shared UI extensions only where the specialist workstation legitimately requires them;
- tests and rendered acceptance proving the specialist reference.

### 4.2 Explicit non-goals

Subproject 5 does not:

- move Takeoff ownership from Estimate to Project;
- add a nested `/projects/[id]/takeoff` route;
- broaden Issue #71 authoritative Project Context routes;
- change persisted page-coordinate geometry authority;
- add a second quantity engine;
- make derived 3D commercially authoritative;
- add BIM-authoring behavior;
- redesign Takeoff formulas/calculation rules;
- redesign Condition/version/module/role schema;
- redesign Estimate Sell, margin, overhead, tax, proposal, or award authority;
- add silent autosave for Condition commercial/quantity-affecting inputs;
- implement a new company-wide saved-view/reporting subsystem;
- implement full mobile precision Takeoff authoring;
- broadly refactor unrelated legacy Takeoff paths;
- add or redesign RLS unless an unavoidable separately reviewed defect is discovered;
- implement wholesale supplier/manufacturer catalog acquisition or document ingestion;
- touch `main`.

## 5. Outer lineage contract — approved Option A

Takeoff remains Estimate-authoritative.

The authority chain is:

```text
Takeoff Set
    ↓ belongs to
Estimate Revision
    ↓ may link to
Project
```

Project is lineage/context when present; it does not own the Takeoff record.

Therefore `/takeoff/[setId]` does not become an Issue #71 Project Context route.

### 5.1 Identity header

The specialist header should present, compactly:

```text
TAKEOFF

Foundation / Structural Set
EST-2418-03 · Revision 3 · Working

Project 2418 · Smith Residence    when lineage exists
12 sheets · 18 Conditions · 3 holds

[Open Estimate] [More]
```

Identity order:

1. Takeoff set;
2. Estimate revision;
3. optional Project lineage;
4. current record/status summary.

The Project relationship is explicitly labeled as lineage, not ownership.

### 5.2 Entry paths

All valid entry paths resolve to the same Takeoff set:

```text
Opportunity / Estimate
        ↓
Takeoff
```

```text
Estimate Revision
        ↓
Takeoff
```

```text
Awarded Project
        ↓
originating/linked Estimate lineage
        ↓
Takeoff
```

Project Overview may expose an `Original Takeoff` or equivalent related-workflow action only when authoritative lineage resolves the exact Estimate/Takeoff record.

If multiple revisions exist, the UI must identify them explicitly rather than guessing.

### 5.3 Return actions

Takeoff provides explicit return paths:

- Open Estimate;
- Open Project when Project lineage exists.

Browser history is not the only return mechanism.

## 6. Specialist workstation architecture

The canonical desktop composition is:

```text
CAREZ GLOBAL SHELL
────────────────────────────────────────────────────────────────────────────
TAKEOFF IDENTITY / ESTIMATE REVISION / OPTIONAL PROJECT LINEAGE
────────────────────────────────────────────────────────────────────────────

┌───────────────────┬─────────────────────────────────┬─────────────────────┐
│ CONTEXT NAVIGATOR │                                 │ CONDITION           │
│                   │                                 │ PROPERTIES          │
│ Plans             │        DRAWING CANVAS           │                     │
│ Conditions        │                                 │ General / Scope     │
│ Zones             │        2D  |  3D                │ Concrete            │
│                   │                                 │ Forms               │
│ search/filter     │        measure / edit           │ Rebar               │
│ visibility        │        select / verify           │ Excavation          │
│ status / holds    │                                 │ Labor               │
│                   │                                 │ Review              │
│                   │                                 │ Drawing / More       │
├───────────────────┴─────────────────────────────────┴─────────────────────┤
│ QUANTITY / ESTIMATE WORKSHEET                                             │
│ Quantities | Resources | Labor | Pricing | Holds | Recap                  │
└────────────────────────────────────────────────────────────────────────────┘
```

The four specialist surfaces remain simultaneously visible on normal desktop:

1. Context Navigator;
2. dominant Canvas;
3. Condition Properties;
4. Quantity / Estimate Worksheet.

The canvas receives the largest share of screen area.

## 7. Direct composition replaces compatibility composition

The current incremental architecture wraps the full legacy `TakeoffDrawingWorkspace`, repurposes/hides internal panes through DOM assumptions and CSS, portals Condition content, and uses global browser events for synchronization.

The reference target becomes direct composition:

```text
TakeoffSpecialistWorkspace
├── TakeoffContextNavigator
├── TakeoffCanvasWorkspace
├── ConditionProperties
└── TakeoffWorksheet
```

The active Condition reference path must no longer depend on:

- locating the first/last `aside` inside another complete workstation;
- hiding a duplicate legacy Inspector;
- broad `[class*="..."]` compatibility selectors to restyle internal implementation;
- browser-wide CustomEvents as the normal pane synchronization contract.

The design does not require a repository-wide purge of all historical compatibility code. It requires that the accepted reference path no longer depends on it.

## 8. Plans / Conditions / Zones navigator

The left pane answers three separate estimator questions:

```text
Plans      → where is the work?
Conditions → what is the work?
Zones      → how is the work grouped?
```

The tabs remain in fixed order:

```text
Plans | Conditions | Zones
```

This is a Takeoff-local contextual pane, not global application navigation.

### 8.1 Conditions — primary estimator tab

Conditions is the normal scope-creation/estimating tab.

A Condition row communicates enough to identify and judge the object without opening Properties:

- Condition color;
- code;
- estimator-readable name;
- family/profile summary;
- primary measurement role/unit;
- measurement count;
- current production quantity when calculated;
- concise calculation/hold state;
- visibility state.

Example:

```text
■ F-01  Strip Footing
        24" × 12" · LF
        3 takeoffs · 124 LF
                          Ready
```

or:

```text
■ S-04  Garage Slab
        5" SOG · SF
        1 takeoff · 1,842 SF
                          2 holds
```

### 8.2 Condition hierarchy

Conditions group primarily by Condition family/category, not by sheet:

```text
▼ Foundations
    F-01  24" × 12" Strip Footing
    F-02  30" × 12" Strip Footing
    F-03  4' × 4' Pad Footing

▼ Slabs
    S-01  4" Interior SOG
    S-02  5" Garage Slab

▼ Walls
    W-01  8" Foundation Wall
```

A Condition can be measured across multiple sheets without becoming multiple Conditions unless the estimator explicitly creates separate scope definitions.

### 8.3 Condition creation and duplication

The navigator provides a clear `+ Condition` action.

Initial creation is estimator-oriented:

```text
+ Condition
→ choose family
→ name / code / key required identity
→ create
→ select
→ finish detailed configuration in Properties
```

Do not require every module/resource input before the Condition can exist.

Duplicate is a first-class estimator workflow for similar scope. Duplication preserves only what the existing Condition/version contracts permit and creates a new Condition identity.

### 8.4 Visibility and isolation

The navigator may directly control:

- visible;
- hidden;
- isolated.

These are presentation states only. They do not change quantity, estimate inclusion, module inclusion, or lineage.

### 8.5 Search and filters

Search may match existing display identities such as:

- code;
- name;
- family;
- role.

Compact filters may include equivalent forms of:

- All;
- Visible;
- Measured;
- Needs work.

`Needs work` reflects existing hold/review state; it is not a new hidden quality score.

### 8.6 Plans

Plans answers where the estimator is measuring.

Rows may show:

- sheet number;
- sheet title;
- revision when available;
- page number;
- scale/calibration state;
- measurement count;
- current selection.

Scale readiness is first-class:

```text
S2.1 Foundation Plan
Scale set

S5.2 Enlarged Detail
Scale required
```

Changing sheets preserves valid cross-sheet specialist context, including active Condition and visibility, while clearing page-specific transient state such as active edit handles and incompatible draft geometry.

### 8.7 Zones

Zones are grouping/filter context, not Condition ownership and not quantity authority.

A Condition can have measurements in multiple Zones.

The UI must not infer building/level/pour/alternate relationships that are not represented authoritatively.

No Zones is a valid state and does not block Takeoff.

### 8.8 Cross-tab continuity

Switching among Plans / Conditions / Zones does not discard the active Condition.

The navigator may retain a restrained context strip for active Condition or active sheet when the corresponding tab is not visible.

## 9. Selection model

The workstation maintains related but distinct selection concepts:

- active Condition;
- active Condition role;
- selected measurement;
- active sheet;
- optional Zone/filter context.

Selecting a Condition synchronizes:

```text
Navigator
↕
Condition Properties
↕
2D/3D Condition emphasis
↕
Worksheet Condition group
```

Selecting a measurement synchronizes:

```text
2D/3D measurement
↕
owning Condition
↕
role context
↕
Worksheet row
↕
Properties context
```

Stable domain IDs drive synchronization. The UI never matches by display name, color, or geometry similarity.

A Condition may remain active while one of several measurements belonging to it is selected.

## 10. Condition Properties — one governed authority surface

The right pane is `Condition Properties`, not a generic Takeoff Inspector.

There is exactly one active property-authority surface.

The pane has four layers:

```text
Condition identity + state
↓
concrete-native property tabs
↓
calculated outputs / issues
↓
save / recalculation state
```

### 10.1 Identity

The header communicates:

- Condition color;
- code;
- name;
- family;
- Condition/version/contract identity where relevant;
- measurement count;
- current quantity where calculated;
- save/calculation/lock state.

Representative states:

- Saved / Ready;
- Unsaved;
- Pending recalculation;
- Calculation hold;
- Qty ready · Price missing;
- Not calculated;
- Locked.

### 10.2 Capability-driven tabs

The approved property vocabulary is:

```text
Scope
Concrete
Forms
Rebar
Embeds
Excavation
Placement
Finish / Cure
Labor
Review
Drawing
More
```

Tabs appear only where supported by the active Condition contract.

Concrete-native terminology takes precedence over generic formula/assembly vocabulary.

## 11. Scope tab and measurement roles

Scope always appears first.

It contains:

1. Measurement Roles;
2. Plan Facts.

### 11.1 Primary role

Every Condition contract identifies its required primary measurement role.

Examples:

| Condition | Primary role |
| --- | --- |
| Strip footing | Footing Run · LF |
| Slab | Slab Area · SF |
| Pad footing | Footing Locations · EA |
| Wall | Wall Run · LF |

The UI expresses estimator intent:

```text
PRIMARY MEASUREMENT
Footing Run · LF

No takeoff assigned
This role is required before calculation.

[Measure Footing Run]
[Assign Existing]
```

rather than exposing internal implementation language such as generic polyline/assembly selection.

### 11.2 Secondary roles

Secondary measurements remain first-class Condition roles, for example:

- anchors/embeds;
- blockouts;
- openings;
- thickened sections;
- other contract-supported roles.

Each role presents:

- role name;
- unit;
- required/optional;
- assigned measurement state;
- Locate;
- Measure/Add;
- Assign Existing where supported.

Primary and secondary measurements remain part of one Condition.

### 11.3 Existing measurement assignment

Only compatible existing geometry can satisfy a role.

The UI must not assign an incompatible LF/SF/EA measurement merely because it exists on the same sheet.

Existing domain role compatibility remains authoritative.

## 12. Construction modules

Modules are construction systems, not formulas.

Each applicable module starts with explicit inclusion state.

Examples:

### Concrete

May expose:

- section dimensions;
- mix/class;
- additives;
- waste/order assumptions;
- installed quantity;
- procurement/order quantity.

Installed/production quantity and procurement quantity remain distinct.

### Rebar

Behaves like a governed set editor for supported repeating reinforcing sets:

- longitudinal sets;
- dowels;
- spacing/count;
- cover/lap source;
- additional sets.

Carez never invents structural design assumptions.

### Forms

May expose:

- formed faces;
- system/method;
- panel/material assumptions;
- bulkheads;
- reusable resources;
- labor basis.

### Embeds / Excavation / Placement / Finish-Cure

Expose concrete-native inputs relevant to the Condition family.

Turning a module off changes inclusion according to existing domain/version behavior; the UI does not silently delete historical configuration.

## 13. Labor / productivity

Labor is human-authoritative.

The Labor tab makes production assumptions inspectable and editable only through existing governed inputs.

It may expose concepts such as:

- crew size;
- production rate;
- MH/unit;
- crew-rate basis;
- method;
- baseline/provenance.

Carez may supply governed defaults where supported, but no AI/system suggestion silently becomes authoritative.

The user retains authority over crew, production, method, labor conversion, and final job rate.

## 14. Provenance and authority

Condition input provenance becomes visible.

Where persisted provenance supports it, fields may identify sources such as:

- PLAN;
- PROJECT;
- COMPANY;
- PLATFORM;
- MANUAL.

The UI does not infer provenance from the value.

Inherited vs overridden values are explicit.

Where current domain behavior supports reverting an override, the UI may provide a `Use inherited value` action through the owning resolution contract.

Calculated outputs are visually non-editable and distinct from inputs.

## 15. Save & Recalculate

Takeoff Properties retains explicit commit behavior.

No silent autosave.

The authoritative flow remains:

```text
edit local Condition draft
↓
Unsaved changes
↓
Save & Recalculate
↓
validated server/domain command
↓
persist versioned Condition/module/role/input state
↓
recalculate outputs
↓
reconcile generated Estimate lineage
↓
refresh authoritative state
```

Shared Carez trust/state primitives should express, where appropriate:

- saved;
- saving;
- unsaved;
- validation required;
- save failed;
- authority/provenance;
- warning/error/hold feedback.

Representative states:

```text
Saved · Ready
Unsaved changes
Saving & recalculating…
Saved · 2 calculation holds
Qty ready · Price missing
Save failed
```

Unsaved user edits remain visible after failure.

## 16. Unsaved-change guard

Condition changes that would replace the active draft require an explicit guard.

Attempting to switch Conditions while dirty should offer equivalent choices:

- Cancel;
- Discard;
- Save & Switch.

The same guard applies to cross-surface navigation that would replace the active Condition draft.

Changing sheets does not inherently replace the Condition and should not trigger the same guard when the draft remains valid.

## 17. Review, holds, and calculated outputs

### 17.1 Review

Review is the Condition preflight, not another estimate grid.

It summarizes readiness of applicable modules and commercial completeness, for example:

```text
Concrete        Ready
Forms           Ready
Reinforcing     1 hold
Embeds          Not included
Labor           Ready
Pricing         Price missing
```

### 17.2 Holds

Holds route directly to the owning decision.

Examples:

- elevation required → Scope/Drawing;
- reinforcing input missing → Rebar;
- labor rate missing → Labor/Pricing;
- estimate section missing → Review;
- direct resource price missing → Pricing;
- commercial Sell/margin issue → Estimate.

### 17.3 Calculated outputs

Calculated Outputs remains a subordinate explanation surface inside Properties.

It can show:

- output label;
- production quantity;
- unit;
- direct cost;
- pricing/calculation state;
- source/lineage drill-down.

The bottom Worksheet remains the estimate-wide working surface.

## 18. 2D/3D Canvas architecture

The center surface becomes an explicit Canvas workspace:

```text
TakeoffCanvasWorkspace
├── TakeoffViewRail
├── TakeoffToolBar
├── Takeoff2DCanvas
├── Takeoff3DViewport
└── TakeoffCanvasStatus
```

The View rail changes representation:

```text
[2D] [3D]
```

The Tool rail changes interaction mode.

These concerns remain separate.

## 19. 2D authority

Persisted normalized page-coordinate vector geometry remains the sole Takeoff geometry authority.

The authoritative chain is:

```text
PDF sheet
↓
calibrated page coordinates
↓
persisted vector geometry
↓
measurement quantity
↓
Condition role
↓
Condition calculation
↓
Estimate outputs
```

2D owns creation/editing of:

- LF runs;
- SF polygons;
- EA/count geometry;
- cutouts/holes;
- vertices;
- scale/calibration;
- measurement identity;
- persisted geometry.

Three.js/WebGL coordinates never become commercial quantity authority.

## 20. Specialist toolbar

Toolbar groups are activity-oriented.

### Navigation

- Select;
- Pan.

### Measurement / geometry

Contextual actions use Condition-role language where possible:

- Measure Footing Run;
- Measure Slab Area;
- Place Anchor;
- Edit;
- Cutout;
- Duplicate where valid.

### Drawing aids

- Snap;
- Ortho.

Subproject 5 preserves current snap/ortho capabilities. It does not broaden into a new CAD inference engine.

### Calibration

- Scale / scale regions.

Scale readiness is always visible.

### History

- Undo;
- Redo.

### View/navigation

- Fit;
- zoom/navigation utilities where useful.

The toolbar simplifies itself based on active Condition, selected geometry, and lock state.

## 21. Measurement initiation and role assignment

Starting a role measurement from Condition Properties creates an explicit workstation intent containing the active Condition/version, role, and governed tool type.

The Canvas:

1. switches to 2D;
2. retains active Condition;
3. ensures a valid active sheet;
4. enforces required scale/calibration;
5. enters the compatible measurement tool;
6. changes cursor/state guidance;
7. commits stable geometry when finished;
8. assigns the returned measurement ID to the pending Condition role through existing domain authority;
9. preserves active Condition and selects the measurement;
10. marks the Condition draft/output state appropriately for Save & Recalculate.

The target reference path should use explicit state/callback interfaces for this flow rather than normalizing global browser events as the core contract.

## 22. Drawing state machine

Exactly one geometry-affecting tool owns pointer input at a time.

Representative states:

- SELECT;
- PAN;
- MEASURE;
- EDIT;
- CUTOUT;
- CALIBRATE;
- SCALE REGION.

Draft geometry is visibly provisional and is not authoritative until committed.

`Esc` cancels draft work without persisting a measurement.

Edit mode preserves stable measurement identity where current domain behavior allows it.

Cutouts remain geometric holes in the authoritative polygon model rather than negative Estimate lines.

Measurement duplication copies physical geometry; it does not implicitly create a new Condition.

## 23. Precision Cursor

ADR-020 Precision Cursor remains part of the specialist expression on fine-pointer desktop devices.

Expected cursor mapping:

| State | Cursor |
| --- | --- |
| Select/normal | Carez precision arrow |
| Link/button | pointer |
| Measurement | precision crosshair |
| Calibration | precision crosshair |
| Vertex edit | precision crosshair |
| Pan | grab |
| Active pan | grabbing |
| Text/number field | native text |
| Worksheet height resize | `ns-resize` |
| Worksheet column resize | `col-resize` |
| Disabled | `not-allowed` |

The measurement crosshair hotspot identifies the exact coordinate being committed.

Custom cursor treatment never replaces visible keyboard focus.

## 24. Snap, Ortho, calibration, and status

Snap may target compatible existing/draft vertices according to current geometry behavior. Visual feedback must show when a point is actually snapped.

Ortho previews the constrained point before commit.

Scale state is always visible.

If physical LF/SF measurement requires calibration and the active sheet/region has no valid scale, measurement is blocked or routed into calibration. Carez never silently derives physical quantity from uncalibrated drawing coordinates.

The Canvas status bar communicates current interaction, for example:

```text
S2.1 · Scale set · Snap on · F-01 Strip Footing
```

or:

```text
F-01 · Footing Run
Click points · Enter/right-click to finish · Esc to cancel
```

It is interaction guidance, not debug narration.

## 25. Keyboard model

Desktop specialist shortcuts preserve high-speed estimating behavior.

Representative target:

```text
Space                 temporary pan
M                     active Condition measurement role
E                     edit selected
D                     duplicate selected
K                     cutout where valid
Arrow keys            nudge selected
Shift + Arrow         larger nudge
Ctrl/Cmd + Z          undo
Ctrl/Cmd + Shift + Z  redo
PageUp / PageDown     sheet navigation
S                     snap
O                     ortho
Enter                 finish/save active drawing action
Esc                   cancel active tool
```

Single-key drawing shortcuts do not fire while focus is inside text fields, number fields, selectors, Worksheet editors, or other control contexts.

## 26. Derived 3D contract

3D is a synchronized verifier.

The derivation path is:

```text
authoritative 2D geometry
+
governed Condition dimensions/elevations/references
↓
derived shape facts
↓
3D verification scene
```

3D does not calculate official:

- LF;
- SF;
- EA;
- CY;
- LB;
- MH;
- Direct Cost;
- Sell.

Never:

```text
mesh volume
→ official concrete quantity
```

Instead:

```text
2D measurement
→ server/domain Condition calculation
→ production quantity

same authoritative facts
→ derived 3D mesh
→ verification
```

### 26.1 3D behavior

Preserve useful current capabilities:

- Home;
- Top;
- Focus;
- Filters;
- 3D Checks;
- orbit/pan/zoom;
- Condition visibility;
- isolate;
- zone/elevation filtering where current data supports it;
- click-through selection;
- per-sheet camera memory.

### 26.2 3D verification language

The viewport should identify itself subtly as derived verification.

Representative states:

- Derived 3D;
- Partial 3D · inputs required;
- Preview · unsaved Condition changes.

Missing 3D inputs create explicit holds. Carez does not guess elevation, height, depth, or reference plane.

A 3D hold does not invalidate valid authoritative 2D geometry or quantity calculation unless the same missing input is genuinely required by the Condition quantity contract.

### 26.3 3D failure

WebGL/render/mesh failure degrades only 3D.

The following remain operational:

- 2D;
- persisted geometry;
- Condition Properties;
- Worksheet;
- authoritative quantity/cost outputs.

## 27. 2D/3D continuity

Switching between 2D and 3D preserves valid shared context:

- active sheet;
- active Condition;
- selected measurement;
- Properties context;
- Worksheet context;
- visibility/filter state.

Selecting a 2D measurement highlights/focuses the matching 3D solid where derivation exists.

Selecting a 3D solid selects/reveals the matching authoritative measurement/Condition in 2D and other panes.

Stable IDs drive this synchronization.

## 28. Drawing-focused collapse behavior

Navigator and Properties are independently collapsible.

Worksheet is vertically resizable/collapsible.

Maximum canvas mode can become:

```text
Navigator  → collapsed rail
Properties → collapsed rail
Worksheet  → collapsed bar
```

Restoring a pane preserves valid active state.

Side panes are not horizontally drag-resizable.

The Worksheet remains vertically resizable.

The layout must preserve a usable minimum drawing area before allowing side/dock surfaces to consume more space.

## 29. Quantity / Estimate Worksheet

The bottom dock is the estimator’s cross-Condition operational ledger.

It answers:

- what was measured;
- what resources the scope requires;
- what labor/productivity it creates;
- whether direct cost is complete;
- what holds remain;
- whether the Takeoff is ready to hand into Estimate.

It remains permanently available on desktop and can collapse to a compact status bar.

### 29.1 Views

The approved views are:

```text
Quantities
Resources
Labor
Pricing
Holds
Recap
```

These are view projections over authoritative data. They are not independent persisted worksheet datasets.

## 30. Quantities view

Default daily view.

It distinguishes raw Takeoff quantity from derived production quantity.

Representative columns:

| Column | Meaning |
| --- | --- |
| Condition | code/name |
| Measurement | physical measured object |
| Sheet / Zone | location |
| Role | primary/secondary role |
| Takeoff Qty | authoritative raw LF/SF/EA |
| Production Qty | Condition-produced quantity |
| Unit | output unit |
| Section | Estimate section |
| State | ready/pending/hold |

Default grouping is by Condition, with expandable measurement rows.

Condition-level summaries may show derived totals where the domain supports meaningful aggregation.

## 31. Resources view

Resources answers what the work consumes/requires.

Representative columns:

- Condition;
- Module;
- Resource;
- Resource Behavior;
- Production Quantity;
- Procurement Quantity where distinct;
- Unit;
- Cost Source;
- Direct Cost;
- State.

Resource behavior preserves distinctions such as:

- consumed material;
- reusable form resource;
- equipment;
- subcontractor;
- labor or other existing governed categories.

The UI must not imply that form contact area equals purchased plywood quantity, or that installed concrete equals ordered concrete.

## 32. Labor view

Labor answers what work/productivity the Conditions create.

Representative columns:

- Condition;
- Activity;
- Production Quantity;
- Production Unit;
- Method;
- Rate;
- Crew where governed;
- Man-hours;
- Direct Labor Cost;
- Source/provenance.

Productivity editing remains upstream in Condition Properties/Labor. The Worksheet is review/output-first and may route back to the owning Condition input.

## 33. Pricing view — Direct Cost only

Inside Takeoff, Pricing means direct-cost completeness and provenance.

It does not mean customer Sell.

Representative columns:

- Condition;
- Output;
- Quantity;
- Unit;
- Unit Cost;
- Cost Source;
- Direct Cost;
- Pricing State;
- generated Estimate-line lineage.

Takeoff may resolve missing direct resource/labor cost through existing authoritative mechanisms.

The live domain already supports manual unit-cost override for Takeoff outputs and preserves that override across recalculation.

The UI should make `MANUAL OVERRIDE` explicit.

## 34. Direct Cost vs Sell boundary

The commercial authority sequence remains:

```text
TAKEOFF
physical quantity
resource quantity
labor hours
unit cost
direct cost
pricing completeness
        ↓

ESTIMATE
direct-cost rollup
overhead
reserves
target margin
recommended sell
selected customer price
commercial exceptions
        ↓

PROPOSAL
issued customer-facing commercial record
```

Takeoff may expose:

- Unit Cost;
- Direct Cost;
- Cost Source;
- Price Required;
- Manual Override.

Takeoff must not directly edit:

- customer price;
- markup;
- target margin;
- recommended Sell;
- selected proposal price;
- B&O reserve;
- payment-processing reserve.

Those remain Estimate authority.

## 35. Holds view

Holds is the Takeoff exception queue.

It distinguishes, rather than flattening:

- input hold;
- calculation hold;
- price required;
- labor-rate required;
- review/lineage issue.

Representative columns:

- severity/state;
- Condition;
- module/output;
- issue;
- destination;
- source;
- action.

Each hold routes to the owning decision surface.

## 36. Recap view

Recap summarizes Takeoff-wide readiness and outputs.

It may show:

- Condition count;
- measured/not-calculated/held counts;
- aggregate concrete/rebar/forms/labor quantities only where meaningful and unit-compatible;
- Direct Cost with completeness state;
- missing-price count/affected scope;
- linked Estimate revision;
- Open Estimate action.

It does not independently calculate overhead, Sell, margin, or proposal price.

If read-only Estimate commercial context appears, it is sourced from authoritative Estimate summaries and labeled as Estimate-owned.

## 37. Worksheet scope, grouping, virtualization, and resizing

Preserve current specialist capabilities:

- This Sheet / All Sheets;
- search;
- selected-row synchronization;
- virtualization;
- vertical dock resizing;
- collapse/restore;
- resizable columns;
- double-click column reset;
- device-local column width persistence;
- partial Direct Cost indication;
- issue counts.

Purpose-built default grouping:

```text
Quantities → Condition
Resources  → Condition → Module
Labor      → Condition → Activity
Pricing    → Condition → Output
Holds      → Severity / Condition
Recap      → summary sections
```

View-specific column widths are device-local UI state.

The reference may adopt shared Carez Data Grid semantics for selection, density, status, keyboard, headers, numeric alignment, empty/loading/error states, and accessibility while retaining specialist extensions such as virtualization, group rows, sticky behavior, and resizable columns.

## 38. Worksheet interaction and numeric trust

Single click selects and synchronizes context.

Selection must not immediately enter a cost editor.

Direct-cost editing requires a deliberate action such as explicit `Set Unit Cost`, deliberate keyboard activation, or equivalent.

Numeric presentation uses tabular alignment and domain-appropriate precision.

Core trust rule:

> Unknown is not zero.

Examples:

- authoritative calculated zero → `0`;
- unresolved price → `—` / Price required;
- module excluded → Not included;
- stale calculation → Pending;
- held calculation → Hold.

A partial Direct Cost total must say it is partial when prices are missing.

## 39. Dirty Condition vs Worksheet authority

Unsaved Condition edits do not silently become authoritative Worksheet outputs.

The Worksheet must indicate stale/pending state for the affected Condition until Save & Recalculate completes.

After authoritative recalculation, the Worksheet refreshes without losing stable selection/scroll/context where IDs remain valid.

## 40. Estimate lineage visibility

Takeoff-generated outputs already maintain lineage to generated Estimate items.

The Worksheet may expose that lineage quietly:

```text
Estimate
03 30 00 · Item linked
```

and provide an `Open Estimate Line` or equivalent action where an exact linked line exists.

Generated Estimate lines remain downstream of Takeoff quantity authority. The Estimate is not a second editor for Takeoff-generated physical quantity.

Manual Estimate costs remain explicit exceptions for real costs outside the Condition/Takeoff resource system.

## 41. Supplier Catalog Library compatibility boundary

Subproject 5 must be compatible with a future Supplier Catalog Library but does not implement wholesale catalog acquisition.

This is an explicit architectural boundary.

### 41.1 Why this matters

The current repository already has the core integration concepts:

- `cost_catalog_items`;
- Takeoff components linked to catalog items;
- cost source/provenance;
- vendor quote lines;
- purchase orders;
- vendor bill history;
- direct-cost resolution.

Future catalog ingestion should enrich these existing cost/resource concepts rather than create a disconnected product/pricing system.

### 41.2 Initial source classes

The future Supplier Catalog Library should support at least two distinct source classes:

1. manufacturer/technical sources;
2. distributor/supplier cost sources.

Examples relevant to concrete forming include:

- Dayton Superior and other forming-system manufacturers;
- White Cap and other concrete-accessory distributors;
- lumber suppliers;
- steel/rebar suppliers.

These examples establish intended source categories; they do not make any named supplier an exclusive or hard-coded dependency.

### 41.3 Technical vs cost authority

Manufacturer technical information may support:

- manufacturer;
- manufacturer part number;
- product identity;
- dimensions/packaging;
- compatible system;
- published system limitations;
- technical literature provenance.

Supplier/distributor evidence may support:

- supplier SKU;
- unit/pack;
- quoted/listed/observed cost;
- effective/observed date;
- source document;
- later comparison against actual vendor purchasing.

Public/list prices do not automatically become authoritative job cost.

The cost-resolution chain remains governed by the existing pricing architecture, favoring applicable actual/vendor/company-approved evidence over generic defaults.

### 41.4 Forming-accessory use case

A human-selected/validated wall-form method may eventually generate resource demand such as:

- MDO plywood;
- lumber/walers;
- snap ties;
- Jahn-style brackets;
- strongback hardware;
- braces;
- other forming accessories.

The supplier catalog can map those normalized resources to exact products, suppliers, packs, and cost provenance.

The catalog does not design the form system.

Carez must not infer a safe tie pattern, stud/wale spacing, pressure envelope, or engineered layout merely from manufacturer examples.

Manufacturer/engineered system limits and human means/method decisions remain authoritative.

### 41.5 Future ingestion workflow

The follow-on catalog subsystem should follow a human-reviewed pipeline conceptually like:

```text
PDF / CSV / XLSX / web catalog
↓
staging import
↓
normalize manufacturer / part / unit / pack
↓
human review
↓
map to Carez normalized resource / cost code
↓
publish company catalog version
```

Imported source rows do not immediately become pricing authority.

Source-document provenance should remain traceable.

### 41.6 Subproject 5 integration point

Takeoff Resources/Pricing should be able to display normalized future provenance such as:

```text
Resource
A81-type forming bracket

Normalized catalog item
...

Preferred supplier
...

Latest applicable cost
...

Cost source
vendor actual / quote / company catalog / manual override
```

Condition Properties and the Worksheet must not become shopping/catalog-browsing applications.

## 42. Locked revisions

Issued/accepted/superseded historical Takeoff revisions remain fully inspectable:

- Plans;
- Conditions;
- Zones;
- 2D;
- derived 3D;
- Properties;
- provenance;
- Worksheet;
- Estimate lineage.

Mutation affordances are disabled consistently:

- no new geometry;
- no geometry edit;
- no Condition input/module change;
- no Save & Recalculate;
- no direct-cost override.

Historical truth remains readable.

## 43. Workspace state

One coherent workspace controller owns UI selection/presentation state:

```text
active sheet
active Condition
active role
selected measurement
active zone/filter
2D/3D mode
Properties tab
Worksheet view
pane collapse state
```

Business/domain state remains server-authoritative.

Device-local presentation state may include:

- navigator collapsed;
- Properties collapsed;
- Worksheet height;
- Worksheet view;
- column widths;
- 3D camera;
- 3D filters;
- selected navigator tab where useful.

Do not persist these as commercial/versioned Takeoff facts.

## 44. Responsive behavior

Takeoff is desktop-primary.

### 44.1 Wide desktop — 1440×900 and wider

Default:

- Navigator visible;
- Canvas dominant;
- Condition Properties visible;
- Worksheet expanded to useful working height.

All four specialist surfaces may be simultaneously visible.

### 44.2 Standard laptop — 1280×800 class

Preserve the same specialist architecture.

Priority for available width/height:

1. Canvas usability;
2. active decision surface;
3. Navigator;
4. Worksheet expansion.

Contextual panes collapse before the PDF canvas becomes unusably narrow.

The layout must not become a stacked dashboard.

### 44.3 Tablet/narrow — 768×1024 class

Containment changes:

- Canvas remains primary;
- Navigator converts to a Sheet/drawer when needed;
- Properties converts to a Sheet/drawer when needed;
- Worksheet collapses or expands as a contained panel/Sheet;
- selection/context remains coherent.

Tablet is safe for inspection/navigation and limited interaction, not the authority target for high-speed fine-pointer drawing.

### 44.4 Mobile — 390×844 class

Mobile is primarily inspection/navigation.

It must expose:

- Takeoff identity;
- sheet/Condition selection;
- drawing viewer;
- selected-object detail;
- holds;
- worksheet summary;
- lineage actions;
- lock/hold/scale/price state.

Full precision LF/SF/EA authoring and complex vertex editing are not Subproject 5 mobile acceptance requirements.

No critical state may disappear silently.

## 45. Loading, empty, error, and pending states

### 45.1 Sectional loading

Where practical, loading is sectional:

```text
identity     ready
navigator    ready
PDF canvas   loading
Properties   ready
Worksheet    loading outputs
```

The entire workstation should not blank because one supporting surface refreshes.

### 45.2 Route-level failures

Preserve existing authority:

- unauthenticated → login;
- role restrictions → existing role behavior;
- missing/inaccessible Takeoff set → notFound/access behavior.

### 45.3 Drawing failure

PDF render failure does not delete persisted geometry or silently alter quantity.

Conditions/Properties/Worksheet may remain available where safe.

### 45.4 3D failure

3D failure degrades only 3D.

2D and authoritative commercial outputs remain operational.

### 45.5 Save/calculation failure

The UI distinguishes:

- draft was not persisted;
- inputs persisted but outputs are held/incomplete.

Existing authoritative outputs are not silently replaced by zero/blank state.

### 45.6 Legitimate empty states

Examples:

- no sheets loaded;
- no Conditions;
- no Zones;
- no measurements;
- no Worksheet rows matching filter;
- no derived 3D because supported inputs do not exist.

These are not query failures.

## 46. Accessibility

### 46.1 Focus and keyboard

All interactive controls expose visible focus.

Core desktop workflows must be possible without pointer-only dependencies.

Navigator supports keyboard row traversal and group expansion/collapse.

Worksheet supports row traversal, group expansion/collapse, and deliberate editing activation.

Side Sheet/drawer behavior uses accessible focus/escape containment.

### 46.2 Selection semantics

Selected rows/objects expose programmatic selection where applicable, including `aria-selected` in grid/list contexts.

Selection color is not the only indicator.

### 46.3 Status semantics

State always has text meaning:

- Ready;
- Hold;
- Pending;
- Price required;
- Manual override;
- Locked;
- Unsaved;
- etc.

Color supports, never replaces, the label.

### 46.4 Table/grid semantics

Headers remain programmatically identifiable.

Numeric values are aligned/readable.

Virtualization must preserve meaningful row semantics/counts.

### 46.5 Motion

No essential workflow depends on animation.

Reduced-motion users retain complete state, selection, focus, and error meaning.

## 47. Light/dark specialist expression

Takeoff remains more technical/dense than Today/Projects, but not dark-only.

ADR-024 semantic tokens own both themes.

### Light

- restrained neutral application chrome;
- strong structure/separators;
- plan paper remains visually primary;
- Condition/geometry colors retain salience;
- minimal elevation.

### Dark

- dark neutral workspace;
- restrained pane differentiation;
- strong plan/geometry contrast;
- semantic warning/error/success tokens;
- no revived navy/B2 alternative palette.

Do not introduce:

- hard-coded alternate application palettes;
- broad compatibility-selector theming as the active reference architecture;
- a second component system.

## 48. Shared component adoption

Use shared Carez primitives where their contracts fit:

- `CarezStatus`;
- `CarezFeedback`;
- `CarezEmptyState`;
- `CarezSaveState`;
- `CarezAuthorityState`;
- `CarezProvenance`;
- semantic numeric input conventions;
- shared toolbar/focus patterns;
- Data Grid semantics.

The specialist workstation may extend shared primitives where required by real workstation behavior:

- virtualization;
- column resizing;
- nested/group rows;
- saved widths;
- high-density specialist rows;
- precise Canvas interactions.

Do not remove mature specialist capability merely to force a generic component.

## 49. Existing domain behavior to preserve

Subproject 5 preserves current authoritative behavior including:

- tenant-scoped Takeoff set loading;
- Estimate linkage;
- sheets and scale regions;
- persisted measurements;
- Conditions/versions/modules/roles/outputs/holds;
- generated Estimate items and lineage;
- direct cost/pricing status/provenance;
- issued/accepted read-only behavior;
- current undo/history domain behavior;
- current server-authoritative calculation paths;
- current direct-cost manual override behavior;
- current quantity/cost reconciliation into Estimate;
- current 3D derived-scene authority boundary.

No UI refactor may move these calculations client-side.

## 50. Documentation/state reconciliation discovered during planning

Live planning inspection found that GitHub Issue #41 is closed while an existing CURRENT_STATE statement may still describe Issue #41 as open/pending.

Implementation planning must reverify the exact current documentation and issue evidence before changing canonical state.

Subproject 5 must not reopen or reimplement accepted 3D work merely because documentation is stale.

Any documentation correction must be evidence-based and scoped separately from product behavior.

## 51. Testing contract

### 51.1 Pure presentation/state contracts

Add focused Node-testable helpers where shared deterministic presentation mapping is needed.

Unknown values must never silently become successful/authoritative state.

### 51.2 Specialist source/architecture contracts

Add focused specialist UI contract tests covering at least:

- `/takeoff/[setId]` remains Estimate-authoritative and does not broaden Issue #71 Project Context;
- no Split mode;
- one governed Condition Properties surface;
- Plans / Conditions / Zones direct navigator composition;
- direct state/callback interfaces replace active reference-path browser-event coupling;
- active reference path no longer depends on broad compatibility-theme selectors;
- 2D remains quantity authority;
- 3D does not become an independent quantity calculator;
- role-specific measurement initiation exists;
- scale-required physical measurement is blocked/routed correctly;
- save/recalculate trust states are explicit;
- Worksheet exposes Quantities/Resources/Labor/Pricing/Holds/Recap;
- unknown/unpriced values do not render as authoritative zero;
- Takeoff Direct Cost and Estimate Sell remain distinct;
- locked revisions prevent mutation;
- light/dark specialist presentation uses semantic tokens;
- no new nested Project-owned Takeoff route.

### 51.3 Regression suite

Existing Takeoff/domain/Estimate/3D/UI contracts remain green, including tests covering:

- geometry persistence;
- calculation engine;
- generated Estimate lineage;
- direct-cost overrides;
- missing input/pricing holds;
- 2D/3D authority;
- project-context routing;
- shared UI/theme tokens.

### 51.4 Validation

Normal implementation validation:

```text
targeted specialist tests
pnpm typecheck
pnpm check for the full/high-risk reference migration
GitHub Actions
Vercel staging
authenticated browser QA
```

No product acceptance is recorded from source tests alone.

## 52. Rendered acceptance matrix

The specialist reference is accepted only when the deployed staging build passes:

| Area | Acceptance |
| --- | --- |
| Global shell | ADR-024 / Issue #71 shell intact |
| Lineage | Takeoff → Estimate correct; optional Project lineage correct |
| Project context | Takeoff route does not establish false Issue #71 Project Context |
| Navigator | Plans / Conditions / Zones direct component; no DOM-repurposing dependency |
| Condition selection | synchronized across all four specialist surfaces |
| Primary role | role-specific measurement starts/assigns correctly |
| Secondary roles | compatible measurement assignment preserves ownership |
| 2D | persisted page-coordinate geometry remains sole quantity authority |
| Scale | uncalibrated physical measurement blocked/routed correctly |
| Tools | select/pan/measure/edit/cutout/snap/ortho/history coherent |
| Precision cursor | fine-pointer cursor states precise and unobtrusive |
| 3D | derived verification only; no quantity authority |
| 3D failure | 2D/Properties/Worksheet/output authority continues |
| Properties | concrete-native capability tabs and provenance visible |
| Save | unsaved/saving/failure/hold/recalc states correct |
| Worksheet | six approved views coherent and synchronized |
| Direct Cost | Takeoff resolves cost without becoming Sell authority |
| Estimate | customer price/margin/overhead/Sell remain Estimate-owned |
| Unknown state | missing input/price never presented as authoritative zero |
| Locked revision | fully readable, fully non-mutating |
| Light theme | true semantic Precision Grid specialist presentation |
| Dark theme | true semantic Precision Grid specialist presentation |
| Compatibility | active reference path no longer depends on legacy overlay architecture |
| Keyboard | core workstation usable without pointer-only dependencies |
| Responsive | wide/laptop/tablet/mobile containment matches contract |
| Performance | large Worksheet remains usable with virtualization |
| Accessibility | focus/selection/state/grid/Sheet semantics usable |
| Historical data | compatibility/history remains readable |
| Supplier boundary | Resources/Pricing remain compatible with future normalized catalog provenance |
| Main | untouched |

## 53. Browser sizes

Use the same reference sizes as Subproject 4:

```text
Wide desktop       1440 × 900+
Standard laptop    1280 × 800
Tablet / narrow     768 × 1024
Mobile              390 × 844
```

Test both:

```text
Light
Dark
```

Desktop/laptop are the acceptance authority for full precision Takeoff authoring.

Tablet/mobile verify safe containment, inspection, navigation, and state communication.

## 54. End-to-end acceptance journey

Primary journey:

```text
Project or Estimate
↓
Open exact linked Takeoff
↓
verify Takeoff / Estimate / optional Project identity
↓
Plans
→ choose calibrated sheet
↓
Conditions
→ select F-01
↓
Properties
→ Scope / Concrete / Forms / Rebar / Labor
↓
Measure Footing Run
↓
draw in authoritative 2D
↓
measurement assigned to role
↓
Save & Recalculate
↓
Worksheet updates
↓
inspect Resources
↓
inspect Labor
↓
inspect Pricing
↓
resolve/verify Holds
↓
switch 3D
↓
same F-01 selected and visually verified
↓
return 2D
↓
selection preserved
↓
Recap
↓
Open Estimate
↓
confirm generated lineage and commercial boundary
```

Repeat the critical flow on a second Condition/sheet to prove state does not leak.

## 55. Locked-record acceptance journey

Open an issued/accepted historical Takeoff and verify:

```text
read drawing
select Conditions
inspect Properties
inspect provenance
inspect 3D
inspect Worksheet
open Estimate lineage
```

while confirming there is no:

- geometry mutation;
- Condition mutation;
- direct-cost mutation;
- Save & Recalculate mutation.

## 56. Failure-state acceptance journey

Exercise representative states:

- no scale;
- missing required Condition input;
- price missing;
- unsaved Condition;
- save/calculation failure where testable;
- 3D unavailable/held;
- no measurements;
- filtered-empty Worksheet;
- locked revision.

The reference must prove trust under failure, not only the happy path.

## 57. Completion definition

Subproject 5 is complete only when the accepted staging implementation proves:

```text
EDGE-informed Condition estimating
+
Carez authoritative 2D geometry
+
derived 3D verification
+
direct-cost / Estimate lineage
+
Precision Grid specialist UI
+
one synchronized workstation
```

without:

- duplicate active Inspector/property authority;
- DOM/portal hacks between the four main specialist surfaces;
- broad compatibility-theme dependence;
- hard-coded dark-only application chrome;
- a second quantity engine;
- a second Sell/pricing authority;
- new Project ownership of Takeoff;
- supplier catalog ingestion scope creep.

Only after rendered acceptance may canonical state documents mark Subproject 5 accepted and the major UI/UX redesign advance into broader module migration waves.

## 58. Post-Subproject-5 supplier catalog follow-on

After Subproject 5 is accepted, independently design a Supplier Catalog Library beginning with concrete-forming accessories/materials.

The follow-on should cover:

- manufacturer/distributor source ingestion;
- PDF/CSV/XLSX/web-catalog acquisition;
- normalized product/resource identity;
- manufacturer part vs supplier SKU;
- package/unit normalization;
- source-document provenance;
- cost observation/effective dates;
- human review/publish workflow;
- mapping to existing Carez catalog/resources/cost codes;
- supplier/actual/quote/catalog/manual cost precedence;
- forming-accessory technical-source linkage;
- explicit prohibition on treating manufacturer examples as universal form engineering.

That subsystem is intentionally not implemented as part of Subproject 5.
