# Carez OS UI Token Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the approved Precision Grid UX authority and the source-owned appearance/token foundation for first-class light, dark, and system themes plus user density preference, without migrating the shell or module workspaces yet.

**Architecture:** ADR-024 becomes the durable Carez UI/UX authority. A pure appearance module owns preference values and the pre-hydration boot script; a root client provider owns local persistence and live system-theme changes; `app/globals.css` owns the semantic Precision Grid light/dark palettes and density baselines; Settings exposes these preferences through existing source-owned Base UI/shadcn components. No new dependency, database migration, navigation rewrite, or module redesign is part of this subproject.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5.9, Tailwind CSS v4, source-owned shadcn/Base UI, CSS custom properties/OKLCH, `next/font/google`, Node `node:test`; Supabase/domain architecture unchanged.

**Spec:** `docs/superpowers/specs/2026-09-15-carez-os-major-ui-ux-redesign-design.md`  
**Implementation owner:** GitHub Issue #63 — `Carez OS major UI/UX redesign — Subproject 1 canonical authority + token foundation`

## Global Constraints

- Start from current `staging`; `main` remains production only.
- Preserve Supabase/PostgreSQL authority, RLS/tenant isolation, server-authoritative calculations, immutable/versioned commercial records, Job Spine lineage, Production Quantity / Direct Cost / Sell separation, and Takeoff 2D/vector authority.
- Preserve the source-owned shadcn/Base UI/Tailwind v4 component system. Do not add `next-themes` or another runtime UI/theme library.
- Issue #44 is closed historical evidence. Do not reopen or repurpose it; Issue #63 owns this subproject.
- Implement **Subproject 1 only**. Do not implement role-adaptive navigation, the Hybrid command shell, project context bar, Today/Project/Takeoff reference redesigns, or module migration waves.
- Appearance modes are `light | dark | system`; the default preference is `system`.
- Density preferences are `default | compact | comfortable`; this slice only establishes root semantic baselines. Workspace archetypes may later constrain them safely.
- Inter Variable remains normal UI typography. IBM Plex Mono becomes the technical/numeric mono family. Do not make ordinary UI copy mono.
- Carez blue is restrained interaction/selection/focus identity. Keep existing generic `primary` tokens neutral enough that this foundation does not flood still-unmigrated routes with blue.
- Do not rewrite `app/takeoff-v3.css` speculatively. If stable-staging light-theme QA proves an active selector causes a real defect, record the exact route/selector and make only the bounded fix required for Issue #63 acceptance.
- Source/build success is not rendered acceptance. Do not mark Issue #63 or `CURRENT_STATE.md` accepted until stable staging is browser-verified and Nik accepts it.

---

## File Map

### Create

- `docs/decisions/ADR-024-precision-grid-dual-theme-application-system.md`
- `lib/ui/appearance.ts`
- `components/carez/appearance-provider.tsx`
- `components/settings/AppearanceSettings.tsx`
- `tests/ui-authority-contract.test.ts`
- `tests/ui-appearance.test.ts`
- `tests/ui-token-contract.test.ts`
- `tests/ui-settings-appearance.test.ts`

### Modify

- `docs/superpowers/specs/2026-09-15-carez-os-major-ui-ux-redesign-design.md`
- `docs/README.md`
- `CODEX.md`
- `docs/decisions/ADR-015-dark-minimal-shadcn-application-system.md`
- `docs/decisions/ADR-016-top-navigation-shell-and-component-pack.md`
- `docs/decisions/ADR-019-tactile-metric-card-system.md`
- `docs/decisions/ADR-020-integrated-takeoff-workstation-and-precision-cursor.md`
- `docs/design-system/CAREZ_COMPONENT_PACK.md`
- `components/carez/index.ts`
- `app/globals.css`
- `app/layout.tsx`
- `app/settings/page.tsx`
- `docs/CURRENT_STATE.md` **only after rendered acceptance**

### Explicitly unchanged unless browser evidence proves a bounded acceptance defect

- `components/AppShell.tsx`
- `app/takeoff-v3.css`
- Supabase migrations/schema/RLS
- domain calculations and Takeoff geometry/3D authority
- `package.json` and `pnpm-lock.yaml`

---

## Task 1: Promote Precision Grid into canonical UI authority

**Files:**
- Create: `tests/ui-authority-contract.test.ts`
- Create: `docs/decisions/ADR-024-precision-grid-dual-theme-application-system.md`
- Modify: approved design spec, `docs/README.md`, `CODEX.md`, ADR-015/016/019/020, `docs/design-system/CAREZ_COMPONENT_PACK.md`

### Authority interface

```text
ADR-024 Precision Grid
├── visual/theme/token/density authority
├── approved future shell architecture
├── incorporates compatible ADR-015 principles
├── leaves ADR-016 as current implemented shell until Subproject 2
├── amends ADR-019 metric-card motion
└── preserves ADR-020 Takeoff/domain authority
```

- [ ] **1. Write the failing authority regression test.**

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
  assert.match(pack, /light.*dark|dual-theme/i);
  assert.match(adr015, /ADR-024/);
  assert.match(adr016, /ADR-024/);
  assert.match(adr019, /ADR-024/);
  assert.match(adr020, /ADR-024/);
  assert.doesNotMatch(design, /pending written-spec review/i);
});
```

- [ ] **2. Prove the test fails before the docs change.**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/ui-authority-contract.test.ts
```

Expected: FAIL because ADR-024 is absent and the current authority graph is still dark-first.

- [ ] **3. Create ADR-024 exactly as the durable architecture decision.**

Create `docs/decisions/ADR-024-precision-grid-dual-theme-application-system.md`:

```md
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
```

- [ ] **4. Reconcile existing authority docs with these exact statements.**

`docs/README.md` → replace `## UI authority` body with:

```md
ADR-024 owns the Precision Grid visual/theme/token/density architecture and approved end-state Carez OS interaction direction. ADR-016 remains the current implemented desktop-shell contract until the dedicated shell/navigation subproject replaces it. ADR-020 plus the active Takeoff module spec remain authoritative for Takeoff/workstation/domain invariants. Shared UI belongs in `design-system/CAREZ_COMPONENT_PACK.md`; modules must not create competing design systems or revive legacy presentation layers.
```

`CODEX.md` → replace the current dark-only UI-authority bullet with:

```md
- UI authority: ADR-024 + `docs/design-system/CAREZ_COMPONENT_PACK.md`; ADR-016 remains the implemented shell until its dedicated replacement slice, and ADR-020/current Takeoff module contracts remain authoritative for Takeoff invariants. Preserve true light/dark/system semantic tokens; do not revive legacy B2 styling, a permanent global desktop left rail, compatibility UI layers, hard-coded alternate palettes outside governed semantic tokens, or a second component system.
```

`ADR-015` → set:

```md
Status: Accepted principles, theme/visual foundation superseded by ADR-024
```

and add after metadata:

```md
ADR-024 supersedes this ADR's dark-first/default-dark theme contract, dark-only token assumptions, and one-density visual foundation. Its source-owned shadcn/Base UI architecture, continuous-workspace preference, restrained surface/content discipline, semantic/scarce color, functional motion, and anti-parallel-design-system rules remain incorporated by ADR-024.
```

`ADR-016` → keep Accepted and add after metadata:

```md
Transition under ADR-024: this ADR remains the current implemented shell contract until the dedicated role-adaptive Hybrid command-shell/project-context subproject is implemented and browser-accepted. ADR-024 is already authoritative for visual theme, token, density, and the approved end-state shell architecture. No permanent global desktop left rail returns.
```

`ADR-019` → set:

```md
Status: Accepted pattern, motion treatment amended by ADR-024
```

replace the perspective/tilt requirement with:

```md
- no pointer-following perspective/3D tilt; interactive cards may use restrained border/surface emphasis and at most about 1 px vertical lift when it materially clarifies clickability;
- interaction should generally resolve in approximately 140–180 ms and remain within the Precision Grid functional-motion contract;
```

and add:

```md
ADR-024 is authoritative when older tactile-motion wording conflicts with Precision Grid.
```

`ADR-020` → keep Accepted and add after metadata:

```md
Presentation transition: ADR-024 supersedes application-wide theme, token, density, and shell styling. This ADR remains authoritative for integrated Takeoff/workstation/domain invariants where not superseded by the current Takeoff module/3D contracts.
```

`docs/design-system/CAREZ_COMPONENT_PACK.md` → replace the dark-only foundation sentence with:

```md
All shared Carez components use the ADR-024 Precision Grid semantic token system, first-class light/dark themes, source-owned React code, accessible keyboard/focus behavior, restrained radii, workspace-adaptive density, and functional motion. A module may choose the specialist or operations workspace expression, but neither becomes a separate theme or component library.
```

Add before the numbered component list:

```md
## Precision Grid foundation

Shared components consume semantic application tokens rather than hard-coded light/dark palettes. Required families include surface canvas/panel/raised, primary/secondary/muted text, default/strong borders, primary/selection/focus interactions, success/warning/error/info states, and density control-height/row-height/workspace-gap.

Appearance preference is `light | dark | system`; System is default. Root density preference is `default | compact | comfortable`. Workspace archetypes may constrain density to preserve readability and touch safety.

Primary UI typography is Inter Variable. IBM Plex Mono is reserved for technical identifiers/aligned technical data where mono materially helps; tabular figures remain standard for quantities, money, rates, percentages, and dimensions.
```

Approved design spec → set:

```md
**Status:** Approved architectural design; implementation decomposed by subproject
```

and replace the final pending-review sentence with:

```md
This design is the approved architectural umbrella. Implementation proceeds through independently planned/verified subprojects beginning with Issue #63 — Canonical authority + token foundation.
```

- [ ] **5. Re-run the authority test; expect PASS.**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/ui-authority-contract.test.ts
```

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

### Public contract

```ts
type CarezThemePreference = 'light' | 'dark' | 'system';
type CarezResolvedTheme = 'light' | 'dark';
type CarezDensityPreference = 'default' | 'compact' | 'comfortable';
```

Device-local keys:

```text
carez.theme
carez.density
```

Root state:

```text
data-theme-preference="light|dark|system"
data-theme="light|dark"
data-density="default|compact|comfortable"
class="dark" only when resolved dark
style.colorScheme="light|dark"
```

- [ ] **1. Add failing tests.**

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

test('theme preference normalizes safely', () => {
  assert.equal(normalizeThemePreference('light'), 'light');
  assert.equal(normalizeThemePreference('dark'), 'dark');
  assert.equal(normalizeThemePreference('system'), 'system');
  assert.equal(normalizeThemePreference('sepia'), 'system');
  assert.equal(normalizeThemePreference(null), 'system');
});

test('density preference normalizes safely', () => {
  assert.equal(normalizeDensityPreference('default'), 'default');
  assert.equal(normalizeDensityPreference('compact'), 'compact');
  assert.equal(normalizeDensityPreference('comfortable'), 'comfortable');
  assert.equal(normalizeDensityPreference('dense'), 'default');
  assert.equal(normalizeDensityPreference(undefined), 'default');
});

test('system resolves from OS while explicit themes do not', () => {
  assert.equal(resolveThemePreference('system', false), 'light');
  assert.equal(resolveThemePreference('system', true), 'dark');
  assert.equal(resolveThemePreference('light', true), 'light');
  assert.equal(resolveThemePreference('dark', false), 'dark');
});

test('boot script owns persistence and DOM state', () => {
  assert.match(CAREZ_APPEARANCE_BOOT_SCRIPT, new RegExp(CAREZ_THEME_STORAGE_KEY));
  assert.match(CAREZ_APPEARANCE_BOOT_SCRIPT, new RegExp(CAREZ_DENSITY_STORAGE_KEY));
  assert.match(CAREZ_APPEARANCE_BOOT_SCRIPT, /prefers-color-scheme: dark/);
  assert.match(CAREZ_APPEARANCE_BOOT_SCRIPT, /dataset\.themePreference/);
  assert.match(CAREZ_APPEARANCE_BOOT_SCRIPT, /dataset\.theme/);
  assert.match(CAREZ_APPEARANCE_BOOT_SCRIPT, /dataset\.density/);
  assert.match(CAREZ_APPEARANCE_BOOT_SCRIPT, /classList\.toggle\('dark'/);
  assert.equal(CAREZ_THEME_MEDIA_QUERY, '(prefers-color-scheme: dark)');
});
```

- [ ] **2. Run and confirm missing-module failure.**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/ui-appearance.test.ts
```

- [ ] **3. Implement `lib/ui/appearance.ts`.**

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

export function resolveThemePreference(preference: CarezThemePreference, prefersDark: boolean): CarezResolvedTheme {
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

- [ ] **4. Re-run appearance tests; expect PASS.**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/ui-appearance.test.ts
```

- [ ] **5. Implement `components/carez/appearance-provider.tsx`.**

```tsx
'use client';

import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';
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
  try { return window.localStorage.getItem(key); } catch { return null; }
}

function writeStorage(key: string, value: string) {
  try { window.localStorage.setItem(key, value); } catch {}
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
    const initialTheme = normalizeThemePreference(root.dataset.themePreference ?? readStorage(CAREZ_THEME_STORAGE_KEY));
    const initialDensity = normalizeDensityPreference(root.dataset.density ?? readStorage(CAREZ_DENSITY_STORAGE_KEY));
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

- [ ] **6. Export it from `components/carez/index.ts`.**

```ts
export * from './appearance-provider';
export * from './data-grid';
export * from './fields';
export * from './motion';
export * from './workspace';
```

- [ ] **7. Run focused tests and typecheck; expect PASS.**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/ui-appearance.test.ts
pnpm typecheck
```

- [ ] **8. Commit Task 2.**

```bash
git add tests/ui-appearance.test.ts lib/ui/appearance.ts components/carez/appearance-provider.tsx components/carez/index.ts
git commit -m "feat(ui): define Carez appearance foundation"
```

---

## Task 3: Install Precision Grid tokens and remove forced-dark root markup

**Files:**
- Create: `tests/ui-token-contract.test.ts`
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`

- [ ] **1. Write the failing token/layout contract test.**

Create `tests/ui-token-contract.test.ts`:

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const globals = readFileSync(new URL('app/globals.css', root), 'utf8');
const layout = readFileSync(new URL('app/layout.tsx', root), 'utf8');
const block = (pattern: RegExp, source: string) => source.match(pattern)?.[1] ?? '';

const requiredThemeTokens = [
  '--surface-canvas', '--surface-panel', '--surface-raised',
  '--text-primary', '--text-secondary', '--text-muted',
  '--border-default', '--border-strong',
  '--interaction-primary', '--interaction-selection', '--interaction-focus',
  '--status-success', '--status-warning', '--status-error', '--status-info',
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

test('density and typography contracts are present', () => {
  assert.match(globals, /--density-control-height:/);
  assert.match(globals, /--density-row-height:/);
  assert.match(globals, /--density-workspace-gap:/);
  assert.match(globals, /html\[data-density=['"]compact['"]\]/);
  assert.match(globals, /html\[data-density=['"]comfortable['"]\]/);
  assert.match(globals, /--font-mono:\s*var\(--font-ibm-plex-mono\)/);
  assert.match(globals, /html\s*\{[^}]*color-scheme:\s*light/s);
  assert.match(globals, /html\.dark\s*\{[^}]*color-scheme:\s*dark/s);
});

test('layout bootstraps appearance without a forced dark server class', () => {
  assert.match(layout, /IBM_Plex_Mono/);
  assert.match(layout, /--font-ibm-plex-mono/);
  assert.match(layout, /CAREZ_APPEARANCE_BOOT_SCRIPT/);
  assert.match(layout, /CarezAppearanceProvider/);
  assert.match(layout, /suppressHydrationWarning/);
  assert.doesNotMatch(layout, /GeistMono/);
  assert.doesNotMatch(layout, /className=\{[^\n]*\bdark\b/);
});
```

- [ ] **2. Run and confirm expected failure.**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/ui-token-contract.test.ts
```

- [ ] **3. Replace the dark-only token block in `app/globals.css` with the Precision Grid contract.**

Keep existing imports and unrelated specialized/reduced-motion rules. Use this token architecture:

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

Change the build-identity font declaration to:

```css
font: 600 9px/1.2 var(--font-ibm-plex-mono), ui-monospace, SFMono-Regular, Consolas, monospace;
```

Keep the existing reduced-motion rule.

- [ ] **4. Update `app/layout.tsx` without changing shell behavior.**

Preserve current metadata/build identity and `takeoff-v3.css`; replace Geist/forced-dark wiring with:

```tsx
import type { Metadata } from 'next';
import { IBM_Plex_Mono, Inter } from 'next/font/google';
import { CarezAppearanceProvider } from '@/components/carez/appearance-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { CAREZ_APPEARANCE_BOOT_SCRIPT } from '@/lib/ui/appearance';
import './globals.css';
import './takeoff-v3.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
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

  return <html lang="en" suppressHydrationWarning className={`${inter.variable} ${ibmPlexMono.variable}`}>
    <head>
      <script dangerouslySetInnerHTML={{ __html: CAREZ_APPEARANCE_BOOT_SCRIPT }} />
    </head>
    <body className={inter.className}>
      <CarezAppearanceProvider>
        <TooltipProvider>{children}</TooltipProvider>
      </CarezAppearanceProvider>
      {showBuildIdentity && <div className="carez-build-identity" aria-label="Non-production build identity">
        {environmentLabel} · {branch || 'detached'} · {shortSha || 'unknown'}
      </div>}
    </body>
  </html>;
}
```

Do **not** remove the now-unused `geist` package in this subproject; that is unrelated lockfile cleanup.

- [ ] **5. Run token + appearance tests and typecheck; expect PASS.**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/ui-appearance.test.ts tests/ui-token-contract.test.ts
pnpm typecheck
```

- [ ] **6. Commit Task 3.**

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

- [ ] **1. Write the failing Settings integration contract.**

```ts
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const componentUrl = new URL('components/settings/AppearanceSettings.tsx', root);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');

test('Settings exposes Carez appearance preferences', () => {
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

Run and expect FAIL:

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/ui-settings-appearance.test.ts
```

- [ ] **2. Create `components/settings/AppearanceSettings.tsx`.**

```tsx
'use client';

import { useCarezAppearance } from '@/components/carez/appearance-provider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">Follow this device or use an explicit Carez light/dark theme.</p>
      </div>
      <Select value={themePreference} onValueChange={value => {
        if (value === 'light' || value === 'dark' || value === 'system') setThemePreference(value);
      }}>
        <SelectTrigger className="w-full" disabled={!ready} aria-label="Carez theme"><SelectValue /></SelectTrigger>
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
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">Sets your baseline spacing. Specialist workspaces may enforce safe density limits.</p>
      </div>
      <Select value={densityPreference} onValueChange={value => {
        if (value === 'default' || value === 'compact' || value === 'comfortable') setDensityPreference(value);
      }}>
        <SelectTrigger className="w-full" disabled={!ready} aria-label="Carez density"><SelectValue /></SelectTrigger>
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

- [ ] **3. Integrate it into `app/settings/page.tsx` without redesigning Settings.**

Add import:

```tsx
import { AppearanceSettings } from '@/components/settings/AppearanceSettings';
```

Immediately after Company Branding and before Connections:

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

- [ ] **4. Run Settings test and typecheck; expect PASS.**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/ui-settings-appearance.test.ts
pnpm typecheck
```

- [ ] **5. Run all four new contract tests.**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test \
  tests/ui-authority-contract.test.ts \
  tests/ui-appearance.test.ts \
  tests/ui-token-contract.test.ts \
  tests/ui-settings-appearance.test.ts
```

- [ ] **6. Commit Task 4.**

```bash
git add tests/ui-settings-appearance.test.ts components/settings/AppearanceSettings.tsx app/settings/page.tsx
git commit -m "feat(settings): add Carez appearance preferences"
```

---

## Task 5: Run the complete automated foundation gate and deploy staging

**Files:** none unless a failing check proves a bounded correction is required.

- [ ] **1. Confirm only expected Subproject 1 files changed across the four task commits.**

```bash
git status --short
git diff --stat HEAD~4..HEAD
```

- [ ] **2. Run all new foundation tests.**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test \
  tests/ui-authority-contract.test.ts \
  tests/ui-appearance.test.ts \
  tests/ui-token-contract.test.ts \
  tests/ui-settings-appearance.test.ts
```

Expected: PASS.

- [ ] **3. Run full repository validation.**

```bash
pnpm check
```

Expected: typecheck, all domain tests, and production build PASS.

- [ ] **4. Verify no dependency/lockfile mutation.**

```bash
git diff --exit-code HEAD~4..HEAD -- package.json pnpm-lock.yaml
```

Expected: no diff.

- [ ] **5. Verify this slice did not change shell navigation or domain/database source.**

```bash
git diff --name-only HEAD~4..HEAD | grep -E '^(components/AppShell\.tsx|supabase/|lib/domain/|lib/takeoff/conditions/)' && exit 1 || true
```

Expected: no output.

- [ ] **6. Integrate/push only to canonical `staging`.**

If the executor used a temporary implementation branch, merge it into current `staging`, delete it, then push `staging`. Nik must not test a feature-branch preview.

- [ ] **7. Record the application SHA that will be browser-tested.**

```bash
git rev-parse HEAD
```

Store this exact value in the execution notes as the **browser-test application SHA**. It is distinct from the later documentation-only `CURRENT_STATE.md` reconciliation commit.

- [ ] **8. Wait for the stable staging alias to report this application SHA before browser QA.**

```text
https://carez-concrete-os-git-staging-seancolmes-projects.vercel.app
```

A READY deployment serving a different build identity is not acceptable evidence.

---

## Task 6: Browser-verify, obtain user acceptance, then reconcile Current State and close Issue #63

**Files after PASS only:**
- Modify: `docs/CURRENT_STATE.md`
- GitHub: comment/close Issue #63

If the executor cannot use an authenticated browser, stop after Task 5 and hand browser QA to `99 — QA / Release / Debugging`. Do **not** update `CURRENT_STATE.md` or close Issue #63 until the same stable staging build is verified and Nik accepts it.

### Browser acceptance

- [ ] **1. `/settings`: Appearance controls render and work by keyboard.**

Confirm Theme shows System/Light/Dark and Density shows Workspace default/Compact/Comfortable. Tab to both Selects; open/select/close by keyboard; confirm visible focus.

- [ ] **2. Explicit Light persists without a forced-dark flash.**

Select Light and confirm root state:

```text
data-theme-preference="light"
data-theme="light"
class does not contain "dark"
style.colorScheme === "light"
```

Reload. The preference must persist and the first visible frame must not be forced dark.

- [ ] **3. Explicit Dark persists.**

Confirm:

```text
data-theme-preference="dark"
data-theme="dark"
class contains "dark"
style.colorScheme === "dark"
```

Reload and confirm persistence.

- [ ] **4. System follows OS/browser color-scheme changes live.**

Select System. Emulate Light → Dark → Light without reload. `data-theme`, `.dark`, and `style.colorScheme` must update each time while `data-theme-preference` remains `system`.

- [ ] **5. Density root state persists.**

Cycle Compact → reload → Comfortable → reload → Workspace default. Confirm `data-density` and computed values for:

```text
--density-control-height
--density-row-height
--density-workspace-gap
```

This slice does not require every existing component to consume density yet; that is Subproject 3.

- [ ] **6. Smoke representative existing surfaces in both themes.**

At minimum:

```text
/settings
/
/projects
/takeoff/[an existing accessible setId]
```

Check readable contrast, inputs, buttons, menus/popovers, Switch, table/Data Grid content, focus/selection state, and no obvious hard-coded theme collision. This is token-foundation acceptance, not later route/shell redesign approval.

- [ ] **7. Handle specialized-style defects only from evidence.**

If `app/takeoff-v3.css` or another specialized stylesheet causes an observed light-theme defect, record exact route/selector/evidence in Issue #63, make only the bounded correction, re-run `pnpm check`, redeploy, and repeat the affected checks. Do not rewrite specialized rendering CSS wholesale.

- [ ] **8. Obtain Nik's PASS on the browser-test application SHA recorded in Task 5.**

Do not proceed to Current State reconciliation without explicit user acceptance.

### Current State reconciliation after PASS

- [ ] **9. Update `docs/CURRENT_STATE.md`.**

Set:

```md
Last reconciled: 2026-09-15
```

Replace the protected-baseline UI authority bullet with:

```md
- ADR-024 Precision Grid is the active application visual/theme/token/density authority. ADR-016 remains the currently implemented shell until the dedicated role-adaptive shell/navigation subproject replaces it; ADR-020 plus the active Takeoff module spec remain authoritative for Takeoff/workstation/domain invariants.
```

Replace the stale Issue #44-open statement with:

```md
Issue #44 is **accepted/closed** at staging SHA `388b8f35682ddd23c9c9f69a907d65d724e63fa2`; the prior dark-shadcn route conversion, compatibility-layer removal, and route-family browser acceptance are historical baseline, not an active implementation gate.
```

Add:

```md
Issue #63 — Precision Grid canonical authority + token foundation — is accepted on staging. The accepted foundation includes first-class Light/Dark/System preference, pre-hydration theme resolution, device-local appearance persistence, Inter + IBM Plex Mono typography roles, Precision Grid semantic light/dark tokens, root default/compact/comfortable density state, and Settings appearance controls. This does not imply that the later role-adaptive shell, project-context layer, shared-component expansion, or route/module redesign slices are implemented.
```

Replace the old Issue #44 UI priority with:

```md
1. Continue the approved Carez OS major UI/UX redesign through the next independently planned subproject: Global shell + navigation context. Preserve ADR-024 and the accepted Issue #63 foundation while doing so.
```

Keep non-UI priorities in their existing relative order unless independently verified state changed.

- [ ] **10. Commit/push the Current State reconciliation.**

```bash
git add docs/CURRENT_STATE.md
git commit -m "docs: record Precision Grid foundation acceptance"
git push origin staging
```

- [ ] **11. Record the final documentation SHA separately.**

```bash
git rev-parse HEAD
```

The Issue #63 comment must identify both:

1. the **browser-test application SHA** accepted in Step 8; and
2. this **final documentation SHA** containing the reconciled Current State.

Do not misrepresent the docs-only commit as the SHA that received the full browser interaction pass.

- [ ] **12. Post acceptance evidence to Issue #63 and close it completed.**

Use this body, substituting the two exact SHA values obtained from git commands:

```md
## Subproject 1 acceptance — PASS

Browser-accepted application SHA: <exact Task 5 application SHA>
Current-State reconciliation SHA: <exact Task 6 documentation SHA>

- ADR-024 and canonical UI authority reconciliation complete.
- Light / Dark / System preference and live System media-query response browser-verified.
- Appearance persistence and root density preference browser-verified.
- Precision Grid dual-theme semantic tokens and Inter / IBM Plex Mono foundation implemented.
- `pnpm check` PASS.
- Matching stable staging application build browser-verified and user accepted.
- `CURRENT_STATE.md` reconciled after acceptance.

This closes only Subproject 1. Role-adaptive shell/navigation, shared component/state expansion, reference slices, and module migrations remain separate follow-on subprojects.
```

If `gh` is available, obtain the values from git and post the body with `gh issue comment 63`, then:

```bash
gh issue close 63 --repo seancolmes/carez-concrete-os --reason completed
```

If `gh` is unavailable, use the connected GitHub issue tool with the same exact evidence and close reason.

---

## Final Verification Checklist

- [ ] ADR-024 exists and canonical docs reference it without contradiction.
- [ ] Issue #44 remains closed; Issue #63 owns this slice.
- [ ] No new runtime dependency or lockfile mutation.
- [ ] Appearance pure tests pass.
- [ ] System preference reacts live in browser.
- [ ] `app/layout.tsx` has no server-forced `.dark` class.
- [ ] Light and dark each define the complete semantic token families.
- [ ] Inter is normal UI; IBM Plex Mono is technical/mono.
- [ ] Root density state is `default | compact | comfortable` and persists.
- [ ] Settings Appearance is keyboard accessible.
- [ ] `pnpm check` passes.
- [ ] Stable staging serves the exact application SHA used for browser QA.
- [ ] `/settings`, `/`, `/projects`, and a current Takeoff set pass the token-foundation smoke in both themes.
- [ ] Nik explicitly accepts that application SHA.
- [ ] `CURRENT_STATE.md` is updated only afterward, with its docs SHA recorded separately.
- [ ] Issue #63 closes only after acceptance evidence is posted.
- [ ] No statement claims Subprojects 2–7 are implemented.

## Spec Coverage Self-Review

- Canonical authority reconciliation → Task 1.
- Semantic light/dark token architecture → Task 3.
- Light/Dark/System preference, pre-hydration resolution, persistence, live OS response → Tasks 2–4 and Task 6.
- Typography, spacing/radius, motion, semantic interaction/status tokens → Task 3.
- Root density primitives → Tasks 2–4.
- No shell/module migration → Global Constraints and unchanged-file boundary.
- No new dependency → Global Constraints and Task 5.
- Automated validation/build → Tasks 1–5.
- Stable-staging rendered acceptance → Task 6.
- Current-state truth only after verification → Task 6.

The plan contains no unresolved implementation decision. Browser-discovered defects follow an evidence-driven bounded correction path under Issue #63 rather than pre-authorized scope expansion.
