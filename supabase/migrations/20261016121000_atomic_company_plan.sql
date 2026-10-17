-- Preserve existing production values. Missing plan fields remain unconfigured, not zero.
alter table public.companies add column if not exists target_margin_percent numeric(6,2);
alter table public.companies add column if not exists planned_productive_hours_annual numeric(10,2);
alter table public.companies add column if not exists owner_compensation_target_annual numeric(12,2);
alter table public.companies add column if not exists owner_planned_field_hours_annual numeric(10,2);
alter table public.companies add column if not exists owner_field_rate numeric(10,2);
alter table public.companies add column if not exists plan_revision integer not null default 0;
create table public.company_plan_requests(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),request_id uuid not null,
 payload jsonb not null,result jsonb not null,created_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),unique(company_id,request_id)
);
alter table public.company_plan_requests enable row level security;
create policy company_plan_requests_read on public.company_plan_requests for select to authenticated using(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'));
revoke all on public.company_plan_requests from public,anon,authenticated;grant select on public.company_plan_requests to authenticated;
create trigger immutable_company_plan_requests before update or delete on public.company_plan_requests for each row execute function public.carez_immutable_crew_history();
create function public.carez_save_company_plan(p_request_id uuid,p_expected_revision integer,p_values jsonb) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare v_company uuid;v_role text;v_row public.companies%rowtype;v_request public.company_plan_requests%rowtype;v_crew record;v_result jsonb;v_payload jsonb:=jsonb_build_array(p_expected_revision,p_values);
 v_margin numeric;v_hours numeric;v_comp numeric;v_owner_hours numeric;v_rate numeric;
begin
 select company_id,role into v_company,v_role from public.profiles where id=auth.uid();
 if v_company is null or v_role not in ('owner','office') then raise exception 'Owner or office access required.';end if;
 if p_request_id is null or jsonb_typeof(p_values) is distinct from 'object' then raise exception 'Invalid business plan request.';end if;
 perform pg_advisory_xact_lock(hashtextextended(v_company::text||p_request_id::text,1));
 select * into v_request from public.company_plan_requests where company_id=v_company and request_id=p_request_id;
 if found then if v_request.payload is distinct from v_payload then raise exception 'This request already saved another business plan. Reopen the saved plan.';end if;return v_request.result;end if;
 select * into v_row from public.companies where id=v_company for update;
 if not found or p_expected_revision is null or v_row.plan_revision<>p_expected_revision then raise exception 'Business plan changed or is unavailable. Reopen it before saving.';end if;
 v_margin:=(p_values->>'target_margin_percent')::numeric;v_hours:=(p_values->>'planned_productive_hours_annual')::numeric;
 v_comp:=(p_values->>'owner_compensation_target_annual')::numeric;v_owner_hours:=(p_values->>'owner_planned_field_hours_annual')::numeric;v_rate:=(p_values->>'owner_field_rate')::numeric;
 if exists(select 1 from unnest(array[v_margin,v_hours,v_comp,v_owner_hours,v_rate]) n where n is null or n::text in ('NaN','Infinity','-Infinity') or n<0)
  or v_margin>80 or v_margin*10<>trunc(v_margin*10) or v_hours<1 or v_hours<>trunc(v_hours) or v_owner_hours<>trunc(v_owner_hours)
  or mod(v_comp,100)<>0 or v_rate<>round(v_rate,2) or v_rate>99999999.99 then raise exception 'Enter all required business plan values within their allowed bounds.';end if;
 update public.companies set target_margin_percent=v_margin,planned_productive_hours_annual=v_hours,owner_compensation_target_annual=v_comp,owner_planned_field_hours_annual=v_owner_hours,owner_field_rate=v_rate,plan_revision=plan_revision+1 where id=v_company;
 if not found then raise exception 'Business plan was not saved.';end if;
 for v_crew in select c.id,c.administration_revision from public.crew_members c where c.company_id=v_company order by c.id for update loop
  if exists(select 1 from public.crew_administration_summary s where s.company_id=v_company and s.id=v_crew.id and s.is_owner) then
   perform public.carez_administer_crew('rate',gen_random_uuid(),v_crew.id,v_crew.administration_revision,jsonb_build_object('amount',v_rate,'effective_date',public.carez_company_calendar_date(v_company,clock_timestamp()),'reason','Business plan owner field rate; plan request '||p_request_id));
  end if;
 end loop;
 v_result:=jsonb_build_object('company_id',v_company,'plan_revision',v_row.plan_revision+1);
 insert into public.company_plan_requests(company_id,request_id,payload,result,created_by) values(v_company,p_request_id,v_payload,v_result,auth.uid());
 return v_result;
end $$;
revoke all on function public.carez_save_company_plan(uuid,integer,jsonb) from public,anon;grant execute on function public.carez_save_company_plan(uuid,integer,jsonb) to authenticated;

-- Narrow direct-DML guards preserve profile-linking and production-reporter actions.
create function public.carez_guard_crew_administration() returns trigger language plpgsql set search_path=pg_catalog,public as $$ begin
 if current_user in ('authenticated','anon') then
  if public.get_my_role() is null or public.get_my_role() not in ('owner','office') then raise exception 'Owner or office access required.';end if;
  if tg_table_name='crew_rate_history' or tg_op in ('INSERT','DELETE') then raise exception 'Use audited Crew administration.';end if;
  if (new.id,new.company_id,new.worker_type,new.is_owner,new.hourly_rate,new.day_rate,new.internal_field_rate,new.employment_type,new.availability_type,new.default_risk_class_code,new.administration_revision,new.start_date,new.end_date,new.active)
   is distinct from (old.id,old.company_id,old.worker_type,old.is_owner,old.hourly_rate,old.day_rate,old.internal_field_rate,old.employment_type,old.availability_type,old.default_risk_class_code,old.administration_revision,old.start_date,old.end_date,old.active) then raise exception 'Use audited Crew administration for employment terms and rates.';end if;
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
create trigger crew_administration_only before insert or update or delete on public.crew_members for each row execute function public.carez_guard_crew_administration();
create trigger crew_rate_administration_only before insert or update or delete on public.crew_rate_history for each row execute function public.carez_guard_crew_administration();
create function public.carez_guard_company_plan() returns trigger language plpgsql set search_path=pg_catalog as $$ begin
 if current_user in ('authenticated','anon') and (new.target_margin_percent,new.planned_productive_hours_annual,new.owner_compensation_target_annual,new.owner_planned_field_hours_annual,new.owner_field_rate,new.plan_revision)
  is distinct from (old.target_margin_percent,old.planned_productive_hours_annual,old.owner_compensation_target_annual,old.owner_planned_field_hours_annual,old.owner_field_rate,old.plan_revision) then raise exception 'Use audited business plan administration.';end if;return new;
end $$;
create trigger company_plan_administration_only before update on public.companies for each row execute function public.carez_guard_company_plan();

revoke all on function public.carez_guard_crew_administration() from public,anon,authenticated;
revoke all on function public.carez_guard_company_plan() from public,anon,authenticated;
