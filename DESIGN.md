---
name: PourTrace
description: Light-only contractor workspaces using the supplied QuoteIQ visual system.
colors:
  navy: "#1A2B55"
  navy-hover: "#243D73"
  amber: "#FEBD69"
  amber-text: "#B26A00"
  surface: "#FFFFFF"
  canvas: "#F2F5F9"
  alternate: "#F1F5F9"
  border: "#E0E6EF"
  text: "#232F3E"
  secondary: "#37475A"
  muted: "#6B7280"
  logo: "#E97832"
typography:
  body:
    fontFamily: "Inter, Arial, sans-serif"
    fontSize: "14px"
    lineHeight: 1.5
  title:
    fontFamily: "Inter, Arial, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.3
  label:
    fontFamily: "Inter, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 600
  work-title:
    fontFamily: "Inter, Arial, sans-serif"
    fontSize: "18px"
    fontWeight: 600
  data:
    fontFamily: "Inter, Arial, sans-serif"
    fontSize: "12px"
  caption:
    fontFamily: "Inter, Arial, sans-serif"
    fontSize: "11px"
  compact-status:
    fontFamily: "Inter, Arial, sans-serif"
    fontSize: "10px"
  code:
    fontFamily: "Source Code Pro, Cascadia Code, Consolas, monospace"
rounded:
  small: "6px"
  medium: "8px"
  large: "10px"
spacing:
  tight: "4px"
  small: "8px"
  gutter: "10px"
  control: "12px"
  section: "16px"
  desktop-inset: "20px"
components:
  button-primary:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.surface}"
    rounded: "{rounded.medium}"
  button-primary-hover:
    backgroundColor: "{colors.navy-hover}"
  navigation:
    height: "56px"
    backgroundColor: "{colors.surface}"
    typography: "{typography.label}"
  inline-detail:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.medium}"
    padding: "16px"
---

# PourTrace design system

## Overview

The user-approved replacement direction is the supplied QuoteIQ presentation: a light contractor work surface, compact horizontal navigation, navy commands, and restrained amber selection. This replaces the previous optional-dark and green design guidance. The orange PourTrace logo remains the identity asset.

**Creative North Star: "The working schedule"**

**Key Characteristics:**
- Real records and physical work dominate the available space.
- Thin lines and quiet surfaces organize controls without decorative metric cards.
- Clear state, quantity basis, and record context accompany every decision.

Implementation status: Nik accepted the shared shell, populated Schedule, and dialog/inline-detail foundation. Coordinated propagation and its local evidence are recorded in output/quoteiq-overhaul-20261016/REVIEW.md. Operational pilot approval remains separate from visual implementation.

## Colors

`app/globals.css` owns the normative CSS tokens. `CarezAppearanceProvider.tsx` maps Fluent's one light theme to those tokens. No theme selector, device preference, or saved dark preference may select another theme. Layout prepaint also forces light.

Navy carries primary actions and focus. Amber carries selected navigation and compact attention accents. Ordinary surfaces stay white or cool gray, with neutral text. Logo orange is preserved rather than becoming the action color.

**The Recorded State Rule.** Success, warning, and error colors communicate a recorded state and accompany words or symbols. The darker semantic warning foreground is used for readable normal text; accent amber text is not a substitute for contrast.

## Typography

Inter is the navigation, heading, form, and record face. The restrained hierarchy uses compact 20px page titles, 13px navigation and controls, and 12–14px schedule content. Tabular figures align quantities, dates, and amounts. Source Code Pro is retained for actual technical data; it is not the operational chrome font.

## Layout

The shared horizontal shell is 56px high. Desktop workspaces use 20px outer insets, reduced to 12px on narrow screens. Related controls share a compact title/action band. Local tabs wrap at phone width rather than forcing page panning.

Schedule groups its identity, scale, displayed range, period navigation and existing actions in one white work surface. Field context and local navigation share a compact desktop row. The exact governing hold reason and job link remain immediately above the grid. Wide desktop uses a 208px identity lane and an ordinary in-flow 208px agenda separated by a 10px gap. Necessary timeline panning stays inside that surface. On phones, full work records precede the confined timeline without repeating the panel's title and count.

Day, Week and Month are timeline scales. Previous, Next and Today navigate bounded windows over already-loaded dates; range labels and record counts describe that window. The full existing register retains its own horizon and filters. Textual staffing risk accompanies schedule status in desktop blocks, the agenda and inline detail. These are functioning controls over existing data, not a copied showcase calendar or a new scheduling authority.

Takeoff is desktop-only at 1024px and wider. Narrow entry shows only a desktop-required message and contextual return link. A desktop workspace that is resized narrow retains its mounted state while its content and Fluent portals are hidden. The return to desktop must restore the full workspace. No mobile Takeoff workstation is supported.

## Elevation & Depth

Ordinary work surfaces use thin borders and tonal separation. Transient dialogs and menus use the shared soft offset shadow. Do not give every section floating-card treatment. No decorative gradients or glass effects.

## Shapes

Internal controls and working containers use the extracted small-to-large radius scale. Account avatars retain their circular identity treatment. Borders are thin; forms remain clearly distinct from read-only record text.

## Components

- **Navigation:** horizontal labeled destinations on desktop, with the selected domain distinguished by amber-tinted fill and navy text. Narrow navigation opens in a centered dialog.
- **Buttons:** navy primary action, quiet secondary action, visible keyboard focus, semantic disabled state. Preserve supported Fluent behavior and existing accessible IDs.
- **Fields:** bounded outlined Fluent fields with readable labels. Long native choices cannot enlarge the dialog. Textareas and labels wrap; error messages remain tied to the existing validation.
- **Status:** compact text with semantic color; never imply clearance from missing or failed reads.
- **Tables and phone rows:** aligned desktop data; phone lists expose full record identity, labels and actions without page-level panning.
- **Inline detail:** selection reveals brief record information in the working flow. It does not become a side-panel inspector.
- **Centered dialogs:** short tasks only, explicit Cancel or Close, internal vertical scrolling, Escape and focus return. Do not use edge-attached surfaces or drawers.
- **Unavailable states:** preserve independent read failures and known values. Missing schema is unavailable, not a fabricated empty workflow.

## Do's and Don'ts

- **Do** preserve record context, supported URLs, Back, unsaved work and keyboard access.
- **Do** keep quantity, direct cost, sell, recorded contract and accepted baseline meanings distinct.
- **Do** reuse shared token, header, field and dialog owners rather than adding another theme layer.
- **Don't** add drawers, slideovers, sheets or edge-attached forms at any width.
- **Don't** reactivate dark mode through OS preference, old saved settings, or a second provider.
- **Don't** recreate mobile Takeoff controls or substitute showcase interactions for real application behavior.
- **Don't** imply that foundation acceptance establishes completion of the remaining modules.
