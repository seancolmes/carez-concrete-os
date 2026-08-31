> **Document status:** HISTORICAL IMPLEMENTATION RECORD  
> **Canonical owner:** `docs/CURRENT_STATE.md` for current implementation status  
> **Use:** Evidence of the 2026-08-29 modernization checkpoint. Do not treat dates, branch state, blockers, or validation counts here as current.  
> **Supersession:** Current state and roadmap documents supersede this file for present-tense status.

# Carez Concrete OS Modernization Record

Last updated: 2026-08-29

This document records the evidence-backed modernization work completed against the existing production repository. It is intentionally narrower than the full product directive: working depth in Takeoff, build correctness, security, and estimating lineage was prioritized over speculative surface area.

## Baseline established

- Repository: `seancolmes/carez-concrete-os`, private, default branch `main`.
- Baseline commit: `c87aa5d`.
- Framework baseline: Next.js 15.5.24, React 19.2.8, TypeScript 5.9.3, Node 22/24 compatible.
- Baseline validation: TypeScript clean; optimized Next.js build clean; 71 routes generated.
- Hosting: Vercel project `carez-concrete-os`. The latest failed deployment for baseline `main` was blocked by the Hobby build-rate limit, not by a compile error.
- Data platform: Supabase project `Carez Concrete OS`, PostgreSQL 17.6.1.
- The live database already contained the two Takeoff geometry-update migrations from the remote `carez-takeoff-pro-01` branch while `main` did not. The migration files are now reconciled into this branch.

## Implemented product capabilities

### Application shell

- Geist Sans and Geist Mono are loaded through the Next.js font pipeline.
- The desktop tool finder opens with Ctrl/Cmd+K and closes with Escape.
- Mobile navigation now traps focus, restores focus to its opener, and focuses its search field when opened.
- The existing compact rail/context-drawer architecture was preserved instead of replaced.

### Takeoff geometry and calculation

- `DrawingGeometry` supports interior polygon rings (`holes`) in normalized PDF/page coordinate space.
- Cutouts subtract deterministically from gross area while adding their edges to calculated perimeter.
- Validation rejects out-of-page points, self-intersecting rings, cutouts outside/touching the parent ring, overlapping/nested cutouts, excessive cutouts, and excessive total points.
- Existing line/arc `TakeoffPath` behavior remains intact.
- Drawing geometry is rounded to seven decimal places before persistence.
- Stored geometry records net quantity, gross quantity, cutout quantity, total perimeter, and cutout perimeter.

### Takeoff workstation

- Existing measurements can be edited with draggable selection handles.
- Double-clicking an editable segment inserts a vertex; right-clicking a vertex removes it when the minimum valid point count remains.
- Area measurements support persisted cutouts, cutout removal, and even-odd SVG rendering.
- Measurements can be duplicated with a safe page-space offset.
- Arrow keys nudge the selected measurement; Shift increases the step tenfold without distorting geometry at page boundaries.
- Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z undo/redo committed geometry changes through the server procedure.
- A permanent desktop quantity worksheet is resizable, collapsible, searchable, scoped to one/all sheets, and row-virtualized. It exposes measurement, quantity, unit, assembly, estimate section, concrete, reinforcing, formwork, man-hours, direct cost, and pricing status.

### Atomic estimating lineage

- Geometry edits re-run the deterministic assembly engine on the server.
- Measurement quantity, variables, component outputs, generated estimate items, man-hours, production quantities, and direct costs update in one database transaction.
- The hardened database procedure locks the measurement/output rows, validates the complete component set, enforces company ownership and owner role, and blocks edits to issued/accepted/superseded estimates.
- Manual output price overrides are retained while their extended direct cost is recalculated against the edited quantity.
- Estimate items continue to reference the exact source measurement, output, and published assembly version.

## Database migrations

- `20260829_takeoff_pro_geometry_update.sql`: introduces the atomic drawing-measurement update procedure and authenticated-only execution.
- `20260829_takeoff_pro_geometry_update_hardening.sql`: preserves reviewed/manual pricing through geometry recalculation.
- `20260829_function_security_hardening.sql`: pins trusted search paths, removes public RPC access from trigger functions, limits employee field mutations to authenticated sessions, and limits opportunity-number generation to authenticated sessions. Public proposal, invite-preview, and secret-validated Outlook webhook RPCs remain intentionally anonymous.

All three migrations are now represented in source control on this working branch. The live migration history observed during reconciliation was:

- `20260829040547 takeoff_pro_geometry_update` and `20260829041625 takeoff_pro_geometry_update_hardening` were already live before this modernization pass, but their source files were absent from `main`; those exact migrations were recovered and reconciled into this branch.
- `20260829064305 function_security_hardening` was applied successfully during this pass immediately before the stop instruction was received. Post-application verification showed that direct anonymous/authenticated execution was closed for the trigger-only functions, anonymous execution was closed for employee field RPCs while authenticated execution remained available, and the three mutable-search-path warnings were removed.

No destructive table rewrite, data backfill, customer-record mutation, or migration-history rewrite was performed. No application deployment or branch publication was performed.

## Security and data review

- Every new server action performs its own authentication, owner-role authorization, company scoping, active-set check, and estimate mutability check.
- Geometry update authorization is repeated inside PostgreSQL; UI checks are not trusted as the boundary.
- No service-role key or database credential was added to client or repository code.
- Supabase security advisors reported two RLS-enabled tables with no policies. They appear intentionally inaccessible and were not opened without a proven access requirement.
- Leaked-password protection remains a Supabase Auth dashboard setting and cannot be represented safely as an application migration.
- Performance-advisor "unused index" notices were not acted on because the database is new and one day of statistics is not a safe basis for destructive index removal.

## Validation evidence

- `tsc --noEmit`: pass.
- Node domain and lineage-contract test suite: 7/7 pass.
- `next build`: pass; 71 routes generated.
- Public-entry browser QA passed at desktop and 390 x 844 mobile viewports with no horizontal overflow or page errors.
- Automated accessibility audit on the public entry reported 0 violations and 0 incomplete checks across WCAG A/AA rules.
- Browser console output contained only development-mode React/Fast Refresh informational messages.
- Baseline Takeoff first-load JS: 196 kB.
- Modernized Takeoff first-load JS: 209 kB. The 13 kB increase includes geometry editing, committed command history, and the virtualized worksheet.
- Shared first-load JS remains 103 kB.
- Domain coverage includes calibrated line length, polygon holes/perimeters, invalid/overlapping rings, arc length, slab area, assembly formulas/divide-by-zero protection, and durable command-history branching.

## Known limits and deferred work

- Multi-select, mouse-drag whole-object movement, clipboard copy/paste, layers, PDF vector snapping, OCR/AI suggestions, revision overlays, sheet thumbnails, and batch sheet operations are not implemented in this pass.
- There are currently no production drawing measurements, so a live data chain from measurement to estimate item to frozen budget cannot be demonstrated without inventing customer records. Schema/RPC lineage is preserved and covered structurally; the first real accepted estimate should be used for an end-to-end lineage fixture.
- Sell-price allocation is not present on measurement-output records, so the worksheet reports authoritative direct cost rather than fabricating a sell value.
- Full authenticated visual QA requires a real account/session on a preview or production origin.
- The Vercel Hobby build-rate limit may delay a new preview even when the build is valid.

## Progress at stop point

Completed in this pass:

- Reproducible pnpm lockfile, pinned runtime dependencies, CI typecheck/test/build gates, and a clean 71-route optimized build.
- Geist-based shell polish, keyboard tool finder, accessible mobile-navigation focus handling, and responsive public-entry polish.
- Persisted Takeoff cutouts, defensive geometry validation, vertex editing, duplication, keyboard nudging, committed undo/redo, atomic assembly/estimate recalculation, and a virtualized quantity worksheet.
- Source/live migration reconciliation, focused function-permission hardening, domain/lineage tests, public desktop/mobile browser checks, and accessibility checks.

Deferred deliberately:

- Multi-select, whole-object pointer drag, clipboard operations, layer controls, PDF vector snapping, OCR/AI geometry suggestions, revision overlays, thumbnails, and batch sheet operations.
- Broader CRM, project/field, production, finance, and AI modernization beyond preserving and verifying their existing architecture.
- Live authenticated Takeoff workflow QA and real-record measurement-to-accepted-estimate-to-frozen-budget proof; production contained no drawing measurements to test without fabricating customer data.
- Git push, pull request, Vercel preview, and production deployment. The branch remains local and resumable at a source-control checkpoint.
- Supabase leaked-password protection, which remains a dashboard-controlled human setting.
