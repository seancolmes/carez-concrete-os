# Pourtrace route disposition — design draft

Status: Discussion draft with the product owner's confirmed decision to retire standalone Pour Control while retaining concrete delivery tickets and placed quantities in project documents and production work. Source inventory began with 71 `app/**/page.tsx` routes; the new opportunity detail route makes 72 in the current local checkout. This maps presentation and entry points; it does not authorize immediate route deletion, data migration, or changes to domain rules. Runtime behavior and visual quality remain to be checked with representative accounts and data.

## Proposed navigation

Global areas: **Overview · Opportunities · Projects · Financials · Administration**. Public purchase, activation, sign-in, invite, customer, print, and internal review routes sit outside global navigation.

An opportunity contains its plans, takeoff, estimate revisions, review, and proposal revisions. An awarded project is a distinct record on the same job lineage and contains setup, work plan, schedule, readiness, field evidence, production, changes, costs, and closeout. Company-wide queues remain available where someone works across multiple opportunities or projects. Existing URLs remain valid through presentation migration unless a later compatibility plan explicitly changes them.

Disposition terms: **Hub** = main area entry; **View** = contextual view or cross-record queue; **Detail** = bookmarkable record/workstation; **Utility** = needed outside the five-area navigation; **Compatibility** = keep accessible for referenced history; **Retire** = approved product direction, with route and persistence removal sequenced through dependency and data-preservation design.

## Public, activation, and overview

| Current route | Proposed home | Disposition | Reason / next design question |
| --- | --- | --- | --- |
| `/login` | Public site and access | Utility | Separate product explanation, monthly or annual subscription signup, and returning-user sign-in. Current page only supports sign-in. |
| `/` | Overview | Hub | Role-relevant tasks, handoffs, and cross-job attention; avoid a wall of metrics. |
| `/reports` | Overview / project insights | View | Company reporting with drilldown to the exact project and source record. |
| `/employee` | Worker entry | Utility | Mobile-first personal work and time flow; do not force a field worker through office navigation. |
| `/employee/join/[token]` | Team invitation | Utility | Private invitation acceptance; preserve role and company binding. |
| `/crew/access/invite/[token]` | Team invitation | Utility | Existing employee invite link; reconcile with the broader company invite model. |
| `/proposal/[token]` | Customer review | Utility | Customer-facing proposal access and decision; outside employee navigation. |
| `/design-review` | Internal design QA | Utility | Keep out of customer navigation and production discovery. |
| `/design-reviews/overlays` | Internal design QA | Utility | Keep out of customer navigation and production discovery. |

## Opportunities

| Current route | Proposed home | Disposition | Reason / next design question |
| --- | --- | --- | --- |
| `/leads` | Opportunities | Hub | Opportunity list and intake actions. Use one stable opportunity identity through preaward work. |
| `/leads/[id]` | Opportunity record | Detail | Connect intake, linked plan sets, estimate revisions, proposal states, and activity under the company-scoped opportunity identity. |
| `/leads/inbox` | Opportunities · Intake | View | Incoming opportunities, review, and conversion; a queue within Opportunities. |
| `/bid-intelligence` | Opportunities · Insights | View | Pursuit evidence used while choosing and pricing bids. |
| `/takeoff` | Opportunities · Takeoff queue | View | Cross-opportunity queue and compatibility entry; primary entry is the selected opportunity. |
| `/takeoff/plans` | Opportunity · Plans | View | Plan and sheet management in the opportunity context. |
| `/takeoff/[setId]` | Opportunity · Takeoff | Detail | Preserve the dominant drawing workstation, authoritative 2D geometry, and deep link. |
| `/takeoff/assemblies` | Estimating history | Compatibility | Legacy assembly audit remains accessible for referenced records, outside primary navigation. |
| `/takeoff/intelligence` | Opportunities · Estimating evidence | View | Cross-job production learning available when estimating; distinguish evidence from approved rates. |
| `/estimates` | Opportunities · Estimate queue | View | Cross-opportunity workload; selected opportunity holds its estimate revisions. |
| `/estimates/[estimateId]` | Opportunity · Estimate | Detail | Preserve revision, quantity, direct cost, sell, and review lineage. |
| `/estimates/audit` | Opportunity · Commercial review | View | Review belongs with the exact estimate/proposal decision. |
| `/proposals` | Opportunities · Proposal queue | View | Cross-opportunity follow-up queue. |
| `/proposals/[estimateId]` | Opportunity · Proposal | Detail | Preserve issued revision, customer response, and award path. |

## Projects: setup, plan, delivery, and closeout

| Current route | Proposed home | Disposition | Reason / next design question |
| --- | --- | --- | --- |
| `/projects` | Projects | Hub | Active and historical project list, with a clear awarded-project entry point. |
| `/projects/[id]` | Project overview | Detail | Stable project identity and contextual navigation; show next operation and consequential exceptions first. |
| `/job-setup` | Projects · Setup queue | View | Cross-project award-to-operations handoff queue. |
| `/job-setup/[projectId]` | Project · Setup | Detail | Agreement, accepted baseline, budget, and initial operating plan remain distinct checks. |
| `/startup` | Project · Setup and planning | View | Fold startup board into the project handoff and cross-project exceptions. |
| `/schedule` | Projects · Schedule | View | Cross-project schedule plus project-filtered schedule; committed, lookahead, and daily work stay distinct. |
| `/look-ahead` | Project · Schedule | View | A horizon/constraints view of the schedule, not a global peer destination. |
| `/readiness` | Project · Schedule / next operation | View | Show why an operation can or cannot start beside that operation and its schedule. |
| `/readiness/resources` | Project · Resources | View | Material/equipment/vendor requirements beside the affected scheduled work. |
| `/production/work-packages` | Project · Work plan | View | Physical scope units and operations shown with schedule, crew, and quantity; preserve their record IDs and lineage. |
| `/production/work-packages/financials` | Project · Cost and production | View | Compare direct estimate cost with direct actual cost without mixing overhead or sell. |
| `/field` | Projects · Field activity | View | Cross-project field control; project-filtered activity in the project. |
| `/field/review` | Projects · Time review | View | Review submitted time in a cross-project queue with project context. |
| `/production` | Projects · Production | View | Earned quantity and actual rates tied to the operation; company-wide exception queue may remain. |
| `/pour-control` | Projects · Work plan / production | Retire | Remove the standalone Pour Control experience. Existing funding authorization, readiness, and pour-record dependencies need explicit replacement or retirement rules before code and data removal. |
| `/pour-control/deliveries` | Project · Documents and production | Retire | Move ticket capture and review to project documents and ticket-derived placed quantity to project production; retain source evidence and historical references. |
| `/scope-drift` | Project · Changes | View | Unplanned or changed physical scope in the project context. |
| `/change-orders` | Project · Changes | View | Cross-project approval queue plus project change record, preserving commercial lineage. |
| `/forecast` | Project · Performance | View | Job forecast from authorized scope, production, and actual cost; cross-project risk queue may remain. |
| `/closeout` | Project · Closeout | View | Closeout checks and unresolved items on the specific project. |
| `/documents` | Project · Documents / global search | View | Job-linked evidence in context; retain cross-job retrieval utility. |
| `/crew` | Projects · Workforce / Administration · People | View | Company roster and rates need a clear owner; assignments belong with project work. |
| `/equipment` | Projects · Resources / Administration · Assets | View | Company inventory and project allocation need separate entry points within one resource model. |

## Financials

| Current route | Proposed home | Disposition | Reason / next design question |
| --- | --- | --- | --- |
| `/billing` | Financials · Billing | Hub view | Company receivables queue; project billing remains reachable from project context. |
| `/billing/setup` | Project · Setup / Financials · Billing | View | Contract billing terms are part of awarded-job setup. |
| `/billing/invoices` | Financials · Invoices | View | Company invoice queue with project filters. |
| `/billing/invoices/[id]` | Invoice record | Detail | Preserve printable and shareable invoice record. |
| `/billing/payments` | Financials · Payments | View | Receipt/application history and outstanding balances. |
| `/billing/retainage` | Financials · Retainage | View | Retainage remains commercially distinct from ordinary receivables. |
| `/payables` | Financials · Payables | View | Vendor obligations across projects. |
| `/procurement` | Financials · Purchasing / Project · Procurement | View | Cross-project purchasing queue; project need initiates contextual purchase work. |
| `/procurement/quotes` | Procurement · Quotes | View | Supplier pricing within purchase workflow. |
| `/procurement/orders` | Procurement · Orders | View | Purchase commitments and status. |
| `/procurement/purchase-orders/[id]` | Purchase order record | Detail | Preserve printable vendor document and audit trail. |
| `/procurement/bills` | Financials · Payables | View | Supplier invoice posting and actual-cost transition. |
| `/procurement/vendors` | Financials · Vendors | View | Company supplier directory available in purchasing context. |
| `/costs` | Financials · Job cost | View | Company-wide actual-cost queue and project drilldown. |
| `/costs/catalog` | Financials · Cost catalog | View | Shared cost reference, with permissions and pricing provenance retained. |
| `/payroll` | Financials · Payroll | View | Payroll obligations and approved time lineage. |
| `/cashflow` | Financials · Cash flow | View | Company cash position, distinct from a project's budget or funding. |
| `/cashflow/accounts` | Financials · Accounts | View | Manual balances as fallback for unconnected accounts. |
| `/cashflow/expenses` | Financials · Operating expenses | View | Company expense outside a specific job. |
| `/cashflow/reserves` | Financials · Reserves | View | Protected funds and tax payments. |
| `/banking` | Financials · Banking | View | Connected accounts and transactions. |
| `/banking/reconcile` | Financials · Reconciliation | View | Match bank activity to the source records. |
| `/banking/rules` | Financials · Banking settings | View | Rules are contextual to banking, not global navigation. |
| `/overhead` | Financials · Overhead | View | Company operating cost and allocation assumptions. |

## Administration

| Current route | Proposed home | Disposition | Reason / next design question |
| --- | --- | --- | --- |
| `/settings` | Administration | Hub | Company identity, people and access, integrations, and personal preferences as distinct sections. |
| `/crew/access` | Administration · People and access | View | Employee login invitations and access, reconciled with broader role invites. |

## Concepts to clarify before implementation

- **Work package** currently means a physical chunk of project scope with operations, known quantity, labor budget, crew/time, readiness, completion, production, and cost links. The UI can present it as a **work area or scope item** within the project work plan, but the persisted record cannot be removed just because its standalone page goes away.
- **Readiness** currently means whether the next operation may start, based on preceding work, inspections, resources, holds, and other constraints. Present the specific reason and next action on the schedule/operation rather than asking people to visit a separate abstract destination.
- **Pour Control** currently combines a planned concrete placement, a cash authorization check, supplier/mix/pump details, delivery tickets, and ticket-derived production CY. The confirmed product direction retires the standalone module. Keep ticket capture and source photos under project documents and show ticket-derived placed quantity in project production. Preserve historical accepted/actual records and downstream references through a source-controlled compatibility plan. Before implementation, decide how to handle existing pour funding authorization and any start gate that depends on it; do not silently bypass a hold or rewrite completed production.
- **Subscription signup** is not represented by a current page route. Design a self-service monthly or annual company subscription → workspace creation → administrator account → invited team path. One company subscription provides its workspace; employees do not purchase separate access. Payment provider, pricing, trial policy, billing ownership, payment failure, cancellation, and reactivation rules remain unresolved business decisions. Do not add a purchase or access key to the flow.

## Next design and validation steps

1. Review the remaining page placements with the product owner, especially the boundary between project work and Financials. Pour Control retirement and ticket relocation are confirmed design decisions; their compatibility rules remain to be specified.
2. Design navigation and page templates for Overview, opportunity detail, project detail, Financials queues, Administration, and worker mobile entry.
3. Test first-click and end-to-end tasks with each relevant role, including new-company setup, estimate-to-award, project planning, field execution, invoice retrieval, and recovery from interrupted work.
4. Map each approved presentation change to the owning route/component and migration compatibility work before implementation. No route, table, or referenced record is deleted by this document.
