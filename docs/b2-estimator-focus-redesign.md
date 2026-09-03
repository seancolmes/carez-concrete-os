> **Document status:** ACCEPTED DETAILED DESIGN  
> **Canonical owner:** `docs/ARCHITECTURE.md`, `docs/modules/takeoff.md`, `docs/modules/estimating.md`  
> **Use:** Supporting visual/interaction contract. Where this file conflicts with a canonical document, the canonical document wins.  
> **Supersession:** The Carez-wide light visual system remains active. Takeoff/Estimating workspace, Condition Properties, formula/recipe, and 2D/3D details are superseded by docs/concrete-condition-3d-workstation-target.md and ADR-012/ADR-013.

# Carez Concrete OS — B2 Estimator Focus redesign

## Visual contract

B2 is a desktop-first professional estimating interface. The benchmark is a refined professional workstation rather than a generic SaaS dashboard.

The approved direction blends:

- Apple-level polish, clarity, restraint, and perceived quality;
- Estimating EDGE simplicity, readable condition organization, open working area, and trade-estimating seriousness;
- selective fast plan-tool and keyboard patterns from zzTakeoff where they remain compatible with the Condition workstation;
- STACK-style modern organization and visual clarity.

These are references for interaction quality and visual discipline, not instructions to copy another product.

### Approved light workstation system

The previous Dark Carbon visual direction is superseded. Carez uses a light primary interface with a controlled dark brand rail across authenticated desktop pages.

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

Exact production colors are governed by the shared design tokens. Do not sample replacement colors from AI-generated concept images.

### Color discipline

- Dark navy is primarily the permanent app rail, not the application background.
- Main work surfaces are light so plans, tables, inputs, and labels remain easy to read for long working sessions.
- Carez blue is restrained. Use brand blue for identity and a brighter interaction treatment for active/selected/focus states.
- Add color where it helps distinguish takeoff geometry, important scope, statuses, selected objects, or required decisions.
- Healthy/default states remain visually quiet.
- Do not turn every card, icon, or section into a different color family.
- Takeoff geometry colors must remain more visually salient than decorative chrome.

### Typography and readability

- Important labels, values, inputs, selects, table rows, statuses, and navigation text must be comfortably readable at 100% desktop browser zoom.
- Use shared typography rules/tokens instead of page-by-page font-size patches.
- Operational text should generally live around the 13px class or larger where needed; secondary/helper/meta text may use the 12px class when still clearly legible.
- Use a stronger, more distinctive heading treatment paired with neutral, highly legible data and form typography.
- Preserve hierarchy with weight, contrast, spacing, alignment, icons, and selective color rather than shrinking meaningful text.
- Do not introduce oversized SaaS typography, excessive row height, or unnecessary whitespace.
- Typography changes must be browser-verified for clipping, overflow, control truncation, table density, and workstation containment.

### Density and spacing

- Target density follows a readable concrete estimating workstation: generous usable plan/table area, comfortably readable fields, and calm spacing without losing operational density.
- Give controls and sections enough breathing room for fast scanning and precise pointer use at 100% zoom.
- Do not create large empty regions, oversized hero areas, or card-heavy dashboards inside production workspaces.
- Prefer alignment, separators, subtle surface shifts, and progressive disclosure over large rounded containers.

### Shape and surface language

- Controls and panels use crisp geometry with mostly small corner radii in the roughly 2–4px class; 5–6px is acceptable for selected controls where it improves polish.
- Avoid giant rounded cards, excessive pills, glassmorphism, heavy gradients, and floating-card walls.
- Use subtle borders and limited elevation/shadow only when necessary to establish hierarchy.
- The interface should feel engineered and premium, not soft, playful, or template-driven.

### Icons

- Use more icons where they improve recognition and reduce reading time: global navigation, drawing tools, common table actions, search/filter/view controls, status, section identity, and compact utilities.
- Toolbars should be icon-first where the icon is conventional and unambiguous; labels/tooltips remain available where clarity requires them.
- Icons must share a consistent stroke weight, optical size, alignment, and visual language.
- Do not add decorative icons that compete with operational information.

### Brand mark

The supplied Carez Concrete logo is the canonical application brand mark. The application shell uses the dedicated `/brand/carez-wordmark.png` slot for this mark. Do not substitute a generic `C`, redraw the mark, or invent another logo treatment.

## Carez-wide application scope

The light workstation system applies to every authenticated desktop module through shared tokens, shell styling, surface primitives, forms, tables, empty states, alerts, dialogs, and controls. Page-specific layouts remain concrete-native and task-specific; applying one design system does not mean forcing every page into the same card layout.

- Dashboard / reporting surfaces prioritize fast operating scan and exception hierarchy.
- Takeoff remains plan-first and geometry-dominant.
- Estimating remains worksheet/table-first.
- Projects, scheduling, readiness, and production remain operational list/table/board surfaces.
- Procurement and finance remain transaction- and table-first with clear financial hierarchy.
- Documents remain evidence/search oriented.
- Settings remain compact forms and configuration lists.
- Mobile remains field-first and may use larger touch targets while sharing the same brand, typography, color, and state vocabulary.
- Customer-facing proposal/print surfaces remain document-like and are not converted into desktop workstation chrome.

## Workspace model

The flagship estimator workspace is organized as:

1. permanent global rail,
2. resizable context pane with Plans, Conditions, and Zones tabs,
3. dominant PDF/vector drawing canvas with 2D, 3D, and Split modes,
4. dockable/floatable/resizable Condition Properties window,
5. persistent resizable Quantity/Estimate Worksheet,
6. compact project/module bar.

Core panes resize predictably. Condition Properties is the primary governed work window and may dock, float, maximize/focus, and restore. Carez does not accumulate many simultaneous overlapping dialogs.

Closing a context pane must never remove the permanent desktop rail.

### Shell treatment

- The permanent app rail remains dark navy and is the main dark brand anchor.
- The rest of the application is predominantly light.
- Selected navigation uses controlled blue emphasis rather than large decorative gradients.
- Project identity, search, save/sync state, and frequent global actions belong in compact utility chrome rather than large dashboard banners.

## Information density and progressive disclosure

Carez should be information-dense, not text-dense.

- Persistent text must identify an object, communicate current state/problem, or enable a current decision.
- Keep provenance and audit data in the domain model; expose it contextually when the user requests detail rather than consuming permanent workspace.
- Do not repeat the same selected object, status, or instruction in multiple simultaneous surfaces.
- Use warning/status text for actionable exceptions. Healthy/empty states should remain visually quiet.
- Tooltips, contextual popovers, shortcut/help surfaces, Inspector tabs, selected-row detail, and disclosure sections are preferred over permanent helper paragraphs.
- A cleaner UI must never hide unresolved holds, missing inputs/prices, destructive state, or other information required for a safe decision.

## Dashboard / Today reference surface

The approved **Today** page is the reference surface for general authenticated Carez chrome.

- The primary hierarchy is current operating position → management attention → scheduled production → active jobs, with estimating pipeline and cash attention as secondary context.
- Existing metrics and domain meaning remain intact.
- Management exceptions gain stronger hierarchy when present; healthy/zero states remain quiet.
- Use icons, semantic color, typography, spacing, and table/list structure to improve scan speed without creating a generic SaaS card wall.

## Dashboard Module — Owner Reports reference surface

The approved **Owner Reports** page establishes the reporting-page pattern.

- Top summary strip: Completed Job Revenue, Completed Job Cost, Actual Completed Margin, Customers Still Owe Us.
- Primary section order: Job Scorecards → Carez Production Database → Jobs Still Running.
- Reporting surfaces are light, table/list-first, and use helpful centered empty states with real CTAs where supported by existing routes.
- When populated, Job Scorecards focus estimate/budget vs. actual performance; Production focuses verified production evidence; Jobs Still Running compares active job operational/financial position.
- Do not add unsupported filters, exports, or metrics simply because they appeared in a concept rendering; existing route behavior and data sources remain authoritative unless separately implemented and approved.

## Synchronized estimator layers

Carez presents synchronized views of the same estimate:

Drawing/2D → derived 3D verification → Concrete Condition/modules → Quantity/Estimate Worksheet → commercial estimate.

Geometry remains authoritative in normalized/vector page coordinates. The 3D scene derives from the same IDs and governed dimensional facts. Conditions expand geometry into physical resources, labor, equipment, holds, and generated estimate lines. Financial lineage remains server-authoritative.

## Condition Properties model

Condition Properties is a readable concrete operational surface, not a programming screen or permanently expanded form.

- Use family-aware tabs such as General, Rebar, Forms, Excavation, Labor, Drawing, and More.
- Prefer collapsed sections with clear headings and strong disclosure affordances.
- Expand sections relevant to the selection, active measurement role, unresolved hold, or current editing task.
- Keep Condition identity, critical dimensions, elevation, primary quantity/unit, actionable inputs, enabled modules, and blocking state immediately discoverable.
- Use typed inputs, toggles, dropdowns, compact grids, and visually distinct derived values.
- Formula Composer is not shown in normal Takeoff; authorized advanced custom company logic lives outside the daily workflow.
- Provenance/audit detail remains available contextually without permanent narration.

## Takeoff sheet-pane behavior

- Sheet identity and actionable sheet state are primary.
- Sheet rows remain visually quiet and compact.
- Do not repeat routine status metadata on every row.
- Sheet-number/title indexing remains professional and compact; page identity must remain traceable.
- Search, filter, view, and visibility actions may use compact icons with tooltips.

## Takeoff chrome hierarchy

The drawing area is the scarce resource. The Takeoff page should minimize stacked horizontal bands above it.

- Retain permanent app rail and required project/module navigation.
- Retain takeoff-set/project identity and drawing tools.
- Consolidate redundant Takeoff-specific header information where practical.
- Drawing tools should use a sleek icon-first toolbar for high-frequency commands.
- Long persistent keyboard-instruction strings should move to contextual shortcut/help surfaces.
- Status bars should show current/actionable state and avoid duplicating toolbar state.
- Chrome consolidation must be browser-verified across panel open/close, worksheet collapse/expand, resize, and drawing zoom/pan behavior.

## Takeoff drawing surface

The drawing canvas must remain visually primary and should feel closer to a professional Bluebeam-style plan workspace than a dark application canvas.

- Present the plan sheet on a light neutral/cool-gray workspace with strong sheet separation and high plan readability.
- Saved Takeoff geometry remains the dominant application color on top of the document.
- Floating measurement detail is transient/hover-driven.
- Persistent detail stays in the Inspector and Quantity Worksheet.

## Quantity Worksheet / estimating grids

- The permanent worksheet is a dense professional grid, not a stack of cards.
- Slightly increase row/control breathing room without losing estimator density.
- Use clear column hierarchy, resizable boundaries, selective icons, compact filters/search, and strong selected-row treatment.
- Status and hold color are semantic; ordinary rows should remain neutral.
- Important totals may receive stronger typography or contained emphasis, but should not dominate the drawing workflow.

## Builder methods

Builder methods remain explicit through Company Condition Template defaults and Project Concrete Condition overrides. Verification, immutable source lineage, conditional activation, and safety/cost-critical holds remain authoritative. They are configured inside relevant Condition modules rather than through a separate recipe-first workflow.

## Estimate hierarchy

Concrete Condition groups remain collapsible. Each Condition owns its role-linked measurements and generated module/resource/labor/cost children. The redesign preserves exact version/output lineage and separately displays Production Quantity, Direct Cost, and Sell.

## Implementation boundary

The shared visual-system work does not change Takeoff geometry authority, calibration, server-authoritative calculations, RLS/tenant isolation, commercial lineage, accepted-scope immutability, field-truth separation, or Production Quantity/Direct Cost/Sell separation.

ADR-012 separately authorizes the controlled product-model migration from recipe/formula-first UI to Concrete Conditions while preserving published legacy history and calculation lineage. ADR-013 governs derived 3D.

Routine implementation occurs on canonical `staging`. `main` remains production only. User browser QA uses the single stable staging URL defined in `docs/BRANCH_AND_RELEASE_MODEL.md`.
