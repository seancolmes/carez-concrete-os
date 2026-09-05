# ADR-020 — Integrated Takeoff workstation and Precision Cursor

Status: Accepted
Date: 2026-09-04
Owner: 95 — UX & Design System
Related decisions: ADR-005, ADR-012, ADR-013, ADR-015, ADR-016, ADR-018
Implementation owner: Issue #51, coordinated with Issue #44

## Context

The current Takeoff route combines an older three-pane drawing workstation with a newer Concrete Condition authoring window. The resulting presentation duplicates navigation and properties responsibilities, obscures the drawing surface, and forces the estimator to reason about multiple overlapping interaction systems.

Carez already has an accepted Condition-led architecture: Plans / Conditions / Zones are contextual navigation, the drawing surface is the dominant work area, Condition Properties is the governed editor, and the Quantity / Estimate Worksheet remains permanently available. This decision selects the exact presentation direction for that architecture and adds a shared desktop precision-cursor language.

## Decision

Carez adopts **Direction A — Integrated estimator workstation** for Takeoff / Estimating.

The normal desktop composition is:

```text
[ ADR-016 compact global top menubar ]
[ Takeoff identity + compact module controls ]
[ Plans / Conditions / Zones ][ dominant 2D / 3D / Split drawing ][ Condition Properties ]
                               [ Quantity / Estimate Worksheet                ]
```

The large Concrete Conditions overlay is not the normal operating state. Condition authoring is integrated into the same workstation. Condition Properties may float as an explicit optional mode, but docked integration is the default.

When Condition authoring is active, Carez must not preserve a second competing legacy Takeoffs / Properties / Build Plan inspector. Selection, editing, holds, outputs, and Condition configuration must resolve through one coherent property surface.

## Contextual navigator

The left pane is a resizable module-specific navigator with:

- **Plans** — sheet list/search, thumbnails/list where supported, revision identity, and quiet document navigation;
- **Conditions** — shared Carez Condition Tree with search/filter, visibility, status/hold indication, quick create/duplicate, and synchronized selection;
- **Zones** — bid zones, alternates, phases, buildings, levels, pours, and other approved scope groupings.

The pane is contextual only; global application navigation stays in the ADR-016 top shell.

For drawing-focused work, the navigator is independently collapsible to a compact edge rail. Collapse/expand state may persist locally for the workstation. Expanding the Conditions workflow explicitly restores the navigator when needed. The collapse treatment must preserve current tab/selection state and may not obscure or mutate drawing geometry.

## Drawing workspace

The center drawing surface receives the largest share of available space.

Use the shared Carez Toolbar composition for high-frequency actions: selection, pan, measurement tools, scale/calibration, snap/ortho, cutouts, edit, undo/redo, visibility, and view controls. Use compact icon-first controls with tooltips and shortcuts where the action is conventional.

`2D`, `3D`, and `Split` are explicit view modes. 2D remains authoritative; 3D remains a derived synchronized verification view under ADR-013.

Contextual drawing actions such as edit, duplicate, cutout, hide/isolate, properties, and lineage navigation should use Carez-owned shadcn/Base UI context-menu/dropdown patterns instead of permanently occupying inspector space when progressive disclosure is clearer.

## Condition Properties

The right pane is the single governed editing surface for the selected Condition / measurement.

Normal top-level tabs use concrete language:

- General
- Rebar
- Forms
- Excavation
- Labor
- Drawing
- More

The current architecture-oriented labels such as `Plan facts`, `Methods`, `Production`, and `Commercial` may remain internal data compartments but are not the preferred estimator-facing tab vocabulary.

Common job inputs appear first. Advanced or uncommon inputs remain behind disclosure. Provenance, lineage, and implementation detail remain available through drill-down, not permanent narration.

The docked Condition Properties pane is independently collapsible to a compact edge rail so the estimator can temporarily maximize drawing width without losing the active Condition or property state. Its expanded width and collapse state may persist locally. On touch/mobile layouts, the native responsive property presentation remains authoritative rather than reproducing desktop collapse rails.

## Quantity / Estimate Worksheet

The bottom dock remains permanently available on desktop and is vertically resizable.

It uses the shared Carez Data Grid and synchronized selection. Core views may include Quantities, Resources, Labor, Pricing, Holds, and Recap. The worksheet is a professional estimator grid, not a card stack.

The worksheet must remain readable at 100% desktop zoom. Column headers and secondary metadata should generally remain around 10–12 px, while primary row values and measurement identity should generally remain around 11–13 px with enough row height to scan quantities, resources, labor, cost, and hold state without zooming the browser.

## Shared component policy

The integrated workstation must reuse the Carez-owned shadcn/Base UI component system where the interaction matches:

- Carez Resizable Workspace;
- Carez Condition Tree;
- Carez Toolbar;
- Carez Number Field;
- Carez Data Grid;
- Carez Loading / Empty states;
- shadcn/Base UI Context Menu, Dropdown Menu, Tooltip, Tabs, Toggle Group and related primitives;
- ADR-015 motion language.

HextaUI, COSS UI, ReUI, beUI, Loading UI and Lucide Animated remain reference/source pools under ADR-015. They do not become parallel runtime design systems.

## Readability and content discipline

Takeoff must remain dense but readable at 100% desktop zoom.

Target hierarchy:

- normal controls/data: approximately 12–13 px;
- normal working text: approximately 13–14 px;
- secondary metadata: approximately 11–12 px;
- pane headings / selected object identity: approximately 13–17 px according to hierarchy.

Do not preserve 6–8 px microtext for normal controls or essential working information.

ADR-018 applies strictly. The normal estimator UI must not persistently narrate legacy migration, future roadmap intent, compatibility architecture, or internal implementation detail. It should communicate the current object, state, required input, hold, output, or decision.

## Carez Precision Cursor

Carez adopts a desktop precision-cursor language for the estimator workstation.

### Default/select cursor

On fine-pointer desktop devices, Carez uses a source-owned custom SVG cursor with an effective visible footprint of approximately **20–24 px** inside a browser-safe cursor canvas, with:

- charcoal / black interior;
- crisp off-white outer stroke for visibility on both dark chrome and white plan sheets;
- bold, compact, modern pointer geometry with Mac-like visual weight without copying Apple assets;
- explicit hotspot coordinates and a native CSS keyword fallback.

The visible glyph must remain smaller than the initial 28–32 px concept if browser QA shows that larger footprint obscures plan geometry or feels visually heavy.

### Tool-state cursor mapping

- normal workstation / select: Carez default arrow;
- conventional link/button target: clear interactive pointer where appropriate;
- linear / area / count measurement: precision crosshair with center point;
- scale / calibration: precision crosshair;
- pan: `grab` / `grabbing`;
- vertex/detail editing: precision crosshair;
- horizontal pane resizing: `ew-resize`;
- vertical worksheet resizing: `ns-resize`;
- floating window corner resizing: `nwse-resize`;
- text / number input: native text cursor;
- disabled action: `not-allowed`.

Custom cursor assets apply only where hover/fine-pointer input is present. Touch/tablet/mobile retain platform-native pointer behavior. The cursor system must not reduce accessibility, obscure geometry, or replace meaningful focus states.

## Protected architecture

This decision is a presentation and interaction redesign only. It does not change:

- PDF as visual reference;
- stable page-coordinate vector geometry as measurement authority;
- calibration and scale regions;
- LF/SF/EA geometry, polygon cutouts, editing, duplication, and undo/redo;
- server-authoritative calculations;
- Condition/template/archetype/module/output lineage;
- RLS / tenant isolation;
- immutable published or accepted commercial history;
- the separation of Production Quantity, Direct Cost, and Sell.

## Acceptance

The redesign is accepted in implementation only when:

- the normal Condition workflow no longer presents duplicated overlapping inspector/authoring architecture;
- left navigator, center drawing, right properties, and bottom worksheet resize predictably while preserving a useful drawing minimum;
- left navigator and right Condition Properties can collapse independently and restore without losing selected work state;
- selection is synchronized among navigator, drawing, Condition Properties, worksheet, and 3D where available;
- cursor/tool states are clear, restrained, and non-distracting;
- Quantity / Estimate Worksheet text is readable at 100% desktop zoom without reverting to oversized low-density rows;
- keyboard/focus/reduced-motion behavior remains coherent;
- typecheck, domain tests, and production build pass;
- authenticated browser QA on the single stable staging URL confirms the workstation is readable and efficient at representative desktop sizes;
- no rendered acceptance claim is made from source/build evidence alone.
