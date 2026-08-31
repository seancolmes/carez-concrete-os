# Module Spec — Field / Production / Pour Control

Status: P4 target

## Purpose
Capture crew execution, production, readiness, issues, and pour actuals with minimal field friction.

## Role model
- Employee: clock/time, assignment, simple task/operation interaction.
- Foreman: crew, operation, production quantity, issue, note/photo.
- Superintendent: readiness, constraints, inspections, pours, coordination.

## Pour Control
Track linked scope/work package, readiness, mix, supplier, pump/placement method, scheduled quantity, deliveries, placed quantity, returned quantity, inspection/test context, notes, and production variance.

## Invariants
- Field input is operation/work-package aware.
- Production quantity is distinct from time and cost.
- Actuals feed cost/forecast without rewriting estimate assumptions.
- Mobile is field-first: high-value actions, low navigation, strong offline/error recovery where required.
