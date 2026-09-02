# Module Spec — Estimating

Status: next major modernization phase

## Purpose
Turn Takeoff quantities and company-authored concrete recipes/means-and-method decisions into a commercially reviewable concrete estimate without duplicate quantity entry.

## Primary workflow
Scope → Takeoff → Pricing → Review → Proposal.

## Assembly boundary

Assembly authoring is owned by the Assembly & Resource Engine (`docs/modules/assembly-resource-engine.md`). Estimating consumes deterministic resource/labor outputs from published company-owned assembly versions; it does not own a second formula or assembly engine.

Carez does not require or silently inject a hard-coded production assembly catalog. Optional system templates are copied into company-owned drafts before they can become published Takeoff/Estimating recipes.

## Invariants
- Published assembly versions are immutable.
- Plan facts, method decisions, production assumptions, and commercial assumptions remain distinguishable.
- Production Quantity, Direct Cost, and Sell remain separate.
- Pricing retains source/provenance and effective date where available.
- Missing input/price/labor rate becomes a visible hold, not a fabricated zero.
- Manual commercial overrides retain provenance through physical quantity recalculation.
- Accepted commercial records preserve exact historical lineage.
- Resource quantity and resource price remain independent.
- Installed/theoretical quantity, procurement quantity, and reusable inventory demand remain distinguishable.

## Core entities
Scope hierarchy, assembly/version, verified job method profile, deterministic resource output, estimate item, pricing source, hold/status, alternate/allowance/exclusion/inclusion, proposal revision.

## Resource direction
Concrete, reinforcing, formwork, embeds, joints, consumed material, reusable inventory demand, labor, owned/rented equipment, subcontractors, and other concrete-specific resources are first-class outputs.

Labor build-up preserves physical production quantity, baseline MH/unit and source, estimator-reviewed job MH/unit, resulting man-hours, loaded labor rate, and direct labor cost.

## Acceptance
An estimator can trace every commercial line to the exact measurement, method/profile, immutable company-authored assembly component, resource quantity driver, production assumption, and price source.
