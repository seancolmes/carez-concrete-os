# Pourtrace Product-Wide UI Implementation Plan

> **For agentic workers:** Execute sequentially in the intentional local `staging` tree. The current request authorizes one reviewed commit and push after the whole program is complete; do not publish a partial group.

**Goal:** Apply Nik's approved Pourtrace Signal Works and Condition editor design throughout every user-facing route without changing operational or financial authority.

**Architecture:** Shared semantic tokens, the two-row shell, and reusable section/form/table/overlay treatments carry the common language. Route groups adapt their existing workflows to these primitives. Takeoff geometry, company data, costs, pricing, and billing remain governed by their current server and persistence contracts.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind 4, existing shadcn/Radix primitives, Ant Design 6 for complex workflow controls.

**Spec:** `docs/design-system/POURTRACE_SIGNAL_WORKS_TARGET.md`, `docs/design-system/POURTRACE_CONDITION_REDESIGN.md`, and the approved visual previews in `public/design-reviews/`.

## Global constraints

- Product label: Pourtrace; company/customer records retain their real names.
- Signature green: `#22D36F`, concentrated on primary action, selection, active geometry, and attention.
- Dark neutral canvas and differentiated surfaces; no old Steam blue or page gradient.
- Fira Sans for everyday UI, Roboto Slab for major headings, Source Code Pro for quantities and references.
- Seven primary surfaces per ADR-026. Preserve all existing deep links.
- Dense workspaces, 36–40px desktop table rows, readable 12–14px data, 16–18px section titles, touch-friendly mobile controls.
- Drawers for record details; centered dialogs for major actions. The Condition editor opens with Structural build motion and all sections closed.
- Respect reduced motion, keyboard focus, mobile safe areas, and existing role/permission gates.
- Do not change Takeoff 2D measurement authority, rates, quantities, pricing, tenant isolation, or financial calculations for presentation work.

## Review focus

- Existing data-heavy routes must remain scannable after the global theme changes.
- Dialogs, popovers, selects, and Ant portals must inherit the same dark tokens and usable contrast.
- Long labels and dense tables must remain usable at 390px and 768px without blocking primary actions.
- Draft and unsaved Condition values must survive section collapse and reopen; role links remain authoritative.
- Login, invitation, and public proposal routes must remain legible and functional outside the signed-in shell.

## Tasks

### 1. Shared identity and visual primitives

**Files:** `app/globals.css`, `app/layout.tsx`, `components/AppShell.tsx`, `components/PourtraceAntProvider.tsx`, shared components in `components/ui/` and `components/carez/` only as required.

- [ ] Replace Steam/blue visual tokens and rules with the approved Pourtrace semantic palette.
- [ ] Apply the logo, typography, navigation, compact controls, section headers, data rows, dialog and drawer depth, and reduced-motion behavior.
- [ ] Verify shell and representative shared controls at desktop and mobile widths; run navigation tests, `pnpm typecheck`, and `git diff --check`.

### 2. Preconstruction

**Routes:** leads, bid intelligence, Takeoff index/plans/assemblies/intelligence/detail, estimates/detail/audit, proposals/detail, and scope drift.

- [ ] Carry PDF-first Takeoff and approved Condition editor interaction into the live component while preserving measurement and calculation contracts.
- [ ] Give estimating and proposal workspaces compact registers, clear hierarchy, and appropriate detail overlays.
- [ ] Verify representative populated/empty and desktop/mobile states; run targeted Takeoff and estimate tests, typecheck, and diff check.

### 3. Projects, Field, and Production

**Routes:** projects/detail, job setup, readiness, schedule/look-ahead, field/review, crew, equipment, pour control, production/work packages, closeout, documents, and change orders.

- [ ] Apply the approved Projects/Field composition and reuse section, row, badge, and overlay patterns.
- [ ] Keep field actions visible and touch-friendly; preserve all job, time, production, and document behavior.
- [ ] Verify representative desktop/mobile tasks and run targeted tests, typecheck, and diff check.

### 4. Finance

**Routes:** Billing and its child routes, costs, forecast, procurement and child routes, payables, payroll, banking, cashflow, overhead, and reports.

- [ ] Carry the approved dense Billing model into related registers; keep data source and commercial states unchanged.
- [ ] Use right detail drawers and focused dialogs where existing interactions warrant them.
- [ ] Verify populated/empty and desktop/mobile states; run financial UI tests, typecheck, and diff check.

### 5. System, access, and public pages

**Routes:** Today, settings, employee/access/invitations, login, public proposal, startup, and any remaining route in `REDESIGN_ROUTE_LEDGER.md`.

- [ ] Apply Pourtrace branding, form language, responsive behavior, and accessibility without changing auth or invitation flow.
- [ ] Check every route against the ledger, including error/empty/loading states.
- [ ] Run targeted tests, typecheck, diff check, and broader check where risk warrants.

### 6. Final acceptance and publication

- [ ] Capture actual representative desktop/mobile rendered results and record each route's status in `REDESIGN_ROUTE_LEDGER.md`.
- [ ] Inspect staged diff for unrelated files, secrets, migrations, and accidental scope; keep unrelated local material uncommitted.
- [ ] Run final targeted/broad validation as warranted, including build.
- [ ] Create the authorized local commit on `staging`, then push it to `origin/staging` only after all groups and validation are complete.
- [ ] Return a CAREZ REVIEW PACKET with captures, route coverage, files changed, validation, diff, remaining issues, exact QA, and pushed commit ID.
