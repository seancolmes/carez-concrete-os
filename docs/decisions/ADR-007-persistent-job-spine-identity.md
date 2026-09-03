# ADR-007 — Persistent Job Spine Identity

Status: Accepted
Date: 2026-09-03

## Context

Carez must feel continuous from invitation through closeout without collapsing phase-specific business records into one mutable object. An Opportunity may have multiple Estimate and Proposal revisions, may be lost or rebid, and may later produce a Project. Mutating the Opportunity into a Project would erase lifecycle meaning and weaken history, authorization, and lineage.

## Decision

Carez uses one company-scoped **Job Spine** identity as the stable lineage root for a bid-to-closeout lifecycle.

- Opportunity, Estimate, Proposal, Award Decision, Accepted Scope Snapshot, Project, Change Event, procurement, field, billing, and closeout records link to the same Job Spine as applicable.
- Opportunity and Project remain different entity types with independent lifecycle/status/history.
- Award creates or links a Project beneath the existing Job Spine; it never converts the Opportunity row into a Project row.
- Multiple Estimate and Proposal revisions may coexist without changing Job Spine identity.
- Lost, declined, superseded, and rebid preconstruction records remain traceable even if no Project is created.
- Shared documents and stable job context may link at the Job Spine level while module-owned facts remain authoritative in their owning records.
- `company_id` tenant ownership, RLS, authorization, and audit history apply to the Job Spine and all linked entities.

The product may use a user-facing command such as `Create Project` or `Convert to Project`, but its domain meaning is an authorized creation/link action, not entity mutation.

## Consequences

### Positive

- customer, location, document, scope, quantity, and commercial lineage can flow forward without re-entry;
- preconstruction history survives award;
- multiple commercial revisions remain unambiguous;
- cross-module search, reporting, and audit can use one durable job identity;
- later changes and learning can trace back to the originating job lifecycle.

### Implementation requirements

- introduce a tenant-owned Job Spine entity and links on phase-specific records through source-controlled migrations;
- backfill existing records deterministically where a trustworthy relationship exists;
- flag ambiguous legacy relationships for review rather than guessing;
- make project-creation/award actions idempotent and tenant-safe;
- preserve existing entity identifiers and history during migration.

This ADR establishes target architecture. It does not claim the Job Spine migration is implemented or verified.

## Protected invariants

- PostgreSQL/Supabase remains authoritative.
- Opportunity and Project histories are not merged.
- Commercial acceptance remains immutable/versioned.
- Takeoff measurement-role, Concrete Condition/module-output, and retained legacy assembly lineage remain exact.
- Human authorization is required for award and Project creation.

## Canonical owners

- `docs/ARCHITECTURE.md`
- `docs/modules/crm-preconstruction.md`
- `docs/modules/estimating.md`
- `docs/modules/projects-work-packages-scheduling.md`
- `docs/modules/documents-knowledge.md`
