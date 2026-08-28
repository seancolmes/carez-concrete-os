-- Carez OS: competitor scope leveling + controlled value-engineering alternatives

create table if not exists public.bid_scope_comparison_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  estimate_id uuid references public.estimates(id) on delete set null,
  bid_price_feedback_id uuid references public.bid_price_feedback(id) on delete set null,
  description text not null,
  carez_status text not null default 'included' check (carez_status in ('included','excluded','allowance','unknown')),
  competitor_status text not null default 'unknown' check (competitor_status in ('included','excluded','allowance','unknown')),
  equalization_amount numeric not null default 0,
  note text,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bid_scope_comparison_lead_idx on public.bid_scope_comparison_items(lead_id,sort_order,created_at);

create table if not exists public.bid_value_options (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  estimate_id uuid references public.estimates(id) on delete set null,
  name text not null,
  customer_description text not null,
  sell_price_change numeric not null default 0,
  company_cost_change numeric not null default 0,
  schedule_days_change integer not null default 0,
  function_quality_note text,
  approval_required text,
  status text not null default 'suggested' check (status in ('suggested','presented','accepted','rejected','withdrawn')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bid_value_options_lead_idx on public.bid_value_options(lead_id,status,created_at desc);

alter table public.bid_scope_comparison_items enable row level security;
alter table public.bid_value_options enable row level security;

drop policy if exists "office access bid scope comparison" on public.bid_scope_comparison_items;
create policy "office access bid scope comparison" on public.bid_scope_comparison_items for all to authenticated
using (company_id=public.get_my_company_id() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role<>'employee'))
with check (company_id=public.get_my_company_id() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role<>'employee'));

drop policy if exists "office access bid value options" on public.bid_value_options;
create policy "office access bid value options" on public.bid_value_options for all to authenticated
using (company_id=public.get_my_company_id() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role<>'employee'))
with check (company_id=public.get_my_company_id() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role<>'employee'));

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
select f.company_id,f.lead_id,f.id bid_price_feedback_id,f.competitor_name,f.competitor_price,f.feedback_source,f.scope_comparable,f.evidence_strength,f.safe_for_price_comparison,
  coalesce(i.scope_items,0) scope_items,coalesce(i.competitor_unknown_items,0) competitor_unknown_items,coalesce(i.known_competitor_exclusions,0) known_competitor_exclusions,coalesce(i.equalization_amount,0) equalization_amount,
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

create or replace view public.bid_value_option_financials as
select o.*,
  g.selected_sell_price base_sell_price,g.base_company_cost base_company_cost,
  round(g.selected_sell_price+o.sell_price_change,2) option_sell_price,
  round(g.base_company_cost+o.company_cost_change,2) option_company_cost,
  case when (g.selected_sell_price+o.sell_price_change)>0 then
    round(100.0*((g.selected_sell_price+o.sell_price_change)-((g.selected_sell_price+o.sell_price_change)*((coalesce(g.bo_rate_percent,0)+coalesce(g.payment_processing_rate_percent,0))/100.0))-(g.base_company_cost+o.company_cost_change))/(g.selected_sell_price+o.sell_price_change),2)
    else null end option_projected_margin_percent,
  round((o.sell_price_change-o.company_cost_change),2) gross_value_delta_before_revenue_reserves
from public.bid_value_options o
left join public.estimate_price_guardrail g on g.estimate_id=o.estimate_id and g.company_id=o.company_id;

grant select on public.bid_scope_leveling_summary,public.bid_value_option_financials to authenticated;
