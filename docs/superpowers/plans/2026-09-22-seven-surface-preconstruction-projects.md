# Seven-Surface Preconstruction and Projects Implementation Plan

> **For agentic workers:** REQUIRED EXECUTION METHOD: Native / inline implementation only. Do not use per-task subagents. Obtain Nik acceptance before the single local implementation commit.

**Goal:** Consolidate accepted Batch 1/2 routes into Preconstruction and Projects internal views without rebuilding business logic.

**Architecture:** Canonical roots remain `/leads` and `/projects`. Internal view state is existing direct routes or explicit URL search state only when a current page can share one shell safely. Dynamic Takeoff, Estimate, Proposal, Project, and Job Setup URLs remain direct record-detail workspaces.

## Task 1: Preconstruction composition contract

**Files:** Modify `app/leads/page.tsx`, `app/leads/inbox/page.tsx`, `app/bid-intelligence/page.tsx`, `app/takeoff/page.tsx`, `app/estimates/page.tsx`, `app/estimates/audit/page.tsx`, `app/proposals/page.tsx`, and direct shared headers only after ownership verification. Do not modify `app/takeoff/[setId]/page.tsx`, `app/estimates/[estimateId]/page.tsx`, or `app/proposals/[estimateId]/page.tsx` except for a necessary contextual entry link.

**Symbols:** Reuse page header/actions and `AppShell`; introduce one shared Preconstruction view control only if it links existing routes without duplicate page content.

**Implementation:** Group Opportunities (Leads, Inbox, Bid Intelligence), Takeoff (list/plan sets, direct workstation, Assemblies compatibility), Estimate (list, direct detail, current pricing/labor review, Audit), and Proposal. `/job-setup` remains the Projects handoff. Preserve Takeoff geometry/Conditions authority, estimate calculations, proposal lineage, and accepted UI.

**Consumes / produces:** Consumes existing routes and presentation IDs. Produces route-linked internal controls with no duplicate data surface.

**Tests:** Add `tests/ui-preconstruction-workspace.test.ts` to verify all listed route links/direct detail hrefs, no Takeoff/Estimate calculation/action contract change, and Assemblies compatibility label.

**Commands:** `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/ui-preconstruction-workspace.test.ts tests/ui-takeoff-specialist-reference.test.ts tests/estimate-worksheet.test.ts`; `pnpm typecheck`.

**Expected result:** Preconstruction reads as one workflow while each authoritative route remains usable.

## Task 2: Projects composition contract

**Files:** Modify `app/projects/page.tsx`, `app/job-setup/page.tsx`, `app/documents/page.tsx`, `app/change-orders/page.tsx`, `app/reports/page.tsx`, and direct shared headers only after ownership verification. Preserve `app/projects/[id]/page.tsx` and `app/job-setup/[projectId]/page.tsx` record contracts.

**Symbols:** Reuse `resolveProjectRoute`, `CarezProjectContextBar`, and existing page actions. Add Projects internal control only in the common layout owner.

**Implementation:** Present Portfolio, Setup, Documents, Changes, and contextual Owner/Reporting. Link Production work packages contextually; do not duplicate Production registers. Keep project lifecycle, document persistence, change-order lineage, and deep links. Specialized index routes remain compatibility entries until a safe shared shell is proven.

**Consumes / produces:** Consumes project route context/actions. Produces coherent Projects entry controls without redirects or duplicated implementation.

**Tests:** Add `tests/ui-projects-workspace.test.ts` to verify project/job-setup dynamic links, document/change actions, reporting link, and no duplicate Work Package implementation.

**Commands:** `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/ui-projects-workspace.test.ts`; `pnpm typecheck`.

**Expected result:** Projects owns portfolio-to-handoff without absorbing Production authority.

## Task 3: acceptance

**Files:** No files beyond Tasks 1–2.

**Checks:** Run targeted tests, `pnpm typecheck`, browser QA for root/list/detail URLs and Back/Forward, report to Nik, then make one local commit only after acceptance. No push/deployment.
