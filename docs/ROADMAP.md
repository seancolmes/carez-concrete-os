# Carez Concrete OS — Modernization Roadmap

This roadmap governs sequence. It does not authorize unrelated rewrites.

## Current program state

The Carez UI and domain programs now have two open workstreams:

- **Issue #76 / ADR-025 Experience System rollout:** the design authority and three-route reference slice are accepted, but the original complete application-wide rewrite is not finished.
- **Issue #39 / P0.5E legacy migration:** Tasks 1–2 are implemented; Task 3 is the next unfinished domain checkpoint.

Do not treat either as complete. Nik selects which workstream receives the next cloud implementation budget.

## P0.1 — Accepted shell / Takeoff foundation

Outcome already established:

- one source-owned component system;
- role-aware global navigation/project context without a permanent desktop left rail;
- first-class light/dark/system;
- accepted Takeoff Plans/Conditions/Zones navigator, dominant drawing surface, Condition Properties, Quantity Worksheet, and 2D/3D access;
- authoritative persisted 2D geometry and server/domain calculation;
- no geometry, lineage, RLS, or migration authority moved into presentation code.

ADR-025 now supersedes prior ADR-024 presentation where it speaks. ADR-020 continues to protect Takeoff quantity/domain invariants.

## P0.2 — Carez Experience System rollout — OPEN

Accepted:

- ADR-025 design authority;
- approximately 80% Command Deck / 20% Spatial Blueprint direction;
- Manrope-led hierarchy, meaningful icon language, stronger shared tabs, three depth levels, restrained functional motion rules;
- shared workspace/masthead/favorites language;
- Today — Daily Command Center;
- Projects — Operations Board;
- Documents — Evidence Hub.

Still required to satisfy the original Issue #76 complete-rewrite objective:

- propagate ADR-025 coherently through remaining high-value routes instead of leaving a three-page reference island;
- refine Project Overview, Estimate, Proposal/commercial, Billing/finance, Owner Reports, Settings, and other remaining standard routes;
- implement purposeful motion where state/continuity/activity materially benefits the workflow;
- apply Spatial Blueprint / 3D treatment selectively to appropriate experiences rather than decoratively;
- pursue the explicitly deferred Client Package Studio, Markup Sheet, Quick Estimate, and login/landing experience projects when authorized;
- preserve Takeoff's domain/quantity authority during any future visual refinement.

A new immersive 3D layer is **not** required on every route. Spatial/3D treatment belongs where it materially supports Takeoff, markup/customer review, selected hero/landing, or field-estimating experiences.

## P0.5 — Concrete Condition + derived 3D foundation — OPEN

Established:

- named Concrete Conditions are the normal direction instead of recipe/formula-first authoring;
- Platform Condition Archetype → Company Condition Template → Project Concrete Condition lineage is versioned;
- Pad/Column Footing, Strip/Wall Footing, and Slab on Grade pilot families are implemented;
- derived 3D uses the same authoritative 2D data/IDs and remains verification only;
- Issue #41 synchronized derived 3D is closed/completed.

Remaining gate:

- **Issue #39 — P0.5E legacy recipe migration and active formula-UI retirement**;
- preserve referenced published/accepted history;
- migrate/reconcile only supported editable records through server-authoritative Condition calculation;
- retire active formula-first UI only after exact dependency/parity proof;
- complete P0.5 end-to-end reconciliation and stable-staging browser acceptance.

Issue #59 remains a production migration blocker and is not bypassed by P0.5E.

## P1 — Estimating

Outcome:
- unified Conditions → Takeoff → Pricing → Labor → Review/Recap → Proposal workflow;
- pricing provenance, supplier quote sets, and missing-price review;
- builder means/method verification through Condition modules and explicit job overrides;
- production-rate and labor build-up;
- immutable Condition/template/archetype/output lineage, with legacy compatibility retained while referenced;
- explicit Proposal Revision → Award Decision/Customer Acceptance → Accepted Scope Snapshot → Frozen Commercial Baseline/Budget handoff.

## P2 — CRM / Preconstruction

Outcome:
- opportunity-centered bid pipeline on the persistent Job Spine;
- ITB/plans/bid-date workflow;
- estimator workload and bid calendar;
- won/lost/rebid history remains distinct and traceable;
- an authorized award action creates the immutable Accepted Scope Snapshot and distinct Project on the same Job Spine without re-entry; an Opportunity never mutates into a Project.

## P3 — Projects / Work Packages / Scheduling

Outcome:
- Project → Work Package → Operation → Production Work Unit execution model;
- versioned Scope Allocations partition authorized Accepted Scope Snapshot or approved-change quantities without overlap/double counting;
- scope/budget/drawing/readiness lineage remains exact through execution;
- committed/baseline milestones, rolling lookahead, and daily executable READY work remain distinct scheduling layers;
- Constraint remains a prospective readiness condition while Blocker Event records realized execution impact;
- READY / AT RISK / BLOCKED states drive executable planning without silently rewriting commitments or frozen commercial baselines.

## P4 — Field / Production / Pour Control

Outcome:
- role-specific mobile field workflows with low-friction actual work context;
- Timecard, Actual Work Context, Constraint, Blocker Event, Completion Evidence, and Production Evidence remain distinct linked records;
- foremen operate as exception/resequence leaders rather than routine daily production-quantity data-entry workers;
- trustworthy production learning derives from authorized measurable scope, attributable work context, completion evidence, method context, and confidence;
- pour readiness, deliveries, placed/returned concrete, inspections, and variance preserve source evidence and work-package/scope lineage.

## P5 — Procurement / Finance / Changes / Billing

Outcome:
- project-need-driven procurement retains exact authorized-scope lineage;
- Budget / Committed / Actual / Forecast remain distinct;
- vendor bill/PO matching;
- original frozen commercial baseline derives only from the immutable Accepted Scope Snapshot;
- approved changes append authorized deltas and billing/forecast effects without mutating original accepted history.

## P6 — Documents / Search / Knowledge

Outcome:
- shared document/entity linking across the Job Spine and phase-specific records;
- logical drawing identity remains separate from exact revision;
- accepted scope retains exact source-document/drawing evidence where applicable;
- project-wide retrieval with evidence-backed citations and immutable source documents.

## P7 — AI Plan Intelligence / Assisted Takeoff

Outcome:
- sheet naming/indexing, scale candidates, title-block extraction;
- revision assistance;
- evidence-backed suggestions and assisted Takeoff with human approval;
- AI does not silently become scope, means/method, quantity, production-rate, pricing, margin, or approval authority.

## P8 — Executive Intelligence + Hardening

Outcome:
- cross-module operating intelligence;
- accessibility, performance, security, error handling, release hardening;
- production promotion based on verified acceptance evidence.

## Milestone rule

A phase is not complete because screens exist. It is complete when representative contractor workflows are traceable, validated, and browser-verified where UI behavior is involved.
