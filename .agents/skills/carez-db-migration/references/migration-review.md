# Migration review

Check only items relevant to the change.

- Migration is source-controlled and ordered correctly.
- Existing rows survive the change or have an explicit transformation path.
- `company_id` remains the tenant root where applicable.
- Browser-accessible tenant objects have appropriate RLS/GRANT behavior.
- Functions/procedures repeat authorization where the architecture requires it.
- Accepted/versioned commercial records are not silently rewritten.
- Local migration replay is plausible from a clean state.
- QA and production are treated as separate authorities.
- Remote apply steps are not performed without explicit authorization.
- Rollback/recovery and forward-fix strategy are stated for risky changes.
