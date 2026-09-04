# ADR-015 — Dark minimal shadcn application system

Status: Accepted
Date: 2026-09-03
Owner: 95 — UX & Design System
Supersedes: the presentation/theme contract in ADR-014; ADR-014 remains authoritative for source-owned shadcn primitives and composition architecture unless this ADR says otherwise.

## Context

The first Carez shadcn migration preserved too much of the prior presentation structure. The active application still contains a light-first token set, a large compatibility stylesheet, legacy global presentation imports, legacy route markup, and route-specific CSS modules. The rendered result is a light generic SaaS/dashboard composition with repeated cards, explanatory helper copy, low-value status text, and insufficient workstation density.

The accepted product direction is now a complete Carez-wide visual replacement: dark-first, black/graphite, minimal, dense, modern, restrained, and source-owned through shadcn-compatible React primitives. This is a presentation and interaction refactor, not a domain rewrite.

## Decision

Carez will use a dark-first application system built from source-owned shadcn/ui React components and tightly scoped Carez compositions made from those primitives.

The final accepted runtime must not rely on a compatibility layer that restyles legacy structural class names. Existing route structures such as `contractor-page`, `command-card`, `project-card`, `surface`, legacy button/form abstractions, and the old page-level visual systems must be removed as each route is migrated. `app/carez-shadcn-compat.css` is transitional only and must be deleted before Issue #44 can close.

Legacy global presentation files must be removed from `app/layout.tsx` and deleted when no remaining runtime consumer requires them. Route/module CSS that merely reproduces the prior design system must also be replaced with shadcn/Tailwind composition. Highly specialized geometry/rendering CSS may remain only when it is required for an actual drawing/rendering primitive and is not acting as a second design system.

## Visual contract

### Color

- Default authenticated Carez UI is dark.
- Foundation is neutral black/graphite rather than blue-tinted or colored application chrome.
- Background, sidebar, cards, popovers, sheets, menus, tables, toolbars, and inspectors use subtle luminance separation rather than decorative color fields.
- Primary actions use neutral high-contrast treatment by default. Bright blue is not the persistent primary-button identity.
- Color is semantic and scarce: success, warning, destructive, selected measurement/geometry, and other states where color communicates actual meaning.
- Remove previous Carez UI palette assumptions from the active application token set. Historical brand colors do not dictate application chrome.

### Surface hierarchy

- Prefer one continuous workstation canvas with separators, rows, grouped toolbars, split panes, tables, drawers, command menus, and sheets.
- Do not turn every section or number into a rounded card.
- Cards are reserved for genuinely bounded objects or compact summaries.
- Avoid glassmorphism, broad gradients, neon decoration, giant rounded containers, excessive shadows, and decorative background effects.
- Border radii are restrained and consistent.

### Typography and density

- Compact professional desktop density is the default.
- Typography establishes hierarchy before boxes do.
- Numerical/commercial values use tabular figures where appropriate.
- Ordinary titles remain sentence/title case.
- Persistent text must identify an object, communicate actionable/current state or a problem, or enable a decision. Otherwise remove it or move it behind progressive disclosure.
- Remove redundant helper paragraphs that restate headings, narrate obvious workflows, or read like generated product copy.

### Icons and motion

- Use source-owned Lucide icons or license-vetted compatible animated Lucide variants.
- Icons must communicate a real action, object, or state; do not add decorative iconography to every card/row.
- Motion is functional: hover/press feedback, state transition, menu/sheet/dialog transition, direct manipulation, import/progress state, or selected-state confirmation.
- No perpetual decorative animation.
- Motion should generally resolve in approximately 120–220 ms; spring behavior is reserved for direct-manipulation or overlay interactions where it improves comprehension.
- Respect `prefers-reduced-motion`.

## External component-source policy

The following sources may be used as implementation references when an individual component materially improves the Carez workflow and its license/technology fit is verified before copying code:

- shadcn/ui — canonical base and registry model;
- HextaUI — React/shadcn-oriented animated components;
- UI-X — React/Base UI/shadcn-oriented advanced input primitives, including date/time patterns;
- Loading UI — loading/progress microstates;
- LocalMode vector import/export flow — interaction reference for compact import/export state presentation, not an AI/runtime dependency;
- COSS UI — interaction/reference source; copy code only from explicitly compatible/licensed portions after verification;
- Lucide Animated — controlled animated action-icon reference;
- ReUI — React/Tailwind/shadcn registry source for advanced controls where justified;
- More Shadcn — design/interaction reference only when the source implementation is Svelte; Carez must implement equivalent React/shadcn behavior rather than copying incompatible Svelte code;
- beUI — component and interaction reference for compact controls, overlays, drag/drop, dock/tool patterns, and focus behavior; individual source must be reviewed before adoption.

Third-party registries do not become a second Carez design system. Copied source becomes Carez-owned application source, follows Carez semantic tokens, and must be reviewed for accessibility, licensing, bundle cost, maintenance, and architecture fit.

## Content and asset policy

- Remove generated decorative images, generated placeholder art, decorative stock imagery, and generic AI-style illustration from the Carez application UI.
- Remove filler/demo copy and generated-sounding helper text that does not satisfy the persistent-text rule.
- Retain authentic Carez brand assets, user/customer/project documents, plan sheets, field photos, receipts, tickets, signatures, and other real business records.
- Do not replace authentic Carez branding with generic generated marks.

## Application-shell contract

ADR-006 remains authoritative:

OPEN: `[ permanent app rail ][ context drawer ][ workspace ]`

CLOSED: `[ permanent app rail ][ workspace ]`

The dark shadcn Sidebar remains permanent on desktop and collapses to its icon rail. Mobile remains field-first and may use Sheet/drawer navigation. The app rail must never disappear because a context drawer closes.

The shell should be visually quieter than the work. Search, notifications, account, and navigation controls use progressive disclosure and compact icon/text treatment. Tooltips carry optional explanation instead of persistent helper narration.

## Takeoff contract

The Takeoff visual replacement must not change measurement authority.

Preserve exactly:

- PDF as visual reference;
- stable page-coordinate vector geometry as measurement authority;
- calibration and scale regions;
- LF/SF/EA geometry and polygon cutouts;
- geometry editing and committed undo/redo;
- measurement/assembly/estimate lineage;
- server-authoritative quantity and pricing recalculation;
- permanent resizable Quantity Worksheet;
- authoritative 2D geometry and derived 3D verification target.

The Takeoff drawing workstation must nevertheless be fully migrated at the presentation layer. Sheets, Properties/Inspector, measurement toolbar, scale controls, worksheet chrome, dialogs, forms, menus, split panes, tabs, lists, and status presentation must use literal shadcn-compatible React primitives or tightly scoped Carez compositions. Legacy design-system CSS is not accepted as the final solution.

## Page-completeness requirement

Issue #44 is not satisfied by representative pages. Every routable Carez page and every reusable application component rendered by those pages is in scope.

A route is complete only when:

1. its visible structure is no longer dependent on the prior page/class design system;
2. controls use shadcn-compatible source-owned primitives/compositions;
3. redundant generated-style copy and decorative/generated assets are removed;
4. dark semantic tokens are used consistently;
5. keyboard/focus/hover/disabled/loading/error states are coherent;
6. desktop and relevant mobile layouts are usable;
7. business/domain behavior is preserved;
8. it has been browser-smoke-tested on the single stable staging line.

## Verification

Before acceptance:

- `pnpm typecheck` passes;
- domain tests pass;
- `pnpm build` passes;
- Vercel serves the matching `staging` SHA on the stable staging alias;
- every route family receives browser smoke coverage;
- Takeoff receives focused interaction verification for previously accepted measurement behavior;
- no rendered defect is marked fixed from source/build evidence alone;
- `app/carez-shadcn-compat.css` is deleted;
- superseded legacy global presentation imports are absent from `app/layout.tsx`;
- remaining specialized CSS is explicitly justified and is not a hidden second design system.

## Consequences

This is a large, cross-application presentation refactor. It must be implemented without rewriting Carez domain logic, Supabase authority, RLS, tenant isolation, commercial history, Takeoff geometry, or calculation semantics. UI cleanup is allowed to remove redundant presentation and text; it is not permission to remove business functionality or authoritative data.