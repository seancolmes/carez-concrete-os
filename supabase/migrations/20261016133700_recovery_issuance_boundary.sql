-- GoTrue shares recovery-token storage with magic links. Only tokens issued
-- through this server-owned recovery path may mint PourTrace reset proof.
create table public.password_recovery_requests(
 id uuid primary key default gen_random_uuid(),email_key text not null,
 created_at timestamptz not null default clock_timestamp(),
 delivery_state text not null default 'requested' check(delivery_state in ('requested','sent','unconfirmed','not-issued'))
);
create index password_recovery_requests_email_created on public.password_recovery_requests(email_key,created_at desc);
create table public.password_recovery_issuances(
 request_id uuid primary key references public.password_recovery_requests(id),
 token_digest text not null unique,user_id uuid not null references auth.users(id) on delete cascade,
 expires_at timestamptz not null,claimed_at timestamptz
);
alter table public.password_recovery_requests enable row level security;
alter table public.password_recovery_issuances enable row level security;
revoke all on public.password_recovery_requests,public.password_recovery_issuances from public,anon,authenticated,service_role;
create function public.carez_begin_password_recovery_request(p_email_key text) returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare id uuid;begin
 if p_email_key is null or p_email_key!~'^[0-9a-f]{64}$' then raise exception 'Recovery request unavailable';end if;
 perform pg_advisory_xact_lock(hashtextextended('password-recovery-rate-limit',0));
 if exists(select 1 from public.password_recovery_requests where email_key=p_email_key and created_at>clock_timestamp()-interval '60 seconds')
 or (select count(*) from public.password_recovery_requests where created_at>clock_timestamp()-interval '1 hour')>=30 then raise exception 'Recovery requests are temporarily limited. Try again later';end if;
 insert into public.password_recovery_requests(email_key) values(p_email_key) returning password_recovery_requests.id into id;return id;
end $$;
create function public.carez_register_password_recovery_token(p_request_id uuid,p_token_digest text,p_user_id uuid,p_expires_at timestamptz) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if p_token_digest is null or p_token_digest!~'^[0-9a-f]{64}$' or p_user_id is null or p_expires_at is null or not isfinite(p_expires_at) or p_expires_at<=clock_timestamp() or p_expires_at>clock_timestamp()+interval '15 minutes' then raise exception 'Recovery issuance unavailable';end if;
 perform 1 from public.password_recovery_requests where id=p_request_id and created_at>clock_timestamp()-interval '2 minutes' for update;
 if not found then raise exception 'Recovery request expired or unavailable';end if;
 insert into public.password_recovery_issuances(request_id,token_digest,user_id,expires_at) values(p_request_id,p_token_digest,p_user_id,p_expires_at);
end $$;
create function public.carez_claim_password_recovery_token(p_token_digest text) returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare uid uuid;begin
 update public.password_recovery_issuances set claimed_at=clock_timestamp() where token_digest=p_token_digest and claimed_at is null and expires_at>clock_timestamp() returning user_id into uid;
 if uid is null then raise exception 'Recovery link was not issued here, expired or already used';end if;return uid;
end $$;
create function public.carez_finish_password_recovery_request(p_request_id uuid,p_state text) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if p_state is null or p_state not in ('sent','unconfirmed','not-issued') then raise exception 'Recovery delivery state invalid';end if;
 update public.password_recovery_requests set delivery_state=p_state where id=p_request_id;
 if not found then raise exception 'Recovery request unavailable';end if;
end $$;
revoke all on function public.carez_begin_password_recovery_request(text),public.carez_register_password_recovery_token(uuid,text,uuid,timestamptz),public.carez_claim_password_recovery_token(text) from public,anon,authenticated;
grant execute on function public.carez_begin_password_recovery_request(text),public.carez_register_password_recovery_token(uuid,text,uuid,timestamptz),public.carez_claim_password_recovery_token(text) to service_role;
revoke all on function public.carez_finish_password_recovery_request(uuid,text) from public,anon,authenticated;
grant execute on function public.carez_finish_password_recovery_request(uuid,text) to service_role;
