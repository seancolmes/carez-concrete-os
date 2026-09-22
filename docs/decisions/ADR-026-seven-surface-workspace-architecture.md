# ADR-026 — Seven-Surface Workspace Architecture

Status: Accepted design authority
Date: 2026-09-22

## Context

Carez route growth has exposed implementation destinations as peer workspace choices, fragmenting concrete operating workflows and obscuring ownership of work.

## Decision

Carez has exactly seven primary operating surfaces: Today, Preconstruction, Projects, Field, Production, Finance, and System. The route registry remains authority for legitimate URLs; a separate workspace presentation model curates global navigation and classifies capabilities as primary surfaces, internal views, contextual tools, record detail, compatibility entries, or hidden/unsupported. Internal views preserve deep-linkable URL state, and record-detail URLs remain direct, bookmarkable, and shareable.

## Consequences

Global navigation no longer mirrors the complete route list. Specialized routes consolidate progressively without mass deletion or breaking redirects. Batch 2.5 navigation must simplify to this model; Batch 3–5 require rewritten workspace-centered plans before implementation. This is a presentation and information-architecture decision only and does not alter calculation, commercial lineage, quantity, schema, RLS, or tenant authority.

## Non-goals

This ADR does not authorize route deletion, redirects, new calculations, workflow automation, application code changes, schema/RLS changes, dependency installation, deployment, or a Batch 3–5 implementation.

## Relationship to ADR-024 / ADR-025

ADR-025 remains the active Carez presentation authority and carries forward the Indigo Harbor visual direction from ADR-024. ADR-026 governs product-level workspace information architecture; it neither replaces those visual authorities nor weakens ADR-020 Takeoff domain invariants.
