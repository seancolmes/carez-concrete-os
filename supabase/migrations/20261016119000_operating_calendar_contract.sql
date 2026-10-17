-- Prospective company/job calendars. Existing work dates and money remain unchanged.
-- Human decision 2026-10-16: overnight work belongs to the shift START date,
-- using the job zone or company fallback; durations use elapsed UTC instants.
set local search_path=pg_catalog,public,extensions;
alter table public.companies add column if not exists operating_timezone text;
alter table public.projects add column if not exists work_timezone text;
create or replace function public.carez_valid_operating_timezone(p_zone text)
returns boolean language sql stable set search_path=pg_catalog as $$
 select p_zone is not null and (p_zone='UTC' or position('/' in p_zone)>0)
  and exists(select 1 from pg_timezone_names where name=p_zone);
$$;
revoke all on function public.carez_valid_operating_timezone(text) from public,anon;
grant execute on function public.carez_valid_operating_timezone(text) to authenticated;

create or replace function public.carez_shift_start_work_date(p_instant timestamptz,p_job_zone text,p_company_zone text)
returns date language plpgsql stable set search_path=pg_catalog,public as $$
declare zone text:=coalesce(p_job_zone,p_company_zone);
begin
 if p_instant is null or not public.carez_valid_operating_timezone(zone) then raise exception 'Verified operating time zone and server instant are required'; end if;
 return (p_instant at time zone zone)::date;
end $$;
revoke all on function public.carez_shift_start_work_date(timestamptz,text,text) from public,anon;
grant execute on function public.carez_shift_start_work_date(timestamptz,text,text) to authenticated;

create or replace function public.carez_company_calendar_date(p_company uuid,p_at timestamptz)
returns date language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare zone text;
begin
 if auth.uid() is not null and not exists(select 1 from public.profiles where id=auth.uid() and company_id=p_company) then raise exception 'Company calendar unavailable'; end if;
 select operating_timezone into zone from public.companies where id=p_company;
 if not public.carez_valid_operating_timezone(zone) then return null; end if;
 return (p_at at time zone zone)::date;
end $$;
revoke all on function public.carez_company_calendar_date(uuid,timestamptz) from public,anon;
grant execute on function public.carez_company_calendar_date(uuid,timestamptz) to authenticated;

create table public.operating_calendar_events(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),
 request_id uuid not null,project_id uuid,payload jsonb not null,before_timezone text,after_timezone text,
 actor_id uuid,recorded_at timestamptz not null default clock_timestamp(),
 unique(company_id,request_id),foreign key(company_id,project_id) references public.projects(company_id,id)
);
alter table public.operating_calendar_events enable row level security;
create policy calendar_event_read on public.operating_calendar_events for select to authenticated using(company_id=public.get_my_company_id());
revoke all on public.operating_calendar_events from public,anon,authenticated;
grant select on public.operating_calendar_events to authenticated;
create function public.carez_immutable_calendar_event() returns trigger language plpgsql set search_path=pg_catalog as $$
begin raise exception 'Operating calendar history is immutable'; end $$;
revoke all on function public.carez_immutable_calendar_event() from public,anon,authenticated;
create trigger immutable_calendar_event before update or delete on public.operating_calendar_events for each row execute function public.carez_immutable_calendar_event();

create or replace function public.carez_set_operating_calendar(p_request_id uuid,p_timezone text,p_project_id uuid default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare company uuid; actor_role text; zone text:=nullif(btrim(p_timezone),''); before_zone text;
 payload jsonb; prior public.operating_calendar_events%rowtype;
begin
 select company_id,role into company,actor_role from public.profiles where id=auth.uid();
 if company is null or actor_role not in ('owner','office') or (p_project_id is null and actor_role<>'owner') then raise exception 'Company calendar requires owner authority; job calendar requires owner or office authority'; end if;
 if p_request_id is null then raise exception 'Calendar request identity required'; end if;
 if (zone is null and p_project_id is null) or (zone is not null and not public.carez_valid_operating_timezone(zone)) then raise exception 'Select a valid IANA time zone'; end if;
 perform 1 from public.companies where id=company for update;
 payload:=jsonb_build_object('project_id',p_project_id,'timezone',zone,'policy','shift_start_job_or_company_v1');
 select * into prior from public.operating_calendar_events where company_id=company and request_id=p_request_id;
 if found then
  if prior.payload is distinct from payload then raise exception 'Calendar request reused with different values'; end if;
  return jsonb_build_object('id',prior.id,'timezone',prior.after_timezone,'project_id',prior.project_id);
 end if;
 if p_project_id is null then
  select operating_timezone into before_zone from public.companies where id=company;
  update public.companies set operating_timezone=zone where id=company;
 else
  select work_timezone into before_zone from public.projects where id=p_project_id and company_id=company for update;
  if not found then raise exception 'Job calendar unavailable'; end if;
  update public.projects set work_timezone=zone where id=p_project_id and company_id=company;
 end if;
 insert into public.operating_calendar_events(company_id,request_id,project_id,payload,before_timezone,after_timezone,actor_id)
 values(company,p_request_id,p_project_id,payload,before_zone,zone,auth.uid()) returning id into prior.id;
 return jsonb_build_object('id',prior.id,'timezone',zone,'project_id',p_project_id);
end $$;
revoke all on function public.carez_set_operating_calendar(uuid,text,uuid) from public,anon;
grant execute on function public.carez_set_operating_calendar(uuid,text,uuid) to authenticated;

create function public.carez_guard_operating_calendar() returns trigger language plpgsql set search_path=pg_catalog,public as $$
declare before_zone text; after_zone text;
begin
 before_zone:=case when tg_table_name='companies' then to_jsonb(old)->>'operating_timezone' else to_jsonb(old)->>'work_timezone' end;
 after_zone:=case when tg_table_name='companies' then to_jsonb(new)->>'operating_timezone' else to_jsonb(new)->>'work_timezone' end;
 if before_zone is distinct from after_zone then
  if current_user not in ('postgres','supabase_admin','service_role') then raise exception 'Use the governed operating calendar action'; end if;
  if after_zone is not null and not public.carez_valid_operating_timezone(after_zone) then raise exception 'Invalid operating time zone'; end if;
 end if;
 return new;
end $$;
revoke all on function public.carez_guard_operating_calendar() from public,anon,authenticated;
create trigger carez_company_calendar_guard before update of operating_timezone on public.companies for each row execute function public.carez_guard_operating_calendar();
create trigger carez_job_calendar_guard before update of work_timezone on public.projects for each row execute function public.carez_guard_operating_calendar();
