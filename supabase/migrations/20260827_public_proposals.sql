-- Secure public proposal read/acceptance functions.
-- Public users can only access a proposal by possession of its random UUID token.

create or replace function public.get_public_proposal(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  t public.proposal_access_tokens%rowtype;
  result jsonb;
begin
  select * into t from public.proposal_access_tokens
  where token=p_token and revoked_at is null and (expires_at is null or expires_at>now());
  if not found then return null; end if;

  select jsonb_build_object(
    'estimate',to_jsonb(e),
    'summary',to_jsonb(s),
    'company',jsonb_build_object('name',c.name),
    'billing_profile',to_jsonb(bp),
    'project',to_jsonb(p),
    'sections',coalesce((select jsonb_agg(to_jsonb(es) order by es.sort_order) from public.estimate_sections es where es.estimate_id=e.id),'[]'::jsonb),
    'items',coalesce((select jsonb_agg(to_jsonb(ei) order by ei.sort_order) from public.estimate_items ei where ei.estimate_id=e.id),'[]'::jsonb),
    'acceptance',(select to_jsonb(a) from public.proposal_acceptances a where a.estimate_id=e.id order by a.accepted_at desc limit 1)
  ) into result
  from public.estimates e
  join public.companies c on c.id=e.company_id
  left join public.company_billing_profiles bp on bp.company_id=e.company_id
  left join public.projects p on p.id=e.project_id
  left join public.estimate_financial_summary s on s.estimate_id=e.id
  where e.id=t.estimate_id;
  return result;
end;
$$;

create or replace function public.accept_public_proposal(p_token uuid,p_name text,p_email text default null,p_note text default null)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare
  t public.proposal_access_tokens%rowtype;
  already boolean;
begin
  if nullif(trim(p_name),'') is null then raise exception 'Name is required'; end if;
  select * into t from public.proposal_access_tokens where token=p_token and revoked_at is null and (expires_at is null or expires_at>now());
  if not found then return false; end if;
  select exists(select 1 from public.proposal_acceptances where estimate_id=t.estimate_id) into already;
  if already then return true; end if;
  insert into public.proposal_acceptances(company_id,estimate_id,accepted_name,accepted_email,acceptance_note)
  values(t.company_id,t.estimate_id,trim(p_name),nullif(trim(coalesce(p_email,'')),''),nullif(trim(coalesce(p_note,'')),''));
  update public.estimates set status='accepted' where id=t.estimate_id and status not in ('approved','declined');
  return true;
end;
$$;

grant execute on function public.get_public_proposal(uuid) to anon,authenticated;
grant execute on function public.accept_public_proposal(uuid,text,text,text) to anon,authenticated;
