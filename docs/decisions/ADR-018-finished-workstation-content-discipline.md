# ADR-018 — Finished workstation content discipline

Status: Accepted
Date: 2026-09-04
Owner: 95 — UX & Design System
Related decisions: ADR-015, ADR-016
Implementation owner: Issue #44 while the Carez-wide shadcn conversion remains open

## Context

Carez is being converted from legacy and generic SaaS-style presentation into a dense professional construction workstation. Several older routes still contain persistent text that narrates implementation state, future roadmap intent, migration plans, or speculative future automation. That text may have been useful during development, but it does not help the user execute the current task and makes the product read like an internal prototype.

## Decision

Finished Carez workstation surfaces communicate the user's current task, current object, current state, actionable problem, or available decision. They do not persistently narrate how Carez is being built.

### Prohibited persistent narration

Ordinary production UI must not display copy such as:

- future-engine or roadmap promises (`Carez will generate this later`, `future workflow`, `coming in a later phase`);
- migration or implementation commentary (`temporary bridge`, `legacy path`, `new architecture`, `this will be replaced`);
- developer instructions or test narration;
- generated-sounding helper paragraphs that merely restate the heading or describe obvious controls;
- internal architecture names unless they are meaningful user-facing domain concepts.

### Allowed content

Persistent text should do at least one of the following:

- identify the object or scope the user is working on;
- communicate current authoritative state;
- surface an exception, blocker, warning, hold, or readiness condition;
- explain what input is required or what decision must be made;
- provide concise help where misunderstanding could cause a material workflow error;
- disclose a current product limitation only when that limitation affects the user's immediate decision or ability to complete the task.

Current limitations and provenance may use contextual help, tooltip, help panel, release note, or administrator documentation when they do not need to occupy the primary workstation permanently.

## Cross-module rule

This rule applies to every Carez route and reusable rendered component encountered during Issue #44 and later UI work. When a page is redesigned or materially touched, remove implementation narration and generated filler from the touched surface instead of carrying it forward into the shadcn composition.

This rule does not authorize removal of required legal, contractual, regulatory, safety, financial, or audit text. It also does not remove domain language that users genuinely need to make a decision.

## Relationship to ADR-015

ADR-015 already requires persistent text to identify, communicate state/problem, or enable a decision and requires redundant generated-style copy to be removed. This ADR makes the implementation-narration boundary explicit and globally enforceable.

## Acceptance

A converted route is not presentation-complete if it still contains persistent roadmap narration, migration commentary, developer/test language, or filler text that does not help the user perform the current task.
