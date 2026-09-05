# ADR-021 — Condition estimating semantics

Status: Accepted

Date: 2026-09-05

## Context

The Concrete Condition engine is becoming the estimating authority for standard concrete scope. Strip / Wall Footing Issue #55 exposed several ambiguities that are unacceptable once a Condition drives labor, procurement, direct cost, and later 3D verification: compatibility outputs could appear authoritative before a current Condition calculation, reinforcing used generic face/layer multipliers, installed and procurement quantities were conflated, labor inputs were expressed only as MH/unit factors, and calculation holds were visually mixed with pricing warnings.

ADR-012 remains controlling for the Condition domain. Existing published Condition versions, compatibility records, formulas, estimate lineage, and accepted commercial history remain immutable and readable.

## Decision

### 1. Current Condition outputs are the active estimating authority

For a Condition-linked takeoff, the active worksheet must distinguish current Condition calculation state from legacy compatibility projection state.

- Before the first current calculation, calculated columns show **Not calculated** rather than compatibility quantities.
- If saved outputs exist but the working Condition has unsaved changes, the worksheet shows **Pending recalculation** and does not present stale outputs as current truth.
- Compatibility projections remain available for lineage/reconciliation but are explicitly identified as compatibility/history when they are not current Condition authority.

### 2. Reinforcing is construction-native and explicit

Strip / Wall Footing reinforcing is represented by repeatable construction-native sets such as:

- bottom longitudinal;
- top longitudinal;
- transverse;
- dowels/starters;
- stirrups/ties;
- custom explicit length.

Longitudinal bar count is the total bar count for that set. Carez does not apply implicit faces or layers multipliers to a longitudinal count. Structural reinforcing requirements remain estimator/engineer-confirmed inputs; Carez calculates from those explicit inputs and does not design reinforcement.

### 3. Installed and procurement quantities are separate

Production quantity and procurement quantity are different concepts and must remain separately traceable.

- Reinforcing labor is driven by **installed steel**, including physically required splice length.
- Procurement allowance changes **procurement steel** without changing installed production quantity or installation labor.
- Stock-bar counts are a procurement/logistics guide and are not a second priced estimate demand.
- Concrete continues to preserve installed CY separately from procurement/order CY.

This extends the existing Carez separation of Production Quantity, Direct Cost, and Sell.

### 4. Labor supports factor and crew-rate productivity

A Condition labor activity may use either:

- a direct labor factor such as MH/SF, MH/CY, MH/LB, or MH/EA; or
- a crew-rate method with crew size and production per crew-hour.

For crew-rate methods, the server derives crew-hours, total man-hours, and effective MH/unit. Input provenance remains attached so company standards, historical actuals, estimator overrides, and reference benchmarks can remain distinguishable.

Finish and cure/protection are explicit labor-producing activities when included.

### 5. Calculation state and commercial state are distinct

A calculated quantity does not imply a complete estimate.

Estimator-facing status distinguishes at least:

- Ready;
- Qty ready · Price missing;
- Calculation hold;
- Not included;
- Not calculated / Pending recalculation.

Direct-cost summaries are marked partial while active resources still lack required pricing.

### 6. Issues use one categorized exception model

Condition exceptions are presented through one issue model with categories including:

- calculation;
- scope;
- production;
- commercial;
- pricing.

The UI may summarize these categories together while preserving the underlying authoritative Condition holds and pricing states.

### 7. Estimate-section classification is part of review

A Condition-linked primary takeoff can be assigned to an estimate section from the Condition review workflow. Carez may suggest an existing section from project context, but the estimator remains authoritative and may override or leave the suggestion unaccepted.

### 8. 3D remains derived verification

The full Strip / Wall Footing estimating model must be accepted before additional Strip 3D work resumes. Derived 3D consumes the accepted Condition and stable 2D geometry; it does not become measurement or commercial authority.

## Consequences

- Strip / Wall Footing receives a new immutable published Condition contract version rather than mutating v1/v2.
- New Strip Conditions may use the new contract while historical v1/v2 Conditions remain readable and calculable through their original contract.
- Compatibility projection mappings remain additive and non-destructive.
- Labor, procurement, worksheet, and issue semantics become suitable for later reuse across Pad / Column Footing, Slab on Grade, walls, and other concrete-native Conditions.
- Browser acceptance remains required before Issue #55 can be treated as verified or before additional Strip 3D work resumes.
