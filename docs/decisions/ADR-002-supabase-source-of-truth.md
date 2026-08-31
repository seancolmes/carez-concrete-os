# ADR-002 — PostgreSQL/Supabase Is the System of Record

Status: Accepted

## Decision
PostgreSQL/Supabase remains the authoritative persisted data source for Carez operational and commercial records.

## Rationale
Carez requires tenant isolation, relational lineage, transactional consistency, auditable migrations, and server-authoritative domain behavior.

## Consequences
- Schema changes use source-controlled migrations.
- `company_id` remains the tenant root.
- Browser-accessible tenant tables use RLS.
- Client state may cache/display data but does not become authoritative financial/domain truth.
