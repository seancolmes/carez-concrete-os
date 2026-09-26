alter table public.crew_members add column if not exists active boolean not null default true;
create unique index if not exists crew_members_company_id_id_uk on public.crew_members(company_id,id);
create unique index if not exists production_tasks_company_id_id_uk on public.production_tasks(company_id,id);

create table public.work_packages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null,
  name text not null check (length(btrim(name)) > 0),
  location text,
  drawing_reference text,
  description text,
  planned_start_date date,
  planned_end_date date,
  source_type text not null default 'manual' check (source_type in ('manual','accepted_scope','change_order','import')),
  status text not null default 'planned' check (status in ('planned','active','on_hold','completed','cancelled')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,id),
  foreign key(company_id,project_id) references public.projects(company_id,id) on delete restrict
);

create table public.work_package_operations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  work_package_id uuid not null,
  production_task_id uuid not null,
  field_label text,
  sequence integer not null default 10 check (sequence >= 0),
  planned_quantity numeric(14,4) not null check (planned_quantity > 0),
  unit text not null,
  budgeted_man_hours numeric(12,2) check (budgeted_man_hours is null or budgeted_man_hours >= 0),
  baseline_man_hours_per_unit numeric(12,6) check (baseline_man_hours_per_unit is null or baseline_man_hours_per_unit >= 0),
  baseline_source text not null default 'manual',
  measurement_method text not null default 'completion' check (measurement_method in ('completion','ticket')),
  pour_plan_id uuid,
  notes text,
  status text not null default 'planned' check (status in ('planned','in_progress','on_hold','completed','cancelled')),
  completed_at timestamptz,
  completed_by_profile_id uuid references public.profiles(id) on delete set null,
  completed_by_crew_member_id uuid references public.crew_members(id) on delete set null,
  completion_source text check (completion_source is null or completion_source in ('owner_confirmation','employee_confirmation','ticket_sync')),
  actual_quantity numeric(14,4) check (actual_quantity is null or actual_quantity >= 0),
  actual_quantity_source text,
  quantity_review_status text not null default 'auto' check (quantity_review_status in ('auto','review_required','approved')),
  quantity_review_reason text,
  quantity_synced_at timestamptz,
  requires_prior_operations boolean not null default false,
  readiness_hold_reason text,
  readiness_hold_at timestamptz,
  readiness_hold_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,id),
  foreign key(company_id,work_package_id) references public.work_packages(company_id,id) on delete cascade,
  foreign key(company_id,production_task_id) references public.production_tasks(company_id,id) on delete restrict
);

create table public.project_inspections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null,
  required_for_operation_id uuid,
  title text not null check (length(btrim(title)) > 0),
  inspection_type text not null default 'general',
  authority text,
  status text not null default 'required' check (status in ('required','scheduled','passed','failed','waived','cancelled')),
  requested_at timestamptz,
  scheduled_date date,
  scheduled_time time,
  reference_number text,
  result_notes text,
  waived_reason text,
  completed_at timestamptz,
  resulted_by uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,id),
  foreign key(company_id,project_id) references public.projects(company_id,id) on delete cascade,
  foreign key(company_id,required_for_operation_id) references public.work_package_operations(company_id,id) on delete cascade
);

create table public.work_schedule_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null,
  schedule_date date not null,
  item_type text not null default 'work' check (item_type in ('work','pour','inspection','delivery','equipment','meeting','other')),
  title text not null check (length(btrim(title)) > 0),
  production_task_id uuid,
  work_package_operation_id uuid,
  pour_plan_id uuid,
  inspection_id uuid,
  start_time time,
  end_time time,
  crew_needed integer not null default 0 check (crew_needed >= 0),
  status text not null default 'planned' check (status in ('planned','confirmed','in_progress','completed','on_hold','cancelled')),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,id),
  foreign key(company_id,project_id) references public.projects(company_id,id) on delete cascade,
  foreign key(company_id,production_task_id) references public.production_tasks(company_id,id) on delete restrict,
  foreign key(company_id,work_package_operation_id) references public.work_package_operations(company_id,id) on delete set null,
  foreign key(company_id,inspection_id) references public.project_inspections(company_id,id) on delete set null
);

create table public.work_schedule_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  schedule_item_id uuid not null,
  crew_member_id uuid not null references public.crew_members(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(company_id,schedule_item_id,crew_member_id),
  foreign key(company_id,schedule_item_id) references public.work_schedule_items(company_id,id) on delete cascade,
  foreign key(company_id,crew_member_id) references public.crew_members(company_id,id) on delete restrict
);

create index work_packages_project_idx on public.work_packages(company_id,project_id,status);
create index work_package_operations_package_idx on public.work_package_operations(company_id,work_package_id,sequence);
create index project_inspections_operation_idx on public.project_inspections(company_id,required_for_operation_id,status);
create index work_schedule_items_date_idx on public.work_schedule_items(company_id,schedule_date,status);

create or replace view public.work_package_operation_progress with (security_invoker=true) as
select o.company_id,o.id operation_id,p.id project_id,w.id work_package_id,
  p.job_number,p.name project_name,w.name package_name,w.location,o.field_label,t.name task_name,
  o.planned_quantity,o.unit,o.actual_quantity,o.status operation_status,o.sequence,
  o.measurement_method,o.budgeted_man_hours,o.baseline_man_hours_per_unit,
  w.planned_start_date,w.planned_end_date
from public.work_package_operations o
join public.work_packages w on w.company_id=o.company_id and w.id=o.work_package_id
join public.projects p on p.company_id=w.company_id and p.id=w.project_id
join public.production_tasks t on t.company_id=o.company_id and t.id=o.production_task_id;

create or replace view public.work_package_operation_readiness with (security_invoker=true) as
with base as (
  select o.company_id,o.id operation_id,p.id project_id,p.job_number,p.name project_name,
    w.id work_package_id,w.name package_name,w.location,o.field_label,t.name task_name,
    o.planned_quantity,o.unit,o.status operation_status,o.sequence,o.measurement_method,o.baseline_man_hours_per_unit,
    o.pour_plan_id,o.requires_prior_operations,o.readiness_hold_reason,
    coalesce((select count(*)::integer from public.work_package_operations prior_op
      where prior_op.company_id=o.company_id and prior_op.work_package_id=o.work_package_id
        and prior_op.sequence<o.sequence and prior_op.status in ('planned','in_progress','on_hold')),0) prior_open_count,
    coalesce((select count(*)::integer from public.project_inspections i
      where i.company_id=o.company_id and i.required_for_operation_id=o.id),0) inspection_count,
    coalesce((select count(*)::integer from public.project_inspections i
      where i.company_id=o.company_id and i.required_for_operation_id=o.id and i.status in ('passed','waived','cancelled')),0) inspection_clear_count,
    coalesce((select count(*)::integer from public.project_inspections i
      where i.company_id=o.company_id and i.required_for_operation_id=o.id and i.status in ('required','scheduled','failed')),0) inspection_blocking_count,
    (select min(s.schedule_date) from public.work_schedule_items s
      where s.company_id=o.company_id and s.work_package_operation_id=o.id and s.status<>'cancelled') scheduled_work_date
  from public.work_package_operations o
  join public.work_packages w on w.company_id=o.company_id and w.id=o.work_package_id
  join public.projects p on p.company_id=w.company_id and p.id=w.project_id
  join public.production_tasks t on t.company_id=o.company_id and t.id=o.production_task_id
), facts as (
  select b.*,
    case when b.operation_status in ('completed','cancelled') then false
      when b.operation_status='on_hold' or b.readiness_hold_reason is not null then false
      when b.requires_prior_operations and b.prior_open_count>0 then false
      when b.inspection_blocking_count>0 then false
      when b.measurement_method='ticket' and b.pour_plan_id is null then false
      else true end ready_to_start,
    array_remove(array[
      case when b.operation_status='on_hold' then 'Operation is on hold.'::text end,
      case when b.readiness_hold_reason is not null then b.readiness_hold_reason end,
      case when b.requires_prior_operations and b.prior_open_count>0 then format('%s prior operation(s) remain open.',b.prior_open_count) end,
      case when b.inspection_blocking_count>0 then format('%s inspection(s) must pass, be waived, or be cancelled.',b.inspection_blocking_count) end,
      case when b.measurement_method='ticket' and b.pour_plan_id is null then 'Ticket-tracked production requires a linked pour.'::text end
    ]::text[],null) blocking_reasons,
    array['Resource readiness is not yet connected to this source contract.']::text[] warning_reasons
  from base b
)
select f.company_id,f.operation_id,f.project_id,f.project_name,f.job_number,f.work_package_id,f.package_name,f.location,
  f.field_label,f.task_name,f.planned_quantity,f.unit,f.operation_status,f.sequence,f.scheduled_work_date,
  f.baseline_man_hours_per_unit,
  f.ready_to_start,f.ready_to_start ready_to_start_all,
  case when f.operation_status in ('completed','cancelled') then 'closed'
    when f.ready_to_start then 'ready' else 'blocked' end readiness_status,
  coalesce(f.blocking_reasons[1],case when f.ready_to_start then 'Ready to start.' else 'Readiness facts require review.' end) next_action,
  f.blocking_reasons, f.warning_reasons,
  f.prior_open_count,f.requires_prior_operations,f.inspection_blocking_count,f.inspection_clear_count,f.inspection_count,
  f.measurement_method,case when f.measurement_method='ticket' then 'not_linked' else null end pour_status,
  null::numeric ordered_cy,null::text pour_name,f.readiness_hold_reason,
  0::integer blocking_resource_count,0::integer resource_warning_count,
  f.blocking_reasons all_blocking_reasons,f.warning_reasons all_warning_reasons
from facts f;

create or replace view public.work_package_start_readiness with (security_invoker=true) as
select r.company_id,r.operation_id,r.project_id,r.project_name,r.job_number,r.work_package_id,r.package_name,r.location,
  r.field_label,r.task_name,r.planned_quantity,r.unit,r.operation_status,r.sequence,r.scheduled_work_date,
  r.ready_to_start,r.ready_to_start_all,r.readiness_status,r.next_action start_next_action,
  r.blocking_reasons,r.warning_reasons,r.all_blocking_reasons,r.all_warning_reasons,
  r.prior_open_count,r.requires_prior_operations,r.inspection_blocking_count,r.inspection_clear_count,r.inspection_count,
  r.measurement_method,r.pour_status,r.ordered_cy,r.pour_name,r.readiness_hold_reason,
  r.blocking_resource_count,r.resource_warning_count
from public.work_package_operation_readiness r;

create or replace view public.work_package_lookahead with (security_invoker=true) as
select s.company_id,s.id schedule_item_id,s.project_id,s.schedule_date,s.start_time,s.end_time,s.status,s.item_type,
  p.job_number,p.name project_name,w.name package_name,w.location,
  r.operation_id work_package_operation_id,r.field_label,r.task_name,r.planned_quantity,r.unit,
  s.crew_needed,coalesce(a.assigned_crew,0)::integer assigned_crew,
  coalesce(r.ready_to_start,false) ready_to_start,coalesce(r.warning_reasons,array[]::text[]) warning_reasons,
  coalesce(r.next_action,'No linked operation readiness record.') next_action,
  coalesce(case when not r.ready_to_start then r.planned_quantity*coalesce(r.baseline_man_hours_per_unit,0) else 0 end,0)::numeric planned_man_hours_at_risk,
  coalesce(r.blocking_reasons,array[]::text[]) blocking_reasons,
  r.blocking_resource_count,r.resource_warning_count,
  null::uuid replacement_operation_id,null::text replacement_package_name,null::text replacement_work_label
from public.work_schedule_items s
join public.projects p on p.company_id=s.company_id and p.id=s.project_id
left join public.work_package_operations o on o.company_id=s.company_id and o.id=s.work_package_operation_id
left join public.work_packages w on w.company_id=o.company_id and w.id=o.work_package_id
left join public.work_package_operation_readiness r on r.company_id=s.company_id and r.operation_id=s.work_package_operation_id
left join (select company_id,schedule_item_id,count(*)::integer assigned_crew from public.work_schedule_assignments group by company_id,schedule_item_id) a
  on a.company_id=s.company_id and a.schedule_item_id=s.id
where s.status<>'cancelled';

alter table public.work_packages enable row level security;
alter table public.work_package_operations enable row level security;
alter table public.project_inspections enable row level security;
alter table public.work_schedule_items enable row level security;
alter table public.work_schedule_assignments enable row level security;

create policy work_package_owner_office on public.work_packages for all to authenticated
  using(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'))
  with check(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'));
create policy work_package_operation_owner_office on public.work_package_operations for all to authenticated
  using(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'))
  with check(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'));
create policy project_inspection_owner_office on public.project_inspections for all to authenticated
  using(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'))
  with check(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'));
create policy work_schedule_item_owner_office on public.work_schedule_items for all to authenticated
  using(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'))
  with check(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'));
create policy work_schedule_assignment_owner_office on public.work_schedule_assignments for all to authenticated
  using(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'))
  with check(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'));

revoke all on public.work_packages,public.work_package_operations,public.project_inspections,public.work_schedule_items,public.work_schedule_assignments from public,anon;
grant select,insert,update,delete on public.work_packages,public.work_package_operations,public.project_inspections,public.work_schedule_items,public.work_schedule_assignments to authenticated;
revoke all on public.work_package_operation_progress,public.work_package_operation_readiness,public.work_package_start_readiness,public.work_package_lookahead from public,anon,authenticated;
grant select on public.work_package_operation_progress,public.work_package_operation_readiness,public.work_package_start_readiness,public.work_package_lookahead to authenticated;

create trigger work_packages_updated_at before update on public.work_packages for each row execute function public.set_updated_at();
create trigger work_package_operations_updated_at before update on public.work_package_operations for each row execute function public.set_updated_at();
create trigger project_inspections_updated_at before update on public.project_inspections for each row execute function public.set_updated_at();
create trigger work_schedule_items_updated_at before update on public.work_schedule_items for each row execute function public.set_updated_at();

comment on table public.work_packages is 'Physical construction scope grouped by job; quantity authority remains in linked operations and their source facts.';
comment on table public.work_package_operations is 'Production operation contract separating planned quantity, completion evidence, and ticket-linked concrete production.';
comment on view public.work_package_operation_readiness is 'Fact-derived pre-start readiness; resource and pour authorities remain explicit until their source contracts are recovered.';
