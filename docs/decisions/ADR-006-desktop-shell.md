# ADR-006 — Permanent Desktop App Rail

Status: Superseded by ADR-016

## Historical decision

At desktop width, the Carez primary app rail was permanent and only the context drawer was transient/collapsible.

Historical layout:

```text
OPEN:   [ permanent app rail ][ context drawer ][ workspace ]
CLOSED: [ permanent app rail ][ workspace ]
```

## Supersession

ADR-016 replaces this shell architecture with:

```text
[ compact application header ]
[ global category navigation + animated dropdown panels ]
[ contextual module pane ][ primary workspace ][ optional governed detail/properties pane ]
```

The global desktop left rail is no longer part of the accepted target. Contextual module panes remain allowed and are distinct from global application navigation.

This file remains as historical decision evidence only. Browser verification remains required before the ADR-016 shell is considered implemented/accepted.
