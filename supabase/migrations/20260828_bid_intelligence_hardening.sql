-- Carez OS: bid intelligence view hardening

create or replace view public.bid_scope_leveling_summary as
with item_rollup as (
  select company_id,lead_id,bid_price_feedback_id,
    count(*)::int scope_items,
    count(*) filter(where competitor_status='unknown')::int competitor_unknown_items,
    count(*) filter(where carez_status='included' and competitor_status='excluded')::int known_competitor_exclusions,
    round(coalesce(sum(equalization_amount) filter(where carez_status='included' and competitor_status in ('excluded','allowance')),0),2) equalization_amount
  from public.bid_scope_comparison_items
  group by company_id,lead_id,bid_price_feedback_id
)
select f.company_id,f.lead_id,f.id bid_price_feedback_id,f.estimate_id,f.competitor_name,f.competitor_price,
  f.feedback_source,f.scope_comparable,f.evidence_strength,f.safe_for_price_comparison,f.recorded_at,
  coalesce(i.scope_items,0) scope_items,coalesce(i.competitor_unknown_items,0) competitor_unknown_items,
  coalesce(i.known_competitor_exclusions,0) known_competitor_exclusions,coalesce(i.equalization_amount,0) equalization_amount,
  case when f.competitor_price is not null then round(f.competitor_price+coalesce(i.equalization_amount,0),2) else null end leveled_competitor_price,
  case
    when f.competitor_price is null then 'No competitor price recorded'
    when f.evidence_strength='unverified' then 'Unverified price claim — do not treat as market evidence yet'
    when coalesce(i.scope_items,0)=0 or coalesce(i.competitor_unknown_items,0)>0 then 'Scope is not fully leveled'
    when f.scope_comparable<>'yes' then 'Bid scopes are not confirmed comparable'
    else 'Comparable scope check complete'
  end leveling_status,
  (f.safe_for_price_comparison and coalesce(i.scope_items,0)>0 and coalesce(i.competitor_unknown_items,0)=0) comparison_ready
from public.bid_price_feedback_intelligence f
left join item_rollup i on i.company_id=f.company_id and i.lead_id=f.lead_id and i.bid_price_feedback_id=f.id;

grant select on public.bid_scope_leveling_summary to authenticated;
