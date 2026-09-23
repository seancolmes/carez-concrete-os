# Staging release gate checklist

- Branch: `staging`.
- Working tree: clean for the intended release; no unrelated dirty work.
- Intended local commits: identified and reviewable.
- Validation: targeted checks complete; `pnpm check` for the release checkpoint unless a documented blocker makes that inappropriate.
- Migrations: reviewed for tenant/RLS/data safety and intended staging apply path.
- Deployment path: known; no duplicate or contradictory trigger assumed.
- External state: follow `docs/workflow/EXTERNAL_STATE_BOUNDARY.md`; remote reads do not authorize writes, and release `GO` is readiness only.
- Production: untouched.
- Result: `GO` only when every applicable item has evidence; otherwise `BLOCKED` with the exact blocker.
