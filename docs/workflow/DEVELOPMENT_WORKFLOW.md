# Carez development workflow

## Current execution model

Carez repository implementation is cloud-based.

```text
Nik / Carez control room
→ connected GitHub/Supabase/Vercel tools and/or ChatGPT Work/Codex cloud
→ GitHub staging
→ GitHub Actions
→ Vercel staging
→ browser QA
```

Supabase QA is the staging database authority. The local Windows repository is a replaceable mirror only.

All model execution may consume credits or allowance. Use the least expensive model tier that can reliably complete the assigned work; Luna/Terra are lower-cost, not free. Astra is premium and opt-in.

## Roles

- **Carez control room / connected tools** — architecture/product decisions, task definition, GitHub/Supabase/Vercel inspection, acceptance, debugging across systems, and bounded direct repository maintenance.
- **ChatGPT Work/Codex cloud** — substantial repository implementation and multi-step engineering work.
- **Luna** — bounded helper work by default when available.
- **Terra** — helper escalation only when Luna is insufficient.
- **Astra** — major design invention, difficult architecture, and high-value implementation where premium capability materially improves the result.
- **GitHub `staging`** — canonical development/integration/QA/UAT source line.
- **GitHub Actions** — automated validation after push.
- **Vercel staging** — deployed QA runtime.
- **Supabase QA** — staging database authority.
- **Nik browser QA** — rendered acceptance for user-facing behavior.

## Branches

- `staging`: development, integration, QA, user acceptance.
- `main`: production only.
- Temporary implementation branches are exceptional; if used, start from current `staging`, target `staging`, and retire after integration.
- Online GitHub is authoritative. Do not push stale local history to reconcile a mirror.

## Standard cycle

1. Define/approve the bounded change in the Carez control room or canonical issue/spec when material.
2. Verify current online `staging`.
3. Route the work to control-room tools or cloud Work/Codex at the lowest suitable model cost.
4. Read only target implementation and direct dependencies.
5. Make the smallest coherent change.
6. For DB changes, add a source-controlled migration and apply to QA only unless production is explicitly authorized.
7. Validate proportionally: targeted checks for narrow work; `pnpm typecheck` + relevant tests for normal implementation; `pnpm check` for broad/high-risk work.
8. Commit/push to the assigned branch.
9. Inspect GitHub Actions and the matching Vercel deployment outside premium Astra implementation turns unless the task explicitly assigns validation there.
10. Browser-verify rendered UI when applicable.
11. Update the owning module/ADR/`CURRENT_STATE.md` only from verified facts.
12. Remove superseded working/checkpoint documentation after surviving truth is absorbed by canonical owners.

## Premium Astra boundary

For premium Astra implementation:

```text
IMPLEMENT -> COMMIT -> PUSH -> STOP
```

Do not spend Astra allowance on routine repository discovery, tests, browser QA, CI/deployment waiting, reviewer loops, or optional polish unless Nik explicitly makes that the premium task.

## Acceptance evidence

- Source inspection proves implementation only.
- Typecheck/build proves compile/integration only.
- Domain tests prove calculation/lineage contracts.
- DB inspection proves persistence/security behavior.
- GitHub Actions proves the pushed commit passed repository validation.
- Vercel proves deployed build/runtime state.
- Browser QA proves rendered user-visible behavior.

## Approval → documentation

When a material decision is approved/final/locked:

- product/module behavior → owning `docs/modules/*.md`;
- cross-cutting product architecture → `docs/ARCHITECTURE.md` and usually ADR;
- global UX/design rule → active ADR + component pack;
- sequence → `docs/ROADMAP.md`;
- verified implementation/blocker → `docs/CURRENT_STATE.md`;
- development/process rule → `AGENTS.md`, `CODEX.md`, or `docs/workflow/`.

Git history and issues preserve historical evidence; do not retain obsolete implementation checklists solely as archives.

## Release

Promote `staging` to `main` only after explicit production authorization and required acceptance. Production DB changes remain gated by Issue #59 while it is open.
