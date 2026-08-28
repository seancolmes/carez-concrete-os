-- Public proposal payload includes the construction proposal number.
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
    'proposal_number',coalesce(t.proposal_number,'P-'||coalesce(e.opportunity_number,regexp_replace(e.estimate_number,'^E-',''))||'-R'||coalesce(e.version,0)::text),
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

grant execute on function public.get_public_proposal(uuid) to anon,authenticated;
