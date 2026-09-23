---
name: carez-db-migration
description: Design, implement, and review Carez Supabase/PostgreSQL schema, RLS, function, data-migration, and migration-chain changes. Use whenever a Carez task touches `supabase/migrations`, tenant tables, `company_id`, RLS policies, database functions, persisted commercial/domain records, migration repair, or schema compatibility. Preserve source-controlled migrations, tenant isolation, existing data, lineage, replayability, staging/production separation, and explicit production authorization.
---

# Carez DB Migration

Treat database work as a versioned product change, not a convenience edit.

## Workflow

1. Read `AGENTS.md`, `CODEX.md`, `docs/decisions/ADR-002-supabase-source-of-truth.md`, and only the owning module/ADR for the affected data.
2. Inspect the latest directly relevant migrations and calling code; do not read the entire migration history unless lineage requires it.
3. Define the invariant being changed: schema, data, RLS, function behavior, compatibility, or migration registry.
4. Implement a source-controlled migration. Preserve existing data and accepted/versioned records.
5. For tenant-accessible data, verify `company_id` ownership and RLS explicitly.
6. Keep server-authoritative calculations and authorization on the server/database boundary where required.
7. Validate local/replay behavior before any remote mutation. Remote QA/production operations require separate explicit authorization.
8. Report rollback/recovery implications and any migration ordering dependency.

## Non-negotiable boundaries

- Never repair, reset, rewrite, or force-align production migration history as a side effect of local/QA work.
- Never apply bootstrap DDL blindly to already-materialized production objects.
- Never make browser state authoritative for persisted financial/domain truth.
- Never mutate remote Supabase during ordinary implementation.

## Progressive detail
Read `references/migration-review.md` when reviewing the migration or preparing staging acceptance.
