# Carez Command Center mutation gate

This contract defines Phase 10 of the Carez engineering Command Center.

Phase 10 is an **authorization and safety architecture**. It does not itself enable GitHub, Supabase, Vercel, production, or destructive write capabilities.

## Core rule

A remote write is permitted only when the current task explicitly names:

1. **provider**;
2. **target environment**;
3. **requested action**;
4. **target object/resource** when applicable.

Tool availability, authentication, prior approval, a passing release gate, remembered context, browser state, or a previous successful write never substitutes for current explicit authorization.

## Default state

Provider writes are disabled by default.

The local Codex runtime may contain read/analysis tooling. Phase 10 does not install a raw GitHub, Supabase, or Vercel write-capable MCP merely because this document exists.

Current normal publication remains:

```text
Nik acceptance
-> local commit
-> release gate GO
-> Nik publication authorization
-> GitHub Desktop push
-> GitHub Actions
-> existing Git-integrated Vercel staging deployment
```

That path is not replaced by provider automation.

## Mutation request envelope

Before any future provider write adapter executes, the request must be reducible to:

```text
provider:
environment:
operation:
target:
desired_effect:
source_authority:
preview_or_dry_run:
recovery_plan:
unknown_effect_check:
authorization_scope:
```

### provider

One of the explicitly supported write providers.

Initial architecture:

- GitHub
- Supabase
- Vercel

### environment

One of:

- staging
- production

Local-only repository edits are not provider mutations and remain governed by `CODEX.md`.

### operation

Use a narrow operation name rather than a generic provider client.

Examples:

- publish_staging_branch
- apply_qa_migration
- retry_staging_deployment
- promote_production_deployment

Generic operations such as `run_command`, `execute_sql`, `provider_request`, or unrestricted shell/API access are not Phase 10 write adapters.

### target

Identify the specific branch, project, migration, deployment, alias, pull request, issue, or other provider resource affected.

### desired_effect

Describe the intended state transition, not just the API call.

### source_authority

Identify the source-controlled or explicitly verified evidence authorizing the intended change.

Examples:

- exact local commit;
- exact source-controlled migration;
- accepted release batch;
- known deployment/commit relation.

### preview_or_dry_run

Use a provider-supported preview/dry-run when available.

When no provider preview exists, the adapter must still perform the smallest safe preflight that verifies target identity and current state.

### recovery_plan

Required for destructive or difficult-to-reverse operations.

### unknown_effect_check

After timeout, disconnect, ambiguous response, or interrupted execution, re-read provider state before any retry.

Never blindly repeat a write whose effect is unknown.

### authorization_scope

Authorization applies only to the named provider, environment, operation, and target.

It does not carry over to another provider, target, environment, or later task.

## Decision classes

### allow_read

A read may proceed under `EXTERNAL_STATE_BOUNDARY.md`.

No write authority is implied.

### require_authorization

The requested operation could be valid, but the current task does not provide sufficient explicit write authorization.

Do not execute the write.

### allow_authorized_write

The current task explicitly provides the required provider, environment, operation, and target authorization, and all operation-specific preconditions pass.

### block

The requested behavior violates a hard boundary.

Examples:

- production mutation without explicit production target authorization;
- destructive history/database repair without a recovery plan;
- direct Supabase schema mutation that bypasses source-controlled migrations;
- duplicate Vercel staging deploy path;
- broad "fix everything" provider access;
- retrying an unknown-effect write without checking state;
- write request with ambiguous environment or target.

## GitHub mutation gate

### Normal staging publication

Normal publication remains human-controlled through GitHub Desktop.

A release gate GO establishes readiness only.

Do not turn release readiness into automatic push/merge authorization.

### Future GitHub write adapter requirements

Any future GitHub write adapter must:

- target an explicitly named repository;
- target an explicitly named branch/PR/issue/action;
- separate reads from writes;
- avoid hidden merge/push behavior;
- report the resulting object/commit/state;
- stop on branch/environment ambiguity.

### Destructive Git operations

Force push, branch deletion, history rewrite, reset of shared history, and destructive recovery remain blocked unless the current task explicitly names the destructive action and supplies a recovery plan.

Production/main destructive Git actions require explicit production authorization.

## Supabase mutation gate

### Schema/database authority

Source-controlled migrations are the only Carez schema-change authority.

A future Supabase migration adapter may apply an existing source-controlled migration only when:

- the exact environment is named;
- the exact migration is identified;
- the local migration exists;
- migration ordering/preflight is valid;
- the current task explicitly authorizes the apply action.

### Direct SQL

Generic direct SQL is not a schema migration path.

Bounded data diagnostics or data repair may be separately designed later, but any mutation must define:

- tenant scope;
- affected rows/object;
- expected before/after state;
- transaction/rollback behavior;
- explicit current authorization.

### Migration repair

Migration-history repair is destructive/special recovery work.

It requires:

- named environment;
- exact repair operation;
- exact migration/history target;
- explicit authorization;
- documented recovery plan.

## Vercel mutation gate

### Normal staging deployment

The existing Git integration remains the normal staging deploy mechanism.

Do not add a second staging deployment trigger.

### Retry/redeploy

A manual staging retry/redeploy may be considered only when:

- the exact failed/missing deployment is identified;
- the related Git commit is verified;
- the current task explicitly authorizes that Vercel staging write.

### Production

Promotion, alias change, production redeploy, or rollback requires explicit production-target authorization.

Production rollback additionally requires the exact source/target deployment relationship and recovery intent.

## Cross-provider mutation requests

Do not treat one authorization as permission for a sequence of provider writes.

For a task such as:

```text
apply migration
-> push branch
-> deploy
```

each provider action must have its own explicit authorization boundary.

A workflow may be planned as one sequence, but execution must stop at any ungranted step.

## Unknown-effect protocol

When a write may have partially succeeded:

1. stop;
2. classify the effect as unknown;
3. perform the minimum provider read required to establish current state;
4. compare actual state with desired effect;
5. only retry if the effect is confirmed absent and the original authorization still applies;
6. otherwise report the resulting state and stop.

## Credential boundary

Future write adapters must use least-privilege credentials.

Production credentials must be distinguishable from staging/QA credentials and must not be selected by inference.

Secrets must not be written into repository files, prompts, eval fixtures, logs, or memory.

## Audit evidence

A successful future write should leave enough evidence to answer:

- what was requested;
- who/what authorized it;
- provider/environment;
- operation/target;
- preflight state;
- resulting state;
- whether recovery/rollback was required.

Audit evidence must not contain secrets.

## Capability activation

Phase 10 has two separate states:

### Architecture ready

The mutation contract, safety evals, and health checks exist.

This may be completed without enabling any provider write adapter.

### Capability enabled

A specific named provider operation has been intentionally implemented, least-privilege credentials configured, and provider-specific acceptance passed.

Capability enablement requires a later explicit task.

No write capability is considered enabled simply because an MCP/plugin/CLI exists on the machine.

## Acceptance gate

Phase 10 architecture is complete when:

- this contract is source-controlled;
- mutation-gate evals pass;
- Phase 7 external-state evals still pass;
- Phase 8 knowledge/observation evals still pass;
- Phase 9 orchestration evals still pass;
- Command Center strict health passes;
- canonical `pnpm check` passes;
- local Codex has no unintended GitHub/Supabase/Vercel write-capable MCP enabled;
- no remote provider write was performed during architecture acceptance.

Provider mutation capabilities remain disabled after this architecture gate until a later explicitly authorized enablement task.
