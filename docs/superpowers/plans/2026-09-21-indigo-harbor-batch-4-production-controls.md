# Production Workspace Implementation Plan

> **For agentic workers:** REQUIRED EXECUTION METHOD: Native / inline implementation only. Do not use per-task subagents. Obtain Nik acceptance before the single local implementation commit.

**Goal:** Consolidate Production around canonical `/production` with Control, Work Packages, Scope, Pour, and Forecast internal views.

**Architecture:** `/production` is Control; `/production/work-packages`, `/scope-drift`, `/pour-control`, and `/forecast` remain addressable views. `/takeoff/intelligence` is contextual analytical support, not a global workspace. Historical `/production/control` and `/production/intelligence` are not created; existing compatibility behavior is preserved only where already supported.

## Task 1: define Production view composition

**Files:** Modify `app/production/page.tsx`, `app/production/work-packages/page.tsx`, `app/scope-drift/page.tsx`, `app/pour-control/page.tsx`, `app/forecast/page.tsx`, and direct shared headers only after verification. Preserve `app/takeoff/intelligence/page.tsx` as contextual tooling.

**Symbols:** Reuse each page header/actions and `AppShell`; introduce a Production view control only if it composes existing links without duplicating registers.

**Implementation:** Render compact URL-linked Control, Work Packages, Scope, Pour, and Forecast controls. Link Production Intelligence contextually; do not expose it as a peer global destination. Keep Work Package visibility contextual in Projects without duplicating Production workflow.

**Consumes / produces:** Consumes production route authority/actions. Produces one Production navigation model.

**Tests:** Add `tests/ui-production-workspace.test.ts` to verify five view hrefs, active pathname selection, refresh/Back/Forward, and contextual Production Intelligence placement.

**Commands:** `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/ui-production-workspace.test.ts`; `pnpm typecheck`.

**Expected result:** Production is one workspace with direct URLs, not six unrelated pages.

## Task 2: preserve production authority

**Files:** Modify only Task 1 files/direct components/actions when a presentation gap requires it.

**Symbols:** Preserve Work Package quantity contracts, earned-production evidence, CY/SF/LF facts, Production Quantity/Direct Cost/Sell fields, scope-drift classification, pour funding locks, and forecast EAC/FTC fields.

**Implementation:** Use Indigo Harbor shelves, ledgers, status lines, and selectively verified existing interaction primitives. Do not create production, learning, reconciliation, pour, or forecasting calculations/metrics.

**Tests:** Assert existing authoritative labels/actions/server values remain; assert no client formula is introduced.

**Commands:** `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/ui-production-workspace.test.ts`; `pnpm typecheck`; local browser QA for views/direct links.

**Expected result:** Consolidation changes information architecture only.

## Task 3: acceptance

**Files:** No files beyond Tasks 1–2.

**Checks:** Report results to Nik. After acceptance, make one local Production commit; do not push or deploy.
