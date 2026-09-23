# Takeoff authority map

Use the smallest applicable source set.

- Workstation/domain invariants: `docs/decisions/ADR-020-integrated-takeoff-workstation-and-precision-cursor.md`.
- Current Takeoff workflow, Conditions, roles, worksheet, 2D/3D contract: `docs/modules/takeoff.md`.
- Cross-module lineage and immutable accepted scope: `docs/ARCHITECTURE.md`.
- Active presentation language: `docs/decisions/ADR-025-carez-operations-workspace.md`.
- Shared UI primitives: relevant section only of `docs/design-system/CAREZ_COMPONENT_PACK.md`.
- Database authority/RLS/migrations: `docs/decisions/ADR-002-supabase-source-of-truth.md` and `carez-db-migration`.

If sources conflict, preserve the newer explicit accepted decision for presentation while keeping ADR-020/current module contracts authoritative for Takeoff quantity and domain behavior unless explicitly superseded.
