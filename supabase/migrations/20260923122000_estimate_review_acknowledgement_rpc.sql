-- Controlled append-only Estimate review acknowledgement.

create or replace function public.carez_acknowledge_estimate_review(p_estimate_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,extensions
as $function$
declare
  v_company_id uuid := public.get_my_company_id();
  v_role text := public.get_my_role();
  v_readiness jsonb;
  v_ack_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if v_company_id is null then
    raise exception 'Company context is required.';
  end if;

  if coalesce(v_role,'employee')='employee' then
    raise exception 'Employees cannot acknowledge Estimate review.';
  end if;

  perform 1
  from public.estimates
  where id=p_estimate_id
    and company_id=v_company_id
  for update;

  if not found then
    raise exception 'Estimate not found.';
  end if;

  v_readiness:=public.carez_get_estimate_release_readiness(p_estimate_id);

  if coalesce((v_readiness->>'blocker_count')::integer,0)>0 then
    raise exception 'Cannot acknowledge Estimate review while blockers remain.';
  end if;

  if v_readiness->>'workflow_state' is distinct from 'review' then
    raise exception 'Estimate must be Ready for Review before acknowledgement.';
  end if;

  if coalesce((v_readiness->>'warning_count')::integer,0)=0 then
    raise exception 'No current warnings require acknowledgement.';
  end if;

  if coalesce((v_readiness->>'acknowledgement_valid')::boolean,false) then
    raise exception 'Current Estimate review warnings are already acknowledged.';
  end if;

  insert into public.estimate_review_acknowledgements(
    company_id,
    estimate_id,
    commercial_fingerprint,
    warning_fingerprint,
    warning_count,
    warning_snapshot,
    acknowledged_by
  ) values (
    v_company_id,
    p_estimate_id,
    v_readiness->>'commercial_fingerprint',
    v_readiness->>'warning_fingerprint',
    (v_readiness->>'warning_count')::integer,
    v_readiness->'warnings',
    auth.uid()
  )
  returning id into v_ack_id;

  return public.carez_get_estimate_release_readiness(p_estimate_id)
    || jsonb_build_object('created_acknowledgement_id',v_ack_id);
end;
$function$;

revoke all on function public.carez_acknowledge_estimate_review(uuid) from public,anon;
grant execute on function public.carez_acknowledge_estimate_review(uuid) to authenticated,service_role;
