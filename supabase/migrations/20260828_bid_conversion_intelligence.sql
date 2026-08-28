-- Carez OS: bid conversion, pursuit discipline, competitor feedback and pricing guardrails

create table if not exists public.lead_bid_intelligence (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  lead_id uuid not null unique references public.leads(id) on delete cascade,
  bid_type text not null default 'private_competitive' check (bid_type in ('residential_direct','private_competitive','gc_invited','negotiated','public_hard_bid','repeat_client','other')),
  relationship_strength text not null default 'new' check (relationship_strength in ('new','known','repeat')),
  estimated_competitor_count integer check (estimated_competitor_count is null or estimated_competitor_count>=0),
  customer_budget numeric check (customer_budget is null or customer_budget>=0),
  customer_budget_source text,
  project_fit_score integer not null default 3 check (project_fit_score between 1 and 5),
  relationship_score integer not null default 3 check (relationship_score between 1 and 5),
  scope_clarity_score integer not null default 3 check (scope_clarity_score between 1 and 5),
  capacity_score integer not null default 3 check (capacity_score between 1 and 5),
  margin_potential_score integer not null default 3 check (margin_potential_score between 1 and 5),
  payment_confidence_score integer not null default 3 check (payment_confidence_score between 1 and 5),
  competition_score integer not null default 3 check (competition_score between 1 and 5),
  risk_score integer not null default 3 check (risk_score between 1 and 5),
  estimator_effort_hours numeric check (estimator_effort_hours is null or estimator_effort_hours>=0),
  pursuit_decision text not null default 'review' check (pursuit_decision in ('review','pursue','pass')),
  pass_reason text,
  proposal_sent_at timestamptz,
  last_follow_up_at timestamptz,
  outcome text not null default 'pending' check (outcome in ('pending','won','lost','no_decision','withdrawn')),
  lost_reason text,
  outcome_note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bid_price_feedback (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  estimate_id uuid references public.estimates(id) on delete set null,
  feedback_source text not null check (feedback_source in ('customer_claim','gc_feedback','public_bid_tab','direct_competitor_quote','owner_budget','other')),
  competitor_name text,
  competitor_price numeric check (competitor_price is null or competitor_price>=0),
  scope_comparable text not null default 'unknown' check (scope_comparable in ('yes','no','unknown')),
  note text,
  recorded_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists bid_price_feedback_lead_idx on public.bid_price_feedback(lead_id,recorded_at desc);

alter table public.lead_bid_intelligence enable row level security;
alter table public.bid_price_feedback enable row level security;

drop policy if exists "office access lead bid intelligence" on public.lead_bid_intelligence;
create policy "office access lead bid intelligence" on public.lead_bid_intelligence for all to authenticated
using (company_id=public.get_my_company_id() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role<>'employee'))
with check (company_id=public.get_my_company_id() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role<>'employee'));

drop policy if exists "office access bid price feedback" on public.bid_price_feedback;
create policy "office access bid price feedback" on public.bid_price_feedback for all to authenticated
using (company_id=public.get_my_company_id() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role<>'employee'))
with check (company_id=public.get_my_company_id() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role<>'employee'));

create or replace view public.bid_pursuit_score as
select b.*,
  round((
    b.project_fit_score*15 + b.relationship_score*15 + b.scope_clarity_score*10 + b.capacity_score*10 +
    b.margin_potential_score*20 + b.payment_confidence_score*10 + b.competition_score*10 + b.risk_score*10
  )/5.0,1) carez_pursuit_score,
  case
    when ((b.project_fit_score*15 + b.relationship_score*15 + b.scope_clarity_score*10 + b.capacity_score*10 + b.margin_potential_score*20 + b.payment_confidence_score*10 + b.competition_score*10 + b.risk_score*10)/5.0)>=70 then 'pursue'
    when ((b.project_fit_score*15 + b.relationship_score*15 + b.scope_clarity_score*10 + b.capacity_score*10 + b.margin_potential_score*20 + b.payment_confidence_score*10 + b.competition_score*10 + b.risk_score*10)/5.0)>=55 then 'review'
    else 'pass'
  end carez_recommendation
from public.lead_bid_intelligence b;

create or replace view public.bid_price_feedback_intelligence as
select f.*,
  case
    when f.feedback_source in ('public_bid_tab','direct_competitor_quote') then 'verified'
    when f.feedback_source in ('gc_feedback','owner_budget') then 'credible'
    when f.feedback_source='customer_claim' then 'unverified'
    else 'unknown'
  end evidence_strength,
  case
    when f.competitor_price is null then false
    when f.scope_comparable='yes' and f.feedback_source in ('public_bid_tab','direct_competitor_quote','gc_feedback') then true
    else false
  end safe_for_price_comparison
from public.bid_price_feedback f;

create or replace view public.estimate_price_guardrail as
with latest_feedback as (
  select distinct on (f.lead_id) f.lead_id,f.id feedback_id,f.competitor_name,f.competitor_price,f.scope_comparable,f.feedback_source,f.evidence_strength,f.safe_for_price_comparison,f.recorded_at
  from public.bid_price_feedback_intelligence f
  order by f.lead_id,f.recorded_at desc
)
select efs.*,e.lead_id,
  case when 1-((coalesce(efs.bo_rate_percent,0)+coalesce(efs.payment_processing_rate_percent,0))/100.0)>0 then
    round(efs.base_company_cost/(1-((coalesce(efs.bo_rate_percent,0)+coalesce(efs.payment_processing_rate_percent,0))/100.0)),2)
    else null end protected_break_even_price,
  case when 1-((coalesce(efs.bo_rate_percent,0)+coalesce(efs.payment_processing_rate_percent,0))/100.0)>0 then
    round(efs.selected_sell_price-(efs.base_company_cost/(1-((coalesce(efs.bo_rate_percent,0)+coalesce(efs.payment_processing_rate_percent,0))/100.0))),2)
    else null end room_to_break_even,
  lf.feedback_id,lf.competitor_name,lf.competitor_price,lf.scope_comparable,lf.feedback_source,lf.evidence_strength,lf.safe_for_price_comparison,
  case when lf.competitor_price>0 then
    round(100.0*(lf.competitor_price-(lf.competitor_price*((coalesce(efs.bo_rate_percent,0)+coalesce(efs.payment_processing_rate_percent,0))/100.0))-efs.base_company_cost)/lf.competitor_price,2)
    else null end margin_if_competitor_price_matched,
  case
    when lf.competitor_price is null then 'No competitor number recorded'
    when not lf.safe_for_price_comparison then 'Do not price-match yet — scope/evidence is not verified comparable'
    when lf.competitor_price < (case when 1-((coalesce(efs.bo_rate_percent,0)+coalesce(efs.payment_processing_rate_percent,0))/100.0)>0 then efs.base_company_cost/(1-((coalesce(efs.bo_rate_percent,0)+coalesce(efs.payment_processing_rate_percent,0))/100.0)) else efs.base_company_cost end) then 'Competitor number is below Carez protected break-even'
    when lf.competitor_price < efs.selected_sell_price then 'Comparable competitor is lower — review scope, production assumptions and value-engineering options'
    else 'Carez is at or below the latest comparable competitor feedback'
  end price_guidance
from public.estimate_financial_summary efs
join public.estimates e on e.id=efs.estimate_id and e.company_id=efs.company_id
left join latest_feedback lf on lf.lead_id=e.lead_id;

create or replace view public.bid_pipeline_intelligence as
with latest_estimate as (
  select distinct on (e.lead_id) e.lead_id,e.id estimate_id,e.estimate_number,e.status estimate_status,e.updated_at estimate_updated_at
  from public.estimates e where e.lead_id is not null
  order by e.lead_id,e.version desc,e.updated_at desc
), acceptance as (
  select e.lead_id,max(a.accepted_at) accepted_at
  from public.proposal_acceptances a join public.estimates e on e.id=a.estimate_id
  where e.lead_id is not null group by e.lead_id
), latest_feedback as (
  select distinct on (f.lead_id) f.lead_id,f.competitor_price,f.scope_comparable,f.evidence_strength,f.safe_for_price_comparison,f.recorded_at
  from public.bid_price_feedback_intelligence f order by f.lead_id,f.recorded_at desc
)
select l.company_id,l.id lead_id,l.opportunity_number,l.customer_name,l.project_name,l.city,l.scope,l.estimated_value,l.bid_due,l.follow_up,l.status lead_status,l.source,
  ps.bid_type,ps.relationship_strength,ps.estimated_competitor_count,ps.customer_budget,ps.estimator_effort_hours,ps.pursuit_decision,ps.outcome,ps.lost_reason,
  ps.carez_pursuit_score,ps.carez_recommendation,ps.proposal_sent_at,ps.last_follow_up_at,
  le.estimate_id,le.estimate_number,le.estimate_status,a.accepted_at,
  lf.competitor_price,lf.scope_comparable,lf.evidence_strength,lf.safe_for_price_comparison,lf.recorded_at latest_price_feedback_at,
  (l.follow_up is not null and l.follow_up <= (now() at time zone 'America/Los_Angeles')::date and l.status not in ('won','lost')) needs_follow_up,
  case
    when a.accepted_at is not null or l.status='won' then 'won'
    when l.status='lost' or ps.outcome='lost' then 'lost'
    when l.status in ('proposal_sent','follow_up') then 'proposal_out'
    when ps.pursuit_decision='pass' then 'passed'
    when le.estimate_id is not null then 'estimating'
    else 'qualifying'
  end pipeline_stage
from public.leads l
left join public.bid_pursuit_score ps on ps.lead_id=l.id and ps.company_id=l.company_id
left join latest_estimate le on le.lead_id=l.id
left join acceptance a on a.lead_id=l.id
left join latest_feedback lf on lf.lead_id=l.id;

create or replace view public.bid_win_rate_summary as
select company_id,
  coalesce(bid_type,'unclassified') bid_type,
  count(*) filter(where pipeline_stage in ('won','lost'))::int decided_bids,
  count(*) filter(where pipeline_stage='won')::int wins,
  count(*) filter(where pipeline_stage='lost')::int losses,
  case when count(*) filter(where pipeline_stage in ('won','lost'))>0 then
    round(100.0*count(*) filter(where pipeline_stage='won')/count(*) filter(where pipeline_stage in ('won','lost')),1)
    else null end win_rate_percent,
  round(coalesce(avg(estimator_effort_hours) filter(where estimator_effort_hours is not null),0),1) avg_estimator_hours
from public.bid_pipeline_intelligence
group by company_id,coalesce(bid_type,'unclassified');

grant select on public.bid_pursuit_score,public.bid_price_feedback_intelligence,public.estimate_price_guardrail,public.bid_pipeline_intelligence,public.bid_win_rate_summary to authenticated;
