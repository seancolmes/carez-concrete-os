# Carez Concrete OS — Agent Operating Rules

This repository is the canonical product and implementation source of truth for Carez Concrete OS.

## Execution rule

When connected GitHub, Vercel, and Supabase tools are available, perform bounded Carez implementation directly through those tools. Do not route routine repository implementation to a separate local coding agent or ask Nik to execute implementation prompts elsewhere.

Use `docs/workflow/DEVELOPMENT_WORKFLOW.md` for the normal change cycle. Read only the sources needed for the bounded task.

## Branch discipline

Permanent branches are only `staging` and `main`.

- `staging` is development, integration, QA, and user acceptance.
- `main` is production only.
- Routine approved work goes directly to current `staging` when safe.
- Temporary branches are exceptional internal details for substantial/risky isolated work; start from current `staging`, merge back into `staging`, and delete before user QA.
- Never use `main` for speculative testing.
- Nik tests only the stable staging Vercel URL defined in `docs/BRANCH_AND_RELEASE_MODEL.md`.

## Protected architecture invariants

- Carez is concrete-specific, not generic construction SaaS.
- PostgreSQL/Supabase is source of truth.
- Preserve RLS, tenant isolation, auditability, and source-controlled migrations.
- Preserve server-authoritative quantities, costs, pricing lineage, and financial values.
- Preserve immutable/versioned commercial records, published Company Condition Template versions, and referenced legacy assembly/recipe history.
- Preserve the digital thread from opportunity/takeoff through estimate, proposal, award, project, production, cost, and forecast.
- Production Quantity, Direct Cost, and Sell remain distinct.
- PDF is visual reference; persisted stable page-coordinate 2D/vector geometry is Takeoff quantity authority.
- Concrete Condition/module outputs remain traceable to primary/secondary measurements and estimate lineage.
- Derived 3D is verification only and never a second quantity engine.
- Humans remain authoritative for scope, Conditions, templates/defaults, means/methods, reinforcing interpretation, production rates, pricing, margin, budgets, and approvals.

## Implementation rules

- Continue the existing modernization; do not restart verified work without evidence.
- Make the smallest coherent change that solves the bounded problem.
- Do not modify unrelated runtime behavior.
- Protect domain, data, and commercial lineage.
- Use source-controlled Supabase migrations for schema/database behavior changes.
- Do not introduce a second client-side calculation engine.
- Do not introduce distributed infrastructure without a demonstrated requirement.
- When a write affects QA Supabase, inspect the resulting schema/security state as appropriate.
- When a push affects staging, inspect CI/deployment state and rendered behavior when the change is user-visible.

## UI rules

ADR-015 is the Carez-wide dark shadcn presentation authority. ADR-016 owns the desktop shell. ADR-020 owns the accepted integrated Takeoff workstation.

- Desktop uses one compact global application menubar with anchored menus; no permanent global desktop left rail and no permanent second global navigation row.
- Module-specific contextual panes remain inside their owning workspaces.
- Takeoff uses fixed-width independently collapsible left/right docked panes, a dominant drawing surface, explicit 2D/3D/Split controls, and the vertically resizable Quantity Worksheet. Normal docked side panes are not horizontally drag-resizable.
- Use the shared source-owned shadcn workspace and `docs/design-system/CAREZ_COMPONENT_PACK.md`.
- Do not revive B2/light styling, old structural class systems, alternate palettes, compatibility UI layers, or parallel component libraries.
- Use normal sentence/title case for ordinary UI text.
- Source/build success is not rendered acceptance; browser acceptance is separate.

## Validation boundary

Use proportional validation for the changed risk:

- localized edit: targeted checks as appropriate;
- normal implementation: typecheck plus relevant tests;
- high-risk domain/data change: typecheck plus relevant domain tests and database/security verification.

GitHub Actions is the comprehensive post-push validation path. Vercel is the staging deployment authority. Supabase QA is the database QA authority.

## Documentation rule

Significant approved decisions belong in canonical module specs/ADRs. Verified implementation state belongs in `docs/CURRENT_STATE.md`. Historical and superseded working documents do not stay in the active tree once their truth has been absorbed by canonical owners; Git history and closed issues preserve that evidence.
