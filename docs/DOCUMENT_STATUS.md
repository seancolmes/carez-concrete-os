# Carez Documentation Status Registry

This registry classifies non-canonical supporting documents so developers and AI agents know how much authority to assign them.

## Status meanings

- **CANONICAL** — current source of approved product/architecture truth for its subject.
- **ACCEPTED DETAILED DESIGN** — approved supporting design beneath canonical architecture/module docs.
- **ACCEPTED ACCEPTANCE CRITERIA** — approved focused acceptance rule.
- **RESEARCH CONTRACT** — approved research basis/source hierarchy used to inform canonical design.

Historical implementation and superseded vision documents are removed from the active documentation set. Git history/closed PRs/issues preserve that evidence without competing with current product truth.

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
| `b2-estimator-focus-redesign.md` | ACCEPTED DETAILED DESIGN | B2 visual/interaction contract supporting Architecture + Takeoff/Estimating specs |
| `builder-means-methods-resource-engine.md` | ACCEPTED DETAILED DESIGN | Means/methods/resource contract supporting Assembly & Resource Engine + Takeoff + Estimating |
| `concrete-plan-intelligence-foundation.md` | ACCEPTED DETAILED DESIGN | Plan Intelligence domain/schema foundation supporting AI + Documents/Knowledge |
| `custom-assembly-authoring-foundation.md` | ACCEPTED DETAILED DESIGN | Immutable assembly authoring/runtime contract supporting Assembly & Resource Engine + Estimating |
| `p1-builder-method-acceptance.md` | ACCEPTED ACCEPTANCE CRITERIA | Focused P1 verification/resource acceptance rules |
| `p1-method-research-contract.md` | RESEARCH CONTRACT | Source hierarchy/domain research contract for P1 means/methods |
| `takeoff-estimating-workstation-target.md` | ACCEPTED DETAILED DESIGN | Integrated estimator workstation contract supporting Takeoff + Estimating |

## Conflict rule

A supporting document may add detail but may not override canonical architecture, ADRs, module specifications, `CURRENT_STATE.md`, or `BRANCH_AND_RELEASE_MODEL.md`.

If a conflict is discovered, identify it explicitly and promote the approved resolution into the canonical owner rather than creating another competing document/branch.
