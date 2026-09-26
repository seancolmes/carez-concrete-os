create unique index if not exists estimates_company_id_id_uk on public.estimates(company_id,id);
create unique index if not exists cost_codes_company_id_id_uk on public.cost_codes(company_id,id);
create unique index if not exists cost_catalog_items_company_id_id_uk on public.cost_catalog_items(company_id,id);

create table public.timecards (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null,
  budget_section_id uuid,
  change_order_id uuid,
  crew_member_id uuid not null,
  worker_name text not null,
  work_date date not null,
  task text not null default 'General',
  production_task_id uuid,
  hours numeric(10,2) not null check (hours > 0),
  regular_hours numeric(10,2) not null default 0 check (regular_hours >= 0),
  overtime_hours numeric(10,2) not null default 0 check (overtime_hours >= 0),
  hourly_rate numeric(10,2) not null default 0 check (hourly_rate >= 0),
  base_hourly_rate numeric(10,2) not null default 0 check (base_hourly_rate >= 0),
  risk_class_code text,
  social_security_rate_snapshot numeric(8,6) not null default 0,
  medicare_rate_snapshot numeric(8,6) not null default 0,
  futa_rate_snapshot numeric(8,6) not null default 0,
  wa_sui_rate_snapshot numeric(8,6) not null default 0,
  li_employer_rate_snapshot numeric(10,5) not null default 0,
  sick_leave_accrual_rate_snapshot numeric(8,6) not null default 0,
  gross_wage_cost numeric(14,2) not null default 0,
  employer_social_security_cost numeric(14,2) not null default 0,
  employer_medicare_cost numeric(14,2) not null default 0,
  employer_futa_cost numeric(14,2) not null default 0,
  employer_wa_sui_cost numeric(14,2) not null default 0,
  employer_li_cost numeric(14,2) not null default 0,
  sick_leave_reserve_cost numeric(14,2) not null default 0,
  direct_labor_cost numeric(14,2) not null default 0,
  overhead_snapshot_id uuid,
  overhead_rate_snapshot numeric(12,4) not null default 0,
  overhead_recovery_cost numeric(14,2) not null default 0,
  overhead_cost_method text,
  labor_cost_method text,
  notes text,
  source_shift_id uuid,
  approval_status text not null default 'approved' check (approval_status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,id),
  foreign key(company_id,project_id) references public.projects(company_id,id) on delete cascade,
  foreign key(company_id,crew_member_id) references public.crew_members(company_id,id) on delete restrict
);

create table public.project_budgets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null,
  estimate_id uuid,
  budget_type text not null default 'original' check (budget_type in ('original','forecast','revised')),
  label text not null default 'Approved Project Budget',
  status text not null default 'active' check (status in ('draft','active','closed','superseded')),
  target_margin_percent numeric(6,2) not null default 30 check (target_margin_percent between -100 and 100),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,id),
  foreign key(company_id,project_id) references public.projects(company_id,id) on delete cascade,
  foreign key(company_id,estimate_id) references public.estimates(company_id,id) on delete set null
);

create table public.project_budget_sections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  budget_id uuid not null,
  name text not null check (length(btrim(name)) > 0),
  scope_type text not null default 'other',
  sort_order integer not null default 0,
  budget_labor_hours numeric(12,2) not null default 0 check (budget_labor_hours >= 0),
  budget_direct_labor_cost numeric(14,2) not null default 0 check (budget_direct_labor_cost >= 0),
  budget_material_cost numeric(14,2) not null default 0 check (budget_material_cost >= 0),
  budget_equipment_cost numeric(14,2) not null default 0 check (budget_equipment_cost >= 0),
  budget_subcontractor_cost numeric(14,2) not null default 0 check (budget_subcontractor_cost >= 0),
  budget_other_cost numeric(14,2) not null default 0 check (budget_other_cost >= 0),
  budget_sell_amount numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,id),
  unique(company_id,budget_id,name),
  foreign key(company_id,budget_id) references public.project_budgets(company_id,id) on delete cascade
);

create table public.project_costs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null,
  budget_section_id uuid,
  change_order_id uuid,
  cost_code_id uuid not null,
  catalog_item_id uuid,
  cost_date date not null default current_date,
  description text not null check (length(btrim(description)) > 0),
  vendor_name text,
  quantity numeric(14,4) not null default 1 check (quantity >= 0),
  unit text not null default 'LS',
  unit_cost numeric(14,4) not null default 0 check (unit_cost >= 0),
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  sales_tax numeric(14,2) not null default 0 check (sales_tax >= 0),
  total_cost numeric(14,2) not null default 0 check (total_cost >= 0),
  source_type text not null default 'manual',
  reference_number text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,id),
  foreign key(company_id,project_id) references public.projects(company_id,id) on delete cascade,
  foreign key(company_id,budget_section_id) references public.project_budget_sections(company_id,id) on delete set null,
  foreign key(company_id,cost_code_id) references public.cost_codes(company_id,id) on delete restrict,
  foreign key(company_id,catalog_item_id) references public.cost_catalog_items(company_id,id) on delete set null
);

alter table public.timecards add constraint timecards_budget_section_fk
  foreign key(company_id,budget_section_id) references public.project_budget_sections(company_id,id) on delete set null;

create table public.project_scope_progress_updates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null,
  budget_id uuid not null,
  budget_section_id uuid not null,
  as_of_date date not null,
  physical_percent_complete numeric(6,2) not null check (physical_percent_complete between 0 and 100),
  remaining_labor_hours_override numeric(12,2) check (remaining_labor_hours_override is null or remaining_labor_hours_override >= 0),
  remaining_material_cost_override numeric(14,2) check (remaining_material_cost_override is null or remaining_material_cost_override >= 0),
  remaining_equipment_cost_override numeric(14,2) check (remaining_equipment_cost_override is null or remaining_equipment_cost_override >= 0),
  remaining_subcontractor_cost_override numeric(14,2) check (remaining_subcontractor_cost_override is null or remaining_subcontractor_cost_override >= 0),
  remaining_other_cost_override numeric(14,2) check (remaining_other_cost_override is null or remaining_other_cost_override >= 0),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,budget_section_id,as_of_date),
  foreign key(company_id,project_id) references public.projects(company_id,id) on delete cascade,
  foreign key(company_id,budget_id) references public.project_budgets(company_id,id) on delete cascade,
  foreign key(company_id,budget_section_id) references public.project_budget_sections(company_id,id) on delete cascade
);

create index project_budgets_project_idx on public.project_budgets(company_id,project_id,status);
create index project_budget_sections_budget_idx on public.project_budget_sections(company_id,budget_id,sort_order);
create index project_costs_project_idx on public.project_costs(company_id,project_id,cost_date);
create index project_scope_progress_section_idx on public.project_scope_progress_updates(company_id,budget_section_id,as_of_date desc);

create or replace view public.project_budget_actual_summary with (security_invoker=true) as
with active_budgets as (
  select b.company_id,b.id budget_id,b.project_id,b.label,b.target_margin_percent
  from public.project_budgets b where b.status='active'
), budget_totals as (
  select b.company_id,b.budget_id,b.project_id,b.label,b.target_margin_percent,
    coalesce(sum(s.budget_labor_hours),0)::numeric budget_labor_hours,
    coalesce(sum(s.budget_direct_labor_cost),0)::numeric budget_direct_labor_cost,
    coalesce(sum(s.budget_material_cost),0)::numeric budget_material_cost,
    coalesce(sum(s.budget_equipment_cost),0)::numeric budget_equipment_cost,
    coalesce(sum(s.budget_subcontractor_cost),0)::numeric budget_subcontractor_cost,
    coalesce(sum(s.budget_other_cost),0)::numeric budget_other_cost
  from active_budgets b left join public.project_budget_sections s on s.company_id=b.company_id and s.budget_id=b.budget_id
  group by b.company_id,b.budget_id,b.project_id,b.label,b.target_margin_percent
), labor as (
  select t.company_id,t.project_id,coalesce(sum(t.hours),0)::numeric actual_labor_hours,
    coalesce(sum(t.direct_labor_cost),0)::numeric actual_direct_labor_cost
  from public.timecards t group by t.company_id,t.project_id
), manual as (
  select c.company_id,c.project_id,
    coalesce(sum(c.total_cost) filter(where cc.cost_type='material'),0)::numeric actual_material_cost,
    coalesce(sum(c.total_cost) filter(where cc.cost_type='equipment'),0)::numeric actual_equipment_cost,
    coalesce(sum(c.total_cost) filter(where cc.cost_type='subcontractor'),0)::numeric actual_subcontractor_cost,
    coalesce(sum(c.total_cost) filter(where cc.cost_type='other' or cc.cost_type is null),0)::numeric actual_other_direct_cost
  from public.project_costs c left join public.cost_codes cc on cc.company_id=c.company_id and cc.id=c.cost_code_id
  group by c.company_id,c.project_id
)
select b.company_id,b.budget_id,b.project_id,b.label,b.target_margin_percent,
  b.budget_labor_hours,b.budget_direct_labor_cost,b.budget_material_cost,b.budget_equipment_cost,
  b.budget_subcontractor_cost,b.budget_other_cost,
  (b.budget_direct_labor_cost+b.budget_material_cost+b.budget_equipment_cost+b.budget_subcontractor_cost+b.budget_other_cost)::numeric budget_total_company_cost,
  coalesce(l.actual_labor_hours,0)::numeric actual_labor_hours,coalesce(l.actual_direct_labor_cost,0)::numeric actual_direct_labor_cost,
  coalesce(m.actual_material_cost,0)::numeric actual_material_cost,coalesce(m.actual_equipment_cost,0)::numeric actual_equipment_cost,
  coalesce(m.actual_subcontractor_cost,0)::numeric actual_subcontractor_cost,coalesce(m.actual_other_direct_cost,0)::numeric actual_other_direct_cost,
  (coalesce(l.actual_direct_labor_cost,0)+coalesce(m.actual_material_cost,0)+coalesce(m.actual_equipment_cost,0)+coalesce(m.actual_subcontractor_cost,0)+coalesce(m.actual_other_direct_cost,0))::numeric actual_total_company_cost,
  (b.budget_labor_hours-coalesce(l.actual_labor_hours,0))::numeric labor_hours_remaining,
  (b.budget_direct_labor_cost+b.budget_material_cost+b.budget_equipment_cost+b.budget_subcontractor_cost+b.budget_other_cost
    -(coalesce(l.actual_direct_labor_cost,0)+coalesce(m.actual_material_cost,0)+coalesce(m.actual_equipment_cost,0)+coalesce(m.actual_subcontractor_cost,0)+coalesce(m.actual_other_direct_cost,0)))::numeric total_cost_remaining,
  case when b.budget_direct_labor_cost+b.budget_material_cost+b.budget_equipment_cost+b.budget_subcontractor_cost+b.budget_other_cost>0 then round(100*(coalesce(l.actual_direct_labor_cost,0)+coalesce(m.actual_material_cost,0)+coalesce(m.actual_equipment_cost,0)+coalesce(m.actual_subcontractor_cost,0)+coalesce(m.actual_other_direct_cost,0))/(b.budget_direct_labor_cost+b.budget_material_cost+b.budget_equipment_cost+b.budget_subcontractor_cost+b.budget_other_cost),2) else 0 end budget_cost_used_percent
from budget_totals b left join labor l on l.company_id=b.company_id and l.project_id=b.project_id
left join manual m on m.company_id=b.company_id and m.project_id=b.project_id;

create or replace view public.project_scope_forecast_summary with (security_invoker=true) as
with latest as (
  select distinct on (u.company_id,u.budget_section_id) u.*
  from public.project_scope_progress_updates u order by u.company_id,u.budget_section_id,u.as_of_date desc,u.id desc
), actuals as (
  select s.company_id,s.id budget_section_id,
    coalesce(t.actual_labor_hours,0)::numeric actual_labor_hours,coalesce(t.actual_direct_labor_cost,0)::numeric actual_direct_labor_cost,
    coalesce(c.actual_material_cost,0)::numeric actual_material_cost,coalesce(c.actual_equipment_cost,0)::numeric actual_equipment_cost,
    coalesce(c.actual_subcontractor_cost,0)::numeric actual_subcontractor_cost,coalesce(c.actual_other_cost,0)::numeric actual_other_cost
  from public.project_budget_sections s
  left join (select company_id,budget_section_id,sum(hours)::numeric actual_labor_hours,sum(direct_labor_cost)::numeric actual_direct_labor_cost
    from public.timecards group by company_id,budget_section_id) t on t.company_id=s.company_id and t.budget_section_id=s.id
  left join (select c.company_id,c.budget_section_id,
      sum(c.total_cost) filter(where cc.cost_type='material')::numeric actual_material_cost,
      sum(c.total_cost) filter(where cc.cost_type='equipment')::numeric actual_equipment_cost,
      sum(c.total_cost) filter(where cc.cost_type='subcontractor')::numeric actual_subcontractor_cost,
      sum(c.total_cost) filter(where cc.cost_type='other' or cc.cost_type is null)::numeric actual_other_cost
    from public.project_costs c left join public.cost_codes cc on cc.company_id=c.company_id and cc.id=c.cost_code_id
    group by c.company_id,c.budget_section_id) c on c.company_id=s.company_id and c.budget_section_id=s.id
), facts as (
  select s.company_id,b.project_id,s.id budget_section_id,s.name,s.sort_order,
    s.budget_labor_hours,s.budget_direct_labor_cost,s.budget_material_cost,s.budget_equipment_cost,s.budget_subcontractor_cost,s.budget_other_cost,
    l.physical_percent_complete,l.as_of_date,l.remaining_labor_hours_override,l.remaining_material_cost_override,l.remaining_equipment_cost_override,l.remaining_subcontractor_cost_override,l.remaining_other_cost_override,
    coalesce(a.actual_labor_hours,0) actual_labor_hours,coalesce(a.actual_direct_labor_cost,0) actual_direct_labor_cost,
    coalesce(a.actual_material_cost,0) actual_material_cost,coalesce(a.actual_equipment_cost,0) actual_equipment_cost,
    coalesce(a.actual_subcontractor_cost,0) actual_subcontractor_cost,coalesce(a.actual_other_cost,0) actual_other_cost
  from public.project_budget_sections s join public.project_budgets b on b.company_id=s.company_id and b.id=s.budget_id and b.status='active'
  left join latest l on l.company_id=s.company_id and l.budget_section_id=s.id
  left join actuals a on a.company_id=s.company_id and a.budget_section_id=s.id
)
select f.company_id,f.project_id,f.budget_section_id,f.name,f.sort_order,f.physical_percent_complete,f.as_of_date,
  f.actual_labor_hours,f.budget_labor_hours,
  case when f.remaining_labor_hours_override is not null then f.actual_labor_hours+f.remaining_labor_hours_override
    when f.physical_percent_complete is null or f.physical_percent_complete>=100 then f.actual_labor_hours
    when f.physical_percent_complete>0 then f.actual_labor_hours/(f.physical_percent_complete/100) else f.budget_labor_hours end forecast_labor_hours_at_completion,
  (case when f.remaining_labor_hours_override is not null then f.remaining_labor_hours_override else greatest(f.budget_labor_hours-f.actual_labor_hours,0) end)::numeric forecast_remaining_labor_hours,
  coalesce(f.remaining_material_cost_override,greatest(f.budget_material_cost-f.actual_material_cost,0))::numeric forecast_remaining_material_cost,
  coalesce(f.remaining_equipment_cost_override,greatest(f.budget_equipment_cost-f.actual_equipment_cost,0))::numeric forecast_remaining_equipment_cost,
  coalesce(f.remaining_subcontractor_cost_override,greatest(f.budget_subcontractor_cost-f.actual_subcontractor_cost,0))::numeric forecast_remaining_subcontractor_cost,
  coalesce(f.remaining_other_cost_override,greatest(f.budget_other_cost-f.actual_other_cost,0))::numeric forecast_remaining_other_cost,
  ((case when f.remaining_labor_hours_override is not null then f.actual_labor_hours+f.remaining_labor_hours_override when f.physical_percent_complete is not null and f.physical_percent_complete>0 then f.actual_labor_hours/(f.physical_percent_complete/100) else f.budget_labor_hours end)-f.budget_labor_hours)::numeric forecast_labor_hours_variance,
  case when f.physical_percent_complete is null then 'needs_progress'
    when ((case when f.remaining_labor_hours_override is not null then f.actual_labor_hours+f.remaining_labor_hours_override when f.physical_percent_complete>0 then f.actual_labor_hours/(f.physical_percent_complete/100) else f.budget_labor_hours end)-f.budget_labor_hours)>0.01 then 'high_risk'
    when ((case when f.remaining_labor_hours_override is not null then f.actual_labor_hours+f.remaining_labor_hours_override when f.physical_percent_complete>0 then f.actual_labor_hours/(f.physical_percent_complete/100) else f.budget_labor_hours end)-f.budget_labor_hours)>-0.01 then 'on_watch' else 'on_track' end forecast_status
from facts f;

create or replace view public.project_cost_to_complete_summary with (security_invoker=true) as
with scopes as (
  select s.company_id,s.project_id,
    coalesce(sum(coalesce(s.forecast_remaining_labor_hours,0)),0) remaining_labor_hours,
    coalesce(sum(coalesce(s.forecast_remaining_material_cost,0)+coalesce(s.forecast_remaining_equipment_cost,0)+coalesce(s.forecast_remaining_subcontractor_cost,0)+coalesce(s.forecast_remaining_other_cost,0)),0) remaining_nonlabor_cost,
    count(*) filter(where s.forecast_status='high_risk') scopes_high_risk,
    count(*) filter(where s.forecast_status='on_watch') scopes_on_watch,
    count(*) filter(where s.forecast_status='needs_progress') scopes_needing_progress,
    avg(s.physical_percent_complete) weighted_physical_percent_complete
  from public.project_scope_forecast_summary s group by s.company_id,s.project_id
), budget as (
  select * from public.project_budget_actual_summary
)
select b.company_id,b.project_id,b.budget_id,b.label,b.target_margin_percent,
  b.actual_total_company_cost current_true_company_cost,
  (coalesce(s.remaining_labor_hours,0)*case when b.budget_labor_hours>0 then b.budget_direct_labor_cost/b.budget_labor_hours else 0 end+coalesce(s.remaining_nonlabor_cost,0))::numeric forecast_cost_to_complete,
  (b.actual_total_company_cost+coalesce(s.remaining_labor_hours,0)*case when b.budget_labor_hours>0 then b.budget_direct_labor_cost/b.budget_labor_hours else 0 end+coalesce(s.remaining_nonlabor_cost,0))::numeric forecast_cost_at_completion,
  ((b.budget_direct_labor_cost+b.budget_material_cost+b.budget_equipment_cost+b.budget_subcontractor_cost+b.budget_other_cost)-(b.actual_total_company_cost+coalesce(s.remaining_labor_hours,0)*case when b.budget_labor_hours>0 then b.budget_direct_labor_cost/b.budget_labor_hours else 0 end+coalesce(s.remaining_nonlabor_cost,0)))::numeric forecast_variance_to_budget,
  coalesce(s.weighted_physical_percent_complete,0)::numeric weighted_physical_percent_complete,
  coalesce(s.scopes_high_risk,0)::integer scopes_high_risk,coalesce(s.scopes_on_watch,0)::integer scopes_on_watch,coalesce(s.scopes_needing_progress,0)::integer scopes_needing_progress,
  (b.actual_total_company_cost+coalesce(s.remaining_labor_hours,0)*case when b.budget_labor_hours>0 then b.budget_direct_labor_cost/b.budget_labor_hours else 0 end+coalesce(s.remaining_nonlabor_cost,0))::numeric forecast_profit_at_completion,
  case when coalesce(p.contract_value,0)>0 then round(100*(p.contract_value-(b.actual_total_company_cost+coalesce(s.remaining_labor_hours,0)*case when b.budget_labor_hours>0 then b.budget_direct_labor_cost/b.budget_labor_hours else 0 end+coalesce(s.remaining_nonlabor_cost,0)))/p.contract_value,2) else 0 end forecast_margin_at_completion
from budget b join public.projects p on p.company_id=b.company_id and p.id=b.project_id
left join scopes s on s.company_id=b.company_id and s.project_id=b.project_id;

create or replace view public.project_financial_summary with (security_invoker=true) as
select p.company_id,p.id project_id,p.job_number,p.name project_name,p.contract_value authorized_contract,
  coalesce(b.actual_total_company_cost,0) actual_company_cost,coalesce(b.budget_total_company_cost,0) budget_company_cost,
  coalesce(b.total_cost_remaining,0) budget_remaining_cost,
  coalesce(b.budget_cost_used_percent,0) budget_cost_used_percent,
  coalesce(b.actual_labor_hours,0) actual_labor_hours,coalesce(b.labor_hours_remaining,0) labor_hours_remaining,
  coalesce(f.forecast_cost_at_completion,b.actual_total_company_cost) forecast_cost_at_completion,
  coalesce(f.forecast_margin_at_completion,0) forecast_margin_at_completion,
  coalesce(bs.outstanding_ar,0) outstanding_ar,coalesce(bs.unbilled_contract,0) unbilled_contract,
  coalesce(bs.billed_amount,0) billed_contract,coalesce(bs.collected_amount,0) cash_collected
from public.projects p
left join public.project_budget_actual_summary b on b.company_id=p.company_id and b.project_id=p.id
left join public.project_cost_to_complete_summary f on f.company_id=p.company_id and f.project_id=p.id
left join public.project_billing_summary bs on bs.company_id=p.company_id and bs.project_id=p.id;

alter table public.project_budgets enable row level security;
alter table public.project_budget_sections enable row level security;
alter table public.project_costs enable row level security;
alter table public.project_scope_progress_updates enable row level security;
alter table public.timecards enable row level security;
create policy project_budget_owner_office on public.project_budgets for all to authenticated using(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office')) with check(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'));
create policy project_budget_section_owner_office on public.project_budget_sections for all to authenticated using(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office')) with check(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'));
create policy project_cost_owner_office on public.project_costs for all to authenticated using(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office')) with check(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'));
create policy project_scope_progress_owner_office on public.project_scope_progress_updates for all to authenticated using(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office')) with check(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'));
create policy timecard_owner_office on public.timecards for all to authenticated using(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office')) with check(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'));

revoke all on public.project_budgets,public.project_budget_sections,public.project_costs,public.project_scope_progress_updates,public.timecards from public,anon;
grant select,insert,update,delete on public.project_budgets,public.project_budget_sections,public.project_costs,public.project_scope_progress_updates,public.timecards to authenticated;
revoke all on public.project_budget_actual_summary,public.project_scope_forecast_summary,public.project_cost_to_complete_summary,public.project_financial_summary from public,anon,authenticated;
grant select on public.project_budget_actual_summary,public.project_scope_forecast_summary,public.project_cost_to_complete_summary,public.project_financial_summary to authenticated;

create trigger project_budgets_updated_at before update on public.project_budgets for each row execute function public.set_updated_at();
create trigger project_budget_sections_updated_at before update on public.project_budget_sections for each row execute function public.set_updated_at();
create trigger project_costs_updated_at before update on public.project_costs for each row execute function public.set_updated_at();
create trigger project_scope_progress_updated_at before update on public.project_scope_progress_updates for each row execute function public.set_updated_at();
create trigger timecards_updated_at before update on public.timecards for each row execute function public.set_updated_at();

comment on table public.project_budgets is 'Tenant-scoped job cost baseline; sections preserve the budget authority used for actuals and forecast.';
comment on view public.project_financial_summary is 'Deterministic project financial read model combining budget, actual direct cost, forecast, and billing facts.';
