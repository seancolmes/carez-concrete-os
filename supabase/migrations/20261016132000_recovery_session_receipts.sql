-- Single-use server-verified password recovery receipts. No business/tenant data.
-- A failed or uncertain Auth write consumes its claim; request a new email link.
create table public.password_recovery_uses(
 nonce uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,
 session_id uuid not null,state text not null check(state in ('claimed','completed','unconfirmed')),
 claimed_at timestamptz not null default clock_timestamp(),completed_at timestamptz
);
alter table public.password_recovery_uses enable row level security;
revoke all on public.password_recovery_uses from public,anon,authenticated,service_role;
create function public.carez_claim_password_recovery(p_nonce uuid,p_user_id uuid,p_session_id uuid,p_expires_at timestamptz) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare confirmed uuid;
begin
 if p_nonce is null or p_user_id is null or p_session_id is null or p_expires_at is null or not isfinite(p_expires_at) or p_expires_at<=clock_timestamp() or p_expires_at>clock_timestamp()+interval '10 minutes' then raise exception 'Verified current recovery context required';end if;
 if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'Recovery identity unavailable';end if;
 insert into public.password_recovery_uses(nonce,user_id,session_id,state) values(p_nonce,p_user_id,p_session_id,'claimed') on conflict(nonce) do nothing returning nonce into confirmed;
 if confirmed is null then raise exception 'Recovery link was already used. Request a new link.';end if;
 return jsonb_build_object('ok',true,'nonce',confirmed);
end $$;
create function public.carez_finish_password_recovery(p_nonce uuid,p_user_id uuid,p_session_id uuid,p_confirmed boolean) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if p_confirmed is null then raise exception 'Recovery result required';end if;
 update public.password_recovery_uses set state=case when p_confirmed then 'completed' else 'unconfirmed' end,completed_at=clock_timestamp() where nonce=p_nonce and user_id=p_user_id and session_id=p_session_id and state='claimed';
 if not found then raise exception 'Recovery claim unavailable or already completed';end if;
end $$;
revoke all on function public.carez_claim_password_recovery(uuid,uuid,uuid,timestamptz),public.carez_finish_password_recovery(uuid,uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.carez_claim_password_recovery(uuid,uuid,uuid,timestamptz),public.carez_finish_password_recovery(uuid,uuid,uuid,boolean) to service_role;
