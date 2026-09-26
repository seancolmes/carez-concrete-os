create table public.overhead_rate_snapshots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  effective_date date not null,
  overhead_rate_per_productive_hour numeric(12,4) not null check (overhead_rate_per_productive_hour >= 0),
  source_type text not null check (source_type in ('configured','unconfigured_zero')),
  source_label text not null,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(company_id,effective_date)
);

create or replace function public.capture_overhead_rate_snapshot(p_effective_date date default current_date)
returns table (id uuid, effective_date date, overhead_rate_per_productive_hour numeric, source_type text, source_label text, notes text)
language plpgsql security definer set search_path=pg_catalog,public,auth,extensions as $$
declare v_company uuid; v_date date:=coalesce(p_effective_date,current_date);
begin
  select p.company_id into v_company from public.profiles p where p.id=auth.uid();
  if v_company is null then raise exception 'No company is associated with the authenticated user.'; end if;
  return query
    select s.id,s.effective_date,s.overhead_rate_per_productive_hour,s.source_type,s.source_label,s.notes
    from public.overhead_rate_snapshots s
    where s.company_id=v_company and s.effective_date<=v_date
    order by s.effective_date desc limit 1;
  if found then return; end if;
  insert into public.overhead_rate_snapshots(company_id,effective_date,overhead_rate_per_productive_hour,source_type,source_label,notes,created_by)
  select v_company,v_date,0,'unconfigured_zero','No overhead rate configured','Explicit zero basis; enter a supported overhead rate before relying on company-cost recovery.',auth.uid()
  where not exists (select 1 from public.overhead_rate_snapshots existing where existing.company_id=v_company and existing.effective_date=v_date);
  return query
    select s.id,s.effective_date,s.overhead_rate_per_productive_hour,s.source_type,s.source_label,s.notes
    from public.overhead_rate_snapshots s
    where s.company_id=v_company and s.effective_date=v_date;
end; $$;

alter table public.overhead_rate_snapshots enable row level security;
create policy overhead_rate_owner_office on public.overhead_rate_snapshots for all to authenticated
  using(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'))
  with check(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'));
revoke all on public.overhead_rate_snapshots from public,anon;
grant select,insert,update,delete on public.overhead_rate_snapshots to authenticated;
revoke all on function public.capture_overhead_rate_snapshot(date) from public,anon;
grant execute on function public.capture_overhead_rate_snapshot(date) to authenticated;

create or replace view public.project_award_operations_handoff with (security_invoker=true) as
with package_counts as (
  select w.company_id,w.project_id,count(*) filter(where w.status<>'cancelled')::integer work_package_count
  from public.work_packages w group by w.company_id,w.project_id
), operation_counts as (
  select w.company_id,w.project_id,count(*) filter(where o.status<>'cancelled')::integer operation_count
  from public.work_packages w join public.work_package_operations o on o.company_id=w.company_id and o.work_package_id=w.id
  where w.status<>'cancelled' group by w.company_id,w.project_id
), inspection_counts as (
  select i.company_id,i.project_id,count(*) filter(where i.status<>'cancelled')::integer inspection_count
  from public.project_inspections i group by i.company_id,i.project_id
)
select p.company_id,p.id project_id,p.job_number,p.name project_name,
  case when coalesce(pc.work_package_count,0)>0 then 'generated' else 'manual' end handoff_status,
  coalesce(pc.work_package_count,0) work_package_count,
  coalesce(oc.operation_count,0) operation_count,
  coalesce(ic.inspection_count,0) inspection_count,
  null::integer pour_plan_count,
  null::integer resource_requirement_count,
  case when coalesce(pc.work_package_count,0)>0 then 'Review operation readiness and connect pour/resource gates before field start.'
    else 'Create Work Packages from accepted scope before scheduling field work.' end next_action
from public.projects p
left join package_counts pc on pc.company_id=p.company_id and pc.project_id=p.id
left join operation_counts oc on oc.company_id=p.company_id and oc.project_id=p.id
left join inspection_counts ic on ic.company_id=p.company_id and ic.project_id=p.id;

create or replace view public.work_package_financial_summary with (security_invoker=true) as
with tracked as (
  select e.company_id,e.work_package_operation_id,
    sum(t.hours*extract(epoch from (e.ended_at-e.started_at))/nullif(ss.total_seconds,0))::numeric approved_operation_hours,
    sum(t.direct_labor_cost*extract(epoch from (e.ended_at-e.started_at))/nullif(ss.total_seconds,0))::numeric actual_direct_labor_cost,
    sum(t.overhead_recovery_cost*extract(epoch from (e.ended_at-e.started_at))/nullif(ss.total_seconds,0))::numeric actual_overhead_cost
  from public.employee_task_segments e
  join public.employee_shift_sessions s on s.company_id=e.company_id and s.id=e.shift_id and s.status='approved'
  join public.timecards t on t.company_id=s.company_id and t.source_shift_id=s.id and t.approval_status='approved'
  join lateral (select sum(extract(epoch from (e2.ended_at-e2.started_at))) total_seconds from public.employee_task_segments e2 where e2.company_id=e.company_id and e2.shift_id=e.shift_id and e2.ended_at is not null) ss on true
  where e.work_package_operation_id is not null and e.ended_at is not null
  group by e.company_id,e.work_package_operation_id
)
select p.company_id,p.project_id,p.job_number,p.project_name,p.work_package_id,p.package_name,p.location,
  p.operation_id,p.field_label,p.task_name,p.planned_quantity,p.actual_quantity,p.unit,p.operation_status,
  null::uuid source_estimate_item_id,null::numeric source_estimate_direct_cost,null::text source_estimate_description,
  coalesce(t.approved_operation_hours,0)::numeric approved_operation_hours,
  coalesce(t.actual_direct_labor_cost,0)::numeric actual_direct_labor_cost,
  coalesce(t.actual_overhead_cost,0)::numeric actual_overhead_cost,
  coalesce(t.actual_direct_labor_cost,0)::numeric actual_direct_cost_to_date,
  (coalesce(t.actual_direct_labor_cost,0)+coalesce(t.actual_overhead_cost,0))::numeric actual_company_cost_to_date,
  null::numeric procurement_actual_cost,null::numeric open_commitment,
  (coalesce(t.actual_direct_labor_cost,0)+coalesce(t.actual_overhead_cost,0))::numeric current_cost_exposure,
  case when coalesce(p.actual_quantity,p.planned_quantity)>0 then (coalesce(t.actual_direct_labor_cost,0)+coalesce(t.actual_overhead_cost,0))/coalesce(p.actual_quantity,p.planned_quantity) else null end actual_company_cost_per_unit,
  null::numeric completed_direct_cost_variance_to_source,
  case when p.operation_status='completed' then 'source_cost_unlinked' else 'in_progress' end financial_status
from public.work_package_operation_progress p
left join tracked t on t.company_id=p.company_id and t.work_package_operation_id=p.operation_id;

revoke all on public.project_award_operations_handoff,public.work_package_financial_summary from public,anon;
grant select on public.project_award_operations_handoff,public.work_package_financial_summary to authenticated;

comment on view public.project_award_operations_handoff is 'Award-to-field handoff read model; pour and resource counts remain explicitly unconnected until their source contracts are recovered.';
comment on view public.work_package_financial_summary is 'Operation financial read model; source estimate and procurement values remain null until their authoritative links are recovered.';
