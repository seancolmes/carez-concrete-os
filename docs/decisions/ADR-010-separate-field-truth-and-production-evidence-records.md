# ADR-010 — Separate Field Truth and Production Evidence Records

Status: Accepted
Date: 2026-09-03

## Context

Readiness, payroll time, actual activity, completion, delay, and production learning answer different questions. Combining them into a generic task status or daily report would corrupt payroll truth, erase failed plans, overstate productive labor, and create unreliable estimating history.

## Decision

Carez preserves six separate, linked record types:

| Record | Authority |
| --- | --- |
| Constraint | Prospective readiness requirement or condition |
| Blocker Event | Realized failed-start or in-progress execution impact |
| Timecard | Payroll/workforce clock and paid-time truth |
| Actual Work Context | Auditable attribution of time to actual job/work/activity context |
| Completion Evidence | Evidence of partial or complete physical scope and verification state |
| Production Evidence | Derived performance observation with confidence and learning eligibility |

## Relationship rules

- A Constraint may be resolved without field impact. It may produce a linked Blocker Event when a crew is actually prevented or interrupted, but it never mutates into that event.
- A Blocker Event may exist without a previously modeled Constraint. It records affected work, crew/context, timestamps, owner, evidence, and downstream impact.
- A Timecard remains payroll truth even when the planned assignment or actual work changes.
- Actual Work Context segments reference the relevant Timecard interval and the actual Job Spine, Project, Work Package, Operation, Production Work Unit, Scope Allocation version, and activity classification.
- Attribution corrections preserve prior state and never rewrite clock-in/out facts. Overlaps, gaps, and unresolved time remain visible and cannot silently count as productive labor.
- Completion Evidence identifies the governing Scope Allocation version, quantity scope, source, event time, recorder, verification state, and supporting evidence. A bare status checkbox is insufficient for high-confidence production learning.
- Production Evidence is generated from authorized physical quantity, attributable Actual Work Context, Completion Evidence, method/crew/project context, and separated exception context. It never replaces or mutates any source record.

## Production-confidence model

Production Evidence preserves explainable component quality for:

- quantity authority;
- time-attribution quality;
- completion verification;
- method/context completeness;
- exception and contamination separation.

Carez may derive simple `HIGH`, `MEDIUM`, `LOW`, or `EXCLUDED` presentation states and learning eligibility from those factors. Ambiguous periods remain reviewable or excluded.

## Consequences

### Positive

- payroll corrections and production attribution remain independently auditable;
- readiness gaps are not falsely reported as realized delays;
- blocker/waiting/rework/setup time does not contaminate productive rates;
- completion and production learning retain exact authorized quantity/version context;
- generated daily records can be evidence-backed without turning foremen into clerks;
- estimator guidance remains explainable and never silently changes Company Condition Templates, Project Condition assumptions, or referenced legacy assemblies.

### Implementation requirements

- model each record with tenant ownership, timestamps, source, audit/supersession behavior, and explicit foreign-key lineage;
- validate work-context intervals against Timecards and prevent silent double attribution;
- retain stable event identifiers and deterministic conflict handling for offline/retried field writes;
- version production derivations so recalculation is explainable;
- migrate or classify legacy mixed records without fabricating confidence.

This ADR establishes target architecture. It does not claim these field records are implemented or verified.

## Protected invariants

- scheduled assignment and actual work remain distinct;
- paid time is not automatically productive time;
- Production Evidence is advisory history, not a Company Condition Template, Project Condition, legacy assembly, or estimate mutation;
- humans remain authoritative for completion verification, production-assumption adoption, and schedule/commercial approvals.

## Related decisions

- ADR-004 — Immutable Commercial Lineage
- ADR-009 — Versioned Production Scope Allocation

## Canonical owners

- `docs/ARCHITECTURE.md`
- `docs/modules/projects-work-packages-scheduling.md`
- `docs/modules/field-production-pour-control.md`
