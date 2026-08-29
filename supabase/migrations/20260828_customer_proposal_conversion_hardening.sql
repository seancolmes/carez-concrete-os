-- Carez OS: harden the public proposal capability boundary.
-- Keep anonymous proposal access token-based while stripping labor-hour detail and throttling response abuse.

alter function public.get_public_proposal(uuid) rename to get_public_proposal_internal_v2;
revoke all on function public.get_public_proposal_internal_v2(uuid) from public,anon,authenticated;

create or replace function public.get_public_proposal(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_payload jsonb;
  v_items jsonb;
begin
  v_payload:=public.get_public_proposal_internal_v2(p_token);
  if v_payload is null then return null; end if;

  -- Labor estimating hours are internal production intelligence. Never return them in a customer payload,
  -- including for links created before immutable proposal snapshots were introduced.
  select coalesce(jsonb_agg(
    case when item->>'item_type'='labor'
      then item-'quantity'-'unit'
      else item
    end
  ),'[]'::jsonb)
  into v_items
  from jsonb_array_elements(coalesce(v_payload->'items','[]'::jsonb)) item;

  return jsonb_set(v_payload,'{items}',v_items,true);
end;
$$;
revoke all on function public.get_public_proposal(uuid) from public;
grant execute on function public.get_public_proposal(uuid) to anon,authenticated;

create or replace function public.validate_proposal_engagement_event()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  v_recent integer;
begin
  if new.event_type in ('question','change_request') and nullif(trim(coalesce(new.customer_message,'')),'') is null then
    raise exception 'A message is required';
  end if;
  if new.event_type='decline' and nullif(trim(coalesce(new.decline_reason,'')),'') is null then
    raise exception 'A decline reason is required';
  end if;
  if new.event_type<>'view' then
    select count(*) into v_recent
    from public.proposal_engagement_events
    where presentation_id=new.presentation_id
      and event_type<>'view'
      and created_at>now()-interval '1 hour';
    if v_recent>=20 then
      raise exception 'Too many proposal responses. Please contact Carez directly.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists validate_proposal_engagement_event on public.proposal_engagement_events;
create trigger validate_proposal_engagement_event
before insert on public.proposal_engagement_events
for each row execute function public.validate_proposal_engagement_event();

create index if not exists proposal_clarifications_company_idx on public.proposal_clarifications(company_id,estimate_id);
create index if not exists proposal_engagement_option_idx on public.proposal_engagement_events(option_id) where option_id is not null;
