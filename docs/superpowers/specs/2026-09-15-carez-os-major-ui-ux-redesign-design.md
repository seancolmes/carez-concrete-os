# Carez OS Major UI/UX Redesign Design

**Date:** 2026-09-15  
**Owner:** 95 — UX & Design System  
**Status:** Approved architectural design; implementation decomposed by subproject  
**Scope:** Major presentation and interaction redesign across Carez OS while preserving current domain/workflow architecture

## Goal

Redesign Carez OS as a role-adaptive, project-aware construction operating system with one canonical visual and interaction system. Preserve the existing Job Spine, Takeoff authority, estimating/commercial lineage, production/cost semantics, Supabase/PostgreSQL authority, RLS/tenant isolation, server-authoritative calculations, immutable/versioned records, and module workflow contracts while rethinking global navigation, workspace composition, typography, theme, density, controls, mobile behavior, state communication, accessibility, and AI-assistance presentation.

The master visual direction is **Precision Grid** with two controlled workspace expressions:

- **Industrial specialist expression** for Takeoff, Estimating, Production, and other high-density technical work;
- **Refined operations expression** for Today, Projects, CRM, Finance, and other scan/decision-oriented work.

These are not separate themes or component libraries. They are density/composition expressions of one Carez design system.

## Non-goals

This redesign does not authorize:

- a new domain model or a rewrite of accepted module workflows;
- a second quantity engine, pricing engine, production engine, or 3D authority;
- changes to Supabase/PostgreSQL authority, RLS, tenant isolation, or accepted commercial lineage;
- mutation of immutable issued/accepted/versioned records;
- generic SaaS cardification, glassmorphism, neon/AI-gradient styling, giant rounded containers, or decorative motion;
- separate desktop/mobile products with incompatible semantics;
- a parallel runtime component library supplied by UI UX Pro Max or any other external design source;
- automatic navigation reordering based on inferred behavior;
- AI silently overwriting authoritative scope, estimating, production, pricing, margin, budget, or approval data.

## Governing invariants

The redesign must preserve the following current architecture:

1. Supabase/PostgreSQL remains source-of-truth for persisted application data; RLS and tenant isolation remain mandatory.
2. Server/domain calculations remain authoritative for quantities, cost, pricing, and other governed calculations.
3. Production Quantity, Direct Cost, and Sell remain separate concepts.
4. The persistent Job Spine and accepted bid-to-field lineage remain intact.
5. PDF remains Takeoff visual reference and stable page-coordinate vector geometry remains Takeoff measurement/quantity authority.
6. 2D remains authoritative for Takeoff geometry; derived 3D remains synchronized verification, not a second quantity engine.
7. Published/accepted/versioned commercial history remains immutable and traceable.
8. Estimating retains the sequence Scope/Conditions → Takeoff → Pricing → Labor → Review/Recap → Proposal Revision, with explicit award/Accepted Scope Snapshot boundaries.
9. Project execution retains Accepted Scope Snapshot / frozen baseline → Work Package → Operation → Production Work Unit → Scope Allocation → Schedule/Readiness → Field Actuals/Evidence → Cost/Forecast lineage.
10. Humans remain authoritative for scope, means/methods, production assumptions, pricing, margin, budgets, approvals, and final estimates.

## 1. Product architecture: Hybrid Carez OS

Carez uses a **Hybrid Carez OS** model:

- shell, overview, projects, CRM, finance, and similar business surfaces use the refined operations expression;
- Takeoff, Estimating, Schedule, Production, and other specialist workspaces use denser technical compositions where the task requires it;
- all surfaces share the same semantic tokens, primitives, components, state language, accessibility rules, and navigation model.

The system must feel like one operating system rather than unrelated modules.

## 2. Role adaptation

Carez uses **company role defaults + user personalization**.

The hierarchy is:

```text
company role template
        ↓
user personalization
        ↓
stable global navigation
        ↓
current project context
        ↓
current workspace
```

Role templates define visible priority destinations for estimators, project managers, foremen/superintendents, accounting/finance users, owners/administrators, and future roles. Users may pin, unpin, and reorder permitted global destinations. Personalization changes visibility/order only; it does not rename modules, change domain behavior, or silently move navigation based on usage.

## 3. Global application shell

### Hybrid command shell

Desktop uses one compact horizontal global shell. It contains:

- tenant/company identity with Carez fallback;
- 3–5 role-priority global destinations;
- `More` for lower-priority destinations;
- first-class global command/search (`Cmd/Ctrl + K`);
- notifications;
- account/system controls.

The shell remains visually quieter than the work surface and must not carry page-specific action clutter.

Conceptual shape:

```text
CAREZ | Today | Estimating | Projects | Field | More | Search / Command | Notifications | Account
```

### `More`

`More` is structured by business domain rather than becoming an unorganized overflow bucket. Lower-priority destinations remain discoverable and may be pinned into visible navigation where permitted.

### Command system

`Cmd/Ctrl + K` is a first-class operating surface for:

- navigation;
- projects;
- contacts/companies;
- documents;
- estimates;
- takeoffs;
- recent work;
- commands/actions where the action already has a normal visible path.

The command palette supplements normal navigation and never becomes the only path to a critical action.

## 4. Project-aware context layer

The shell is globally stable. A second contextual row appears **only when a Job/Project is active**.

Conceptual shape:

```text
GLOBAL SHELL
CAREZ | role-priority destinations | More | Search | Notifications | Account

PROJECT CONTEXT — only when active
Lakeview Apartments ▾ | Overview | Estimate | Schedule | Field | Costs | Documents
```

The project context layer must make current project identity unmistakable without permanently consuming space when no project is active.

### Project switching

The project name acts as a context switcher with recent projects, search, and access to all permitted projects. When switching projects, Carez preserves the same workspace type when valid and authorized; otherwise it falls back to Project Overview. Switching project must not silently preserve an object that belongs to the prior project.

### Workspace header

Below global/project context, each actual workspace owns a compact object/workspace header containing object identity, status, relevant metadata, and workspace-specific actions. Page actions do not move into the global shell.

### Orientation rule

At all times a user should be able to answer:

1. Where am I in Carez? — global shell.
2. Which project am I working on? — project context.
3. What object/workspace am I editing? — workspace header.

## 5. Visual foundation — Precision Grid

### Character

Carez uses a premium technical visual system: restrained, exact, modern, construction-appropriate, and information-led. The design should look like serious professional software rather than generic consumer SaaS.

### Brand treatment

Authentic company/Carez branding remains supported. The existing Carez identity is used selectively for:

- global/product identity;
- active navigation/context;
- selection and focus/interaction emphasis;
- branded moments where appropriate.

The Carez wordmark may retain its own gradient/art treatment. Application chrome must not spread that gradient across buttons/cards. A solid semantic Carez blue derived from the identity is used as interaction/selection emphasis where appropriate.

### Typography

Primary UI typography: **Inter Variable**.  
Technical/numeric secondary typography: **IBM Plex Mono** selectively.

Use mono selectively for technical identifiers such as cost codes, drawing references, condition IDs, and measurements where fixed alignment materially helps. Normal body/interface copy remains in Inter. Financial values, quantities, rates, percentages, dimensions, and other aligned numeric data use tabular numerals regardless of family.

### Geometry

- micro spacing unit: 4 px;
- primary grid/base rhythm: 8 px;
- typical control/surface radius: 4–6 px;
- larger bounded surfaces: 6–8 px maximum by default;
- borders: normally 1 px;
- pills/capsules: reserved for statuses/tags and interaction patterns that genuinely require them.

Avoid 16–24 px rounded SaaS-card language across general application surfaces.

### Surface hierarchy

Prefer hierarchy through:

1. typography;
2. spacing;
3. separators;
4. luminance;
5. selection state;
6. elevation only when physically appropriate.

Shadows are uncommon. Popovers, menus, dialogs, floating inspectors, and similar overlays may use elevation. Ordinary sections should normally be separated by layout, borders, and luminance rather than appearing as floating cards.

### Dual theme

Carez adopts **true dual theme**: Light, Dark, and System preference are first-class.

Light mode uses neutral near-white surfaces, graphite foreground, restrained separators, and sparse Carez blue interaction emphasis. Dark mode uses neutral near-black/graphite rather than a blue-black wash. Both themes use the same semantic hierarchy, state language, and accessibility rules.

Theming is token-driven; components are not duplicated by theme.

### Motion

Motion is functional:

- micro interactions: approximately 140–200 ms;
- overlays/layout continuity may use slightly longer transitions where comprehension benefits;
- no perpetual decorative animation;
- all meaningful motion respects `prefers-reduced-motion`;
- movement must explain state, continuity, direct manipulation, or progress rather than decorate the interface.

## 6. Workspace-adaptive density

Carez uses workspace-adaptive density rather than one spacing system everywhere.

Default expressions:

- Takeoff / Estimating: dense specialist workstation;
- Schedule / Procurement / Field planning: medium-dense operational workstation;
- Projects / CRM / Finance: balanced operational density;
- Today / executive views: balanced, scan-oriented density;
- mobile field: touch-first density with larger targets.

Users may choose a controlled **Compact / Comfortable** preference inside the workspace's safe density envelope. User preference must not make specialist grids unreadable or make mobile targets too small.

## 7. Workspace archetypes

Carez standardizes five workspace archetypes.

### Canvas

Primary uses: Takeoff, plan review, derived 3D.

Structure:

```text
contextual navigator/tree | primary canvas | governed inspector
                           | optional synchronized worksheet/dock
```

The canvas receives maximum available area. Side panes may collapse/responsive-convert according to the owning module contract. Takeoff-specific authoritative behavior remains governed by the Takeoff module and ADR-020/current successors.

### Worksheet

Primary uses: Estimating, cost planning, proposal/commercial review, finance.

Structure:

```text
compact toolbar / filters
─────────────────────────
dense governed grid
─────────────────────────
detail / recap / validation / totals
```

Worksheet behavior is keyboard-first and alignment-heavy rather than form-card based.

### Operational

Primary uses: Schedule, procurement, readiness, production/pour control.

Typical structure combines filters/date/operational context with a grid, board, timeline, or list plus contextual detail. The owning module determines the correct primary representation; a generic card wall is not the default.

### Record

Primary uses: Projects, CRM opportunities/customers, vendors/contacts, work packages.

Structure uses a strong identity header, compact sections, related records, and contextual actions rather than a large collection of unrelated cards.

### Overview

Primary uses: Today, project overview, owner/executive surfaces.

Structure emphasizes exceptions, key metrics, decisions, and work requiring attention. It is scan-oriented, not a dense analyst dashboard by default.

## 8. System interaction model

Desktop Carez favors:

> **select → inspect → act**

Selecting an object should update a nearby contextual surface where practical rather than forcing repeated route changes and modal stacks.

Examples:

- selected Condition → Condition Properties;
- selected estimate row → production/cost/sell detail;
- selected schedule activity → dates/dependencies/readiness/responsibility;
- selected document/record → contextual metadata/actions.

### Inspectors, drawers, and dialogs

- **Inspector:** persistent contextual editing tied to current selection.
- **Drawer/sheet:** temporary secondary workflow that should preserve the underlying workspace.
- **Dialog:** short focused decision, destructive confirmation, or compact creation flow.

Do not make every edit a modal.

### Progressive disclosure

Common task inputs and actionable state appear first. Advanced fields, audit metadata, technical IDs, secondary calculations, and rare configuration remain available without dominating the default view.

### Cross-module continuity

Related navigation must preserve project/work context where possible. Users should be able to follow the digital thread (for example Estimate → source Takeoff → selected Condition → drawing geometry, or Project → Work Package → Production → Cost → Billing) without feeling that each destination is a separate product.

## 9. Shared component system

Carez keeps one source-owned shadcn/Base UI/Tailwind component system with three layers:

```text
Primitives
  Button, Input, Select, Checkbox, Switch, Tabs, Tooltip, Menu, Dialog, etc.

Shared Carez components
  Data Grid, semantic numeric fields, Date/Time, Status, Inspector, Toolbar,
  Record Header, Project Context Bar, Command Palette, Resizable Workspace,
  File Upload, Loading/Empty/Error patterns, Condition Tree, etc.

Domain compositions
  Estimate Worksheet, Condition Properties, Takeoff toolset,
  Schedule activity editor, Project cost summary, Pour Control, etc.
```

Domain compositions may combine shared components but must not invent a parallel visual system.

### Action hierarchy

Primary actions are intentionally scarce. The hierarchy is:

**primary → secondary → tertiary/menu → destructive**.

Destructive actions remain visually and semantically distinct from ordinary primary actions.

### Inputs

Inputs are compact working controls with visible labels. Placeholder-only labeling is prohibited for important fields.

### Semantic numeric fields

Carez treats construction/commercial numeric entry as a first-class platform capability. Shared semantic variants include:

- Quantity;
- Length / Area / Volume;
- Currency;
- Unit Cost;
- Production Rate;
- Percentage;
- Duration;
- Date / Time where applicable.

Required behavior includes predictable keyboard editing, visible units while editing, precision/rounding rules, validation, tabular numerals, and clear editable/read-only/derived states.

### Data Grid

Carez Data Grid is a core platform component. Required capabilities where the owning workflow needs them include:

- keyboard cell/row navigation;
- multi-row selection;
- sorting/filtering;
- column resizing/visibility;
- sticky headers and key columns;
- grouping;
- controlled inline editing;
- copy/paste where safe;
- validation;
- totals/summary;
- virtualization for genuinely large datasets.

Numeric columns align right; text columns align left; units/statuses receive stable dedicated treatment.

### Status

Status is semantic and restrained. Text remains the primary meaning; color supplements it. Selection, status, warning, error, and success never share one ambiguous color meaning.

### Inspector

The standardized inspector supports grouped properties, keyboard traversal, validation, unsaved/saving/saved/failed state, and links to relevant source objects/lineage where useful. Critical information must not be hidden behind unnecessary accordion nesting.

### Toolbars

Toolbars are task-specific high-frequency action surfaces located inside workspaces. Dense toolbars are acceptable in specialist workspaces; global navigation remains calm.

## 10. State, feedback, and trust

Carez must make authority visible. The interface distinguishes at least:

- user-entered/confirmed;
- system-calculated;
- imported;
- AI-suggested;
- versioned/issued/frozen.

These distinctions must not rely on color alone.

### Provenance

Important values expose origin through concise drill-down when useful: source measurement/Condition, drawing/detail, company resource/pricing source, calculation lineage, imported document, or AI evidence. Provenance is inspectable without permanently narrating every value.

### Feedback hierarchy

- inline: field/object validation or information;
- banner: workspace-wide state requiring attention;
- toast: brief confirmation with no required decision;
- blocking dialog: meaningful irreversible/authoritative consequence.

Warnings, errors, blocked states, and information are distinct. Routine information remains neutral so warning/error signals stay meaningful.

### Save state

The shared system distinguishes:

- Saved;
- Saving…;
- Unsaved changes;
- Validation required;
- Save failed;
- local/offline queued state where supported.

Critical issued/versioned commercial records must expose revise/issue/void/supersede semantics rather than pretending all records are ordinary mutable autosave documents.

### Error preservation

Save/network failures must preserve user work and explain recovery. The UI must not silently reload a stale server version or clear user edits.

### Destructive actions and undo

Use immediate action + undo for genuinely reversible local/workspace actions where safe. Use confirmations or domain-specific revise/void behavior when consequences are authoritative or irreversible. Never promise undo where the underlying domain cannot reverse safely.

## 11. Accessibility contract

Accessibility is part of each shared component contract, not a final cleanup pass.

Every applicable component defines and tests:

- keyboard behavior;
- visible focus;
- accessible name/role;
- error/status announcement;
- disabled/read-only behavior;
- light/dark contrast;
- reduced-motion behavior;
- touch behavior and non-gesture alternatives where applicable.

Core actions may not rely only on hover, color, drag, swipe, or other hidden gestures.

## 12. Color semantics

The palette reserves meaning:

- **Carez Blue:** selection, focus, primary interaction, branded emphasis;
- **Green:** success / confirmed positive state;
- **Amber:** warning / attention;
- **Red:** error / destructive / critical;
- **Blue-gray/neutral informational treatment:** informational context;
- **neutral:** ordinary application structure.

Selection is not success, warning, or status. Domain-specific geometry color remains governed by the owning workspace and must not collide with global status semantics.

## 13. Mobile and tablet

Desktop and mobile share the same semantic system but optimize for different work.

### Principle

> **Desktop optimizes simultaneous context. Mobile optimizes immediate action.**

### Mobile role

Mobile is field-first and task-first. Priority uses include:

- daily executable work;
- readiness/blockers;
- crew/time and Actual Work Context;
- pour control;
- photos/evidence;
- inspections/issues;
- documents/RFIs;
- simple approvals;
- schedule look-ahead and immediate operational decisions.

Full estimator-grade Takeoff/Estimating remains desktop-primary.

### Mobile navigation

Use 3–5 role-priority bottom-navigation destinations plus `More`, with compact top identity/search/project context as needed. Do not reproduce the desktop command shell literally on narrow screens.

### Mobile interaction model

Mobile favors:

> **open → act → confirm**

Desktop inspectors become bottom sheets or dedicated detail screens according to complexity. No core mobile workflow depends on hover or precision pointer behavior.

### Field input

Minimize typing through appropriate keyboards, defaults, selectors, reusable prior values where safe, camera/photo integration, visible units, and concise actions. The existing field-module rule remains: foremen are exception managers/execution leaders, not routine data-entry clerks.

### Offline/weak connectivity

Field-capable workflows must distinguish:

- saved to Carez/server;
- saving;
- saved on device;
- waiting to sync;
- sync failed.

Carez must not imply cloud persistence when data is only local. Conflicting server/local changes require explicit review when automatic reconciliation is not safe.

### Responsive behavior

Desktop layouts adapt continuously before collapsing to mobile. Do not vertically stack every desktop pane. For example:

- wide: tree | canvas | inspector;
- medium: tree | canvas, inspector collapsible;
- tablet/narrow: primary canvas/content with tree/inspector as drawers/sheets;
- mobile: simplified task workflow.

Tablet is the bridge for drawing review, punch/issues, inspections, document markup, schedule review, quantity verification, and production entry.

## 14. AI interaction model

AI Assistance is an assistant layer, not hidden authority.

AI may identify likely plan information, extract candidate values, suggest classifications/links, compare revisions, surface anomalies, retrieve information, and summarize evidence. It may not silently approve or overwrite authoritative scope/commercial/production decisions.

### Approval behavior

Preserve the existing AI module tiers:

- automatic only for low-risk clerical/indexing work;
- suggest + batch approve for metadata candidates;
- individual approval for scope-impacting geometry, measurement-role, or Condition suggestions;
- advisory only for production rates, pricing, margin, budget, and final commercial decisions.

### AI review surface

A suggestion should show:

- suggested value/action;
- current authoritative value where applicable;
- source/evidence;
- conflict state where applicable;
- explicit Accept / Edit / Keep Current / Dismiss action according to risk.

### Confidence

Do not present fabricated precision. Use calibrated probability only if the underlying system truly supplies one. Otherwise prefer qualitative review states such as High confidence, Needs review, Conflicting evidence, or Source not found, accompanied by evidence.

The primary user question should be **Why is Carez suggesting this?** rather than a decorative confidence number.

## 15. UI UX Pro Max governance

UI UX Pro Max is approved as a **design-intelligence and implementation-guidance tool**, not as runtime design authority.

The authority chain is:

```text
Carez domain/module/architecture rules
        ↓
approved Carez UX design + replacement ADR(s)
        ↓
Carez semantic tokens + source-owned shadcn/Base UI components
        ↓
workspace/domain compositions
```

UI UX Pro Max may provide style research, design-system generation, accessibility/density/motion guidance, and page-level recommendations. Recommendations are accepted only when compatible with the approved Carez design and domain contracts.

The previously run `uipro init --ai codex` was executed from `C:\Windows\System32`, so it did not install project-local Carez tooling. After written-spec approval and before implementation planning/execution that needs the skill, install it from the actual Carez repository root and restart Codex. Project-local generated skill/tooling files must be reviewed before they are committed; the runtime product must not depend on the CLI/skill package.

## 16. Canonical design-system architecture

Theme, density, workspace expression, and role navigation are configuration of one system:

```text
Theme
  light | dark | system

Density
  workspace default + compact/comfortable user preference

Workspace expression
  precision core | specialist | operations

Role navigation
  company role defaults + user personalization
```

Use semantic tokens rather than page/color-specific constants. Required token families include at least:

```text
surface.canvas / panel / raised
text.primary / secondary / muted
border.default / strong
interaction.primary / selection / focus
status.success / warning / error / info
density.control-height / row-height / workspace-gap
```

Exact token names may follow repository conventions, but semantic responsibility is fixed.

## 17. Current ADR and canonical-doc transition

This design is approved in chat but does not silently rewrite current canonical ADRs. Until the written spec is reviewed and replacement architecture is promoted, current accepted ADRs remain active.

After written-spec approval, the implementation plan must include a canonical-doc reconciliation step before broad route migration:

### ADR-015 — Dark minimal shadcn application system

Retain compatible principles:

- source-owned shadcn/Base UI/Tailwind foundation;
- semantic/scarce color;
- continuous workstation surfaces;
- restrained radii/shadows;
- typography-led hierarchy;
- functional motion;
- persistent-text/content discipline;
- no parallel design systems.

Supersede/replace:

- dark-first/default-only presentation assumptions;
- any rule inconsistent with true first-class light + dark themes;
- presentation details displaced by Precision Grid and workspace-adaptive density.

### ADR-016 — Top navigation shell and shared component pack

Retain:

- no permanent global desktop left rail;
- compact top-level shell principle;
- source-owned shared components;
- contextual module panes inside workspaces;
- quiet shell / dominant work surface;
- tenant branding protections and commercial snapshot behavior.

Supersede/replace shell details with:

- role-adaptive visible destinations;
- user personalization;
- Hybrid command shell;
- structured `More`;
- first-class command palette;
- project context bar that appears only when a project is active;
- explicit global shell → project context → workspace header hierarchy.

### ADR-020 — Integrated Takeoff workstation

Retain all Takeoff/domain authority and accepted workstation invariants that remain current, including 2D authority, derived 3D verification, synchronized selection, single governed Condition Properties surface, dominant drawing area, contextual navigator, and worksheet behavior.

Supersede only presentation/layout details that conflict with the new Canvas archetype, dual-theme tokens, or the replacement shell. The active Takeoff module spec and any newer accepted 3D decision remain authoritative where they have already superseded older `2D | 3D | Split` assumptions.

### CAREZ_COMPONENT_PACK.md

Retain the shared-source ownership model and existing useful component contracts. Update the pack after written-spec approval to reflect:

- dual-theme semantic tokens;
- workspace-adaptive density;
- project context/record header/inspector/command system;
- semantic numeric variants;
- trust/save/provenance/error states;
- mobile/tablet behavior where shared.

### ADR-019 — Tactile metric card system

Do not silently remove the bounded-summary concept. During canonical reconciliation, verify its interactive perspective/lift treatment against Precision Grid and the new motion/elevation rules. Any retained metric-card motion must remain restrained, accessible, and subordinate to the new visual foundation; incompatible tactile decoration must be explicitly superseded rather than left contradictory.

### Issue #44

Issue #44 currently owns the previous dark-shadcn route migration. After written-spec approval, review it before further broad presentation migration. Reframe it around the new design where compatible, or close/supersede it and move remaining implementation work into new redesign issues. Do not complete obsolete presentation work merely to satisfy the old issue wording.

## 18. Migration strategy

Migration proceeds by **foundation + reference vertical slices**, not an all-routes rewrite.

### Phase A — canonical reconciliation and foundation

- replacement/updated UX ADR(s) and component-pack authority;
- semantic light/dark token architecture;
- density system;
- role-navigation configuration and user personalization model;
- Hybrid command shell;
- project context layer;
- core shared components and state/accessibility contracts.

### Phase B — reference operational slice

Use **Today → Project → Project Overview** as the refined-operations reference path. It validates shell, role navigation, project context, overview/record archetypes, balanced density, status/state semantics, and responsive behavior.

### Phase C — reference specialist slice

Use **Project → Takeoff** or the active Takeoff workstation as the specialist reference. It validates dense technical behavior, canvas composition, contextual panes, inspector, toolbar, Data Grid/worksheet, keyboard operation, and preservation of accepted measurement/Condition/3D behavior.

### Phase D — validate the system

Do not expand broadly until both reference expressions are coherent in light/dark themes and representative desktop sizes, with required accessibility/keyboard behavior and rendered browser acceptance.

### Phase E — module migration

Migrate remaining routes by owning module, reusing the canonical shell/components/archetypes. Domain behavior changes discovered during UI work are routed separately to the owning module rather than being hidden inside presentation refactors.

### Phase F — legacy removal

For each legacy/compatibility consumer:

```text
migrate consumer → automated validation → browser verification → remove dead compatibility rules → verify again
```

Delete `app/carez-shadcn-compat.css` and other legacy presentation only after all consumers are migrated and browser-verified. Do not perform a speculative global CSS deletion.

## 19. Implementation-plan decomposition

This document is the cross-application architectural umbrella. It is intentionally too broad to execute as one implementation batch. After written-spec approval, implementation planning must proceed as a sequence of independently verifiable subprojects. Do not create one giant plan that attempts to migrate the entire application at once.

The required planning sequence is:

1. **Canonical authority + token foundation** — replacement/updated UX ADR(s), component-pack reconciliation, semantic light/dark tokens, typography/spacing/radius/elevation/motion tokens, density primitives, and theme preference contract. No broad route migration.
2. **Global shell + navigation context** — role-default navigation configuration, user personalization contract, Hybrid command shell, structured `More`, command palette, project context bar, workspace header contract, and responsive shell behavior.
3. **Shared component/state foundation** — Data Grid, semantic numeric fields, Inspector, Toolbar, Record Header, Project Context Bar, loading/empty/error/save/provenance/status/accessibility contracts, and any required extensions of existing shared components.
4. **Refined-operations reference slice** — Today → Project → Project Overview, proving Overview/Record archetypes, balanced density, dual theme, project context, role-aware shell, and responsive behavior.
5. **Specialist reference slice** — Project → Takeoff, proving Canvas archetype, specialist density, panes, toolbar, inspector, worksheet/Data Grid, keyboard behavior, and preservation of accepted Takeoff/Condition/3D invariants.
6. **Module migration waves** — Estimating, CRM/Preconstruction, Projects/Schedule, Field/Production, Procurement/Finance, Documents/Knowledge, and later AI-assisted surfaces migrate in owning-module slices using the validated system.
7. **Field/mobile hardening + legacy retirement** — complete field-first mobile/tablet behavior, offline/sync states where supported, remove legacy/compatibility presentation only after consumers are accepted, and finish cross-application visual/accessibility regression coverage.

The first implementation plan after this spec is approved must cover **Subproject 1 — Canonical authority + token foundation** only. Later subprojects receive their own implementation plans. A supplemental design/spec review is required only if a subproject uncovers new architecture or behavior not already fixed by this umbrella design.

## 20. QA and acceptance

A route is not considered redesigned because Tailwind/shadcn classes changed or because typecheck/build passes. A redesigned surface is accepted only when workflow behavior is preserved and rendered staging behavior matches the approved system.

### Required acceptance matrix

For each applicable migrated workspace:

- light theme;
- dark theme;
- wide desktop;
- standard laptop;
- keyboard navigation;
- visible focus;
- workspace/default density and user Compact/Comfortable preference where supported;
- correct role-navigation behavior;
- correct active-project context behavior where applicable;
- loading, empty, error, validation, saving, and failed-save states;
- reduced motion;
- browser render verification on the stable staging URL.

Field-capable routes additionally require representative mobile/tablet and offline/sync/error behavior according to module support.

### Visual regression reference states

Canonical workspace references should include representative captures/stories for:

- empty;
- normal;
- selected;
- editing;
- validation error;
- loading;
- permission-limited where applicable;
- long-content/dense-content;
- dark;
- light.

### Functional regression boundary

UI work must not silently change:

- quantities;
- production logic;
- cost/sell calculations;
- persisted geometry;
- commercial snapshots/versioning;
- RLS/permissions;
- project/Job Spine relationships;
- document authority;
- Takeoff 2D/3D authority boundaries.

### Standard verification flow

For implementation slices:

1. typecheck;
2. relevant domain/unit tests;
3. production build;
4. staging deployment;
5. authenticated browser verification on the stable staging URL;
6. user acceptance where required;
7. update `CURRENT_STATE.md` only when verified implementation state materially changes.

## 21. Completion definition

The major redesign is complete only when:

- the approved role-adaptive Hybrid Carez OS shell is canonical and browser-verified;
- true first-class light/dark themes are implemented through semantic tokens;
- workspace-adaptive density and the Precision Grid visual foundation are consistently applied;
- the five workspace archetypes are represented through shared compositions rather than page-local design systems;
- shared component/state/accessibility behavior is reused across modules;
- project context and workspace identity remain explicit;
- specialist and refined-operations reference slices both pass rendered acceptance;
- field/mobile routes use task-first responsive behavior where applicable;
- AI suggestions remain evidence-backed and human-authoritative at the proper approval tier;
- legacy compatibility presentation is removed only after consumers are migrated and verified;
- current domain/data/commercial/Takeoff invariants remain intact;
- stale/superseded UI authority is reconciled in canonical ADR/component documentation.

## Approved design summary

```text
CAREZ OS

Precision Grid master visual system
├── Industrial specialist expression
└── Refined operations expression

Role defaults
└── user personalization

Hybrid command shell
└── contextual project layer (only when project active)
   └── workspace header
      └── Canvas / Worksheet / Operational / Record / Overview

True dual theme
Workspace-adaptive density
One semantic component system
Desktop simultaneous context
Mobile immediate action
Explicit provenance / save / error / authority states
Human-authoritative, evidence-backed AI assistance
Foundation + reference-slice migration
Rendered staging acceptance required
```

This design is the approved architectural umbrella. Implementation proceeds through independently planned/verified subprojects beginning with Issue #63 — Canonical authority + token foundation.
