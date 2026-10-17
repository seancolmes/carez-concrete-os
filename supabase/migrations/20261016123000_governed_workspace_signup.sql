-- Recover the real employee-invite contract and replace the legacy fallback
-- that silently made an owner/company when an employee invite was invalid.
-- Existing users, company values and profile identities are not rewritten.
alter table public.companies add column if not exists operating_timezone text;
alter table public.companies alter column target_margin_percent drop not null,alter column target_margin_percent drop default,
 alter column planned_productive_hours_annual drop not null,alter column planned_productive_hours_annual drop default,
 alter column owner_compensation_target_annual drop not null,alter column owner_compensation_target_annual drop default,
 alter column owner_planned_field_hours_annual drop not null,alter column owner_planned_field_hours_annual drop default,
 alter column owner_field_rate drop not null,alter column owner_field_rate drop default;
create unique index if not exists profile_company_identity on public.profiles(company_id,id);
create unique index if not exists crew_member_single_profile on public.crew_members(profile_id) where profile_id is not null;
create table if not exists public.employee_invites(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id) on delete cascade,
 crew_member_id uuid not null references public.crew_members(id) on delete cascade,token_hash text not null unique,
 employee_name text not null,email text,expires_at timestamptz not null default now()+interval '7 days',
 accepted_at timestamptz,accepted_user_id uuid,created_by uuid not null,created_at timestamptz not null default now()
);
alter table public.employee_invites add constraint employee_invite_tenant_member foreign key(company_id,crew_member_id) references public.crew_members(company_id,id);
alter table public.employee_invites add constraint employee_invite_acceptance_pair check((accepted_at is null)=(accepted_user_id is null));
-- Audit actor UUIDs retain their historical meaning after an account is removed.
-- Keep the existing Crew unlink-on-profile-delete behavior, with tenant safety.
alter table public.crew_members add constraint crew_profile_tenant foreign key(company_id,profile_id) references public.profiles(company_id,id) on delete set null(profile_id);
alter table public.employee_invites enable row level security;
revoke insert,delete on public.profiles from public,anon,authenticated;
-- Replace the recovered broad ALL policy, preserving company-scoped reads.
drop policy if exists "office access employee invites" on public.employee_invites;
create policy employee_invite_office_read on public.employee_invites for select to authenticated using(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'));
revoke all on public.employee_invites from public,anon,authenticated;grant select on public.employee_invites to authenticated;
create function public.carez_guard_employee_profile_binding() returns trigger language plpgsql set search_path=pg_catalog as $$
begin
 if current_user='authenticated' and new.profile_id is distinct from old.profile_id then raise exception 'Employee login binding requires a verified invitation.';end if;return new;
end $$;
revoke all on function public.carez_guard_employee_profile_binding() from public,anon,authenticated;
create trigger employee_profile_binding_authority before update of profile_id on public.crew_members for each row execute function public.carez_guard_employee_profile_binding();

create or replace function public.carez_issue_employee_invite(p_crew_member_id uuid,p_token_hash text) returns uuid language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare v_company uuid;v_role text;v_crew public.crew_members%rowtype;v_id uuid;
begin
 select company_id,role into v_company,v_role from public.profiles where id=auth.uid();
 if v_company is null or v_role not in ('owner','office') then raise exception 'Owner or office access required.';end if;
 if p_token_hash is null or p_token_hash!~'^[a-f0-9]{64}$' then raise exception 'Invite token fingerprint is invalid.';end if;
 perform 1 from public.companies where id=v_company for update;
 select * into v_crew from public.crew_members where company_id=v_company and id=p_crew_member_id for update;
 if not found or not v_crew.active or v_crew.profile_id is not null or not exists(select 1 from public.crew_administration_summary where id=v_crew.id and company_id=v_company and worker_type='employee') then raise exception 'Choose an active employee without a linked login.';end if;
 select id into v_id from public.employee_invites where token_hash=p_token_hash and company_id=v_company and crew_member_id=v_crew.id and accepted_at is null and accepted_user_id is null;
 if found then return v_id;end if;
 delete from public.employee_invites where company_id=v_company and crew_member_id=v_crew.id and accepted_at is null and accepted_user_id is null;
 insert into public.employee_invites(company_id,crew_member_id,token_hash,employee_name,created_by) values(v_company,v_crew.id,p_token_hash,v_crew.name,auth.uid()) returning id into v_id;
 return v_id;
end $$;
revoke all on function public.carez_issue_employee_invite(uuid,text) from public,anon;grant execute on function public.carez_issue_employee_invite(uuid,text) to authenticated;

create or replace function public.employee_invite_preview(p_token text) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare v_invite public.employee_invites%rowtype;
begin
 if p_token is null or p_token!~'^[a-f0-9]{48}$' then return null;end if;
 select i.* into v_invite from public.employee_invites i join public.crew_members c on c.id=i.crew_member_id and c.company_id=i.company_id
 join public.crew_administration_summary e on e.id=c.id and e.company_id=c.company_id
 where i.token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') and i.accepted_at is null and i.accepted_user_id is null and i.expires_at>statement_timestamp() and c.active and e.worker_type='employee' and c.profile_id is null;
 if not found then return null;end if;
 return jsonb_build_object('employee_name',v_invite.employee_name,'expires_at',v_invite.expires_at);
end $$;
revoke all on function public.employee_invite_preview(text) from public;grant execute on function public.employee_invite_preview(text) to anon,authenticated;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare v_company uuid;v_invite public.employee_invites%rowtype;v_crew public.crew_members%rowtype;v_token text;v_company_name text;v_name text;v_timezone text;
begin
 if coalesce(new.raw_user_meta_data,'{}'::jsonb)?'employee_invite_token' then
  v_token:=new.raw_user_meta_data->>'employee_invite_token';
  if v_token is null or v_token!~'^[a-f0-9]{48}$' then raise exception 'This employee invite cannot be used.';end if;
  select * into v_invite from public.employee_invites where token_hash=encode(sha256(convert_to(v_token,'UTF8')),'hex');
  if not found then raise exception 'This employee invite cannot be used.';end if;
  -- Lock order matches issuance and Crew administration: company, Crew, invite.
  perform 1 from public.companies where id=v_invite.company_id for update;
  select * into v_crew from public.crew_members where company_id=v_invite.company_id and id=v_invite.crew_member_id for update;
  if not found or not v_crew.active or v_crew.profile_id is not null or not exists(select 1 from public.crew_administration_summary where company_id=v_crew.company_id and id=v_crew.id and worker_type='employee') then raise exception 'This employee invite cannot be used.';end if;
  select * into v_invite from public.employee_invites where id=v_invite.id and company_id=v_crew.company_id and crew_member_id=v_crew.id for update;
  if not found or v_invite.accepted_at is not null or v_invite.accepted_user_id is not null or v_invite.expires_at<=clock_timestamp() or (nullif(btrim(v_invite.email),'') is not null and lower(btrim(v_invite.email)) is distinct from lower(btrim(new.email))) then raise exception 'This employee invite cannot be used.';end if;
  insert into public.profiles(id,company_id,full_name,role) values(new.id,v_invite.company_id,v_invite.employee_name,'employee');
  update public.crew_members set profile_id=new.id where company_id=v_invite.company_id and id=v_invite.crew_member_id and profile_id is null;
  if not found then raise exception 'Employee login could not be linked.';end if;
  update public.employee_invites set accepted_at=clock_timestamp(),accepted_user_id=new.id where id=v_invite.id and accepted_at is null and accepted_user_id is null;
  if not found then raise exception 'Employee invite was already used.';end if;
  return new;
 end if;
 v_company_name:=nullif(btrim(new.raw_user_meta_data->>'company_name'),'');v_name:=nullif(btrim(new.raw_user_meta_data->>'full_name'),'');v_timezone:=nullif(btrim(new.raw_user_meta_data->>'operating_timezone'),'');
 if v_company_name is null or length(v_company_name)>160 or v_name is null or length(v_name)>120 then raise exception 'Company and account names are required.';end if;
 if v_timezone is null or not exists(select 1 from pg_timezone_names where name=v_timezone) then raise exception 'Choose a valid company time zone.';end if;
 insert into public.companies(name,operating_timezone) values(v_company_name,v_timezone) returning id into v_company;
 insert into public.profiles(id,company_id,full_name,role) values(new.id,v_company,v_name,'owner');
 return new;
end $$;
revoke all on function public.handle_new_user() from public,anon,authenticated;
do $$ begin
 if exists(select 1 from pg_trigger where tgrelid='auth.users'::regclass and not tgisinternal and tgname='on_auth_user_created' and (tgfoid<>'public.handle_new_user()'::regprocedure or tgtype<>5)) then raise exception 'Existing signup trigger differs from the verified INSERT contract.';end if;
 if exists(select 1 from pg_trigger where tgrelid='auth.users'::regclass and not tgisinternal and tgfoid='public.handle_new_user()'::regprocedure and tgname<>'on_auth_user_created') then raise exception 'Another signup trigger already calls handle_new_user; reconcile before installation.';end if;
 if not exists(select 1 from pg_trigger where tgrelid='auth.users'::regclass and not tgisinternal and tgname='on_auth_user_created') then create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();end if;
end $$;
