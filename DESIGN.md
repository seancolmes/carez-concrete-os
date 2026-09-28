---
name: PourTrace
description: A concrete-neutral workspace with restrained green signals for concrete estimating and operations.
colors:
  light-canvas: "#FAFAF8"
  light-surface: "#FFFFFF"
  dark-canvas: "#191F21"
  dark-surface: "#2B3033"
  graphite: "#2B3033"
  logo-green: "#13A95A"
  light-action: "#08783F"
  dark-action: "#78D7A0"
  light-link: "#195570"
  dark-link: "#86C7DB"
typography:
  body:
    fontFamily: "Fira Sans, Segoe UI, Arial, sans-serif"
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

The supplied PourTrace tonal palettes are implemented as `--trace-green-*`, `--concrete-*`, `--blueprint-*`, and `--amber-*` in `app/globals.css`. Graphite and concrete neutrals carry the working interface. Green 500 belongs to the logo and small highlights; green 700 carries normal-size text and white-label primary buttons in light mode. Green 300 carries those roles in dark mode. Blue marks links, information, and secondary chart series. Amber marks attention and pending decisions.

| Role | Light | Dark |
| --- | --- | --- |
| Workspace | Neutral 50 | Neutral 950 |
| Raised surface | White | Neutral 900 |
| Primary text | Neutral 900 | Neutral 100 |
| Secondary text | Neutral 600 | Neutral 300 |
| Primary action | Green 700 with white text | Green 300 with neutral 950 text |
| Selection | Green 50 with green 700 text and indicator | Neutral 900 with green 300 text and indicator |
| Link and information | Blue 700 | Blue 300 |
| Standard border | Neutral 300 | Neutral 700 |
| Focus | Green 700 | Green 300 |

Status pairs in light mode: success `#EFFAF3` / `#08783F`; warning `#FFF4D9` / `#805100`; error `#FDEAE8` / `#A42C27`; information `#EFF7FA` / `#195570`. Dark status chips use neutral 900 with brighter semantic text. Ordinary money values use neutral text; green and red indicate an actual state or variance. Takeoff drawings and charts pair color with labels, line styles, or symbols.

## Spatial and type rules

Keep the active drawing, record, or decision larger than its controls. The shared command navigation, contextual destination panel, and large task workspace form the operating frame. Avoid decorative gradients, repetitive cards, fake metrics, and permanently open inspectors. Use Fira Sans for controls and records, Roboto Slab sparingly for page headings, and Source Code Pro for technical content. Compact and comfortable density settings change row and control heights without changing hierarchy. Floating surfaces alone need strong shadow; ordinary panels use tonal layers and thin borders.

## Accessibility

The intended minimum is 4.5:1 for normal text and 3:1 for interface boundaries. Green 500 on white is insufficient for ordinary text; use green 700. Preserve visible focus, text labels, and non-color cues on dense estimating screens and outdoor mobile views.
