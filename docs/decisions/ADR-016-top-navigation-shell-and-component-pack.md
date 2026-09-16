# ADR-016 — Top navigation shell and shared Carez component pack

Status: Accepted
Date: 2026-09-04
Owner: 95 — UX & Design System
Supersedes: ADR-006 in full; the shell-specific portions of ADR-012, ADR-015, the Takeoff module spec, and the Concrete Condition workstation target where they require a permanent global left app rail.

Transition under ADR-024: this ADR remains the current implemented shell contract until the dedicated role-adaptive Hybrid command-shell/project-context subproject is implemented and browser-accepted. ADR-024 is already authoritative for visual theme, token, density, and the approved end-state shell architecture. No permanent global desktop left rail returns.

## Context

The permanent desktop app rail protected global navigation during the earlier Carez workstation modernization, but the approved Concrete Condition / Estimating EDGE-inspired workstation needs maximum horizontal room for domain-specific context panes, drawing, Condition Properties, 2D/3D/Split review, and the Quantity/Estimate Worksheet.

The first ADR-016 implementation removed the desktop rail but used a compact application header plus a second global category row and wide multi-column navigation panels. Browser review showed that this still consumed unnecessary vertical space and made global navigation feel more like a web dashboard than a dense professional desktop application.

The accepted refinement is **Option D — compact desktop application menubar**: one global top shell, inline product categories, small anchored animated menus, and module-specific contextual panes inside the workspace.

The same decision also establishes the first shared Carez component pack so module conversions reuse one source-owned shadcn workspace instead of independently inventing grids, number inputs, date controls, trees, toolbars, resizable layouts, uploaders, loading states, or motion behavior.

## Decision

### Desktop shell — Option D

Carez desktop uses two navigation scopes:

1. **One compact global application menubar/header** — authentic company identity, inline global product categories, global command/search, notifications, restrained quick-create where justified, and account controls.
2. **Module-specific contextual panes** — task-specific panes inside the active workspace, such as Plans / Conditions / Zones in Takeoff, project filters/tree in Projects, or folders/filters in Documents.

There is no permanent global desktop left app rail and no permanently stacked second global category-navigation row in the accepted target.

Canonical desktop structure:

```text
[ company logo | Today | Preconstruction | Estimating | Projects | Field | Finance | Documents | search | quick-create | notifications | account ]
[ contextual module pane ][ primary workspace ][ optional governed properties/detail pane ]
                         [ persistent module dock/worksheet where applicable ]
```

The global shell must remain visually quieter and smaller than the work surface.

### Menubar composition

The authenticated desktop menubar should normally remain in approximately the **40–46 px** class unless browser evidence requires adjustment.

Left-to-right responsibilities:

- tenant-configurable company logo / Carez fallback identity;
- inline global categories;
- optional current project/module context only when it materially improves orientation and does not create another permanent global row;
- global command/search;
- restrained quick-create where justified;
- notifications;
- account/profile menu.

Do not use the shell for redundant page narration, duplicate breadcrumbs, giant titles, dashboard summaries, or helper copy.

### Global categories

The accepted desktop category set is currently:

- Today;
- Preconstruction;
- Estimating;
- Projects;
- Field;
- Finance;
- Documents.

Settings belongs under account/system controls unless a later workflow proves a dedicated global entry is necessary.

The active category is indicated with restrained text/surface/underline emphasis. It must not consume a large colored tab or card.

### Anchored application menus

Selecting a category opens a compact anchored menu directly beneath that category, based on source-owned shadcn-compatible Menubar/Dropdown/Menu primitives and Carez-owned composition.

The accepted behavior is intentionally denser than the previous wide mega-panel:

- default to a compact single-column menu;
- use separators, groups, shortcuts, and submenus where they improve scan speed;
- allow a compact two-column treatment only when a category would otherwise become an excessively tall list;
- do not show permanent explanatory sentences beneath every destination;
- use concise destination labels, meaningful icons only where useful, and keyboard shortcuts where legitimate;
- recent/resumed work belongs in global command/search or a purpose-built recent-work surface rather than making every category menu into a dashboard;
- category menus must not become full-width page overlays by default.

### Menu motion and interaction

Motion is functional and subtle:

- menu opacity 0 → 1;
- short vertical translation of roughly 2–4 px → 0;
- optional very slight scale → 1;
- typical transition duration approximately **140–180 ms**, within ADR-015's 120–220 ms envelope;
- active indicator may glide subtly;
- chevrons may rotate where a chevron is actually necessary;
- keyboard navigation, visible focus, escape-to-close/focus-return, outside-click handling, pointer intent, and reduced-motion behavior are mandatory;
- no perpetual decorative animation.

Implementation should start from source-owned shadcn-compatible Menubar/Dropdown/Menu primitives and may selectively adapt vetted COSS UI, beUI, HextaUI, ReUI, or Lucide Animated interaction/source patterns after license and technology review per ADR-015.

### Optional interaction sound

Carez may provide subtle navigation/action audio feedback when explicitly enabled in user/company interface settings.

- no sound on hover, focus movement, ordinary pointer travel, scrolling, typing, or tooltip display;
- committed navigation selection may use one very short, low-volume tactile/digital click;
- success/warning sounds, if added, must remain restrained and semantic;
- audio must be user-controllable, low-volume, accessible, and non-blocking;
- disabling interaction sounds must remove all non-essential UI audio without affecting behavior.

Sound is polish, not navigation authority, and must never be required to understand application state.

### Contextual module panes

Removing the global left rail and second global navigation row does **not** remove module side panes.

Contextual panes belong to the current workflow and may be left, right, docked, collapsible, resizable, or temporarily floating when the module contract requires it.

Examples:

- Takeoff: Plans / Conditions / Zones on the left; Condition Properties on the right or floating/docked; Quantity/Estimate Worksheet below.
- Projects: project/work-package filters or tree beside the project workspace.
- Documents: folders, revisions, filters, or document tree beside the document workspace.

A contextual pane must never become a second global navigation system.

### Mobile

Mobile remains field-first. The already-accepted left-side Sheet/drawer pattern may remain for global navigation on narrow screens. This ADR does not require the desktop menubar to be reproduced literally on mobile.

### Company branding

Authenticated company branding is tenant-configurable rather than permanently hardcoded to the Carez operating-company asset.

- Authorized company users may upload or reset the active company logo in Settings.
- The authenticated application menubar and mobile navigation use the current company logo, with the repository Carez wordmark retained as the safe platform/default fallback.
- Branding metadata is tenant-scoped under RLS and uploaded logo files are stored under a tenant-owned path in the dedicated branding storage bucket.
- New customer-facing commercial documents use the company branding current at creation/issuance and preserve that identity as part of the commercial snapshot. A later Settings change must not silently rewrite an already-issued proposal, invoice, purchase order, or other immutable commercial record.
- Unauthenticated platform-owned surfaces such as Login may continue to use the Carez platform/default identity unless a future product requirement explicitly changes that boundary.
- Company branding changes presentation only; they do not change tenant authority, calculations, commercial values, or document lineage.

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

The global shell additionally standardizes Carez-owned compositions for the compact desktop menubar, anchored category menus, company/project context, global command/search, mobile navigation Sheet, and optional interaction-audio feedback.

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

- the permanent global left app rail absent from authenticated desktop routes;
- the earlier stacked desktop header + second global category row replaced by the single compact Option D menubar;
- anchored category menus implemented from shared source-owned shadcn-compatible components;
- menu keyboard/focus/pointer/reduced-motion behavior browser-verified;
- optional interaction sounds, if enabled, are user-controllable and never fire on hover;
- contextual module panes preserved and correctly separated from global navigation;
- Takeoff gains usable horizontal and vertical workspace without geometry/calculation regressions;
- the first shared component pack exists in source and is consumed by representative module surfaces before local duplicates are added;
- typecheck, domain tests, production build, stable staging deployment, and browser verification pass;
- no claim of shell acceptance is made from source/build evidence alone.
