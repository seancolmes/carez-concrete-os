# ADR-011 — Light Workstation Visual System

Status: Accepted

## Decision

Carez uses one shared light workstation visual system across the application, with a permanent dark navy app rail on authenticated desktop surfaces.

The approved visual direction combines premium OS-level refinement with concrete-estimating workstation density and speed. It is informed by Apple-level polish, zzTakeoff tool placement and compact controls, Estimating Edge estimating depth, and STACK-style organization, without copying another product.

This is a Carez-wide presentation system, not a Takeoff-only theme. Authenticated desktop pages, module workspaces, reporting surfaces, tables, forms, empty states, dialogs, and shared navigation should use the same visual vocabulary unless a documented field/mobile or customer-facing context requires a purpose-specific variation.

## Required visual system

- Permanent desktop app rail remains the primary dark navy brand anchor.
- Main application surfaces are white / near-white with cool light or medium-gray workspace and pane backgrounds.
- Carez brand blue is restrained; a brighter interaction blue is used for active tools, focus, selections, links, and primary actions.
- Status colors are semantic only.
- Takeoff colors remain visually dominant over ordinary application chrome.
- Typography prioritizes readability at 100% desktop zoom with stronger headings and neutral data text.
- Controls/panels use crisp geometry with small radii, subtle borders, and limited elevation.
- Icons are used deliberately for navigation, drawing tools, compact utilities, section identity, and high-frequency actions.
- Main workstation density remains slightly more spacious than zzTakeoff while avoiding generic SaaS whitespace.
- Data-heavy pages remain table/list-first where that matches the work; do not convert operational grids into decorative card walls.
- Empty states are concise, visually calm, and actionable where a real next action exists.
- Takeoff drawing workspace remains light and plan-first, with the permanent resizable Quantity Worksheet and compact Inspector preserved.
- The Inspector favors collapsed sections and progressive disclosure.
- Mobile remains field-first; applying the shared tokens must not force desktop workstation density onto field workflows.
- Customer-facing proposal/print documents may retain document-specific presentation but should use Carez typography, brand, readability, and interaction standards where applicable.

## Approved reference surfaces

The approved Dashboard / Today concept is the reference for general authenticated application chrome and operational surfaces.

The approved Dashboard Module / Owner Reports concept is the reference for reporting pages: light metric strip, clean section hierarchy, table/list-first reporting, deliberate icons, and restrained semantic color.

These concepts establish presentation direction. Existing route behavior, permissions, calculations, data sources, and domain meaning remain authoritative unless separately approved.

## Architecture boundary

This decision changes presentation, not domain authority. It does not alter:

- PDF/vector geometry authority;
- calibration or measurement semantics;
- server-authoritative calculations;
- RLS / tenant isolation;
- published Scope Recipe immutability;
- Takeoff → estimate lineage;
- Accepted Scope Snapshot / frozen commercial baseline rules;
- separation of Production Quantity, Direct Cost, and Sell;
- field truth distinctions among schedule, timecard, Actual Work Context, constraints, blockers, completion, and Production Evidence;
- Budget / Committed / Actual / Forecast separation.

## Implementation / QA

Implementation occurs on canonical `staging` in bounded slices even though the visual system applies globally. Shared tokens and shell/surface primitives should be implemented first so individual pages inherit the system rather than accumulating page-specific patches.

`main` remains production only. Browser acceptance uses the single stable staging URL from `docs/BRANCH_AND_RELEASE_MODEL.md`.

A rendered page is not accepted only because its stylesheet changed. Representative routes from every module must be browser-verified for readability, overflow, controls, tables, empty states, responsive behavior, and preservation of domain behavior.

The supporting detailed visual contract is `docs/b2-estimator-focus-redesign.md`.
