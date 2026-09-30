# Plan 004: Support dark and light workspaces

> Executor: The user explicitly selected both dark and light workspaces. Preserve the current uncommitted dark implementation as the dark baseline. This plan was written at commit 4a0f104d; inspect the working tree and stop on material drift. Do not switch branches, commit, or change external services.

## Status

- Priority: P1
- Effort: M-L
- Risk: Medium; scattered literal dark styles can make one theme unusable
- Depends on: none
- Category: theming and design system
- Confidence: High

## Why this matters

The current bootstrap forces dark mode before paint, Ant Design always uses its dark algorithm, and key workspaces set literal black backgrounds and light text. The newly requested light workspace cannot be delivered by changing one global class. Both themes need the same meaning, focus, selection, status, and density behavior.

## Current state

- app/globals.css:75-105 defines black/dark root tokens; :248-249 defines only dark color-scheme; :288 hardcodes the document background and scheme.
- lib/ui/appearance.ts:18-22 forces data-theme, the dark class, and colorScheme to dark.
- components/PourtraceAntProvider.tsx:7-14 always selects darkAlgorithm and literal dark colors.
- components/settings/AppearanceSettings.tsx:1-8 only describes the dark theme.
- components/takeoff/IntegratedTakeoffConditionWorkspace.module.css:1 declares literal black, #0A0A0A, #111, light text, and color-scheme:dark. components/opportunities/views/OpportunitySectionNav.tsx:4-5 similarly hardcodes dark buttons.
- DESIGN.md still describes a different light/dark palette; ADR-028 documents the current local dark direction but says browser acceptance remains pending.

## Scope

In scope: the appearance preference/bootstrap/provider, semantic CSS tokens, the shared shell and the estimating pilot surfaces needed by plan 005, Settings control, and the design-system documentation describing both themes.

Out of scope: calculations, persisted Takeoff geometry, customer proposal/PDF paper content, and blanket restyling of unvisited modules in this first pass. Later route rollout must consume the new tokens.

## Steps and gates

1. Define semantic tokens for canvas, panel, raised control, border, text, secondary text, selection, focus, success, warning, error, and link in both themes. Retain ADR-028's dark values as the dark baseline. Use the Windows client screenshots for light workbench hierarchy and the Portal screenshots only for reports/library patterns; screenshot colors are approximate and not authoritative tokens.
2. Restore a stored appearance preference with a safe first-paint default, a visible Settings control, and a light/dark choice. Apply the matching document class, color-scheme, and Ant Design algorithm/tokens in one coherent state change. Verify reload persistence, system text scaling, and no flash of the opposite theme.
3. Convert the pilot shell, Opportunity controls, and Takeoff workstation from literal dark values to semantic tokens. Keep selected, hover, focus, disabled, warning, and error states discernible in both themes. Do not change geometry or money logic.
4. Update DESIGN.md and the relevant ADR status/decision record to reflect the user's dual-theme direction while preserving the historical ADR text and pending acceptance status. Verify the docs accurately describe implemented tokens.
5. Run pnpm typecheck and the existing focused UI appearance/token tests. Expected: exit 0. Do one desktop and one mobile review in each theme, including a populated grid, empty state, dialog, form error, and Takeoff plan. Check normal text contrast against 4.5:1 and UI boundaries/focus against 3:1; record measured values rather than assuming from screenshots.

## Done criteria

- The user can select dark or light, reload, and retain the preference.
- Shared pilot surfaces and Ant Design controls use the same theme, including overlays.
- The dark baseline remains recognizable; light workbench content is legible and branded as PourTrace.
- Both themes pass the focused checks, and the final diff contains no unrelated behavior change.

## Stop conditions

- A component's literal colors carry a domain meaning that the semantic roles do not represent; add the missing role deliberately before replacing them.
- First-paint behavior or theme persistence requires an auth/storage policy change beyond local appearance preference.
- A global token change breaks customer-facing paper documents or public proposal content.

## Maintenance note

The design detector's color advisories currently compare against outdated DESIGN.md; rerun it after the documentation and tokens agree, then verify findings in context rather than accepting counts at face value.
