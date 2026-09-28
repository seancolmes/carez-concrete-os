# ADR-027 — PourTrace color system

Status: **Accepted**  
Date: 2026-09-28  
Authority: Nik's approved revised PourTrace palette

This decision supersedes the color directions in ADR-024, ADR-025, earlier design explorations, and older Carez UI skill text. ADR-025 continues to govern workspace structure and interaction where compatible.

The approved logo asset is `public/brand/pourtrace-logo-approved.png`. Its pixels and alpha are authoritative. Do not recolor it or place an artificial white rectangle behind it.

| Role | Light | Dark |
| --- | --- | --- |
| App background | `#F5F7F6` | `#121212` |
| Top shell | `#FFFFFF` | `#181A1B` |
| Surface 1 | `#FFFFFF` | `#1E2123` |
| Surface 2 | `#EFF2F0` | `#25292C` |
| Surface 3 | `#E6EAE8` | `#2D3236` |
| Hover | `#E9EDEA` | `#32383C` |
| Soft divider | `#E1E6E3` | `#292D30` |
| Border | `#D4DBD7` | `#343A3F` |
| Strong border | `#B9C3BE` | `#465058` |
| Primary text | `#171B19` | `#F4F6F5` |
| Secondary text | `#525C57` | `#B6BEBA` |
| Muted text | `#7B8580` | `#7C8580` |
| Success | `#347A46` | `#6DBB77` |
| Warning | `#8A610B` | `#D5A94A` |
| Danger | `#B84558` | `#E06B74` |
| Info | `#426F93` | `#6F9FC6` |

Brand accent is `#009966` in both themes; brand strong is `#007A52` for primary buttons and light-mode links; hover is `#00AD73`. Use `rgba(0,153,102,.10)` only for limited active-state tint. Brand green is not a panel background. Light semantic tints are success `#EAF5EC`, warning `#FFF5D9`, danger `#FBECEF`, and info `#EAF2F8`.

`app/globals.css` owns the application tokens. All routes and shared components consume those tokens. Drawing colors must retain labels, symbols, or line styles that carry their meaning independently of hue.
