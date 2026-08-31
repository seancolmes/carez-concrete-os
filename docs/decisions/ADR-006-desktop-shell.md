# ADR-006 — Permanent Desktop App Rail

Status: Accepted

## Decision
At desktop width, the Carez primary app rail is permanent. Only the context drawer is transient/collapsible.

## Required layout

```text
OPEN:   [ permanent app rail ][ context drawer ][ workspace ]
CLOSED: [ permanent app rail ][ workspace ]
```

## Consequences
- Closing the context drawer may reclaim only the drawer width.
- Main content must never occupy or visually cover the permanent rail region.
- Mobile navigation may remain transient and is governed separately.
- Browser verification is required for shell acceptance; source inspection alone is insufficient.
