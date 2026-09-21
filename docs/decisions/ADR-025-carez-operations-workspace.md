# ADR-025 — Carez Operations Workspace

Status: Accepted on staging at `457be2068a2b42f7883286a4f467f819e7fc049a`
Date: 2026-09-21
Authority: Issue #76 and Nik's explicit complete UI/UX rewrite authorization

## Approved experience refinement

Nik approved the Carez Experience System refinement in `docs/superpowers/specs/2026-09-21-carez-experience-system-design.md`. The selected direction is **Command Deck with Spatial Blueprint accents**: a premium construction command center with selective futuristic construction technology. The first implementation scope is intentionally limited to Today, Projects, Documents, and the shared experience primitives they require. Takeoff remains outside route-level redesign for this phase.

## Decision

Replace the Precision Slate presentation with a single Carez Operations Workspace system. Supersede ADR-024 presentation, ADR-016 shell arrangement, and ADR-020 pane arrangement where described here. Their domain, accessibility, theme preference, navigation personalization, and measurement invariants remain protected.

The visual language uses warm mineral surfaces, ink typography, Carez blue actions, squared controls, ruled information sections, and tabular technical values. Light, dark, and system remain first-class. Colors belong to the semantic token blocks in globals.css; specialist workspaces consume those same tokens. Existing accessible Base UI behavior is retained under source-owned Carez presentation.

## Composition

- A compact masthead identifies the company and current workspace. An explicit Workspaces directory exposes the complete navigation model in business groups. Search and user settings remain directly accessible.
- A second, quiet favorites line preserves role defaults, user pinning/reordering, and project context. No permanent global sidebar competes with drawings or financial tables.
- Standard routes use a consistent record heading, compact metric ledger, section rules, and full-width data surfaces. Forms retain their actions, validation, names, and persistence semantics.
- Projects retains filtering, sorting, keyboard access, and contextual actions. Its detail preview is a dismissible sheet at every width; it never reserves permanent table width.
- Takeoff retains Plans, Conditions, Zones, all established drawing tools, Condition Properties, the Quantity Worksheet, scale, and derived 3D. Properties starts collapsed to prioritize the plan and opens through the existing Condition workflow or explicit properties control. Hiding a pane does not unmount its editor or discard unsaved input.
- Responsive navigation exposes the same destinations. Focus indication, reduced motion, and readable technical data are mandatory. Tables scroll inside their own viewport.

## Protected boundary

No changes to database schema, tenant isolation, RLS, server actions, quantity/cost/pricing calculations, immutable records, or commercial lineage. Persisted page-coordinate 2D geometry remains quantity authority; 3D remains verification. Production Quantity, Direct Cost, and Sell stay distinct. Human commercial and estimating authority is unchanged.

## Delivery and validation

Issue #76 was implemented on `astra/complete-ui-rewrite`, visually accepted by Nik, and merged through PR #77 into `staging` at `457be2068a2b42f7883286a4f467f819e7fc049a`. GitHub Actions run `35572008076` passed for the exact merge commit, and Vercel reported success for the same commit. The accepted reference scope includes Today, Projects, Documents, and the shared experience primitives required by those routes. Takeoff remains outside route-level redesign for this phase.

The authenticated `/design-review` route was preview-only evidence for 390/768/1280px responsive review and did not create records or bypass workflow gates. The branch-preview Supabase binding was corrected to the QA project before acceptance work continued. Direct-job creation remained blocked by the separate QA `public.next_opportunity_number()` gap, and graphical 3D was not accepted in the non-WebGL review browser; those limits do not alter this presentation decision.

Future changes follow the normal `staging` workflow. This ADR does not authorize a production release or relax any domain, database, commercial, or Takeoff authority boundary.
