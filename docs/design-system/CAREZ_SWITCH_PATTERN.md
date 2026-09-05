# Carez Switch pattern

Status: Accepted design-system contract
Owner: 95 — UX & Design System
Related: ADR-014, ADR-015, ADR-020, `CAREZ_COMPONENT_PACK.md`, Issue #57

## Role

Carez uses a source-owned shadcn/Base UI `Switch` for persistent boolean settings such as Condition module inclusion and boolean Condition properties. `Toggle` and `Toggle Group` remain reserved for pressed/unpressed workstation actions and view modes.

## Composition

Use the Carez-owned `Switch` primitive and, when a visible property/module label belongs with the control, the Carez-owned `LabeledSwitch` composition.

The label is programmatically associated with the switch and is clickable. Optional helper text may communicate the current consequence, such as `Included in this Condition` or `Excluded from this Condition`, when that state changes the surrounding editor.

The canonical visual and interaction reference is the official shadcn/ui Base UI Switch documentation:

`https://ui.shadcn.com/docs/components/base/switch`

Carez remains source-owned and may adapt spacing/density to the workstation, but it must preserve the current shadcn Base Nova state language rather than inventing a separate switch palette.

## State language

- **Off:** neutral `input`/graphite track with the thumb at the starting position.
- **On:** high-contrast `primary` track with the thumb at the ending position; in the dark application theme the checked thumb uses `primary-foreground` for the standard shadcn contrast relationship.
- Position remains the non-color state cue; track/thumb contrast reinforces the distinction.
- Disabled state uses reduced emphasis and preserves the current value.
- Focus remains visible and keyboard operation remains native to the Base UI switch primitive.
- Switch state does **not** use semantic success green by default. Enabled/true is a boolean state, not a success outcome. `success` remains reserved for actual successful/ready business state under ADR-015.

## Condition Properties behavior

- Module include/exclude controls use the labeled Switch pattern.
- Boolean module fields use the same pattern.
- The surrounding labeled row remains neutral; checked state is communicated by the Switch itself rather than tinting the entire property row green.
- When a module is off, its editable body collapses instead of leaving a disabled field grid visible.
- The switch changes only the local Condition draft until the owning workflow's authoritative Save/Recalculate transaction persists it; the visual control must not bypass server-authoritative calculation or Condition lineage.

## Acceptance

A converted surface is accepted only when off/on states are immediately distinguishable at normal desktop zoom, the rendered control follows the official shadcn/Base UI state treatment, labels activate the associated control, keyboard/focus behavior remains accessible, locked/disabled states remain correct, relevant tests/build pass, and the rendered result is browser-verified on canonical staging.
