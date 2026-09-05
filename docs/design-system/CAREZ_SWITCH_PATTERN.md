# Carez Switch pattern

Status: Accepted design-system contract
Owner: 95 — UX & Design System
Related: ADR-014, ADR-015, ADR-020, `CAREZ_COMPONENT_PACK.md`, Issue #57

## Role

Carez uses a source-owned shadcn/Base UI `Switch` for persistent boolean settings such as Condition module inclusion and boolean Condition properties. `Toggle` and `Toggle Group` remain reserved for pressed/unpressed workstation actions and view modes.

## Composition

Use the Carez-owned `Switch` primitive and, when a visible property/module label belongs with the control, the Carez-owned `LabeledSwitch` composition.

The label is programmatically associated with the switch and is clickable. Optional helper text may communicate the current consequence, such as `Included in this Condition` or `Excluded from this Condition`, when that state changes the surrounding editor.

Visual/layout reference: `https://21st.dev/@shadcnspace/components/with-label`. This is an interaction/presentation reference only; Carez does not introduce a second runtime design system or copy external styling verbatim.

## State language

- **Off:** neutral graphite track with the thumb at the starting position.
- **On:** Carez semantic `success` green track with the thumb at the ending position.
- Position remains the non-color state cue; color reinforces the distinction and is not the only indication.
- Disabled state uses reduced emphasis and preserves the current value.
- Focus remains visible and keyboard operation remains native to the Base UI switch primitive.

Green is permitted here because the switch is communicating an affirmative included/enabled state. It must not become decorative accent color elsewhere.

## Condition Properties behavior

- Module include/exclude controls use the labeled Switch pattern.
- Boolean module fields use the same pattern.
- When a module is off, its editable body collapses instead of leaving a disabled field grid visible.
- The switch changes only the local Condition draft until the owning workflow's authoritative Save/Recalculate transaction persists it; the visual control must not bypass server-authoritative calculation or Condition lineage.

## Acceptance

A converted surface is accepted only when off/on states are immediately distinguishable at normal desktop zoom, labels activate the associated control, keyboard/focus behavior remains accessible, locked/disabled states remain correct, relevant tests/build pass, and the rendered result is browser-verified on canonical staging.
