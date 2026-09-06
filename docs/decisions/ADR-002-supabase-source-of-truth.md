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

## Migration and environment lifecycle
- `staging` is paired with the isolated QA Supabase project; `main` is paired with production. Migration operations must preserve that boundary.
- The repository migration chain must be replayable from a clean local Supabase instance and must remain aligned with the QA migration registry before staging acceptance.
- Local Supabase CLI/configuration is repository-owned development tooling; migration SQL is normalized to LF so exact-source migration guards behave consistently across Windows and CI environments.
- QA migration history may be reconciled to a clean canonical baseline when repository history is demonstrably broken, but only after proving clean local replay and schema parity with live QA.
- Production migration history is not repaired, rewritten, reset, or force-aligned as a side effect of QA/local reconciliation. Promotion to production requires an explicit production bridge plan that proves schema compatibility, migration-history compatibility, rollback/recovery, and tenant/RLS safety before any write to the production database.
- Existing production objects must not receive bootstrap DDL merely because the QA/local replay chain contains bootstrap migrations; production reconciliation must account for its already-materialized schema and recorded migration history.
