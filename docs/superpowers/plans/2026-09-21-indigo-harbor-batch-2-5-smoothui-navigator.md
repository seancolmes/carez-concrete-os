# Batch 2.5 — SmoothUI Expandable Navbar Implementation Plan

**Goal:** Establish the first controlled SmoothUI interaction pattern and replace the compressed Workspaces flyout with a Carez in-shell Expandable Navbar while retaining AppShell navigation authority and ADR-024 semantic styling.

**Architecture:** `components/AppShell.tsx` remains an existing client boundary. `CarezTopShell` owns `directoryOpen`; `AppShell` owns destination navigation and device preference hydration; `lib/ui/navigation.ts` owns `NAVIGATION_DESTINATIONS` and `NAVIGATION_GROUPS`. Retain that ownership. The existing Base UI `Sheet` remains the compact/mobile navigator. SmoothUI contributes only editable-source `expandable-navbar` for measured desktop panel expansion and direction-aware domain transitions.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS, Base UI, cmdk, Motion, shadcn registry.

**Spec:** `docs/superpowers/specs/2026-09-21-indigo-harbor-product-rollout-design.md`

## Global Constraints

- ADR-024 / Indigo Harbor is the sole visual authority. Retheme imported source with existing `--background`, `--foreground`, `--muted`, `--muted-foreground`, `--border`, `--ring`, `--primary`, and `--accent` tokens. Do not import registry theme variables, palette CSS, or playground CSS.
- Preserve `NAVIGATION_DESTINATIONS`, `NAVIGATION_GROUPS`, `resolveActiveDestination`, `navigationPreferenceStorageKey`, `recentDestinationsStorageKey`, and every registered destination. Do not create routes, server search, schema, RPC, auth state, or persistence APIs.
- Use Carez motion grammar: 100–140 ms supported hover opening, 180–220 ms supported domain transition, and restrained close behavior. Prefer transform and opacity, no continuous decoration, with reduced-motion fallbacks.
- Preserve the AppShell client boundary. One local commit only after targeted validation, browser QA, and Nik acceptance: `feat: refine SmoothUI workspace navigator`. Do not push or deploy.

## Selected and Excluded SmoothUI Components

Selected source: `expandable-navbar`. It supplies the desktop in-shell measured-height panel and direction-aware domain transition without replacing Carez route data, Sheet compact behavior, or cmdk search.

Not selected: `animated-tabs`, `dialog`, `drawer`, `combobox`, `searchable-dropdown`, `pinned-list`, `animated-list`, `morph-icon`, `smooth-button`, `animated-tooltip`, and `notification-badge`. Existing Carez Sheet, Command, Button, and Tooltip remain authoritative. Remove `animated-tabs` source when no legitimate consumer remains.

## Task 1: Controlled source acquisition and cleanup

**Files:** `package.json`, `pnpm-lock.yaml`, `components.json`, `app/globals.css`, generated `components/smoothui/expandable-navbar/*`.

- [ ] Run exactly `pnpm dlx shadcn@latest add @smoothui/expandable-navbar`, then inspect its diff and generated imports.
- [ ] Remove any known registry-injected SmoothUI global palette/theme additions. `app/globals.css` must have no content diff.
- [ ] Keep `motion` only when the generated source imports it. Restore an acquisition-only `components.json` registry mapping when it is not required at runtime.
- [ ] Stop for any unexpected architecture or configuration mutation beyond the known global theme injection.

## Task 2: Replace the desktop flyout in `CarezTopShell`

**Files:** `components/AppShell.tsx`, generated `components/smoothui/expandable-navbar/*`, and the existing navigation test when applicable.

- [ ] Keep the existing Workspaces trigger as the compact closed state. Its desktop panel expands directly below the top shell; do not use Sheet, Dialog, backdrop, centered modal, or detached directory for desktop.
- [ ] Derive operating-domain triggers and destinations from the registry only. Present Preconstruction, Projects, Field, Production, Finance, and System using actual destination ownership; show one domain at a time and retain all registered destinations.
- [ ] Apply Indigo Harbor semantic background, foreground, muted, border, primary, accent, and ring styling. Use a thin primary bottom trace for active domain; current routes retain the established two-pixel primary left trace and restrained active surface.
- [ ] Use existing Command primitives for client-local, registry-only workspace search in the upper control rail. Enter, Arrow navigation, and Escape remain usable.
- [ ] Render device-local Pinned and Recent entries as supporting rails only when they exist. Do not add persistence or fake entries.
- [ ] On compact widths use the existing Sheet with stacked domains, search, and real destination rows. Do not force the desktop matrix into mobile.
- [ ] Use only actual generated Expandable Navbar API options for hover, click/touch, outside-close, focus-leave, height, direction, and reduced-motion behavior.

## Task 3: Targeted verification and acceptance stop

**Files:** `tests/ui-navigation.test.ts`, `components/AppShell.tsx`, generated expandable-navbar source, acquisition files.

- [ ] Update the existing navigation test to prove all registered destinations remain grouped; active-route, pinned/recent normalization, registry-only search inputs, and no persistence contract remain supported. Do not add a test framework.
- [ ] Run `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/ui-navigation.test.ts`, `pnpm typecheck`, and `git diff --check`. If pnpm attempts a modules-directory reinstall before typechecking, report it and run existing local `tsc --noEmit --pretty false` without reinstalling.
- [ ] Browser-check desktop expansion, domain transition, hover/click/outside/Escape close, search, Pinned/Recent rails, active route, narrow Sheet, light/dark/system, reduced motion, focus behavior, and no horizontal scrolling.
- [ ] Stop. Nik reviews the browser result before the single local commit.
