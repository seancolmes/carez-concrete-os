# ADR-024 — Precision Grid dual-theme application system

Status: Accepted
Date: 2026-09-15
Owner: 95 — UX & Design System
Design source: `docs/superpowers/specs/2026-09-15-carez-os-major-ui-ux-redesign-design.md`
Foundation implementation owner: Issue #63

## Context

Carez completed the prior dark shadcn replacement under Issue #44 and established source-owned shadcn/Base UI/Tailwind components, a compact top shell, and the integrated Takeoff workstation. The approved next direction is a major UX redesign that preserves all domain/data authority while replacing the dark-only presentation contract with one role-adaptive, project-aware Carez operating system.

The master visual language is **Precision Grid**. Industrial specialist and Refined operations are controlled workspace expressions of one token system, one component system, and one interaction language.

## Decision

### Visual foundation

Carez uses restrained, exact, construction-appropriate professional software. Typography, spacing, separators, luminance, and selection establish hierarchy before cards/shadows. Avoid generic SaaS cardification, glassmorphism, neon/AI gradients, giant rounded containers, excessive shadow, and decorative perpetual motion.

Primary UI typography is Inter Variable. IBM Plex Mono is selective technical/numeric typography. Quantities, money, rates, percentages, and dimensions use tabular numerals where alignment helps.

The base rhythm is 4 px micro / 8 px grid. Normal radii are about 4–6 px and larger bounded surfaces normally stop at 8 px. Elevation is reserved for genuine overlays such as menus, dialogs, popovers, and floating inspectors.

### Appearance

The preference contract is `light | dark | system`; System is the default. Light and dark use identical semantic responsibilities, component behavior, state language, and accessibility rules. Components are not forked by theme.

Semantic token families cover canvas/panel/raised surfaces, primary/secondary/muted text, default/strong borders, primary/selection/focus interactions, success/warning/error/info states, and density. Carez blue is restrained interaction/selection/focus identity and never substitutes for success, warning, error, or domain geometry meaning.

### Precision Slate color expression

The accepted Carez color direction is **Precision Slate**.

- Light and dark are equally first-class; neither is a secondary fallback.
- Dark mode uses a readable cool-slate workspace rather than near-black surfaces.
- The global shell/chrome is darker than the working surface so the workspace reads as the primary work area.
- Carez blue is moderately visible in primary actions, active navigation, selection, focus, and selected working context without becoming decorative page fill.
- Panels use subtle luminance separation plus crisp borders rather than relying on shadow.
- Normal text must meet WCAG AA contrast at minimum. Estimating, accounting, table, drawing, quantity, dimension, rate, cost, editable-field, table-header, and critical-state information should exceed that minimum where practical.
- Muted text remains visually secondary but must remain plainly readable.
- Semantic color is deliberate: blue for interaction/selection, green for success/complete, amber for attention/pending, red for blocked/error/destructive, and cyan/info for informational system state. Takeoff geometry colors remain domain colors rather than general chrome.
- Data grids and worksheets use clearly differentiated body/header surfaces, visible grid boundaries, restrained hover treatment, and explicit blue-tinted selection.

### Density

The root density contract is `default | compact | comfortable`. Workspace archetypes may constrain/override the baseline for readability and touch safety. Specialist workspaces remain denser than balanced operations/overview surfaces; mobile remains touch-first.

### Shell/project context

The approved end-state shell is role-adaptive with company role defaults plus user personalization, a compact Hybrid command shell, and a project context row only while a Job/Project is active. The hierarchy is global shell → project context → workspace header.

This ADR does not claim that shell implementation is complete. ADR-016 remains the implemented shell contract until the dedicated shell/navigation subproject is browser-accepted. No permanent global desktop left rail returns.

### Workspace/interaction

Carez standardizes Canvas, Worksheet, Operational, Record, and Overview archetypes. Desktop favors `select → inspect → act`; mobile favors `open → act → confirm`. Inspectors are persistent selection context, drawers/sheets are temporary secondary workflows, and dialogs are focused decisions/confirmations.

### Trust/accessibility/AI

The UI distinguishes user-entered, system-calculated, imported, AI-suggested, and issued/versioned authority. Provenance remains inspectable. Loading, empty, validation, saving, failed-save, warning, blocked, error, and success states remain distinct.

Shared components own keyboard operation, visible focus, accessible names/roles, state/error announcement, light/dark contrast, reduced motion, and non-gesture alternatives where applicable.

AI remains evidence-backed assistance. Humans remain authoritative for scope, means/methods, production assumptions, pricing, margin, budgets, approvals, and final estimates.

## Relationship to prior UI decisions

### ADR-015
ADR-024 supersedes the dark-first/default-dark theme contract, dark-only token assumptions, and one-density visual foundation. It retains source-owned shadcn/Base UI, continuous workspaces, restrained surfaces/radii/shadows, typography-led hierarchy, semantic/scarce color, content discipline, functional motion, reduced motion, and the ban on parallel design systems.

### ADR-016
ADR-024 owns the approved future shell architecture and visual/theme/density rules. ADR-016 remains the current implemented shell until its dedicated replacement slice is browser-accepted.

### ADR-019
Retain static-vs-interactive metric semantics and accessibility, but pointer-following perspective/3D tilt is no longer canonical. Interactive summaries may use restrained border/surface emphasis and at most a small vertical lift.

### ADR-020
ADR-020 remains authoritative for Takeoff/Condition workstation and domain invariants where not superseded by newer Takeoff/3D contracts. ADR-024 supersedes only application-wide theme, density, surface, and shell presentation rules. The active Takeoff module spec wins where it has already replaced older presentation details such as estimator-facing Split behavior.

### Issue #44
Issue #44 is completed historical implementation evidence. It is not reopened. Issue #63 begins the new redesign implementation sequence.

## Persistence

Theme and density preferences are device-local in this subproject; no database migration is required. System theme follows `prefers-color-scheme` live. Appearance is resolved before normal React hydration to avoid a forced-dark flash.

## Protected architecture

This is presentation/interaction architecture only. It does not change Supabase/PostgreSQL authority, RLS/tenant isolation, Job Spine/commercial lineage, server-authoritative calculations, immutable/versioned records, Production Quantity / Direct Cost / Sell separation, PDF/vector Takeoff authority, Condition lineage, or derived-3D verification boundaries.

## Tooling governance

UI UX Pro Max may provide design intelligence and implementation guidance. It is not runtime UI authority and does not become a parallel component system.

## Acceptance

The foundation is accepted only when canonical docs are reconciled; semantic light/dark tokens exist; Light/Dark/System preference persists and System follows OS changes; root density preference exists; Inter/IBM Plex Mono are wired correctly; automated validation passes; the matching staging deployment is READY; and authenticated browser QA verifies representative existing surfaces without claiming later shell/module slices complete.
