# Carez related tools pattern

Status: Accepted design-system contract
Owner: 95 — UX & Design System
Related decisions: ADR-015, ADR-016, ADR-018
Implementation owner: Issue #44 while the Carez-wide shadcn conversion remains open

## Purpose

Carez pages should not present every neighboring module or secondary destination as an equal primary button. When a page has several contextually related destinations that are useful but not the page's main action, group them under one compact `Related tools` menu.

This pattern is global and applies across Carez modules when the page has two or more secondary cross-route tools or adjacent operational destinations.

## Required behavior

- Keep the page's true primary action visible, normally as the final/highest-emphasis action in the page header or local toolbar.
- Move neighboring destinations such as look-ahead, readiness, procurement, work packages, reports, audits, documents, or other contextual tools into `Related tools` when they are secondary to the current page task.
- Use the Carez-owned shadcn/Base UI dropdown-menu composition already proven on Schedule as the default desktop implementation.
- Each menu item uses a concise label and a restrained Lucide icon when the icon improves scan speed.
- Do not add explanatory sentence text inside ordinary menu rows.
- Do not use the menu to narrate roadmap, implementation, migration, or future-feature intent; ADR-018 applies to the menu and the surrounding page.
- Order items by workflow relevance, not alphabetically.
- Separate destructive or materially different actions from navigation; `Related tools` is primarily navigation/context switching, not a dumping ground for every action.
- Keep one-off page actions outside the menu when they are part of the user's immediate task.
- Keyboard navigation, visible focus, Escape, outside-click dismissal, and reduced-motion behavior are required through the shared shadcn/Base UI primitives.
- On narrow/mobile layouts, the same tool set may use a responsive menu/drawer treatment when that is more usable, but the information architecture stays the same.

## When not to use it

Do not create a `Related tools` menu when:

- there is only one meaningful secondary destination;
- the destinations are core mode switches inside the current workspace;
- hiding a high-frequency action would slow the primary workflow;
- the page is itself a navigation/index surface where the destinations are the main content.

## Shared composition target

The Schedule implementation is the first accepted reference. During Issue #44 conversion, extract/reuse the shared Carez `CarezRelatedToolsMenu` composition rather than duplicating page-local dropdown code when multiple routes adopt the pattern.

The shared composition accepts route items containing at least `href`, `label`, and optional icon metadata while preserving route/domain ownership outside the generic component.

## Examples

- Schedule: 21-Day Look-Ahead, Work Readiness, Resources, Work Packages.
- Resource Readiness: Inspections, Look-Ahead, Procurement.
- Estimate detail: Takeoff, Estimate audit, Proposal history where secondary to the current estimate task.
- Project execution surfaces: Schedule, Readiness, Work Packages, Documents when those destinations are contextual rather than the primary page action.

Use judgment. The goal is reduced header clutter and clearer action hierarchy, not mechanically hiding navigation on every page.
