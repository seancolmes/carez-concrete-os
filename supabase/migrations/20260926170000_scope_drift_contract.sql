create table public.scope_drift_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null,
  work_package_operation_id uuid,
  change_order_id uuid,
  signal_key text not null,
  source_type text not null,
  work_date date,
  detected_at timestamptz not null default now(),
  severity text not null default 'watch' check (severity in ('critical','high','watch','info')),
  title text not null check (length(btrim(title))>0),
  details text,
  labor_hours numeric(12,2) check (labor_hours is null or labor_hours>=0),
  quantity_variance numeric(14,4),
  unit text,
  classification text not null default 'unknown' check (classification in ('unknown','customer_change','gc_direction','design_change','unforeseen_condition','rework','estimate_miss','productivity','internal_error','no_scope_change')),
  status text not null default 'open' check (status in ('open','potential_change','linked_change_order','explained','dismissed')),
  resolution_note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,id),
  unique(company_id,signal_key),
  foreign key(company_id,project_id) references public.projects(company_id,id) on delete cascade,
  foreign key(company_id,work_package_operation_id) references public.work_package_operations(company_id,id) on delete set null,
  foreign key(company_id,change_order_id) references public.change_orders(company_id,id) on delete set null
);

create index scope_drift_events_project_status_idx on public.scope_drift_events(company_id,project_id,status,detected_at desc);

create or replace view public.scope_drift_inbox with (security_invoker=true) as
select r.company_id,
  'labor_overrun:'||r.operation_id::text signal_key,
  r.project_id,r.operation_id work_package_operation_id,
  current_date work_date,'labor_overrun' source_type,
  case when r.labor_risk='over_budget' then 'critical' when r.labor_risk='watch' then 'high' else 'watch' end severity,
  r.job_number||' — '||coalesce(r.field_label,r.task_name) title,
  format('Tracked labor is %s%% of the approved operation budget.',coalesce(r.budget_hours_used_percent,0)) details,
  r.tracked_man_hours labor_hours,null::numeric quantity_variance,null::text unit,
  true uncaptured
from public.production_operation_risk r
where r.needs_attention and r.operation_status in ('planned','in_progress','on_hold')
  and not exists(select 1 from public.scope_drift_events e where e.company_id=r.company_id and e.signal_key='labor_overrun:'||r.operation_id::text);

alter table public.scope_drift_events enable row level security;
create policy scope_drift_owner_office on public.scope_drift_events for all to authenticated
  using(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'))
  with check(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'));
revoke all on public.scope_drift_events from public,anon;
grant select,insert,update,delete on public.scope_drift_events to authenticated;
revoke all on public.scope_drift_inbox from public,anon;
grant select on public.scope_drift_inbox to authenticated;
create trigger scope_drift_events_updated_at before update on public.scope_drift_events for each row execute function public.set_updated_at();

comment on table public.scope_drift_events is 'Human-reviewed scope-drift evidence. Automatic signals are not change orders until classified and linked.';
comment on view public.scope_drift_inbox is 'Uncaptured production signals requiring human scope-drift review.';
