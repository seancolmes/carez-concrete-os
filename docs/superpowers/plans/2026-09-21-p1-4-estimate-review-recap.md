# P1.4 Estimate Review / Recap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a server-authoritative, exception-first Estimate Review / Recap that derives release readiness from the exact current Estimate state, requires explicit acknowledgement of the complete current warning set, and prevents Proposal issuance unless that exact commercial state is release-ready.

**Architecture:** PostgreSQL owns the deterministic readiness evaluator, fingerprints, acknowledgement evidence, and final Proposal insertion guard. Next.js renders the evaluator result and routes the estimator back to Pricing, Labor, Scope, Takeoff, or Proposal setup; it does not implement a second readiness engine. The existing `ready` Estimate status remains persisted for compatibility but means **Ready for Review** only.

**Tech Stack:** Next.js 15.5, React 19, TypeScript 5.9, Supabase/PostgreSQL, PostgreSQL `pgcrypto`, node:test, pnpm 11.

**Spec:** `docs/superpowers/specs/2026-09-21-p1-4-estimate-review-recap-design.md`

## Global Constraints

- Start from current `staging`; never touch `main`.
- Preserve Production Quantity, Direct Cost, and Sell as separate concepts.
- Persisted stable page-coordinate 2D/vector geometry remains Takeoff quantity authority.
- No second quantity, formula, pricing, labor, or 3D engine.
- Missing input/price/labor rate is a visible hold, never a fabricated zero.
- Human estimator authority remains final for scope, production assumptions, pricing, margin, and release decisions.
- Current findings are derived; only human acknowledgement evidence is persisted.
- `estimates.status = 'ready'` means **Ready for Review**, not release-ready.
- Blockers cannot be overridden.
- Warnings require one acknowledgement for the complete current warning set.
- Any relevant commercial-state or warning-set change invalidates acknowledgement by fingerprint mismatch.
- Proposal issuance must re-check release readiness at the database insertion boundary.
- Issued proposal history remains immutable.
- Tenant isolation uses `company_id` and RLS.
- DB changes are source-controlled migrations.
- UI uses existing ADR-025 / Carez component patterns; no second component system.
- Normal validation is targeted tests + `pnpm typecheck`; final validation is `pnpm check`.
- UI acceptance requires browser QA on the exact deployed branch head.

## Review Focus

1. **Same-company Estimate contamination:** outputs, warnings, and acknowledgements from Estimate B must never affect Estimate A. Task 2 includes an Estimate-isolation regression.
2. **Stale acknowledgement after commercial edits:** Sell, price source, Production Quantity, Job MH/unit, labor-rate source, or warning-set changes must invalidate release authority. Tasks 2 and 3 include fingerprint invalidation tests.
3. **Direct Proposal bypass:** direct insertion or alternate application paths must fail when the Estimate is not release-ready. Task 6 adds and tests a database insertion guard.
4. **Row-order instability:** identical commercial state returned in different database row orders must produce identical fingerprints. Task 2 pins deterministic ordering.
5. **Issued-revision mutation:** once `proposal_presentations` contains the Estimate revision, Review acknowledgement and proposal re-issue must not create a second mutable path. Tasks 3 and 6 cover issued/locked behavior.

---

## File Structure

### New files

- `supabase/migrations/20260921232000_estimate_review_acknowledgements.sql`  
  Append-only review acknowledgement evidence, RLS, grants, indexes, immutable-row guard.

- `supabase/migrations/20260921232500_estimate_release_readiness.sql`  
  Deterministic readiness evaluator and fingerprint contract.

- `supabase/migrations/20260921233000_estimate_review_acknowledgement_rpc.sql`  
  Controlled acknowledgement RPC that re-evaluates current state and writes one immutable acknowledgement.

- `supabase/migrations/20260921233500_proposal_release_guard.sql`  
  Proposal release evidence columns plus database insertion guard.

- `lib/estimating/releaseReadiness.ts`  
  TypeScript types and presentation-only helpers for evaluator JSON. No release business rules.

- `tests/p1-estimate-review-readiness.test.ts`  
  Static contract, presentation helper, page wiring, server-action, proposal wiring, and security assertions.

### Modified files

- `app/estimates/audit/page.tsx`  
  Replace nonexistent audit views with the authoritative readiness RPC and render focused exception-first Review / Recap.

- `app/estimates/actions.ts`  
  Add Review acknowledgement server action; update `ready` language/redirect behavior only where necessary.

- `app/estimates/[estimateId]/page.tsx`  
  Rename Audit → Review, Ready for Audit / Proposal → Ready for Review, add stable section anchors and Review link.

- `app/proposals/[estimateId]/page.tsx`  
  Replace the local five-item release engine with authoritative readiness display plus proposal-preparation detail.

- `app/proposals/actions.ts`  
  Fetch current readiness immediately before issue and include release fingerprints/acknowledgement identity in proposal insertion.

- `lib/ui/navigation.ts`  
  Rename Estimate audit → Estimate review while preserving `/estimates/audit` route compatibility.

- `tests/ui-navigation.test.ts`  
  Pin visible navigation label and existing route resolution.

- `docs/modules/estimating.md`  
  Record the implemented Review / Recap release contract.

---

### Task 1: Add append-only Estimate review acknowledgement storage

**Files:**
- Create: `supabase/migrations/20260921232000_estimate_review_acknowledgements.sql`
- Create: `tests/p1-estimate-review-readiness.test.ts`

**Interfaces:**
- Consumes: `public.estimates(id, company_id)`, `public.profiles(id, company_id, role)`, `public.get_my_company_id()`, `public.get_my_role()`.
- Produces: `public.estimate_review_acknowledgements` with immutable review evidence.

- [ ] **Step 1: Write the failing schema/security test**

Add this initial contract to `tests/p1-estimate-review-readiness.test.ts`:

```ts
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const ackMigrationPath = 'supabase/migrations/20260921232000_estimate_review_acknowledgements.sql';

const requireFile = (path: string, message: string) => {
  assert.equal(existsSync(path), true, message);
  return readFileSync(path, 'utf8');
};

test('P1.4 stores append-only tenant-scoped Estimate review acknowledgements', () => {
  const sql = requireFile(ackMigrationPath, 'P1.4 acknowledgement migration must exist');

  assert.match(sql, /create table public\.estimate_review_acknowledgements/i);
  for (const column of [
    'company_id',
    'estimate_id',
    'commercial_fingerprint',
    'warning_fingerprint',
    'warning_count',
    'warning_snapshot',
    'acknowledged_by',
    'acknowledged_at',
  ]) assert.match(sql, new RegExp(column, 'i'));

  assert.match(sql, /alter table public\.estimate_review_acknowledgements enable row level security/i);
  assert.match(sql, /company_id\s*=\s*\(select public\.get_my_company_id\(\)\)/i);
  assert.match(sql, /public\.get_my_role\(\)[\s\S]*<>\s*'employee'/i);
  assert.doesNotMatch(sql, /grant\s+(insert|update|delete)[\s\S]*estimate_review_acknowledgements\s+to\s+authenticated/i);
  assert.match(sql, /raise exception 'Estimate review acknowledgements are immutable\.'/i);
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run:

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/p1-estimate-review-readiness.test.ts
```

Expected: FAIL because `20260921232000_estimate_review_acknowledgements.sql` does not exist.

- [ ] **Step 3: Create the acknowledgement migration**

Create the migration with this structure:

```sql
create table public.estimate_review_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  commercial_fingerprint text not null,
  warning_fingerprint text not null,
  warning_count integer not null check (warning_count > 0),
  warning_snapshot jsonb not null,
  acknowledged_by uuid not null references public.profiles(id) on delete restrict,
  acknowledged_at timestamptz not null default now(),
  constraint estimate_review_ack_company_id_id_key unique(company_id,id),
  constraint estimate_review_ack_estimate_company_fk
    foreign key(company_id,estimate_id)
    references public.estimates(company_id,id)
    on delete cascade
);

create index estimate_review_ack_estimate_idx
  on public.estimate_review_acknowledgements(company_id,estimate_id,acknowledged_at desc);

create index estimate_review_ack_actor_idx
  on public.estimate_review_acknowledgements(acknowledged_by);

alter table public.estimate_review_acknowledgements enable row level security;

create policy "office read estimate review acknowledgements"
on public.estimate_review_acknowledgements
for select to authenticated
using (
  company_id=(select public.get_my_company_id())
  and (select public.get_my_role())<>'employee'
);

grant select on public.estimate_review_acknowledgements to authenticated;
grant all on public.estimate_review_acknowledgements to service_role;
revoke all on public.estimate_review_acknowledgements from anon;

create or replace function public.carez_reject_estimate_review_ack_mutation()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  raise exception 'Estimate review acknowledgements are immutable.';
end;
$$;

create trigger reject_estimate_review_ack_update
before update or delete on public.estimate_review_acknowledgements
for each row execute function public.carez_reject_estimate_review_ack_mutation();

revoke all on function public.carez_reject_estimate_review_ack_mutation() from public,anon,authenticated;
```

If `estimates(company_id,id)` is not already unique in the live schema, add a covering unique constraint/index in this migration before the composite FK rather than weakening tenant lineage.

- [ ] **Step 4: Run the focused test**

Run the same node:test command.

Expected: PASS for the acknowledgement storage contract.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260921232000_estimate_review_acknowledgements.sql tests/p1-estimate-review-readiness.test.ts
git commit -m "feat: add estimate review acknowledgement ledger"
```

---

### Task 2: Add the deterministic release-readiness evaluator and fingerprints

**Files:**
- Create: `supabase/migrations/20260921232500_estimate_release_readiness.sql`
- Modify: `tests/p1-estimate-review-readiness.test.ts`

**Interfaces:**
- Consumes: exact Estimate revision, `estimate_financial_summary`, Estimate-scoped `takeoff_measurements` and `takeoff_measurement_outputs`, `estimate_items`, supplier quote records, proposal settings/default terms, lead contact, L&I classes, prior acknowledgements, issued proposal records.
- Produces: `public.carez_get_estimate_release_readiness(p_estimate_id uuid) returns jsonb`.

The JSON contract is:

```ts
type EstimateReleaseReadiness = {
  estimate_id: string;
  workflow_state: 'not_ready' | 'review' | 'locked';
  release_state: 'not_ready' | 'blocked' | 'review' | 'release_ready';
  blocker_count: number;
  warning_count: number;
  blockers: ReleaseFinding[];
  warnings: ReleaseFinding[];
  commercial_fingerprint: string;
  warning_fingerprint: string;
  acknowledgement_valid: boolean;
  acknowledgement_id: string | null;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  latest_acknowledgement_id: string | null;
  latest_acknowledged_at: string | null;
};
```

- [ ] **Step 1: Extend the test with evaluator-contract assertions**

Add:

```ts
const evaluatorMigrationPath = 'supabase/migrations/20260921232500_estimate_release_readiness.sql';

test('P1.4 readiness evaluator is tenant-scoped, deterministic and Estimate-scoped', () => {
  const sql = requireFile(evaluatorMigrationPath, 'P1.4 readiness evaluator migration must exist');

  assert.match(sql, /create or replace function public\.carez_get_estimate_release_readiness\(p_estimate_id uuid\)/i);
  assert.match(sql, /returns jsonb/i);
  assert.match(sql, /digest\([\s\S]*'sha256'/i);
  assert.match(sql, /takeoff_measurements[\s\S]*estimate_id\s*=\s*p_estimate_id/i);
  assert.match(sql, /takeoff_measurement_outputs[\s\S]*measurement_id/i);
  assert.doesNotMatch(sql, /from public\.takeoff_measurement_outputs\s+where\s+company_id=v_company_id\s*(?:;|\))/i);

  for (const state of ['not_ready', 'blocked', 'review', 'release_ready']) {
    assert.match(sql, new RegExp(`'${state}'`, 'i'));
  }

  for (const blocker of [
    'customer_sell_missing',
    'scope_missing',
    'generated_price_missing',
    'required_input_missing',
    'labor_assumption_missing',
    'labor_rate_missing',
    'manual_cost_missing',
    'labor_classification_missing',
    'generated_lineage_missing',
    'terms_missing',
    'customer_destination_missing',
  ]) assert.match(sql, new RegExp(blocker, 'i'));

  for (const warning of [
    'margin_below_target',
    'manual_price_override',
    'labor_job_override',
    'labor_rate_selection',
    'supplier_quote_expired',
    'supplier_quote_available',
    'scope_unassigned',
    'proposal_schedule_missing',
    'proposal_payment_missing',
  ]) assert.match(sql, new RegExp(warning, 'i'));
});
```

Also pin deterministic ordering:

```ts
test('P1.4 fingerprints aggregate ordered canonical records', () => {
  const sql = requireFile(evaluatorMigrationPath, 'P1.4 readiness evaluator migration must exist');
  assert.match(sql, /jsonb_agg\([\s\S]*order by/i);
  assert.match(sql, /commercial_fingerprint/i);
  assert.match(sql, /warning_fingerprint/i);
  assert.match(sql, /estimate_review_acknowledgements/i);
});
```

- [ ] **Step 2: Run focused tests and confirm RED**

Expected: FAIL because the evaluator migration does not exist.

- [ ] **Step 3: Implement the evaluator migration**

Use one SECURITY INVOKER function and existing tenant helpers:

```sql
create extension if not exists pgcrypto with schema extensions;

create or replace function public.carez_get_estimate_release_readiness(p_estimate_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path=public,extensions
as $$
declare
  v_company_id uuid := public.get_my_company_id();
  v_estimate public.estimates%rowtype;
  v_blockers jsonb := '[]'::jsonb;
  v_warnings jsonb := '[]'::jsonb;
  v_commercial_state jsonb;
  v_warning_state jsonb;
  v_commercial_fingerprint text;
  v_warning_fingerprint text;
  v_ack public.estimate_review_acknowledgements%rowtype;
  v_latest_ack public.estimate_review_acknowledgements%rowtype;
  v_release_state text;
  v_workflow_state text;
begin
  if v_company_id is null then raise exception 'Company context is required.'; end if;

  select * into v_estimate
  from public.estimates
  where id=p_estimate_id and company_id=v_company_id;

  if not found then raise exception 'Estimate not found.'; end if;

  -- Build blockers and warnings with jsonb_build_object rows whose finding_key
  -- is stable and whose record identity is the authoritative source record.
  -- All generated-output CTEs join through takeoff_measurements filtered by
  -- estimate_id=p_estimate_id, status='active'.

  -- Build v_commercial_state from deterministically ordered Estimate sections,
  -- items, active measurements, active estimate-visible outputs, financial
  -- summary, applicable terms, and customer destination facts.

  v_commercial_fingerprint :=
    encode(extensions.digest(convert_to(v_commercial_state::text,'UTF8'),'sha256'),'hex');

  select coalesce(jsonb_agg(w order by w->>'finding_key'),'[]'::jsonb)
  into v_warning_state
  from jsonb_array_elements(v_warnings) w;

  v_warning_fingerprint :=
    encode(extensions.digest(convert_to(v_warning_state::text,'UTF8'),'sha256'),'hex');

  select *
  into v_latest_ack
  from public.estimate_review_acknowledgements
  where company_id=v_company_id and estimate_id=p_estimate_id
  order by acknowledged_at desc,id desc
  limit 1;

  select *
  into v_ack
  from public.estimate_review_acknowledgements
  where company_id=v_company_id
    and estimate_id=p_estimate_id
    and commercial_fingerprint=v_commercial_fingerprint
    and warning_fingerprint=v_warning_fingerprint
  order by acknowledged_at desc,id desc
  limit 1;

  v_workflow_state :=
    case
      when exists(select 1 from public.proposal_presentations p where p.company_id=v_company_id and p.estimate_id=p_estimate_id)
        or v_estimate.status in ('accepted','approved','superseded') then 'locked'
      when v_estimate.status='ready' then 'review'
      else 'not_ready'
    end;

  v_release_state :=
    case
      when v_workflow_state='not_ready' then 'not_ready'
      when v_workflow_state='locked' then 'not_ready'
      when jsonb_array_length(v_blockers)>0 then 'blocked'
      when jsonb_array_length(v_warnings)>0 and v_ack.id is null then 'review'
      else 'release_ready'
    end;

  return jsonb_build_object(
    'estimate_id',v_estimate.id,
    'workflow_state',v_workflow_state,
    'release_state',v_release_state,
    'blocker_count',jsonb_array_length(v_blockers),
    'warning_count',jsonb_array_length(v_warnings),
    'blockers',v_blockers,
    'warnings',v_warnings,
    'commercial_fingerprint',v_commercial_fingerprint,
    'warning_fingerprint',v_warning_fingerprint,
    'acknowledgement_valid',v_ack.id is not null,
    'acknowledgement_id',v_ack.id,
    'acknowledged_at',v_ack.acknowledged_at,
    'acknowledged_by',v_ack.acknowledged_by,
    'latest_acknowledgement_id',v_latest_ack.id,
    'latest_acknowledged_at',v_latest_ack.acknowledged_at
  );
end;
$$;

revoke all on function public.carez_get_estimate_release_readiness(uuid) from public,anon;
grant execute on function public.carez_get_estimate_release_readiness(uuid) to authenticated,service_role;
```

Implement the finding queries inside the marked blocks with these exact rules:

- `customer_sell_missing`: selected/customer Sell `<= 0`.
- `scope_missing`: no Estimate items.
- `generated_price_missing:<output_id>`: active, Estimate-visible, non-labor output has `pricing_status='missing_price'`.
- `required_input_missing:<output_id>`: active, Estimate-visible output has `pricing_status='missing_input'`.
- `labor_assumption_missing:<output_id>`: labor output has both `job_man_hours_per_unit` and `baseline_man_hours_per_unit` null.
- `labor_rate_missing:<output_id>`: labor output has `pricing_status='missing_labor_rate'`.
- `manual_cost_missing:<item_id>`: manual non-labor Estimate item with positive quantity and Direct Cost `<= 0`.
- `labor_classification_missing:<item_id>`: cost-bearing labor item has blank risk class or no active matching `li_risk_classes` record for the relevant current tax year represented by the Estimate's labor snapshot data.
- `generated_lineage_missing:<output_id>`: active Estimate-visible output has no `generated_estimate_item_id` or its item does not point back to the same output/Estimate.
- `terms_missing`: both proposal-specific terms and company default terms are blank.
- `customer_destination_missing`: linked lead has neither email nor phone.
- `margin_below_target`: projected margin < target margin.
- `manual_price_override:<output_id>`: `price_source_kind='manual_override'` or `pricing_status='manual_override'`.
- `labor_job_override:<output_id>`: `job_man_hours_per_unit is not null`.
- `labor_rate_selection:<output_id>`: `labor_rate_override_at is not null`.
- `supplier_quote_expired:<quote_id>`: currently selected supplier-quote source points to a quote whose `expires_at < current_date`.
- `supplier_quote_available:<output_id>`: current output is not supplier-quote priced and has one or more non-expired unselected quote lines.
- `scope_unassigned:<item_id>`: Estimate item has `section_id is null`.
- `proposal_schedule_missing`: proposal schedule summary is blank.
- `proposal_payment_missing`: proposal payment summary is blank.

For every finding object include `finding_key`, `severity`, `category`, `title`, `detail`, `record_id`, and `next_action`. Use stable `next_action` values: `pricing`, `labor`, `scope`, `takeoff`, `proposal_setup`, or `margin`.

The commercial fingerprint must include, in deterministic order:

```sql
jsonb_build_object(
  'estimate', jsonb_build_object(
    'id',v_estimate.id,
    'version',v_estimate.version,
    'status',v_estimate.status,
    'target_margin_percent',v_estimate.target_margin_percent,
    'proposed_sell_price',v_estimate.proposed_sell_price,
    'bo_classification',v_estimate.bo_classification,
    'bo_rate_percent',v_estimate.bo_rate_percent,
    'payment_processing_rate_percent',v_estimate.payment_processing_rate_percent
  ),
  'financial_summary', <single canonical financial summary object>,
  'sections', <jsonb_agg ordered by sort_order,id>,
  'items', <jsonb_agg ordered by sort_order,id>,
  'measurements', <jsonb_agg ordered by created_at,id>,
  'outputs', <jsonb_agg ordered by measurement_id,component_key,id>,
  'proposal_release_facts', <terms/contact/schedule/payment canonical object>
)
```

Do not include volatile fields such as `updated_at` or display-only labels in the fingerprint unless changing them must intentionally invalidate Review.

- [ ] **Step 4: Add a same-company isolation assertion to the static contract**

Add:

```ts
test('P1.4 evaluator scopes generated outputs through Estimate measurements', () => {
  const sql = requireFile(evaluatorMigrationPath, 'P1.4 readiness evaluator migration must exist');
  assert.match(sql, /join public\.takeoff_measurements[\s\S]*measurement_id/i);
  assert.match(sql, /measurements?\.estimate_id\s*=\s*p_estimate_id/i);
});
```

- [ ] **Step 5: Run the focused tests**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260921232500_estimate_release_readiness.sql tests/p1-estimate-review-readiness.test.ts
git commit -m "feat: derive estimate release readiness"
```

---

### Task 3: Add controlled warning acknowledgement RPC

**Files:**
- Create: `supabase/migrations/20260921233000_estimate_review_acknowledgement_rpc.sql`
- Modify: `tests/p1-estimate-review-readiness.test.ts`

**Interfaces:**
- Consumes: `carez_get_estimate_release_readiness(uuid)`.
- Produces: `carez_acknowledge_estimate_review(p_estimate_id uuid) returns jsonb`.

- [ ] **Step 1: Add failing RPC/security assertions**

```ts
const ackRpcMigrationPath = 'supabase/migrations/20260921233000_estimate_review_acknowledgement_rpc.sql';

test('P1.4 acknowledgement RPC re-evaluates current state and never accepts client fingerprints', () => {
  const sql = requireFile(ackRpcMigrationPath, 'P1.4 acknowledgement RPC migration must exist');
  const signature = sql.match(/create or replace function public\.carez_acknowledge_estimate_review\([\s\S]*?\)\s*returns jsonb/i)?.[0] || '';

  assert.match(signature, /p_estimate_id\s+uuid/i);
  assert.doesNotMatch(signature, /fingerprint|warning_count|warning_snapshot|release_state/i);
  assert.match(sql, /for update/i);
  assert.match(sql, /carez_get_estimate_release_readiness\(p_estimate_id\)/i);
  assert.match(sql, /Cannot acknowledge Estimate review while blockers remain\./i);
  assert.match(sql, /No current warnings require acknowledgement\./i);
  assert.match(sql, /public\.get_my_role\(\)[\s\S]*employee/i);
  assert.match(sql, /insert into public\.estimate_review_acknowledgements/i);
});
```

- [ ] **Step 2: Run focused tests and confirm RED**

Expected: FAIL because the RPC migration does not exist.

- [ ] **Step 3: Implement the acknowledgement RPC**

```sql
create or replace function public.carez_acknowledge_estimate_review(p_estimate_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_company_id uuid := public.get_my_company_id();
  v_role text := public.get_my_role();
  v_readiness jsonb;
  v_ack_id uuid;
begin
  if v_company_id is null then raise exception 'Company context is required.'; end if;
  if coalesce(v_role,'employee')='employee' then
    raise exception 'Employees cannot release Estimate review.';
  end if;

  perform 1
  from public.estimates
  where id=p_estimate_id and company_id=v_company_id
  for update;

  if not found then raise exception 'Estimate not found.'; end if;

  v_readiness := public.carez_get_estimate_release_readiness(p_estimate_id);

  if coalesce((v_readiness->>'blocker_count')::integer,0)>0 then
    raise exception 'Cannot acknowledge Estimate review while blockers remain.';
  end if;

  if v_readiness->>'release_state'='not_ready' then
    raise exception 'Estimate must be Ready for Review before acknowledgement.';
  end if;

  if coalesce((v_readiness->>'warning_count')::integer,0)=0 then
    raise exception 'No current warnings require acknowledgement.';
  end if;

  insert into public.estimate_review_acknowledgements(
    company_id,estimate_id,commercial_fingerprint,warning_fingerprint,
    warning_count,warning_snapshot,acknowledged_by
  ) values (
    v_company_id,p_estimate_id,
    v_readiness->>'commercial_fingerprint',
    v_readiness->>'warning_fingerprint',
    (v_readiness->>'warning_count')::integer,
    v_readiness->'warnings',
    auth.uid()
  )
  returning id into v_ack_id;

  return public.carez_get_estimate_release_readiness(p_estimate_id)
    || jsonb_build_object('created_acknowledgement_id',v_ack_id);
end;
$$;

revoke all on function public.carez_acknowledge_estimate_review(uuid) from public,anon;
grant execute on function public.carez_acknowledge_estimate_review(uuid) to authenticated,service_role;
```

The function is SECURITY DEFINER only for the controlled append-only insert. Keep explicit tenant and role checks and do not expose table DML grants.

- [ ] **Step 4: Pin stale-review semantics in tests**

Add static assertions that the evaluator validates both fingerprints:

```ts
test('P1.4 acknowledgement is valid only for both current fingerprints', () => {
  const sql = requireFile(evaluatorMigrationPath, 'P1.4 readiness evaluator migration must exist');
  assert.match(sql, /commercial_fingerprint\s*=\s*v_commercial_fingerprint/i);
  assert.match(sql, /warning_fingerprint\s*=\s*v_warning_fingerprint/i);
});
```

- [ ] **Step 5: Run focused tests**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260921233000_estimate_review_acknowledgement_rpc.sql tests/p1-estimate-review-readiness.test.ts
git commit -m "feat: acknowledge current estimate review"
```

---

### Task 4: Add the presentation-only TypeScript readiness contract

**Files:**
- Create: `lib/estimating/releaseReadiness.ts`
- Modify: `tests/p1-estimate-review-readiness.test.ts`

**Interfaces:**
- Consumes: JSON returned by `carez_get_estimate_release_readiness`.
- Produces:
  - `ReleaseFinding`
  - `EstimateReleaseReadiness`
  - `parseEstimateReleaseReadiness(value: unknown)`
  - `releaseStateLabel(state)`
  - `releaseStateTone(state)`

- [ ] **Step 1: Write failing helper tests**

```ts
test('release readiness presentation helper preserves database state without recomputing it', async () => {
  const { parseEstimateReleaseReadiness, releaseStateLabel } =
    await import('../lib/estimating/releaseReadiness.ts');

  const parsed = parseEstimateReleaseReadiness({
    estimate_id: 'e1',
    workflow_state: 'review',
    release_state: 'review',
    blocker_count: 0,
    warning_count: 1,
    blockers: [],
    warnings: [{ finding_key:'margin_below_target', severity:'warning', category:'margin', title:'Margin below target', detail:'26.8% vs 30%', record_id:null, next_action:'margin' }],
    commercial_fingerprint: 'abc',
    warning_fingerprint: 'def',
    acknowledgement_valid: false,
    acknowledgement_id: null,
    acknowledged_at: null,
    acknowledged_by: null,
    latest_acknowledgement_id: null,
    latest_acknowledged_at: null,
  });

  assert.equal(parsed.release_state, 'review');
  assert.equal(parsed.warning_count, 1);
  assert.equal(releaseStateLabel(parsed.release_state), 'REVIEW REQUIRED');
});
```

- [ ] **Step 2: Run focused tests and confirm RED**

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement the helper**

```ts
export type ReleaseState = 'not_ready' | 'blocked' | 'review' | 'release_ready';
export type WorkflowState = 'not_ready' | 'review' | 'locked';
export type ReleaseFindingAction = 'pricing' | 'labor' | 'scope' | 'takeoff' | 'proposal_setup' | 'margin';

export type ReleaseFinding = {
  finding_key: string;
  severity: 'blocker' | 'warning';
  category: string;
  title: string;
  detail: string;
  record_id: string | null;
  next_action: ReleaseFindingAction;
};

export type EstimateReleaseReadiness = {
  estimate_id: string;
  workflow_state: WorkflowState;
  release_state: ReleaseState;
  blocker_count: number;
  warning_count: number;
  blockers: ReleaseFinding[];
  warnings: ReleaseFinding[];
  commercial_fingerprint: string;
  warning_fingerprint: string;
  acknowledgement_valid: boolean;
  acknowledgement_id: string | null;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  latest_acknowledgement_id: string | null;
  latest_acknowledged_at: string | null;
};

export function parseEstimateReleaseReadiness(value: unknown): EstimateReleaseReadiness {
  if (!value || typeof value !== 'object') throw new Error('Estimate release readiness is unavailable.');
  const row = value as Partial<EstimateReleaseReadiness>;
  if (!row.estimate_id || !['not_ready','blocked','review','release_ready'].includes(String(row.release_state))) {
    throw new Error('Estimate release readiness response is invalid.');
  }
  return {
    estimate_id: String(row.estimate_id),
    workflow_state: String(row.workflow_state) as WorkflowState,
    release_state: String(row.release_state) as ReleaseState,
    blocker_count: Number(row.blocker_count || 0),
    warning_count: Number(row.warning_count || 0),
    blockers: Array.isArray(row.blockers) ? row.blockers as ReleaseFinding[] : [],
    warnings: Array.isArray(row.warnings) ? row.warnings as ReleaseFinding[] : [],
    commercial_fingerprint: String(row.commercial_fingerprint || ''),
    warning_fingerprint: String(row.warning_fingerprint || ''),
    acknowledgement_valid: Boolean(row.acknowledgement_valid),
    acknowledgement_id: row.acknowledgement_id ? String(row.acknowledgement_id) : null,
    acknowledged_at: row.acknowledged_at ? String(row.acknowledged_at) : null,
    acknowledged_by: row.acknowledged_by ? String(row.acknowledged_by) : null,
    latest_acknowledgement_id: row.latest_acknowledgement_id ? String(row.latest_acknowledgement_id) : null,
    latest_acknowledged_at: row.latest_acknowledged_at ? String(row.latest_acknowledged_at) : null,
  };
}

export function releaseStateLabel(state: ReleaseState) {
  if (state === 'blocked') return 'BLOCKED';
  if (state === 'review') return 'REVIEW REQUIRED';
  if (state === 'release_ready') return 'RELEASE READY';
  return 'NOT READY';
}

export function releaseStateTone(state: ReleaseState): 'danger' | 'warning' | 'success' | 'default' {
  if (state === 'blocked') return 'danger';
  if (state === 'review') return 'warning';
  if (state === 'release_ready') return 'success';
  return 'default';
}
```

Do not add functions here that decide whether a finding exists or whether Proposal may issue.

- [ ] **Step 4: Run focused tests**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/estimating/releaseReadiness.ts tests/p1-estimate-review-readiness.test.ts
git commit -m "feat: add estimate release presentation contract"
```

---

### Task 5: Replace the broken Audit surface with focused Review / Recap

**Files:**
- Modify: `app/estimates/audit/page.tsx`
- Modify: `app/estimates/actions.ts`
- Modify: `app/estimates/[estimateId]/page.tsx`
- Modify: `lib/ui/navigation.ts`
- Modify: `tests/ui-navigation.test.ts`
- Modify: `tests/p1-estimate-review-readiness.test.ts`

**Interfaces:**
- Consumes: `carez_get_estimate_release_readiness(uuid)`, existing financial summary, Estimate sections/items, Estimate-scoped measurements/outputs, quote records, proposal settings/default terms.
- Produces: focused exception-first Review / Recap and `acknowledgeEstimateReview(formData)`.

- [ ] **Step 1: Write failing page/action wiring tests**

Add:

```ts
const reviewPagePath = 'app/estimates/audit/page.tsx';
const estimateActionsPath = 'app/estimates/actions.ts';
const estimatePagePath = 'app/estimates/[estimateId]/page.tsx';

test('Estimate Review consumes the authoritative readiness RPC and no nonexistent audit views', () => {
  const page = requireFile(reviewPagePath, 'Estimate Review page must exist');
  assert.match(page, /carez_get_estimate_release_readiness/);
  assert.doesNotMatch(page, /estimate_audit_(?:summary|findings)/);
  assert.match(page, /Estimate Review \/ Recap/i);
  assert.match(page, /Commercial Recap/i);
  assert.match(page, /Pricing Recap/i);
  assert.match(page, /Labor Recap/i);
  assert.match(page, /Commercial Decisions/i);
  assert.match(page, /Estimate Trace/i);
  assert.match(page, /Reviewed \/ proceed/i);
});

test('Estimate review acknowledgement action delegates authority to the RPC', () => {
  const actions = requireFile(estimateActionsPath, 'Estimate actions must exist');
  assert.match(actions, /export async function acknowledgeEstimateReview/);
  assert.match(actions, /carez_acknowledge_estimate_review/);
  const action = actions.slice(actions.indexOf('export async function acknowledgeEstimateReview'));
  assert.doesNotMatch(action.split('export async function',2)[0] || action, /fingerprint|warning_snapshot|warning_count/);
});

test('Estimate UI uses Ready for Review and Review terminology', () => {
  const page = requireFile(estimatePagePath, 'Estimate page must exist');
  assert.match(page, /Ready for Review/);
  assert.doesNotMatch(page, /Ready for Audit \/ Proposal/);
  assert.match(page, />Review</);
});
```

Update `tests/ui-navigation.test.ts` with:

```ts
test('Estimate review keeps the compatibility route with Review product language', () => {
  const destination = NAVIGATION_DESTINATIONS.find(item => item.id === 'estimate-audit');
  assert.equal(destination?.href, '/estimates/audit');
  assert.equal(destination?.label, 'Estimate review');
});
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run:

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/p1-estimate-review-readiness.test.ts tests/ui-navigation.test.ts
```

Expected: FAIL on old Audit labels and nonexistent audit-view wiring.

- [ ] **Step 3: Add the acknowledgement server action**

In `app/estimates/actions.ts`:

```ts
export async function acknowledgeEstimateReview(fd: FormData) {
  const estimateId = String(fd.get('estimate_id') || '');
  if (!estimateId) throw new Error('Estimate is required.');
  const { supabase, companyId } = await ctx();

  const { data: estimate, error: estimateError } = await supabase
    .from('estimates')
    .select('id')
    .eq('id', estimateId)
    .eq('company_id', companyId)
    .maybeSingle();

  if (estimateError || !estimate) throw new Error(estimateError?.message || 'Estimate not found.');

  const { error } = await supabase.rpc('carez_acknowledge_estimate_review', {
    p_estimate_id: estimateId,
  });
  if (error) throw new Error(error.message);

  revalidatePath('/estimates');
  revalidatePath('/estimates/audit');
  revalidatePath(`/estimates/${estimateId}`);
  revalidatePath(`/proposals/${estimateId}`);
}
```

- [ ] **Step 4: Rebuild `app/estimates/audit/page.tsx` around one selected Estimate**

For `?estimate=<id>`:

1. auth + company/office access;
2. load the selected Estimate;
3. call `supabase.rpc('carez_get_estimate_release_readiness',{p_estimate_id:estimateId})`;
4. parse with `parseEstimateReleaseReadiness`;
5. load only Recap display facts needed for the approved page hierarchy;
6. render exceptions before trace/detail.

Use this action map:

```ts
const findingHref = (estimateId: string, action: ReleaseFindingAction) => {
  if (action === 'pricing') return `/estimates/${estimateId}#pricing-coverage`;
  if (action === 'labor') return `/estimates/${estimateId}#labor-review`;
  if (action === 'scope') return `/estimates/${estimateId}#scope-cost`;
  if (action === 'margin') return `/estimates/${estimateId}#price-margin`;
  if (action === 'proposal_setup') return `/proposals/${estimateId}`;
  return '/takeoff';
};
```

The page must visibly contain these sections in this order:

```text
Release state
Commercial Recap
Blockers
Warnings
Commercial Decisions
Scope Recap
Pricing Recap
Labor Recap
Proposal preparation
Estimate Trace
```

Show **Reviewed / proceed** only when `release_state==='review'`, `blocker_count===0`, and `warning_count>0`.

If `latest_acknowledgement_id` exists but `acknowledgement_valid===false`, render a stale-review notice rather than deleting history.

For the no-warning path, render `RELEASE READY` without an acknowledgement button.

For the unfiltered `/estimates/audit` route, list Estimates using the evaluator per Estimate or a bounded server query that invokes the same evaluator; do not recreate summary logic in TypeScript.

- [ ] **Step 5: Add stable anchors and terminology to the Estimate page**

In `app/estimates/[estimateId]/page.tsx`:

- stage copy `Ready for Audit` → `Ready for Review`;
- workflow item `Audit` → `Review`;
- option label `Ready for Audit / Proposal` → `Ready for Review`;
- add IDs:
  - `id="scope-cost"`
  - `id="price-margin"`
  - wrapper around Pricing Coverage: `id="pricing-coverage"`
  - wrapper around Labor Review: `id="labor-review"`.

Do not change the stored status value `ready`.

- [ ] **Step 6: Rename navigation presentation only**

In `lib/ui/navigation.ts` change:

```ts
{id:'estimate-audit',href:'/estimates/audit',label:'Estimate review',hint:'Commercial recap and release review',domain:'estimating',icon:'shield'}
```

Keep the ID and route unchanged.

- [ ] **Step 7: Run focused tests and typecheck**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/p1-estimate-review-readiness.test.ts tests/ui-navigation.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add app/estimates/audit/page.tsx app/estimates/actions.ts app/estimates/[estimateId]/page.tsx lib/ui/navigation.ts tests/ui-navigation.test.ts tests/p1-estimate-review-readiness.test.ts
git commit -m "feat: add exception-first estimate review recap"
```

---

### Task 6: Make Proposal issuance consume and enforce authoritative release readiness

**Files:**
- Create: `supabase/migrations/20260921233500_proposal_release_guard.sql`
- Modify: `app/proposals/[estimateId]/page.tsx`
- Modify: `app/proposals/actions.ts`
- Modify: `tests/p1-estimate-review-readiness.test.ts`

**Interfaces:**
- Consumes: `carez_get_estimate_release_readiness(uuid)`.
- Produces:
  - proposal columns `release_commercial_fingerprint`, `release_warning_fingerprint`, `release_acknowledgement_id`;
  - database trigger `carez_guard_proposal_release()`;
  - application issue path that supplies current evaluator evidence.

- [ ] **Step 1: Add failing Proposal guard tests**

```ts
const proposalGuardMigrationPath = 'supabase/migrations/20260921233500_proposal_release_guard.sql';
const proposalPagePath = 'app/proposals/[estimateId]/page.tsx';
const proposalActionsPath = 'app/proposals/actions.ts';

test('P1.4 proposal presentation stores release evidence and has a database release guard', () => {
  const sql = requireFile(proposalGuardMigrationPath, 'P1.4 proposal release guard migration must exist');

  for (const column of [
    'release_commercial_fingerprint',
    'release_warning_fingerprint',
    'release_acknowledgement_id',
  ]) assert.match(sql, new RegExp(column, 'i'));

  assert.match(sql, /create or replace function public\.carez_guard_proposal_release\(\)/i);
  assert.match(sql, /carez_get_estimate_release_readiness\(new\.estimate_id\)/i);
  assert.match(sql, /release_state[\s\S]*release_ready/i);
  assert.match(sql, /commercial_fingerprint/i);
  assert.match(sql, /warning_fingerprint/i);
  assert.match(sql, /before insert on public\.proposal_presentations/i);
});

test('Proposal UI and issue action consume authoritative release readiness', () => {
  const page = requireFile(proposalPagePath, 'Proposal page must exist');
  const actions = requireFile(proposalActionsPath, 'Proposal actions must exist');

  assert.match(page, /carez_get_estimate_release_readiness/);
  assert.doesNotMatch(page, /readyCount===5/);

  const issue = actions.slice(actions.indexOf('export async function createProposalLink'));
  assert.match(issue, /carez_get_estimate_release_readiness/);
  assert.match(issue, /release_commercial_fingerprint/);
  assert.match(issue, /release_warning_fingerprint/);
  assert.match(issue, /release_acknowledgement_id/);
});
```

- [ ] **Step 2: Run focused test and confirm RED**

Expected: FAIL because the guard migration and wiring do not exist.

- [ ] **Step 3: Add proposal release-evidence columns and guard**

Migration core:

```sql
alter table public.proposal_presentations
  add column release_commercial_fingerprint text,
  add column release_warning_fingerprint text,
  add column release_acknowledgement_id uuid
    references public.estimate_review_acknowledgements(id) on delete restrict;

create index proposal_presentations_release_ack_idx
  on public.proposal_presentations(release_acknowledgement_id)
  where release_acknowledgement_id is not null;

create or replace function public.carez_guard_proposal_release()
returns trigger
language plpgsql
security invoker
set search_path=public,extensions
as $$
declare
  v_readiness jsonb;
begin
  v_readiness := public.carez_get_estimate_release_readiness(new.estimate_id);

  if v_readiness->>'release_state' <> 'release_ready' then
    raise exception 'Estimate is not release-ready for Proposal.';
  end if;

  if nullif(new.release_commercial_fingerprint,'') is distinct from (v_readiness->>'commercial_fingerprint') then
    raise exception 'Estimate changed after Review.';
  end if;

  if nullif(new.release_warning_fingerprint,'') is distinct from (v_readiness->>'warning_fingerprint') then
    raise exception 'Estimate warning state changed after Review.';
  end if;

  if coalesce((v_readiness->>'warning_count')::integer,0)>0
     and new.release_acknowledgement_id is distinct from nullif(v_readiness->>'acknowledgement_id','')::uuid then
    raise exception 'Current warning review acknowledgement is required.';
  end if;

  if coalesce((v_readiness->>'warning_count')::integer,0)=0 then
    new.release_acknowledgement_id := null;
  end if;

  return new;
end;
$$;

create trigger guard_proposal_release
before insert on public.proposal_presentations
for each row execute function public.carez_guard_proposal_release();
```

The migration must preserve already-issued historical rows by adding nullable evidence columns without backfilling invented evidence. The guard applies to new inserts only.

- [ ] **Step 4: Replace Proposal page local release engine**

In `app/proposals/[estimateId]/page.tsx` load:

```ts
const { data: releaseData, error: releaseError } = await supabase.rpc(
  'carez_get_estimate_release_readiness',
  { p_estimate_id: estimateId },
);
if (releaseError) throw new Error(releaseError.message);
const release = parseEstimateReleaseReadiness(releaseData);
```

Keep customer-facing setup detail (contact, terms, schedule, payment, clarifications) as informational rows, but enable issue only when:

```ts
const canIssue = release.release_state === 'release_ready' && !locked;
```

Do not reconstruct blocker/warning logic in the page.

- [ ] **Step 5: Re-check readiness immediately before issue and send evidence into the insert**

In `createProposalLink(fd)`, after Estimate ownership/lock checks and immediately before creating proposal release records:

```ts
const { data: releaseData, error: releaseError } = await supabase.rpc(
  'carez_get_estimate_release_readiness',
  { p_estimate_id: estimateId },
);
if (releaseError) throw new Error(releaseError.message);

const release = parseEstimateReleaseReadiness(releaseData);
if (release.release_state !== 'release_ready') {
  throw new Error('Complete Estimate Review before issuing this Proposal.');
}
```

Add these fields to the `proposal_presentations` insert:

```ts
release_commercial_fingerprint: release.commercial_fingerprint,
release_warning_fingerprint: release.warning_fingerprint,
release_acknowledgement_id: release.warning_count > 0 ? release.acknowledgement_id : null,
```

Keep the existing token revocation cleanup if presentation insert fails.

- [ ] **Step 6: Run focused tests and typecheck**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/p1-estimate-review-readiness.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260921233500_proposal_release_guard.sql app/proposals/[estimateId]/page.tsx app/proposals/actions.ts tests/p1-estimate-review-readiness.test.ts
git commit -m "feat: enforce proposal release readiness"
```

---

### Task 7: Document the implemented P1.4 contract

**Files:**
- Modify: `docs/modules/estimating.md`
- Modify: `tests/p1-estimate-review-readiness.test.ts`

**Interfaces:**
- Consumes: implemented behavior from Tasks 1–6.
- Produces: durable module documentation matching runtime behavior.

- [ ] **Step 1: Add failing documentation assertions**

```ts
const estimatingSpecPath = 'docs/modules/estimating.md';

test('Estimating module documents P1.4 release readiness and acknowledgement semantics', () => {
  const docs = requireFile(estimatingSpecPath, 'Estimating module spec must exist');
  assert.match(docs, /Ready for Review/i);
  assert.match(docs, /BLOCKED/i);
  assert.match(docs, /REVIEW REQUIRED/i);
  assert.match(docs, /RELEASE READY/i);
  assert.match(docs, /complete current warning set/i);
  assert.match(docs, /commercial fingerprint/i);
  assert.match(docs, /Proposal issuance/i);
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Expected: FAIL until the module spec is updated.

- [ ] **Step 3: Update `docs/modules/estimating.md` Review and recap section**

Replace the current short Review section with durable behavior covering:

```text
Estimate status ready = Ready for Review.
Release readiness is derived by the server-authoritative database evaluator.
BLOCKED = objective release blockers that must be fixed.
REVIEW REQUIRED = no blockers, but current warnings are not acknowledged for the current commercial/warning fingerprints.
RELEASE READY = no blockers and either zero warnings or a valid acknowledgement for the complete current warning set.
Acknowledgements are append-only audit evidence and become stale automatically when fingerprints change.
Proposal issuance re-evaluates release readiness and is guarded at the database insertion boundary.
Recap is exception-first and does not own a second quantity/pricing/labor engine.
```

Also record that per-line Sell allocation is not introduced by P1.4.

- [ ] **Step 4: Run focused test**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add docs/modules/estimating.md tests/p1-estimate-review-readiness.test.ts
git commit -m "docs: record estimate review release contract"
```

---

### Task 8: Apply to Supabase QA and prove runtime behavior

**Files:**
- No new product files unless verification reveals a real defect.
- Verify migrations from Tasks 1–6 against QA project `tkcirsdfvvahwrcratkn`.

**Interfaces:**
- Consumes: committed P1.4 migrations.
- Produces: runtime evidence that SQL contracts, RLS, fingerprints, acknowledgement, and Proposal guard behave as designed.

- [ ] **Step 1: Apply the four P1.4 migrations to Supabase QA in source order**

Apply:

```text
20260921232000_estimate_review_acknowledgements.sql
20260921232500_estimate_release_readiness.sql
20260921233000_estimate_review_acknowledgement_rpc.sql
20260921233500_proposal_release_guard.sql
```

Do not touch production project `snbnwgetfuvkjkhfxmmz`.

- [ ] **Step 2: Verify schema and grants**

Run SQL equivalent to:

```sql
select table_name,column_name
from information_schema.columns
where table_schema='public'
  and table_name in ('estimate_review_acknowledgements','proposal_presentations')
order by table_name,ordinal_position;

select routine_name,security_type
from information_schema.routines
where routine_schema='public'
  and routine_name in (
    'carez_get_estimate_release_readiness',
    'carez_acknowledge_estimate_review'
  );

select schemaname,tablename,policyname,cmd,qual,with_check
from pg_policies
where schemaname='public'
  and tablename='estimate_review_acknowledgements';
```

Expected: acknowledgement table exists, evaluator/RPC exist, select-only office RLS is present, and no authenticated table write policy exists.

- [ ] **Step 3: Exercise evaluator states on a controlled QA Estimate**

Use an existing disposable QA Estimate or create one through normal staging UI. Verify in order:

```text
draft                      → not_ready
ready + objective blocker  → blocked
ready + warnings           → review
ready + zero findings      → release_ready
ready + warnings + current acknowledgement → release_ready
```

Record the Estimate ID and returned fingerprints in the work log/PR description, not in permanent product docs.

- [ ] **Step 4: Prove stale acknowledgement**

On the controlled QA Estimate with a valid acknowledgement:

1. capture current fingerprints;
2. change Customer Sell;
3. re-run evaluator and confirm `acknowledgement_valid=false`;
4. re-acknowledge;
5. change a Job MH/unit override;
6. confirm invalidation again;
7. restore/re-acknowledge as needed.

Expected: every relevant commercial edit yields a new fingerprint and `release_state='review'` when warnings remain.

- [ ] **Step 5: Prove same-company isolation**

Use two QA Estimates in the same company. Add/change a generated price or labor override on Estimate B and confirm Estimate A's:

- blocker count;
- warning count;
- commercial fingerprint;
- warning fingerprint;
- acknowledgement validity

remain unchanged.

- [ ] **Step 6: Prove cross-company and employee restrictions**

Using QA role/test contexts already available to the project, verify:

- another company cannot evaluate or acknowledge the Estimate;
- employee role cannot acknowledge;
- direct authenticated insert/update/delete on acknowledgement rows is rejected.

Do not weaken RLS to simplify this test.

- [ ] **Step 7: Prove Proposal guard**

Verify:

- blocked Estimate insert rejects;
- review-required Estimate insert rejects;
- stale acknowledgement rejects;
- release-ready Estimate inserts through the real application flow;
- issued revision remains locked by existing mutation guards.

- [ ] **Step 8: Run Supabase advisors**

Run security and performance advisors after migrations.

Expected: no new ERROR-level security issue; no avoidable missing index introduced by P1.4.

- [ ] **Step 9: If runtime verification exposed a defect, write a RED regression before fixing it**

Use `tests/p1-estimate-review-readiness.test.ts` for source-contract regressions. For a SQL behavior defect that cannot be reproduced in node:test without adding unsupported infrastructure, capture the exact QA SQL reproduction in the commit/PR notes and add the strongest static contract test that prevents the same implementation mistake.

- [ ] **Step 10: Commit only if verification required fixes**

Commit message must describe the actual defect, for example:

```bash
git commit -m "fix: keep estimate review fingerprints tenant scoped"
```

---

### Task 9: Full repository verification and browser acceptance

**Files:**
- No intended code changes.

**Interfaces:**
- Consumes: complete P1.4 branch.
- Produces: evidence for PR review and Nik acceptance.

- [ ] **Step 1: Run the focused P1.4 tests**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/p1-estimate-review-readiness.test.ts tests/ui-navigation.test.ts
```

Expected: all focused tests PASS.

- [ ] **Step 2: Run TypeScript validation**

```bash
pnpm typecheck
```

Expected: exit 0.

- [ ] **Step 3: Run full repository validation**

```bash
pnpm check
```

Expected: typecheck, all tests, and Next.js build exit 0.

- [ ] **Step 4: Push the exact branch head and wait for GitHub Actions**

Push only the P1.4 branch. Do not merge to `staging` yet.

Expected: GitHub Actions checks complete successfully, or any failure is investigated before acceptance claims.

- [ ] **Step 5: Verify the exact-head Vercel staging deployment**

Confirm the deployed SHA matches the branch head used by tests.

- [ ] **Step 6: Run focused browser QA**

Use one real QA Estimate and execute:

```text
1. Mark Estimate Ready for Review.
2. Confirm Commercial/Pricing/Labor/Scope recap totals reconcile.
3. Create a missing price → BLOCKED.
4. Fix it → blocker disappears automatically.
5. Keep a Job MH/unit override → REVIEW REQUIRED.
6. Reviewed / proceed → RELEASE READY.
7. Change Job MH/unit → previous review becomes stale.
8. Re-review.
9. Change Customer Sell → stale again.
10. Re-acknowledge.
11. Open Proposal.
12. Confirm Proposal issue is enabled only when RELEASE READY.
13. Issue Proposal.
14. Confirm issued Estimate revision is immutable.
15. Open a second Estimate and confirm no cross-Estimate records appear.
```

- [ ] **Step 7: Verify terminology and visual behavior**

Confirm visible UI says:

```text
Takeoff → Estimate → Review → Proposal
Ready for Review
Estimate Review / Recap
BLOCKED
REVIEW REQUIRED
RELEASE READY
Reviewed / proceed
```

Confirm no obsolete visible `Ready for Audit / Proposal` text remains in the touched workflow.

- [ ] **Step 8: Prepare the review summary**

Report:

- final branch SHA;
- migrations added;
- tests run with exact pass/fail counts;
- `pnpm typecheck` result;
- `pnpm check` result;
- Supabase QA verification result;
- GitHub Actions result;
- Vercel exact-head URL/SHA;
- browser QA result;
- unresolved blockers, if any.

Do not claim completion unless each reported success has fresh evidence.

---

## Self-Review Checklist

- Spec coverage: all approved P1.4 sections map to Tasks 1–9.
- Database authority: evaluator, acknowledgement, and Proposal guard remain PostgreSQL-owned.
- No duplicate findings table: only human acknowledgement evidence is persisted.
- TDD: every production-code task begins with a failing focused test.
- Tenant isolation: evaluator scopes outputs through Estimate measurements and acknowledgement RLS is company-scoped.
- Human authority: warnings are acknowledged as a complete set; no heuristic production-rate judgment is introduced.
- Fingerprints: deterministic ordering is explicitly required and tested.
- Proposal boundary: application re-check plus database insertion guard.
- Sell boundary: no per-line Sell allocation added.
- Existing `ready` value preserved; only visible meaning changes.
- Existing `/estimates/audit` route preserved for compatibility.
- No P1.5 Proposal Revision lifecycle, Issue #28 Accepted Scope Snapshot, Issue #26 production learning, Issue #76 global UI rollout, Issue #59 production release, or `main` work included.
