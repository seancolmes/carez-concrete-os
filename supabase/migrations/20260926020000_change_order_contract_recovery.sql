-- Restore the source-owned commercial-change contract. This migration intentionally
-- fails if any canonical object already exists; existing environments require an
-- explicit reconciliation migration rather than blind adoption.
do $preflight$
begin
  if to_regclass('public.change_orders') is not null
    or to_regclass('public.change_order_items') is not null
    or to_regclass('public.change_order_events') is not null
    or to_regclass('public.approved_commercial_deltas') is not null
    or to_regclass('public.approved_commercial_delta_items') is not null
    or to_regclass('public.change_order_financial_summary') is not null
    or to_regprocedure('public.approve_change_order(uuid)') is not null then
    raise exception 'Change Order recovery preflight failed: a canonical object already exists; reconcile it explicitly.';
  end if;
end
$preflight$;

create unique index projects_company_id_id_uk on public.projects(company_id,id);
create unique index cost_codes_company_id_id_uk on public.cost_codes(company_id,id);
create unique index cost_catalog_company_id_id_uk on public.cost_catalog_items(company_id,id);
create unique index crew_members_company_id_id_uk on public.crew_members(company_id,id);
create unique index commercial_baseline_items_company_baseline_id_uk on public.commercial_baseline_items(company_id,baseline_id,id);
create unique index commercial_baseline_items_company_id_uk on public.commercial_baseline_items(company_id,id);
create or replace function public.carez_preserve_awarded_project_contract_value()
returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin
  if old.award_decision_id is not null and new.contract_value is distinct from old.contract_value then
    raise exception 'Original Award contract_value is immutable; approved changes are appended separately.';
  end if;
  return new;
end
$$;
create trigger projects_preserve_awarded_contract_value before update of contract_value on public.projects
for each row execute function public.carez_preserve_awarded_project_contract_value();
create table public.change_order_number_sequences (
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null,
  last_number integer not null default 0 check(last_number>=0),
  primary key(company_id,project_id),
  foreign key(company_id,project_id) references public.projects(company_id,id) on delete restrict
);

create table public.change_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null,
  co_number text not null,
  title text not null check(length(btrim(title))>0),
  description text, reason text, requested_by text,
  requested_date date not null default current_date,
  change_type text not null check(change_type in ('additive','deductive','no_cost')),
  status text not null default 'draft' check(status in ('draft','submitted','approved','rejected','void')),
  field_work_status text not null default 'not_started' check(field_work_status in ('not_started','directed','in_progress','complete')),
  target_margin_percent numeric(6,2) not null default 30 check(target_margin_percent>=0 and target_margin_percent<100),
  bo_rate_percent numeric(8,5) not null default 0.471 check(bo_rate_percent>=0),
  payment_processing_rate_percent numeric(8,5) not null default 0 check(payment_processing_rate_percent>=0),
  overhead_snapshot_id uuid, overhead_rate_snapshot numeric(12,4) not null default 0 check(overhead_rate_snapshot>=0),
  proposed_sell_price numeric(14,2),
  authorization_kind text check(authorization_kind in ('external_customer','external_gc','internal_no_cost')),
  authorization_reference text, external_authorized_by text,
  external_authorized_at timestamptz, authorization_note text, authorization_document_reference text,
  created_by uuid not null references auth.users(id) on delete restrict,
  submitted_at timestamptz, rejected_at timestamptz, voided_at timestamptz,
  approved_by uuid references auth.users(id) on delete restrict,
  approved_at timestamptz,
  reversal_of_change_order_id uuid,
  idempotency_key uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(company_id,id), unique(company_id,project_id,co_number), unique(company_id,idempotency_key),
  foreign key(company_id,project_id) references public.projects(company_id,id) on delete restrict,
  foreign key(company_id,reversal_of_change_order_id) references public.change_orders(company_id,id) on delete restrict,
  check((change_type='additive' and (proposed_sell_price is null or proposed_sell_price>=0))
     or (change_type='deductive' and (proposed_sell_price is null or proposed_sell_price<=0))
     or (change_type='no_cost' and coalesce(proposed_sell_price,0)=0)),
  check((status='approved' and approved_by is not null and approved_at is not null)
     or (status<>'approved' and approved_by is null and approved_at is null)),
  check(reversal_of_change_order_id is null or reversal_of_change_order_id<>id)
);
create index change_orders_project_status_idx on public.change_orders(company_id,project_id,status,requested_date desc);
create unique index change_orders_single_reversal_idx on public.change_orders(company_id,reversal_of_change_order_id) where reversal_of_change_order_id is not null;

create table public.change_order_items (
  id uuid primary key default gen_random_uuid(), company_id uuid not null, change_order_id uuid not null,
  item_type text not null check(item_type in ('labor','material','equipment','subcontractor','other')),
  cost_effect text not null default 'cost' check(cost_effect in ('cost','credit')),
  cost_code_id uuid, catalog_item_id uuid, crew_member_id uuid, labor_task text, risk_class_code text, labor_tax_year integer,
  affected_commercial_baseline_item_id uuid,
  description text not null check(length(btrim(description))>0),
  quantity numeric(14,4) not null default 0 check(quantity>=0), unit text not null default 'LS',
  unit_cost numeric(14,4) not null default 0 check(unit_cost>=0), direct_cost numeric(14,2) not null default 0,
  regular_hours numeric(12,4) not null default 0 check(regular_hours>=0),
  overtime_hours numeric(12,4) not null default 0 check(overtime_hours>=0),
  base_hourly_rate_snapshot numeric(12,4), social_security_rate_snapshot numeric(10,7),
  medicare_rate_snapshot numeric(10,7), futa_rate_snapshot numeric(10,7), wa_sui_rate_snapshot numeric(10,7),
  li_employer_rate_snapshot numeric(12,5), sick_leave_accrual_rate_snapshot numeric(10,7),
  notes text, sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(company_id,id),
  foreign key(company_id,change_order_id) references public.change_orders(company_id,id) on delete restrict,
  foreign key(company_id,cost_code_id) references public.cost_codes(company_id,id) on delete set null (cost_code_id),
  foreign key(company_id,catalog_item_id) references public.cost_catalog_items(company_id,id) on delete set null (catalog_item_id),
  foreign key(company_id,crew_member_id) references public.crew_members(company_id,id) on delete set null (crew_member_id),
  foreign key(company_id,labor_tax_year,risk_class_code) references public.li_risk_classes(company_id,tax_year,code),
  foreign key(company_id,affected_commercial_baseline_item_id) references public.commercial_baseline_items(company_id,id) on delete restrict,
  check((item_type='labor' and unit='HR') or item_type<>'labor'),
  check((cost_effect='cost' and direct_cost>=0) or (cost_effect='credit' and direct_cost<=0))
);
create index change_order_items_order_idx on public.change_order_items(company_id,change_order_id,sort_order,id);

create table public.change_order_events (
  id uuid primary key default gen_random_uuid(), company_id uuid not null, project_id uuid not null,
  change_order_id uuid not null, from_status text, to_status text not null,
  actor_id uuid not null references auth.users(id) on delete restrict,
  occurred_at timestamptz not null default now(), note text, evidence jsonb not null default '{}'::jsonb,
  unique(company_id,id),
  foreign key(company_id,project_id) references public.projects(company_id,id) on delete restrict,
  foreign key(company_id,change_order_id) references public.change_orders(company_id,id) on delete restrict,
  check(jsonb_typeof(evidence)='object')
);

create table public.approved_commercial_deltas (
  id uuid primary key default gen_random_uuid(), company_id uuid not null, project_id uuid not null,
  change_order_id uuid not null, commercial_baseline_id uuid not null,
  approved_by uuid not null references auth.users(id) on delete restrict, approved_at timestamptz not null,
  authorization_kind text not null check(authorization_kind in ('external_customer','external_gc','internal_no_cost')),
  authorization_reference text, external_authorized_by text, external_authorized_at timestamptz,
  authorization_note text, authorization_document_reference text,
  source_fingerprint text not null, total_direct_cost_delta numeric(14,2) not null,
  sell_delta numeric(14,2) not null, source_facts jsonb not null check(jsonb_typeof(source_facts)='object'),
  created_at timestamptz not null default now(),
  unique(company_id,id), unique(company_id,change_order_id), unique(company_id,id,commercial_baseline_id),
  foreign key(company_id,project_id) references public.projects(company_id,id) on delete restrict,
  foreign key(company_id,change_order_id) references public.change_orders(company_id,id) on delete restrict,
  foreign key(company_id,commercial_baseline_id) references public.commercial_baselines(company_id,id) on delete restrict
);
create table public.approved_commercial_delta_items (
  id uuid primary key default gen_random_uuid(), company_id uuid not null, commercial_delta_id uuid not null, commercial_baseline_id uuid not null,
  source_change_order_item_id uuid not null, affected_commercial_baseline_item_id uuid,
  quantity numeric(14,4) not null check(quantity>=0), unit text not null,
  direct_cost_delta numeric(14,2) not null,
  source_facts jsonb not null check(jsonb_typeof(source_facts)='object'),
  created_at timestamptz not null default now(), unique(company_id,id),
  unique(company_id,commercial_delta_id,source_change_order_item_id),
  foreign key(company_id,commercial_delta_id,commercial_baseline_id) references public.approved_commercial_deltas(company_id,id,commercial_baseline_id) on delete restrict,
  foreign key(company_id,source_change_order_item_id) references public.change_order_items(company_id,id) on delete restrict,
  foreign key(company_id,commercial_baseline_id,affected_commercial_baseline_item_id) references public.commercial_baseline_items(company_id,baseline_id,id) on delete restrict
);

create or replace function public.carez_commercial_actor_company()
returns uuid language sql stable security definer set search_path=pg_catalog,public as $$
  select p.company_id from public.profiles p where p.id=auth.uid()
$$;
create or replace function public.carez_can_manage_commercial_changes()
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
  select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('owner','office'))
$$;
revoke all on function public.carez_commercial_actor_company() from public,anon;
revoke all on function public.carez_can_manage_commercial_changes() from public,anon;
grant execute on function public.carez_commercial_actor_company(),public.carez_can_manage_commercial_changes() to authenticated;

create or replace function public.carez_change_order_status_event()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if tg_op='INSERT' then
    insert into public.change_order_events(company_id,project_id,change_order_id,to_status,actor_id,evidence)
    values(new.company_id,new.project_id,new.id,new.status,coalesce(auth.uid(),new.created_by),jsonb_build_object('event','created'));
    return new;
  end if;
  if new.status is distinct from old.status then
    if not public.carez_can_manage_commercial_changes() then raise exception 'Commercial Change Order authority required.'; end if;
    if not ((old.status='draft' and new.status in ('submitted','void'))
      or (old.status='submitted' and new.status in ('draft','approved','rejected','void'))) then
      raise exception 'Invalid Change Order status transition: % to %.',old.status,new.status;
    end if;
  end if;
  if old.status in ('approved','rejected','void') and (to_jsonb(new)-array['updated_at']) is distinct from (to_jsonb(old)-array['updated_at']) then
    raise exception 'Closed Change Orders are immutable.';
  end if;
  if old.status='submitted' and (to_jsonb(new)-array['status','updated_at','submitted_at','rejected_at','voided_at','approved_at','approved_by']) is distinct from (to_jsonb(old)-array['status','updated_at','submitted_at','rejected_at','voided_at','approved_at','approved_by']) then
    raise exception 'Submitted Change Orders are frozen; return to Draft before editing.';
  end if;
  return new;
end
$$;
create trigger change_orders_status_event after insert or update on public.change_orders
for each row execute function public.carez_change_order_status_event();

create or replace function public.carez_guard_change_order_item()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_status text; v_company uuid;
begin
  v_company:=case when tg_op='DELETE' then old.company_id else new.company_id end;
  if not public.carez_can_manage_commercial_changes() or v_company is distinct from public.carez_commercial_actor_company() then
    raise exception 'Commercial Change Order authority required.';
  end if;
  select co.status into v_status from public.change_orders co
    where co.id=case when tg_op='DELETE' then old.change_order_id else new.change_order_id end and co.company_id=v_company for update;
  if v_status<>'draft' then raise exception 'Only draft Change Orders can change items.'; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end
$$;
create trigger change_order_items_guard before insert or update or delete on public.change_order_items
for each row execute function public.carez_guard_change_order_item();

create or replace function public.carez_immutable_commercial_delta()
returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin raise exception 'Approved commercial Change Order evidence is immutable.'; end
$$;
create trigger approved_commercial_deltas_immutable before update or delete on public.approved_commercial_deltas
for each row execute function public.carez_immutable_commercial_delta();
create trigger approved_commercial_delta_items_immutable before update or delete on public.approved_commercial_delta_items
for each row execute function public.carez_immutable_commercial_delta();
create or replace function public.carez_immutable_change_order_event()
returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin raise exception 'Change Order history is append-only.'; end
$$;
create trigger change_order_events_immutable before update or delete on public.change_order_events
for each row execute function public.carez_immutable_change_order_event();

create or replace function public.carez_create_change_order(
  p_project_id uuid,p_title text,p_change_type text,p_requested_date date default current_date,
  p_description text default null,p_reason text default null,p_requested_by text default null,
  p_overhead_snapshot_id uuid default null,p_overhead_rate_snapshot numeric default 0,p_reversal_of_change_order_id uuid default null
) returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_company uuid; v_id uuid; v_number integer; v_project public.projects%rowtype; v_estimate public.estimates%rowtype; v_original public.change_orders%rowtype;
begin
  v_company:=public.carez_commercial_actor_company();
  if auth.uid() is null or not public.carez_can_manage_commercial_changes() then raise exception 'Owner or office authority required.'; end if;
  select * into v_project from public.projects where id=p_project_id and company_id=v_company for update;
  if not found then raise exception 'Project not found.'; end if;
  select * into v_estimate from public.estimates where id=v_project.source_estimate_id and company_id=v_company;
  if not found then raise exception 'Award source Estimate not found.'; end if;
  if p_reversal_of_change_order_id is not null then
    select * into v_original from public.change_orders where id=p_reversal_of_change_order_id and company_id=v_company
      and project_id=p_project_id and status='approved' and reversal_of_change_order_id is null for share;
    if not found or not exists(select 1 from public.approved_commercial_deltas d where d.company_id=v_company and d.change_order_id=v_original.id) then raise exception 'Only an unreversed approved Change Order from this Project can be reversed.'; end if;
    if exists(select 1 from public.change_orders where company_id=v_company and reversal_of_change_order_id=v_original.id) then raise exception 'This approved Change Order already has a reversal.'; end if;
    if (v_original.change_type='additive' and p_change_type<>'deductive') or (v_original.change_type='deductive' and p_change_type<>'additive') or (v_original.change_type='no_cost' and p_change_type<>'no_cost') then
      raise exception 'Reversal Change Order type must counter the original approved change.';
    end if;
  end if;
  insert into public.change_order_number_sequences(company_id,project_id,last_number) values(v_company,p_project_id,1)
  on conflict(company_id,project_id) do update set last_number=public.change_order_number_sequences.last_number+1
  returning last_number into v_number;
  insert into public.change_orders(company_id,project_id,co_number,title,description,reason,requested_by,requested_date,change_type,
    target_margin_percent,bo_rate_percent,payment_processing_rate_percent,overhead_snapshot_id,overhead_rate_snapshot,created_by,reversal_of_change_order_id)
  values(v_company,p_project_id,'CO-'||lpad(v_number::text,3,'0'),btrim(p_title),nullif(btrim(p_description),''),nullif(btrim(p_reason),''),
    nullif(btrim(p_requested_by),''),coalesce(p_requested_date,current_date),p_change_type,coalesce(v_estimate.target_margin_percent,30),
    coalesce(v_estimate.bo_rate_percent,0.471),coalesce(v_estimate.payment_processing_rate_percent,0),p_overhead_snapshot_id,
    greatest(coalesce(p_overhead_rate_snapshot,0),0),auth.uid(),p_reversal_of_change_order_id) returning id into v_id;
  return v_id;
end
$$;

create or replace function public.carez_transition_change_order(
  p_change_order_id uuid,p_transition text,p_note text default null,
  p_authorization_kind text default null,p_authorization_reference text default null,
  p_external_authorized_by text default null,p_external_authorized_at timestamptz default null,
  p_authorization_note text default null,p_authorization_document_reference text default null,
  p_sell_delta numeric default null
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_company uuid; v_co public.change_orders%rowtype; v_to text; v_sell numeric; v_original_sell numeric;
begin
  v_company:=public.carez_commercial_actor_company();
  if auth.uid() is null or not public.carez_can_manage_commercial_changes() then raise exception 'Owner or office authority required.'; end if;
  select * into v_co from public.change_orders where id=p_change_order_id and company_id=v_company for update;
  if not found then raise exception 'Change Order not found.'; end if;
  v_to:=case p_transition when 'submit' then 'submitted' when 'return_to_draft' then 'draft' when 'reject' then 'rejected' when 'void' then 'void' else null end;
  if v_to is null or not ((v_co.status='draft' and v_to in ('submitted','void')) or (v_co.status='submitted' and v_to in ('draft','rejected','void'))) then
    raise exception 'Invalid Change Order transition.';
  end if;
  if v_to='submitted' then
    if not exists(select 1 from public.change_order_items i where i.company_id=v_company and i.change_order_id=v_co.id) then raise exception 'Add at least one item before submission.'; end if;
    v_sell:=p_sell_delta;
    if v_sell is null then select recommended_sell_price into v_sell from public.change_order_financial_summary where change_order_id=v_co.id; end if;
    if v_sell is null then raise exception 'Selected Sell delta is required.'; end if;
    if (v_co.change_type='additive' and v_sell<0) or (v_co.change_type='deductive' and v_sell>0) or (v_co.change_type='no_cost' and v_sell<>0) then raise exception 'Sell delta sign does not match Change Order type.'; end if;
    if v_co.reversal_of_change_order_id is not null then
      select d.sell_delta into v_original_sell from public.approved_commercial_deltas d
        where d.company_id=v_company and d.change_order_id=v_co.reversal_of_change_order_id;
      if not found or v_sell<>-v_original_sell then raise exception 'Reversal Change Order Sell must exactly offset the original approved Sell delta.'; end if;
    end if;
    if p_authorization_kind in ('external_customer','external_gc') then
      if nullif(btrim(p_authorization_reference),'') is null or nullif(btrim(p_external_authorized_by),'') is null or p_external_authorized_at is null then raise exception 'External authorization evidence is incomplete.'; end if;
    elsif p_authorization_kind='internal_no_cost' then
      if v_co.change_type<>'no_cost' or v_sell<>0 or nullif(btrim(p_authorization_note),'') is null then raise exception 'Internal no-cost basis requires documented zero-Sell internal exposure.'; end if;
    else raise exception 'Select documented external authorization or the permitted internal no-cost basis.'; end if;
    update public.change_orders set status='submitted',submitted_at=now(),proposed_sell_price=v_sell,
      authorization_kind=p_authorization_kind,authorization_reference=nullif(btrim(p_authorization_reference),''),
      external_authorized_by=nullif(btrim(p_external_authorized_by),''),external_authorized_at=p_external_authorized_at,
      authorization_note=nullif(btrim(p_authorization_note),''),authorization_document_reference=nullif(btrim(p_authorization_document_reference),''),updated_at=now()
    where id=v_co.id and company_id=v_company;
  else
    update public.change_orders set status=v_to,updated_at=now(),
      rejected_at=case when v_to='rejected' then now() else rejected_at end,
      voided_at=case when v_to='void' then now() else voided_at end
    where id=v_co.id and company_id=v_company;
  end if;
  insert into public.change_order_events(company_id,project_id,change_order_id,from_status,to_status,actor_id,note,evidence)
  values(v_company,v_co.project_id,v_co.id,v_co.status,v_to,auth.uid(),nullif(btrim(p_note),''),
    case when v_to='submitted' then jsonb_build_object('authorization_kind',p_authorization_kind,'authorization_reference',p_authorization_reference,
      'external_authorized_by',p_external_authorized_by,'external_authorized_at',p_external_authorized_at,
      'authorization_note',p_authorization_note,'authorization_document_reference',p_authorization_document_reference) else jsonb_build_object('transition',p_transition) end);
  return jsonb_build_object('change_order_id',v_co.id,'status',v_to);
end
$$;

create or replace function public.carez_update_change_order(p_change_order_id uuid,p_values jsonb)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_company uuid; v_status text; v_change_type text; v_sell numeric;
begin
  v_company:=public.carez_commercial_actor_company();
  if auth.uid() is null or not public.carez_can_manage_commercial_changes() then raise exception 'Owner or office authority required.'; end if;
  select status,change_type into v_status,v_change_type from public.change_orders
    where id=p_change_order_id and company_id=v_company for update;
  if not found or v_status<>'draft' then raise exception 'Only draft Change Orders can be edited.'; end if;
  v_sell:=nullif(p_values->>'proposed_sell_price','')::numeric;
  if v_sell is not null and ((v_change_type='additive' and v_sell<0) or (v_change_type='deductive' and v_sell>0) or (v_change_type='no_cost' and v_sell<>0)) then
    raise exception 'Sell delta sign does not match Change Order type.';
  end if;
  update public.change_orders set target_margin_percent=coalesce((p_values->>'target_margin_percent')::numeric,target_margin_percent),
    payment_processing_rate_percent=coalesce((p_values->>'payment_processing_rate_percent')::numeric,payment_processing_rate_percent),
    proposed_sell_price=v_sell,
    field_work_status=coalesce(nullif(p_values->>'field_work_status',''),field_work_status),updated_at=now()
  where id=p_change_order_id and company_id=v_company;
end
$$;

create or replace function public.approve_change_order(p_change_order_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_company uuid; v_actor uuid; v_co public.change_orders%rowtype; v_baseline public.commercial_baselines%rowtype; v_original_sell numeric(14,2);
  v_cost numeric(14,2); v_exposure numeric(14,2); v_fingerprint text; v_facts jsonb; v_delta uuid; v_item record; v_existing public.approved_commercial_deltas%rowtype;
begin
  v_actor:=auth.uid(); v_company:=public.carez_commercial_actor_company();
  if v_actor is null or v_company is null or not public.carez_can_manage_commercial_changes() then raise exception 'Owner or office approval authority required.'; end if;
  select * into v_co from public.change_orders where id=p_change_order_id and company_id=v_company for update;
  if not found then raise exception 'Change Order not found.'; end if;
  select * into v_existing from public.approved_commercial_deltas where company_id=v_company and change_order_id=v_co.id;
  if found then
    if v_co.status='approved' then return jsonb_build_object('change_order_id',v_co.id,'delta_id',v_existing.id,'already_approved',true,'source_fingerprint',v_existing.source_fingerprint); end if;
    raise exception 'Conflicting approval evidence exists for this Change Order.';
  end if;
  if v_co.status<>'submitted' then raise exception 'Only submitted Change Orders can be approved.'; end if;
  select * into v_baseline from public.commercial_baselines where company_id=v_company and project_id=v_co.project_id and baseline_kind='original_award' for share;
  if not found then raise exception 'Original Commercial Baseline not found.'; end if;
  if not exists(select 1 from public.change_order_items where company_id=v_company and change_order_id=v_co.id) then raise exception 'Submitted Change Order has no items.'; end if;
  select coalesce(sum(direct_cost),0)::numeric(14,2) into v_cost from public.change_order_items where company_id=v_company and change_order_id=v_co.id;
  select actual_company_exposure into v_exposure from public.change_order_financial_summary where change_order_id=v_co.id;
  if v_co.authorization_kind in ('external_customer','external_gc') then
    if nullif(btrim(v_co.authorization_reference),'') is null or nullif(btrim(v_co.external_authorized_by),'') is null or v_co.external_authorized_at is null then raise exception 'External authorization evidence is incomplete.'; end if;
  elsif v_co.authorization_kind='internal_no_cost' then
    if v_co.change_type<>'no_cost' or coalesce(v_co.proposed_sell_price,0)<>0 or v_co.field_work_status not in ('directed','in_progress','complete')
      or coalesce(v_co.authorization_note,'')='' or coalesce(v_exposure,0)<=0 then raise exception 'Internal no-cost authority requires documented positive internal exposure and zero Sell.'; end if;
  else raise exception 'Documented external authorization is required.'; end if;
  if v_co.change_type='additive' and coalesce(v_co.proposed_sell_price,0)<0 then raise exception 'Additive Sell delta must be non-negative.'; end if;
  if v_co.change_type='deductive' and coalesce(v_co.proposed_sell_price,0)>0 then raise exception 'Deductive Sell delta must be non-positive.'; end if;
  if v_co.change_type='no_cost' and coalesce(v_co.proposed_sell_price,0)<>0 then raise exception 'No-cost Sell delta must be zero.'; end if;
  if v_co.reversal_of_change_order_id is not null then
    select d.sell_delta into v_original_sell from public.approved_commercial_deltas d
      where d.company_id=v_company and d.change_order_id=v_co.reversal_of_change_order_id;
    if not found or coalesce(v_co.proposed_sell_price,0)<>-v_original_sell then raise exception 'Reversal Change Order Sell must exactly offset the original approved Sell delta.'; end if;
  end if;
  select jsonb_build_object('change_order',to_jsonb(v_co)-array['approved_by','approved_at','updated_at'],
    'items',coalesce(jsonb_agg(to_jsonb(i) order by i.sort_order,i.id),'[]'::jsonb)) into v_facts
  from public.change_order_items i where i.company_id=v_company and i.change_order_id=v_co.id;
  v_fingerprint:=encode(extensions.digest(convert_to(v_facts::text,'UTF8'),'sha256'),'hex');
  insert into public.approved_commercial_deltas(company_id,project_id,change_order_id,commercial_baseline_id,approved_by,approved_at,
    authorization_kind,authorization_reference,external_authorized_by,external_authorized_at,authorization_note,authorization_document_reference,
    source_fingerprint,total_direct_cost_delta,sell_delta,source_facts)
  values(v_company,v_co.project_id,v_co.id,v_baseline.id,v_actor,now(),v_co.authorization_kind,v_co.authorization_reference,
    v_co.external_authorized_by,v_co.external_authorized_at,v_co.authorization_note,v_co.authorization_document_reference,
    v_fingerprint,v_cost,coalesce(v_co.proposed_sell_price,0),v_facts) returning id into v_delta;
  for v_item in select * from public.change_order_items where company_id=v_company and change_order_id=v_co.id order by sort_order,id loop
    insert into public.approved_commercial_delta_items(company_id,commercial_delta_id,commercial_baseline_id,source_change_order_item_id,affected_commercial_baseline_item_id,quantity,unit,direct_cost_delta,source_facts)
    values(v_company,v_delta,v_baseline.id,v_item.id,v_item.affected_commercial_baseline_item_id,v_item.quantity,v_item.unit,v_item.direct_cost,to_jsonb(v_item));
  end loop;
  update public.change_orders set status='approved',approved_by=v_actor,approved_at=now(),updated_at=now() where id=v_co.id and company_id=v_company;
  insert into public.change_order_events(company_id,project_id,change_order_id,from_status,to_status,actor_id,evidence)
  values(v_company,v_co.project_id,v_co.id,'submitted','approved',v_actor,jsonb_build_object('commercial_delta_id',v_delta,'source_fingerprint',v_fingerprint));
  return jsonb_build_object('change_order_id',v_co.id,'delta_id',v_delta,'already_approved',false,'source_fingerprint',v_fingerprint);
end
$$;

create or replace view public.change_order_financial_summary with (security_invoker=true) as
with item_totals as (
  select i.company_id,i.change_order_id,
    sum(i.direct_cost) total_direct_cost,
    sum(i.direct_cost) filter(where i.item_type='labor') direct_labor_cost,
    sum(i.direct_cost) filter(where i.item_type='material') direct_material_cost,
    sum(i.direct_cost) filter(where i.item_type='equipment') direct_equipment_cost,
    sum(i.direct_cost) filter(where i.item_type='subcontractor') direct_subcontractor_cost,
    sum(i.direct_cost) filter(where i.item_type='other') direct_other_cost,
    sum(i.regular_hours+i.overtime_hours) productive_labor_hours,
    sum((i.regular_hours+i.overtime_hours)*case when i.cost_effect='credit' then -1 else 1 end) signed_overhead_hours
  from public.change_order_items i group by i.company_id,i.change_order_id
), priced as (
  select co.*,p.job_number,p.name project_name,b.total_sell original_baseline_sell,
    coalesce(t.total_direct_cost,0) total_direct_cost,coalesce(t.direct_labor_cost,0) direct_labor_cost,
    coalesce(t.direct_material_cost,0) direct_material_cost,coalesce(t.direct_equipment_cost,0) direct_equipment_cost,
    coalesce(t.direct_subcontractor_cost,0) direct_subcontractor_cost,coalesce(t.direct_other_cost,0) direct_other_cost,
    coalesce(t.productive_labor_hours,0) labor_hours,
    coalesce(t.signed_overhead_hours,0)*co.overhead_rate_snapshot overhead_cost
  from public.change_orders co join public.projects p on p.id=co.project_id and p.company_id=co.company_id
  left join public.commercial_baselines b on b.project_id=co.project_id and b.company_id=co.company_id and b.baseline_kind='original_award'
  left join item_totals t on t.change_order_id=co.id and t.company_id=co.company_id
)
select p.id change_order_id,p.company_id,p.project_id,p.co_number,p.title,p.description,p.reason,p.requested_by,p.requested_date,
  p.change_type,p.status,p.field_work_status,p.reversal_of_change_order_id,p.target_margin_percent,p.payment_processing_rate_percent,
  p.total_direct_cost,p.direct_labor_cost,p.direct_material_cost,p.direct_equipment_cost,p.direct_subcontractor_cost,p.direct_other_cost,
  p.labor_hours,p.overhead_cost,
  (p.total_direct_cost+p.overhead_cost) actual_company_exposure,
  (p.total_direct_cost+p.overhead_cost) base_company_cost,
  case when p.change_type='no_cost' then 0 else
    (case when p.change_type='deductive' then -1 else 1 end)*abs(case
      when 1-(p.target_margin_percent+p.bo_rate_percent+p.payment_processing_rate_percent)/100>0
      then round((p.total_direct_cost+p.overhead_cost)/(1-(p.target_margin_percent+p.bo_rate_percent+p.payment_processing_rate_percent)/100),2) else 0 end) end recommended_sell_price,
  coalesce(p.proposed_sell_price,case when p.change_type='no_cost' then 0 else
    (case when p.change_type='deductive' then -1 else 1 end)*abs(case
      when 1-(p.target_margin_percent+p.bo_rate_percent+p.payment_processing_rate_percent)/100>0
      then round((p.total_direct_cost+p.overhead_cost)/(1-(p.target_margin_percent+p.bo_rate_percent+p.payment_processing_rate_percent)/100),2) else 0 end) end) selected_sell_price,
  coalesce(p.proposed_sell_price,case when p.change_type='no_cost' then 0 else
    (case when p.change_type='deductive' then -1 else 1 end)*abs(case
      when 1-(p.target_margin_percent+p.bo_rate_percent+p.payment_processing_rate_percent)/100>0
      then round((p.total_direct_cost+p.overhead_cost)/(1-(p.target_margin_percent+p.bo_rate_percent+p.payment_processing_rate_percent)/100),2) else 0 end) end)
    -(p.total_direct_cost+p.overhead_cost)
    -coalesce(p.proposed_sell_price,case when p.change_type='no_cost' then 0 else
      (case when p.change_type='deductive' then -1 else 1 end)*abs(case
        when 1-(p.target_margin_percent+p.bo_rate_percent+p.payment_processing_rate_percent)/100>0
        then round((p.total_direct_cost+p.overhead_cost)/(1-(p.target_margin_percent+p.bo_rate_percent+p.payment_processing_rate_percent)/100),2) else 0 end) end)
      *(p.bo_rate_percent+p.payment_processing_rate_percent)/100 projected_profit_impact,
  p.original_baseline_sell,coalesce(d.sell_delta,0) approved_sell_delta,
  p.original_baseline_sell+coalesce((select sum(ad.sell_delta) from public.approved_commercial_deltas ad where ad.company_id=p.company_id and ad.project_id=p.project_id),0) authorized_contract_value
from priced p left join public.approved_commercial_deltas d on d.company_id=p.company_id and d.change_order_id=p.id
where public.carez_can_manage_commercial_changes() and p.company_id=public.carez_commercial_actor_company();

create or replace view public.approved_change_order_references with (security_barrier=true) as
select co.id,co.company_id,co.project_id,co.co_number,co.title,co.status,co.field_work_status
from public.change_orders co where co.company_id=public.carez_commercial_actor_company() and co.status='approved';

create or replace view public.project_authorized_contract_summary with (security_invoker=true) as
select p.company_id,p.id project_id,b.id commercial_baseline_id,b.total_sell original_contract_value,
  b.total_sell+coalesce(sum(d.sell_delta),0) authorized_contract_value
from public.projects p join public.commercial_baselines b on b.company_id=p.company_id and b.project_id=p.id and b.baseline_kind='original_award'
left join public.approved_commercial_deltas d on d.company_id=p.company_id and d.project_id=p.id
where public.carez_can_manage_commercial_changes() and p.company_id=public.carez_commercial_actor_company()
group by p.company_id,p.id,b.id,b.total_sell;

create or replace view public.commercial_baseline_item_references with (security_invoker=true) as
select b.company_id,cb.project_id,b.id,coalesce(b.source_facts->>'description','Accepted scope item') description,
  b.quantity,b.unit,b.direct_cost,b.sell_amount
from public.commercial_baseline_items b join public.commercial_baselines cb on cb.company_id=b.company_id and cb.id=b.baseline_id
where public.carez_can_manage_commercial_changes() and b.company_id=public.carez_commercial_actor_company();

alter table public.change_order_number_sequences enable row level security;
alter table public.change_orders enable row level security;
alter table public.change_order_items enable row level security;
alter table public.change_order_events enable row level security;
alter table public.approved_commercial_deltas enable row level security;
alter table public.approved_commercial_delta_items enable row level security;
create policy change_order_management_read on public.change_orders for select to authenticated
  using(company_id=public.carez_commercial_actor_company() and public.carez_can_manage_commercial_changes());
create policy change_order_management_insert on public.change_orders for insert to authenticated
  with check(company_id=public.carez_commercial_actor_company() and public.carez_can_manage_commercial_changes() and created_by=auth.uid() and status='draft');
create policy change_order_management_update on public.change_orders for update to authenticated
  using(company_id=public.carez_commercial_actor_company() and public.carez_can_manage_commercial_changes())
  with check(company_id=public.carez_commercial_actor_company() and public.carez_can_manage_commercial_changes());
create policy change_order_item_management on public.change_order_items for all to authenticated
  using(company_id=public.carez_commercial_actor_company() and public.carez_can_manage_commercial_changes())
  with check(company_id=public.carez_commercial_actor_company() and public.carez_can_manage_commercial_changes());
create policy change_order_event_management_read on public.change_order_events for select to authenticated
  using(company_id=public.carez_commercial_actor_company() and public.carez_can_manage_commercial_changes());
create policy approved_delta_management_read on public.approved_commercial_deltas for select to authenticated
  using(company_id=public.carez_commercial_actor_company() and public.carez_can_manage_commercial_changes());
create policy approved_delta_item_management_read on public.approved_commercial_delta_items for select to authenticated
  using(company_id=public.carez_commercial_actor_company() and public.carez_can_manage_commercial_changes());

revoke all on public.change_order_number_sequences,public.change_orders,public.change_order_items,public.change_order_events,
  public.approved_commercial_deltas,public.approved_commercial_delta_items from public,anon,authenticated;
grant select on public.change_orders to authenticated;
grant select,insert,update,delete on public.change_order_items to authenticated;
grant select on public.change_order_events,public.approved_commercial_deltas,public.approved_commercial_delta_items to authenticated;
revoke all on public.change_order_financial_summary,public.approved_change_order_references,public.project_authorized_contract_summary,public.commercial_baseline_item_references from public,anon,authenticated;
grant select on public.change_order_financial_summary,public.approved_change_order_references,public.project_authorized_contract_summary,public.commercial_baseline_item_references to authenticated;
revoke all on function public.carez_change_order_status_event(),public.carez_guard_change_order_item(),public.carez_immutable_commercial_delta(),public.carez_immutable_change_order_event() from public,anon,authenticated;
revoke all on function public.carez_preserve_awarded_project_contract_value() from public,anon,authenticated;
revoke all on function public.carez_create_change_order(uuid,text,text,date,text,text,text,uuid,numeric,uuid),
  public.carez_transition_change_order(uuid,text,text,text,text,text,timestamptz,text,text,numeric),
  public.carez_update_change_order(uuid,jsonb),public.approve_change_order(uuid) from public,anon;
grant execute on function public.carez_create_change_order(uuid,text,text,date,text,text,text,uuid,numeric,uuid),
  public.carez_transition_change_order(uuid,text,text,text,text,text,timestamptz,text,text,numeric),
  public.carez_update_change_order(uuid,jsonb),public.approve_change_order(uuid) to authenticated;

comment on table public.approved_commercial_deltas is 'Immutable approved Change Order Sell and Direct Cost delta appended to the original Commercial Baseline lineage.';
comment on table public.approved_commercial_delta_items is 'Immutable item-level source facts for one approved commercial delta; no Sell allocation is inferred.';
comment on view public.change_order_financial_summary is 'Deterministic read model for Change Order cost, pricing, and approved contract deltas. Original baseline remains unchanged.';
