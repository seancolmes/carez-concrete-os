# Plan 003: Make visible actions lead to usable work

> Executor: Inspect the current uncommitted source before editing; planned at commit 4a0f104d. Do not change branches, reset, stash, commit, or alter remote state.

## Status

- Priority: P2
- Effort: S-M
- Risk: Low; hiding a shortcut can reduce discoverability unless a contextual entry remains
- Depends on: none
- Category: correctness and navigation
- Confidence: High

## Why this matters

The command menu offers Banking, Reconcile, Payables, and Payroll as usable destinations even though those views are explicitly unconnected. In the recorded empty company, Create First Package and Create invoice open forms requiring a job that does not exist. These actions create wrong turns and abandoned forms.

## Current state

- components/AppShell.tsx:27-33 defines FINANCIAL_COMMANDS with ledger, banking, reconcile, bank-rules, payables, and payroll URLs; :61-62 renders every command item.
- components/financials/FinancialsWorkspace.tsx:37-58 permits only billing, invoices, payments, retainage, billing-setup, costs, catalog, and work-package-financials; unavailable groups are otherwise labeled Not connected.
- app/settings/page.tsx:66 offers Open banking to an unavailable view. app/projects/[id]/page.tsx:97 offers Order Materials to an unavailable procurement view.
- components/field/views/production.tsx:52 offers Create First Package without a job prerequisite check. components/financials/views/invoices.tsx:38-39 opens Create invoice with a required Job selector, even when it has no options.
- app/opportunities/page.tsx:121 shows Choose an opportunity in Overview after allowing a user to enter a record-dependent section without a selected record.

## Scope

In scope: the listed visible links/actions and their empty/disabled states. Keep existing compatibility redirects and deep links intact.

Out of scope: implementing new banking, procurement, or payroll data contracts; deleting routes or records; changing invoice/work-package business rules.

## Steps and gates

1. Restrict the command menu to genuinely available destinations. Keep a discoverable, clearly labeled connection/status entry in Administration if the product needs to explain future modules. Verify by keyboard command search: unavailable financial actions are not presented as ready-to-use commands.
2. Replace the Settings and Project detail links to unavailable finance views with either a truthful status or a working contextual destination. Verify each visible link reaches the named task, not a generic Not connected fallback.
3. When no eligible job exists, show the prerequisite and a working Create/Open Job action before opening the package or invoice form. Preserve entered work and selections if a job becomes unavailable mid-flow. Verify with zero jobs and one eligible job: the zero-job state has no impossible submit path; the one-job state can complete the existing flow.
4. For record-dependent Opportunity sections, keep the selected record in context or present a direct record picker instead of sending the user back to Overview. Verify a selected record survives movement among Scope, Takeoff, Commercial Baseline, and Activity.
5. Run pnpm typecheck. Expected: exit 0. Inspect final diff for only the in-scope actions and any direct shared navigation dependency.

## Done criteria

- All visible commands and links in scope reach a usable task or truthfully state unavailability before activation.
- Zero-job states provide a clear next action without opening an impossible form.
- Existing deep links and compatibility redirects still resolve.
- Keyboard command search, record context, and pnpm typecheck pass.

## Stop conditions

- Availability depends on a permission or company setting absent from current source; obtain the exact state before choosing a hide/disable rule.
- A link is used by an external consumer whose contract would be changed.
- The fix requires changing billing or project readiness authority.

## Maintenance note

Navigation metadata and actual available views should share one availability contract so new commands cannot drift from connected view loaders.
