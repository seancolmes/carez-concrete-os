# Pourtrace Titanium — product-wide design target

Status: **proposal awaiting Nik's approval for product-wide implementation**. Nik approved the Titanium *visual direction* on 2026-09-26. This document and its representative desktop/mobile layouts make the proposed rollout target reviewable. The working [prototype](castline-titanium-prototype.html) is a layout and responsive-behavior reference; the approved [Titanium concept](castline-silver-b-titanium.png) sets its richer metallic finish. All example project labels and plan geometry are illustrative. Pourtrace is the current product name; the supplied black logo awaits palette approval.

## 1. Product frame and navigation

- The product displays **CASTLINE**. Use a typographic wordmark until Nik supplies or approves a final logo asset.
- One horizontal global bar exposes exactly Today, Preconstruction, Projects, Field, Production, Finance, System. Search and account/project context occupy the right end when space allows. No global left rail, duplicated domain directory, or bottom navigation.
- Mobile uses a top Menu that exposes the same seven domains. Each domain keeps its contextual tabs immediately under its page header; horizontal overflow is explicit and scrollable. Deep links and browser history remain meaningful.
- Project context appears where needed; opening a domain does not silently change the selected project. Detail routes remain bookmarkable.

## 2. Titanium material and tokens

| Role | Proposed treatment | Use |
| --- | --- | --- |
| App canvas | graphite `#111419` to `#252b31` gradient | Full workspace background; quiet enough for long sessions |
| Top chrome | silver `#5d646a` → gunmetal `#363d44` → near-black `#191e24` | One global navigation bar; gradients are confined to chrome |
| Work panels | `#282e34` / `#323940` | Registers, tool panes, forms, and contextual detail |
| Primary text | `#f0f2f3` | Headings, data, actions |
| Secondary text | `#c8cdd1` | Descriptions and supporting labels |
| Dividers | `#4b535b`; stronger edge `#748089` | Flat line-grid and pane boundaries |
| Selected / focus | titanium `#707a82` with silver `#eef7fb` focus and restrained halo | Current domain, selected row, selected plan geometry, keyboard focus |

Gradients carry material depth in the top bar, section header, and primary action. Glows mark current focus or selected measurement and appear with a subtle offset/blur. Ordinary rows remain flat. Hold, ready, error, and success states use labels and icons as well as restrained semantic tint; color alone never carries meaning. No orange or saturated brand accent.

## 3. Typography, spacing, and components

- Use a clear UI sans for all operating text, with tabular numerals for money, quantities, time, and dimensions. Reserve monospace for identifiers or aligned technical values. The display wordmark may use a separately approved face; generated logo art is not the asset.
- Desktop: compact 36–42 px operational rows, 24–28 px workspace gutters, and a large uninterrupted task surface. Mobile: 44–48 px minimum touch targets, 12–16 px gutters, and a single primary task flow per viewport.
- Use square to low-radius controls, 1 px dividers, aligned table columns, and concise contextual tabs. A register is a table on desktop; on a narrow phone each row becomes a labeled record with actions, not a horizontally clipped spreadsheet.
- Forms expose label, unit, help, validation, and disabled/loading state next to the control. Selection, hover, keyboard focus, empty, loading, error, and permission states use one consistent vocabulary. Status text is explicit: Hold, Ready, Planning, Submitted, Draft, etc.
- Component architecture is under review. Nik favors Radix Primitives plus custom Stitches styling for its developer experience. Pilot that pairing on a small Pourtrace-owned vertical slice before selecting it for the whole app; verify Next.js 15 server rendering, hydration, responsive states, keyboard behavior, and bundle impact. Keep existing source-owned primitives available during a gradual migration. This visual approval alone does not authorize a wholesale library replacement.
- Use 150–250 ms transitions only when state changes, panes open, or a selected item moves into context. Respect reduced motion. No looping glow or page-load choreography.

## 4. Representative operating screens

### Today / main shell

Desktop: attention work first, scheduled field activity second, active projects beneath. Each row points to its owning workflow. Mobile: attention and today's work become one-column action lists. No greeting hero, invented KPIs, repeated domain shortcuts, or persistent secondary global navigation.

### Preconstruction / dense Takeoff and Estimate

Desktop: contextual Opportunities / Takeoff / Estimate / Proposal views under the top bar. In Takeoff, Conditions, drawing tools, dominant plan, and governed properties are coordinated. The selected Condition and geometry remain clear; persisted page-coordinate 2D measurement stays quantity authority. The dark Titanium drawing stage frames the PDF, but real PDF content is shown faithfully rather than inverted by theme. Estimate and proposal use compact registers and clear review/issuance states without changing calculations or human authority.

Mobile: plan and current tool appear before secondary detail; Conditions open as an on-demand control and properties follow the drawing. Drawing tools scroll horizontally with visible affordance. Avoid hiding calibration or measurement state behind an unlabeled gesture. Editing capability remains bounded by the existing Takeoff contract.

### Projects and Field

Desktop Projects: operations board with project, state, next work, and a reason/action column; selecting a row exposes job context without duplicating the global nav. Setup, Documents, Changes, and reporting remain contextual internal views. Change orders retain commercial lineage.

Mobile Field: project context, submitted time review, work readiness, and daily log actions have generous touch targets. Holds state the blocking reason and the next human action. No invented automatic inspection clearance or sign-off.

### Finance / Billing

Desktop: invoice, payment, retainage, and setup actions lead a job billing register with Authorized, Not billed, Billed, Still owed, and Collected. Amounts remain server-authoritative and distinct from production quantity/direct cost/sell. Mobile: actions precede labeled per-job balance records. Dense finance tools remain contextual under Finance.

The current source does not show a Schedule of Values/payment-application workflow. This design target does not invent one; a later SOV product design would require its own domain scope and approval.

## 5. Changes and preserved behavior

Change: Carez-facing branding to Pourtrace; Steam Sleek styling to Titanium; left global rail to one top navigation system; page composition and responsive presentation across all route groups; generic card-heavy sections to task-led registers/workspaces; shared visual components and states.

Preserve: seven-surface information architecture, legitimate URLs and record detail, permissions and tenant boundaries, plan-coordinate 2D Takeoff authority, deterministic quantity/cost/pricing/financial calculations, and human final authority over Conditions, methods, production, margin, billing, and approval.

## 6. Route rollout and visual QA

The [route ledger](REDESIGN_ROUTE_LEDGER.md) tracks all 69 page entries. After approval, implement shared tokens/branding/top shell first, then Preconstruction, Projects/Field, Production, Finance, and System/public flows in coherent groups. For each group, inspect populated and empty desktop/mobile states and run targeted checks, `pnpm typecheck`, and `git diff --check`. Preserve the intentional local tree and do not commit or publish.

Signed-in local visual review is still pending because the current local browser reached login. The concept/prototype captures are design evidence, not proof that production routes already match.

## 7. Decision status

**Nik approved:** Pourtrace name; top global navigation; full desktop/mobile overhaul; gradients and glows; silver direction; Titanium Concept B.

**Nik rejected or superseded:** Carez as displayed name; Steam Sleek as target; orange; Cobalt Current, Mineral Green, Graphite Lime; left global navigation rail. Satin Silver and Monochrome Atelier were alternatives Nik did not select.

**Awaiting approval:** this product-wide Titanium layout and responsive target. The Radix + Stitches architecture is a candidate pending an in-app compatibility pilot. Final wordmark artwork remains open; a text wordmark is the default for implementation.
