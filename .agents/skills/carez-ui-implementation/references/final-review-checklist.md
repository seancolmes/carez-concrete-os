# UI implementation review checklist

Use this only after the UI change is implemented.

- Hierarchy matches the approved direction; no design invention slipped into implementation.
- Existing workflow, links, actions, permissions, and data meaning remain intact.
- No duplicate global navigation, redundant sidebar, permanent inspector clutter, fake metric, or filler copy was added.
- Shared Carez components/tokens are reused where appropriate.
- Light/dark/system states remain coherent.
- Keyboard focus and accessible interaction remain usable.
- No clipping, overflow, or workspace loss at the target desktop size; check relevant responsive behavior.
- Motion is functional and reduced-motion safe.
- Browser QA states the exact route, interactions, and pass criteria.
