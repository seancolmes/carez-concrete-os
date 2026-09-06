# ADR-022 — Derived geometry facts and Strip bulkheads

Status: Accepted  
Date: 2026-09-06  
Supersedes in part: ADR-012 Strip / Wall Footing `end forms` secondary-role example

## Context

Strip / Wall Footing QA exposed a duplicate-measurement problem in the Condition workflow. The estimator already draws the authoritative footing run, but the current Strip contract also exposes `End forms` as an EA secondary measurement role and asks the estimator to return to the plan and place count geometry at footing ends.

That is unnecessary when the primary run geometry already contains the geometric fact Carez needs. It also leaked the legacy compatibility layer into the active workflow: the current role-drawing helper chooses a compatibility assembly for non-primary roles by measurement unit, so an EA Strip `End forms` draw can inherit an EA Pad / Column Footing compatibility assembly even though the measurement is being created for a Strip Condition.

The Concrete Condition architecture already requires built-in geometry facts to be used before asking for duplicate inputs and preserves human authority over means/methods. This decision makes that rule explicit for derived secondary facts.

## Decision

### 1. Do not duplicate authoritative geometry as a measurement role

When an authoritative primary Takeoff geometry already contains a deterministic fact needed by a Condition, Carez derives that fact instead of requiring a second drawing of the same physical location.

A secondary measurement role remains appropriate when the secondary object has independent plan location, extent, shape, or quantity authority that is not already represented by the primary geometry.

### 2. Strip `End forms` becomes `End bulkheads / pour stops`

For new Strip / Wall Footing contract versions, the current drawable EA `End forms` role is removed from the normal estimator workflow.

The Forms module exposes **End bulkheads / pour stops** with an estimator-controlled count source:

- **Run endpoints** — use the deterministic endpoint candidate derived from the authoritative footing-run geometry;
- **Explicit count** — estimator enters the actual bulkhead/pour-stop count when the construction condition differs from the geometric candidate;
- **None** — no end bulkhead/pour-stop formwork is included.

The derived endpoint count is a geometric candidate, not an automatic means/method assumption. Carez must not silently assume that every run endpoint requires a bulkhead because a footing may terminate against existing concrete, continue into another placement, intersect another footing, be earth-formed, or otherwise not require a freestanding end form.

### 3. Form calculations use the approved bulkhead count

After the estimator selects the count source, the server-authoritative Strip calculation uses the approved bulkhead count for physical form quantities.

At minimum:

- end bulkhead contact area = approved bulkhead count × footing width × footing depth;
- tracked form-material demand may include the approved bulkhead count as an additional formed width basis, while preserving the selected form-system/resource semantics;
- form labor may consume the resulting contact-area output according to the governed labor method.

The calculation remains deterministic and server-authoritative. The browser does not become quantity authority.

### 4. EA is not an archetype identity

A Condition secondary-role drawing must never borrow another concrete family's compatibility assembly merely because both use the same unit.

Measurement unit and geometry type are compatibility facts, not Condition-family identity. Any future drawable secondary role must be launched with explicit Condition/archetype/role identity or an intentionally role-specific compatibility mapping. Unit-only selection is not sufficient.

For Strip end bulkheads/pour stops, the normal workflow creates no separate EA measurement, so no Pad / Column Footing compatibility assembly should appear.

### 5. Preserve published history

Existing published Strip v1, v2, and v3 contracts and their historical measurement/compatibility records remain immutable and readable.

This behavior is implemented as a new Strip contract revision rather than mutating a published contract in place. Existing drafts may move to the new contract only through the governed upgrade path.

## Consequences

- The estimator draws the footing run once and reviews/accepts the derived bulkhead candidate instead of duplicating endpoint counts on plan.
- Strip formwork language becomes construction-native: **End bulkheads / pour stops**, not ambiguous `End forms` or `lumber ends`.
- The Forms module must distinguish the selected physical form system/resource from abstract material factors; this ADR does not change the current resource-factor math by itself.
- True independently located secondary geometry such as embeds, dowels, steps, keyways, joints, or blockouts remains eligible for persisted measurement roles when the family contract requires it.
- The current unit-only secondary-role compatibility lookup is a defect and must not be retained as the identity mechanism for new Condition behavior.
- Issue #55 owns the Strip implementation, migration/upgrade behavior, deterministic tests, and authenticated stable-staging browser acceptance.

## Acceptance requirements

For the new Strip contract:

1. Scope no longer asks the estimator to `Draw EA` for end forms.
2. Forms exposes `End bulkheads / pour stops` with Run endpoints / Explicit count / None.
3. Run-endpoint candidate count is derived from authoritative persisted run geometry.
4. The chosen bulkhead count drives end contact area and dependent form quantities server-side.
5. No raw bulkhead count measurement is labeled or projected as Pad / Column Footing.
6. Existing Strip v1-v3 records remain unchanged and reproducible.
7. Typecheck, domain tests, build, migration/upgrade validation, and authenticated browser QA pass before the new behavior is called verified.

## Canonical owners

- `docs/modules/takeoff.md`
- `docs/modules/assembly-resource-engine.md`
- `docs/decisions/ADR-012-concrete-condition-engine.md`
- `docs/decisions/ADR-021-condition-estimating-semantics.md`
- GitHub Issue #55
