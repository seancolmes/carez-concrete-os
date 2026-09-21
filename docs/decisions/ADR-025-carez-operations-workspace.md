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
- Carez blue is restrained interaction/selection/focus identity, not generic decorative fill.
- Use three depth levels: canvas, operational surface, interactive/selected surface.
- Tabs require a clear active surface/edge, hover/focus response, and compact professional geometry.
- Icons must improve recognition of real construction/business states, not become decoration.
- Light, dark, and system are first-class.

### Official palette — Carez Cobalt

Nik approved **Cobalt Sky** as the Carez identity palette on 2026-09-21. The product expression is a darker steel-blue operational system: neutral graphite/navy work surfaces, strong cobalt identity, restrained icy-blue spatial highlights, and semantic status accents used only for real state.

Source identity colors:

| Token | Value | Role |
| --- | --- | --- |
| `--carez-cobalt` | `#0047AB` | brand/action identity, selected edges, strong active states |
| `--carez-navy` | `#000080` | deep identity anchor; selected fill only where contrast remains accessible |
| `--carez-ice` | `#82C8E5` | Spatial Blueprint highlight, focus/light technical cue |
| `--carez-steel` | `#6D8196` | muted technical accent, secondary lines and strong borders |

Dark workspace semantic target:

| Semantic token | Value |
| --- | --- |
| `--surface-canvas` | `#0F1722` |
| `--surface-panel` | `#162331` |
| `--surface-raised` | `#1D2C3B` |
| `--text-primary` | `#EAF2F8` |
| `--text-secondary` | `#C9D6E2` |
| `--text-muted` | `#B7C6D4` |
| `--border-default` | `#2C4358` |
| `--border-strong` | `#6D8196` |
| `--interaction-primary` | `#82C8E5` |
| `--interaction-strong` | `#0047AB` |
| `--interaction-selection` | `#183A63` |
| `--interaction-focus` | `#82C8E5` |
| `--spatial-accent` | `#82C8E5` |
| `--spatial-muted` | `#6D8196` |

Light workspace semantic target:

| Semantic token | Value |
| --- | --- |
| `--surface-canvas` | `#F7F9FC` |
| `--surface-panel` | `#FFFFFF` |
| `--surface-raised` | `#EDF3F8` |
| `--text-primary` | `#172131` |
| `--text-secondary` | `#34495E` |
| `--text-muted` | `#516477` |
| `--border-default` | `#C4D0DC` |
| `--border-strong` | `#6D8196` |
| `--interaction-primary` | `#0047AB` |
| `--interaction-strong` | `#000080` |
| `--interaction-selection` | `#E3F1FA` |
| `--interaction-focus` | `#0047AB` |
| `--spatial-accent` | `#82C8E5` |
| `--spatial-muted` | `#6D8196` |

Semantic status colors are exceptions to the brand palette and must communicate real state rather than decorate surfaces:

| State | Dark | Light |
| --- | --- | --- |
| success | `#4DFFBC` | `#087F5B` |
| warning | `#FFC857` | `#A86100` |
| danger/error | `#FF4D4D` | `#C73838` |
| info | `#82C8E5` | `#0047AB` |

Usage rules:

- neutral graphite/navy surfaces carry most of the interface;
- cobalt is the principal brand/action color, not a page-wide fill;
- icy blue is the Spatial Blueprint/focus cue, not a generic secondary brand;
- navy is an identity anchor and must not be used for low-contrast dark-theme text;
- mint, amber, and red are semantic-only accents;
- no teal/turquoise cast as the dominant application background;
- no neon/cyberpunk palette, rainbow status language, or arbitrary local palettes;
- light theme uses the exact companion tokens above rather than mechanically inverting dark values;
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
