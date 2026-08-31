# Carez Concrete OS — B2 Estimator Focus redesign

## Visual contract

B2 is a desktop-first professional estimating interface. The application shell uses a Dark Carbon system: near-black chrome, slightly raised charcoal panes, thin neutral dividers, compact controls, Carez blue for selection/primary actions, off-white primary text, muted gray secondary text, small radii, and tabular numeric presentation.

The benchmark is professional CAD/estimating software rather than generic SaaS dashboards.

## Workspace model

The flagship estimator workspace is organized as:

1. permanent global rail,
2. project/sheet context pane,
3. dominant PDF/vector drawing canvas,
4. assembly/takeoff inspector,
5. persistent quantity/estimate worksheet,
6. compact project/module bar.

Closing a context pane must never remove the permanent desktop rail.

## Synchronized layers

Carez presents three synchronized layers of the same estimate:

`Drawing -> Takeoff / Assembly -> Estimate`

Geometry remains authoritative in normalized/vector page coordinates. Assemblies expand geometry into physical resources, production and generated estimate lines. Financial lineage remains server-authoritative.

## Build Plan

Builder Methods remain part of P1. The right-side inspector should show a compact method status/summary during normal drawing. Advanced Build Plan editing is a larger application-workspace task rather than a permanently expanded narrow form.

The existing P1 verification, immutable profile lineage and draw gate remain authoritative.

## First implementation pass

This branch introduces:

- B2 global rail/topbar and semantic Dark Carbon tokens,
- B2 Takeoff project bar and workstation chrome,
- dark sheet navigator, CAD toolbar, inspector and drawing status bar,
- dark persistent Takeoff quantity worksheet,
- B2 Build Plan styling,
- B2 hierarchical Estimate worksheet styling,
- whole-OS density and control refinements through a final semantic stylesheet.

## Deferred interaction refinement

The next B2 pass should add the final inspector information architecture (`Takeoffs`, `Properties`, `Build Plan`) and move full Build Plan editing into the main workspace while preserving the compact drawing inspector. That interaction change must be browser-tested against authenticated Takeoff behavior before staging promotion.

## Release boundary

The B2 redesign is isolated from `staging` and `main`. QA-specific Supabase bindings must never be merged into this branch.
