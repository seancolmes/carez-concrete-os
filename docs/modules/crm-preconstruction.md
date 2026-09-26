# Module Spec — CRM / Preconstruction

Status: P2 target

## Purpose
Manage concrete opportunities and the real estimating workflow on a persistent Job Spine rather than a generic CRM pipeline.

## Primary states
Invited → Reviewing → Plans Received → Takeoff → Pricing → Bid Review → Submitted → Awaiting Award → Won/Lost.

## Core capabilities
Job Spine creation, Opportunity/contact linkage, ITB intake, plans/specs, bid dates, estimator ownership, bid calendar, notes/tasks, quote requests, bid status, won/lost reason, award decision, and clean handoff to accepted scope and project creation.

## Lifecycle boundary

- Intake creates or links one company-scoped Job Spine and a distinct Opportunity record.
- Estimates, Proposal revisions, award decisions, documents, and the eventual Project remain separate records linked to that Job Spine.
- Marking an Opportunity won does not mutate it into a Project. An authorized award action records the decision, creates an immutable Accepted Scope Snapshot, and creates or links the Project on the same Job Spine.
- Lost, declined, or superseded Opportunities remain historical preconstruction records. Their estimates, proposals, documents, and decision history are retained according to policy.
- The handoff reuses linked customer, contact, location, document, and accepted commercial data rather than recreating them.

## Invariants
- Preconstruction data must connect directly to plans, Takeoff, Estimate, Proposal, and Award.
- Opportunity and Project identities remain distinct while sharing the same persistent Job Spine.
- Winning work must not require re-entry of accepted commercial scope.
- Project creation consumes an explicit Accepted Scope Snapshot; it does not infer acceptance from the latest estimate or every line in an issued proposal.
- Bid board/calendar focus on estimator workload and deadlines, not generic sales metrics.

## Implemented V1 award foundation

Migration `20260926010000_job_spine_award_foundation.sql` adds the tenant-owned Job Spine to Opportunity, Estimate, Proposal revision, Award Decision, Accepted Scope Snapshot, and Project. Existing unambiguous Opportunity and source-Estimate links are backfilled; orphan phases are given a distinct spine with a migration review record.

The internal Award action can award one full exact issued Proposal revision. It creates or links a Project on the same spine in one database transaction and returns the existing result on repeat execution. Public Proposal actions remain limited to response handling. Customer questions, change requests, unresolved alternates, missing frozen internal evidence, and unresolved Condition outputs hold award.

