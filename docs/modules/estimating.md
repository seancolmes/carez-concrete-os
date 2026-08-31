# Module Spec — Estimating

Status: next major modernization phase

## Purpose
Turn Takeoff quantities and Carez means/method decisions into a commercially reviewable concrete estimate without duplicate quantity entry.

## Primary workflow
Scope → Takeoff → Pricing → Review → Proposal.

## Invariants
- Published assembly versions are immutable.
- Plan facts, method decisions, production assumptions, and commercial assumptions remain distinguishable.
- Production Quantity, Direct Cost, and Sell remain separate.
- Pricing retains source/provenance and effective date where available.
- Missing input/price/labor rate becomes a visible hold, not a fabricated zero.
- Manual commercial overrides retain provenance through physical quantity recalculation.
- Accepted commercial records preserve exact historical lineage.

## Core entities
Scope hierarchy, assembly/version, verified job method profile, deterministic resource output, estimate item, pricing source, hold/status, alternate/allowance/exclusion/inclusion, proposal revision.

## Resource direction
Concrete, reinforcing, formwork, embeds, joints, consumed material, reusable inventory demand, labor, owned/rented equipment, subcontractors, and other concrete-specific resources are first-class outputs.

## Acceptance
An estimator can trace every commercial line to the exact measurement, method/profile, immutable assembly component, quantity driver, production assumption, and price source.
