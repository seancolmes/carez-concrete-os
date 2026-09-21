# ADR-025 — Carez Operations Workspace

Status: Implementation candidate; Nik's visual acceptance pending
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

Work only on astra/complete-ui-rewrite from staging e06b6f2. Preserve the traceable Takeoff baseline 09d39d3. Run targeted checks, pnpm typecheck, pnpm check, GitHub Actions, and desktop/mobile browser QA in both themes. Deploy a branch preview for Nik. Neither staging integration nor production release is authorized. Implementation and rendered acceptance are separate claims.

The authenticated `/design-review` route is preview-only and provides 390/768/1280px frames of real application routes. It creates no records and does not bypass workflow gates. Estimate detail remains a scrollable document workspace; only drawing routes use a fixed-height canvas shell. Legacy condition authoring also starts closed, with its launcher separated from drawing/inspector controls.
