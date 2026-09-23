---
name: carez-ui-implementation
description: Implement approved Carez Concrete OS UI/UX changes without reopening settled product or design decisions. Use for Carez route, shell, navigation, workspace, component, theme, responsive, accessibility, or interaction changes after the desired direction is known. Preserve Carez domain behavior, Indigo Harbor, ADR-025 hierarchy, shared component ownership, light/dark/system behavior, and concrete-native workstation density. Do not use this skill to brainstorm multiple design directions; resolve design direction first, then invoke this skill for bounded implementation.
---

# Carez UI Implementation

Apply an approved Carez UI direction as a bounded code change.

## Workflow

1. Read `AGENTS.md` and `CODEX.md`.
2. Read only the named route/component and required direct dependencies.
3. If the task changes Carez presentation language, shell, shared workspace primitives, or a specialist workstation, read `docs/decisions/ADR-025-carez-operations-workspace.md`.
4. If shared Carez primitives are involved, read only the relevant section of `docs/design-system/CAREZ_COMPONENT_PACK.md`.
5. For Takeoff UI, also invoke/use `carez-takeoff-change`; Takeoff domain authority is not owned by this skill.
6. Implement the smallest coherent change. Preserve data sources, permissions, actions, links, calculations, and workflow semantics unless the task explicitly changes them.
7. Validate proportionally under `CODEX.md`; UI work always needs focused local browser QA before acceptance.

## UI constraints

- Use Indigo Harbor semantic tokens; do not introduce a competing palette or local design system.
- Preserve the accepted Command Deck / Spatial Blueprint balance appropriate to the surface.
- Prefer thin hierarchy, purposeful separators, compact controls, and open workspace over nested cards and permanent panels.
- Use motion only to communicate state, focus, continuity, or change; respect reduced motion.
- Keep light, dark, and system first-class.
- Reuse source-owned Carez components before introducing new primitives.
- Do not install a component library for one pattern.

## Progressive detail

Read `references/implementation-checklist.md` only when preparing the final implementation review or browser-QA plan.
