# P1.4 — Estimate Review / Recap Exception-First Release Readiness

Status: Approved design  
Parent: Issue #86 — P1 Epic — Condition-first Estimating workflow  
Base: `staging` at `f9d8a8c1c7b0ecf417a8e6dd24aba45a4e50e771`

## Purpose

P1.4 adds the authoritative commercial review boundary between Labor and Proposal:

```text
Conditions → Takeoff → Pricing → Labor → Review / Recap → Proposal Revision
```

The goal is an EDGE-style estimator workflow: Conditions and Takeoff drive quantities and resource build-up, pricing and labor assumptions remain reviewable, adjustments flow through the estimate, Recap exposes cost/labor/commercial decisions and exceptions, and Proposal is downstream of an explicit release decision.

Carez keeps its own stronger concrete-native architecture: deterministic server calculations, exact Estimate revision lineage, tenant isolation, persisted 2D Takeoff quantity authority, immutable issued commercial history, and human authority over commercial decisions.

P1.4 is not another estimating worksheet and not a second quantity, pricing, labor, or proposal engine. It is the server-authoritative release-readiness and Recap layer over existing P1.1–P1.3 data.

## Approved product policy

### Estimate status

The persisted Estimate status value `ready` is preserved for compatibility but its product meaning becomes:

> Ready for Review

It does not mean the Estimate is commercially cleared for Proposal.

Actual proposal release readiness is derived separately by P1.4.

### Release states

P1.4 derives exactly four product states:

- `not_ready` — Estimate has not entered Review.
- `blocked` — one or more objective release blockers exist.
- `review` — blockers are clear, but current warnings require acknowledgement.
- `release_ready` — blockers are clear and either no warnings exist or the complete current warning set has been acknowledged against the exact current commercial state.

No user directly sets these states.

### Blockers and warnings

- Blockers must be fixed. There is no override path.
- Warnings remain valid estimator decisions, but Proposal issuance requires one explicit **Reviewed / proceed** acknowledgement for the complete current warning set.
- A warning acknowledgement applies only to the exact current commercial state.
- Any commercially relevant change that alters the commercial fingerprint or warning fingerprint makes the prior acknowledgement stale.
- Historical acknowledgements remain immutable audit evidence; they are not deleted when stale.

## Architecture

P1.4 uses one database-owned deterministic release-readiness evaluator.

```text
Estimate revision
+ current Condition / Takeoff / Pricing / Labor / commercial facts
        ↓
server-authoritative readiness evaluator
        ↓
not_ready | blocked | review | release_ready
        ↓
Review / Recap UI
        ↓
optional complete-warning-set acknowledgement
        ↓
Proposal issuance re-checks the same authority
```

The same evaluator must be consumed by:

- Estimate Review / Recap;
- Proposal preparation status;
- Proposal issuance;
- Estimate list/status indicators where release readiness is shown.

React components and server actions may format or route findings, but they must not implement independent readiness rules.

Current findings remain derived. P1.4 does not add a mutable "current findings" table whose rows must be synchronized after every Estimate change; only human acknowledgement evidence is persisted.

## Estimate output scope

Generated commercial outputs are scoped through existing lineage:

```text
Estimate
→ takeoff_measurements.estimate_id
→ takeoff_measurement_outputs.measurement_id
```

P1.4 must preserve the P1.3 intra-tenant Estimate isolation fix. Company-wide output aggregation must never be treated as Estimate-specific readiness data.

## Finding model

Each finding has a deterministic identity and carries enough structured data for Recap display and routing.

Conceptual fields:

- `finding_key`
- `severity`: `blocker` or `warning`
- `category`
- `title`
- `detail`
- `next_action`
- relevant record identity
- stable destination/anchor when available
- structured facts needed for the warning fingerprint

Finding keys must be stable for the same underlying condition.

### Objective release blockers

These must be fixed before release:

| Category | Block condition |
| --- | --- |
| Customer price | Customer Sell is missing or `<= 0`. |
| Scope | Estimate has no commercial scope/items. |
| Generated pricing | Any active, Estimate-visible generated output in this Estimate is `missing_price`. |
| Condition/input | Any active, Estimate-visible output is `missing_input` or cannot produce its required commercial quantity/cost. |
| Labor assumption | A generated labor operation has neither a valid job MH/unit nor baseline MH/unit. |
| Labor rate | A generated labor operation is `missing_labor_rate`. |
| Manual cost integrity | A manual material/equipment/subcontract cost line has real quantity/scope but no Direct Cost. |
| Labor classification | Cost-bearing labor requires a Washington L&I class and the referenced class is missing or inactive. |
| Lineage | An active Estimate-visible Takeoff output intended for commercial use has lost required generated Estimate-item linkage. |
| Terms | Neither Estimate proposal terms nor company default terms exist. |
| Customer destination | No usable customer destination/contact exists for proposal issue. |

Workflow eligibility is reported separately from blocker count:

- Estimate is not `ready`;
- Estimate is already issued;
- Estimate is accepted, approved, or superseded.

Those states prevent release but should not be represented as ordinary commercial findings.

### Estimator-review warnings

Warnings are human-authoritative decisions and require acknowledgement when present:

| Category | Review condition |
| --- | --- |
| Margin | Projected margin is below the Estimate target margin. |
| Manual price decision | One or more generated outputs use an explicit manual price override. |
| Production override | One or more labor operations use explicit Job MH/unit instead of baseline. |
| Labor-rate decision | An estimator explicitly selected a non-default/current labor profile. |
| Supplier evidence | A selected supplier quote has expired. |
| Supplier alternative | Current pricing exists but unused supplier quote evidence is available for that resource. |
| Scope organization | Commercial scope or Takeoff-generated items remain unassigned to an Estimate section. |
| Proposal completeness | Schedule/payment/clarification information is absent where proposal issue is otherwise possible. |
| Physical/method review | Existing structured Condition/Takeoff/3D verification evidence identifies a review issue that is not itself an objective quantity/cost hold. |

P1.4 must not introduce hidden heuristics that declare estimator choices wrong. In particular:

- missing labor assumption = blocker;
- explicit Job MH/unit override = warning;
- missing price = blocker;
- explicit manual price source = warning.

An explicit override itself is the review signal. The estimator decides whether it is appropriate.

## Release-state derivation

```text
if Estimate has not entered Review:
    not_ready

else if objective blockers exist:
    blocked

else if warnings exist and no acknowledgement matches
        both the current commercial fingerprint
        and current warning fingerprint:
    review

else:
    release_ready
```

When warnings are zero, no acknowledgement is required.

## Review / Recap experience

The current route `/estimates/audit` remains for compatibility in P1.4. Visible product language changes from **Audit** to **Review**.

Workflow navigation becomes:

```text
Takeoff → Estimate → Review → Proposal
```

The focused Review route remains:

```text
/estimates/audit?estimate=<estimate-id>
```

A later route migration may be handled separately; P1.4 must not create duplicate Review surfaces.

### Page hierarchy

Focused Review / Recap presents:

1. Release control header.
2. Commercial Recap.
3. Blockers.
4. Warnings.
5. Commercial Decisions / overrides.
6. Scope Recap.
7. Pricing Recap.
8. Labor Recap.
9. Proposal-preparation summary.
10. Expandable Estimate Trace.

The page is exception-first. It must not render a large checklist of green rows by default.

Corrections happen in their owning workflows and flow back into Recap automatically.

### Finding actions

Each finding routes to its owning workflow rather than becoming a checkbox:

- missing material/equipment price → Pricing Coverage;
- missing labor assumption/rate → Labor Review;
- below-target margin → Price & Margin;
- unassigned scope → Estimate scope;
- missing proposal terms → Proposal preparation;
- Condition/input hold → Takeoff / Condition.

Stable anchors may be added to existing Estimate sections when useful.

Recap does not edit quantity, price, labor production assumptions, or proposal content.

## Commercial Recap

The financial recap shows:

- Direct Labor;
- Material;
- Equipment;
- Subcontractor;
- Other Direct Cost;
- Total Direct Cost;
- Company Overhead;
- revenue/transaction reserves;
- Base Company Cost;
- Recommended Sell;
- Customer Sell;
- Projected Profit;
- Projected Margin;
- Target Margin;
- applicable B&O / transaction assumptions.

Server-authoritative financial summary values remain the source.

The recap follows the estimator sequence:

```text
cost composition → company burden/reserves → selling price → margin
```

## Scope Recap

Scope is grouped by existing Estimate sections / concrete work areas.

Each group summarizes, where available:

- Condition count;
- measurement count;
- generated output count;
- Estimate item count;
- Direct Cost.

Unassigned/general commercial scope remains visible as a warning when applicable.

Recap must not create a second scope hierarchy.

## Pricing Recap

Pricing summarizes existing P1.1/P1.2 state, including:

- generated resource count;
- priced count;
- missing-price count;
- supplier-quote-selected count;
- catalog source count;
- template/default source count;
- manual override count;
- expired selected quote count;
- unused supplier evidence count.

Detailed price changes remain in Pricing Coverage.

## Labor Recap

Labor summarizes P1.3 state:

- labor operation count;
- Estimated MH;
- labor Direct Cost;
- baseline production-assumption count;
- Job MH/unit override count;
- explicit labor-rate-selection count;
- missing production-assumption count;
- missing labor-rate count.

For Job MH/unit overrides, Review may show:

- Production Quantity;
- baseline MH/unit;
- reviewed Job MH/unit;
- percentage/absolute difference for context;
- resulting Estimated MH;
- baseline source;
- override provenance.

No arbitrary threshold converts that context into an additional warning. The explicit override is already the warning.

## Commercial Decisions recap

Intentional deviations are consolidated so estimator decisions rise above normal estimate build-up.

Examples include:

- manual price override;
- supplier quote selection or expired quote;
- Job MH/unit override;
- explicit labor profile selection;
- Customer Sell below target margin.

Normal baseline values should not create noise.

## Estimate Trace

A secondary expandable trace provides detailed lineage without cluttering the primary Recap.

Each generated commercial line can trace:

```text
Concrete Condition
→ Takeoff measurement / drawing reference
→ Condition module / output
→ Production Quantity
→ generated Estimate item
→ price source
→ labor production assumption
→ labor rate source
→ Direct Cost
```

Where compatibility lineage is present, exact Condition/template/archetype/version references should remain visible.

### Sell boundary

P1.4 must not fabricate per-line Sell allocation.

Current Carez architecture has authoritative Estimate-level Customer Sell, not authoritative per-line Sell allocation.

Therefore:

- each commercial line traces exactly to Direct Cost;
- the Recap traces the full Estimate to authoritative Customer Sell;
- P1.4 does not invent proportional markup or item-level selling prices.

Production Quantity, Direct Cost, and Sell remain separate concepts.

## Proposal preparation summary

Review may display proposal-preparation facts such as:

- customer contact ready/missing;
- terms ready/missing;
- schedule summary ready/missing;
- payment summary ready/missing;
- clarification count;
- presented value-option count.

Proposal remains its own workflow step. Review does not become a proposal editor.

## Warning acknowledgement

When blockers are zero and warnings are present, Review exposes one explicit action:

> Reviewed / proceed

Immediately above the action, Carez shows the complete current warning set and states that the acknowledgement applies only to the current commercial state.

The action must:

1. re-evaluate readiness server-side;
2. refuse if any blocker exists;
3. refuse if there are no warnings requiring acknowledgement;
4. compute current fingerprints server-side;
5. persist one immutable acknowledgement for the complete current warning set;
6. persist an immutable warning snapshot as audit evidence;
7. record user and timestamp;
8. return/re-evaluate the resulting release state.

No client-supplied hash, warning count, finding list, or release state is trusted.

## Stale acknowledgement behavior

A prior acknowledgement remains historical evidence but grants no release authority when:

```text
acknowledged commercial fingerprint != current commercial fingerprint
or
acknowledged warning fingerprint != current warning fingerprint
```

The Review UI should show:

- that a previous review exists;
- who reviewed it;
- when;
- that it is stale;
- that the current Estimate requires review again.

No acknowledgement row is deleted merely because it became stale.

## Database model

### Authoritative evaluator

Add a deterministic database-owned evaluator, conceptually:

```text
carez_get_estimate_release_readiness(p_estimate_id uuid)
```

The exact SQL return shape may be a table, composite result, or JSONB contract, but it must provide at least:

- Estimate identity;
- workflow eligibility;
- derived release state;
- blocker count;
- warning count;
- structured blocker findings;
- structured warning findings;
- commercial fingerprint;
- warning fingerprint;
- acknowledgement validity;
- current acknowledgement metadata when valid;
- most recent historical acknowledgement metadata when useful for stale-state UX.

The evaluator must be tenant-scoped and reject inaccessible Estimates.

### Commercial fingerprint

The commercial fingerprint represents the exact release-relevant Estimate state.

It is computed server-side using deterministic ordering and SHA-256 via installed PostgreSQL `pgcrypto`.

The canonical snapshot includes release-relevant facts such as:

- Estimate revision identity/status;
- target margin;
- selected/customer Sell;
- Direct Cost, overhead, reserves, profit, margin;
- Estimate sections and items;
- current active Takeoff measurements;
- current active Estimate-visible outputs scoped through those measurements;
- Production Quantity and unit;
- pricing status;
- selected price provenance;
- baseline and Job MH/unit;
- labor-rate provenance;
- Direct Cost;
- applicable proposal terms;
- customer destination/contact readiness.

Arrays/sets must be deterministically ordered before hashing.

The exact fingerprint schema becomes part of the P1.4 database contract and must be tested for deterministic ordering.

### Warning fingerprint

The warning fingerprint represents the exact complete warning set.

Each warning contributes stable data including:

- warning key;
- category;
- relevant record identity;
- release-relevant warning facts.

Examples:

```text
margin_below_target
labor_job_override:<output-id>
manual_price_override:<output-id>
expired_supplier_quote:<quote-id>
unassigned_scope:<item-id>
```

A changed warning set or changed warning-relevant facts produces a new fingerprint.

### Acknowledgement table

Add an append-only table conceptually named:

```text
estimate_review_acknowledgements
```

Required fields:

- `id`
- `company_id`
- `estimate_id`
- `commercial_fingerprint`
- `warning_fingerprint`
- `warning_count`
- `warning_snapshot jsonb`
- `acknowledged_by`
- `acknowledged_at`

Historical acknowledgement rows are not updated or deleted through normal product paths.

Indexes must support current Estimate lookup and foreign keys must have covering indexes where needed.

## Acknowledgement RPC

Add a controlled RPC conceptually named:

```text
carez_acknowledge_estimate_review(p_estimate_id uuid)
```

The database must:

- verify authenticated tenant membership;
- require office authority rather than employee access;
- lock/read the exact Estimate revision;
- re-run the evaluator;
- reject if blockers exist;
- reject if no current warnings require acknowledgement;
- compute both fingerprints itself;
- insert the warning snapshot;
- record `auth.uid()` and server timestamp;
- return the resulting release state.

No direct client insert/update/delete to the acknowledgement table is allowed.

## RLS and grants

The acknowledgement table must:

- enable RLS;
- allow office users to read their own company acknowledgement history;
- deny cross-company access;
- deny employee acknowledgement;
- deny direct authenticated insert/update/delete;
- allow controlled creation only through the acknowledgement RPC;
- remain available to service role for controlled system work;
- expose no anon write path.

The evaluator and acknowledgement RPC must use the repository's existing tenant/role helpers and follow current SECURITY INVOKER / controlled-RPC patterns unless implementation evidence requires a different explicitly reviewed choice.

## Proposal enforcement

The current Proposal preparation readiness array may remain presentation-only, but it is not release authority.

Immediately before immutable proposal issue, the system must re-evaluate P1.4 readiness.

```text
createProposalLink()
        ↓
current database readiness evaluation
        ↓
blocked / review / not_ready → reject
release_ready              → proceed
```

P1.4 must also add a database-level proposal insertion guard so another future application path cannot bypass Review.

The guard must reject proposal creation unless the referenced Estimate is currently `release_ready`.

Proposal issuance still creates the existing immutable proposal revision/snapshot. P1.4 does not redesign Proposal Revision history.

The issued proposal presentation must retain the release evidence used at issue time by storing or snapshotting:

- the accepted current commercial fingerprint;
- the accepted current warning fingerprint;
- the matching review acknowledgement identity when warnings existed;
- the issue timestamp/user already represented by the proposal record.

The database proposal guard must compare the issue-time fingerprints against a fresh current evaluator result at the proposal-presentation insertion boundary. If the Estimate changed after Review, insertion is rejected. P1.5 may extend proposal-revision lineage, but it must not be required for P1.4 release enforcement.

## Concurrency and transaction boundary

Rendered readiness is informative only. Execution-time readiness is authoritative.

Both acknowledgement and proposal issuance must re-evaluate current state server-side at execution time.

The Estimate row should be used as the serialization boundary where practical, consistent with current pricing/labor RPC locking patterns.

P1.4 must not claim an atomic guarantee based only on a previously rendered page.

Proposal issuance must avoid a time-of-check/time-of-use gap between release evaluation and immutable proposal creation. The database insertion boundary for the immutable proposal presentation is authoritative: it must re-evaluate readiness and verify that the issue-time release fingerprints match current state before accepting the presentation. Application-side checks remain useful UX but are not sufficient authority.

P1.4 does not require moving the entire customer-facing proposal snapshot builder into PostgreSQL. It does require the immutable presentation to carry the accepted release fingerprints so stale Review authority cannot be attached to a newly changed Estimate.

## UI terminology

Visible product terminology changes:

- **Audit** → **Review**
- **Estimate Risk / Scope Audit** → **Estimate Review / Recap**
- **Ready for Audit / Proposal** → **Ready for Review**
- workflow navigation: **Takeoff → Estimate → Review → Proposal**

Existing route names may remain temporarily for compatibility.

## TDD acceptance

Implementation must begin with RED coverage for the new P1.4 contract.

### Evaluator states

Prove:

- draft Estimate → `not_ready`;
- ready + blocker → `blocked`;
- ready + warnings → `review`;
- ready + no findings → `release_ready`;
- ready + warnings + exact current acknowledgement → `release_ready`.

### Blocker enforcement

Cover at minimum:

- missing generated price;
- missing labor rate;
- missing production assumption;
- missing required input;
- invalid manual commercial cost;
- broken generated-item lineage;
- missing terms;
- missing customer destination;
- immutable/issued revision eligibility.

### Acknowledgement

Prove:

- blockers cannot be acknowledged;
- client-supplied fingerprints are never trusted;
- one acknowledgement covers the complete current warning set;
- warning snapshot is immutable evidence;
- identical state produces identical fingerprints;
- row ordering does not change fingerprints;
- changed Customer Sell invalidates acknowledgement;
- changed price source invalidates acknowledgement;
- changed Production Quantity invalidates acknowledgement;
- changed Job MH/unit invalidates acknowledgement;
- changed labor rate invalidates acknowledgement;
- new warning invalidates acknowledgement;
- removed warning invalidates acknowledgement;
- quote expiry/current quote state affects current warning readiness as designed.

### Security

Prove:

- cross-company Estimate denied;
- employee acknowledgement denied;
- RLS isolates acknowledgement history;
- direct client insert/update/delete denied;
- authenticated office user can execute the controlled acknowledgement RPC.

### Proposal guard

Prove:

- blocked Estimate cannot issue;
- unacknowledged-warning Estimate cannot issue;
- stale acknowledgement cannot issue;
- release-ready Estimate can issue;
- proposal creation preserves the existing immutable revision snapshot.

### Isolation regression

Two Estimates in the same company must never contaminate each other's:

- generated outputs;
- blockers;
- warnings;
- fingerprints;
- acknowledgements.

## Browser acceptance

Focused browser QA must exercise one real Estimate end-to-end:

1. Move the Estimate to **Ready for Review**.
2. Confirm Pricing/Labor/Scope totals reconcile.
3. Introduce a missing price and confirm **BLOCKED**.
4. Fix the price and confirm the blocker disappears automatically.
5. Leave an intentional Job MH/unit override and confirm **REVIEW REQUIRED**.
6. Use **Reviewed / proceed** and confirm **RELEASE READY**.
7. Change Job MH/unit and confirm the acknowledgement becomes stale.
8. Review again.
9. Change Customer Sell and confirm the acknowledgement becomes stale again.
10. Re-acknowledge the current warning set.
11. Enter Proposal.
12. Confirm Proposal can issue only in `release_ready`.
13. Confirm issued proposal remains immutable.
14. Confirm another Estimate's records never appear in the selected Estimate's Review.

## Validation gates

Before PR acceptance:

```text
RED regression tests
        ↓
migration / implementation
        ↓
targeted tests
        ↓
pnpm typecheck
        ↓
Supabase QA migration
        ↓
RLS / RPC verification
        ↓
Supabase security advisor
        ↓
pnpm check
        ↓
exact-head Vercel preview
        ↓
focused browser QA
        ↓
Nik acceptance
        ↓
merge to staging
```

No `main` changes are authorized by P1.4.

## Likely implementation ownership

The implementation plan should stay narrowly scoped to the owning paths and their direct dependencies. Expected targets include:

- a new source-controlled P1.4 Supabase migration;
- `app/estimates/audit/page.tsx`;
- `app/estimates/[estimateId]/page.tsx` for terminology/anchors only where required;
- `app/estimates/actions.ts` for Review acknowledgement server action and `ready` product language where applicable;
- `app/proposals/[estimateId]/page.tsx`;
- `app/proposals/actions.ts`;
- small shared estimating release-readiness presentation/helper code only if it avoids duplication without creating a second authority engine;
- focused P1.4 tests;
- `docs/modules/estimating.md`.

Do not broaden implementation into unrelated routes or refactors.

## Explicit scope boundaries

### Included

- server-authoritative release-readiness evaluator;
- blocker/warning findings;
- commercial and warning fingerprints;
- immutable warning acknowledgement history;
- acknowledgement RPC;
- RLS/security;
- Review / Recap experience;
- EDGE-style cost/pricing/labor/decision recap;
- Estimate traceability;
- visible **Audit → Review** terminology;
- visible `ready` meaning **Ready for Review**;
- Proposal release enforcement;
- database-level bypass protection;
- estimating module documentation;
- regression coverage.

### Excluded

- new Takeoff quantity engine;
- formula-authoring UI;
- new Condition calculation system;
- 3D quantity authority;
- new supplier-quote engine;
- new labor production model;
- automatic labor-rate recommendations;
- production-learning promotion — Issue #26;
- arbitrary automated “this production rate is wrong” heuristics;
- fabricated per-line Sell allocation;
- Proposal Revision lifecycle changes — P1.5;
- Accepted Scope Snapshot implementation — Issue #28;
- full Job Spine redesign;
- global ADR-025 UI rollout — Issue #76;
- production migration/release — Issue #59 / `main`.

## Final acceptance statement

P1.4 is complete when an estimator can:

> Build the job from concrete Conditions, let Takeoff drive quantities and resources, adjust pricing and production assumptions, review a concise cost/labor/commercial recap, see every exception and deliberate override, trace commercial lines back to their physical source, explicitly accept the complete current business-risk warning set, and only then release that exact commercial state into Proposal.

This preserves the desired EDGE-style estimating discipline while keeping Carez's concrete-specific Condition-first model, deterministic calculations, tenant isolation, server-authoritative commercial release rules, and immutable lineage.
