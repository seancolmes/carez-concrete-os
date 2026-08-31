# Carez Documentation Status Registry

This registry classifies non-canonical supporting documents so developers and AI agents know how much authority to assign them.

## Status meanings

- **CANONICAL** — current source of approved product/architecture truth for its subject.
- **ACCEPTED DETAILED DESIGN** — approved supporting design beneath canonical architecture/module docs.
- **ACCEPTED ACCEPTANCE CRITERIA** — approved focused acceptance rule.
- **RESEARCH CONTRACT** — approved research basis and source hierarchy used to inform canonical design.
- **HISTORICAL IMPLEMENTATION RECORD** — evidence of a past implementation checkpoint; not current status.
- **SUPERSEDED VISION RECORD** — useful historical direction that has been overtaken by later approved design.

## Canonical governance documents

| Document | Status | Owns |
| --- | --- | --- |
| `docs/README.md` | CANONICAL | Documentation control and hierarchy |
| `docs/ARCHITECTURE.md` | CANONICAL | Stable system architecture |
| `docs/CURRENT_STATE.md` | CANONICAL | Present implementation/build status |
| `docs/ROADMAP.md` | CANONICAL | Priority sequence |
| `docs/modules/*` | CANONICAL | Module behavior/product contracts |
| `docs/decisions/*` | CANONICAL | Accepted architectural decisions and rationale |
| `docs/KNOWLEDGE_SOURCE_ROUTING.md` | CANONICAL | Which evidence source answers which question |
| `docs/workflow/*` | CANONICAL | Development, QA, and approval/documentation workflow |

## Supporting and legacy documents

| Document | Classification | Canonical owner / interpretation |
| --- | --- | --- |
| `b2-estimator-focus-redesign.md` | ACCEPTED DETAILED DESIGN | B2 visual/interaction contract supporting Architecture + Takeoff/Estimating module specs |
| `builder-means-methods-resource-engine.md` | ACCEPTED DETAILED DESIGN | P1 means/methods/resource contract supporting Takeoff + Estimating |
| `carez-modernization.md` | HISTORICAL IMPLEMENTATION RECORD | 2026-08-29 evidence snapshot; `CURRENT_STATE.md` controls present status |
| `concrete-plan-intelligence-foundation.md` | ACCEPTED DETAILED DESIGN | Plan Intelligence domain/schema foundation supporting AI + Documents/Knowledge |
| `custom-assembly-authoring-foundation.md` | ACCEPTED DETAILED DESIGN | Immutable assembly authoring/runtime contract supporting Estimating |
| `p1-builder-method-acceptance.md` | ACCEPTED ACCEPTANCE CRITERIA | Focused P1 verification/resource acceptance rules |
| `p1-method-research-contract.md` | RESEARCH CONTRACT | Source hierarchy and domain corrections for P1 means/methods |
| `product-polish-vision.md` | SUPERSEDED VISION RECORD | Earlier product polish direction; later B2/module specs govern current UI decisions |
| `takeoff-estimating-workstation-target.md` | ACCEPTED DETAILED DESIGN | Integrated estimator workstation contract supporting Takeoff + Estimating |

## Conflict rule

A supporting document may add detail, but it may not override a canonical architecture document, ADR, module specification, or `CURRENT_STATE.md`.

If a conflict is discovered:

1. Do not silently choose or blend both versions.
2. Identify the conflict explicitly.
3. Determine whether the supporting document should be promoted into the canonical owner or marked superseded.
4. Update the canonical document through the approval workflow.
5. Update this registry and the supporting document status header if its classification changes.
