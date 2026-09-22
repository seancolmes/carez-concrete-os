# Field Workspace Implementation Plan

> **For agentic workers:** REQUIRED EXECUTION METHOD: Native / inline implementation only. Do not use per-task subagents. Obtain Nik acceptance before the single local implementation commit.

**Goal:** Consolidate Field around canonical `/field`, with compact URL-addressable views for Schedule, Readiness, Crew, and Field Control.

**Architecture:** `/schedule` remains accepted 14-day authority; `/look-ahead` remains separate 21-day authority. `/readiness` and `/readiness/resources` retain readiness/resource authority. `/crew` owns Crew; `/crew/access` is contextual administration. `/equipment` is contextual Field tooling. `/inventory` remains unsupported because no authoritative route exists.

## Task 1: define Field navigation and shared composition

**Files:** Modify `app/field/page.tsx`, `app/schedule/page.tsx`, `app/look-ahead/page.tsx`, `app/readiness/page.tsx`, `app/readiness/resources/page.tsx`, `app/crew/page.tsx`, `app/crew/access/page.tsx`, `app/equipment/page.tsx`, and the direct shared Field header owner only after verification.

**Symbols:** Reuse page headers/actions, `AppShell`, and Field presentation data. Introduce one shared Field view control only where it links existing routes rather than duplicating content.

**Implementation:** Render compact group controls for Schedule (Schedule, 21-day Look Ahead), Readiness (Work Readiness, Materials / Resources), Crew (Crew, Employee Access), and Field Control (`/field`, Equipment). Each control preserves URL navigation; no opaque client-only active state. Use an existing Carez component before any bounded SmoothUI/ReUI primitive.

**Consumes / produces:** Consumes authoritative route data/actions. Produces one Field navigation model.

**Tests:** Add `tests/ui-field-workspace.test.ts` to verify registered hrefs, pathname-derived active view, compact widths, and `/inventory` is neither created nor linked.

**Commands:** `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/ui-field-workspace.test.ts`; `pnpm typecheck`.

**Expected result:** Field is one operating workspace rather than independent route polish.

## Task 2: preserve Field authority while refining presentation

**Files:** Modify only Task 1 files/direct components, including `components/schedule/ScheduleGrid.tsx` and `components/schedule/ScheduleHeaderActions.tsx` only if required for the accepted Schedule gap audit.

**Symbols:** Preserve ScheduleGrid assignments/days, readiness action contracts, Crew/access actions, and Field daily-log/timecard controls.

**Implementation:** Apply Indigo Harbor shelves, rails, and compact controls only where the surface lacks shared workspace language. Preserve 14-day Schedule; do not turn it into 21 days. Do not add labor, readiness, weather, material, equipment, inventory, or timecard calculations.

**Tests:** Assert Schedule remains 14-day; Look Ahead remains 21-day; readiness holds and Crew/access actions render; existing action signatures remain.

**Commands:** `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/ui-field-workspace.test.ts`; `pnpm typecheck`; local browser QA for desktop/compact, direct links, refresh, and Back/Forward.

**Expected result:** Presentation clarifies existing field authority without changing it.

## Task 3: acceptance

**Files:** No files beyond Tasks 1–2.

**Checks:** Report implementation and validation to Nik. After acceptance, make one local Field commit; do not push, deploy, or run `sync.ps1`.
