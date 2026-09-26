alter table public.purchase_order_lines add column if not exists work_package_operation_id uuid;
create index if not exists purchase_order_lines_work_package_operation_idx on public.purchase_order_lines(company_id,work_package_operation_id);

create table public.work_package_resource_requirements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  work_package_operation_id uuid not null,
  resource_type text not null check (resource_type in ('material','equipment','vendor')),
  label text not null check (length(btrim(label))>0),
  required_quantity numeric(14,4) not null check (required_quantity>0),
  unit text not null default 'EA',
  inventory_item_id uuid,
  equipment_asset_id uuid,
  vendor_id uuid,
  purchase_order_line_id uuid,
  required_before_start boolean not null default true,
  need_offset_days integer not null default 0,
  need_by_override date,
  vendor_status text not null default 'needed' check (vendor_status in ('needed','requested','confirmed','completed','cancelled')),
  vendor_reference text,
  notes text,
  waived_at timestamptz,
  waived_by uuid references public.profiles(id) on delete set null,
  waiver_reason text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,id),
  foreign key(company_id,work_package_operation_id) references public.work_package_operations(company_id,id) on delete cascade
);

create index work_package_resource_requirements_operation_idx on public.work_package_resource_requirements(company_id,work_package_operation_id,resource_type);

create or replace view public.work_package_resource_requirement_status with (security_invoker=true) as
select r.company_id,r.id,r.work_package_operation_id,r.resource_type,r.label,r.required_quantity,r.unit,
  r.inventory_item_id,r.equipment_asset_id,r.vendor_id,r.purchase_order_line_id,r.required_before_start,
  r.need_by_override,coalesce(r.need_by_override,(p.planned_start_date-r.need_offset_days)) need_by_date,
  r.vendor_status,r.vendor_reference,r.notes,r.waived_at,r.waiver_reason,
  p.project_id,p.job_number,p.project_name,w.name package_name,w.location,p.field_label,p.task_name,p.operation_status,
  case when r.waived_at is not null then 'waived'
    when r.resource_type='vendor' and r.vendor_status in ('confirmed','completed') then 'ready'
    when r.resource_type='vendor' then 'needed'
    when r.resource_type='material' and (r.inventory_item_id is not null or r.purchase_order_line_id is not null) then 'unverified'
    when r.resource_type='equipment' and r.equipment_asset_id is not null then 'unverified'
    else 'needed' end resource_status,
  0::numeric safe_inventory_qty,0::numeric received_qty,
  case when r.resource_type='material' then r.required_quantity else 0 end shortage_quantity,
  null::numeric requirement_reserved_qty,null::text equipment_name,null::text equipment_start_date,null::text equipment_end_date,
  null::text vendor_name,
  case when r.waived_at is not null then null
    when r.resource_type='vendor' and r.vendor_status in ('confirmed','completed') then null
    when r.resource_type='material' and r.inventory_item_id is null and r.purchase_order_line_id is null then 'Material source is not connected.'
    when r.resource_type='equipment' and r.equipment_asset_id is null then 'Equipment source is not assigned.'
    when r.resource_type='material' then 'Material receipt or reservation evidence is not connected.'
    when r.resource_type='equipment' then 'Equipment availability evidence is not connected.'
    else 'Vendor confirmation is required.' end blocking_reason,
  case when r.waived_at is null and r.resource_type='material' and (r.inventory_item_id is not null or r.purchase_order_line_id is not null) then 'Provider inventory and receipt contracts are not connected.'
    when r.waived_at is null and r.resource_type='equipment' and r.equipment_asset_id is not null then 'Provider equipment reservation contract is not connected.'
    else null end warning_reason
from public.work_package_resource_requirements r
join public.work_package_operation_progress p on p.company_id=r.company_id and p.operation_id=r.work_package_operation_id
join public.work_packages w on w.company_id=r.company_id and w.id=p.work_package_id
join public.work_package_operations o on o.company_id=r.company_id and o.id=r.work_package_operation_id;

alter table public.work_package_resource_requirements enable row level security;
create policy resource_requirement_owner_office on public.work_package_resource_requirements for all to authenticated
  using(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'))
  with check(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'));
revoke all on public.work_package_resource_requirements from public,anon;
grant select,insert,update,delete on public.work_package_resource_requirements to authenticated;
revoke all on public.work_package_resource_requirement_status from public,anon;
grant select on public.work_package_resource_requirement_status to authenticated;
create trigger work_package_resource_requirements_updated_at before update on public.work_package_resource_requirements for each row execute function public.set_updated_at();

comment on table public.work_package_resource_requirements is 'Resource gates attached to physical operations; provider-specific inventory, equipment, and vendor facts remain separate authorities.';
comment on view public.work_package_resource_requirement_status is 'Resource readiness read model with explicit unverified status when provider evidence is not connected.';
