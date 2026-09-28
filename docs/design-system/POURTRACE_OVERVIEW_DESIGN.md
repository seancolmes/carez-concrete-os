# PourTrace Overview — page design brief

Status: Proposed page contract for discussion. Presentation design only; no current route, data authority, permission, or domain rule changes are authorized here. Use the five-area navigation and PourTrace color system accepted by the product owner.

## Purpose and evidence

**Purpose:** help a member enter the company workspace, recognize their next consequential work, open its exact source record, and return without losing context. The audience includes owners, estimators, project managers, foremen, and accounting staff. Some people hold several responsibilities; one page framework must work for all of them.

**Current source observation:** `/` redirects users without a company to sign-in and sends the employee role to `/employee`. It draws from projects, work readiness, budgets, billing, field shifts, schedule, proposal follow-up, leads, and cash events. The current `TodaySurface` presents attention, field schedule, five status metrics, upcoming operations, and a pipeline/cash tab. Several exception actions point at broad routes such as `/readiness` or `/billing`, while other actions point to a specific proposal or project. The current page labels itself “Today” and describes its empty attention state as “No management exceptions.” This evidence establishes available source categories, not a validated priority order or a finished experience for every role.

**Primary diagnosis:** orientation breaks when a person must infer which of several panels applies to them, then find the affected record after choosing a broad destination. A member should see the record, reason, and next action together. The page should make assignment and permission visible rather than hiding unrelated information in tabs or presenting every metric as equally urgent.

## Recommended operating loop

1. **Orient:** header identifies the company workspace and Overview. A short sentence states which work is included, such as “Your assigned work and company decisions.” If scope is “All company work,” show that explicitly.
2. **Recognize:** the first list contains items that need action, each with object type, record name, exact issue, ownership or assignment, and timing. The list may contain opportunity follow-up, project hold, time review, billing, or other authorized tasks; it is not restricted to one department.
3. **Predict:** action language names the result of opening the record: “Review submitted time,” “Open blocked operation,” “Review proposal response.” Avoid “View” or “Open readiness” when the actual target can be identified.
4. **Act:** the item opens the exact record and relevant view when an accessible deep link exists. A list-level filter or search helps a person with many items, but does not replace direct actions.
5. **Confirm:** the source screen confirms any consequential change. On returning to Overview, the item reflects authoritative state or shows that refresh is pending. It must not disappear merely because a request was sent.
6. **Continue:** recent records and the next scheduled handoffs appear below urgent work. Returning from a detail screen restores list scope and position when practical.

## Information hierarchy

```text
Global: Overview | Opportunities | Projects | Financials | Administration
Company identity                                      Search  Account

Overview                           [Start opportunity] [Add awarded project]
Your assigned work and company decisions              [My work | All accessible]

Needs action
  Priority / status  Record and project  Why it needs action  When  Direct action
  ...

Upcoming work and handoffs
  Scheduled operation / proposal follow-up / submitted time / invoice due

Continue work
  Recently visited opportunity and project records

Optional compact operating summary, linked to source queues
```

The first viewport is task-led. Summary figures are secondary, show their scope and time period, and link to the source queue. Ordinary money values remain neutral. Red, amber, and green describe actual state, not cost versus revenue. When there are many action items, show a bounded first set and a clear “See all work” path. Do not hide a critical item behind a tab chosen by another session.

## Item contract

Every action item needs a stable record identity; company and permission scope; object type; human-readable subject; exact reason; severity or timing when established; source timestamp; responsible person or team when known; and a destination to the affected record. Its status must be derived from authoritative data. If only a broad queue destination is available, label the action honestly and retain enough context to find the item there. Do not manufacture a record link or urgency level.

Examples of presentation, contingent on actual data:

| Source situation | Overview wording | Destination intent |
| --- | --- | --- |
| Proposal has a customer response | “Proposal 1042 · response needs review” | That proposal and response |
| Operation cannot start | “East slab · inspection hold” | That project operation and its constraint |
| Time submitted for approval | “Three timecards need review” | Time review queue filtered to the relevant submissions |
| Invoice is overdue | “Invoice 208 · balance overdue” | That invoice, or a clearly filtered receivables queue |

The examples are wording patterns, not assertions that those exact records or filters exist today.

## Roles and first-use states

The same page structure adapts to permissions and assignments. An owner may see company-wide decisions. An estimator sees opportunities and proposals they can act on. A project manager sees project setup, upcoming operations, holds, and changes. A foreman sees assigned project and field work, with the mobile worker entry remaining available where its specialized time flow is required. Accounting sees submitted time, billing, payables, and reconciliation where permitted. A person with mixed duties sees one combined list with record and domain labels, not separate dashboards.

- **Brand-new workspace:** replace empty metrics with two strong starting choices, **Start an opportunity** and **Add an awarded project**. Below, show a small, skippable company checklist for inviting people and completing relevant setup. Do not imply that all integrations are mandatory to begin work.
- **Invited member without assignments:** identify the company and role, show what areas they can access, and explain how to find work or request assignment. Do not show fake “all clear” language.
- **No actionable exceptions:** say “No items need your action right now” and still show upcoming and recent work. This is not a claim that every company process is healthy.
- **Partial data failure:** keep successful sections visible, mark the unavailable source by name, and offer a retry. Do not convert missing billing or schedule data to zero or “all clear.”
- **Permission limits:** omit private values and actions. A request-access path may explain the record type and company contact without leaking its content.

## Responsive and interaction contract

Desktop uses a broad list with clear columns and enough room for record names. Rows remain scannable at estimating density. Mobile turns each item into a compact stacked row: subject and issue first, timing and ownership second, full-width or clearly tappable action third. Field work and urgent holds remain readable outdoors. Color is paired with status words and icons. Touch targets, visible keyboard focus, logical heading order, and reduced-motion behavior are required in both themes. Search and filters preserve the current scope on return when feasible.

The five global areas remain stable. Overview does not become another menu of every route. Its content navigates to contextual opportunity, project, financial, or administration records. Deep links should survive sign-in and preserve the intended record if access is granted.

## Recovery and validation

Opening an item is navigation, but any action performed at its destination follows that workflow's pending, success, failure, and partial-state contract. Overview should not show an item as resolved until the authoritative record confirms the change. If source data is loading or unavailable, state that explicitly and keep last-known information clearly dated only if the data policy allows it.

Functional checks: a resolved source item updates or leaves the action list appropriately; an unresolved or failed action remains findable; a direct link reaches the correct record; changing list scope does not expose inaccessible records. User checks: ask each role to find a task without naming its page or button, then ask what record and state they expect after acting. Observe wrong turns, backtracking, and whether they can return to the same work. No success threshold or research result is assumed before testing.

## Implementation questions for the later build

1. Which current source records have stable detail links and which need contextual queue filters? The current `/readiness` and `/billing` links are broader than the item they describe.
2. What assignment fields and permission rules can reliably distinguish “My work” from “All accessible” for each role?
3. How should recent records be stored without leaking one member's activity to another?
4. Which summary figures remain useful after task-led ordering, and what source and time scope will each show?
5. How should the specialized `/employee` field entry meet this shared Overview model without slowing clock and field tasks?
