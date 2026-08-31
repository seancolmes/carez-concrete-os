# Approval → Documentation Workflow

## Decision lifecycle

```text
IDEA
→ BRAINSTORM / RESEARCH
→ PROPOSED
→ APPROVED
→ CANONICAL DOC UPDATE
→ ISSUE / IMPLEMENTATION
→ TEST / BROWSER QA
→ VERIFIED
→ CURRENT_STATE UPDATE
```

## Approval trigger

Treat phrases such as `approved`, `lock this in`, `final`, `go with this`, `this is the direction`, or equivalent as authorization to promote the significant decision into canonical documentation.

## Promotion rules

- Product/module behavior → update the applicable `docs/modules/*.md`.
- Cross-cutting architecture/invariant → update `docs/ARCHITECTURE.md` and usually add/update an ADR.
- Visual/design-system rule → update the canonical design-system document/module contract.
- Priority/phase sequencing → update `docs/ROADMAP.md`.
- Actual implementation/blocker/verification state → update `docs/CURRENT_STATE.md`.
- Agent/process rule → update `AGENTS.md` or workflow docs.

## What not to promote

Do not promote:
- unapproved brainstorm variants;
- speculative implementation details;
- temporary debugging hypotheses;
- job-specific private company data unless intentionally generalized;
- screenshots as architectural truth without an approved interpretation.

## Implementation closure

When approved work is implemented:
1. link implementation to the governing spec/ADR;
2. run relevant validation;
3. browser-verify UI behavior;
4. update `CURRENT_STATE.md` with verified status;
5. leave a clean resumable Git checkpoint.
