-- Supplier access is scoped to one quote on one estimate revision. A link only
-- records supplier evidence; office selection remains the pricing authority.
create table public.estimate_supplier_quote_access_tokens (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  quote_id uuid not null,
  token uuid not null unique default gen_random_uuid(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  revoked_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint estimate_supplier_quote_access_company_id_id_key unique (company_id, id),
  constraint estimate_supplier_quote_access_quote_company_fk
    foreign key (company_id, quote_id)
    references public.estimate_supplier_quotes(company_id, id) on delete cascade
);

create index estimate_supplier_quote_access_quote_idx
  on public.estimate_supplier_quote_access_tokens(company_id, quote_id, created_at desc);

create table public.estimate_supplier_quote_access_items (
  company_id uuid not null references public.companies(id) on delete cascade,
  access_token_id uuid not null,
  source_takeoff_output_id uuid not null references public.takeoff_measurement_outputs(id) on delete cascade,
  primary key (access_token_id, source_takeoff_output_id),
  constraint estimate_supplier_quote_access_items_token_company_fk
    foreign key (company_id, access_token_id)
    references public.estimate_supplier_quote_access_tokens(company_id, id) on delete cascade
);
create index estimate_supplier_quote_access_items_output_idx
  on public.estimate_supplier_quote_access_items(source_takeoff_output_id);

alter table public.estimate_supplier_quote_access_tokens enable row level security;
create policy "office access estimate supplier quote links"
  on public.estimate_supplier_quote_access_tokens for all to authenticated
  using (company_id = (select public.get_my_company_id())
    and (select public.get_my_role()) <> 'employee')
  with check (company_id = (select public.get_my_company_id())
    and (select public.get_my_role()) <> 'employee');
revoke all on public.estimate_supplier_quote_access_tokens from public, anon;
grant select, insert on public.estimate_supplier_quote_access_tokens to authenticated;
grant update (revoked_at) on public.estimate_supplier_quote_access_tokens to authenticated;
grant all on public.estimate_supplier_quote_access_tokens to service_role;
alter table public.estimate_supplier_quote_access_items enable row level security;
create policy "office access estimate supplier quote link items"
  on public.estimate_supplier_quote_access_items for all to authenticated
  using (company_id = (select public.get_my_company_id())
    and (select public.get_my_role()) <> 'employee')
  with check (company_id = (select public.get_my_company_id())
    and (select public.get_my_role()) <> 'employee');
revoke all on public.estimate_supplier_quote_access_items from public, anon;
grant select, insert on public.estimate_supplier_quote_access_items to authenticated;
grant all on public.estimate_supplier_quote_access_items to service_role;

create function public.carez_validate_supplier_quote_access_item()
returns trigger language plpgsql security invoker
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.estimate_supplier_quote_access_tokens t
    join public.estimate_supplier_quotes q
      on q.id = t.quote_id and q.company_id = t.company_id
    join public.estimate_supplier_quote_sets s
      on s.id = q.quote_set_id and s.company_id = t.company_id
    join public.takeoff_measurement_outputs o
      on o.id = new.source_takeoff_output_id and o.company_id = t.company_id
    join public.takeoff_measurements m
      on m.id = o.measurement_id and m.company_id = t.company_id
    where t.id = new.access_token_id and t.company_id = new.company_id
      and m.estimate_id = s.estimate_id
      and m.status = 'active' and o.is_active = true and o.estimate_visible = true
      and o.estimate_item_type <> 'labor' and o.generated_estimate_item_id is not null
      and nullif(trim(o.production_unit), '') is not null
  ) then
    raise exception 'Supplier link resource must belong to this estimate revision.';
  end if;
  return new;
end;
$$;
create trigger validate_supplier_quote_access_item
  before insert or update on public.estimate_supplier_quote_access_items
  for each row execute function public.carez_validate_supplier_quote_access_item();
revoke all on function public.carez_validate_supplier_quote_access_item() from public, anon;

create table public.estimate_supplier_quote_submission_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  quote_id uuid not null,
  access_token_id uuid references public.estimate_supplier_quote_access_tokens(id) on delete set null,
  quote_line_id uuid references public.estimate_supplier_quote_lines(id) on delete set null,
  source_takeoff_output_id uuid references public.takeoff_measurement_outputs(id) on delete set null,
  output_label text,
  prior_unit_cost numeric,
  quoted_unit_cost numeric not null,
  submitted_at timestamptz not null default now(),
  constraint estimate_supplier_quote_submission_company_fk
    foreign key (company_id, quote_id)
    references public.estimate_supplier_quotes(company_id, id) on delete cascade
);
create index estimate_supplier_quote_submission_quote_idx
  on public.estimate_supplier_quote_submission_events(company_id, quote_id, submitted_at desc);
alter table public.estimate_supplier_quote_submission_events enable row level security;
create policy "office reads supplier quote submissions"
  on public.estimate_supplier_quote_submission_events for select to authenticated
  using (company_id = (select public.get_my_company_id())
    and (select public.get_my_role()) <> 'employee');
revoke all on public.estimate_supplier_quote_submission_events from public, anon;
grant select on public.estimate_supplier_quote_submission_events to authenticated;
grant all on public.estimate_supplier_quote_submission_events to service_role;

create function public.carez_get_public_vendor_quote(p_token uuid)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_token public.estimate_supplier_quote_access_tokens%rowtype;
  v_quote public.estimate_supplier_quotes%rowtype;
  v_set public.estimate_supplier_quote_sets%rowtype;
  v_estimate public.estimates%rowtype;
  v_editable boolean;
begin
  select * into v_token from public.estimate_supplier_quote_access_tokens
    where token = p_token and revoked_at is null and expires_at > now();
  if not found then return null; end if;
  select * into v_quote from public.estimate_supplier_quotes
    where id = v_token.quote_id and company_id = v_token.company_id;
  if not found then return null; end if;
  select * into v_set from public.estimate_supplier_quote_sets
    where id = v_quote.quote_set_id and company_id = v_token.company_id;
  if not found then return null; end if;
  select * into v_estimate from public.estimates
    where id = v_set.estimate_id and company_id = v_token.company_id;
  if not found then return null; end if;
  v_editable := v_estimate.status not in ('accepted', 'approved', 'superseded')
    and v_set.status <> 'archived'
    and v_quote.status not in ('declined', 'selected')
    and (v_quote.expires_at is null or v_quote.expires_at >= current_date)
    and not exists (select 1 from public.proposal_presentations p
      where p.company_id = v_token.company_id and p.estimate_id = v_estimate.id);
  return jsonb_build_object(
    'supplier_name', v_quote.supplier_name,
    'quote_number', v_quote.supplier_quote_number,
    'quote_set', v_set.name,
    'scope_note', v_set.scope_note,
    'estimate_name', v_estimate.name,
    'expires_at', v_token.expires_at,
    'editable', v_editable,
    'outputs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id, 'label', o.label, 'quantity', o.production_quantity,
        'unit', o.production_unit, 'unit_cost', ql.quoted_unit_cost,
        'source_reference', ql.source_reference
      ) order by m.created_at, o.label, o.id)
      from public.takeoff_measurement_outputs o
      join public.takeoff_measurements m
        on m.company_id = o.company_id and m.id = o.measurement_id
      join public.estimate_supplier_quote_access_items access_item
        on access_item.access_token_id = v_token.id and access_item.source_takeoff_output_id = o.id
      left join lateral (
        select l.quoted_unit_cost, l.source_reference
        from public.estimate_supplier_quote_lines l
        where l.company_id = v_token.company_id and l.quote_id = v_quote.id
          and l.source_takeoff_output_id = o.id
        order by l.created_at desc, l.id desc limit 1
      ) ql on true
      where m.company_id = v_token.company_id and m.estimate_id = v_estimate.id
        and m.status = 'active' and o.is_active = true and o.estimate_visible = true
        and o.estimate_item_type <> 'labor'
        and o.generated_estimate_item_id is not null
        and nullif(trim(o.production_unit), '') is not null
    ), '[]'::jsonb)
  );
end;
$$;

create function public.carez_submit_public_vendor_quote_line(
  p_token uuid, p_output_id uuid, p_unit_cost numeric, p_source_reference text default null
)
returns boolean language plpgsql security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_token public.estimate_supplier_quote_access_tokens%rowtype;
  v_quote public.estimate_supplier_quotes%rowtype;
  v_set public.estimate_supplier_quote_sets%rowtype;
  v_estimate public.estimates%rowtype;
  v_output public.takeoff_measurement_outputs%rowtype;
  v_line_id uuid;
  v_prior_cost numeric;
begin
  if p_unit_cost is null or p_unit_cost < 0 or p_unit_cost > 1000000000 then
    raise exception 'Enter a valid unit price.';
  end if;
  if length(coalesce(p_source_reference, '')) > 250 then
    raise exception 'Reference is too long.';
  end if;
  select * into v_token from public.estimate_supplier_quote_access_tokens
    where token = p_token and revoked_at is null and expires_at > now()
    for update;
  if not found then return false; end if;
  select * into v_quote from public.estimate_supplier_quotes
    where id = v_token.quote_id and company_id = v_token.company_id for update;
  if not found or v_quote.status in ('declined', 'selected') then return false; end if;
  select * into v_set from public.estimate_supplier_quote_sets
    where id = v_quote.quote_set_id and company_id = v_token.company_id;
  if not found or v_set.status = 'archived' then return false; end if;
  select * into v_estimate from public.estimates
    where id = v_set.estimate_id and company_id = v_token.company_id for update;
  if not found or v_estimate.status in ('accepted', 'approved', 'superseded')
    or (v_quote.expires_at is not null and v_quote.expires_at < current_date)
    or exists (select 1 from public.proposal_presentations p
      where p.company_id = v_token.company_id and p.estimate_id = v_estimate.id)
  then return false; end if;
  select o.* into v_output from public.takeoff_measurement_outputs o
    join public.takeoff_measurements m
      on m.company_id = o.company_id and m.id = o.measurement_id
    join public.estimate_supplier_quote_access_items access_item
      on access_item.access_token_id = v_token.id and access_item.source_takeoff_output_id = o.id
    where o.id = p_output_id and o.company_id = v_token.company_id
      and m.estimate_id = v_estimate.id and m.status = 'active'
      and o.is_active = true and o.estimate_visible = true
      and o.estimate_item_type <> 'labor'
      and o.generated_estimate_item_id is not null
      and nullif(trim(o.production_unit), '') is not null
    for update of o;
  if not found then return false; end if;
  select quoted_unit_cost into v_prior_cost from public.estimate_supplier_quote_lines
    where company_id = v_token.company_id and quote_id = v_quote.id
      and source_takeoff_output_id = v_output.id
    order by created_at desc, id desc limit 1;
  -- Each submission is new evidence. Never rewrite a line the office may have selected.
  insert into public.estimate_supplier_quote_lines (
    company_id, quote_id, source_takeoff_output_id, generated_estimate_item_id,
    catalog_item_id, description, quoted_unit, quoted_unit_cost, source_reference
  ) values (
    v_token.company_id, v_quote.id, v_output.id, v_output.generated_estimate_item_id,
    v_output.catalog_item_id, coalesce(nullif(trim(v_output.label), ''), 'Supplier quoted resource'),
    v_output.production_unit, p_unit_cost, nullif(trim(p_source_reference), '')
  ) returning id into v_line_id;
  if v_quote.status = 'requested' then
    update public.estimate_supplier_quotes
      set status = 'received', updated_at = now()
      where id = v_quote.id and company_id = v_token.company_id;
  end if;
  insert into public.estimate_supplier_quote_submission_events (
    company_id, quote_id, access_token_id, quote_line_id,
    source_takeoff_output_id, output_label, prior_unit_cost, quoted_unit_cost
  ) values (
    v_token.company_id, v_quote.id, v_token.id, v_line_id,
    v_output.id, v_output.label, v_prior_cost, p_unit_cost
  );
  return true;
end;
$$;

revoke all on function public.carez_get_public_vendor_quote(uuid) from public;
revoke all on function public.carez_submit_public_vendor_quote_line(uuid, uuid, numeric, text) from public;
grant execute on function public.carez_get_public_vendor_quote(uuid) to anon, authenticated, service_role;
grant execute on function public.carez_submit_public_vendor_quote_line(uuid, uuid, numeric, text) to anon, authenticated, service_role;
