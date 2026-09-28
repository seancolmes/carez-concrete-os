# PourTrace Opportunities — page and record design brief

Status: Proposed experience with a bounded queue improvement in progress. This document does not authorize changes to Takeoff quantity authority, estimate calculations, proposal approval, or award rules.

## Purpose and source evidence

An opportunity is the stable preaward job context. A team member should recognize its customer, job, bid deadline, current work, next decision, and latest estimate/proposal revision, then continue that work without rediscovering the record in another company-wide queue.

The current `/leads` route holds intake, follow-up, status, activity, and an estimate conversion action. It queries linked estimates and activities. `/takeoff`, `/estimates`, and `/proposals` are separate company-wide pages. An estimate records `lead_id` and `opportunity_number`; proposals are reached by estimate ID. There is no `app/leads/[id]/page.tsx` in the current checkout, so a lead cannot yet open as a complete opportunity record. The current lead list renders broad cards with contact, address, dates, scope, two edit forms, activity history, and actions for every item. That makes a multi-opportunity queue hard to scan.

## Recommended experience

### Opportunities hub

The page title is **Opportunities**. The first task is to find the right pursuit or identify a deadline, follow-up, or response requiring attention. The header offers **New opportunity** and a quieter **Intake** entry for incoming messages. A compact status summary may show open work and due items, but it must not be the page's main content.

Use one row per opportunity, sorted by meaningful work state when an authoritative ordering is available. The minimum visible facts are opportunity number, job/customer, stage, bid due or follow-up date, and the next direct action. Additional contact details, scope, activity, and edit controls open inside that opportunity or an expanded row. A closed opportunity remains findable without competing with active pursuits. Empty state offers **New opportunity** and **Review intake**; a disconnected Outlook integration must not block manual creation.

### Opportunity record

The future record route should identify the customer, job, opportunity number, status, bid deadline, and current owner or responsibility when known. It provides connected views, not five unrelated top-level destinations:

```text
Opportunity identity · next action · stage
Overview | Plans & Takeoff | Estimate | Proposal | Activity

Overview: due dates, scope summary, latest revision, outstanding decisions
Plans & Takeoff: plan sets, authoritative 2D measurements, source evidence
Estimate: revisions, quantity, direct cost, sell, review state
Proposal: current issued revision, customer response, award path
Activity: contacts, notes, follow-ups, source messages
```

The views may initially link to existing workstation routes. Record context should remain visible when moving to the drawing or estimate. The source page controls authoritative operations; an opportunity wrapper must not recalculate quantities or prices. An accepted proposal and internal Award remain separate decisions. Award creates or connects an awarded project on the same lineage. A company that arrives with work already awarded can still add a project directly without inventing an opportunity.

### Cross-company queues

Takeoff, Estimate, and Proposal queues remain available for people processing many jobs. Their rows identify the associated opportunity and open its exact record or workstation. A queue is a workload view; it does not replace the opportunity's identity. Compatibility URLs stay valid during presentation migration.

## States and recovery

- Creating an opportunity shows pending state, prevents duplicate submission, retains valid input on failure, and confirms the assigned opportunity number and record link only after persistence succeeds.
- Starting an estimate checks for an existing active estimate before creating another. The user should land on the exact estimate revision, and the opportunity should then show that revision. Failure keeps the opportunity and its entered activity intact.
- Status and follow-up edits confirm the saved value. A failed update leaves the prior authoritative value visible with a cause and retry path, rather than silently treating the field as saved.
- A proposal response or award decision must display the actual resulting state on the relevant proposal and project; a customer response alone is not internal Award.
- Partial data failure distinguishes “no estimate yet” from “estimate data unavailable.” Access denial must not reveal another company's record.

## Layout and accessibility

The Opportunities hub is a scan-first list on desktop and a compact stacked list on mobile. The record page gives the active Takeoff or estimate workstation the largest area. Use neutral text for values and semantic color for due, blocked, review, and completed states. Pair status color with words and dates. Row summaries remain keyboard operable with visible focus and large mobile targets. No core decision depends on a hover-only action.

## Validation

Ask an estimator to find a named job with a due bid, continue its latest estimate, and identify whether a proposal has been issued without naming the page or route. Ask a project manager to trace an accepted proposal into the awarded project. Confirm exact links, revision identity, preserved 2D quantity source, no duplicate estimate creation, and recovery after a failed save. Observe wrong turns, queue hopping, and whether the person can state the current stage correctly.

## Implementation sequence

1. Improve `/leads` presentation into a scan-first Opportunities hub while preserving its forms and actions.
2. Add an opportunity detail route with one stable record identity and contextual links to existing Takeoff, Estimate, Proposal, and Activity work.
3. Add opportunity context to the existing deep workstations and cross-company queues; preserve old URLs.
4. Validate estimate, proposal, and award lineage before changing any redirect or record-creation behavior.

Unresolved: assignment/ownership model; exact relationship between a lead and multiple plan sets; which revision is current in every historical state; whether any opportunity may proceed to proposal without a conventional Takeoff; and permissions for the proposed record views. Verify these against current source and representative company data before implementation.
