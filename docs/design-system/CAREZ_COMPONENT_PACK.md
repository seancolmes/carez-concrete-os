# Carez shared component pack

## Active presentation authority — ADR-025

ADR-025 Carez Operations Workspace / Experience System is the active staging presentation authority. The accepted reference implementation covers shared experience primitives plus Today, Projects, and Documents; application-wide propagation remains open under Issue #76. Source-owned accessible primitives retain their APIs. The shared masthead, workspace directory, favorite destinations, record headings, metric ledgers, technical tables, experience tabs, and reference-route primitives form one system. Specialist workspaces consume the same semantic tokens and domain authority.


Status: Accepted design-system contract
Owner: 95 — UX & Design System
Related decisions: ADR-015, ADR-016, ADR-020, ADR-024, ADR-025
Current presentation authority: ADR-025; ADR-024/ADR-016 remain historical/compatible foundations where not superseded.

## Purpose

Carez modules must reuse one compact set of source-owned shadcn-compatible primitives/compositions instead of independently rebuilding the same workstation controls.

The pack is intentionally small. It establishes the components that recur across Takeoff, estimating, CRM, projects, field, finance, documents, and reporting. Module-specific compositions may wrap these primitives, but they should not create a competing local design system.

All shared Carez components use the ADR-025 governed semantic token system, first-class light/dark themes, source-owned React code, accessible keyboard/focus behavior, restrained radii, workspace-adaptive density, and functional motion. A module may choose the specialist or operations workspace expression, but neither becomes a separate theme or component library.

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

## Curated 21st.dev reference shortlist

Reviewed 2026-09-21 from the 21st.dev shadcn registry directory. These remain **reference/source candidates**, not runtime dependencies or a second design system.

- **ReUI Data Grid Table** — strongest source reference for future Estimate, finance, procurement, Owner Reports, and worksheet grid refinements. Relevant variants include dense tables, row selection, sortable/movable/resizable/pinnable columns, sticky headers, column controls, and loading states. Adapt only the interaction/source needed into the Carez Data Grid rather than replacing the Carez grid wholesale.
- **ReUI Tree** — candidate source for richer Conditions, Documents, and project/work-package hierarchy behavior if the current Carez Condition Tree reaches a functional limit. Its headless-tree dependency must be justified before adoption.
- **ReUI Gantt** — candidate source for P3 scheduling/look-ahead prototyping. It is not authorized as a scheduling domain model; Carez committed milestones, rolling lookahead, READY/AT RISK/BLOCKED state, Constraints, and Blocker Events remain authoritative.
- **HextaUI Task Filters** — lightweight reference for reusable filter/search bars on Projects, Readiness, Procurement, Documents, and operational queues.
- **HextaUI Timeline** — reference for Job Spine activity, proposal/award history, change-event history, project evidence, and other chronological lineage views.
- **HextaUI Clean & Minimal Sign In** — reference only. The current Carez login already owns its Supabase behavior and Indigo Harbor/Spatial Blueprint composition; do not replace it merely to adopt a third-party block.
- **COSS Number Field / Input Group / Fieldset** — preferred low-level interaction reference for Carez Number Field and governed technical forms where Base UI behavior materially improves keyboard entry or validation.

Any adopted source must be copied/adapted into Carez-owned components, tokenized to Indigo Harbor, accessibility-reviewed, dependency-vetted, and validated against the owning domain workflow. Do not install an entire registry for one component.

## Operations Workspace foundation

Shared components consume semantic application tokens rather than hard-coded light/dark palettes. Required families include surface canvas/panel/raised, primary/secondary/muted text, default/strong borders, primary/selection/focus interactions, success/warning/error/info states, and density control-height/row-height/workspace-gap.

Appearance preference is `light | dark | system`; System is default. Root density preference is `default | compact | comfortable`. Workspace archetypes may constrain density to preserve readability and touch safety.

Primary UI/display typography is Inter. IBM Plex Mono is reserved for technical identifiers/aligned technical data where mono materially helps; tabular figures remain standard for quantities, money, rates, percentages, and dimensions.

### Indigo Harbor color contract

ADR-025 uses the supplied **Indigo Harbor** palette as the Carez color foundation. Components consume semantic Carez tokens rather than hard-coded local palettes.

```css
/* Light */
--background: #f3f5fb;
--card: #ffffff;
--foreground: #010101;
--muted: #f5f5f5;
--muted-foreground: #454545;
--accent: #19398d;
--border: #e3e3e3;
--input: #ffffff;
--ring: #324f9a;
--primary: #19398d;
--sidebar: #001B3C;

/* Dark */
--background: #050505;
--card: #0a0a0a;
--foreground: #fafafa;
--muted: #262626;
--muted-foreground: #a1a1a1;
--accent: #404040;
--border: #282828;
--input: #121212;
--ring: #6a8dd8;
--primary: #6a8dd8;
--sidebar: #0a0a0a;
```

Carez aliases:

```css
--surface-canvas: var(--background);
--surface-panel: var(--card);
--surface-raised: var(--popover);
--text-primary: var(--foreground);
--text-secondary: var(--muted-foreground);
--text-muted: var(--muted-foreground);
--border-default: var(--border);
--border-strong: var(--ring);
--interaction-primary: var(--primary);
--interaction-selection: var(--accent);
--interaction-focus: var(--ring);
--spatial-accent: var(--primary);

/* Shell uses explicit Indigo Harbor sidebar values because
   .carez-shell rebinds the core semantic variables. */
--shell-background: #001B3C;
--shell-surface: #001B3C;
--shell-foreground: #f4f5fc;
--shell-accent: #19398d;
--shell-primary: #19398d;
```

Inter is the primary Carez UI/display font; IBM Plex Mono remains the technical font. Indigo Harbor applies across the shared shell and specialist workspaces with no separate module palette. Reusable grid-pattern visuals remain low-contrast construction-document backgrounds rather than decorative product chrome.

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

Shared functional motion language used by shell navigation, operational state, queue/file processing, tabs, inspectors, sheets, and other interactions where motion materially communicates change or continuity.

### Base timing

- micro feedback: approximately 120–150 ms;
- active tabs / surface lift / focus transitions: approximately 150–250 ms;
- menus/popovers/dropdowns: approximately 160–190 ms;
- larger sheets/dialog/layout transitions: approximately 180–220 ms;
- one-time value/status transitions only when they communicate real state;
- spring behavior only for direct manipulation or overlays where it improves comprehension.

### Global navigation behavior

The ADR-025 Operations Workspace shell carries forward role-priority destinations through the masthead/workspace directory/favorites model, first-class command/search, and an optional project-context row. Motion remains functional and restrained:

- direct-destination active state changes use ordinary semantic surface/text state rather than decorative movement;
- menus, sheets, and command surfaces may use the shared short opacity/translation/scale transitions;
- chevrons or indicators may animate only to communicate open/closed or selected state;
- navigation transitions must not delay access to estimator, project, field, or finance work;
- the removed permanent category row is not a motion or layout dependency of the Hybrid shell.

### Rules

- motion must communicate action, state, continuity, direct manipulation, loading, or selection;
- no perpetual decorative motion, looping gradients, or page-wide parallax;
- no motion that delays high-frequency estimator actions;
- subtle field/live pulses, queue movement, file-processing transitions, and contextual focus are allowed only when backed by real state;
- all meaningful animation respects `prefers-reduced-motion`;
- transitions must preserve focus and not create pointer traps.

## 10. Shared state, Inspector, and Record Header

Issue #72 implements the reusable presentation/state foundation used by later workspace migrations. These contracts are presentation-only and never become domain authority.

### Semantic state

- `CarezStatus` renders text-first neutral/info/success/warning/error/blocked state using the governed ADR-025 semantic tokens; blocked maps to error semantics without losing the explicit `Blocked` label.
- `CarezSaveState` distinguishes Saved, Saving, Unsaved changes, Validation required, Save failed, Saved on device, and Waiting to sync. Only `Saved` claims server persistence; local/queued states must never imply cloud persistence.
- `CarezAuthorityState` distinguishes user-confirmed, system-calculated, imported, AI-suggested, versioned, issued, and frozen presentation supplied by the owning workflow. It does not infer or promote authority.
- `CarezFeedback` provides inline or workspace feedback with appropriate live-region/alert semantics.
- `CarezProvenance` exposes caller-supplied source/origin detail through concise text or an accessible disclosure; it never fabricates provenance.
- `CarezEmptyState` composes the source-owned shadcn Empty primitive for neutral/error empty-state treatment.

### Operating Metric

`CarezOperatingMetric` and `CarezOperatingMetricStrip` provide the compact Overview/Record metric treatment for operational reference surfaces. They render caller-supplied label, value, supporting text, and semantic tone only. They never calculate readiness, cost, cash, production, margin, or commercial state. Favor one compact strip over unrelated metric cards when the values describe one operating position.

### Inspector

`CarezInspector` is the canonical dense contextual property surface. Header, body/sections, validation, provenance/status/save-state slots, and footer/actions are explicit compositions. The Inspector owns presentation and keyboard/focus structure only; domain persistence, validation rules, autosave, calculations, and approval authority stay with the owning module.

### Record Header

`CarezRecordHeader` is the canonical compact object/workspace identity surface below global/project context. It supports identifier/eyebrow, title, concise metadata, semantic status, and route-owned actions. It is not a hero/banner system and must wrap responsively without moving page actions into the global shell.

### Project Context Bar

`CarezProjectContextBar` and `CarezProjectSwitcher` are shared Carez compositions. Issue #71 route resolution, accessible-project loading, recent-project behavior, and safe switch mappings remain owned by the shell/navigation logic; extracting presentation does not broaden project scope.

### Numeric and grid foundation

`CarezNumberField` accepts semantic presentation kinds (quantity, count, length, area, volume, currency, unit cost, production rate, percentage, duration) while caller/domain code remains authoritative for value, unit, precision, limits, validation, conversion, and stored rounding.

`CarezDataGrid` provides selected-row and sortable-header semantics, numeric/text alignment, density-token row sizing, sticky headers, loading/empty/error composition, and optional resize affordance. Virtualization, grouping, copy/paste, inline editing, and saved column state remain consumer-driven additions rather than speculative base behavior.

Issue #72 passed authenticated staging browser QA on 2026-09-19 at staging SHA `40259ae36e11091239841e5bfadc7c3dd24623c0`. The shared component/state foundation is therefore accepted for reuse by the refined-operations and specialist reference slices; unadopted components still receive workflow-specific browser acceptance when later consumed.

## Spatial Blueprint rule

Spatial/3D treatment is selective. Use plan linework, geometry cues, layered depth, or derived 3D only where it improves technical understanding or customer communication. Appropriate surfaces include Takeoff, markup/customer review, selected hero/landing experiences, and future field-estimating flows. Do not add decorative 3D to repetitive forms, accounting, pricing, or dense tables.

Persisted 2D Takeoff geometry remains quantity authority; 3D remains derived verification.

## Shell compositions built from the pack

The global shell additionally standardizes these Carez-owned responsibilities:

- `CarezTopShell` — compact application header with company identity, the seven-surface primary NavigationMenu, one search/command entry point, and account/system access;
- specialized routes — remain direct and bookmarkable, but are exposed through their owning workspace or the global command search rather than permanent global chrome;
- `CarezProjectSwitcher` / project context bar — compact active-project identity and searchable/recent project switching only when an authoritative project is resolved from `/projects/[id]` or `/job-setup/[projectId]`; global, Takeoff, and Estimate routes do not fabricate project context;
- `CarezCommandMenu` — one global command/search over navigation destinations and accessible projects;
- mobile menu Sheet — the same seven-surface navigation model with expandable curated domain links.

The shell hierarchy is:

```text
global shell → optional project context → workspace/object header → route content
```

Workspace/object headers remain owned by their routes or later shared-header work; page-specific actions do not move into the global shell.

Issue #71 passed authenticated staging browser QA on 2026-09-19 at staging SHA `876737182fc3eec1ea38e67a04cf87dfa0d6ed1f`. Its accepted navigation behaviors are retained where compatible, but ADR-025 is now the implemented staging presentation/shell authority at `457be2068a2b42f7883286a4f467f819e7fc049a`. ADR-024 and ADR-016 remain historical/compatible foundations and no longer govern superseded presentation or shell composition.

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

The pack is accepted in implementation only when shared source components exist, are used by representative module surfaces, pass relevant accessibility/keyboard checks, typecheck/tests/build pass, and browser evidence confirms the components behave correctly in representative Carez light and dark workspaces.
