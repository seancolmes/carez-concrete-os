---
name: carez-ui-implementation
description: Implement an already-decided Carez Concrete OS UI/UX change. Use only when the request states an approved/accepted direction or gives a concrete implementation target and behavior to preserve. Covers bounded Carez route, shell, navigation, workspace, component, theme, responsive, accessibility, or interaction implementation. Preserve domain behavior, Indigo Harbor, shared ownership, and light/dark/system behavior. Do not select this skill for open-ended "redesign", "make it better", or brainstorming requests that still need a design decision.
---

# Carez UI Implementation

Apply an approved Carez UI direction as a bounded code change.

## Workflow

1. Start with the named route/component and required direct dependencies only. Project instructions are already loaded; do not reread `AGENTS.md` or `CODEX.md`.
2. Read the relevant ADR-025 section only when the task changes presentation language, shell/navigation structure, shared workspace primitives, or when hierarchy/ownership is genuinely ambiguous. Do not reopen ADR-025 for a small approved local styling edit.
3. Read only the relevant section of `docs/design-system/CAREZ_COMPONENT_PACK.md` when shared Carez primitives are actually involved.
4. For Takeoff UI, also use `carez-takeoff-change`; presentation work must not override Takeoff authority.
5. Implement the smallest coherent change. Preserve data sources, permissions, actions, links, calculations, and workflow semantics unless the task explicitly changes them.
6. Validate proportionally under the already-loaded `CODEX.md`; UI work needs focused local browser QA before acceptance.

## UI constraints

- Use Indigo Harbor semantic tokens; do not introduce a competing palette or local design system.
- Preserve the accepted Command Deck / Spatial Blueprint balance appropriate to the surface.
- Prefer thin hierarchy, purposeful separators, compact controls, and open workspace over nested cards and permanent panels.
- Use motion only to communicate state, focus, continuity, or change; respect reduced motion.
- Keep light, dark, and system first-class.
- Reuse source-owned Carez components before introducing new primitives.
- Do not install a component library for one pattern.

## Progressive detail

For ordinary approved implementation, begin with no progressive reference file. Never load `references/final-review-checklist.md` before implementation; it exists only for the final implementation review or browser-QA planning phase.
