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

### Visual / interaction language

- Manrope is the primary interface/display typeface.
- IBM Plex Mono is selective technical typography for identifiers, dimensions, aligned technical data, and other cases where mono materially helps.
- Sentence/title case replaces pervasive uppercase hierarchy.
- Warm amber is the restrained interaction/focus identity; neutral warm surfaces carry the application and status color remains semantic.
- Use three depth levels: canvas, operational surface, interactive/selected surface.
- Tabs require a clear active surface/edge, hover/focus response, and compact professional geometry.
- Icons must improve recognition of real construction/business states, not become decoration.
- Light, dark, and system are first-class.

### Official theme — Claude Amber Remix, adapted for Carez

Nik replaced the rejected Carez Cobalt direction on 2026-09-21 with the supplied **Claude Amber Remix** theme. Carez uses its warm neutral/amber color system while preserving Carez typography, density, workstation geometry, and construction-native interaction patterns.

Core light theme:

| Token | Value |
| --- | --- |
| `--background` | `#faf9f5` |
| `--card` | `#f5f4ef` |
| `--foreground` | `#3d3929` |
| `--muted` | `#ede9de` |
| `--muted-foreground` | `#6e6d68` |
| `--accent` | `#e9e6dc` |
| `--border` | `#dad9d4` |
| `--input` | `#b4b2a7` |
| `--ring` | `#c96442` |
| `--primary` | `#000000` |

Core dark theme:

| Token | Value |
| --- | --- |
| `--background` | `#262624` |
| `--card` | `#2c2c2b` |
| `--foreground` | `#f1f1ef` |
| `--muted` | `#1b1b19` |
| `--muted-foreground` | `#b7b5a9` |
| `--accent` | `#1a1915` |
| `--border` | `#3e3e38` |
| `--input` | `#52514a` |
| `--ring` | `#d97757` |
| `--primary` | `#ffffff` |

Carez semantic tokens derive from the theme rather than introducing a second palette: canvas from background, panel from card, raised from popover, text from foreground/muted foreground, strong border from input, interaction/focus/spatial accent from ring, and selection from accent. Manrope remains the primary UI font and IBM Plex Mono remains the technical font. Existing Carez precision radii/density rules remain authoritative even though the source theme publishes broader defaults.

Login/landing may use reusable technical grid-pattern geometry as a background/supporting layer. It must read as construction-document space, remain subordinate to content and the Spatial Blueprint, respect reduced-motion, and avoid neon/sci-fi treatment.

Usage rules:

- warm neutral surfaces dominate;
- amber is used for focus, technical/spatial emphasis, and selected edges rather than page-wide fill;
- semantic success/warning/error/info colors communicate real state only;
- no cobalt/teal theme remnants or module-specific alternate palettes;
- light, dark, and system remain first-class;
- all implementation must preserve WCAG AA minimum normal-text contrast.

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
