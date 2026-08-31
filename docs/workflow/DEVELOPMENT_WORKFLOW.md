# Carez Development Workflow

1. Read canonical docs.
2. Identify one coherent objective.
3. Inspect current implementation.
4. Reproduce/understand the issue or gap.
5. Identify root cause from evidence.
6. Make the smallest coherent change.
7. Preserve data/domain lineage and unrelated behavior.
8. Run relevant tests, typecheck, and build.
9. Browser-verify rendered UI changes.
10. Update canonical docs when approved behavior or verified state changed.
11. Leave a clean resumable Git checkpoint.

Use GitHub issues for work to be done, PRs for implementation, module specs/ADRs for product truth, and `CURRENT_STATE.md` for verified implementation status.
