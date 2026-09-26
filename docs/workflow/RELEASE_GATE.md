# Local release gate

Run `pnpm carez:release-gate` on `staging`. This is local validation, never publication authority.

The harness creates a uniquely named disposable Supabase stack in `Documents/Carez-Rehearsal/release-gate`, allocates free ports, copies the exact migration files, and records SHA-256 hashes plus the source HEAD and working-tree manifest. It never reuses or resets an unrelated rehearsal. Generated local credentials stay outside the repository. The stack stops at completion; evidence and its disposable volume are retained for diagnosis.

Checks currently implemented:

- fresh migration replay and exact migration ledger/hash reconciliation;
- all `tests/fixtures/*-runtime.sql` transactional fixtures and pgTAP assertions;
- literal application table/view/RPC dependencies against the freshly replayed database;
- exposed table RLS, invoker views, explicit trusted definer search paths, and policies on exposed tenant tables;
- SQL lint findings, including errors returned with exit code zero;
- complete TypeScript test suite, typecheck, production build, whitespace, and stable-source checks.

`pnpm carez:release-gate --database-only` runs a database diagnostic without repeating application checks. Its PASS would describe only that diagnostic, never release readiness. Full results are written to the external run's `report.json`.

## Remaining gate implementation

The full gate deliberately fails until authenticated representative browser acceptance is automated. The dependency audit currently checks literal object references, not selected columns, dynamic names, RPC parameter signatures, or every composite tenant reference. Role/tenant/immutability assertions currently cover the commercial foundation, Change Orders, profile authority, and legacy assembly retirement; they do not yet prove every operational domain. These are required hardening work, not waivers. A successful command must not be presented as V1 completion without all product acceptance requirements.

## Source authority recovery

The first full-chain audit on 2026-09-26 found 155 distinct application-referenced objects absent from the source-replayed schema (117 relations and 38 functions). Representative operational objects exist in production and are absent from QA. Preserve current source and applied migrations; recover missing capabilities additively from verified contracts and schema evidence. Do not blindly replay historical production migration statements, import customer rows, or replace current Award/Change Order authority with older implementations.

## Publication

No provider writes, pushes, deployments, or production actions occur in this harness. A passing local gate still requires the explicit environment/action authorization in `EXTERNAL_STATE_BOUNDARY.md` before publication. Failed runs remain blocked with their actual findings.
