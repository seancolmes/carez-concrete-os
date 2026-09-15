# Carez OS UI Token Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the approved Precision Grid UX authority and the source-owned appearance/token foundation for first-class light, dark, and system themes plus user density preference, without migrating the shell or module workspaces yet.

**Architecture:** ADR-024 becomes the durable Carez UI/UX authority. A small pure appearance contract owns theme/density preference values and the pre-hydration boot script; a root client provider owns live system-theme changes and local persistence; `app/globals.css` owns semantic Precision Grid tokens for both themes and density baselines; Settings exposes the preferences using the existing Base UI/shadcn source components. No new runtime dependency, database migration, navigation rewrite, or module redesign is part of this subproject.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5.9, Tailwind CSS v4, source-owned shadcn/Base UI components, CSS custom properties/OKLCH, `next/font/google`, Node `node:test`, Supabase application architecture unchanged.

**Spec:** `docs/superpowers/specs/2026-09-15-carez-os-major-ui-ux-redesign-design.md`  
**Implementation owner:** GitHub Issue #63 — `Carez OS major UI/UX redesign — Subproject 1 canonical authority + token foundation`

## Global Constraints

- Work from current `staging`; `main` remains production only.
- Preserve Supabase/PostgreSQL authority, RLS/tenant isolation, server-authoritative calculations, immutable/versioned commercial records, Job Spine lineage, Production Quantity / Direct Cost / Sell separation, and Takeoff 2D/vector authority.
- Preserve source-owned shadcn/Base UI/Tailwind v4. Do not introduce `next-themes`, another component library, or another design system.
- Issue #44 is completed historical evidence and must remain closed. Do not reopen or repurpose it; Issue #63 owns this subproject.
- Implement only Subproject 1. Do not implement role-adaptive navigation, the Hybrid command shell, project context bar, Today/Project/Takeoff reference redesigns, or module migration waves.
- True appearance modes are `light | dark | system`. Default preference is `system`.
- Density preferences are `default | compact | comfortable`. They establish root semantic baselines only; later workspace archetypes may constrain/override density safely.
- Inter Variable remains primary UI typography. IBM Plex Mono becomes the technical/numeric mono family. Do not convert ordinary UI text to mono.
- Carez blue is a restrained interaction/selection/focus token. Keep existing generic `primary` treatment neutral enough that this foundation does not flood legacy routes with blue before their redesign slices.
- Do not touch `app/takeoff-v3.css` speculatively. If stable-staging light-theme QA proves an active selector there causes a real defect, record the exact route/selector as an Issue #63 acceptance blocker and make only the bounded corrective change required to pass acceptance.
- Source/build success is not rendered acceptance. Issue #63 and `CURRENT_STATE.md` are not marked accepted until the stable staging deployment is browser-verified.

---

## File Map

### Create

- `docs/decisions/ADR-024-precision-grid-dual-theme-application-system.md` — durable UI/UX authority and supersession map.
- `lib/ui/appearance.ts` — pure theme/density contract plus pre-hydration appearance boot script.
- `components/carez/appearance-provider.tsx` — client context for persistence and live system-theme changes.
- `components/settings/AppearanceSettings.tsx` — Settings controls for theme and density.
- `tests/ui-authority-contract.test.ts` — canonical-document authority regression test.
- `tests/ui-appearance.test.ts` — pure appearance preference behavior tests.
- `tests/ui-token-contract.test.ts` — dual-theme/token/font/layout integration contract test.
- `tests/ui-settings-appearance.test.ts` — Settings appearance integration source contract.

### Modify

- `docs/superpowers/specs/2026-09-15-carez-os-major-ui-ux-redesign-design.md` — mark written-spec review complete.
- `docs/README.md` — make ADR-024 the active UI visual/theme authority.
- `CODEX.md` — replace the dark-only UI authority rule with ADR-024 dual-theme authority while preserving the current shell/Takeoff boundaries.
- `docs/decisions/ADR-015-dark-minimal-shadcn-application-system.md` — mark theme/visual portions superseded by ADR-024 while retaining compatible source-ownership/content/motion rules.
- `docs/decisions/ADR-016-top-navigation-shell-and-component-pack.md` — document the transition boundary: current shell remains implemented until Subproject 2; ADR-024 owns visual/theme/density and future shell architecture.
- `docs/decisions/ADR-019-tactile-metric-card-system.md` — remove pointer-following perspective tilt from the canonical interaction requirement; retain static/action distinction and accessibility semantics.
- `docs/decisions/ADR-020-integrated-takeoff-workstation-and-precision-cursor.md` — keep Takeoff authority, point presentation/theme/shell styling to ADR-024/current module spec.
- `docs/design-system/CAREZ_COMPONENT_PACK.md` — replace dark-only foundation language with Precision Grid dual-theme/density contract.
- `components/carez/index.ts` — export the appearance provider/hook.
- `app/globals.css` — Precision Grid semantic tokens, light/dark palettes, density and motion tokens, IBM Plex Mono mapping.
- `app/layout.tsx` — remove forced dark class, add IBM Plex Mono, appearance boot script, provider, hydration-safe root.
- `app/settings/page.tsx` — expose Appearance settings section.
- `docs/CURRENT_STATE.md` — update only after automated validation, deployment, browser QA, and user acceptance pass.

### Explicitly unchanged in this subproject

- `components/AppShell.tsx` navigation architecture.
- `app/takeoff-v3.css` unless an observed light-theme acceptance defect proves a bounded fix is required.
- Domain/module calculations, Supabase schema/migrations, RLS, commercial records, Takeoff geometry, 3D projection authority.
- `package.json` / `pnpm-lock.yaml` unless execution discovers an unrelated existing lock drift; no new dependency is authorized here.

---

## Task 1: Promote Precision Grid into canonical UI authority

**Files:**
- Create: `tests/ui-authority-contract.test.ts`
- Create: `docs/decisions/ADR-024-precision-grid-dual-theme-application-system.md`
- Modify: `docs/superpowers/specs/2026-09-15-carez-os-major-ui-ux-redesign-design.md`
- Modify: `docs/README.md`
- Modify: `CODEX.md`
- Modify: `docs/decisions/ADR-015-dark-minimal-shadcn-application-system.md`
- Modify: `docs/decisions/ADR-016-top-navigation-shell-and-component-pack.md`
- Modify: `docs/decisions/ADR-019-tactile-metric-card-system.md`
- Modify: `docs/decisions/ADR-020-integrated-takeoff-workstation-and-precision-cursor.md`
- Modify: `docs/design-system/CAREZ_COMPONENT_PACK.md`

### Interface contract

Consumes the approved umbrella design and produces one durable authority graph:

```text
ADR-024 Precision Grid
├── owns visual/theme/token/density architecture
├── owns approved future shell direction at architecture level
├── incorporates compatible ADR-015 principles
├── leaves ADR-016 as current implemented shell until Subproject 2
├── amends ADR-019 interaction motion
└── preserves ADR-020 Takeoff/domain authority
```

Issue #44 remains closed historical evidence. Issue #63 owns implementation.

### Steps

- [ ] **1. Add the failing canonical-authority test.**

Create `tests/ui-authority-contract.test.ts`:

```ts
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');

const ADR_024 = 'docs/decisions/ADR-024-precision-grid-dual-theme-application-system.md';

test('Precision Grid is the canonical Carez UI authority', () => {
  assert.equal(existsSync(new URL(ADR_024, root)), true);

  const adr024 = read(ADR_024);
  const readme = read('docs/README.md');
  const codex = read('CODEX.md');
  const pack = read('docs/design-system/CAREZ_COMPONENT_PACK.md');
  const adr015 = read('docs/decisions/ADR-015-dark-minimal-shadcn-application-system.md');
  const adr016 = read('docs/decisions/ADR-016-top-navigation-shell-and-component-pack.md');
  const adr019 = read('docs/decisions/ADR-019-tactile-metric-card-system.md');
  const adr020 = read('docs/decisions/ADR-020-integrated-takeoff-workstation-and-precision-cursor.md');
  const design = read('docs/superpowers/specs/2026-09-15-carez-os-major-ui-ux-redesign-design.md');

  assert.match(adr024, /Precision Grid/i);
  assert.match(adr024, /light \| dark \| system/i);
  assert.match(adr024, /Issue #63/);
  assert.match(readme, /ADR-024/);
  assert.match(codex, /ADR-024/);
  assert.match(pack, /Precision Grid/);
  assert.match(pack, /dual-theme|light.*dark/i);
  assert.match(adr015, /ADR-024/);
  assert.match(adr016, /ADR-024/);
  assert.match(adr019, /ADR-024/);
  assert.match(adr020, /ADR-024/);
  assert.doesNotMatch(design, /pending written-spec review/i);
});
```

- [ ] **2. Run the new test and verify that it fails for the expected reason.**

Run:

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/ui-authority-contract.test.ts
```

Expected: FAIL because ADR-024 does not exist yet and the current authority docs still point at the dark-only system.

- [ ] **3. Create ADR-024 with the durable decision below.**

Create `docs/decisions/ADR-024-precision-grid-dual-theme-application-system.md` with this content:

```md
# ADR-024 — Precision Grid dual-theme application system

Status: Accepted
Date: 2026-09-15
Owner: 95 — UX & Design System
Design source: `docs/superpowers/specs/2026-09-15-carez-os-major-ui-ux-redesign-design.md`
Foundation implementation owner: Issue #63

## Context

Carez completed the dark shadcn replacement under Issue #44 and established source-owned shadcn/Base UI/Tailwind components, a compact top shell, and the integrated Takeoff workstation. The next approved product direction is a major UX redesign that preserves all domain/data authority while replacing the dark-only presentation contract with one role-adaptive, project-aware Carez operating system.

The approved master visual language is **Precision Grid**. It has two controlled workspace expressions — Industrial specialist for dense technical work and Refined operations for scan/decision work — but remains one token system, one component system, and one interaction language.

## Decision

### Visual foundation

Carez uses Precision Grid: restrained, exact, modern professional software with typography, spacing, separators, luminance, and selection doing most hierarchy work. Ordinary surfaces do not become floating card walls. Glassmorphism, neon/AI-gradient decoration, giant rounded containers, excessive shadow, and perpetual decorative motion remain outside the application language.

Typography uses Inter Variable for normal UI and IBM Plex Mono selectively for technical identifiers/aligned technical data. Financial values, quantities, rates, percentages, and dimensions use tabular numerals where alignment benefits work.

The base spacing rhythm is 4 px micro / 8 px grid. Normal radii are approximately 4–6 px and large bounded surfaces normally stop at 8 px. Elevation is reserved for real overlays such as menus, dialogs, popovers, and floating inspectors.

### Theme

Light, Dark, and System are first-class user preferences. System is the default preference. Light and dark use the same semantic hierarchy, states, components, and accessibility behavior; components are not duplicated by theme.

The application uses semantic tokens for canvas/panel/raised surfaces, primary/secondary/muted text, default/strong borders, primary/selection/focus interactions, success/warning/error/info states, and workspace density. Carez blue is restrained interaction/selection/focus identity and does not replace success, warning, error, or domain geometry semantics.

### Density

Carez uses workspace-adaptive density. The root preference contract is `default | compact | comfortable`; workspace archetypes may constrain or override that baseline to remain safe and readable. Takeoff/Estimating remain dense specialist workspaces; Projects/CRM/Finance and overview surfaces may use more balanced compositions; mobile remains touch-first.

### Shell and project context

The approved end-state shell is role-adaptive with company role defaults plus user personalization, a compact Hybrid command shell, and a project context row only while a Job/Project is active. The global shell → project context → workspace header hierarchy is the target architecture.

This ADR does not claim that shell implementation is complete. ADR-016 remains the current implemented shell contract until the dedicated shell/navigation subproject replaces it. New work must not deepen ADR-016-specific presentation in ways that conflict with the approved end-state.

### Workspace and interaction model

Carez standardizes Canvas, Worksheet, Operational, Record, and Overview workspace archetypes. Desktop favors `select → inspect → act`; mobile favors `open → act → confirm`. Inspectors are persistent selection context, drawers/sheets are temporary secondary workflows, and dialogs are reserved for focused decisions/confirmations.

### State, trust, accessibility, and AI

The UI distinguishes user-entered, system-calculated, imported, AI-suggested, and issued/versioned authority. Provenance remains inspectable. Loading, empty, validation, saving, failed-save, warning, blocked, error, and success states remain distinct. User work is preserved on recoverable save/network errors.

Accessibility is part of shared component contracts: keyboard operation, visible focus, accessible names/roles, state/error announcement, light/dark contrast, reduced motion, and non-gesture alternatives are required where applicable.

AI remains evidence-backed assistance. Humans remain authoritative for scope, means/methods, production assumptions, pricing, margin, budgets, approvals, and final estimates.

## Relationship to prior UI decisions

### ADR-015

ADR-024 supersedes ADR-015's dark-first/default-dark theme contract, dark-only token assumptions, and one-density visual foundation. ADR-024 incorporates and retains ADR-015's source-owned shadcn/Base UI model, continuous-workspace preference, restrained radii/shadows, typography-led hierarchy, semantic/scarce color, content discipline, functional motion, reduced-motion requirement, and prohibition on a parallel design system.

### ADR-016

ADR-024 supersedes ADR-016 as the approved future shell architecture and owns visual/theme/density rules. ADR-016 remains the current implemented shell contract until the dedicated shell/navigation implementation slice lands and is browser-accepted. No permanent global desktop left rail is reintroduced.

### ADR-019

ADR-024 retains the distinction between static metric summaries and genuinely interactive metric actions, but supersedes pointer-following perspective/3D tilt as a canonical interaction requirement. Interactive metric summaries may use restrained border/surface emphasis and at most a small vertical lift when appropriate; keyboard/touch/reduced-motion equivalence remains mandatory.

### ADR-020

ADR-020 remains authoritative for Takeoff/Condition workstation and domain invariants where not superseded by newer module/3D contracts. ADR-024 supersedes only application-wide theme, density, surface, and shell presentation rules. The current Takeoff module spec remains authoritative where it has already superseded older presentation details such as estimator-facing Split behavior.

### Issue #44

Issue #44 is completed historical implementation evidence for the prior dark shadcn migration. It is not reopened. Issue #63 begins the new redesign implementation sequence.

## Appearance persistence

The foundation stores theme and density preferences device-locally. No database migration is required in this subproject. A later product decision may add cross-device preference sync without changing the semantic theme/density contract.

System theme follows `prefers-color-scheme` live. Appearance is applied before normal React hydration so a saved Light/Dark preference does not flash a forced dark frame.

## Protected architecture

This decision changes presentation/interaction architecture only. It does not change Supabase/PostgreSQL authority, RLS/tenant isolation, Job Spine/commercial lineage, server-authoritative calculations, immutable/versioned records, Production Quantity / Direct Cost / Sell separation, PDF/vector Takeoff authority, Condition lineage, or derived-3D verification boundaries.

## Tooling governance

UI UX Pro Max may be used as design intelligence and implementation guidance. It is not runtime UI authority and does not become a parallel component system. Carez canonical docs, source-owned components, module contracts, and architecture invariants remain authoritative.

## Acceptance

The foundation is accepted only when canonical docs are reconciled, dual-theme semantic tokens are present, Light/Dark/System preference persists and System reacts to OS changes, root density preference is represented, Inter/IBM Plex Mono are wired correctly, automated validation passes, the matching staging deployment is READY, and authenticated browser QA verifies representative existing surfaces without claiming later shell/module redesign work complete.
```

- [ ] **4. Reconcile the existing authority docs without pretending later subprojects are implemented.**

Apply these exact authority statements:

`docs/README.md` → replace the current `## UI authority` paragraph with:

```md
## UI authority

ADR-024 owns the Precision Grid visual/theme/token/density architecture and the approved end-state Carez OS interaction direction. ADR-016 remains the current implemented desktop-shell contract until the dedicated shell/navigation subproject replaces it. ADR-020 plus the active Takeoff module spec remain authoritative for Takeoff/workstation/domain invariants. Shared UI belongs in `design-system/CAREZ_COMPONENT_PACK.md`; modules must not create competing design systems or revive legacy presentation layers.
```

`CODEX.md` → replace the existing UI-authority preserve bullet with:

```md
- UI authority: ADR-024 + `docs/design-system/CAREZ_COMPONENT_PACK.md`; ADR-016 remains the implemented shell until its dedicated replacement slice, and ADR-020/current Takeoff module contracts remain authoritative for Takeoff invariants. Preserve true light/dark/system semantic tokens; do not revive legacy B2 styling, a permanent global desktop left rail, compatibility UI layers, hard-coded alternate palettes outside governed semantic tokens, or a second component system.
```

`ADR-015` → change the status line to:

```md
Status: Accepted principles, theme/visual foundation superseded by ADR-024
```

and insert after the header metadata:

```md
ADR-024 supersedes this ADR's dark-first/default-dark theme contract, dark-only token assumptions, and one-density visual foundation. Its source-owned shadcn/Base UI architecture, continuous-workspace preference, restrained surface/content discipline, semantic/scarce color, functional motion, and anti-parallel-design-system rules remain incorporated by ADR-024.
```

`ADR-016` → keep `Status: Accepted` and add after the header metadata:

```md
Transition under ADR-024: this ADR remains the current implemented shell contract until the dedicated role-adaptive Hybrid command-shell/project-context subproject is implemented and browser-accepted. ADR-024 is already authoritative for visual theme, token, density, and the approved end-state shell architecture. No permanent global desktop left rail returns.
```

`ADR-019` → change the status line to:

```md
Status: Accepted pattern, motion treatment amended by ADR-024
```

replace the perspective/tilt requirement in `CarezActionMetricCard` with:

```md
- no pointer-following perspective/3D tilt; interactive cards may use restrained border/surface emphasis and at most about 1 px vertical lift when it materially clarifies clickability;
- interaction should generally resolve in approximately 140–180 ms and remain within the Precision Grid functional-motion contract;
```

and add:

```md
ADR-024 is authoritative when any older tactile-motion wording conflicts with Precision Grid.
```

`ADR-020` → keep it Accepted and add after metadata:

```md
Presentation transition: ADR-024 supersedes application-wide theme, token, density, and shell styling. This ADR remains authoritative for integrated Takeoff/workstation/domain invariants where not superseded by the current Takeoff module/3D contracts.
```

`docs/design-system/CAREZ_COMPONENT_PACK.md` → replace the dark-only foundation sentence with:

```md
All shared Carez components use the ADR-024 Precision Grid semantic token system, first-class light/dark themes, source-owned React code, accessible keyboard/focus behavior, restrained radii, workspace-adaptive density, and functional motion. A module may choose the specialist or operations workspace expression, but neither becomes a separate theme or component library.
```

and add this section before the numbered component list:

```md
## Precision Grid foundation

Shared components consume semantic application tokens rather than hard-coded light/dark palettes. Required semantic families include surface canvas/panel/raised, primary/secondary/muted text, default/strong borders, primary/selection/focus interactions, success/warning/error/info states, and density control-height/row-height/workspace-gap.

Appearance preference is `light | dark | system`; System is default. Root density preference is `default | compact | comfortable`. Workspace archetypes may constrain density to preserve readability and touch safety.

Primary UI typography is Inter Variable. IBM Plex Mono is reserved for technical identifiers/aligned technical data where mono materially helps; tabular figures remain the default for quantities, money, rates, percentages, and dimensions.
```

`docs/superpowers/specs/2026-09-15-carez-os-major-ui-ux-redesign-design.md` → change status to:

```md
**Status:** Approved architectural design; implementation decomposed by subproject
```

and replace the final pending-review sentence with:

```md
This design is the approved architectural umbrella. Implementation proceeds through independently planned/verified subprojects beginning with Issue #63 — Canonical authority + token foundation.
```

- [ ] **5. Run the authority test again.**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/ui-authority-contract.test.ts
```

Expected: PASS.

- [ ] **6. Commit Task 1.**

```bash
git add tests/ui-authority-contract.test.ts \
  docs/decisions/ADR-024-precision-grid-dual-theme-application-system.md \
  docs/superpowers/specs/2026-09-15-carez-os-major-ui-ux-redesign-design.md \
  docs/README.md CODEX.md \
  docs/decisions/ADR-015-dark-minimal-shadcn-application-system.md \
  docs/decisions/ADR-016-top-navigation-shell-and-component-pack.md \
  docs/decisions/ADR-019-tactile-metric-card-system.md \
  docs/decisions/ADR-020-integrated-takeoff-workstation-and-precision-cursor.md \
  docs/design-system/CAREZ_COMPONENT_PACK.md
git commit -m "docs: establish Precision Grid UI authority"
```

---

## Task 2: Add the appearance preference contract and live provider

**Files:**
- Create: `tests/ui-appearance.test.ts`
- Create: `lib/ui/appearance.ts`
- Create: `components/carez/appearance-provider.tsx`
- Modify: `components/carez/index.ts`

### Interface contract

```ts
type CarezThemePreference = 'light' | 'dark' | 'system';
type CarezResolvedTheme = 'light' | 'dark';
type CarezDensityPreference = 'default' | 'compact' | 'comfortable';
```

Storage remains device-local in this subproject:

```text
carez.theme
carez.density
```

Root DOM state:

```text
data-theme-preference="light|dark|system"
data-theme="light|dark"
data-density="default|compact|comfortable"
class="dark" only when resolved theme is dark
style.colorScheme="light|dark"
```

### Steps

- [ ] **1. Add failing pure behavior tests.**

Create `tests/ui-appearance.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CAREZ_APPEARANCE_BOOT_SCRIPT,
  CAREZ_DENSITY_STORAGE_KEY,
  CAREZ_THEME_MEDIA_QUERY,
  CAREZ_THEME_STORAGE_KEY,
  normalizeDensityPreference,
  normalizeThemePreference,
  resolveThemePreference,
} from '../lib/ui/appearance.ts';

test('theme preferences normalize to system unless explicitly valid', () => {
  assert.equal(normalizeThemePreference('light'), 'light');
  assert.equal(normalizeThemePreference('dark'), 'dark');
  assert.equal(normalizeThemePreference('system'), 'system');
  assert.equal(normalizeThemePreference('sepia'), 'system');
  assert.equal(normalizeThemePreference(null), 'system');
});

test('density preferences normalize to default unless explicitly valid', () => {
  assert.equal(normalizeDensityPreference('default'), 'default');
  assert.equal(normalizeDensityPreference('compact'), 'compact');
  assert.equal(normalizeDensityPreference('comfortable'), 'comfortable');
  assert.equal(normalizeDensityPreference('dense'), 'default');
  assert.equal(normalizeDensityPreference(undefined), 'default');
});

test('system theme resolves against OS preference while explicit modes ignore it', () => {
  assert.equal(resolveThemePreference('system', false), 'light');
  assert.equal(resolveThemePreference('system', true), 'dark');
  assert.equal(resolveThemePreference('light', true), 'light');
  assert.equal(resolveThemePreference('dark', false), 'dark');
});

test('boot script owns the same persistence and DOM contract', () => {
  assert.match(CAREZ_APPEARANCE_BOOT_SCRIPT, new RegExp(CAREZ_THEME_STORAGE_KEY));
  assert.match(CAREZ_APPEARANCE_BOOT_SCRIPT, new RegExp(CAREZ_DENSITY_STORAGE_KEY));
  assert.match(CAREZ_APPEARANCE_BOOT_SCRIPT, /prefers-color-scheme: dark/);
  assert.match(CAREZ_APPEARANCE_BOOT_SCRIPT, /themePreference/);
  assert.match(CAREZ_APPEARANCE_BOOT_SCRIPT, /dataset\.theme/);
  assert.match(CAREZ_APPEARANCE_BOOT_SCRIPT, /dataset\.density/);
  assert.match(CAREZ_APPEARANCE_BOOT_SCRIPT, /classList\.toggle\('dark'/);
  assert.equal(CAREZ_THEME_MEDIA_QUERY, '(prefers-color-scheme: dark)');
});
```

- [ ] **2. Run the test and confirm the expected missing-module failure.**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/ui-appearance.test.ts
```

Expected: FAIL because `lib/ui/appearance.ts` does not exist.

- [ ] **3. Implement the pure appearance contract and pre-hydration script.**

Create `lib/ui/appearance.ts`:

```ts
export type CarezThemePreference = 'light' | 'dark' | 'system';
export type CarezResolvedTheme = 'light' | 'dark';
export type CarezDensityPreference = 'default' | 'compact' | 'comfortable';

export const CAREZ_THEME_STORAGE_KEY = 'carez.theme';
export const CAREZ_DENSITY_STORAGE_KEY = 'carez.density';
export const CAREZ_THEME_MEDIA_QUERY = '(prefers-color-scheme: dark)';

export function normalizeThemePreference(value: unknown): CarezThemePreference {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
}

export function normalizeDensityPreference(value: unknown): CarezDensityPreference {
  return value === 'compact' || value === 'comfortable' || value === 'default' ? value : 'default';
}

export function resolveThemePreference(
  preference: CarezThemePreference,
  prefersDark: boolean,
): CarezResolvedTheme {
  return preference === 'system' ? (prefersDark ? 'dark' : 'light') : preference;
}

export const CAREZ_APPEARANCE_BOOT_SCRIPT = `(() => {
  const root = document.documentElement;
  let themePreference = 'system';
  let densityPreference = 'default';

  try {
    const storedTheme = localStorage.getItem('${CAREZ_THEME_STORAGE_KEY}');
    const storedDensity = localStorage.getItem('${CAREZ_DENSITY_STORAGE_KEY}');
    if (storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system') themePreference = storedTheme;
    if (storedDensity === 'default' || storedDensity === 'compact' || storedDensity === 'comfortable') densityPreference = storedDensity;
  } catch {}

  const prefersDark = window.matchMedia('${CAREZ_THEME_MEDIA_QUERY}').matches;
  const resolvedTheme = themePreference === 'system' ? (prefersDark ? 'dark' : 'light') : themePreference;

  root.dataset.themePreference = themePreference;
  root.dataset.theme = resolvedTheme;
  root.dataset.density = densityPreference;
  root.classList.toggle('dark', resolvedTheme === 'dark');
  root.style.colorScheme = resolvedTheme;
})();`;
```

- [ ] **4. Run the pure tests and confirm PASS.**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/ui-appearance.test.ts
```

Expected: PASS.

- [ ] **5. Implement the root client provider.**

Create `components/carez/appearance-provider.tsx`:

```tsx
'use client';

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  CAREZ_DENSITY_STORAGE_KEY,
  CAREZ_THEME_MEDIA_QUERY,
  CAREZ_THEME_STORAGE_KEY,
  type CarezDensityPreference,
  type CarezResolvedTheme,
  type CarezThemePreference,
  normalizeDensityPreference,
  normalizeThemePreference,
  resolveThemePreference,
} from '@/lib/ui/appearance';

type CarezAppearanceContextValue = {
  ready: boolean;
  themePreference: CarezThemePreference;
  resolvedTheme: CarezResolvedTheme;
  densityPreference: CarezDensityPreference;
  setThemePreference: (next: CarezThemePreference) => void;
  setDensityPreference: (next: CarezDensityPreference) => void;
};

const CarezAppearanceContext = createContext<CarezAppearanceContextValue | null>(null);

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Local persistence is best-effort; current-session appearance still applies.
  }
}

function applyTheme(preference: CarezThemePreference, prefersDark: boolean): CarezResolvedTheme {
  const resolved = resolveThemePreference(preference, prefersDark);
  const root = document.documentElement;
  root.dataset.themePreference = preference;
  root.dataset.theme = resolved;
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
  return resolved;
}

function applyDensity(preference: CarezDensityPreference) {
  document.documentElement.dataset.density = preference;
}

export function CarezAppearanceProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [themePreference, setThemePreference] = useState<CarezThemePreference>('system');
  const [resolvedTheme, setResolvedTheme] = useState<CarezResolvedTheme>('light');
  const [densityPreference, setDensityPreference] = useState<CarezDensityPreference>('default');

  useEffect(() => {
    const root = document.documentElement;
    const initialTheme = normalizeThemePreference(
      root.dataset.themePreference ?? readStorage(CAREZ_THEME_STORAGE_KEY),
    );
    const initialDensity = normalizeDensityPreference(
      root.dataset.density ?? readStorage(CAREZ_DENSITY_STORAGE_KEY),
    );
    const media = window.matchMedia(CAREZ_THEME_MEDIA_QUERY);

    setThemePreference(initialTheme);
    setDensityPreference(initialDensity);
    setResolvedTheme(resolveThemePreference(initialTheme, media.matches));
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const media = window.matchMedia(CAREZ_THEME_MEDIA_QUERY);
    const update = () => {
      setResolvedTheme(applyTheme(themePreference, media.matches));
      writeStorage(CAREZ_THEME_STORAGE_KEY, themePreference);
    };

    update();
    if (themePreference !== 'system') return;

    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [ready, themePreference]);

  useEffect(() => {
    if (!ready) return;
    applyDensity(densityPreference);
    writeStorage(CAREZ_DENSITY_STORAGE_KEY, densityPreference);
  }, [densityPreference, ready]);

  const value = useMemo<CarezAppearanceContextValue>(() => ({
    ready,
    themePreference,
    resolvedTheme,
    densityPreference,
    setThemePreference,
    setDensityPreference,
  }), [densityPreference, ready, resolvedTheme, themePreference]);

  return <CarezAppearanceContext.Provider value={value}>{children}</CarezAppearanceContext.Provider>;
}

export function useCarezAppearance() {
  const value = useContext(CarezAppearanceContext);
  if (!value) throw new Error('useCarezAppearance must be used inside CarezAppearanceProvider');
  return value;
}
```

Modify `components/carez/index.ts`:

```ts
export * from './appearance-provider';
export * from './data-grid';
export * from './fields';
export * from './motion';
export * from './workspace';
```

- [ ] **6. Run focused tests plus typecheck.**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/ui-appearance.test.ts
pnpm typecheck
```

Expected: both PASS.

- [ ] **7. Commit Task 2.**

```bash
git add tests/ui-appearance.test.ts lib/ui/appearance.ts components/carez/appearance-provider.tsx components/carez/index.ts
git commit -m "feat(ui): define Carez appearance foundation"
```

---

## Task 3: Replace the forced-dark root with Precision Grid dual-theme tokens

**Files:**
- Create: `tests/ui-token-contract.test.ts`
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`

### Interface contract

- `:root` owns the light token set.
- `.dark` owns the dark token set.
- `html[data-density="compact"]` and `html[data-density="comfortable"]` alter only root density baselines.
- `CAREZ_APPEARANCE_BOOT_SCRIPT` runs before body hydration.
- `CarezAppearanceProvider` maintains live state after hydration.
- No literal `dark` class is forced by server markup.

### Steps

- [ ] **1. Add the failing token/layout contract test.**

Create `tests/ui-token-contract.test.ts`:

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const globals = readFileSync(new URL('app/globals.css', root), 'utf8');
const layout = readFileSync(new URL('app/layout.tsx', root), 'utf8');

function block(pattern: RegExp, source: string) {
  return source.match(pattern)?.[1] ?? '';
}

const requiredThemeTokens = [
  '--surface-canvas',
  '--surface-panel',
  '--surface-raised',
  '--text-primary',
  '--text-secondary',
  '--text-muted',
  '--border-default',
  '--border-strong',
  '--interaction-primary',
  '--interaction-selection',
  '--interaction-focus',
  '--status-success',
  '--status-warning',
  '--status-error',
  '--status-info',
];

test('light and dark token blocks are independent and complete', () => {
  assert.doesNotMatch(globals, /:root\s*,\s*\.dark/);
  const light = block(/:root\s*\{([\s\S]*?)\n\}/, globals);
  const dark = block(/\.dark\s*\{([\s\S]*?)\n\}/, globals);
  assert.ok(light.length > 0);
  assert.ok(dark.length > 0);
  for (const token of requiredThemeTokens) {
    assert.match(light, new RegExp(`${token}:`));
    assert.match(dark, new RegExp(`${token}:`));
  }
});

test('density and typography contracts are wired at the root', () => {
  assert.match(globals, /--density-control-height:/);
  assert.match(globals, /--density-row-height:/);
  assert.match(globals, /--density-workspace-gap:/);
  assert.match(globals, /html\[data-density=['"]compact['"]\]/);
  assert.match(globals, /html\[data-density=['"]comfortable['"]\]/);
  assert.match(globals, /--font-mono:\s*var\(--font-ibm-plex-mono\)/);
  assert.match(globals, /html\.dark\s*\{[^}]*color-scheme:\s*dark/s);
  assert.match(globals, /html\s*\{[^}]*color-scheme:\s*light/s);
});

test('layout no longer hard-codes dark and runs the appearance bootstrap', () => {
  assert.match(layout, /IBM_Plex_Mono/);
  assert.match(layout, /--font-ibm-plex-mono/);
  assert.match(layout, /CAREZ_APPEARANCE_BOOT_SCRIPT/);
  assert.match(layout, /CarezAppearanceProvider/);
  assert.match(layout, /suppressHydrationWarning/);
  assert.doesNotMatch(layout, /GeistMono/);
  assert.doesNotMatch(layout, /\$\{[^}]+\}\s+dark/);
});
```

- [ ] **2. Run the contract test and verify expected failure.**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/ui-token-contract.test.ts
```

Expected: FAIL because light/dark currently share one block, `color-scheme` is forced dark, and `layout.tsx` hard-codes the dark class/Geist Mono.

- [ ] **3. Replace the token/theme portion of `app/globals.css`.**

Keep the existing Tailwind/shadcn imports, build identity, scrollbar, reduced-motion, and print/mobile rules unless noted. Replace the current `@theme inline`, combined `:root,.dark`, and base `html` theme handling with the following contract:

```css
@theme inline {
  --font-sans: var(--font-inter);
  --font-mono: var(--font-ibm-plex-mono);

  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
  --color-info: var(--info);
  --color-info-foreground: var(--info-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);

  --color-surface-canvas: var(--surface-canvas);
  --color-surface-panel: var(--surface-panel);
  --color-surface-raised: var(--surface-raised);
  --color-interaction-primary: var(--interaction-primary);
  --color-interaction-selection: var(--interaction-selection);
  --color-interaction-focus: var(--interaction-focus);
  --color-status-success: var(--status-success);
  --color-status-warning: var(--status-warning);
  --color-status-error: var(--status-error);
  --color-status-info: var(--status-info);

  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);

  --radius-sm: .25rem;
  --radius-md: .375rem;
  --radius-lg: .375rem;
  --radius-xl: .5rem;
  --radius-2xl: .5rem;
  --radius-3xl: .5rem;
  --radius-4xl: .5rem;
}

:root {
  --radius: .375rem;
  --space-micro: .25rem;
  --space-grid: .5rem;
  --motion-fast: 140ms;
  --motion-standard: 180ms;
  --motion-overlay: 200ms;
  --motion-ease: cubic-bezier(.2,.8,.2,1);

  --density-control-height: 2rem;
  --density-row-height: 2rem;
  --density-workspace-gap: .75rem;

  --surface-canvas: oklch(.985 .003 250);
  --surface-panel: oklch(.995 .002 250);
  --surface-raised: oklch(1 0 0);
  --text-primary: oklch(.20 .012 250);
  --text-secondary: oklch(.36 .014 250);
  --text-muted: oklch(.48 .015 250);
  --border-default: oklch(.88 .008 250);
  --border-strong: oklch(.78 .012 250);
  --interaction-primary: oklch(.50 .14 252);
  --interaction-selection: oklch(.91 .035 250);
  --interaction-focus: oklch(.56 .14 252);
  --status-success: oklch(.52 .12 150);
  --status-warning: oklch(.67 .14 80);
  --status-error: oklch(.58 .18 25);
  --status-info: oklch(.55 .11 235);

  --background: var(--surface-canvas);
  --foreground: var(--text-primary);
  --card: var(--surface-panel);
  --card-foreground: var(--text-primary);
  --popover: var(--surface-raised);
  --popover-foreground: var(--text-primary);
  --primary: oklch(.24 .012 250);
  --primary-foreground: oklch(.985 .003 250);
  --secondary: oklch(.95 .006 250);
  --secondary-foreground: oklch(.26 .012 250);
  --muted: oklch(.955 .005 250);
  --muted-foreground: var(--text-muted);
  --accent: oklch(.94 .01 250);
  --accent-foreground: oklch(.22 .012 250);
  --destructive: var(--status-error);
  --destructive-foreground: oklch(.985 .003 250);
  --success: var(--status-success);
  --success-foreground: oklch(.985 .003 250);
  --warning: var(--status-warning);
  --warning-foreground: oklch(.20 .04 70);
  --info: var(--status-info);
  --info-foreground: oklch(.985 .003 250);
  --border: var(--border-default);
  --input: oklch(.84 .01 250);
  --ring: var(--interaction-focus);
  --chart-1: oklch(.55 .12 252);
  --chart-2: oklch(.52 .12 150);
  --chart-3: oklch(.67 .14 80);
  --chart-4: oklch(.60 .15 30);
  --chart-5: oklch(.58 .10 205);
  --sidebar: var(--surface-canvas);
  --sidebar-foreground: var(--text-primary);
  --sidebar-primary: var(--primary);
  --sidebar-primary-foreground: var(--primary-foreground);
  --sidebar-accent: var(--accent);
  --sidebar-accent-foreground: var(--accent-foreground);
  --sidebar-border: var(--border-default);
  --sidebar-ring: var(--interaction-focus);
}

.dark {
  --surface-canvas: oklch(.145 .008 255);
  --surface-panel: oklch(.18 .009 255);
  --surface-raised: oklch(.185 .01 255);
  --text-primary: oklch(.94 .006 250);
  --text-secondary: oklch(.78 .01 250);
  --text-muted: oklch(.68 .012 250);
  --border-default: oklch(.29 .01 255);
  --border-strong: oklch(.38 .012 255);
  --interaction-primary: oklch(.70 .12 250);
  --interaction-selection: oklch(.30 .06 250);
  --interaction-focus: oklch(.72 .12 250);
  --status-success: oklch(.68 .13 150);
  --status-warning: oklch(.78 .13 78);
  --status-error: oklch(.65 .19 25);
  --status-info: oklch(.70 .10 235);

  --background: var(--surface-canvas);
  --foreground: var(--text-primary);
  --card: var(--surface-panel);
  --card-foreground: var(--text-primary);
  --popover: var(--surface-raised);
  --popover-foreground: oklch(.95 .005 250);
  --primary: oklch(.94 .006 250);
  --primary-foreground: oklch(.16 .008 255);
  --secondary: oklch(.235 .01 255);
  --secondary-foreground: oklch(.92 .006 250);
  --muted: oklch(.215 .009 255);
  --muted-foreground: var(--text-muted);
  --accent: oklch(.27 .012 255);
  --accent-foreground: oklch(.95 .005 250);
  --destructive: var(--status-error);
  --destructive-foreground: oklch(.98 .003 250);
  --success: var(--status-success);
  --success-foreground: oklch(.15 .025 150);
  --warning: var(--status-warning);
  --warning-foreground: oklch(.20 .04 65);
  --info: var(--status-info);
  --info-foreground: oklch(.14 .02 240);
  --border: var(--border-default);
  --input: oklch(.31 .011 255);
  --ring: var(--interaction-focus);
  --chart-1: oklch(.70 .09 255);
  --chart-2: oklch(.68 .13 150);
  --chart-3: oklch(.78 .13 78);
  --chart-4: oklch(.68 .14 30);
  --chart-5: oklch(.67 .09 205);
  --sidebar: var(--surface-canvas);
  --sidebar-foreground: var(--text-primary);
  --sidebar-primary: var(--primary);
  --sidebar-primary-foreground: var(--primary-foreground);
  --sidebar-accent: var(--secondary);
  --sidebar-accent-foreground: var(--accent-foreground);
  --sidebar-border: var(--border-default);
  --sidebar-ring: var(--interaction-focus);
}

html[data-density='compact'] {
  --density-control-height: 1.75rem;
  --density-row-height: 1.75rem;
  --density-workspace-gap: .5rem;
}

html[data-density='comfortable'] {
  --density-control-height: 2.25rem;
  --density-row-height: 2.25rem;
  --density-workspace-gap: 1rem;
}

@layer base {
  * { @apply border-border outline-ring/50; }
  html { min-height: 100%; background: var(--background); color-scheme: light; }
  html.dark { color-scheme: dark; }
  body {
    @apply min-h-svh bg-background font-sans text-foreground antialiased;
    font-feature-settings: "cv02", "cv03", "cv04", "cv11";
    text-rendering: optimizeLegibility;
  }
  button, input, select, textarea { font: inherit; }
  strong { font-weight: 650; }
  ::selection { background: color-mix(in oklch, var(--interaction-selection) 55%, transparent); }
}
```

Also change the build identity font line from `var(--font-geist-mono)` to:

```css
font: 600 9px/1.2 var(--font-ibm-plex-mono), ui-monospace, SFMono-Regular, Consolas, monospace;
```

Do not change the existing reduced-motion rule except as required by formatting.

- [ ] **4. Replace the forced-dark root layout with the hydration-safe appearance foundation.**

Update `app/layout.tsx` to this structure while preserving metadata/build-identity behavior and the existing `takeoff-v3.css` import:

```tsx
import type { Metadata } from 'next';
import { IBM_Plex_Mono, Inter } from 'next/font/google';
import { CarezAppearanceProvider } from '@/components/carez/appearance-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { CAREZ_APPEARANCE_BOOT_SCRIPT } from '@/lib/ui/appearance';
import './globals.css';
import './takeoff-v3.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-ibm-plex-mono',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Carez Concrete OS',
  description: 'Private operating system for Carez Concrete',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const vercelEnvironment = process.env.VERCEL_ENV;
  const branch = process.env.VERCEL_GIT_COMMIT_REF;
  const shortSha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);
  const showBuildIdentity = Boolean(vercelEnvironment && vercelEnvironment !== 'production');
  const environmentLabel = branch === 'staging' ? 'STAGING' : 'PREVIEW';

  return <html
    lang="en"
    suppressHydrationWarning
    className={`${inter.variable} ${ibmPlexMono.variable}`}
  >
    <head>
      <script dangerouslySetInnerHTML={{ __html: CAREZ_APPEARANCE_BOOT_SCRIPT }} />
    </head>
    <body className={inter.className}>
      <CarezAppearanceProvider>
        <TooltipProvider>
          {children}
        </TooltipProvider>
      </CarezAppearanceProvider>
      {showBuildIdentity && <div className="carez-build-identity" aria-label="Non-production build identity">
        {environmentLabel} · {branch || 'detached'} · {shortSha || 'unknown'}
      </div>}
    </body>
  </html>;
}
```

Do not remove the `geist` package in this task; dependency cleanup is unrelated to the visual foundation and would create lockfile noise.

- [ ] **5. Run the token contract test.**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/ui-token-contract.test.ts
```

Expected: PASS.

- [ ] **6. Run appearance tests and typecheck together.**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/ui-appearance.test.ts tests/ui-token-contract.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **7. Commit Task 3.**

```bash
git add tests/ui-token-contract.test.ts app/globals.css app/layout.tsx
git commit -m "feat(ui): add Precision Grid dual-theme tokens"
```

---

## Task 4: Expose Appearance controls in Settings

**Files:**
- Create: `tests/ui-settings-appearance.test.ts`
- Create: `components/settings/AppearanceSettings.tsx`
- Modify: `app/settings/page.tsx`

### Interface contract

- Theme choices: System, Light, Dark.
- Density choices: Workspace default, Compact, Comfortable.
- Controls are disabled until client appearance state is hydrated.
- Changing a selection updates the provider immediately; persistence is provider-owned.
- Settings remains a normal server route with one nested client component; no Settings page conversion is required.

### Steps

- [ ] **1. Add a failing integration source-contract test.**

Create `tests/ui-settings-appearance.test.ts`:

```ts
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const componentUrl = new URL('components/settings/AppearanceSettings.tsx', root);

const read = (path: string) => readFileSync(new URL(path, root), 'utf8');

test('Settings exposes the Carez appearance preference surface', () => {
  assert.equal(existsSync(componentUrl), true);
  const component = read('components/settings/AppearanceSettings.tsx');
  const settings = read('app/settings/page.tsx');

  assert.match(component, /useCarezAppearance/);
  assert.match(component, /System/);
  assert.match(component, /Light/);
  assert.match(component, /Dark/);
  assert.match(component, /Workspace default/);
  assert.match(component, /Compact/);
  assert.match(component, /Comfortable/);
  assert.match(settings, /AppearanceSettings/);
  assert.match(settings, /title="Appearance"/);
});
```

- [ ] **2. Run the test and verify expected failure.**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/ui-settings-appearance.test.ts
```

Expected: FAIL because the Appearance settings component does not exist.

- [ ] **3. Implement the Settings appearance component using the existing Base UI Select composition.**

Create `components/settings/AppearanceSettings.tsx`:

```tsx
'use client';

import { useCarezAppearance } from '@/components/carez/appearance-provider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function AppearanceSettings() {
  const {
    ready,
    themePreference,
    densityPreference,
    setThemePreference,
    setDensityPreference,
  } = useCarezAppearance();

  return <div className="divide-y rounded-md border bg-surface-panel">
    <div className="grid items-center gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_220px]">
      <div>
        <div className="text-sm font-medium">Theme</div>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
          Follow this device or use an explicit Carez light/dark theme.
        </p>
      </div>
      <Select
        value={themePreference}
        onValueChange={value => {
          if (value === 'light' || value === 'dark' || value === 'system') setThemePreference(value);
        }}
      >
        <SelectTrigger className="w-full" disabled={!ready} aria-label="Carez theme">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          <SelectItem value="system">System</SelectItem>
          <SelectItem value="light">Light</SelectItem>
          <SelectItem value="dark">Dark</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div className="grid items-center gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_220px]">
      <div>
        <div className="text-sm font-medium">Density</div>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
          Sets your baseline spacing. Specialist workspaces may enforce safe density limits.
        </p>
      </div>
      <Select
        value={densityPreference}
        onValueChange={value => {
          if (value === 'default' || value === 'compact' || value === 'comfortable') setDensityPreference(value);
        }}
      >
        <SelectTrigger className="w-full" disabled={!ready} aria-label="Carez density">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          <SelectItem value="default">Workspace default</SelectItem>
          <SelectItem value="compact">Compact</SelectItem>
          <SelectItem value="comfortable">Comfortable</SelectItem>
        </SelectContent>
      </Select>
    </div>
  </div>;
}
```

- [ ] **4. Add the Appearance section to the existing Settings page.**

In `app/settings/page.tsx`, add:

```tsx
import { AppearanceSettings } from '@/components/settings/AppearanceSettings';
```

Immediately after the Company Branding section and before Connections, add:

```tsx
<section className="space-y-4">
  <SectionHeading
    kicker="Interface"
    title="Appearance"
    description="Theme and baseline workspace density for this device."
  />
  <AppearanceSettings />
</section>
```

Do not move or redesign the existing Settings integrations/labor sections in this subproject.

- [ ] **5. Run the Settings contract test and typecheck.**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/ui-settings-appearance.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **6. Run all new UI foundation tests together.**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test \
  tests/ui-authority-contract.test.ts \
  tests/ui-appearance.test.ts \
  tests/ui-token-contract.test.ts \
  tests/ui-settings-appearance.test.ts
```

Expected: PASS.

- [ ] **7. Commit Task 4.**

```bash
git add tests/ui-settings-appearance.test.ts components/settings/AppearanceSettings.tsx app/settings/page.tsx
git commit -m "feat(settings): add Carez appearance preferences"
```

---

## Task 5: Run the complete automated foundation gate

**Files:** none unless a failing check proves a bounded correction is required.

### Steps

- [ ] **1. Confirm the working tree contains only expected Subproject 1 changes.**

```bash
git status --short
git diff --stat HEAD~4..HEAD
```

Expected: only the files listed in this plan. If unrelated changes are present, separate them before continuing.

- [ ] **2. Run targeted UI foundation tests.**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test \
  tests/ui-authority-contract.test.ts \
  tests/ui-appearance.test.ts \
  tests/ui-token-contract.test.ts \
  tests/ui-settings-appearance.test.ts
```

Expected: PASS.

- [ ] **3. Run full repository validation because theme tokens/layout affect the whole application.**

```bash
pnpm check
```

Expected: `pnpm typecheck`, all domain tests, and production build PASS.

- [ ] **4. Verify no new dependency or lockfile mutation was introduced.**

```bash
git diff --exit-code HEAD~4..HEAD -- package.json pnpm-lock.yaml
```

Expected: no diff.

- [ ] **5. Verify the implementation did not alter shell navigation or domain/database source.**

```bash
git diff --name-only HEAD~4..HEAD | grep -E '^(components/AppShell\.tsx|supabase/|lib/domain/|lib/takeoff/conditions/)' && exit 1 || true
```

Expected: no output.

- [ ] **6. Push the validated commits to `staging` if the execution environment is on a temporary task branch; otherwise confirm `staging` already contains them.**

If a temporary branch was required by the runner, merge it into current `staging`, delete the temporary branch, and push `staging`. Do not ask Nik to test a feature-branch preview.

- [ ] **7. Wait for the stable staging alias to serve the matching commit before browser QA.**

Stable QA URL:

```text
https://carez-concrete-os-git-staging-seancolmes-projects.vercel.app
```

Do not proceed to acceptance based only on a READY deployment if the browser still serves a different build identity.

---

## Task 6: Browser-verify the foundation, then reconcile Current State and close Issue #63

**Files:**
- Modify after PASS only: `docs/CURRENT_STATE.md`
- GitHub Issue #63 comment/state after PASS only.

### Browser acceptance matrix

Use an authenticated browser on the stable staging URL. This is a foundation QA pass, not broad route-redesign acceptance.

- [ ] **1. Verify Settings controls render and are keyboard accessible.**

Open `/settings` and confirm:

```text
Interface
Appearance
Theme: System | Light | Dark
Density: Workspace default | Compact | Comfortable
```

Tab into both Select triggers, open by keyboard, change choices, Escape/close, and verify visible focus.

- [ ] **2. Verify explicit Light persistence without forced-dark flash.**

Choose Light. Confirm `document.documentElement` has:

```text
data-theme-preference="light"
data-theme="light"
data-density="..."
class does not contain "dark"
style.colorScheme === "light"
```

Reload `/settings`. Confirm Light remains and the page does not visibly flash a forced dark frame before hydration.

- [ ] **3. Verify explicit Dark persistence.**

Choose Dark and confirm:

```text
data-theme-preference="dark"
data-theme="dark"
class contains "dark"
style.colorScheme === "dark"
```

Reload and confirm it persists.

- [ ] **4. Verify System follows `prefers-color-scheme` live.**

Choose System. Use browser/OS color-scheme emulation to switch Light → Dark → Light without reloading. Confirm `data-theme`, `.dark`, and `colorScheme` update on each media-query change while `data-theme-preference` stays `system`.

- [ ] **5. Verify density root state/persistence.**

Select Compact, reload, then Comfortable, reload, then restore Workspace default. Confirm `data-density` persists as `compact`, `comfortable`, and `default` respectively. Inspect computed values for:

```text
--density-control-height
--density-row-height
--density-workspace-gap
```

Do not require all current legacy/shared components to visually consume these values yet; shared-component adoption is Subproject 3.

- [ ] **6. Smoke representative existing surfaces in both themes.**

At minimum inspect:

```text
/settings
/
/projects
/takeoff/[an existing accessible setId]
```

Check text/background contrast, inputs, buttons, menus/popovers, Switch, Data Grid/table content, selected/focus state, overflow, and no unreadable hard-coded dark-on-dark or light-on-light region.

This does not approve the future shell or route redesign; it only proves the token foundation does not break representative existing work.

- [ ] **7. Treat active specialized CSS defects as real blockers, not speculative refactors.**

If `app/takeoff-v3.css` or another specialized stylesheet creates an observed light-theme defect, record the exact route, selector, and screenshot/evidence in Issue #63. Make the smallest semantic-token/dual-theme correction for the observed active selector, rerun `pnpm check`, redeploy staging, and repeat the affected browser checks. Do not rewrite specialized geometry/rendering CSS wholesale.

- [ ] **8. Obtain Nik's stable-staging acceptance before changing Current State.**

Required user result: PASS on the stable staging build for this foundation slice.

### Current State reconciliation after PASS

- [ ] **9. Update `docs/CURRENT_STATE.md` only after Tasks 5–6 have passed.**

Make these durable corrections:

1. Set:

```md
Last reconciled: 2026-09-15
```

2. Replace the protected-baseline UI authority bullet with:

```md
- ADR-024 Precision Grid is the active application visual/theme/token/density authority. ADR-016 remains the currently implemented shell until the dedicated role-adaptive shell/navigation subproject replaces it; ADR-020 plus the active Takeoff module spec remain authoritative for Takeoff/workstation/domain invariants.
```

3. Replace the stale `Issue #44 remains open...` statement with:

```md
Issue #44 is **accepted/closed** at staging SHA `388b8f35682ddd23c9c9f69a907d65d724e63fa2`; the prior dark-shadcn route conversion, compatibility-layer removal, and route-family browser acceptance are historical baseline, not an active implementation gate.
```

4. Add to the Global UI/shared-system state after browser acceptance:

```md
Issue #63 — Precision Grid canonical authority + token foundation — is accepted on staging. Implemented foundation includes first-class Light/Dark/System preference, pre-hydration theme resolution, device-local appearance persistence, Inter + IBM Plex Mono typography roles, Precision Grid semantic light/dark tokens, root default/compact/comfortable density state, and Settings appearance controls. This acceptance does not imply the later role-adaptive shell, project-context layer, shared-component expansion, or route/module redesign slices are implemented.
```

5. Replace the old active priority about continuing Issue #44 with:

```md
1. Continue the approved Carez OS major UI/UX redesign through the next independently planned subproject: Global shell + navigation context. Preserve ADR-024 and the accepted Issue #63 foundation while doing so.
```

Leave non-UI priorities such as derived 3D and Issue #59 in their existing relative order unless their verified state has independently changed.

- [ ] **10. Commit Current State reconciliation.**

```bash
git add docs/CURRENT_STATE.md
git commit -m "docs: record Precision Grid foundation acceptance"
git push origin staging
```

- [ ] **11. Add Issue #63 acceptance evidence and close it completed.**

Obtain the exact final staging SHA:

```bash
git rev-parse HEAD
```

Use that exact SHA in the Issue #63 acceptance comment. The comment must state:

```md
## Subproject 1 acceptance — PASS

- ADR-024 and canonical UI authority reconciliation complete.
- Light / Dark / System preference and live System media-query response browser-verified.
- Appearance persistence and root density preference browser-verified.
- Precision Grid dual-theme semantic tokens and Inter / IBM Plex Mono foundation implemented.
- `pnpm check` PASS.
- Matching stable staging deployment browser-verified and user accepted.
- `CURRENT_STATE.md` reconciled.

This closes only Subproject 1. Role-adaptive shell/navigation, shared component/state expansion, reference slices, and module migrations remain separate follow-on subprojects.
```

If `gh` is available, post and close with:

```bash
SHA="$(git rev-parse HEAD)"
printf '%s\n' \
  '## Subproject 1 acceptance — PASS' \
  '' \
  "Accepted staging SHA: \`$SHA\`." \
  '' \
  '- ADR-024 and canonical UI authority reconciliation complete.' \
  '- Light / Dark / System preference and live System media-query response browser-verified.' \
  '- Appearance persistence and root density preference browser-verified.' \
  '- Precision Grid dual-theme semantic tokens and Inter / IBM Plex Mono foundation implemented.' \
  '- `pnpm check` PASS.' \
  '- Matching stable staging deployment browser-verified and user accepted.' \
  '- `CURRENT_STATE.md` reconciled.' \
  '' \
  'This closes only Subproject 1. Role-adaptive shell/navigation, shared component/state expansion, reference slices, and module migrations remain separate follow-on subprojects.' \
  > /tmp/carez-issue-63-acceptance.md

gh issue comment 63 --repo seancolmes/carez-concrete-os --body-file /tmp/carez-issue-63-acceptance.md
gh issue close 63 --repo seancolmes/carez-concrete-os --reason completed
```

If `gh` is not available, use the connected GitHub issue tool with the same exact body and final SHA.

---

## Final Verification Checklist

Before declaring Subproject 1 complete, all of the following must be true:

- [ ] ADR-024 exists and canonical docs reference it without contradiction.
- [ ] Issue #44 remains closed; Issue #63 owns and then closes this foundation slice.
- [ ] No new runtime dependency or package-lock change was introduced.
- [ ] `lib/ui/appearance.ts` tests pass.
- [ ] Provider reacts live to System theme changes in browser.
- [ ] No server-rendered hard-coded `.dark` class remains in `app/layout.tsx`.
- [ ] Light and dark each define complete semantic token families.
- [ ] Inter is normal UI; IBM Plex Mono is the mono/technical family.
- [ ] Root density state is `default | compact | comfortable` and persists locally.
- [ ] Settings appearance controls are keyboard accessible.
- [ ] `pnpm check` passes.
- [ ] Matching stable `staging` deployment is READY.
- [ ] Authenticated browser QA passes `/settings`, `/`, `/projects`, and a current Takeoff set in both themes.
- [ ] Nik accepts the stable staging foundation.
- [ ] `CURRENT_STATE.md` is updated only after acceptance.
- [ ] No statement claims Subprojects 2–7 are implemented.

## Spec Coverage Self-Check

This plan covers every requirement assigned to Subproject 1 by the approved umbrella spec:

- canonical authority reconciliation → Task 1;
- semantic light/dark token architecture → Task 3;
- true Light/Dark/System preference and persistence → Tasks 2–4;
- typography / spacing / radius / elevation-motion token foundation → Tasks 1 and 3;
- density primitives → Tasks 2–4;
- no shell/module migration yet → Global Constraints + unchanged-file boundary;
- no new design/runtime dependency → Global Constraints + Task 5;
- automated tests/build → Tasks 1–5;
- stable staging browser acceptance → Task 6;
- current-state truth only after verification → Task 6.

There are no `TBD`, `TODO`, or intentionally ambiguous implementation decisions in this plan. Any browser-discovered defect is handled as evidence-driven bounded correction under Issue #63 rather than pre-authorized scope expansion.
