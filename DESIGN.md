---
name: PourTrace
description: A light Fluent-inspired desktop estimating workbench with optional charcoal dark surfaces and the approved PourTrace logo.
colors:
  light-canvas: "#F2F5F7"
  light-surface: "#FFFFFF"
  dark-canvas: "#182128"
  dark-surface: "#29343E"
  graphite: "#17212B"
  logo-green: "#009966"
  light-action: "#29485E"
  dark-action: "#EDEDED"
  light-link: "#205F85"
  dark-link: "#BED8EA"
typography:
  body:
    fontFamily: "Segoe UI Variable, Segoe UI, Fira Sans, Arial, sans-serif"
  display:
    fontFamily: "Roboto Slab, Georgia, serif"
  code:
    fontFamily: "Source Code Pro, Cascadia Code, Consolas, monospace"
rounded:
  sm: "4px"
  md: "6px"
spacing:
  micro: "4px"
  grid: "8px"
---

# PourTrace design system

## Color authority

`app/globals.css` is the token authority. Its `:root` values provide the optional charcoal workspace; `html[data-theme='light']` supplies the first-use pale blue-gray workbench. The approved logo retains `#009966`; green elsewhere signals actual success. Primary buttons use a solid graphite-blue treatment in light mode and a light-neutral treatment in dark mode. Tabs, menus, lists, fields, and dialogs share compact desktop chrome with clear selected and focus states. Blue marks links and information; amber marks attention.

| Role | Light | Dark |
| --- | --- | --- |
| Workspace | `#F2F5F7` | `#182128` |
| Panel | `#FFFFFF` | `#29343E` |
| Raised control | `#F4F7F9` | `#313E48` |
| Primary text | `#17212B` | `#F2F5F7` |
| Secondary text | `#4C5C69` | `#C2CED7` |
| Selection | `#DFEAF3` with `#17212B` text | `#394955` with white text |
| Link and information | `#205F85` | `#BED8EA` |
| Control border | `#8293A1` | `#8395A3` |
| Focus | `#29485E` | `#EDEDED` |

Light status pairs are success `#EAF5EC` / `#27693D`, warning `#FFF3DC` / `#8A5700`, error `#FCECEE` / `#A1333D`, and information `#EAF2F8` / `#245E82`. Dark status pairs use charcoal-tinted panels and brighter status text. Ordinary money values use neutral text; green and red indicate an actual state or variance. Takeoff drawings and charts pair color with labels, line styles, or symbols. The user can save dark or light, or follow the device setting; light is the first-use default.

## Spatial and type rules

Keep the active drawing, record, or decision larger than its controls. The shared command navigation, contextual destination panel, and large task workspace form the operating frame. Avoid decorative gradients, repetitive cards, fake metrics, and permanently open inspectors. Use Segoe UI Variable or Segoe UI for controls and records, Roboto Slab sparingly for page headings, and Source Code Pro for technical content. Existing density tokens set row and control heights without changing hierarchy. Floating surfaces alone need strong shadow; ordinary panels use tonal layers and thin borders.

## Accessibility

The intended minimum is 4.5:1 for normal text and 3:1 for interface boundaries and focus. Preserve visible focus, text labels, and non-color cues on dense estimating screens and outdoor mobile views. Customer-facing paper documents remain white independently of the workspace preference.
