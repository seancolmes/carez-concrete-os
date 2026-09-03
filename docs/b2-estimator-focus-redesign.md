> **Document status:** ACCEPTED DETAILED DESIGN  
> **Canonical owner:** `docs/ARCHITECTURE.md`, `docs/modules/takeoff.md`, `docs/modules/estimating.md`  
> **Use:** Supporting visual/interaction contract. Where this file conflicts with a canonical document, the canonical document wins.  
> **Supersession:** Active until explicitly superseded by an approved replacement design.

# Carez Concrete OS — B2 Estimator Focus redesign

## Visual contract

B2 is a desktop-first professional estimating interface. The benchmark is a refined professional workstation rather than a generic SaaS dashboard.

The approved direction blends:

- Apple-level polish, clarity, restraint, and perceived quality;
- zzTakeoff tool placement, compact controls, and takeoff speed;
- Estimating Edge trade-estimating seriousness and assembly/estimate structure;
- STACK-style modern organization and visual clarity.

These are references for interaction quality and visual discipline, not instructions to copy another product.

### Approved light workstation system

The previous Dark Carbon visual direction is superseded. Carez desktop workstations use a light primary interface with a controlled dark brand rail.

Approved semantic treatment:

| Token family | Use |
| --- | --- |
| Deep brand navy | Permanent desktop app rail and very limited high-emphasis branded surfaces |
| Carez brand blue | Brand identity and selected navigation where appropriate |
| Bright interaction blue | Active tools, focus, selected rows/objects, links, primary actions, and important interactive state |
| White / near-white | Main panels, worksheets, forms, and plan sheet surfaces |
| Cool light / medium gray | Workspace background, secondary panes, inactive controls, dividers, and visual grouping |
| Charcoal / near-black text | Primary operational labels, values, and headings |
| Muted cool-gray text | Secondary metadata and helper text only |
| Success / warning / danger | Semantic state only; do not use status color decoratively |
| Takeoff colors | Measurement geometry and meaningful scope distinction; remain visually separate from ordinary application chrome |

Exact production hex values must be finalized against the canonical Carez brand asset and browser-verified. Do not sample colors directly from AI-generated concept images.

### Color discipline

- Dark navy is primarily the permanent app rail, not the application background.
- Main work surfaces are light so plans, tables, inputs, and labels remain easy to read for long estimating sessions.
- Carez blue is restrained. Use the deeper brand blue for identity and a brighter interaction blue for active/selected/focus states.
- Add color where it helps distinguish takeoff geometry, important scope, statuses, selected objects, or required decisions.
- Healthy/default states remain visually quiet.
- Do not turn every card, icon, or section into a different color family.
- Takeoff geometry colors must remain more visually salient than decorative chrome.

### Typography and readability

B2 remains dense, but density must not depend on undersized operational text.

- Important estimator labels, values, inputs, selects, worksheet rows, statuses and navigation text must be comfortably readable at 100% desktop browser zoom.
- Use shared typography rules/tokens instead of page-by-page font-size patches.
- Operational text should generally live around the 13px class or larger where needed; secondary/helper/meta text may use the 12px class when still clearly legible.
- Use a stronger, more distinctive heading treatment paired with neutral, highly legible data and form typography.
- Preserve hierarchy with weight, contrast, spacing, alignment, icons, and selective color rather than shrinking meaningful text.
- Do not introduce oversized SaaS typography, excessive row height, or unnecessary whitespace.
- Inspector content, Quantity Worksheet/estimate tables, context/sheet panes, and toolbars are the highest-priority readability surfaces.
- Typography changes must be browser-verified for clipping, overflow, control truncation, worksheet density, and workstation containment.

### Density and spacing

- Target density is slightly more spacious than zzTakeoff while remaining a professional estimator workstation.
- Increase breathing room around controls and sections only enough to improve scanning and precision.
- Do not create large empty regions, oversized hero areas, or card-heavy dashboards inside production workspaces.
- Prefer alignment, separators, subtle surface shifts, and progressive disclosure over large rounded containers.

### Shape and surface language

- Controls and panels use crisp geometry with mostly small corner radii in the roughly 2–4px class; 5–6px is acceptable for selected controls where it improves polish.
- Avoid giant rounded cards, excessive pills, glassmorphism, heavy gradients, and floating-card walls.
- Use subtle borders and limited elevation/shadow only when necessary to establish hierarchy.
- The interface should feel engineered and premium, not soft, playful, or template-driven.

### Icons

- Use more icons where they improve recognition and reduce reading time: global navigation, drawing tools, common worksheet actions, search/filter/view controls, status, and compact utilities.
- Toolbars should be icon-first where the icon is conventional and unambiguous; labels/tooltips remain available where clarity requires them.
- Icons must share a consistent stroke weight, optical size, alignment, and visual language.
- Do not add decorative icons that compete with estimating information.

### Brand mark

The supplied Carez Concrete logo is the canonical application brand mark. The application shell uses the dedicated `/brand/carez-wordmark.png` slot for this mark. Do not substitute a generic `C`, redraw the mark, or invent another logo treatment. The logo should be prominent enough to identify Carez while remaining compact enough not to consume estimator workspace.

## Workspace model

The flagship estimator workspace is organized as:

1. permanent global rail,
2. project/sheet context pane,
3. dominant PDF/vector drawing canvas,
4. assembly/takeoff inspector,
5. persistent quantity/estimate worksheet,
6. compact project/module bar.

Closing a context pane must never remove the permanent desktop rail.

### Shell treatment

- The permanent app rail remains dark navy and is the main dark brand anchor.
- The rest of the application is predominantly light.
- Selected navigation uses controlled blue emphasis rather than large decorative gradients.
- Project identity, search, save/sync state, and frequent global actions belong in compact utility chrome rather than large dashboard banners.

## Information density and progressive disclosure

B2 should be information-dense, not text-dense.

- Persistent text must identify an object, communicate current state/problem, or enable a current decision. Explanatory narration, duplicate summaries, provenance paragraphs, and repeated zero-state metadata should be removed from primary workstation surfaces.
- Keep provenance and audit data in the domain model; expose it contextually when the estimator requests detail rather than consuming permanent workspace.
- Do not repeat the same selected object, assembly, status, Snap/Ortho state, or keyboard instruction in multiple simultaneous surfaces.
- Use warning/status text for actionable exceptions. Healthy/empty states should remain visually quiet.
- Tooltips, contextual popovers, shortcut/help surfaces, Inspector tabs, and selected-row detail are preferred over permanent helper paragraphs.
- A cleaner UI must never hide unresolved holds, missing inputs/prices, destructive state, or other information required for a safe estimator decision.

## Synchronized layers

Carez presents three synchronized layers of the same estimate:

`Drawing -> Takeoff / Assembly -> Estimate`

Geometry remains authoritative in normalized/vector page coordinates. Assemblies expand geometry into physical resources, production and generated estimate lines. Financial lineage remains server-authoritative.

## Inspector model

The Takeoff Inspector is a compact operational property surface, not a permanently expanded form.

- Prefer collapsed sections by default with clear section headings and strong disclosure affordances.
- Expand the sections that matter to the current selection, unresolved hold, or active editing task.
- Keep selected measurement identity, critical quantity/unit, actionable inputs, and blocking state immediately discoverable.
- Advanced recipe authoring remains in the Recipe Editor rather than turning the permanent Inspector into a long configuration form.
- Provenance/audit detail remains available contextually without permanent narration.

## Takeoff sheet-pane behavior

- Sheet identity and actionable sheet state are primary.
- Sheet rows remain visually quiet and compact.
- Do not repeat `0 TAKEOFFS`, scale-state badges, warning boxes, or other routine metadata on every row.
- Sheet-number/title indexing remains professional and compact; page identity must remain traceable.
- Search, filter, view, and visibility actions may use compact icons with tooltips.

## Takeoff chrome hierarchy

The drawing area is the scarce resource. The Takeoff page should minimize stacked horizontal bands above it.

- Retain permanent app rail and required project/module navigation.
- Retain takeoff-set/project identity and drawing tools.
- Consolidate redundant Takeoff-specific header information where practical instead of stacking independent website-like title bands.
- Drawing tools should use a sleek icon-first toolbar for Area, Linear, Count, Pan, Zoom, Calibrate, Edit, Undo/Redo, and related high-frequency commands.
- Long persistent keyboard-instruction strings should move to contextual shortcut/help surfaces.
- Status bars should show current/actionable state and avoid duplicating toolbar toggle state already visible above.
- Chrome consolidation must be browser-verified across panel open/close, worksheet collapse/expand, resize, and drawing zoom/pan behavior.

## Takeoff drawing surface

The drawing canvas must remain visually primary and should feel closer to a professional Bluebeam-style plan workspace than a dark application canvas.

- Present the plan sheet on a light neutral/cool-gray workspace with strong sheet separation and high plan readability.
- Saved Takeoff geometry remains the dominant application color on top of the document.
- A saved Takeoff does not keep a large floating label/banner pinned over the plan simply because it is selected.
- Compact measurement detail appears only while the pointer is directly hovering saved Takeoff geometry and disappears when the pointer leaves it.
- The transient card may show the measurement name, quantity/unit, recipe/variant, a few important physical properties/derived outputs and status/hold summary.
- Selection styling and Edit handles can remain independently of the hover card.
- Persistent detail stays in the Inspector and Quantity Worksheet.
- The hover card must avoid clipping against viewport edges and must not obscure the measured geometry more than necessary.

## Quantity Worksheet / estimating grid

- The permanent worksheet is a dense professional grid, not a stack of cards.
- Slightly increase row/control breathing room from the current cramped state without losing estimator density.
- Use clear column hierarchy, resizable boundaries, selective icons, compact filters/search, and strong selected-row treatment.
- Status and hold color are semantic; ordinary rows should remain neutral.
- Important totals may receive stronger typography or contained emphasis, but should not dominate the drawing workflow.

## Builder Methods

Builder Methods remain part of P1. The existing verification, immutable profile lineage, conditional activation and draw gate remain authoritative through the redesign.

## Estimate hierarchy

Takeoff measurement/assembly groups remain collapsible. Parent groups such as `Strip Footing — Garage 1` own their generated resource/cost children and measurement subtotal. The B2 redesign changes presentation, not lineage semantics.

## Implementation boundary

This redesign is presentation-system work, not an architectural rewrite. It must not change Takeoff geometry authority, calibration, server-authoritative calculations, RLS/tenant isolation, published recipe/version semantics, commercial lineage, accepted-scope immutability, or Direct Cost/Sell separation.

Routine implementation occurs on canonical `staging`. `main` remains production only. User browser QA uses the single stable staging URL defined in `docs/BRANCH_AND_RELEASE_MODEL.md`; do not route acceptance through feature-branch or PR preview URLs.
