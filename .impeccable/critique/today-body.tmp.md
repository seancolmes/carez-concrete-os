# Today page critique

Method: dual-agent (A: design_review; B: detector_evidence)

## Design health: 23/40, Acceptable

| # | Heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Visibility of status | 2 | Zero and empty states lack data freshness and scope. |
| 2 | Match to real work | 3 | Concrete terms fit; some metric labels need definition. |
| 3 | User control | 3 | Direct links and navigation support exit and choice. |
| 4 | Consistency | 3 | Shared shell is coherent; different tasks share vague Review text. |
| 5 | Error prevention | 2 | Zero and dash can be mistaken for confirmed values. |
| 6 | Recognition | 2 | Users must infer the destination and purpose of Review. |
| 7 | Efficiency | 3 | Search shortcut helps; no focused triage path. |
| 8 | Minimalism | 2 | Equal status blocks and repeated section rules flatten hierarchy. |
| 9 | Error recovery | 2 | Data-status explanation and recovery are not visible. |
| 10 | Help | 1 | Readiness and cash terms lack contextual help. |

## Specificity and evidence

The command rail, dark mineral palette, job identifiers, readiness language, and concrete operating context feel product authored. The five equal status tiles and generic summary rows are closer to a generic operations dashboard. The source detector reported two `border-accent-on-rounded` warnings at app/page.tsx:154 and :158; both appear false positives because the border belongs to square sections. The rendered page detector reported 29 page-wide anti-patterns, including repeated green accents and nested card treatment. Its overlay was confirmed in a separate browser tab, though user visibility of that tab was not confirmed.

## Overall impression

The page is legible and task oriented, but it needs a clearer first action and more trustworthy status context.

## What works

- Today's Work and Attention appear first with direct destinations.
- Job identifiers and operational vocabulary orient concrete subcontractor staff.
- Dense layout and restrained base palette fit an operating console.

## Priority issues

1. **P1 � Attention actions are ambiguous.** A customer reply and a follow-up both use Review. State the verb and due priority directly; use `/impeccable clarify` and `/impeccable layout`.
2. **P1 � Status zeros lack scope.** Ready to move, Hard holds, and 7-day cash do not say when data was updated or distinguish no activity from a true zero. Add period, freshness, and empty/unknown states; use `/impeccable clarify` and `/impeccable harden`.
3. **P2 � Visual hierarchy is flat.** Five equal status cells and repeated green rules compete with actionable work. Elevate urgent work and demote neutral metrics; use `/impeccable layout` or `/impeccable distill`.
4. **P2 � Attention context truncates.** Long job and customer text can hide the reason to act. Allow wrapping or put the action summary first; use `/impeccable adapt` and `/impeccable clarify`.
5. **P2 � Unscheduled work looks scheduled.** Next Operations shows time and quantity dashes for a planning task. Separate planning from dated operations; use `/impeccable clarify` and `/impeccable layout`.

## Persona red flags

- Expert operator: scans five zeros and similar reminders before finding the next action.
- First-time user: metric labels and two Review links require interpretation.
- Keyboard or low-vision user: labeled navigation and skip link help, but thin green rules and truncated muted details weaken priority cues. Contrast failure was not measured.

## Minor observations

The header date omits the year, which weakens screenshot context. Long QA fixture names wrap awkwardly in Business Pulse.

## Question to consider

Could Today show one ranked action queue with explicit verbs and due times, letting status metrics support the queue?
