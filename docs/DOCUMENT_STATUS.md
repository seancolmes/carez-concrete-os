# Carez Documentation Status Registry

This registry identifies the active non-code documentation set. Superseded working/design documents are not retained in the active tree once their surviving truth has been absorbed by canonical owners; Git history and closed issues/PRs preserve historical evidence.

## Canonical governance

| Document | Status | Owns |
| --- | --- | --- |
| `docs/README.md` | CANONICAL | Documentation control and hierarchy |
| `docs/ARCHITECTURE.md` | CANONICAL | Stable system architecture |
| `docs/CURRENT_STATE.md` | CANONICAL | Present implementation/verification state |
| `docs/ROADMAP.md` | CANONICAL | Priority sequence |
| `docs/BRANCH_AND_RELEASE_MODEL.md` | CANONICAL | Branch, QA, release model |
| `docs/modules/*` | CANONICAL | Module behavior/product contracts |
| active `docs/decisions/*` | CANONICAL | Durable accepted decisions |
| `docs/KNOWLEDGE_SOURCE_ROUTING.md` | CANONICAL | Evidence-source routing |
| `docs/workflow/*` | CANONICAL | Current development, QA, documentation workflow |

## Active supporting documents

| Document | Classification | Canonical owner / interpretation |
| --- | --- | --- |
| `concrete-condition-3d-workstation-target.md` | ACCEPTED DETAILED DESIGN | Concrete Condition + derived-3D target beneath Architecture/module specs; presentation defers to ADR-015/016/020 and estimating semantics to ADR-021 through ADR-023. |
| `takeoff-3d-implementation-architecture.md` | ACCEPTED DETAILED DESIGN | Current Issue #41 derived-3D implementation architecture beneath ADR-013 and Takeoff module contract. |
| `concrete-plan-intelligence-foundation.md` | ACCEPTED DETAILED DESIGN | Plan Intelligence domain/schema foundation supporting AI + Documents/Knowledge. |
| `p1-builder-method-acceptance.md` | ACCEPTED ACCEPTANCE CRITERIA | P1 verification/resource acceptance rules. |
| `p1-method-research-contract.md` | RESEARCH CONTRACT | Source hierarchy/domain research contract for P1 means/methods. |

## Removal rule

Remove a document from the active tree when all of the following are true:

1. it is superseded, completed, or implementation-checkpoint-only;
2. any still-valid constraints have been absorbed by a canonical owner;
3. current implementation no longer depends on the file at runtime/build time;
4. historical evidence is already preserved by Git history, migrations, issues, PRs, tags, or releases.

Do not retain stale files solely for traceability.

## Conflict rule

Supporting documents may add detail but may not override canonical architecture, active ADRs, module specifications, `CURRENT_STATE.md`, or `BRANCH_AND_RELEASE_MODEL.md`.
