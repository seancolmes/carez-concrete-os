# ADR-003 — Server-Authoritative Domain Calculations

Status: Accepted

## Decision
Authoritative quantity, cost, pricing-lineage, and financial calculations run through trusted server/domain logic and transactional database procedures where required.

## Rationale
Takeoff, estimating, and finance require deterministic results, tenant enforcement, immutable lineage, and protection from client-only mutation.

## Consequences
- UI previews must use the same deterministic logic or a server preview path.
- Do not create divergent client-side calculation engines.
- Geometry/Condition-module recalculation preserves validated output sets, holds, and commercial override rules.
