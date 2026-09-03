# ADR-008 — Accepted Scope Snapshot and Frozen Commercial Baseline

Status: Accepted
Date: 2026-09-03

## Context

An issued Proposal can contain base scope, alternates, allowances, unit prices, exclusions, clarifications, and commercial terms that are not all accepted. Negotiation, value engineering, or partial award may also make the awarded scope differ from the latest Estimate or the full Proposal. Using an `accepted` status alone cannot preserve the exact contract interpretation that should enter execution.

## Decision

Carez inserts an immutable **Accepted Scope Snapshot** between Award / Customer Acceptance and the frozen commercial baseline.

```text
Proposal Revision
→ Award Decision / Customer Acceptance
→ Accepted Scope Snapshot
→ Frozen Commercial Baseline / Budget
→ Project Execution
```

The snapshot materializes the accepted interpretation and preserves exact source references. It includes, where applicable:

- Job Spine and Award Decision;
- accepted Proposal and Estimate revisions;
- accepted scope hierarchy and line quantities;
- accepted/rejected alternate decisions;
- negotiated or partial-award scope;
- exact Takeoff measurement/output versions;
- exact measurement roles, Project Concrete Condition versions, Company Condition Template/Platform Archetype versions, module outputs, and any referenced legacy assembly versions;
- production assumptions, direct-cost assumptions, and Sell values as separate facts;
- pricing provenance and effective context;
- inclusions, exclusions, clarifications, allowances, unit prices, and accepted terms;
- supporting acceptance evidence, actor, and effective timestamp.

Only an authorized acceptance transaction may create the snapshot. Once created, its accepted facts are immutable. Corrections, later agreements, RFIs, drawing revisions, and change orders append linked decisions or authorized scope deltas; they do not edit the original snapshot.

The original frozen commercial baseline/budget is derived transactionally from the Accepted Scope Snapshot. Project creation or linking occurs on the same Job Spine and consumes this boundary rather than re-reading the current Estimate draft.

## Baseline terminology

- **Commercial baseline** — accepted scope, cost, Sell, and budget state derived from the Accepted Scope Snapshot.
- **Schedule baseline** — committed dates and milestones.
- **Production-assumption baseline** — planned means/method and productivity assumptions.

These are different records and may change only through their own authorized/versioned processes.

## Consequences

### Positive

- partial awards and alternate selections are explicit;
- field and financial execution cannot accidentally inherit unawarded Proposal lines;
- the original contract interpretation remains auditable after changes;
- frozen budget, Work Package, procurement, change, billing, and forecast records share one accepted source;
- Production Quantity, Direct Cost, and Sell remain distinguishable through handoff.

### Implementation requirements

- add tenant-owned Award Decision, Accepted Scope Snapshot, and immutable snapshot-item structures;
- enforce authorization, idempotency, immutability, and exact source/version lineage server-side;
- generate the original commercial baseline only from a valid snapshot;
- backfill legacy accepted jobs from available immutable evidence without inventing missing alternate/term decisions;
- expose review status where legacy acceptance evidence is incomplete.

This ADR establishes target architecture. It does not claim the acceptance-boundary migration is implemented or verified.

## Protected invariants

- issued/accepted commercial records are not silently rewritten;
- later scope reaches execution through approved change lineage;
- project execution never treats the latest mutable estimate as awarded truth;
- human authority governs accepted scope and commercial approval.

## Related decisions

- ADR-004 — Immutable Commercial Lineage
- ADR-007 — Persistent Job Spine Identity
- ADR-009 — Versioned Production Scope Allocation

## Canonical owners

- `docs/ARCHITECTURE.md`
- `docs/modules/estimating.md`
- `docs/modules/crm-preconstruction.md`
- `docs/modules/projects-work-packages-scheduling.md`
- `docs/modules/procurement-finance.md`
