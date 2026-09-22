# Finance and System Workspace Implementation Plan

> **For agentic workers:** REQUIRED EXECUTION METHOD: Native / inline implementation only. Do not use per-task subagents. Obtain Nik acceptance before the single local implementation commit.

**Goal:** Consolidate Finance around canonical `/cashflow` and keep System bounded to genuine administration at `/settings`.

**Architecture:** Finance views remain `/cashflow`, `/billing`, `/payables`, `/procurement`, `/banking`, `/banking/reconcile`, `/banking/rules`, `/payroll`, `/costs`, and `/overhead`. System is `/settings`; access administration belongs there only after exact system-level ownership verification. No finance route becomes a calculation engine.

## Task 1: Finance and System view composition

**Files:** Modify `app/cashflow/page.tsx`, `app/billing/page.tsx`, `app/payables/page.tsx`, `app/procurement/page.tsx`, `app/banking/page.tsx`, `app/banking/reconcile/page.tsx`, `app/banking/rules/page.tsx`, `app/payroll/page.tsx`, `app/costs/page.tsx`, `app/overhead/page.tsx`, `app/settings/page.tsx`, and direct shared headers only after verification.

**Symbols:** Reuse page headers/actions and `AppShell`; add a Finance/System view control only to link existing routes without duplicate pages.

**Implementation:** Finance groups Cash, Billing & Payables, Procurement, Banking, and Payroll & Cost. System exposes Settings and only verified system-level administration. Preserve accepted Cashflow first. Do not use System for finance leftovers or unrelated tools.

**Consumes / produces:** Consumes existing financial routes/actions/settings ownership. Produces compact URL-linked Finance/System controls.

**Tests:** Add `tests/ui-finance-system-workspace.test.ts` to verify every Finance href, Settings route, active pathname, direct links, and no unsupported access-administration link.

**Commands:** `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/ui-finance-system-workspace.test.ts`; `pnpm typecheck`.

**Expected result:** Finance is coherent and System is intentionally narrow.

## Task 2: preserve financial authority

**Files:** Modify only Task 1 files/direct components/actions where a presentation gap is proven.

**Symbols:** Preserve Cashflow queries; AP liability/payment; AR/progress billing/retainage; banking/reconcile/rule state; payroll burden; job-cost posting; procurement commitments; overhead allocation.

**Implementation:** Apply shared workspace shelves, rails, and tabular finance presentation using Carez components before any bounded motion primitive. Do not add unsupported accounting copy, banking behavior, posting, matching, liability, retainage, burden, commitment, formulas, schema, or RLS work.

**Tests:** Assert current actions/authoritative values remain; assert no client financial calculation or API is added.

**Commands:** `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/ui-finance-system-workspace.test.ts`; `pnpm typecheck`; browser QA at Finance/System roots, subviews, refresh, and Back/Forward.

**Expected result:** Consolidation preserves financial and administration authority.

## Task 3: acceptance and delivery sequence

**Files:** No files beyond Tasks 1–2.

**Checks:** Report results to Nik. After acceptance, make one local Finance/System commit. After all five plans: bounded final retrofit/review, full local regression, one staging integration, one GitHub Actions cycle, one Vercel staging deployment, and deployed browser QA. No intermediate push/deploy or `sync.ps1`.
