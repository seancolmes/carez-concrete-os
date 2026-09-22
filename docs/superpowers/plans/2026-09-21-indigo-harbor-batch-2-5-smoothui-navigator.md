# Batch 2.5 — SmoothUI Navigator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the first controlled SmoothUI integration and replace the compressed Workspaces flyout with a wide Carez Command Navigator while retaining AppShell navigation authority and ADR-024 semantic styling.

**Architecture:** `components/AppShell.tsx` is an existing client boundary. `CarezTopShell` owns `directoryOpen`; `AppShell` owns destination navigation and device preference hydration; `lib/ui/navigation.ts` owns `NAVIGATION_DESTINATIONS` and `NAVIGATION_GROUPS`. Retain that ownership. The existing Base UI `Sheet` remains the desktop overlay and compact surface. SmoothUI contributes only editable-source `animated-tabs` for existing client-local navigator filter state.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS, Base UI, cmdk, shadcn registry

**Spec:** `docs/superpowers/specs/2026-09-21-indigo-harbor-product-rollout-design.md`

## Global Constraints

- ADR-024 / Indigo Harbor is the sole visual authority. Retheme imported source with existing `--background`, `--foreground`, `--muted`, `--muted-foreground`, `--border`, `--ring`, and `--primary` tokens in `app/globals.css`; do not import registry theme variables, palette CSS, or playground CSS.
- Preserve `NAVIGATION_DESTINATIONS`, `NAVIGATION_GROUPS`, `resolveActiveDestination`, `navigationPreferenceStorageKey`, `recentDestinationsStorageKey`, and every registered destination. Do not create routes, server search, schema, RPC, auth state, or persistence APIs.
- Use Carez motion grammar: 100–180 ms micro feedback; 180–280 ms structural filter state; attention motion only for authoritative state. Prefer transform/opacity, no continuous decoration, and reduced-motion fallbacks.
- Preserve the AppShell client boundary. One local commit after targeted validation, browser QA, and Nik acceptance: `feat: refine SmoothUI workspace navigator`. Do not push or deploy.

## Verified Dependency and Primitive Audit

`package.json` and `pnpm-lock.yaml` contain no `motion` package. `components.json` exists, declares `rsc: true`, `tsx: true`, `app/globals.css`, CSS variables, and `@/components/ui` aliases. Existing Carez primitives are `Dialog` in `components/ui/dialog.tsx`, `Sheet` in `components/ui/sheet.tsx`, `Tabs` in `components/ui/tabs.tsx`, cmdk `Command` / `CommandInput` / `CommandList` / `CommandItem` in `components/ui/command.tsx`, `Tooltip` in `components/ui/tooltip.tsx`, and `Button` / `buttonVariants` in `components/ui/button.tsx`.

`CarezTopShell` owns `directoryOpen` through `useState`; its `Sheet` calls `setDirectoryOpen` and destination links close before `onNavigate`. `AppShell` owns `pinnedIds`, `recentDestinationIds`, `updatePinnedIds`, `resetPinnedIds`, and `navigate`. Pins use `normalizeNavigationPreference` with `navigationPreferenceStorageKey`; recent destinations use `normalizeRecentDestinationIds` with `recentDestinationsStorageKey`. Both are safe existing device-local preference mechanisms.

## Selected and Excluded SmoothUI Components

Selected initial source: `animated-tabs`. It supplies the structural transition for Pinned, Recent, and All filters without replacing Carez route data, Sheet focus behavior, or cmdk search.

Not selected: `dialog` and `drawer` (existing `Sheet` supplies overlay, compact presentation, Escape, focus containment, and restoration); `combobox` and `searchable-dropdown` (existing Command primitives supply registry-only keyboard search); `morph-icon` (no trigger-feedback gap); `animated-tooltip` (existing Tooltip is sufficient); `smooth-button` (existing Button is authoritative); `pinned-list` (current normalized device preference contract handles pins); `animated-list` (stable technical matrix is clearer without result motion).

## Controlled Dependency Acquisition

During implementation, enable network only for this exact registry acquisition command, then disable it before product implementation continues:

```text
pnpm dlx shadcn@latest add @smoothui/animated-tabs
```

Registry installation may add dependencies. If generated `animated-tabs` imports `motion` and the registry command has not added it, the sole additional approved command is:

```text
pnpm add motion
```

Do not run the SmoothUI CLI, a bulk registry installation, global theme installation, GSAP installation, or any unrelated registry command. This temporary network window does not authorize GitHub, Supabase, or Vercel access.

### Task 1: Reconfirm the dependency, boundary, and navigation audit

**Files:**
- Read: `package.json`, `pnpm-lock.yaml`, `components.json`, `components/AppShell.tsx`, `lib/ui/navigation.ts`
- Read: `components/ui/dialog.tsx`, `components/ui/sheet.tsx`, `components/ui/tabs.tsx`, `components/ui/command.tsx`, `components/ui/tooltip.tsx`, `components/ui/button.tsx`

**Interfaces:**
- Consumes: `CarezTopShell`, `AppShell`, `directoryOpen`, `NAVIGATION_DESTINATIONS`, `NAVIGATION_GROUPS`, `normalizeNavigationPreference`, and `normalizeRecentDestinationIds`.
- Produces: acquisition evidence and an exact package-impact report.

- [ ] Step 1: Confirm these audited package, registry, client-boundary, storage, and primitive facts still match the implementation branch.
- [ ] Step 2: Confirm `animated-tabs` remains the sole selected source; record every registry-added dependency before product edits.
- [ ] Step 3: If this audit no longer supports the selection, STOP and report the exact mismatch to Nik; do not substitute another registry component.

### Task 2: Replace the desktop flyout presentation in `CarezTopShell`

**Files:**
- Modify: `components/AppShell.tsx`, `app/globals.css`
- Add only when generated by the approved registry command: selected `animated-tabs` source under `components/ui`

**Interfaces:**
- Consumes: `CarezTopShell`, `directoryOpen`, `pinnedIds`, `recentDestinationIds`, `onNavigate`, `NAVIGATION_GROUPS`, `destinationsFor`, `resolveActiveDestination`, `Sheet`, `Command`, `CommandInput`, `CommandList`, `CommandItem`, and `animated-tabs`.
- Produces: broad desktop navigator with registry-only filtering and unchanged navigation behavior.

- [ ] Step 1: Preserve `Sheet open={directoryOpen} onOpenChange={setDirectoryOpen}` and retain Sheet on compact layouts; do not introduce a second Dialog or Drawer.
- [ ] Step 2: Restyle `.carez-directory` and `.carez-directory-grid` into a broad centered command navigator with overflow-x-hidden results, a responsive grouped matrix, structural dividers, generous whitespace, no small hint line beneath destinations, and no decorative glow cards.
- [ ] Step 3: Derive groups only from `NAVIGATION_GROUPS`, presenting Preconstruction, Projects / Operations, Field, Production, Finance, and System without removing any `NavigationDestination`; identify `resolveActiveDestination(pathname)` with `aria-current="page"` and a semantic primary trace.
- [ ] Step 4: Add client-local Pinned, Recent, and All filter state in `CarezTopShell`: current `pinnedIds`, current `recentDestinationIds`, and full registry. Render `animated-tabs` only around this filter state.
- [ ] Step 5: Use existing Command primitives for a search input that filters selected registry-derived destinations. Focus it on open; preserve cmdk Arrow navigation, Enter activation, Sheet Escape close, predictable Tab order, and trigger focus restoration.
- [ ] Step 6: Keep compact presentation stacked with no page-level horizontal scrolling. Replace generated hard-coded neutral, candy, or accent classes with the listed Carez tokens and disable nonessential transitions under `prefers-reduced-motion: reduce`.

### Task 3: Targeted verification and acceptance stop

**Files:**
- Modify when an established AppShell/navigation test exists: that exact test file
- Modify: `components/AppShell.tsx`, `app/globals.css`, and selected generated source only

**Interfaces:**
- Consumes: the navigation registry and existing device-local preference functions.
- Produces: navigator validation evidence for Nik review.

- [ ] Step 1: Locate the nearest AppShell/navigation test before adding coverage. If it exists, verify every `NAVIGATION_DESTINATIONS` entry remains represented; open/close behavior; registry-only search filtering; Escape close where the harness supports keyboard events; active-route state; and absence of new persistence. Do not add a test framework.
- [ ] Step 2: Run targeted tests, `pnpm typecheck`, and `git diff --check`.
- [ ] Step 3: Browser-check desktop overlay, narrow viewport, every destination, search, keyboard behavior, focus restoration, reduced motion, light, dark, system, and absence of horizontal scrollbar.
- [ ] Step 4: STOP. Nik reviews the report and browser result first. Only after explicit acceptance create the one local commit named in Global Constraints.
