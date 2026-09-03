# ADR-011 — Light Workstation Visual System

Status: Accepted

## Decision

Carez desktop workstations use a light primary interface with a permanent dark navy app rail.

The approved visual direction combines premium OS-level refinement with concrete-estimating workstation density and speed. It is informed by Apple-level polish, zzTakeoff tool placement and compact controls, Estimating Edge estimating depth, and STACK-style organization, without copying another product.

## Required visual system

- Permanent desktop app rail remains the primary dark navy brand anchor.
- Main application surfaces are white / near-white with cool light or medium-gray workspace and pane backgrounds.
- Carez brand blue is restrained; a brighter interaction blue is used for active tools, focus, selections, links, and primary actions.
- Status colors are semantic only.
- Takeoff colors remain visually dominant over ordinary application chrome.
- Typography prioritizes readability at 100% desktop zoom with stronger headings and neutral data text.
- Controls/panels use crisp geometry with small radii, subtle borders, and limited elevation.
- Icons are used deliberately for navigation, drawing tools, compact utilities, and high-frequency actions.
- Main workstation density remains slightly more spacious than zzTakeoff while avoiding generic SaaS whitespace.
- Takeoff drawing workspace remains light and plan-first, with the permanent resizable Quantity Worksheet and compact Inspector preserved.
- The Inspector favors collapsed sections and progressive disclosure.

## Architecture boundary

This decision changes presentation, not domain authority. It does not alter:

- PDF/vector geometry authority;
- calibration or measurement semantics;
- server-authoritative calculations;
- RLS / tenant isolation;
- published Scope Recipe immutability;
- Takeoff → estimate lineage;
- Accepted Scope Snapshot / frozen commercial baseline rules;
- separation of Production Quantity, Direct Cost, and Sell.

## Implementation / QA

Implementation occurs on canonical `staging` in bounded slices. `main` remains production only. Browser acceptance uses the single stable staging URL from `docs/BRANCH_AND_RELEASE_MODEL.md`.

The supporting detailed visual contract is `docs/b2-estimator-focus-redesign.md`.
