# ADR-025 — Carez Operations Workspace / Experience System

Status: **Accepted design authority; reference implementation accepted; application-wide rollout incomplete**  
Date: 2026-09-21  
Authority: Issue #76 and Nik's explicit complete UI/UX rewrite authorization  
Accepted reference merge: `457be2068a2b42f7883286a4f467f819e7fc049a`

## Context

Nik rejected incremental Precision Slate restyling as the end state and authorized a complete custom Carez UI/UX rewrite.

The target is a distinctive concrete-contractor operating system rather than a generic SaaS/shadcn application.

The approved experience direction is:

- approximately **80% Command Deck**;
- approximately **20% Spatial Blueprint**;
- kinetic behavior only where it materially communicates state or workflow.

Operational pages should feel energized. Technical workspaces should feel focused. Customer-facing surfaces should feel premium.

## Decision

ADR-025 is the active staging presentation authority.

It supersedes ADR-024 presentation and ADR-016 shell arrangement where ADR-025 speaks while preserving compatible accessibility/theme/component foundations. ADR-020 and current Takeoff module contracts continue to govern Takeoff quantity/domain invariants.

### Visual / interaction language — CAREZ STEAM SLEEK V28

The explicit FINAL-2026-09-26 correction rejects the prior light interpretation. Steam-Sleek-V28.css itself is the primary presentation specification. Translate its component rules into Carez selectors; do not import ChatGPT-specific selectors.

- Foundation: #0d1116, #11161c, #171d24; elevated steel: #1d242c, #252d36, #303a45.
- Blue steel: #102838, #18384c, #21465d, #2a5670. Interaction: #66c0f4; hover/focus: #8ed8ff.
- Text: #d8dee4, #c4d0d9, #a4b3bf, #8a9baa. Borders: #27313a, #303a44, #414d59.
- Preserve the reference sidebar, panel, header, control, table, and viewport-stable page gradients through shared steam tokens in app/globals.css.
- Dense 28–34px desktop rows, icon-plus-label primary navigation, blue selected rows with cyan edges, low-radius technical chrome, compact data tables.
- Inter / Segoe UI-compatible interface typography; existing IBM Plex Mono for technical values.
- ADR-026 operating sections, Command Deck / useful Spatial Blueprint principles, permissions, quantities, and commercial behavior remain authoritative.
- Saved light/system preferences normalize to dark before paint. Density remains configurable. No second light design is required.
- Browser-unavailable implementation checks do not constitute visual acceptance. Verify representative populated and empty routes, mobile overflow, keyboard/focus, and all interaction states manually before claiming visual PASS.

### Motion

Motion must answer a functional question: what changed, what is active, where did an item go, or what needs attention?

Approved patterns include:

- 150–250 ms surface/selection transitions;
- active-tab transitions;
- one-time value transitions where useful;
- expandable operational surfaces;
- status movement;
- subtle live-field activity indication;
- queue/file-processing transitions;
- drawer/sheet continuity;
- contextual focus/highlight.

Do not use perpetual decorative animation, looping gradients, parallax across work pages, or motion that delays estimating/operations. Respect `prefers-reduced-motion`.

### Spatial Blueprint / 3D

Spatial treatment is selective, not universal.

It is appropriate for:

- Takeoff and derived 3D verification;
- markup/customer review;
- selected technical/hero surfaces;
- future field-estimating experiences;
- login/landing refinement where authorized.

It is not the default treatment for repetitive forms, accounting, pricing, or dense tables.

Persisted 2D Takeoff geometry remains quantity authority. 3D remains derived verification and may not create an independent quantity/commercial path.

## Accepted reference implementation

The final bounded Astra Experience System task intentionally implemented:

- shared experience primitives needed by the reference pages;
- typography/section hierarchy;
- shared tab language;
- meaningful icon language;
- restrained transition-level motion primitives;
- surface/depth and empty-state treatment;
- Today — Daily Command Center;
- Projects — Operations Board;
- Documents — Evidence Hub.

Nik visually accepted this reference slice and PR #77 merged it to staging.

## Rollout status

The reference slice does **not** satisfy the original Issue #76 complete application-wide rewrite by itself.

The final bounded reference task explicitly left these outside scope:

- Takeoff route-level redesign;
- Estimate;
- Proposal/commercial surfaces;
- Billing;
- Owner Reports;
- Settings;
- Client Package Studio;
- Markup Sheet;
- Quick Estimate;
- login/landing;
- broad route migration.

Issue #76 remains open for coherent application-wide propagation and the explicitly deferred experience projects.

Do not claim that the broader motion system or Spatial Blueprint/3D vision is fully delivered merely because the three reference routes are accepted.

## Takeoff boundary

Takeoff retains:

- Plans;
- Conditions;
- Zones;
- dominant drawing/measurement workspace;
- governed Condition Properties;
- Quantity / Estimate Worksheet;
- authoritative 2D measurement;
- synchronized derived 3D verification;
- scale/calibration;
- established select/pan/draw/edit/cutout/snap/ortho/undo/redo behavior.

Future presentation refinement may recompose panes/interactions only if it preserves or improves estimator efficiency and all ADR-020/domain invariants.

## Protected boundary

ADR-025 does not weaken or replace:

- Next.js modular-monolith architecture;
- Supabase/PostgreSQL source of truth;
- `company_id` tenant isolation/RLS;
- source-controlled migrations;
- server-authoritative deterministic quantity/cost/pricing/financial calculations;
- immutable/versioned commercial records and lineage;
- Opportunity/Takeoff → Estimate → Proposal → Award → Project → Production → Cost/Forecast lineage;
- Production Quantity / Direct Cost / Sell separation;
- persisted page-coordinate 2D geometry as Takeoff quantity authority;
- human authority over scope, Conditions, means/methods, reinforcing, production assumptions, pricing, margin, budgets, approvals, and final commercial decisions.

## Acceptance and future work

Reference-slice acceptance is complete. Application-wide ADR-025 rollout remains open under Issue #76.

Each future route migration must preserve functional behavior and be browser-accepted on staging. Major spatial/3D or interaction projects should be explicitly scoped rather than inferred from this ADR.
