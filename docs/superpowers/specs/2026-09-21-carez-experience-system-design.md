# Carez Experience System — Command Deck with Spatial Blueprint Accents

Status: Approved design brief; implementation pending
Date: 2026-09-21
Authority: Nik visual review of PR #77 and explicit approval of the A+B hybrid direction
Branch: `astra/complete-ui-rewrite`
Related: Issue #76, PR #77, ADR-025

## 1. Purpose

Refine the Carez UI from a coherent but overly uniform enterprise application into a distinctive concrete-contractor operating system.

The target experience is:

> **Premium construction command center + selective futuristic construction technology.**

Carez should feel fast, decisive, alive, technically advanced, construction-specific, trustworthy for estimating/commercial work, and visually memorable without becoming a novelty interface.

The governing product rule is:

> **Operational pages should feel energized. Technical workspaces should feel focused. Customer-facing surfaces should feel premium.**

This phase is intentionally narrower than the first Issue #76 rewrite. It establishes the next experience language on three reference routes only: Today, Projects, and Documents.

## 2. Selected design approach

Three directions were considered:

1. **Command Deck** — strong operational hierarchy, action-led information, domain icons, live status, meaningful color, restrained motion.
2. **Spatial Blueprint** — selective technical linework, plan/geometry cues, layered depth, 2D-to-3D visual language.
3. **Kinetic Field System** — more pervasive motion, live transitions, status movement, field-first interaction.

The approved direction is:

- approximately **80% Command Deck**;
- approximately **20% Spatial Blueprint**;
- Kinetic behavior only where it materially communicates state or workflow.

Spatial/3D treatment is appropriate for Takeoff, customer markup, landing/login, selected hero areas, and future field-estimating experiences. It is not the default treatment for forms, accounting, pricing, or repetitive tables.

## 3. Protected boundaries

This phase does not change:

- database schema, RLS, tenant isolation, or source-of-truth rules;
- deterministic quantity, cost, pricing, or financial calculations;
- commercial lineage or immutable records;
- Production Quantity, Direct Cost, and Sell separation;
- human authority over scope, Conditions, means/methods, production assumptions, pricing, margin, budgets, approvals, or customer issue;
- Takeoff quantity authority in persisted stable 2D geometry;
- derived 3D verification-only behavior.

The current Takeoff workstation direction is accepted and is **not** a redesign target in this phase.

## 4. Scope

### In scope

- application-wide experience primitives needed by the three reference pages;
- typography hierarchy;
- section-heading language;
- shared tab treatment;
- meaningful icon language;
- restrained motion primitives;
- surface/depth treatment;
- empty-state treatment;
- Workspaces section-heading cleanup;
- Today;
- Projects;
- Documents.

### Out of scope

- Takeoff route-level redesign;
- Condition Issue behavior and routing;
- Estimate;
- Proposal;
- Billing;
- Owner Reports;
- Settings;
- Client Package Studio;
- Markup Sheet;
- Quick Estimate;
- login/landing;
- broad route migration;
- database/server/domain refactors.

## 5. Typography

Reduce Inter's dominance as the product personality.

Preferred primary interface/display direction: **Manrope**.

IBM Plex Mono remains available only where technical alignment materially helps, including identifiers, dimensions, numeric technical values, or other compact machine-like references.

Uppercase is no longer the default hierarchy mechanism.

Use sentence/title case for section names and workflow areas. Small uppercase labels may remain where they genuinely function as compact technical tags, but they must be exceptional rather than pervasive.

Examples:

- `CURRENT WORK` → **Current work**
- `ARCHIVE` + `Filed & Matched` → **Filed & matched**
- `INBOX` + `Review Queue` → **Review queue**

## 6. Shared section language

A first-class Carez section header may include:

- an optional domain icon;
- primary section title;
- supporting sentence;
- optional count, state, or action;
- stronger spacing and/or surface boundary.

Hierarchy should come from type scale, iconography, spacing, selective color, and surface treatment instead of stacked uppercase labels.

## 7. Tabs

The current minimal underline tab treatment is too ambiguous.

Create a reusable Carez tab language with:

- visible inactive surface or boundary;
- clear active fill and/or accent edge;
- stronger active text/icon state;
- hover response;
- short 150–250 ms active transition;
- visible keyboard focus;
- clear disabled state;
- compact geometry suitable for dense workspaces.

Tabs must remain shadcn/Base UI compatible and accessible.

This shared treatment may later be propagated to other routes, but this phase should not cause route-level redesign outside the three reference pages.

## 8. Icon language

Increase icon use where it improves recognition.

Appropriate semantic categories include:

- project/job state;
- schedule;
- crew/field activity;
- cash/customer balance;
- bids;
- concrete scope;
- document type;
- upload/capture;
- invoice/payment/retainage;
- issue/status;
- scope/Condition.

Do not add icons decoratively beside every line of text.

## 9. Motion

Motion must answer one of these questions:

- What changed?
- What is active?
- Where did this item go?
- What requires attention?

Allowed:

- 150–250 ms surface lift;
- active-tab transitions;
- number transitions on meaningful summary values;
- expandable operational cards;
- status movement;
- subtle live-field pulse;
- queue-item movement;
- file-processing transitions;
- drawer/sheet movement;
- contextual focus/highlight.

Not allowed:

- perpetual decorative animation;
- floating-card gimmicks;
- looping gradients;
- parallax across work pages;
- motion that delays estimating or operational tasks.

`prefers-reduced-motion` remains mandatory.

## 10. Surface and depth language

Use three primary depth levels:

1. canvas;
2. operational surface;
3. interactive/selected surface.

Interactive surfaces may use stronger border, subtle elevation, accent edge, richer background, or restrained shadow.

Static information should remain calmer.

Avoid nested-card wallpaper.

## 11. Workspaces directory

Preserve the current Workspaces composition and grouped two-column structure.

Remove numeric prefixes such as `01`, `02`, etc. from workspace group headings.

Retain:

- group names;
- destination icons;
- descriptions;
- active state;
- pinning behavior;
- keyboard/accessibility behavior.

## 12. Projects reference page — Operations Board

Projects should feel like a place where work is dispatched, not a generic CRUD table.

Preserve all current:

- data queries;
- metrics;
- sorting;
- filtering;
- keyboard behavior;
- route actions;
- project preview/sheet behavior;
- authoritative project state.

### Top area

Replace equal-weight metric boxes with a compact operational pulse showing the most important company-level job signals, for example:

- active;
- ready;
- blocked/holds;
- active field crews/shifts;
- customer money requiring attention where useful.

Use icons and semantic state color without turning the whole header into colored cards.

### Main jobs surface

Keep the professional information density of the current table, but make each project row visually identifiable as an operational object.

Use:

- state rail/accent;
- project/job identity;
- stronger next-action hierarchy;
- schedule;
- crew/field activity;
- budget;
- customer balance;
- expressive hover/selection;
- semantic state color.

Suggested semantics:

- ready = green;
- active = Carez blue;
- planning = neutral/cyan;
- hold = amber/red;
- complete = subdued.

### Empty state

Do not render a large dead bordered rectangle.

The empty state should explain what creates the first operational project and provide relevant actions such as direct job or proposals, without inventing records.

## 13. Today reference page — Daily Command Center

Today is the highest-energy operational page.

Preserve all existing authoritative data and actions.

### Hero

Use a concise day/greeting/status treatment driven by real state, such as:

- “Good morning, Nik.”
- “Everything clear today.”
- “3 things need your attention.”

Do not fabricate activity or status.

### Priority stream

Management attention should read as a priority/activity stream rather than a generic static bordered panel.

Where data exists, show ordered actionable items with project, action, time/state, and relevant status.

Where empty, show a positive clear-state message rather than an empty-dashboard message.

### Operations pulse

Ready, active, blocked, customers owe, and near-term cash may use distinct but coordinated visual identities.

One-time counter transitions on page entry are acceptable if motion preferences allow.

### What moves next

Emphasize actual next project/field actions rather than another passive container.

### Bottom modules

Bid Pipeline and Operational Cash Attention must be deliberate grid siblings:

- aligned height;
- aligned baseline;
- consistent internal spacing;
- each visually distinct by domain, not by arbitrary component divergence.

## 14. Documents reference page — Evidence Hub

Documents should feel like an evidence-processing workflow.

Preserve:

- existing upload fields and actions;
- matching behavior;
- review workflow;
- accounting rule text/logic;
- source linkage;
- security and persistence.

### Capture hero

Make evidence capture the primary interaction.

Support the mental model:

- Receipt;
- Concrete ticket;
- Invoice;
- Photo;
- Other.

The existing form may remain under or within the capture interaction, but the page should not open visually as a generic form.

### Workflow visualization

Communicate:

`Captured → Identify → Assign job → Match → Filed`

Only show states supported by actual workflow data.

### Review queue

Use recognizable document icons or thumbnails where available, with useful metadata and a clear next action.

### Filed & matched

Treat this as an evidence browser rather than another blank bordered block.

When populated, support dense browsing and filtering appropriate to the existing data.

### Empty states

Review Queue and Filed & Matched must have intentionally designed empty states with distinct identity.

Do not rely on uppercase `INBOX` / `ARCHIVE` labels to provide hierarchy.

## 15. Accessibility and responsive behavior

Retain or improve:

- WCAG AA minimum for normal text;
- stronger contrast for technical/financial values;
- keyboard navigation;
- visible focus;
- reduced motion;
- touch targets;
- mobile containment;
- horizontal table containment where necessary;
- light/dark/system support.

Desktop should feel like a command center. Mobile should remain field-first rather than shrinking the desktop composition literally.

## 16. Implementation strategy

Astra 6 should own the high-value creative implementation for:

- shared experience language;
- Today;
- Projects;
- Documents.

Small cleanup after Astra's pass should be handled directly in ChatGPT/Carez control-room work where practical, including:

- minor spacing;
- leftover uppercase labels;
- minor icon consistency;
- safe shared-tab propagation;
- Workspaces numbering cleanup if Astra leaves remnants.

Do not spend Astra/Codex budget on low-level cleanup that does not require their larger context or implementation capacity.

## 17. Validation

For the Astra reference implementation:

- targeted tests during work;
- `pnpm typecheck`;
- relevant UI validation;
- GitHub Actions;
- branch preview;
- browser QA for Today, Projects, Documents;
- desktop and mobile;
- light and dark;
- reduced-motion sanity check where practical.

PR #77 remains draft. Do not merge to `staging` until Nik visually approves the revised reference experience.

## 18. Acceptance criteria

The reference pass is acceptable when:

- Today, Projects, and Documents no longer feel like the same generic page template;
- Today creates clear operational energy without decorative noise;
- Projects reads as a live operations board while preserving serious data density;
- Documents reads as an evidence workflow rather than a form page;
- section hierarchy no longer depends on pervasive uppercase labels;
- tabs are unambiguously interactive;
- Workspaces section numbering is removed;
- icons improve recognition without becoming wallpaper;
- motion is purposeful and restrained;
- both themes remain readable and coherent;
- Takeoff is not regressed;
- no domain/data authority is altered.

## 19. Deferred follow-on projects

These are explicitly separate architectural projects:

1. Takeoff refinement: tab visibility and Condition Issue language/routing.
2. Client Package Studio: internal estimate, customer proposal, markup sheet, attachments, preview, issue.
3. Quick Estimate: field-first small-job estimating and conversion into normal Carez lineage.
4. Landing/login interactive refinement.
