-- Carez Takeoff: confirmed PDF scale detection, manual fallback, and multi-scale regions.

alter table public.takeoff_sheets
  drop constraint if exists takeoff_sheets_scale_status_check;

alter table public.takeoff_sheets
  add constraint takeoff_sheets_scale_status_check
  check (scale_status in ('uncalibrated','calibrated','regional','not_required'));

create table if not exists public.takeoff_scale_regions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  takeoff_set_id uuid not null references public.takeoff_sets(id) on delete cascade,
  sheet_id uuid not null references public.takeoff_sheets(id) on delete cascade,
  name text not null,
  region_bounds jsonb,
  scale_label text not null,
  scale_kind text not null check (scale_kind in ('architectural','engineering','metric','manual')),
  source_type text not null check (source_type in ('pdf_text','manual','legacy')),
  source_text text,
  source_bounds jsonb,
  confidence numeric,
  calibration jsonb not null,
  is_default boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint takeoff_scale_regions_company_id_id_key unique(company_id,id),
  constraint takeoff_scale_regions_company_sheet_id_key unique(company_id,sheet_id,id),
  constraint takeoff_scale_regions_company_sheet_fk foreign key(company_id,takeoff_set_id,sheet_id) references public.takeoff_sheets(company_id,takeoff_set_id,id) on delete cascade,
  constraint takeoff_scale_regions_confidence_check check (confidence is null or (confidence >= 0 and confidence <= 1)),
  constraint takeoff_scale_regions_calibration_check check (
    jsonb_typeof(calibration)='object'
    and coalesce((calibration->>'ft_per_pdf_unit')::numeric,0)>0
  ),
  constraint takeoff_scale_regions_bounds_check check (
    region_bounds is null or (
      jsonb_typeof(region_bounds)='object'
      and coalesce((region_bounds->>'x')::numeric,-1)>=0
      and coalesce((region_bounds->>'y')::numeric,-1)>=0
      and coalesce((region_bounds->>'width')::numeric,0)>0
      and coalesce((region_bounds->>'height')::numeric,0)>0
      and coalesce((region_bounds->>'x')::numeric,0)+coalesce((region_bounds->>'width')::numeric,0)<=1.000001
      and coalesce((region_bounds->>'y')::numeric,0)+coalesce((region_bounds->>'height')::numeric,0)<=1.000001
    )
  )
);

create unique index if not exists takeoff_scale_regions_default_uq
  on public.takeoff_scale_regions(company_id,sheet_id)
  where is_default;
create index if not exists takeoff_scale_regions_sheet_idx
  on public.takeoff_scale_regions(company_id,sheet_id,is_default);
create index if not exists takeoff_scale_regions_set_idx
  on public.takeoff_scale_regions(company_id,takeoff_set_id);

drop trigger if exists carez_takeoff_scale_regions_touch on public.takeoff_scale_regions;
create trigger carez_takeoff_scale_regions_touch
before update on public.takeoff_scale_regions
for each row execute function public.carez_takeoff_touch_updated_at();

alter table public.takeoff_scale_regions enable row level security;

drop policy if exists "office can view takeoff scale regions" on public.takeoff_scale_regions;
create policy "office can view takeoff scale regions"
on public.takeoff_scale_regions for select to authenticated
using (company_id=public.get_my_company_id() and public.get_my_role()<>'employee');

drop policy if exists "office can insert takeoff scale regions" on public.takeoff_scale_regions;
create policy "office can insert takeoff scale regions"
on public.takeoff_scale_regions for insert to authenticated
with check (company_id=public.get_my_company_id() and public.get_my_role()<>'employee');

drop policy if exists "office can update takeoff scale regions" on public.takeoff_scale_regions;
create policy "office can update takeoff scale regions"
on public.takeoff_scale_regions for update to authenticated
using (company_id=public.get_my_company_id() and public.get_my_role()<>'employee')
with check (company_id=public.get_my_company_id() and public.get_my_role()<>'employee');

drop policy if exists "office can delete takeoff scale regions" on public.takeoff_scale_regions;
create policy "office can delete takeoff scale regions"
on public.takeoff_scale_regions for delete to authenticated
using (company_id=public.get_my_company_id() and public.get_my_role()<>'employee');

revoke all on table public.takeoff_scale_regions from public,anon;
grant select,insert,update,delete on table public.takeoff_scale_regions to authenticated;
grant all on table public.takeoff_scale_regions to service_role;

alter table public.takeoff_measurements
  add column if not exists scale_region_id uuid;

alter table public.takeoff_measurements
  drop constraint if exists takeoff_measurements_company_scale_region_fk;
alter table public.takeoff_measurements
  add constraint takeoff_measurements_company_scale_region_fk
  foreign key(company_id,scale_region_id)
  references public.takeoff_scale_regions(company_id,id)
  on delete restrict;

create index if not exists takeoff_measurements_scale_region_idx
  on public.takeoff_measurements(company_id,scale_region_id)
  where scale_region_id is not null;

create or replace function public.carez_geometry_within_scale_bounds(p_geometry jsonb,p_bounds jsonb)
returns boolean
language sql
immutable
security invoker
set search_path=public
as $$
  select case
    when p_bounds is null then true
    when p_geometry is null or jsonb_typeof(p_geometry)<>'object' then false
    else not exists(
      select 1
      from (
        select point.value as point
        from jsonb_array_elements(coalesce(p_geometry->'points','[]'::jsonb)) as point(value)
        union all
        select point.value
        from jsonb_array_elements(coalesce(p_geometry->'holes','[]'::jsonb)) as hole(value)
        cross join lateral jsonb_array_elements(hole.value) as point(value)
      ) q
      where coalesce((q.point->>'x')::numeric,-1) < coalesce((p_bounds->>'x')::numeric,0)-0.0005
         or coalesce((q.point->>'x')::numeric,2) > coalesce((p_bounds->>'x')::numeric,0)+coalesce((p_bounds->>'width')::numeric,0)+0.0005
         or coalesce((q.point->>'y')::numeric,-1) < coalesce((p_bounds->>'y')::numeric,0)-0.0005
         or coalesce((q.point->>'y')::numeric,2) > coalesce((p_bounds->>'y')::numeric,0)+coalesce((p_bounds->>'height')::numeric,0)+0.0005
    )
  end;
$$;
revoke all on function public.carez_geometry_within_scale_bounds(jsonb,jsonb) from public,anon;
grant execute on function public.carez_geometry_within_scale_bounds(jsonb,jsonb) to authenticated,service_role;

create or replace function public.carez_upsert_takeoff_scale_region(
  p_sheet_id uuid,
  p_region_id uuid,
  p_name text,
  p_region_bounds jsonb,
  p_scale_label text,
  p_scale_kind text,
  p_source_type text,
  p_source_text text,
  p_source_bounds jsonb,
  p_confidence numeric,
  p_calibration jsonb,
  p_is_default boolean
)
returns uuid
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_company uuid:=public.get_my_company_id();
  v_sheet public.takeoff_sheets%rowtype;
  v_estimate_id uuid;
  v_region_id uuid:=p_region_id;
begin
  if v_company is null or not exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role<>'employee') then
    raise exception 'Owner access required.';
  end if;

  select * into v_sheet
  from public.takeoff_sheets
  where id=p_sheet_id and company_id=v_company
  for update;
  if not found then raise exception 'Takeoff sheet not found.'; end if;

  select estimate_id into v_estimate_id
  from public.takeoff_sets
  where id=v_sheet.takeoff_set_id and company_id=v_company and status='active';
  if v_estimate_id is null then raise exception 'Active takeoff set not found.'; end if;
  if exists(select 1 from public.proposal_presentations where company_id=v_company and estimate_id=v_estimate_id)
     or exists(select 1 from public.estimates where id=v_estimate_id and company_id=v_company and status in ('accepted','approved','superseded')) then
    raise exception 'This estimate revision is locked.';
  end if;

  if coalesce(trim(p_name),'')='' or coalesce(trim(p_scale_label),'')='' then raise exception 'Scale region name and label are required.'; end if;
  if p_scale_kind not in ('architectural','engineering','metric','manual') then raise exception 'Scale kind is invalid.'; end if;
  if p_source_type not in ('pdf_text','manual','legacy') then raise exception 'Scale source is invalid.'; end if;
  if p_calibration is null or coalesce((p_calibration->>'ft_per_pdf_unit')::numeric,0)<=0 then raise exception 'Scale calibration is invalid.'; end if;
  if p_region_bounds is not null and (
      jsonb_typeof(p_region_bounds)<>'object'
      or coalesce((p_region_bounds->>'x')::numeric,-1)<0
      or coalesce((p_region_bounds->>'y')::numeric,-1)<0
      or coalesce((p_region_bounds->>'width')::numeric,0)<=0
      or coalesce((p_region_bounds->>'height')::numeric,0)<=0
      or coalesce((p_region_bounds->>'x')::numeric,0)+coalesce((p_region_bounds->>'width')::numeric,0)>1.000001
      or coalesce((p_region_bounds->>'y')::numeric,0)+coalesce((p_region_bounds->>'height')::numeric,0)>1.000001
    ) then raise exception 'Scale region bounds are invalid.'; end if;

  if coalesce(p_is_default,false) then
    if v_region_id is null then
      select id into v_region_id
      from public.takeoff_scale_regions
      where company_id=v_company and sheet_id=v_sheet.id and is_default
      order by created_at
      limit 1
      for update;
    end if;
    update public.takeoff_scale_regions
      set is_default=false
      where company_id=v_company and sheet_id=v_sheet.id and id is distinct from v_region_id and is_default;
  end if;

  if v_region_id is null then
    insert into public.takeoff_scale_regions(
      company_id,takeoff_set_id,sheet_id,name,region_bounds,scale_label,scale_kind,source_type,
      source_text,source_bounds,confidence,calibration,is_default,created_by
    ) values(
      v_company,v_sheet.takeoff_set_id,v_sheet.id,trim(p_name),p_region_bounds,trim(p_scale_label),p_scale_kind,p_source_type,
      nullif(trim(coalesce(p_source_text,'')),''),p_source_bounds,p_confidence,p_calibration,coalesce(p_is_default,false),(select auth.uid())
    ) returning id into v_region_id;
  else
    update public.takeoff_scale_regions set
      name=trim(p_name),region_bounds=p_region_bounds,scale_label=trim(p_scale_label),scale_kind=p_scale_kind,
      source_type=p_source_type,source_text=nullif(trim(coalesce(p_source_text,'')),''),source_bounds=p_source_bounds,
      confidence=p_confidence,calibration=p_calibration,is_default=coalesce(p_is_default,false),accepted_at=now(),updated_at=now()
    where id=v_region_id and company_id=v_company and sheet_id=v_sheet.id;
    if not found then raise exception 'Scale region not found.'; end if;
  end if;

  if coalesce(p_is_default,false) then
    update public.takeoff_sheets
      set scale_status='calibrated',calibration=p_calibration,updated_at=now()
      where id=v_sheet.id and company_id=v_company;
  elsif exists(select 1 from public.takeoff_scale_regions where company_id=v_company and sheet_id=v_sheet.id and is_default) then
    update public.takeoff_sheets set scale_status='calibrated',updated_at=now() where id=v_sheet.id and company_id=v_company;
  else
    update public.takeoff_sheets set scale_status='regional',calibration=null,updated_at=now() where id=v_sheet.id and company_id=v_company;
  end if;

  return v_region_id;
end;
$$;
revoke all on function public.carez_upsert_takeoff_scale_region(uuid,uuid,text,jsonb,text,text,text,text,jsonb,numeric,jsonb,boolean) from public,anon;
grant execute on function public.carez_upsert_takeoff_scale_region(uuid,uuid,text,jsonb,text,text,text,text,jsonb,numeric,jsonb,boolean) to authenticated,service_role;

create or replace function public.carez_delete_takeoff_scale_region(p_region_id uuid)
returns void
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_company uuid:=public.get_my_company_id();
  v_region public.takeoff_scale_regions%rowtype;
  v_estimate_id uuid;
  v_default public.takeoff_scale_regions%rowtype;
begin
  if v_company is null or not exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role<>'employee') then
    raise exception 'Owner access required.';
  end if;
  select * into v_region from public.takeoff_scale_regions where id=p_region_id and company_id=v_company for update;
  if not found then raise exception 'Scale region not found.'; end if;
  select estimate_id into v_estimate_id from public.takeoff_sets where id=v_region.takeoff_set_id and company_id=v_company and status='active';
  if v_estimate_id is null then raise exception 'Active takeoff set not found.'; end if;
  if exists(select 1 from public.proposal_presentations where company_id=v_company and estimate_id=v_estimate_id)
     or exists(select 1 from public.estimates where id=v_estimate_id and company_id=v_company and status in ('accepted','approved','superseded')) then
    raise exception 'This estimate revision is locked.';
  end if;
  if exists(select 1 from public.takeoff_measurements where company_id=v_company and scale_region_id=v_region.id) then
    raise exception 'This scale region is used by takeoff measurements and cannot be removed.';
  end if;
  delete from public.takeoff_scale_regions where id=v_region.id and company_id=v_company;
  select * into v_default from public.takeoff_scale_regions where company_id=v_company and sheet_id=v_region.sheet_id and is_default limit 1;
  if v_default.id is not null then
    update public.takeoff_sheets set scale_status='calibrated',calibration=v_default.calibration,updated_at=now() where id=v_region.sheet_id and company_id=v_company;
  elsif exists(select 1 from public.takeoff_scale_regions where company_id=v_company and sheet_id=v_region.sheet_id) then
    update public.takeoff_sheets set scale_status='regional',calibration=null,updated_at=now() where id=v_region.sheet_id and company_id=v_company;
  else
    update public.takeoff_sheets set scale_status='uncalibrated',calibration=null,updated_at=now() where id=v_region.sheet_id and company_id=v_company;
  end if;
end;
$$;
revoke all on function public.carez_delete_takeoff_scale_region(uuid) from public,anon;
grant execute on function public.carez_delete_takeoff_scale_region(uuid) to authenticated,service_role;

insert into public.takeoff_scale_regions(
  company_id,takeoff_set_id,sheet_id,name,region_bounds,scale_label,scale_kind,source_type,
  source_text,source_bounds,confidence,calibration,is_default,created_by,accepted_at,created_at,updated_at
)
select
  s.company_id,s.takeoff_set_id,s.id,
  coalesce(nullif(trim(s.sheet_number),''),concat('Page ',s.page_number))||' Scale',
  null,
  coalesce(nullif(s.calibration->>'scale_label',''),concat(coalesce(s.calibration->>'known_distance_ft','?'),' FT manual calibration')),
  'manual','legacy',null,null,null,
  s.calibration||jsonb_build_object(
    'ft_per_pdf_unit',coalesce(
      (s.calibration->>'ft_per_pdf_unit')::numeric,
      (s.calibration->>'known_distance_ft')::numeric/nullif((s.calibration->>'pdf_distance')::numeric,0)
    ),
    'method',coalesce(nullif(s.calibration->>'method',''),'legacy'),
    'scale_label',coalesce(nullif(s.calibration->>'scale_label',''),concat(coalesce(s.calibration->>'known_distance_ft','?'),' FT manual calibration'))
  ),
  true,null,
  coalesce((s.calibration->>'calibrated_at')::timestamptz,now()),s.created_at,s.updated_at
from public.takeoff_sheets s
where s.scale_status='calibrated'
  and s.calibration is not null
  and coalesce((s.calibration->>'ft_per_pdf_unit')::numeric,
               (s.calibration->>'known_distance_ft')::numeric/nullif((s.calibration->>'pdf_distance')::numeric,0),0)>0
  and not exists(select 1 from public.takeoff_scale_regions r where r.company_id=s.company_id and r.sheet_id=s.id and r.is_default);

update public.takeoff_measurements m
set scale_region_id=r.id
from public.takeoff_scale_regions r
where m.company_id=r.company_id
  and m.sheet_id=r.sheet_id
  and m.scale_region_id is null
  and m.source='drawing'
  and r.is_default;

drop function if exists public.carez_commit_drawing_measurement(uuid,uuid,uuid,uuid,text,text,text,text,numeric,text,jsonb,text,jsonb,jsonb);
create function public.carez_commit_drawing_measurement(
  p_takeoff_set_id uuid,
  p_sheet_id uuid,
  p_estimate_section_id uuid,
  p_assembly_version_id uuid,
  p_name text,
  p_location text,
  p_drawing_reference text,
  p_measurement_type text,
  p_raw_quantity numeric,
  p_raw_unit text,
  p_variables jsonb,
  p_risk_class_code text,
  p_geometry jsonb,
  p_outputs jsonb,
  p_scale_region_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_company_id uuid:=public.get_my_company_id();
  v_measurement_id uuid;
  v_scale_region public.takeoff_scale_regions%rowtype;
begin
  if v_company_id is null or not exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role<>'employee') then raise exception 'Owner access required.'; end if;
  if p_sheet_id is null or not exists(select 1 from public.takeoff_sheets s where s.id=p_sheet_id and s.company_id=v_company_id and s.takeoff_set_id=p_takeoff_set_id) then raise exception 'Drawing sheet does not belong to this takeoff set.'; end if;
  if p_geometry is null or jsonb_typeof(p_geometry)<>'object' then raise exception 'Drawing geometry is required.'; end if;

  if p_measurement_type<>'count' then
    if p_scale_region_id is null then
      select id into p_scale_region_id from public.takeoff_scale_regions where company_id=v_company_id and sheet_id=p_sheet_id and is_default limit 1;
    end if;
    select * into v_scale_region from public.takeoff_scale_regions where id=p_scale_region_id and company_id=v_company_id and sheet_id=p_sheet_id;
    if v_scale_region.id is null then raise exception 'An accepted scale region is required for LF or SF takeoff.'; end if;
    if not public.carez_geometry_within_scale_bounds(p_geometry,v_scale_region.region_bounds) then raise exception 'Takeoff geometry must stay inside one accepted scale region.'; end if;
  end if;

  v_measurement_id:=public.carez_commit_takeoff_measurement(
    p_takeoff_set_id,p_estimate_section_id,p_assembly_version_id,p_name,p_location,p_drawing_reference,
    p_measurement_type,p_raw_quantity,p_raw_unit,p_variables,p_risk_class_code,p_outputs
  );
  update public.takeoff_measurements
    set sheet_id=p_sheet_id,geometry=p_geometry,source='drawing',scale_region_id=case when p_measurement_type='count' then null else p_scale_region_id end
    where id=v_measurement_id and company_id=v_company_id;
  return v_measurement_id;
end;
$$;
revoke all on function public.carez_commit_drawing_measurement(uuid,uuid,uuid,uuid,text,text,text,text,numeric,text,jsonb,text,jsonb,jsonb,uuid) from public,anon;
grant execute on function public.carez_commit_drawing_measurement(uuid,uuid,uuid,uuid,text,text,text,text,numeric,text,jsonb,text,jsonb,jsonb,uuid) to authenticated,service_role;

drop function if exists public.carez_update_drawing_measurement(uuid,jsonb,numeric,text,jsonb,jsonb);
create function public.carez_update_drawing_measurement(
  p_measurement_id uuid,
  p_geometry jsonb,
  p_raw_quantity numeric,
  p_raw_unit text,
  p_variables jsonb,
  p_outputs jsonb,
  p_scale_region_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_company uuid:=public.get_my_company_id();
  v_measurement public.takeoff_measurements%rowtype;
  v_status text;
  v_scale_region public.takeoff_scale_regions%rowtype;
  v_scale_region_id uuid;
begin
  if v_company is null or not exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role<>'employee') then raise exception 'Owner access required.'; end if;
  select * into v_measurement from public.takeoff_measurements where id=p_measurement_id and company_id=v_company for update;
  if not found then raise exception 'Takeoff measurement not found.'; end if;
  if v_measurement.source<>'drawing' or v_measurement.sheet_id is null then raise exception 'Only drawing takeoff geometry can be edited here.'; end if;
  select status into v_status from public.estimates where id=v_measurement.estimate_id and company_id=v_company;
  if v_status in ('accepted','approved','superseded') or exists(select 1 from public.proposal_presentations p where p.company_id=v_company and p.estimate_id=v_measurement.estimate_id) then raise exception 'This estimate revision is locked.'; end if;
  if p_geometry is null or jsonb_typeof(p_geometry)<>'object' then raise exception 'Drawing geometry is required.'; end if;
  if p_raw_quantity<0 then raise exception 'Takeoff quantity cannot be negative.'; end if;

  v_scale_region_id:=coalesce(p_scale_region_id,v_measurement.scale_region_id);
  if p_raw_unit<>'EA' then
    if v_scale_region_id is null then select id into v_scale_region_id from public.takeoff_scale_regions where company_id=v_company and sheet_id=v_measurement.sheet_id and is_default limit 1; end if;
    select * into v_scale_region from public.takeoff_scale_regions where id=v_scale_region_id and company_id=v_company and sheet_id=v_measurement.sheet_id;
    if v_scale_region.id is null then raise exception 'An accepted scale region is required for LF or SF takeoff.'; end if;
    if not public.carez_geometry_within_scale_bounds(p_geometry,v_scale_region.region_bounds) then raise exception 'Takeoff geometry must stay inside one accepted scale region.'; end if;
  else
    v_scale_region_id:=null;
  end if;

  update public.takeoff_measurements
    set raw_quantity=p_raw_quantity,raw_unit=p_raw_unit,variables=coalesce(p_variables,'{}'::jsonb),geometry=p_geometry,
        scale_region_id=v_scale_region_id,updated_at=now()
    where id=v_measurement.id and company_id=v_company;
  perform public.carez_sync_takeoff_measurement_outputs(v_measurement.id,p_outputs);
  return v_measurement.id;
end;
$$;
revoke all on function public.carez_update_drawing_measurement(uuid,jsonb,numeric,text,jsonb,jsonb,uuid) from public,anon;
grant execute on function public.carez_update_drawing_measurement(uuid,jsonb,numeric,text,jsonb,jsonb,uuid) to authenticated,service_role;


create or replace function public.carez_save_takeoff_sheet_calibration(p_sheet_id uuid,p_page_width numeric,p_page_height numeric,p_calibration jsonb)
returns void
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_company_id uuid:=public.get_my_company_id();
  v_sheet public.takeoff_sheets%rowtype;
  v_region_id uuid;
begin
  if v_company_id is null or not exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role<>'employee') then raise exception 'Owner access required.'; end if;
  select * into v_sheet from public.takeoff_sheets where id=p_sheet_id and company_id=v_company_id;
  if not found then raise exception 'Takeoff sheet not found.'; end if;
  if p_page_width<=0 or p_page_height<=0 then raise exception 'PDF page dimensions are invalid.'; end if;
  if p_calibration is null or coalesce((p_calibration->>'ft_per_pdf_unit')::numeric,
      (p_calibration->>'known_distance_ft')::numeric/nullif((p_calibration->>'pdf_distance')::numeric,0),0)<=0 then
    raise exception 'Calibration requires a known real distance and two distinct drawing points.';
  end if;
  update public.takeoff_sheets set page_width=p_page_width,page_height=p_page_height where id=p_sheet_id and company_id=v_company_id;
  v_region_id:=public.carez_upsert_takeoff_scale_region(
    p_sheet_id,null,
    coalesce(nullif(trim(v_sheet.sheet_number),''),concat('Page ',v_sheet.page_number))||' Scale',
    null,
    coalesce(nullif(p_calibration->>'scale_label',''),concat(coalesce(p_calibration->>'known_distance_ft','?'),' FT manual calibration')),
    'manual','manual',null,null,null,
    p_calibration||jsonb_build_object(
      'method',coalesce(nullif(p_calibration->>'method',''),'manual'),
      'scale_label',coalesce(nullif(p_calibration->>'scale_label',''),concat(coalesce(p_calibration->>'known_distance_ft','?'),' FT manual calibration'))
    ),true
  );
end;
$$;
revoke all on function public.carez_save_takeoff_sheet_calibration(uuid,numeric,numeric,jsonb) from public,anon;
grant execute on function public.carez_save_takeoff_sheet_calibration(uuid,numeric,numeric,jsonb) to authenticated,service_role;
