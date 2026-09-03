# ADR-009 — Versioned Production Scope Allocation

Status: Accepted
Date: 2026-09-03

## Context

Field execution rarely maps one whole Takeoff measurement to one Production Work Unit. A 600 LF footing measurement may support several operations, and each operation may partition its authorized quantity across areas, crews, pours, or dates. After award, an RFI or drawing revision may also change authorized quantity. A direct editable quantity on the Work Unit cannot safely represent partitioning, revisions, or historical completion without risking double counting and rewritten history.

## Decision

Carez uses versioned **Scope Allocation** records beneath Production Work Units as the explicit bridge to authorized physical scope.

An allocation identifies:

- Production Work Unit;
- source Accepted Scope Snapshot item or later approved change-scope item;
- exact Takeoff measurement/output version and published assembly version where applicable;
- operation/production-quantity basis;
- allocated quantity and compatible unit;
- location, segment, or partition identity where applicable;
- authorization source and effective version;
- superseded/predecessor allocation and revision reason.

One authorized source may be partitioned across several Work Units within the same operation/allocation basis. The same physical geometry may legitimately support distinct operations or resource outputs, each with its own accepted output/production basis; those are not duplicate allocations. One Work Unit may combine authorized scope from several sources only when their operation and quantity bases are compatible. The Work Unit retains its execution identity while allocation versions change prospectively.

## Validation rules

- source, allocation, Work Unit, Project, and Job Spine must belong to the same tenant and job lineage;
- allocated units must be dimensionally compatible with their authorized source;
- active allocations within the same authorized source and operation/allocation basis must not unintentionally overlap or aggregate beyond authorized quantity;
- unallocated authorized quantity is allowed and remains visible;
- additional quantity requires an approved change-scope source rather than an in-place edit to the accepted baseline;
- split, merge, reassignment, or revision creates new/superseding allocation records;
- prior schedule, Actual Work Context, Blocker Events, Completion Evidence, cost, and Production Evidence keep the allocation-version reference that governed when they occurred.

Carez preserves at least three quantity meanings after revision:

- original baseline quantity;
- current authorized quantity;
- authorized delta and source.

A Work Unit's displayed/planned quantity is derived from, or protected as a projection of, its active Scope Allocations. It is not an independent untraceable quantity that can overwrite awarded scope.

## Consequences

### Positive

- Takeoff scope can be divided into field-realistic zones without losing source lineage;
- later revisions can update remaining execution scope while preserving completed history;
- production and cost evidence can identify the exact quantity version used;
- allocation validation prevents silent double counting;
- split and merged Work Units remain auditable.

### Implementation requirements

- add tenant-owned allocation/version structures and server-side validation;
- migrate existing direct Work Unit/operation quantity links into baseline allocation records where evidence is exact;
- flag ambiguous or aggregate legacy mappings for review;
- update schedule, field, completion, production, and cost references to retain allocation version;
- preserve current Work Unit identifiers and historical actuals during migration.

This ADR establishes target architecture. It does not claim Scope Allocation is implemented or verified.

## Protected invariants

- Takeoff remains physical measurement authority.
- Accepted Scope Snapshot and approved changes remain authorization authority.
- Original baseline quantities are immutable.
- Server-authoritative validation protects tenant and quantity lineage.

## Related decisions

- ADR-004 — Immutable Commercial Lineage
- ADR-008 — Accepted Scope Snapshot and Frozen Commercial Baseline
- ADR-010 — Separate Field Truth and Production Evidence Records

## Canonical owners

- `docs/ARCHITECTURE.md`
- `docs/modules/takeoff.md`
- `docs/modules/projects-work-packages-scheduling.md`
- `docs/modules/field-production-pour-control.md`
