# Carez Concrete OS — Modernization Roadmap

Current priority: Issue #76 / ADR-025 is accepted on `staging` at `457be2068a2b42f7883286a4f467f819e7fc049a`. The next sequenced product gate is P0.5E Issue #39 — legacy recipe migration and active formula-UI retirement — followed by P0.5 end-to-end reconciliation before P1 Estimating.


This roadmap governs sequence. It does not authorize unrelated rewrites.

## P0.1 — Shell + Takeoff acceptance

Outcome:
- ADR-025 Carez Operations Workspace is the accepted global presentation/shell authority: company identity/masthead, workspace directory, favorite destinations, first-class command/search, notifications affordance, account/system controls, and project context without a permanent global desktop left rail;
- versioned device-local navigation personalization supports pin/unpin/reorder/reset without changing authorization;
- project context appears only when an authoritative Project is resolved, and project switching preserves only explicitly safe workspace mappings;
- mobile uses role-priority bottom navigation plus `More`, while module-specific contextual panes remain inside their owning workspaces;
- the permanent global desktop left rail and ADR-016 static category shell remain retired;
- first shared Carez component pack is introduced and reused across converted surfaces;
- authenticated shell and Takeoff visual QA complete;
- no geometry, lineage, RLS, or migration regressions.

## P0.2 — Precision Grid shared UI foundation

Outcome:
- Issue #63 Precision Grid token/theme/density foundation is accepted;
- Issue #71 role-adaptive Hybrid global shell + authoritative project-context navigation is accepted;
- Issue #72 shared component/state/accessibility foundation is accepted, including semantic status/save/authority/provenance/feedback, Inspector, Record Header, shared Project Context Bar, semantic Number Field variants, and Data Grid state/accessibility foundations;
- Subproject 4 refined-operations reference slice `Today → Project → Project Overview` is accepted on staging and proves the first rendered Overview/Record expression across the shared system;
- Issue #76 / ADR-025 Carez Operations Workspace is accepted on staging at `457be2068a2b42f7883286a4f467f819e7fc049a`, including the Today, Projects, and Documents reference experiences;
- broad UI migration is no longer the current sequencing gate; further presentation work follows product/module priorities while preserving ADR-025 and the accepted Takeoff boundary.

## P0.5 — Concrete Condition + 3D Takeoff foundation

Outcome:
- active Takeoff model shifts from recipe/formula-first authoring to named concrete Conditions with embedded concrete-specific modules;
- additive Platform Condition Archetype, Company Condition Template, Project Concrete Condition, module, and measurement-role contracts preserve immutable lineage;
- ADR-020 remains authoritative for Takeoff quantity/domain invariants while ADR-025 governs shared presentation/chrome; preserve the accepted Plans/Conditions/Zones navigator, dominant drawing surface, Condition Properties surface, explicit 2D/3D/Split controls, and vertically resizable Quantity/Estimate Worksheet unless Nik explicitly approves a replacement;
- an optional future explicit floating-properties mode may be draggable/resizable, but the normal docked side panes do not use horizontal drag-resizing;
- the shared Carez Data Grid, Number Field, Condition Tree, Toolbar, Resizable Workspace, Loading States, File Upload and motion patterns are used where applicable instead of route-local equivalents;
- Pad/Column Footing (EA), Strip/Wall Footing (LF), and Slab on Grade (SF with cutouts) work end-to-end through concrete, forms, reinforcing, anchors/slab systems, labor, outputs, holds, and estimate lineage;
- built-in authoritative geometry facts are derived before asking the estimator to redraw duplicate geometry; estimator authority remains explicit where geometry does not determine means/methods;
- installed/theoretical demand, procurement quantity, reusable inventory demand, Production Quantity, Direct Cost, and Sell remain separately traceable;
- 2D, 3D, and Split modes share selection and totals; read-only derived 3D exposes representative elevation, overlap/gap, step, and cutout errors;
- supported legacy recipes/variants remain preserved through the compatibility/history layer while new standard authoring uses Conditions after verified parity;
- old Recipe Editor/Formula Composer/Assembly Library UI is removed from the active workflow only after dependency and browser-verification gates;
- no referenced published or accepted history is deleted.

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
