# External-state boundary

This workflow defines when Carez work may inspect or change GitHub, Supabase, and Vercel state. Use it only when current remote truth or a remote action is materially required by the explicit task or release/debugging workflow.

## Authority and capabilities

- Local files, the Git working tree, and local commits are authoritative for in-progress implementation. `origin/staging` is the shared integration baseline.
- Remote state is not queried just because a provider, connector, plugin, or future MCP is available. Use remote tooling only when the explicit task requires current remote truth or an authorized remote action, and use the narrowest relevant capability.
- READ and WRITE are separate capabilities. A read, inspection, check, or passing release gate does not authorize a write.
- No write may be hidden inside a read/inspect/check command. Commands and tools that can mutate state must be treated as writes and named as such.
- GitHub staging publication remains human-controlled through GitHub Desktop after a passing release gate, unless the user explicitly authorizes another publish method.
- A passing release gate establishes readiness, not release authorization.
- Normal staging Vercel deployment follows the established Git integration after staging publication. Do not create a duplicate deployment trigger.
- Supabase remote mutation requires an authoritative source-controlled migration/change and explicit environment and action authorization. Staging authorization never implies production authorization.
- Production GitHub/main, production Supabase, and production Vercel changes require explicit production-target authorization in the current task.
- Migration repair, rollback, force push, branch deletion, reset-like remote action, or other destructive recovery/history operation requires explicit named authorization and a recovery plan.
- Credentials and secrets never belong in repository docs, scripts, or log output.
- Ordinary AppShell navigation does not authorize Plaid or Outlook sync. Plaid and Outlook mutation entry points require an explicit production runtime (`NODE_ENV=production` and `VERCEL_ENV=production`); local and preview/staging runtimes fail closed before provider or database work. There is no local/staging override. Any future deliberate provider QA override requires separately authorized, server-only opt-in configuration that defaults off.

## Provider action matrix

| Provider | READ examples | WRITE examples | PRODUCTION-ONLY or HIGH-RISK examples |
|---|---|---|---|
| GitHub | Inspect branch/PR/commit/check state when needed; read workflow results | Publish staging commits using the authorized publish method; create/update a remote PR when explicitly authorized | Publish/change `main`; force push; delete branches; rewrite or repair remote history |
| Supabase | Inspect project/environment identity, migration status, schema, or minimum necessary tenant-scoped records when required | Apply an authorized source-controlled migration or explicitly scoped data/config change to the named environment | Any production mutation; migration repair, rollback, destructive data/schema change, history reconciliation, or tenant-isolation bypass |
| Vercel | Inspect project/environment, deployment status, build logs, or alias when required | Trigger/retry/promote a deployment only when explicitly authorized and part of the established path | Production deployment/alias changes; manual deployment triggers that duplicate staging Git integration; rollback |

Production-target actions require explicit production authorization even when otherwise routine. High-risk actions require the named authorization and recovery plan above.

## Release sequences

### App-only staging batch

1. Complete and validate local work; inspect the final diff and identify the intended local commits.
2. Run the release gate. A GO means the batch is ready for human publication.
3. Publish through GitHub Desktop after the gate, unless the user explicitly authorized another method.
4. Let established Git integration drive the staging Vercel deployment; inspect deployment state only when required for the task or acceptance.
5. Perform applicable browser/runtime QA. Stop before production promotion.

### Migration-bearing staging batch

1. Complete local implementation and source-controlled migration review; identify compatibility requirements between the app and schema versions.
2. Determine the safe app/migration ordering from those compatibility requirements for this batch; this workflow does not prescribe DB-first or app-first universally.
3. Run the release gate and make the intended staging database/app/deployment sequence explicit. A `GO` establishes readiness only.
4. Before any Supabase mutation, confirm the target is isolated staging/QA and obtain explicit environment + action authorization. Before app publication, obtain the normal human publish action through GitHub Desktop unless another method is explicitly authorized.
5. Execute only the authorized steps in the compatibility-safe order identified for this batch. Let established Git integration drive any normal staging Vercel deployment rather than adding a duplicate trigger.
6. Verify applicable database, deployment, and browser behavior. A successful staging sequence does not authorize production mutation.

### Production promotion

1. Confirm accepted staging evidence, release readiness, and any production-specific migration compatibility/recovery plan.
2. Obtain explicit production-target authorization in the current task for each required GitHub, Supabase, or Vercel action. Staging authorization and a passing gate are insufficient.
3. Execute only the named authorized actions using the established production path; keep reads and writes distinct and auditable.
4. Verify the resulting production state as required and report evidence. Do not perform destructive recovery/history actions without their explicit named authorization and recovery plan.

## Future MCP and tool design

Design tools around small, coherent user goals with least privilege, not wholesale provider API exposure. Keep read and write tools separate, require explicit target/environment parameters, provide dry-run or preview where possible, and make side effects auditable. Never bundle a write into a tool presented as a read, inspect, or check.
