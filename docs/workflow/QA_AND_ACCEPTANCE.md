# Carez QA and Acceptance

## Evidence classes

- Source inspection: implementation evidence only.
- Typecheck/build: compile/integration evidence only.
- Domain tests: calculation/lineage contract evidence.
- Database inspection: persistence/security evidence.
- Browser QA: rendered UI behavior evidence.

## UI acceptance

A UI issue is not accepted as fixed until the exact user-visible behavior is reproduced and then re-tested in a browser after the change.

For desktop shell work verify both states:

```text
OPEN:   [ app rail ][ context drawer ][ workspace ]
CLOSED: [ app rail ][ workspace ]
```

The permanent rail must retain its width and hit area when the context drawer closes.

## Data/domain acceptance

Changes touching geometry, assemblies, estimating, pricing, budget, production, or finance must verify deterministic calculations, tenant/company isolation, historical lineage, and mutation boundaries.

## Completion report

Record files changed, root cause, validation performed, browser verification where applicable, remaining risks, and git status/checkpoint.
