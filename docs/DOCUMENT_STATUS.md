# Carez Documentation Status Registry

This registry classifies non-canonical supporting documents so developers and AI agents know how much authority to assign them.

## Status meanings

- **CANONICAL** — current source of approved product/architecture truth for its subject.
- **ACCEPTED DETAILED DESIGN** — approved supporting design beneath canonical architecture/module docs.
- **ACCEPTED ACCEPTANCE CRITERIA** — approved focused acceptance rule.
- **RESEARCH CONTRACT** — approved research basis/source hierarchy used to inform canonical design.
- **SUPERSEDED** — retained only as an explicit historical reference; it has no authority for new implementation.

Historical implementation and superseded vision documents are excluded from the active documentation set. A small number may remain explicitly marked SUPERSEDED when their runtime/migration evidence is needed; Git history and closed PRs/issues preserve the rest without competing with current product truth.

## Canonical governance documents

| Document | Status | Owns |
| --- | --- | --- |
| `docs/README.md` | CANONICAL | Documentation control and hierarchy |
| `docs/ARCHITECTURE.md` | CANONICAL | Stable system architecture |
| `docs/CURRENT_STATE.md` | CANONICAL | Present implementation/verification state |
| `docs/ROADMAP.md` | CANONICAL | Priority sequence |
| `docs/BRANCH_AND_RELEASE_MODEL.md` | CANONICAL | Permanent branches, single QA build, production promotion |
| `docs/modules/*` | CANONICAL | Module behavior/product contracts |
| `docs/decisions/*` | CANONICAL | Accepted architectural decisions/rationale |
| `docs/KNOWLEDGE_SOURCE_ROUTING.md` | CANONICAL | Evidence-source routing |
| `docs/workflow/*` | CANONICAL | Development, QA, approval/documentation workflow |

## Accepted supporting documents

| Document | Classification | Canonical owner / interpretation |
| --- | --- | --- |
| `b2-estimator-focus-redesign.md` | ACCEPTED DETAILED DESIGN | Carez-wide light visual system; Takeoff details defer to the newer Condition/3D target |
| `concrete-condition-3d-workstation-target.md` | ACCEPTED DETAILED DESIGN | Active Concrete Condition, EDGE-inspired workstation, derived 3D, migration, and acceptance contract |
| `concrete-plan-intelligence-foundation.md` | ACCEPTED DETAILED DESIGN | Plan Intelligence domain/schema foundation supporting AI + Documents/Knowledge |
| `p1-builder-method-acceptance.md` | ACCEPTED ACCEPTANCE CRITERIA | Focused P1 verification/resource acceptance rules |
| `p1-method-research-contract.md` | RESEARCH CONTRACT | Source hierarchy/domain research contract for P1 means/methods |

## Superseded historical references

| Document | Classification | Replacement / retained value |
| --- | --- | --- |
| `takeoff-estimating-workstation-target.md` | SUPERSEDED | Replaced by the Condition/3D target; retains prior geometry, hold, and pricing rationale |
| `custom-assembly-authoring-foundation.md` | SUPERSEDED | Replaced by ADR-012; retains current runtime and migration-compatibility evidence |
| `builder-means-methods-resource-engine.md` | SUPERSEDED | Replaced by ADR-012; retains method/resource/safety rationale incorporated into the new engine |

## Conflict rule

A supporting document may add detail but may not override canonical architecture, ADRs, module specifications, `CURRENT_STATE.md`, or `BRANCH_AND_RELEASE_MODEL.md`.

If a conflict is discovered, identify it explicitly and promote the approved resolution into the canonical owner rather than creating another competing document/branch.
