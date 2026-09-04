# ADR-016 — Top navigation shell and shared Carez component pack

Status: Accepted
Date: 2026-09-04
Owner: 95 — UX & Design System
Supersedes: ADR-006 in full; the shell-specific portions of ADR-012, ADR-015, the Takeoff module spec, and the Concrete Condition workstation target where they require a permanent global left app rail.

## Context

The permanent desktop app rail protected global navigation during the earlier Carez workstation modernization, but the approved Concrete Condition / Estimating EDGE-inspired workstation now needs more horizontal room for domain-specific context panes, drawing, Condition Properties, 2D/3D/Split review, and the Quantity/Estimate Worksheet.

Keeping a permanent global rail beside a module-specific context pane creates redundant horizontal chrome. The accepted Carez direction is therefore to move global navigation to the top of the application while preserving contextual module panes inside the workspace.

The same decision also establishes a first shared Carez component pack so module conversions reuse one source-owned shadcn workspace instead of independently inventing grids, number inputs, date controls, trees, toolbars, resizable layouts, uploaders, loading states, or motion behavior.

## Decision

### Desktop shell

Carez desktop uses three distinct navigation layers:

1. **Compact application header** — Carez identity, current company/project context where relevant, global command/search, notifications, quick-create where justified, and account controls.
2. **Global category navigation bar** — top-level Carez categories with animated dropdown/navigation panels.
3. **Module-specific contextual panes** — task-specific panes inside the current workspace, such as Plans / Conditions / Zones in Takeoff, project filters/tree in Projects, or folders/filters in Documents.

There is no permanent global desktop left app rail in the accepted target.

Canonical desktop structure:

```text
[ compact application header ]
[ global category navigation + animated dropdown panels ]
[ contextual module pane ][ primary workspace ][ optional governed properties/detail pane ]
                         [ persistent module dock/worksheet where applicable ]
```

The global shell must remain visually quieter than the work surface.

### Header

The authenticated desktop header is compact, approximately in the 44–48 px class unless browser evidence requires adjustment.

It may contain:

- authentic Carez brand identity;
- current company/project/job context where useful;
- global command/search;
- notifications;
- a restrained quick-create action where justified;
- account/profile menu.

Do not use the shell for redundant page narration, duplicate breadcrumbs, large page titles, or dashboard-style summary content.

### Category navigation

A second compact row, approximately in the 34–38 px class unless browser evidence requires adjustment, exposes the top-level product categories.

Category grouping is data-driven and may evolve without changing this ADR. The navigation must support the current Carez module families, including Today, Preconstruction, Estimating, Projects, Field, Finance/Procurement, and Documents/Knowledge. Settings belongs under account/system controls unless a workflow later proves a dedicated top-level entry is needed.

Large categories use wide multi-column navigation panels rather than long single-column menus. High-value recent or resumed work may appear contextually when it reduces navigation time, but recent-item presentation must not overwhelm the category destinations.

### Animated dropdown/navigation panels

Global category panels are polished, fast, and functional rather than decorative.

Expected behavior:

- panel appears directly beneath the category navigation row;
- opacity, short vertical translation, and very slight scale may be combined;
- typical transition duration is approximately 160–190 ms within the ADR-015 120–220 ms motion envelope;
- category chevrons/indicators may animate subtly;
- active-category indicator may glide between categories;
- switching from one open category to another should reuse/morph the existing panel container where practical instead of visibly destroying one menu and creating another;
- keyboard navigation, focus management, escape-to-close, pointer intent, outside-click handling, and reduced-motion behavior are mandatory;
- no perpetual decorative animation.

Implementation should start from source-owned shadcn-compatible navigation/menu primitives and may selectively adapt vetted beUI, HextaUI, ReUI, COSS UI, or Lucide Animated interaction/source patterns after license and technology review per ADR-015.

### Contextual module panes

Removing the global left rail does **not** remove module side panes.

Contextual panes belong to the current workflow and may be left, right, docked, collapsible, resizable, or temporarily floating when the module contract requires it.

Examples:

- Takeoff: Plans / Conditions / Zones on the left; Condition Properties on the right or floating/docked; Quantity/Estimate Worksheet below.
- Projects: project/work-package filters or tree beside the project workspace.
- Documents: folders, revisions, filters, or document tree beside the document workspace.

A contextual pane must never become a second global navigation system.

### Mobile

Mobile remains field-first. Global categories may collapse into a Sheet/drawer or other compact mobile navigation pattern. This ADR does not require the desktop top navigation row to be forced onto narrow mobile layouts.

## Shared Carez component pack

The first accepted shared component pack is defined in `docs/design-system/CAREZ_COMPONENT_PACK.md`.

Required initial primitives/compositions:

- Carez Data Grid;
- Carez Number Field;
- Carez Date/Time Field;
- Carez Condition Tree;
- Carez Toolbar;
- Carez Resizable Workspace;
- Carez File Upload;
- Carez Loading States;
- Carez Motion system.

These are Carez-owned source components/compositions built on the existing shadcn/Base UI/Tailwind foundation. Third-party registries are source/reference pools only and do not become parallel runtime design systems.

Every module conversion should prefer these shared components when the interaction matches rather than creating a local equivalent.

## Architecture protection

This shell and component decision is presentation/interaction architecture only. It does not change:

- Supabase/PostgreSQL authority;
- RLS or tenant isolation;
- Job Spine or commercial lineage;
- server-authoritative calculations;
- immutable/versioned accepted records;
- Takeoff page-coordinate vector geometry;
- calibration, measurement editing, undo/redo, or quantity authority;
- Concrete Condition / module / output lineage;
- 2D authority and derived 3D verification boundary.

## Implementation and acceptance

Issue #44 owns implementation of this shell and component pack as part of the full dark shadcn conversion.

Acceptance requires:

- the permanent global left app rail removed from authenticated desktop routes;
- top application header and global category navigation implemented from shared source-owned components;
- category panels keyboard/focus/pointer/reduced-motion behavior verified;
- contextual module panes preserved and correctly separated from global navigation;
- Takeoff gains usable horizontal space without geometry/calculation regressions;
- the first shared component pack exists in source and is consumed by representative module surfaces before local duplicates are added;
- typecheck, domain tests, production build, stable staging deployment, and browser verification pass;
- no claim of shell acceptance is made from source/build evidence alone.
