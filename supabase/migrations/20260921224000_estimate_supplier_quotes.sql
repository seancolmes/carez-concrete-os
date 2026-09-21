-- P1.2 Estimate-scoped supplier quote sets and pricing coverage.
-- Supplier pricing is commercial evidence only; authoritative Takeoff production quantity is never authored here.

create unique index if not exists estimates_company_id_id_uidx
  on public.estimates(company_id,id);

create table if not exists public.estimate_supplier_quote_sets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  estimate_id uuid not null,
  name text not null check (length(trim(name)) > 0),
  bid_zone text,
  scope_note text,
  status text not null default 'draft'
    check (status in ('draft','complete','archived')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint estimate_supplier_quote_sets_company_id_id_key unique(company_id,id),
  constraint estimate_supplier_quote_sets_estimate_company_fk
    foreign key (company_id,estimate_id)
    references public.estimates(company_id,id)
    on delete cascade
);

create table if not exists public.estimate_supplier_quotes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  quote_set_id uuid not null,
  supplier_name text not null check (length(trim(supplier_name)) > 0),
  vendor_id uuid,
  supplier_quote_number text,
  quote_date date not null default current_date,
  expires_at date,
  status text not null default 'requested'
    check (status in ('requested','received','declined','selected')),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint estimate_supplier_quotes_company_id_id_key unique(company_id,id),
  constraint estimate_supplier_quotes_set_company_fk
    foreign key (company_id,quote_set_id)
    references public.estimate_supplier_quote_sets(company_id,id)
    on delete cascade,
  constraint estimate_supplier_quotes_expiry_check
    check (expires_at is null or expires_at >= quote_date)
);

create table if not exists public.estimate_supplier_quote_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  quote_id uuid not null,
  source_takeoff_output_id uuid not null references public.takeoff_measurement_outputs(id) on delete cascade,
  generated_estimate_item_id uuid references public.estimate_items(id) on delete set null,
  catalog_item_id uuid references public.cost_catalog_items(id) on delete set null,
  description text not null check (length(trim(description)) > 0),
  quoted_unit text not null check (length(trim(quoted_unit)) > 0),
  quoted_unit_cost numeric not null check (quoted_unit_cost >= 0),
  freight_tax_fee_notes text,
  source_reference text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint estimate_supplier_quote_lines_quote_company_fk
    foreign key (company_id,quote_id)
    references public.estimate_supplier_quotes(company_id,id)
    on delete cascade
);

create index if not exists estimate_supplier_quote_sets_estimate_idx
  on public.estimate_supplier_quote_sets(company_id,estimate_id,status,created_at desc);
create index if not exists estimate_supplier_quotes_set_idx
  on public.estimate_supplier_quotes(company_id,quote_set_id,status,expires_at);
create index if not exists estimate_supplier_quote_lines_quote_idx
  on public.estimate_supplier_quote_lines(company_id,quote_id);
create index if not exists estimate_supplier_quote_lines_output_idx
  on public.estimate_supplier_quote_lines(company_id,source_takeoff_output_id);
create index if not exists estimate_supplier_quote_lines_item_idx
  on public.estimate_supplier_quote_lines(generated_estimate_item_id)
  where generated_estimate_item_id is not null;
create index if not exists estimate_supplier_quote_lines_catalog_idx
  on public.estimate_supplier_quote_lines(catalog_item_id)
  where catalog_item_id is not null;
create index if not exists estimate_supplier_quote_sets_created_by_idx
  on public.estimate_supplier_quote_sets(created_by)
  where created_by is not null;
create index if not exists estimate_supplier_quotes_created_by_idx
  on public.estimate_supplier_quotes(created_by)
  where created_by is not null;
create index if not exists estimate_supplier_quote_lines_created_by_idx
  on public.estimate_supplier_quote_lines(created_by)
  where created_by is not null;

create or replace function public.carez_validate_estimate_supplier_quote_line()
returns trigger
language plpgsql
security invoker
set search_path=public
as $function$
declare
  v_quote_estimate_id uuid;
  v_output_estimate_id uuid;
  v_output_item_id uuid;
  v_output_type text;
begin
  select quote_set.estimate_id
    into v_quote_estimate_id
  from public.estimate_supplier_quotes quote
  join public.estimate_supplier_quote_sets quote_set
    on quote_set.company_id=quote.company_id
   and quote_set.id=quote.quote_set_id
  where quote.company_id=new.company_id
    and quote.id=new.quote_id;

  if v_quote_estimate_id is null then
    raise exception 'Supplier quote is not available to this company.';
  end if;

  select measurement.estimate_id, output.generated_estimate_item_id, output.estimate_item_type
    into v_output_estimate_id, v_output_item_id, v_output_type
  from public.takeoff_measurement_outputs output
  join public.takeoff_measurements measurement
    on measurement.company_id=output.company_id
   and measurement.id=output.measurement_id
  where output.company_id=new.company_id
    and output.id=new.source_takeoff_output_id;

  if v_output_estimate_id is null then
    raise exception 'Takeoff output is not available to this company.';
  end if;
  if v_quote_estimate_id<>v_output_estimate_id then
    raise exception 'Quote line does not belong to this estimate.';
  end if;
  if v_output_type='labor' then
    raise exception 'Supplier quote lines cannot target labor outputs.';
  end if;

  if new.generated_estimate_item_id is not null then
    if new.generated_estimate_item_id is distinct from v_output_item_id
       or not exists(
         select 1
         from public.estimate_items item
         where item.company_id=new.company_id
           and item.id=new.generated_estimate_item_id
           and item.estimate_id=v_quote_estimate_id
           and item.source_takeoff_output_id=new.source_takeoff_output_id
       ) then
      raise exception 'Generated Estimate item does not match the quoted Takeoff output.';
    end if;
  end if;

  if new.catalog_item_id is not null
     and not exists(
       select 1 from public.cost_catalog_items catalog
       where catalog.company_id=new.company_id and catalog.id=new.catalog_item_id
     ) then
    raise exception 'Catalog item is not available to this company.';
  end if;

  return new;
end;
$function$;

drop trigger if exists validate_estimate_supplier_quote_line on public.estimate_supplier_quote_lines;
create trigger validate_estimate_supplier_quote_line
before insert or update of company_id,quote_id,source_takeoff_output_id,generated_estimate_item_id,catalog_item_id
on public.estimate_supplier_quote_lines
for each row execute function public.carez_validate_estimate_supplier_quote_line();

alter table public.estimate_supplier_quote_sets enable row level security;
alter table public.estimate_supplier_quotes enable row level security;
alter table public.estimate_supplier_quote_lines enable row level security;

create policy "office access estimate_supplier_quote_sets"
on public.estimate_supplier_quote_sets
for all to authenticated
using (
  company_id=(select public.get_my_company_id())
  and (select public.get_my_role())<>'employee'
)
with check (
  company_id=(select public.get_my_company_id())
  and (select public.get_my_role())<>'employee'
);

create policy "office access estimate_supplier_quotes"
on public.estimate_supplier_quotes
for all to authenticated
using (
  company_id=(select public.get_my_company_id())
  and (select public.get_my_role())<>'employee'
)
with check (
  company_id=(select public.get_my_company_id())
  and (select public.get_my_role())<>'employee'
);

create policy "office access estimate_supplier_quote_lines"
on public.estimate_supplier_quote_lines
for all to authenticated
using (
  company_id=(select public.get_my_company_id())
  and (select public.get_my_role())<>'employee'
)
with check (
  company_id=(select public.get_my_company_id())
  and (select public.get_my_role())<>'employee'
);

grant select,insert,update,delete on public.estimate_supplier_quote_sets to authenticated;
grant select,insert,update,delete on public.estimate_supplier_quotes to authenticated;
grant select,insert,update,delete on public.estimate_supplier_quote_lines to authenticated;
grant all on public.estimate_supplier_quote_sets to service_role;
grant all on public.estimate_supplier_quotes to service_role;
grant all on public.estimate_supplier_quote_lines to service_role;
revoke all on public.estimate_supplier_quote_sets from anon;
revoke all on public.estimate_supplier_quotes from anon;
revoke all on public.estimate_supplier_quote_lines from anon;

create or replace function public.carez_select_estimate_supplier_quote_line(p_quote_line_id uuid)
returns void
language plpgsql
security invoker
set search_path=public
as $function$
declare
  v_company_id uuid:=public.get_my_company_id();
  v_line public.estimate_supplier_quote_lines%rowtype;
  v_quote public.estimate_supplier_quotes%rowtype;
  v_quote_set public.estimate_supplier_quote_sets%rowtype;
  v_estimate public.estimates%rowtype;
  v_output public.takeoff_measurement_outputs%rowtype;
  v_measurement public.takeoff_measurements%rowtype;
  v_item public.estimate_items%rowtype;
  v_condition_output_count integer;
  v_new_cost numeric;
  v_reference text;
  v_selected_at timestamptz:=now();
begin
  if v_company_id is null or public.get_my_role()='employee' then
    raise exception 'Owner access required.';
  end if;

  select * into v_line
  from public.estimate_supplier_quote_lines
  where id=p_quote_line_id and company_id=v_company_id
  for update;
  if not found then raise exception 'Supplier quote line not found.'; end if;

  select * into v_quote
  from public.estimate_supplier_quotes
  where id=v_line.quote_id and company_id=v_company_id
  for update;
  if not found then raise exception 'Supplier quote not found.'; end if;

  select * into v_quote_set
  from public.estimate_supplier_quote_sets
  where id=v_quote.quote_set_id and company_id=v_company_id
  for update;
  if not found then raise exception 'Supplier quote set not found.'; end if;

  select * into v_estimate
  from public.estimates
  where id=v_quote_set.estimate_id and company_id=v_company_id
  for update;
  if not found then raise exception 'Estimate not found.'; end if;

  if v_estimate.status in ('accepted','approved','superseded')
     or exists(
       select 1 from public.proposal_presentations
       where company_id=v_company_id and estimate_id=v_estimate.id
     ) then
    raise exception 'This estimate revision is locked.';
  end if;
  if v_quote_set.status='archived' then
    raise exception 'Archived supplier quote sets cannot be selected.';
  end if;
  if v_quote.status='declined' then
    raise exception 'Declined supplier quotes cannot be selected.';
  end if;
  if v_quote.expires_at is not null and v_quote.expires_at<current_date then
    raise exception 'Supplier quote has expired.';
  end if;

  select * into v_output
  from public.takeoff_measurement_outputs
  where id=v_line.source_takeoff_output_id
    and company_id=v_company_id
    and is_active=true
    and estimate_visible=true
  for update;
  if not found then raise exception 'Quoted Takeoff output not found.'; end if;

  select * into v_measurement
  from public.takeoff_measurements
  where id=v_output.measurement_id and company_id=v_company_id
  for update;
  if not found or v_measurement.estimate_id<>v_quote_set.estimate_id then
    raise exception 'Quote line does not belong to this estimate.';
  end if;

  if v_output.estimate_item_type='labor' then
    raise exception 'Supplier quote selection does not apply to labor outputs.';
  end if;
  if upper(trim(v_line.quoted_unit))<>upper(trim(v_output.production_unit)) then
    raise exception 'Quoted unit must match authoritative output pricing unit.';
  end if;
  if v_output.generated_estimate_item_id is null then
    raise exception 'Generated Estimate item is missing for this Takeoff output.';
  end if;
  if v_line.generated_estimate_item_id is not null
     and v_line.generated_estimate_item_id<>v_output.generated_estimate_item_id then
    raise exception 'Quote line generated Estimate item does not match the Takeoff output.';
  end if;

  select * into v_item
  from public.estimate_items
  where id=v_output.generated_estimate_item_id
    and company_id=v_company_id
  for update;
  if not found
     or v_item.estimate_id<>v_quote_set.estimate_id
     or v_item.source_takeoff_output_id is distinct from v_output.id then
    raise exception 'Generated Estimate item does not belong to this estimate.';
  end if;

  if exists(
    select 1
    from public.project_condition_outputs condition_output
    join public.project_concrete_condition_versions condition_version
      on condition_version.company_id=condition_output.company_id
     and condition_version.id=condition_output.condition_version_id
    where condition_output.company_id=v_company_id
      and condition_output.legacy_takeoff_output_id=v_output.id
      and condition_version.status='verified'
  ) then
    raise exception 'Verified Project Concrete Condition pricing is immutable. Create a new Condition revision before selecting a supplier quote.';
  end if;

  select count(*) into v_condition_output_count
  from public.project_condition_outputs
  where company_id=v_company_id and legacy_takeoff_output_id=v_output.id;
  if v_condition_output_count>1 then
    raise exception 'Takeoff output is linked to multiple Project Condition outputs. Reconcile lineage before changing price.';
  end if;

  v_new_cost:=round(coalesce(v_output.production_quantity,0)*v_line.quoted_unit_cost,2);
  v_reference:=coalesce(
    nullif(trim(v_line.source_reference),''),
    nullif(trim(v_quote.supplier_quote_number),'')
  );

  update public.takeoff_measurement_outputs
  set unit_cost=v_line.quoted_unit_cost,
      direct_cost=v_new_cost,
      pricing_status='priced',
      cost_source='supplier quote: '||v_quote.supplier_name,
      price_source_kind='supplier_quote',
      price_source_id=p_quote_line_id,
      price_source_label=v_quote.supplier_name,
      price_source_reference=v_reference,
      price_effective_date=v_quote.quote_date,
      price_override_by=null,
      price_override_at=null,
      updated_at=v_selected_at
  where id=v_output.id and company_id=v_company_id;

  update public.estimate_items
  set unit_cost=v_line.quoted_unit_cost,
      direct_cost=v_new_cost,
      price_source_kind='supplier_quote',
      price_source_id=p_quote_line_id,
      price_source_label=v_quote.supplier_name,
      price_source_reference=v_reference,
      price_effective_date=v_quote.quote_date,
      price_override_by=null,
      price_override_at=null,
      updated_at=v_selected_at
  where id=v_item.id and company_id=v_company_id;

  if v_condition_output_count=1 then
    perform set_config('carez.project_condition_commit','1',true);
    update public.project_condition_outputs condition_output
    set unit_cost=v_line.quoted_unit_cost,
        direct_cost=v_new_cost,
        pricing_status='priced',
        generated_estimate_item_id=coalesce(v_output.generated_estimate_item_id,condition_output.generated_estimate_item_id),
        provenance=coalesce(condition_output.provenance,'{}'::jsonb) || jsonb_build_object(
          'pricing',
          jsonb_strip_nulls(jsonb_build_object(
            'mode','source_selection',
            'source_kind','supplier_quote',
            'source_id',p_quote_line_id,
            'source_label',v_quote.supplier_name,
            'source_reference',v_reference,
            'effective_date',v_quote.quote_date,
            'expires_at',v_quote.expires_at,
            'updated_by',auth.uid(),
            'updated_at',v_selected_at
          ))
        ),
        updated_at=v_selected_at
    where condition_output.company_id=v_company_id
      and condition_output.legacy_takeoff_output_id=v_output.id
      and exists(
        select 1
        from public.project_concrete_condition_versions condition_version
        where condition_version.company_id=v_company_id
          and condition_version.id=condition_output.condition_version_id
          and condition_version.status='draft'
      );
  end if;

  update public.estimate_supplier_quotes
  set status='selected',updated_at=v_selected_at
  where id=v_quote.id and company_id=v_company_id;
end;
$function$;

revoke all on function public.carez_validate_estimate_supplier_quote_line() from public,anon;
revoke all on function public.carez_select_estimate_supplier_quote_line(uuid) from public,anon;
grant execute on function public.carez_select_estimate_supplier_quote_line(uuid) to authenticated,service_role;
