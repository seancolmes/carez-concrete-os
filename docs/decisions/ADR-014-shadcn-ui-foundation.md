# ADR-014 — shadcn/ui Application Foundation

Status: Accepted

Supersedes: ADR-011 for visual-system and shared-component implementation.

## Decision

Carez uses shadcn/ui as the canonical shared UI component foundation for the web application.

The active application design system is no longer the accumulated B2/light stylesheet stack. Carez will use actual shadcn component source owned in the repository under `components/ui`, Tailwind CSS v4, semantic CSS variables, and shadcn composition patterns as the presentation foundation.

This is a complete UI/UX redesign, not a domain rewrite. Existing Carez architecture, product meaning, construction workflows, data authority, and commercial lineage remain authoritative.

## Component contract

Use shadcn primitives directly for ordinary application UI wherever they fit the interaction:

- `Sidebar`, `SidebarProvider`, `SidebarInset`, `SidebarTrigger`, groups and menus for the authenticated application shell;
- `Breadcrumb` for route/workspace context;
- `Command` plus `Dialog` for global route/action search;
- `DropdownMenu`, `Popover`, `Dialog`, and `Sheet` for transient controls and progressive disclosure;
- `Button` and icon buttons for actions;
- `Card` only for genuinely contained summaries or task groups;
- `Table` / data-table compositions for dense operational, estimating, production, reporting, and finance data;
- `Field`, `Input`, `Select`, `Checkbox`, `Textarea`, and `Label` for forms;
- `Badge` for concise status/state;
- `Tabs` for bounded workspace modes and module-local navigation;
- `Resizable` for pane boundaries where resizing is part of the accepted workstation behavior;
- `Tooltip` for icon-only and dense workstation controls;
- `ScrollArea`, `Separator`, `Skeleton`, `Progress`, and `Empty` for their intended support roles.

Components may be composed into Carez-specific application components, but ordinary controls must not be reimplemented as parallel one-off CSS widgets when an accepted shadcn primitive already fits.

## Theme contract

Carez uses one shadcn semantic-token theme.

Required token families include background/foreground, card, popover, primary, secondary, muted, accent, destructive, border, input, ring, chart, sidebar, and radius tokens. Carez branding is expressed through those semantic tokens and deliberate application composition rather than a second independent theme layer.

The default application is light, neutral, and highly legible. Carez blue is the primary interaction color. Green, amber, and red are semantic state colors. Takeoff measurement colors remain distinct from ordinary chrome.

The UI remains concrete-native and workstation-oriented:

- desktop is dense enough for estimating and project control without tiny microtext;
- data-heavy work is table/list-first, not a decorative card wall;
- controls and headings use normal sentence/title case;
- whitespace is functional rather than excessive;
- rounded corners and elevation follow the shadcn system and stay restrained;
- mobile remains field-first.

## Shell contract

ADR-006 remains authoritative: the desktop application rail is permanent.

The rail is implemented with the shadcn Sidebar system and may collapse to its icon rail while remaining structurally present. Mobile navigation uses the Sidebar/Sheet behavior supplied by the same component system.

The application header uses shadcn shell patterns: SidebarTrigger, contextual breadcrumb/title, global command/search access, and bounded utility/user controls.

## Takeoff boundary

The shadcn redesign changes Takeoff chrome and control composition, not measurement authority.

The accepted Concrete Condition and derived 2D/3D Takeoff contracts remain in force. Preserve:

- stable page-coordinate vector geometry as measurement authority;
- PDF as visual reference;
- calibration and scale-region semantics;
- 2D / 3D / Split workflow;
- Plans / Conditions / Zones context organization;
- dominant drawing surface;
- governed Condition Properties behavior;
- permanent resizable Quantity/Estimate Worksheet;
- exact Takeoff → assembly/scope → estimate lineage.

Resizable, Tabs, Button, Tooltip, Dropdown Menu, Sheet/Dialog/Popover, form controls, and Table should replace bespoke chrome where doing so does not alter geometry or domain behavior.

## Architecture protections

This decision does not alter:

- Supabase/PostgreSQL authority or RLS/tenant isolation;
- server-authoritative calculations;
- immutable/versioned commercial records;
- published condition/scope template immutability and lineage;
- Accepted Scope Snapshot / frozen commercial baseline rules;
- separation of Production Quantity, Direct Cost, and Sell;
- Budget / Committed / Actual / Forecast separation;
- field truth and Production Evidence distinctions;
- human authority over scope, assemblies/conditions, means and methods, production rates, pricing, margin, budgets, and approvals.

## Migration rule

Migration occurs on canonical `staging`.

1. Bootstrap shadcn/ui and Tailwind v4.
2. Establish the Carez semantic theme.
3. Replace the application shell.
4. Replace shared page patterns and reference surfaces.
5. Migrate module surfaces and Takeoff chrome in bounded slices.
6. Remove old B2/light stylesheet files from the active runtime as dependencies are eliminated.
7. Run typecheck, domain tests, and production build.
8. Browser-verify representative routes on the single stable staging URL before calling the redesign accepted.

Legacy CSS may remain temporarily only as a migration compatibility layer for layout/behavior that has not yet been moved. It is not a visual authority and must not become a permanent second design system.

## Source basis

The component and theming basis is the current shadcn/ui documentation and registry at `ui.shadcn.com`, including installation/manual installation, theming, Sidebar, Data Table/Table, Resizable, Tabs, Dialog/Sheet/Popover/Dropdown Menu, forms, and dashboard/sidebar block patterns.

Issue #44 owns implementation and rendered acceptance.
