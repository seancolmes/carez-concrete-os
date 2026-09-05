# ADR-019 — Tactile metric card system

Status: Accepted
Date: 2026-09-05
Owner: 95 — UX & Design System
Related decisions: ADR-015, ADR-016, ADR-018
Implementation owner: Issue #44 while the Carez-wide shadcn conversion remains open

## Context

Compact operational metrics recur across Carez: Ready to move, Hard holds, Needs attention, Field active, Customers owe, Blocking work, Due next 7 days, Warnings, Cleared, and similar summary states. These are useful bounded objects, but repeated flat cards can make important actions feel visually inert while stronger animated card treatments can become decorative, misleading, or inconsistent with the dark professional workstation.

The accepted direction is Option A: subtle tactile depth only when a metric card is genuinely interactive. Read-only metrics remain visually quiet.

The 21st.dev Animated 3D Card shared during design review is an interaction reference, not a new runtime design system or an automatic source dependency. Any third-party source copied later must still satisfy ADR-015 licensing, accessibility, bundle-cost, technology-fit, and source-ownership requirements.

## Decision

Carez standardizes two related shared compositions:

- `CarezMetricCard` — read-only compact summary metric;
- `CarezActionMetricCard` — interactive metric that navigates, filters, opens a relevant workspace, or otherwise performs a meaningful action.

The visual structure may share typography, spacing, status treatment, and sizing, but motion must communicate interactivity rather than decorate every summary.

## CarezMetricCard

Use for metrics that only communicate current state.

Required behavior:

- no pointer-following tilt or faux 3D hover;
- compact dark graphite surface with restrained border/luminance separation;
- label + primary value + optional concise context only when that context helps a decision;
- tabular figures for quantities, money, percentages, and counts where appropriate;
- semantic color is sparse and state-driven;
- healthy/zero/default states remain visually quiet;
- no decorative gradient, glow, glass effect, oversized radius, or excessive shadow;
- no hover treatment that implies the card can be clicked.

## CarezActionMetricCard

Use only when the whole card is a legitimate interactive target.

Required behavior:

- the entire card is implemented as an accessible link/button/action target, not a non-semantic div with mouse handlers;
- subtle tactile depth on pointer hover/focus, normally limited to roughly 1.5–2 degrees maximum perspective tilt and about 1–2 px vertical lift;
- border/surface/shadow may gain restrained emphasis during hover/focus;
- interaction should generally resolve in approximately 140–180 ms and remain within ADR-015 motion limits;
- keyboard focus must receive an equivalent clear affordance rather than making the effect mouse-only;
- touch/mobile uses a compact pressed/active state rather than simulated persistent hover tilt;
- `prefers-reduced-motion` removes perspective/lift and falls back to simple border/surface/focus treatment;
- no sound is tied to hover motion; interaction audio, if enabled later, remains governed by ADR-016 and only applies to committed actions;
- no exaggerated parallax, wobble, neon glow, broad gradient, or perpetual animation.

## Semantic treatment

Motion is consistent; color communicates meaning.

Examples:

- Ready to move / Cleared: restrained success accent when useful;
- Hard holds / Blocking work: destructive accent when nonzero/actionable;
- Needs attention / Due next 7 days / Warnings: warning or destructive treatment according to actual severity;
- Field active: neutral active-state treatment unless a domain exception exists;
- Customers owe: neutral by default; overdue/risk state may introduce warning/destructive treatment.

Do not flood the whole card with semantic color. Prefer small value/icon/border/status emphasis.

## Usage rule

The metric-card system does not override ADR-015's surface hierarchy. Cards remain reserved for genuinely bounded objects or compact summaries. Do not turn every field, section, status, or table cell into a card merely because the shared component exists.

Interactive motion is a promise of interaction. If a metric does not navigate, filter, open detail, or perform another meaningful action, use `CarezMetricCard`, not `CarezActionMetricCard`.

## Source and implementation rule

Implementation belongs in the source-owned Carez shadcn/Base UI/Tailwind system and should reuse the existing Carez Motion language. Do not add a new animation/component framework solely to reproduce this effect unless bundle/maintenance/accessibility review demonstrates a clear benefit.

Likely first consumers include Dashboard/Today, Projects operational summaries, Schedule summary metrics, Resource Readiness, Owner Reports, Field/production summary surfaces, and finance/cash summaries where the metric-card pattern is actually appropriate.

## Acceptance

The shared metric-card compositions are implemented only when:

- source-owned components exist in the Carez shared component layer;
- interactive and static variants are semantically distinct;
- pointer, keyboard, touch, and reduced-motion behavior are coherent;
- semantic state treatment remains restrained;
- representative routes consume the shared components instead of page-local copies;
- typecheck/tests/build pass;
- authenticated browser QA confirms the motion is polished rather than distracting on the stable staging line.
