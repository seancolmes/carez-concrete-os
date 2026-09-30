# ADR-028 — Dark estimating workspaces

Status: **Directed local implementation; browser and database acceptance pending**  
Date: 2026-09-29  
Authority: Nik's Estimating Edge directive and subsequent dark/light workspace choice

This directive supersedes ADR-027's application palette and theme preference. ADR-025 continues to govern the Command Rail, Domain Deck, contextual Command Bar, and large-workspace structure. ADR-020 continues to govern Takeoff quantity and geometry authority. The approved PourTrace logo asset and its green pixels remain unchanged.

## Presentation

The application canvas is `#000000`, ordinary panels are `#0A0A0A`, raised controls are `#111111`, hairline borders are `#222222`, and primary text is `#EDEDED`. Selected tabs and pills use `#111111` fill, a `#333333` border, white text, and a subtle inset top highlight. Green is reserved for the approved logo and semantic success evidence; it is not an active navigation or button fill. Metal and textured button variants, the drawing dock, transient toast, and ambient cursor glow remain available. Customer proposals and printable commercial documents retain a white paper sheet inside the dark application frame.

## Workspaces

Opportunities and Projects present a small set of real summary measures above mutually exclusive Overview, Commercial Baseline, Scope & Specs, and Activity sections. Detail data is requested for the selected section. Takeoff presents Assembly Setup, Tracing Engine, and Commercial Recap as mutually exclusive views. Tracing retains the plan, condition roster, and drawing tools without a pricing worksheet. Commercial Recap presents saved production quantities, direct cost, holds, and labor assumptions without the PDF.

Zustand holds only transient Takeoff navigation and interaction state. Persisted page-coordinate geometry, calibration, Condition drafts, and server-calculated quantities remain on their existing authoritative paths. Crew Days and labor-direct dollars per square foot are alternate inputs to the existing saved man-hours-per-unit assumption; conversion requires explicit crew parameters or a selected burdened labor rate. Supplier links grant access only to office-selected takeoff outputs for one quote, expire or can be revoked, and append quote evidence. Office selection remains necessary before a quote changes the estimate price source.

## Dual-theme direction — 2026-09-29

Nik subsequently chose to support both dark and light workspaces. The dark values and interaction style above remain the default and historical baseline. The application now offers a light estimating workbench with a pale blue-gray canvas, white panels, graphite-blue controls, and the same semantic status roles. The approved logo remains unchanged, and green remains reserved for the logo and success evidence. Appearance is a local workspace preference with dark, light, and device-setting choices; dark is the first-use default. `DESIGN.md` and `app/globals.css` describe the current token values. Browser and database acceptance remain pending.

## Windows desktop refinement — 2026-09-29

Nik chose a modern Windows desktop direction using the classic-stylesheets demo as an interaction reference: compact tabs, detailed lists, tree views, menus, panels, and dialogs with Windows 11 Fluent light styling. Light is now the first-use workspace preference. Dark remains selectable and uses layered charcoal surfaces rather than pure black. The Command Rail, Domain Deck, contextual Command Bar, and large workspace remain the application frame; specialist workspaces may use contextual desktop controls without adding a permanent sidebar. `DESIGN.md` and `app/globals.css` describe the current palette and control treatment. This refinement supersedes the dark-first palette and button treatment above; browser acceptance remains pending.
