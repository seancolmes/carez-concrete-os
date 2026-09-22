# Seven-Surface Foundation Implementation Plan

> **For agentic workers:** REQUIRED EXECUTION METHOD: Native / inline implementation only. Do not use per-task subagents. Complete tasks in order and obtain Nik acceptance before the single local implementation commit.

**Goal:** Establish the seven-surface navigation presentation model, simplify the desktop Workspaces navbar, and replace Today’s oversized greeting hero with a compact operational header.

**Architecture:** `NAVIGATION_DESTINATIONS` remains the route registry. A typed presentation model groups each destination once beneath Today, Preconstruction, Projects, Field, Production, Finance, or System. Canonical surface routes are Today `/`; Preconstruction `/leads`; Projects `/projects`; Field `/field`; Production `/production`; Finance `/cashflow`; System `/settings`. Existing record-detail URLs remain direct URLs.

**Tech Stack:** Next.js 15 App Router, React, TypeScript, Tailwind CSS, Motion, existing Carez shell/components.

## Route classification audit

| Classification | Count | Destination IDs and exact routes |
| --- | ---: | --- |
| Primary surface | 7 | `today` `/`; `leads` `/leads`; `projects` `/projects`; `field` `/field`; `production` `/production`; `cashflow` `/cashflow`; `settings` `/settings` |
| Internal view | 28 | `lead-inbox` `/leads/inbox`; `bid-intelligence` `/bid-intelligence`; `takeoff` `/takeoff`; `estimates` `/estimates`; `proposals` `/proposals`; `estimate-audit` `/estimates/audit`; `reports` `/reports`; `job-setup` `/job-setup`; `documents` `/documents`; `change-orders` `/change-orders`; `schedule` `/schedule`; `look-ahead` `/look-ahead`; `readiness` `/readiness`; `resources` `/readiness/resources`; `crew` `/crew`; `work-packages` `/production/work-packages`; `scope-drift` `/scope-drift`; `pour-control` `/pour-control`; `forecast` `/forecast`; `billing` `/billing`; `payables` `/payables`; `banking` `/banking`; `reconcile` `/banking/reconcile`; `bank-rules` `/banking/rules`; `payroll` `/payroll`; `costs` `/costs`; `overhead` `/overhead`; `procurement` `/procurement` |
| Contextual tool | 3 | `production-intelligence` `/takeoff/intelligence`; `employee-access` `/crew/access`; `equipment` `/equipment` |
| Record detail | 0 | Registry has none; direct details remain `/takeoff/[setId]`, `/estimates/[estimateId]`, `/projects/[id]`, `/job-setup/[projectId]`, `/proposals/[estimateId]`. |
| Compatibility entry | 1 | `assemblies` `/takeoff/assemblies` |
| Hidden / unsupported | 0 | None in the current registry. |

## Task 1: type the presentation model

**Files:** Modify `lib/ui/navigation.ts` and `tests/ui-navigation.test.ts`.

**Symbols:** Retain `NavigationDestination`, `NAVIGATION_DESTINATIONS`, `getDestinationById`, `resolveActiveDestination`, `matchesDestinationPath`, and device-local pinned/recent helpers. Replace the eight-domain presentation use of `NavigationDomainId`, `NavigationGroup`, `NAVIGATION_GROUPS`, and `NAVIGATION_WORKSPACE_DOMAINS` with `WorkspaceSurfaceId`, `WorkspaceDestinationClassification`, `WorkspacePresentationDestination`, `WORKSPACE_PRESENTATION_SURFACES`, and `getWorkspacePresentationForDestination`.

**Implementation:** Keep all 39 route records untouched. Define seven canonical surface routes, one classification and owner per destination, curated subsection IDs/labels, and no duplicate ownership. Retain a route-only grouping for Command/search only when required; it cannot drive Workspaces. Preserve storage version/keys, role defaults, and `resolveProjectRoute`.

**Consumes / produces:** Consumes registered IDs and route matching. Produces presentation data for `CarezTopShell`, command search, mobile navigation, and tests.

**Tests:** Assert seven surfaces, six non-Today triggers, every registry destination assigned once, canonical routes match registry routes, and all hrefs remain resolvable.

**Commands:** `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/ui-navigation.test.ts`; `pnpm typecheck`.

**Expected result:** Route and seven-surface presentation authority are separate and fully typed.

## Task 2: simplify the Workspaces presentation

**Files:** Modify `components/AppShell.tsx`; modify `components/smoothui/expandable-navbar/index.tsx` only if a bounded class/ARIA hook is required; update `tests/ui-navigation.test.ts`; add `tests/ui-workspaces-navbar.test.ts` for rendered shell behavior.

**Symbols:** Change `CarezTopShell`, `workspaceDomainFor`, `navbarItems`, `searchResults`, `renderDestination`, `CarezCommandMenu`, `CarezMobileMoreSheet`, and `CarezMobileBottomNav`. Preserve `ExpandableNavbar`, `CarezNavigationManager`, command search, and Quick Access management.

**Implementation:** Desktop Workspaces renders only Preconstruction, Projects, Field, Production, Finance, and System. `navbarItems` renders selected-surface 2–3 curated subsection columns with links only: no embedded `Command`, Pinned, Recent, All hierarchy, pin controls, hints, or descriptions. Preserve measured-height/reduced-motion behavior; use semantic indigo for active-domain bottom trace and active-route left trace. Keep top-shell command/search and device-local pin/recent infrastructure. Compact widths retain the responsive `Sheet`, grouped by the same six surfaces; Today remains direct.

**Consumes / produces:** Consumes `WORKSPACE_PRESENTATION_SURFACES` and active-route resolution. Produces shallow selected-surface desktop and compact-sheet navigation.

**Tests:** Assert no Workspace-panel search, Pinned/Recent label, pin action, hint, or All tab; assert Quick Access manager survives; assert active traces; assert Sheet lists six surfaces and registry hrefs; retain ExpandableNavbar Escape/focus coverage.

**Commands:** `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/ui-navigation.test.ts tests/ui-workspaces-navbar.test.ts`; `pnpm typecheck`.

**Expected result:** Global navigation exposes domains rather than a sitemap without removing valid routes or preferences.

## Task 3: compact the Today operational header

**Files:** Modify `app/page.tsx`; modify the directly owning Today CSS/module only if `carez-command-hero` cannot meet compact layout with existing semantic utilities; add `tests/ui-today-workspace.test.ts`.

**Symbols:** Replace `greeting`, `firstName`, and `carez-command-hero` presentation block. Preserve data queries, `attention`, `todayFieldWork`, `jobsReady`, `crewWorking`, `CarezSectionHeading`, `CarezOperationalPulse`, and Projects/Schedule links.

**Implementation:** Render date/Today context, restrained identity, and existing useful actions in a minimal header. Remove greeting, “Everything clear today,” and “ready to move / active field shifts” hero telemetry. Keep existing authoritative counts only where already used below; do not add or recompute metrics. Put Management Attention and Scheduled Production immediately after the header.

**Consumes / produces:** Consumes existing Today server data. Produces a smaller header with unchanged sections/links.

**Tests:** Assert removed hero strings/greeting-time branch; assert Today/date, Projects/Schedule, Management Attention, Scheduled Production, and hrefs; assert no query/calculation change.

**Commands:** `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/ui-today-workspace.test.ts`; `pnpm typecheck`.

**Expected result:** Management Attention and Scheduled Production rise above the fold without authority changes.

## Task 4: foundation acceptance

**Files:** No production files beyond Tasks 1–3.

**Checks:** Run all targeted tests, `pnpm typecheck`, local browser QA at desktop/compact widths, report to Nik, then create one local commit only after acceptance. Do not push, deploy, or run `sync.ps1`.
