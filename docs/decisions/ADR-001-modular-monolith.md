# ADR-001 — Modular Monolith

Status: Accepted

## Decision
Carez remains a modular monolith unless a demonstrated scaling, isolation, reliability, or deployment requirement justifies extraction.

## Rationale
The current product benefits more from strong domain boundaries, one transactional source of truth, and simpler deployment/operations than from distributed-system complexity.

## Consequences
- Prefer internal modules and deterministic domain services.
- Preserve transactional boundaries across linked estimating/project operations where appropriate.
- Do not introduce microservices, Kafka, Kubernetes, or event sourcing by default.
