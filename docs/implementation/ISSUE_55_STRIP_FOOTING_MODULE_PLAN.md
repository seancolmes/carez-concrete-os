# Issue #55 — Strip / Wall Footing module-first implementation

Status: implementation in progress on `staging`.

Owner: Issue #55 / Takeoff Condition workflow.
Canonical decisions: ADR-012, `docs/modules/assembly-resource-engine.md`, `docs/concrete-condition-3d-workstation-target.md`.

## Priority lock

Before additional derived-3D expansion, Carez will complete the Strip / Wall Footing Condition as the first EDGE-inspired, concrete-native module workstation.

This is not an EDGE screen clone. The accepted model is a governed Carez Condition driven by typed module schemas, repeatable module instances, server-authoritative calculations, explicit provenance, scoped holds, and immutable version lineage.

## Strip / Wall Footing target

The first Issue #55 slice covers:

- General / Concrete: governed width/depth/profile facts, concrete specification metadata, placement/finish method inputs, and authoritative LF geometry;
- Rebar: repeatable continuous, transverse, dowel/starter, stirrup/tie, and custom reinforcing sets with explicit bar size/count/spacing/length/stock/lap/waste inputs and no inferred structural design;
- Forms: explicit formed-side/end-form method, system, contact area, form-material LF, and optional stake pattern quantities;
- Excavation / Backfill: explicit trench geometry, working room, slope, excavation method, swell, export/reuse, backfill and compaction assumptions;
- Placement / Equipment: explicit placement method, rate and setup/equipment time assumptions;
- Finish / Cure / Protection: explicit top-surface finish and cure/protection scope;
- Anchors / Embeds: repeatable measured/count/spacing-driven sets;
- Miscellaneous: repeatable estimator-entered count resources without formula authoring;
- Labor: explicit project/company production assumptions applied to server-authoritative physical outputs;
- exact compatibility projection remains preserved for every governed output that flows into the current estimate runtime.

## Architecture constraints

- 2D page-coordinate Takeoff geometry remains quantity authority.
- No client-calculated commercial quantities.
- No hard-coded reinforcing design, means/methods, production, waste, pricing, or excavation assumptions.
- Platform archetype versions and published company template versions remain immutable; expanded module capacity is introduced through a new published Strip / Wall Footing archetype/template version rather than mutating the accepted pilot contract.
- Existing v1 Conditions remain readable and calculable through their original contract.
- New Strip / Wall Footing Conditions use the expanded contract after the dependency-safe template bootstrap advances.
- Missing values hold only dependent outputs.
- Additional derived-3D work resumes only after this Strip / Wall Footing module slice is implemented and browser-QA ready.
