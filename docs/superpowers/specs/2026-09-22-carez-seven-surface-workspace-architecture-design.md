# Carez Seven-Surface Workspace Architecture

**Status:** APPROVED DESIGN — implementation not yet authorized until written plan review.

## 1. Problem statement

Carez currently exposes too many implementation routes as equal workspace destinations. This creates excessive navigation density, duplicated controls, fragmented workflows, route architecture leaking into the user experience, uncertainty about where work belongs, multiple pages for one operating workflow, overwhelming workspace menus, and unnecessary context switching.

**ROUTES != NAVIGATION DESTINATIONS.** A capability does not earn a top-level page because it has a route, table, component, or data source.

## 2. Primary product model

Carez has exactly seven durable product-level operating surfaces: **Today; Preconstruction; Projects; Field; Production; Finance; System.** Global navigation exposes these domains, not every implementation route.

## 3. Today

Today is the operating command surface: management attention, scheduled or moving work, blockers, and what matters next. It is not a greeting dashboard, duplicate KPI page, or decorative hero. The oversized “Good morning, Nik,” “Everything clear today,” and zero-state greeting summary are reduced or removed in favor of a compact operational header that brings attention and scheduled production above the fold. This decision authorizes no new calculations.

## 4. Preconstruction workspace

Preconstruction contains these internal operating views:

- **Opportunities:** Leads, Lead Inbox, Bid Intelligence.
- **Takeoff:** plan sets/Takeoff list, active Takeoff workstation, and legitimate Assemblies/Assembly History.
- **Estimate:** estimates, estimate detail, pricing/labor review, Estimate Audit.
- **Proposal:** proposals and proposal workflow.
- **Job Setup:** a transition/handoff to Projects, not an independent global workspace.

Takeoff geometry and Conditions authority, estimating calculations, proposal lineage, and commercial record lineage remain unchanged. Record-detail routes remain direct URLs.

## 5. Projects workspace

Projects consolidates **Portfolio** (Projects), **Setup** (Job Setup), **Documents**, **Changes** (Change Orders), and contextual **Owner / Reporting** views. Work Package visibility may be contextual for project use, but authoritative Production workflow remains in Production. A capability is not duplicated across domains without a clear contextual reason.

## 6. Field workspace

Field contains **Schedule** (Schedule and 21-day Look Ahead), **Readiness** (Work Readiness and Materials / Resources), **Crew** (Crew and administrative/contextual Employee Access), and **Field Control**. Existing schedule logic and human authority remain unchanged.

## 7. Production workspace

Production contains **Control** (Production Control / Production), **Work Packages**, **Scope** (Scope Drift), **Pour** (Pour Control), and **Forecast**. Production Intelligence is a supporting analytical view rather than necessarily a separate global destination. Production Quantity, Direct Cost, and Sell remain separate concepts; no second quantity engine is authorized.

## 8. Finance workspace

Finance contains **Cash** (Cashflow), **Billing & Payables** (Billing and Accounts Payable), **Procurement**, **Banking** (Banking, Reconcile, Bank Rules), and **Payroll & Cost** (Payroll, Job Costs, Overhead). Specialized finance tools remain contextual and no new financial calculations are authorized.

## 9. System workspace

System contains legitimate administration/configuration only: Settings, organization/system preferences, and genuinely system-level access administration. It is not a dumping ground for miscellaneous routes.

## 10. Record-detail routes

Record-detail URLs remain legitimate, including forms such as `/takeoff/[setId]`, `/estimates/[estimateId]`, and `/job-setup/[projectId]`. They remain direct, bookmarkable, shareable access to commercial or operational records, but are not additional primary workspace destinations. Browser history, deep links, and direct record access are preserved.

## 11. Internal-view routing

Each surface uses compact Carez-native internal navigation—tabs, section controls, contextual navigation, or an equivalent control. URLs preserve meaningful navigation state across refresh, Back/Forward, direct links, and bookmarks. Implementation must use the smallest Next.js-compatible routing strategy. Specialized routes may remain compatibility entry points and progressively resolve into their owning workspace; this does not require immediate route deletion or hard redirects.

## 12. Compatibility strategy

1. **Phase A:** global navigation exposes only the seven primary surfaces.
2. **Phase B:** specialized routes remain reachable through internal workspace controls and direct links.
3. **Phase C:** safe specialized list/index routes become compatibility entry points to the owning internal view.
4. **Phase D:** remove obsolete duplicate route shells only after usage, deep-link, test, and workflow compatibility is proven.

There is no mass route deletion or broken-bookmark migration.

## 13. Workspaces navbar

Today stays directly accessible. The expandable Workspaces control presents Preconstruction, Projects, Field, Production, Finance, and System, with one selected operating domain at a time. Its panel is a shallow two- or three-column set of curated internal destinations, normally about 180–240px high. It must not become an application sitemap: remove expanded-desktop duplicate workspace search, Pinned/Recent rails, an All tab, per-route PINNED labels, route descriptions, unrelated routes, and duplicate Quick Access behavior. Global project/workspace search stays in the top shell; Quick Access remains the pinned/fast destination mechanism. SmoothUI Expandable Navbar remains the interaction primitive, subordinate to Carez visual authority.

## 14. Navigation presentation model

The route registry remains route authority. The workspace presentation model is a separate curated seven-domain information architecture and must not blindly derive UX grouping from route-registration order. Every navigable capability should eventually be classified as a **Primary Surface**, **Internal View**, **Contextual Tool**, **Record Detail**, **Compatibility Entry**, or **Hidden / Unsupported**.

## 15. Page creation rule

A capability does not receive a new top-level page because it has data, a component, or an implementation concern. A new primary surface requires a materially distinct lifecycle, authority boundary, or repeated cross-domain operating workflow. Otherwise the capability belongs inside an existing Carez workspace. This rule prevents future navigation and page bloat.

## 16. UI composition rule

Each workspace prefers: workspace header → compact internal-view control → contextual action rail → active work surface → supporting registers/inspectors. Avoid nested dashboards, duplicate KPI strips/search bars/navigation systems, per-view hero banners, giant empty greetings, and cards used only for grouping. SmoothUI, ReUI, and Efferd patterns may inspire interaction/composition, but Carez semantic tokens and product architecture govern.

## 17. Visual and interaction authority

ADR-025 is the active presentation authority and carries forward the Indigo Harbor visual direction established in ADR-024. The Carez Component Pack remains the concrete-native/domain component authority. SmoothUI is the preferred selective motion/interaction primitive source; application surfaces implement the resulting product behavior. This architecture does not authorize wholesale adoption of external component themes.

## 18. Human and server authority

This is an information-architecture and presentation change only. It does not change Takeoff quantity authority, estimate or pricing/margin calculations, schedule authority, production quantity/cost authority, financial calculations, proposal/project lineage, database schema, RLS, tenant isolation, or immutable/versioned commercial records. It does not invent metrics or workflow automation for consolidated screens.

## 19. Effect on current rollout

Batch 1 and Batch 2 accepted implementation remain preserved. Batch 2.5 retains its SmoothUI Expandable Navbar primitive, but its information architecture must be simplified to this model before final acceptance. Batch 3 is paused and must be rewritten around Field; Batch 4 is paused and must be rewritten around Production; Batch 5 is paused and must be rewritten around Finance and System. Preconstruction and Projects receive bounded consolidation/refit after the framework is established. Today receives the compact-header refinement. Do not push or deploy between these local consolidation stages; one eventual staging integration and Vercel staging deployment remain the delivery model.

## 20. Success criteria

Carez feels like seven coherent operating environments rather than unrelated pages. Users can identify where work belongs without understanding the route tree. Global navigation is comprehensible without exposing every capability; specialized tools remain discoverable inside their owning workspace; deep links and record-detail URLs remain usable; no authoritative business behavior changes; and Carez remains Indigo Harbor and concrete-native.

## Non-authorizations

No application code, schema/RLS, dependency, redirect, deployment, push, `sync.ps1`, or Batch 3 implementation is authorized by this design. No placeholders, TBDs, or TODOs are part of this governing decision.
