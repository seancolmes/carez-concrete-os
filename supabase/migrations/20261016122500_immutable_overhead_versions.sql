-- Additive union of canonical and recorded production shapes. Existing amounts,
-- IDs and consumer foreign keys are retained; new captures are immutable versions.
alter table public.overhead_rate_snapshots add column if not exists annual_overhead numeric(12,2);
alter table public.overhead_rate_snapshots add column if not exists planned_productive_hours numeric(10,2);
alter table public.overhead_rate_snapshots add column if not exists source text;
alter table public.overhead_rate_snapshots add column if not exists source_type text;
alter table public.overhead_rate_snapshots add column if not exists source_label text;
alter table public.overhead_rate_snapshots add column if not exists notes text;
alter table public.overhead_rate_snapshots add column if not exists created_by uuid references public.profiles(id);
alter table public.overhead_rate_snapshots add column if not exists updated_at timestamptz not null default now();
alter table public.overhead_rate_snapshots add column if not exists captured_at timestamptz;
alter table public.overhead_rate_snapshots alter column captured_at set default clock_timestamp();
alter table public.overhead_rate_snapshots add column if not exists inputs_hash text;
alter table public.overhead_rate_snapshots add column if not exists calculation_inputs jsonb;
-- Recovered provenance describes recorded rows; it does not recompute their money.
alter table public.overhead_rate_snapshots drop constraint if exists overhead_rate_snapshots_source_type_check;
update public.overhead_rate_snapshots set source_type=case when source='company_plan' then 'configured' else 'legacy_unverified' end where source_type is null;
alter table public.overhead_rate_snapshots add constraint overhead_rate_snapshots_source_type_check check(source_type in ('configured','unconfigured_zero','legacy_unverified'));
update public.overhead_rate_snapshots set source_label=case when source_type='configured' then 'Recovered recorded overhead snapshot' when source_type='unconfigured_zero' then 'Legacy unconfigured basis; not a configured zero' else 'Legacy source requires review' end where source_label is null;
alter table public.overhead_rate_snapshots drop constraint if exists overhead_rate_snapshots_company_id_effective_date_key;
create unique index overhead_snapshot_input_version on public.overhead_rate_snapshots(company_id,effective_date,inputs_hash);

create function public.carez_capture_company_overhead(p_company_id uuid,p_effective_date date) returns public.overhead_rate_snapshots language plpgsql security invoker set search_path=pg_catalog,public,extensions as $$
declare v_company public.companies%rowtype;v_inputs jsonb;v_hash text;v_regular numeric;v_management numeric;v_annual numeric;v_today date;v_result public.overhead_rate_snapshots%rowtype;
begin
 if p_company_id is null or p_effective_date is null then raise exception 'Company and effective date are required.';end if;
 select * into v_company from public.companies where id=p_company_id for share;
 if not found then raise exception 'Company plan unavailable.';end if;
 v_today:=(now() at time zone coalesce(to_jsonb(v_company)->>'work_timezone','UTC'))::date;
 if p_effective_date<v_today then
  select * into v_result from public.overhead_rate_snapshots where company_id=p_company_id and effective_date<=p_effective_date and source_type='configured' order by effective_date desc,coalesce(captured_at,created_at) desc,id desc limit 1;
  if not found then raise exception 'Historical configured overhead basis unavailable. Current assumptions cannot be backdated automatically.';end if;return v_result;
 end if;
 if v_company.planned_productive_hours_annual is null or v_company.planned_productive_hours_annual<=0 or v_company.owner_compensation_target_annual is null or v_company.owner_planned_field_hours_annual is null or v_company.owner_field_rate is null
  or exists(select 1 from unnest(array[v_company.planned_productive_hours_annual,v_company.owner_compensation_target_annual,v_company.owner_planned_field_hours_annual,v_company.owner_field_rate]) n where n<0 or n::text in ('NaN','Infinity','-Infinity')) then raise exception 'Configure the complete business and owner plan before using overhead recovery.';end if;
 if exists(select 1 from public.overhead_items where company_id=p_company_id and active and (amount is null or amount<0 or amount::text in ('NaN','Infinity','-Infinity') or business_use_percent is null or business_use_percent not between 0 and 100 or frequency is null or frequency not in ('weekly','monthly','quarterly','annual'))) then raise exception 'An active overhead item has missing or invalid inputs.';end if;
 select coalesce(sum(amount*case frequency when 'weekly' then 52 when 'quarterly' then 4 when 'annual' then 1 when 'monthly' then 12 end*business_use_percent/100),0),
  coalesce(jsonb_agg(jsonb_build_object('id',id,'amount',amount,'frequency',frequency,'business_use_percent',business_use_percent) order by id),'[]'::jsonb)
 into v_regular,v_inputs from public.overhead_items where company_id=p_company_id and active;
 v_management:=greatest(v_company.owner_compensation_target_annual-v_company.owner_planned_field_hours_annual*v_company.owner_field_rate,0);
 v_annual:=v_regular+v_management;
 v_inputs:=jsonb_build_object('method','productive_hour_v2','plan_revision',v_company.plan_revision,'owner_compensation',v_company.owner_compensation_target_annual,'owner_field_hours',v_company.owner_planned_field_hours_annual,'owner_field_rate',v_company.owner_field_rate,'productive_hours',v_company.planned_productive_hours_annual,'items',v_inputs);
 v_hash:=encode(extensions.digest(v_inputs::text,'sha256'),'hex');
 insert into public.overhead_rate_snapshots(company_id,effective_date,annual_overhead,planned_productive_hours,overhead_rate_per_productive_hour,source,source_type,source_label,notes,created_by,inputs_hash,calculation_inputs)
 values(p_company_id,v_today,round(v_annual,2),v_company.planned_productive_hours_annual,round(v_annual/v_company.planned_productive_hours_annual,4),'company_plan_v2','configured','Recorded business plan and overhead items','Immutable input version; payroll burden remains separate.',auth.uid(),v_hash,v_inputs)
 on conflict(company_id,effective_date,inputs_hash) do nothing returning * into v_result;
 if v_result.id is null then select * into v_result from public.overhead_rate_snapshots where company_id=p_company_id and effective_date=v_today and inputs_hash=v_hash;end if;
 if v_result.id is null then raise exception 'No overhead snapshot was confirmed.';end if;return v_result;
end $$;
revoke all on function public.carez_capture_company_overhead(uuid,date) from public,anon,authenticated;

create function public.carez_capture_overhead_v2(p_effective_date date default current_date) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare v_company uuid;v_role text;v_snapshot public.overhead_rate_snapshots%rowtype;
begin
 select company_id,role into v_company,v_role from public.profiles where id=auth.uid();
 if v_company is null or v_role not in ('owner','office') then raise exception 'Owner or office access required.';end if;
 v_snapshot:=public.carez_capture_company_overhead(v_company,p_effective_date);return to_jsonb(v_snapshot);
end $$;
revoke all on function public.carez_capture_overhead_v2(date) from public,anon;grant execute on function public.carez_capture_overhead_v2(date) to authenticated;

-- Preserve BOTH established v1 return signatures without dropping dependencies.
do $compat$ declare v_result text:=pg_get_function_result('public.capture_overhead_rate_snapshot(date)'::regprocedure);begin
 if v_result ilike 'TABLE(%' then
  execute $ddl$create or replace function public.capture_overhead_rate_snapshot(p_effective_date date default current_date)
   returns table(id uuid,effective_date date,overhead_rate_per_productive_hour numeric,source_type text,source_label text,notes text)
   language plpgsql security invoker set search_path=pg_catalog,public as $body$declare v_id uuid;begin
    v_id:=(public.carez_capture_overhead_v2(p_effective_date)->>'id')::uuid;
    return query select s.id,s.effective_date,s.overhead_rate_per_productive_hour,s.source_type,s.source_label,s.notes from public.overhead_rate_snapshots s where s.id=v_id;
   end $body$$ddl$;
 elsif 'public.capture_overhead_rate_snapshot(date)'::regprocedure::oid in(select oid from pg_proc where prorettype='public.overhead_rate_snapshots'::regtype) then
  execute $ddl$create or replace function public.capture_overhead_rate_snapshot(p_effective_date date default current_date)
   returns public.overhead_rate_snapshots language plpgsql security invoker set search_path=pg_catalog,public as $body$declare v_id uuid;v_row public.overhead_rate_snapshots%rowtype;begin
    v_id:=(public.carez_capture_overhead_v2(p_effective_date)->>'id')::uuid;select * into v_row from public.overhead_rate_snapshots where id=v_id;return v_row;
   end $body$$ddl$;
 else raise exception 'Unknown legacy overhead return contract: %',v_result;end if;
end $compat$;
revoke all on function public.capture_overhead_rate_snapshot(date) from public,anon;grant execute on function public.capture_overhead_rate_snapshot(date) to authenticated;
create function public.carez_immutable_overhead_snapshot() returns trigger language plpgsql set search_path=pg_catalog as $$begin raise exception 'Recorded overhead snapshots are immutable. Capture a new input version.';end $$;
create trigger immutable_overhead_snapshots before update or delete on public.overhead_rate_snapshots for each row execute function public.carez_immutable_overhead_snapshot();
revoke all on function public.carez_immutable_overhead_snapshot() from public,anon,authenticated;
revoke all on public.overhead_rate_snapshots from public,anon,authenticated;grant select on public.overhead_rate_snapshots to authenticated;
