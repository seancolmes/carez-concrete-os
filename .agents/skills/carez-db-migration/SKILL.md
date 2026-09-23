---
name: carez-db-migration
description: Design, implement, investigate, or review a confirmed Carez database/persistence concern: Supabase/PostgreSQL schema, RLS, functions, data migrations, migration chain, tenant isolation, or persisted-record compatibility. Use when database/persistence scope is established by the task or evidence. Do not select merely because a database function or persisted record is one possible layer in an otherwise unresolved ownership search.
---

# Carez DB Migration

Treat database work as a versioned product change, not a convenience edit.

## Workflow

1. Start with the affected schema object, directly relevant migrations, owning server/database caller, and named module only. Project instructions are already loaded; do not reread `AGENTS.md` or `CODEX.md`.
2. Inspect only the latest directly relevant migration lineage; do not read the full migration history unless replay/order evidence requires it.
3. Read the relevant ADR-002 section only when source-of-truth ownership, migration registry/history, environment reconciliation, or remote-vs-source authority is part of the task.
4. Define the invariant being changed: schema, data, RLS, function behavior, compatibility, or migration registry.
5. Implement a source-controlled migration when persistence changes. Preserve existing data and accepted/versioned records.
6. For tenant-accessible data, verify `company_id` ownership and RLS explicitly.
7. Keep server-authoritative calculations and authorization on the server/database boundary where required.
8. Validate local/replay behavior before any remote mutation. Remote QA/production operations require separate explicit authorization.
9. Report rollback/recovery implications and any migration ordering dependency.

## Non-negotiable boundaries

- Never repair, reset, rewrite, or force-align production migration history as a side effect of local/QA work.
- Never apply bootstrap DDL blindly to already-materialized production objects.
- Never make browser state authoritative for persisted financial/domain truth.
- Never mutate remote Supabase during ordinary implementation.

## Progressive detail

Read `references/migration-review.md` before action only for an explicit migration review, high-risk data/RLS/financial change, or release acceptance involving migrations. Do not load it for a routine already-specified migration implementation.
