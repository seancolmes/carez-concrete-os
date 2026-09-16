# Carez shared component pack

Status: Accepted design-system contract
Owner: 95 — UX & Design System
Related decisions: ADR-015, ADR-016
Implementation owner: Issue #44 while the Carez-wide shadcn conversion remains open

## Purpose

Carez modules must reuse one compact set of source-owned shadcn-compatible primitives/compositions instead of independently rebuilding the same workstation controls.

The pack is intentionally small. It establishes the components that recur across Takeoff, estimating, CRM, projects, field, finance, documents, and reporting. Module-specific compositions may wrap these primitives, but they should not create a competing local design system.

All shared Carez components use the ADR-024 Precision Grid semantic token system, first-class light/dark themes, source-owned React code, accessible keyboard/focus behavior, restrained radii, workspace-adaptive density, and functional motion. A module may choose the specialist or operations workspace expression, but neither becomes a separate theme or component library.

Third-party component libraries are reference/source pools only. Any copied/adapted code must be license-vetted, reviewed for accessibility and bundle cost, converted to Carez semantic tokens, and owned in the Carez repository.

## UI redesign option-research protocol

When Nik asks to redesign, rethink, or improve a Carez UI surface, do not jump directly to one visual composition unless he explicitly asks for a single direction.

Before recommending the design:

1. inspect the current Carez route/component source, the relevant module contract, the active shell, semantic tokens, and existing shared Carez components;
2. research current shadcn/ui primitives, compositions, docs, and registry patterns that fit the interaction;
3. research the applicable approved external reference/source pools in ADR-015, including HextaUI, UI-X, Loading UI, LocalMode interaction references, COSS UI, Lucide Animated, ReUI, More Shadcn, and beUI when they are relevant; use current/live source pages when available rather than relying only on remembered patterns;
4. normally present 2–4 meaningfully different functionality/interaction options before converging on one direction;
5. for each option identify the reference/component family, core interaction model, why it fits Carez, desktop/mobile behavior where relevant, likely implementation complexity or risk, and what can reuse existing Carez source versus requiring a new Carez-owned composition;
6. distinguish a real reusable source component from a design/inspiration reference, and do not imply incompatible or unverified source can be copied directly;
7. recommend the strongest option for the Carez workflow while preserving Nik's choice;
8. after Nik selects or approves a direction, produce the requested mockup/build prompt/implementation using the chosen pattern and promote material accepted behavior into canonical GitHub documentation.

Options should differ in behavior or workflow, not merely color, spacing, or cosmetic styling. For example, a navigation redesign might compare an icon rail + flyout model, a collapsible contextual tree, and a command/search-centered model rather than three visually similar sidebars.

This protocol does not authorize a second design system. External sources remain reference/source pools subject to ADR-015 licensing, accessibility, bundle-cost, architecture, and Carez-token requirements.

## Precision Grid foundation

Shared components consume semantic application tokens rather than hard-coded light/dark palettes. Required families include surface canvas/panel/raised, primary/secondary/muted text, default/strong borders, primary/selection/focus interactions, success/warning/error/info states, and density control-height/row-height/workspace-gap.

Appearance preference is `light | dark | system`; System is default. Root density preference is `default | compact | comfortable`. Workspace archetypes may constrain density to preserve readability and touch safety.

Primary UI typography is Inter Variable. IBM Plex Mono is reserved for technical identifiers/aligned technical data where mono materially helps; tabular figures remain standard for quantities, money, rates, percentages, and dimensions.

## 1. Carez Data Grid

### Role

Primary dense operational grid for estimator, project, field, procurement, finance, document, and reporting data.

### Reference pool

- shadcn Table / Data Table composition;
- ReUI Data Grid patterns;
- COSS UI / HextaUI interaction patterns where useful.

### Required behavior

- compact density suitable for desktop workstation use;
- sortable columns where domain behavior allows;
- column filtering and shared filter-bar composition;
- resizable columns;
- row selection and selected-row state;
- keyboard navigation and visible focus;
- sticky/pinned columns only where the workflow materially benefits;
- horizontal/vertical scrolling without hiding essential controls;
- tabular numeric alignment for quantity, cost, price, hours, dates, and percentages;
- semantic state badges/indicators only where meaningful;
- loading, empty, error, and no-result states from the shared Loading/Empty patterns;
- optional virtualization for genuinely large row sets, not by default;
- saved column layout/view only where a module needs it.

### Initial consumers

Quantity/Estimate Worksheet, Estimate Grid, project/work-package tables, Owner Reports, production data, procurement, billing, cash/banking, document lists.

## 2. Carez Number Field

### Role

Authoritative numeric input for dimensions, quantities, spacing, counts, waste, production rates, percentages, money, and other governed numeric values.

### Reference pool

- COSS UI Number Field interaction model;
- shadcn/Base UI number/input primitives;
- compatible scrubbing patterns inspired by vetted component sources.

### Required behavior

- direct keyboard entry;
- step increment/decrement where meaningful;
- configurable min/max/step;
- unit suffix/prefix or Input Group composition;
- tabular numeric rendering;
- optional pointer scrubbing only where accidental change risk is acceptable;
- precision/rounding display separated from server-authoritative stored/calculated value;
- formatted variants for currency, percentage, decimal quantity, count, and governed construction dimensions;
- read-only derived values visually distinct from editable values;
- clear validation and hold state;
- no browser-only domain calculation authority.

### Initial consumers

Condition Properties, rebar spacing/counts, footing/slab/wall dimensions, labor/production assumptions, estimate pricing, markup, procurement quantities, finance entry.

## 3. Carez Date/Time Field

### Role

Shared date, time, date-time, and range entry for bid dates, follow-ups, schedules, inspections, pour windows, deliveries, invoices, payment dates, and reports.

### Reference pool

- UI-X Date/Time Field and range patterns;
- shadcn Calendar/Popover/Input foundations.

### Required behavior

- segmented keyboard-friendly date/time entry;
- calendar popover where useful;
- date range support;
- optional time range support;
- explicit display of timezone/site-time semantics when the domain requires it;
- min/max/disabled-date constraints;
- locale-safe display;
- accessible focus order;
- clear invalid/incomplete state;
- server/domain remains authoritative for stored date/time semantics.

### Initial consumers

CRM follow-up/bid dates, proposals, project scheduling, look-ahead, pour control, deliveries, time review, billing/payment/report filters.

## 4. Carez Condition Tree

### Role

Hierarchical condition/navigation surface for concrete estimating and other domain trees where object relationships matter.

### Reference pool

- ReUI Tree;
- HextaUI Tree / collapsible / context-menu patterns;
- shadcn primitives.

### Required behavior

- compact hierarchical rows;
- expand/collapse;
- search/filter;
- synchronized selected object state;
- visibility toggle where relevant;
- semantic color chip only where Condition drawing color is meaningful;
- status/hold indicator only when actionable;
- keyboard navigation;
- context menu for legitimate domain actions;
- drag/reorder only when the domain model explicitly permits it;
- virtualization only for large trees;
- no duplicate permanent explanatory text.

### Initial consumers

Takeoff Conditions pane, Plans/sheet hierarchy where appropriate, Documents tree, project/work-package hierarchy where useful.

## 5. Carez Toolbar

### Role

Compact grouped action surface for high-frequency workstation commands.

### Reference pool

- shadcn Button / Toggle / Toggle Group / Tooltip / Dropdown Menu / Popover;
- COSS UI Toolbar patterns;
- beUI/HextaUI interaction polish;
- Lucide / vetted animated Lucide icons.

### Required behavior

- icon-first for conventional actions;
- tooltip/shortcut disclosure;
- grouped actions with separators;
- clear active/toggled state;
- overflow menu instead of uncontrolled wrapping;
- keyboard operation and visible focus;
- destructive actions separated and confirmed where needed;
- animated icons only for functional feedback/state transition;
- no decorative icon wall.

### Initial consumers

Takeoff measurement toolbar, 2D/3D/Split controls, worksheet tools, document actions, schedule controls, estimate review actions.

## 6. Carez Resizable Workspace

### Role

Shared split-pane composition for professional desktop workstations.

### Reference pool

- shadcn Resizable / panel primitives;
- HextaUI resizable patterns;
- beUI dock/focus interaction references.

### Required behavior

- horizontal and vertical pane resizing;
- explicit min/max sizes;
- safe collapse/restore where approved;
- local persistence of user layout where beneficial;
- safe reset-to-default;
- no domain mutation caused by resizing;
- avoid pane overlap and unreachable handles;
- preserve keyboard focus where possible;
- responsive fallback for smaller screens;
- `prefers-reduced-motion` respected for animated layout transitions.

### Takeoff target

The primary Takeoff composition is:

```text
[ Plans / Conditions / Zones ][ 2D / 3D / Split drawing ][ Condition Properties ]
                               [ Quantity / Estimate Worksheet                ]
```

The global navigation lives above this workspace, not in another permanent left rail.

## 7. Carez File Upload

### Role

Shared uploader/dropzone for plans, documents, field photos, tickets, receipts, quotes, invoices, and other real business files.

### Reference pool

- ReUI File Upload;
- UI-X Dropzone;
- shadcn input/progress primitives.

### Required behavior

- click and drag/drop intake;
- accepted type/size guidance;
- file queue;
- progress when real progress is available;
- upload success/error/retry/cancel state where supported;
- duplicate/conflict handling supplied by the owning domain;
- keyboard-accessible dropzone;
- thumbnails/previews only for authentic uploaded media, never generated filler art;
- upload does not silently change document revision authority or supersede records without domain rules.

## 8. Carez Loading States

### Role

Consistent loading, processing, indexing, importing, and background-operation feedback.

### Reference pool

- Loading UI patterns;
- shadcn Skeleton / Progress / Spinner-style primitives.

### Required patterns

- inline activity indicator for short local actions;
- skeleton for initial content structure when it improves continuity;
- determinate progress only when real progress is known;
- indeterminate progress for unknown-duration work;
- specialized restrained states for plan/PDF processing, document indexing, import/export, and analysis;
- concise current-state text only when it helps the user decide whether to wait, cancel, retry, or continue elsewhere;
- never fake percentage completion;
- no decorative perpetual loading animation when the operation is complete.

## 9. Carez Motion

### Role

Shared functional motion language used by shell navigation and interactive primitives.

### Base timing

- micro feedback: approximately 120–150 ms;
- menus/popovers/dropdowns: approximately 160–190 ms;
- larger sheets/dialog/layout transitions: approximately 180–220 ms;
- spring behavior only for direct manipulation or overlays where it improves comprehension.

### Global navigation behavior

Category navigation panels may combine:

- opacity 0 → 1;
- short negative Y translation → 0;
- very slight scale → 1;
- animated chevron/indicator;
- horizontal active-category indicator movement;
- content/container morph when switching among already-open categories where practical.

### Rules

- motion must communicate action, state, continuity, direct manipulation, loading, or selection;
- no perpetual decorative motion;
- no motion that delays high-frequency estimator actions;
- all meaningful animation respects `prefers-reduced-motion`;
- transitions must preserve focus and not create pointer traps.

## Shell compositions built from the pack

The global shell additionally standardizes these Carez-owned compositions:

- `CarezTopShell` — compact application header;
- `CarezCategoryNav` — global category row;
- `CarezNavPanel` — animated wide dropdown/navigation panel;
- `CarezProjectSwitcher` — project/company context selection where relevant;
- `CarezCommandMenu` — global search/command palette.

Names may change during implementation if repository conventions require it, but the responsibilities stay canonical.

## Module adoption rule

When converting a module:

1. inspect this component pack and current source implementation first;
2. reuse or extend the shared primitive when the interaction matches;
3. add domain-specific wrappers/compositions in the owning module when necessary;
4. do not fork a visually different local version merely for convenience;
5. route genuinely reusable new patterns back through 95 for canonicalization;
6. preserve business/domain semantics and server-authoritative calculations;
7. browser-verify the rendered result on canonical staging.

## Acceptance

The pack is accepted in implementation only when shared source components exist, are used by representative module surfaces, pass relevant accessibility/keyboard checks, typecheck/tests/build pass, and browser evidence confirms the components behave correctly in the dark Carez workspace.