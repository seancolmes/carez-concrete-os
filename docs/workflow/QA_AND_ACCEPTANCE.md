# Carez QA and Acceptance

## Evidence classes

- Source inspection: implementation evidence only.
- Typecheck/build: compile/integration evidence only.
- Domain tests: calculation/lineage contract evidence.
- Database inspection: persistence/security evidence.
- Vercel runtime/build evidence: deployed application evidence.
- Browser QA: rendered user-visible behavior evidence.

## UI acceptance

A UI issue is not accepted as fixed until the exact user-visible behavior is reproduced and then re-tested in a browser after the change.

For the ADR-016 desktop shell verify:

```text
[ compact application menubar ]
[ contextual module pane ][ primary workspace ][ optional governed detail/properties pane ]
```

Required shell checks:

- no permanent global desktop left rail;
- no permanent second global navigation row;
- global categories open anchored keyboard-accessible menus from the compact menubar;
- contextual module panes remain inside their owning workspaces;
- mobile uses the accepted field-first drawer/sheet behavior where applicable.

For `/takeoff/[setId]`, preserve the ADR-020 accepted workstation contract: fixed-width independently collapsible left/right docked panes, dominant drawing surface, explicit 2D/3D/Split controls, and vertically resizable Quantity Worksheet. Normal docked side panes are not horizontally drag-resizable.

## Data/domain acceptance

Changes touching geometry, Concrete Conditions/modules, derived 3D, estimating, pricing, budget, production, or finance must verify deterministic calculations, identical 2D/3D/worksheet totals where applicable, tenant/company isolation, historical lineage, and mutation boundaries.

Database changes are applied to isolated QA through source-controlled migrations before any production promotion. Production migration work remains subject to the explicit production-bridge gate while Issue #59 is open.

## Completion report

Record the changed behavior/files, root cause when applicable, validation performed, Supabase/Vercel evidence when applicable, browser verification for rendered behavior, remaining risks, and final Git checkpoint.
