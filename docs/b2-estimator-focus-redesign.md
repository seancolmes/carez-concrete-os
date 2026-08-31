> **Document status:** ACCEPTED DETAILED DESIGN  
> **Canonical owner:** `docs/ARCHITECTURE.md`, `docs/modules/takeoff.md`, `docs/modules/estimating.md`  
> **Use:** Supporting visual/interaction contract. Where this file conflicts with a canonical document, the canonical document wins.  
> **Supersession:** Active until explicitly superseded by an approved replacement design.

# Carez Concrete OS — B2 Estimator Focus redesign

## Visual contract

B2 is a desktop-first professional estimating interface. The benchmark is professional CAD/estimating software rather than generic SaaS dashboards.

### Canonical Dark Carbon palette

These values are authoritative. Do not sample replacement colors from screenshots or rendered mockups.

| Token | Hex | Use |
| --- | --- | --- |
| Primary Blue | `#1E5BFF` | Active tools, buttons, selections, links and important totals |
| Blue Gradient Start | `#1E5BFF` | Branded / selected-state gradients |
| Blue Gradient End | `#0D2E6E` | Branded / subtle navigation gradients |
| Carbon | `#0F1115` | Main application background |
| Surface | `#161A20` | Panels, toolbars and worksheets |
| Border | `#2A2F36` | Dividers, input borders and table grid |
| Text Primary | `#E6E8EB` | Primary labels and values |
| Text Secondary | `#A3A6B3` | Metadata, inactive labels and secondary text |
| Success | `#22C55E` | Complete / verified / positive state |
| Warning | `#F59E0B` | Verification required / caution |
| Danger | `#EF4444` | Errors and destructive actions |

The majority of the application remains neutral Carbon/Surface. Carez Blue is selective so drawing takeoff colors and estimating data remain visually dominant.

### Brand mark

The supplied Carez Concrete logo is the canonical application brand mark: blue geometric `C`, white concrete-pump line art, blue `CAREZ` wordmark and white `CONCRETE` subline. The application shell uses the dedicated `/brand/carez-wordmark.png` slot for this mark. Do not substitute a generic `C`, redraw the pump, or invent another logo treatment. The logo should be prominent enough to identify Carez while remaining compact enough not to consume estimator workspace.

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

## Inspector model

The Takeoff inspector uses three functional tabs:

- `Takeoffs`
- `Properties`
- `Build Plan`

There is no fake `Layers` module. `Build Plan` is a Carez-specific first-class concept.

The compact Build Plan inspector shows method status, revision, important assumptions and unresolved verification. Advanced editing uses the main application workspace rather than an oversized permanent sidebar form, browser popup or separate window.

## Builder Methods

Builder Methods remain part of P1. The existing verification, immutable profile lineage, conditional activation and draw gate remain authoritative through the redesign.

## Estimate hierarchy

Takeoff measurement/assembly groups remain collapsible. Parent groups such as `Strip Footing — Garage 1` own their generated resource/cost children and measurement subtotal. The B2 redesign changes presentation, not lineage semantics.

## Release boundary

The B2 redesign is isolated from `staging` and `main`. QA-specific Supabase bindings must never be merged into this branch.
