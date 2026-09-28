# PourTrace first-use experience — design brief

Status: Proposed experience for discussion. No subscription, payment, account, route, or authorization behavior is implemented by this document. Read with `POURTRACE_ROUTE_DISPOSITION.md` and the PourTrace palette in `DESIGN.md`.

## Decisions already made

- PourTrace is a company workspace sold by monthly or annual subscription. A purchaser does not receive or redeem an access key. Employees do not buy separate subscriptions.
- Company setup is self-service. The administrator can invite estimators, project managers, foremen, accounting staff, and other team members into the same workspace.
- A new company can begin with an opportunity or enter an awarded project already underway.
- Global navigation uses **Overview, Opportunities, Projects, Financials, Administration**. Opportunity work contains plans, Takeoff, estimate, review, and proposal. Project work contains the awarded job and its operations.
- The accepted PourTrace green, graphite, concrete, blue, and amber color roles apply. Light and dark themes must keep the same hierarchy.

## Evidence and limits

The current `/login` page explains the plan-to-field product story and embeds returning-user sign-in. It has no subscription purchase path. The current `/` page combines cross-job attention, operations, pursuit, cash, and metric summaries; employees redirect to `/employee`. The active navigation model still presents seven areas and includes Pour Control. These are observations of the local source, not constraints on the new design. The 71-route disposition is the current map of where existing records can be reached. Signed-in visual behavior, real subscription states, and role-specific usability have not yet been validated with users.

## Two entry journeys

### New company administrator

1. **Understand.** On the public landing page, see what PourTrace connects and that one company subscription covers the workspace. The main action is **Create your company workspace**; **Sign in** is a separate, less prominent action for existing members.
2. **Choose.** A plan page presents monthly and annual billing with the actual price, renewal period, included access, and applicable terms before checkout. The period selection stays visible through checkout. The interface must not imply a trial, discount, seat cap, or cancellation policy until those rules are decided.
3. **Establish identity.** Capture a recoverable administrator sign-in before payment so an interrupted checkout can be resumed without losing ownership of the subscription. The exact email-verification timing depends on the chosen provider and approved account policy.
4. **Subscribe.** Checkout shows a clear pending state and prevents duplicate submissions. A return or refresh checks the provider-confirmed subscription state before claiming success. A declined or interrupted payment retains the selected billing period and offers a safe retry. If payment succeeded but the browser did not return, the customer can resume from the administrator account once the provider state is reconciled.
5. **Create workspace.** Associate the confirmed company subscription with one company record and administrator identity. Ask for the minimum company information needed to create a usable workspace; defer optional branding, catalog, integration, and finance configuration. The completion screen names the company and gives a direct link to its workspace.
6. **Invite team.** Offer invitations by email and role with plain descriptions of what each role can access. This is skippable so a solo administrator can start work. Invitations must show pending, accepted, expired, and failed states without implying access was granted before acceptance.
7. **Start work.** Present two equally clear choices: **Start an opportunity** and **Add an awarded project**. Explain the records each creates. Do not force an awarded job through a fabricated bid or estimate. Keep a third, quieter path to Overview for someone who wants to look around first.

### Invited team member

1. Open an invitation that identifies the company and role before accepting.
2. Sign in or create an individual account, then accept the invitation into the named company workspace. The invitation is company-bound; it does not create a personal subscription.
3. Land on an assignment-aware Overview or, for an employee field role, the mobile worker entry. If no assignments exist, show who invited them, what access they have, and how to find work or ask their administrator for access.
4. If an invitation is expired, already used, revoked, or for a different signed-in identity, explain the exact state and recovery step. Preserve a safe path back to sign-in.

## Screen structure

### Public landing

The first viewport should answer three questions: **What is PourTrace? Who is it for? How do I start?** Keep the source drawing → quantity → estimate/proposal → awarded project → field and financial record narrative. Demonstrate the product with real, representative screen material when approved; do not present decorative metrics as live product results. Place **Create your company workspace** and **Sign in** in stable positions on desktop and mobile. The purchase path should be discoverable without scrolling through the entire marketing page.

### Plans and checkout

Use a two-choice monthly/annual comparison with the same included product scope unless an approved commercial policy says otherwise. Put price, currency, billing interval, renewal terms, and any taxes or provider-specific charges where the customer can see them before commitment. Summarize the selected period beside the checkout action. A person returning from checkout should see the confirmed subscription state and the next setup step, rather than an ambiguous “success” banner on an unrelated page.

### Workspace setup

Show a short progress path: **Account → Subscription → Company → People → First work**. The subscription step is read-only after provider confirmation. Save valid company input between steps and after interruption. Reveal optional setup as a checklist after the workspace exists instead of expanding the activation form. The first work choice should be the focal point on the completion screen.

### Overview after setup

Use the same page framework for every role. Its content responds to assignment and permissions:

```text
Company / workspace identity                       Search · Account
Overview · Opportunities · Projects · Financials · Administration

Overview
What needs attention across your work?

[Assigned work and decisions requiring action]
  record · reason · owner / due context · direct action

[Next scheduled or pending handoffs]
  opportunity → proposal; award → setup; operation → field; time → review; invoice → payment

[Recent work / continue where you left off]

When empty: Start an opportunity | Add an awarded project
```

No role receives a separate product taxonomy. An estimator can see proposal follow-ups; a project manager can see the next blocked operation; a foreman can see assigned field work; accounting can see submitted time or billing; an owner can see cross-company exceptions. A role with multiple responsibilities sees a combined, prioritized list with clear record and responsibility labels. Money uses neutral text; status or variance earns semantic color.

## Navigation and layout behavior

- The five global areas identify where work lives. They do not expose every old route as a peer destination. On desktop, each area opens a concise landing or contextual view; search reaches known records and deeper tools. On mobile, the same areas remain recognizable, while the active task takes the largest part of the screen.
- Opportunity and project detail pages keep identity, lifecycle status, and the next useful action visible. Their inner navigation is scoped to that record. Cross-company queues such as estimate review or invoice review retain direct links to the source record.
- The layout should present one dominant work surface. A drawing, estimate table, schedule, or field form must have enough room to operate. Supporting context appears near the relevant decision or on demand.
- A deep link must reopen the same record after sign-in when the member has access. A member without access sees the record type and a clear access request path, without exposing private data.
- Keyboard users can reach global areas, record views, search, and primary actions in a predictable order. Focus is visible in both themes. Mobile controls meet touch target needs and do not rely on hover.

## States and recovery contract

| Action | Pending and prevention | Confirmed result | Failure or partial recovery |
| --- | --- | --- | --- |
| Subscribe | Lock one submission while provider response is unresolved; retain selected period. | Show provider-confirmed company subscription state and next setup step. | Decline, interruption, or delayed confirmation shows the known state, preserves selection, and offers retry or status check without a duplicate charge. |
| Create workspace | Prevent duplicate company creation while request is unresolved. | Name and link the created company workspace. | Keep valid company input. If subscription exists but workspace creation fails, resume setup against that subscription. |
| Invite member | Identify company, email, and role before sending; show sending state. | Show the actual invitation state and recipient in People and access. | Keep the invitation draft. Explain duplicate, invalid, expired, or delivery failure and provide a safe resend path when policy permits. |
| Start opportunity | Show the proposed opportunity name/customer and save progress. | Open the new opportunity with next steps for plans and scope. | Preserve the draft and avoid a duplicate record on retry. |
| Add awarded project | Make clear that this records already-awarded work. | Open the project with setup checks and next operation planning. | Preserve entered job details; do not silently create an opportunity or invent commercial history. |

Success messages must identify the affected company or record. They may claim only the state confirmed by the authoritative service. A returned checkout page, dispatched invitation, or optimistic update alone is not completion.

## Review scenarios

Test the flow with an owner, estimator, project manager, foreman, and accounting user. Give each person a goal without naming the destination or control, then observe whether they choose the right first action, find the source record, understand its current state, and recover from interruption without help. Specific checks:

1. A new purchaser can distinguish **create a company workspace** from **sign in** and can identify the selected monthly or annual period before committing.
2. An administrator with an existing awarded job can start a project without creating a false opportunity.
3. An invited member can identify the company and access being accepted, then find assigned work.
4. Each role can locate one consequential task from Overview and return to the same record after leaving it.
5. A failed checkout or workspace setup leaves no ambiguous “active” claim and no need to re-enter valid information.
6. Desktop and outdoor mobile review confirm readable contrast, visible focus, large field controls, and non-color status cues.

Record wrong turns, backtracking, abandoned steps, and whether people can correctly state what happened. Do not invent success targets before a baseline or user test.

## Decisions needed before implementation

- Subscription price, currency, tax presentation, trial or no trial, renewal terms, cancellation and reactivation policy.
- Payment provider and authoritative webhook/state reconciliation; recovery path after a successful payment with an interrupted browser return.
- Billing owner and transfer policy when the purchasing administrator leaves a company.
- Minimum company fields, company identity verification if any, and whether the subscriber can create more than one workspace.
- Invitation eligibility, role permission definitions, expiration, and resend policy. Existing employee and crew invitation paths need a unified access design.

These are commercial and access policies, not visual choices. The design should show their approved values clearly once decided.
