-- Persist the authoritative Estimate release evidence used to issue each proposal.
-- Historical presentations remain intact and are not assigned invented evidence.

alter table public.proposal_presentations
  add column release_commercial_fingerprint text,
  add column release_warning_fingerprint text,
  add column release_acknowledgement_id uuid
    references public.estimate_review_acknowledgements(id) on delete restrict;

create index proposal_presentations_release_ack_idx
  on public.proposal_presentations(release_acknowledgement_id)
  where release_acknowledgement_id is not null;

create or replace function public.carez_guard_proposal_release()
returns trigger
language plpgsql
security invoker
set search_path=public,extensions
as $function$
declare
  v_readiness jsonb;
  v_warning_count integer;
begin
  v_readiness:=public.carez_get_estimate_release_readiness(new.estimate_id);

  if (v_readiness->>'release_state') is distinct from 'release_ready' then
    raise exception 'Estimate is not release-ready for Proposal.';
  end if;

  if new.release_commercial_fingerprint is distinct from (v_readiness->>'commercial_fingerprint') then
    raise exception 'Estimate changed after Review.';
  end if;

  if new.release_warning_fingerprint is distinct from (v_readiness->>'warning_fingerprint') then
    raise exception 'Estimate warning state changed after Review.';
  end if;

  v_warning_count:=coalesce((v_readiness->>'warning_count')::integer,0);
  if v_warning_count>0
     and new.release_acknowledgement_id is distinct from nullif(v_readiness->>'acknowledgement_id','')::uuid then
    raise exception 'Current warning review acknowledgement is required.';
  end if;

  if v_warning_count=0 then
    new.release_acknowledgement_id:=null;
  end if;

  return new;
end;
$function$;

revoke all on function public.carez_guard_proposal_release() from public,anon,authenticated;

create trigger guard_proposal_release
before insert on public.proposal_presentations
for each row execute function public.carez_guard_proposal_release();
