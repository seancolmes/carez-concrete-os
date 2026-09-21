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

- Inter is the primary interface/display typeface.
- IBM Plex Mono is selective technical typography for identifiers, dimensions, aligned technical data, and other cases where mono materially helps.
- Sentence/title case replaces pervasive uppercase hierarchy.
- Indigo is the restrained interaction/focus identity; pale blue-white/white surfaces carry the light application, graphite/black surfaces carry dark mode, and status color remains semantic.
- Use three depth levels: canvas, operational surface, interactive/selected surface.
- Tabs require a clear active surface/edge, hover/focus response, and compact professional geometry.
- Icons must improve recognition of real construction/business states, not become decoration.
- Light, dark, and system are first-class.

### Official theme — Indigo Harbor, adapted for Carez

Nik superseded Slate Haze on 2026-09-21 with the supplied **Indigo Harbor** theme and visually accepted Indigo Harbor as the final Carez theme for ADR-025 on 2026-09-21. Carez uses its pale blue-white canvas, white operational surfaces, deep harbor-navy shell, and restrained indigo interaction color in light mode; dark mode uses near-black canvas/surfaces with lighter indigo focus and primary interaction.

Core light theme:

| Token | Value |
| --- | --- |
| `--background` | `#f3f5fb` |
| `--card` | `#ffffff` |
| `--foreground` | `#010101` |
| `--muted` | `#f5f5f5` |
| `--muted-foreground` | `#454545` |
| `--accent` | `#19398d` |
| `--border` | `#e3e3e3` |
| `--input` | `#ffffff` |
| `--ring` | `#324f9a` |
| `--primary` | `#19398d` |
| `--sidebar` | `#001B3C` |

Core dark theme:

| Token | Value |
| --- | --- |
| `--background` | `#050505` |
| `--card` | `#0a0a0a` |
| `--foreground` | `#fafafa` |
| `--muted` | `#262626` |
| `--muted-foreground` | `#a1a1a1` |
| `--accent` | `#404040` |
| `--border` | `#282828` |
| `--input` | `#121212` |
| `--ring` | `#6a8dd8` |
| `--primary` | `#6a8dd8` |
| `--sidebar` | `#0a0a0a` |

Inter is the primary Carez interface/display typeface under Indigo Harbor. IBM Plex Mono remains selective technical typography for identifiers, dimensions, aligned technical data, and similar high-value technical contexts.

The Carez top shell maps to Indigo Harbor's sidebar family: deep harbor navy in light mode and near-black in dark mode. Workspace content keeps the supplied background/card separation rather than turning the entire application into a navy surface.

Login/landing and specialist workspaces may use low-contrast technical grid geometry as a supporting layer. It must read as construction-document space, remain subordinate to content, respect reduced-motion, and avoid neon/sci-fi treatment.

Usage rules:

- light work surfaces are predominantly `#f3f5fb` canvas plus white operational panels;
- `#19398d` indigo is used for primary interaction, selected state, and technical/spatial emphasis rather than page-wide fill;
- deep `#001B3C` is reserved primarily for shell/navigation identity and bounded high-authority surfaces;
- semantic success/warning/error/info colors communicate real state only;
- no Slate Haze, amber, teal-brand, or module-specific competing palette;
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
