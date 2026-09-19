# Carez development workflow

## Roles

- **Carez control chat / connected tools** — planning, research when needed, GitHub/Vercel/Supabase inspection, review, and bounded direct maintenance.
- **Local Codex workstation** — primary interactive implementation agent for repository work.
- **GitHub `staging`** — integration source for development and QA.
- **GitHub Actions** — automated compile/test/build validation after push.
- **Vercel staging** — deployed QA runtime.
- **Supabase QA** — staging database authority.
- **Nik browser QA** — final rendered acceptance for user-facing behavior.

The local Codex runtime is documented in `LOCAL_CODEX_WORKSTATION.md`. It is development tooling and is not part of the Carez application runtime.

## Branches

- `staging`: development, integration, QA, user acceptance.
- `main`: production only.
- Temporary branches are exceptional; if used, start from `staging`, merge back, delete before user QA.
- Nik tests only the stable staging Vercel alias from `docs/BRANCH_AND_RELEASE_MODEL.md`.

## Standard cycle

1. Define/approve the bounded change in the Carez control chat or canonical issue/spec when material.
2. Start from current `staging`.
3. Implement with the local Codex workstation or, for bounded repository maintenance, connected ChatGPT/GitHub tools.
4. Read only target implementation and direct dependencies; do not preload unrelated history/docs.
5. Make the smallest coherent change.
6. For DB changes, add a source-controlled migration and apply to QA only unless production is explicitly authorized.
7. Validate proportionally: targeted checks for local edits; `pnpm typecheck` + relevant tests for normal work; add DB/RLS/security checks for high-risk data changes.
8. Commit/push to `staging`.
9. Inspect GitHub Actions and the matching Vercel staging deployment.
10. Browser-verify rendered UI when applicable.
11. Update the owning module/ADR/`CURRENT_STATE.md` only when durable behavior or verified state changed.
12. Delete superseded working/checkpoint docs after surviving truth is captured canonically.

## Acceptance evidence

- Source inspection proves implementation only.
- Typecheck/build proves compile/integration only.
- Domain tests prove calculation/lineage contracts.
- DB inspection proves persistence/security behavior.
- GitHub Actions proves the pushed commit passed repository validation.
- Vercel proves deployed build/runtime state.
- Browser QA proves rendered user-visible behavior.

UI is not accepted as fixed until the exact behavior is re-tested in browser. Data/domain changes must preserve deterministic calculations, tenant isolation, mutation boundaries, and historical lineage.

## Runtime independence

Carez source must not depend on Codex Web UI, OmniRoute, Ollama, a specific local model, OpenCode, or a hosted AI plan. Those are implementation tools. Provider/model changes must not require product-code changes.

Never commit local provider keys, `CODEX_HOME` auth, machine-specific runtime state, or model caches.

## Approval → documentation

When a material decision is approved/final/locked:

- product/module behavior → owning `docs/modules/*.md`;
- cross-cutting product architecture → `docs/ARCHITECTURE.md` and usually ADR;
- global UX/design rule → canonical design-system doc/ADR;
- sequence → `docs/ROADMAP.md`;
- verified implementation/blocker → `docs/CURRENT_STATE.md`;
- development runtime/process rule → `AGENTS.md`, `CODEX.md`, or `docs/workflow/`.

Do not promote brainstorms, temporary hypotheses, or one-off private data.

## Release

Promote `staging` to `main` only after explicit production authorization and required acceptance. Production DB changes remain gated by Issue #59 while it is open.
