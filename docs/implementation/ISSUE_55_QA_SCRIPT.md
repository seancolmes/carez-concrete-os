# Issue #55 — Strip / Wall Footing browser QA

Use only the stable staging URL from `docs/BRANCH_AND_RELEASE_MODEL.md`.

Before beginning QA, confirm the stable staging deployment is built from the current `staging` line at or after the Issue #55 implementation checkpoint. Do not use a commit-specific or alternate Vercel URL as the acceptance target.

## Setup

- Open an editable QA Takeoff set with a calibrated footing sheet.
- Open Conditions and create a new `Strip / Wall Footing` Condition after this checkpoint is deployed.

## Pass 1 — General / Concrete

- Confirm the Condition shows `Module v2` / full module treatment.
- Enter Footing width and Footing depth.
- Set Concrete section profile and any job-specific concrete/placement fields you want to exercise.
- Draw or assign the primary Footing run LF.
- Do not fill unrelated modules yet.

Expected: Concrete can calculate while unrelated inactive modules remain inactive; missing unrelated values do not block concrete.

## Pass 2 — Rebar repeatable sets

Add at least three different reinforcing sets, for example:

- Continuous;
- Transverse;
- Dowel / starter.

Enter only values supported by the QA plan/example. Confirm no bar size, bar count, spacing, lap, waste, or similar structural fact was silently inserted by Carez.

Expected: each set is independently editable/removable/disableable; invalid or missing values hold reinforcing-dependent outputs only.

## Pass 3 — Forms

Enable Forms and exercise:

- Formed sides;
- Form method/system;
- End forms if applicable;
- Track form material;
- Stakes / stake spacing if applicable.

Expected: contact-area/material/stake outputs react only to explicit inputs and authoritative LF/EA geometry.

## Pass 4 — Excavation / backfill

Enable Excavation / backfill and exercise:

- Bottom width mode;
- Working room or explicit bottom width;
- Excavation depth;
- Side slope;
- Swell;
- Export share;
- Backfill share/type/compaction.

Expected: excavation outputs remain independent of reinforcing/forms and missing excavation inputs do not block concrete.

## Pass 5 — More / Labor

Exercise:

- Anchors / embeds (repeatable);
- Placement / equipment;
- Finish / cure / protection;
- Miscellaneous repeatable item;
- Labor production values.

Save & recalculate.

Expected: outputs, holds and estimate compatibility projection persist; labor requires explicit production assumptions; no pricing/production facts are invented.

## Regression

- Existing v1 Strip / Wall Footing Conditions remain readable and use their original contract.
- Condition-first Takeoff remains the active authoring model; Scope Recipe/Build Method UI does not return.
- 3D/Split remains disabled for a newly created Strip v2 Condition until this Issue #55 slice is accepted.
