-- Carez OS: harden resource readiness and employee start gates

create or replace view public.work_package_resource_requirement_status as
with schedule_date as (
  select w.work_package_operation_id operation_id,min(w.schedule_date) filter(where w.schedule_date >= (now() at time zone 'America/Los_Angeles')::date) next_schedule_date
  from public.work_schedule_items w
  where w.status<>'cancelled' and w.item_type='work' and w.work_package_operation_id is not null
  group by w.work_package_operation_id
),
material_reservation as (
  select ir.resource_requirement_id,ir.inventory_item_id,
    coalesce(sum(ir.quantity) filter(where ir.status in ('reserved','consumed')),0) requirement_reserved_qty
  from public.inventory_reservations ir group by ir.resource_requirement_id,ir.inventory_item_id
),
material_total_reserved as (
  select ir.inventory_item_id,coalesce(sum(ir.quantity) filter(where ir.status='reserved'),0) total_reserved_qty
  from public.inventory_reservations ir group by ir.inventory_item_id
),
po_actual as (
  select pol.id purchase_order_line_id,po.status po_status,po.expected_delivery_date,
    pol.quantity ordered_qty,coalesce(sum(r.quantity_received),0) received_qty,po.po_number
  from public.purchase_order_lines pol
  join public.purchase_orders po on po.id=pol.purchase_order_id and po.company_id=pol.company_id
  left join public.purchase_order_receipts r on r.purchase_order_line_id=pol.id and r.company_id=pol.company_id
  group by pol.id,po.status,po.expected_delivery_date,pol.quantity,po.po_number
),
equipment_state as (
  select er.resource_requirement_id,er.equipment_asset_id,er.start_date,er.end_date,er.status reservation_status,
    a.name equipment_name,a.active equipment_active,a.status equipment_status,a.next_service_date,
    (select count(*) from public.equipment_reservations x
      where x.equipment_asset_id=er.equipment_asset_id and x.id<>er.id and x.status in ('planned','confirmed')
        and daterange(x.start_date,x.end_date,'[]') && daterange(er.start_date,er.end_date,'[]'))::int conflict_count
  from public.equipment_reservations er
  join public.equipment_assets a on a.id=er.equipment_asset_id and a.company_id=er.company_id
),
base as (
  select rr.*,o.work_package_id,wp.project_id,wp.planned_start_date,
    coalesce(rr.need_by_override,sd.next_schedule_date + rr.need_offset_days,wp.planned_start_date + rr.need_offset_days) need_by_date,
    i.name inventory_name,i.quantity_on_hand,i.active inventory_active,
    mr.requirement_reserved_qty,mtr.total_reserved_qty,
    pa.po_status,pa.expected_delivery_date,pa.ordered_qty,pa.received_qty,pa.po_number,
    es.start_date equipment_start_date,es.end_date equipment_end_date,es.reservation_status,es.equipment_name,es.equipment_active,es.equipment_status,es.next_service_date,es.conflict_count,
    v.name vendor_name,v.active vendor_active
  from public.work_package_resource_requirements rr
  join public.work_package_operations o on o.id=rr.work_package_operation_id and o.company_id=rr.company_id
  join public.work_packages wp on wp.id=o.work_package_id and wp.company_id=o.company_id
  left join schedule_date sd on sd.operation_id=rr.work_package_operation_id
  left join public.inventory_items i on i.id=rr.inventory_item_id and i.company_id=rr.company_id
  left join material_reservation mr on mr.resource_requirement_id=rr.id
  left join material_total_reserved mtr on mtr.inventory_item_id=rr.inventory_item_id
  left join po_actual pa on pa.purchase_order_line_id=rr.purchase_order_line_id
  left join equipment_state es on es.resource_requirement_id=rr.id
  left join public.vendors v on v.id=rr.vendor_id and v.company_id=rr.company_id
), calc as (
  select b.*,
    case
      when b.inventory_item_id is not null and exists(
        select 1 from public.inventory_reservations ir
        where ir.resource_requirement_id=b.id and ir.status='consumed' and ir.quantity>=b.required_quantity
      ) then b.required_quantity
      when b.inventory_item_id is not null then
        least(coalesce(b.requirement_reserved_qty,0),greatest(coalesce(b.quantity_on_hand,0)-greatest(coalesce(b.total_reserved_qty,0)-coalesce(b.requirement_reserved_qty,0),0),0))
      else 0 end as safe_inventory_qty
  from base b
)
select c.*,
  greatest(c.required_quantity-(c.safe_inventory_qty+coalesce(c.received_qty,0)),0) shortage_quantity,
  case
    when c.waived_at is not null then 'waived'
    when c.resource_type='material' and c.safe_inventory_qty+coalesce(c.received_qty,0)>=c.required_quantity then 'ready'
    when c.resource_type='material' and c.purchase_order_line_id is not null and c.po_status='issued' then 'ordered'
    when c.resource_type='material' then 'missing'
    when c.resource_type='equipment' and coalesce(c.reservation_status,'')='confirmed' and coalesce(c.equipment_active,false)
      and coalesce(c.equipment_status,'available') not in ('service','out_of_service') and coalesce(c.conflict_count,0)=0
      and (c.next_service_date is null or c.need_by_date is null or c.next_service_date>c.need_by_date) then 'ready'
    when c.resource_type='equipment' and c.equipment_asset_id is null then 'missing'
    when c.resource_type='equipment' and coalesce(c.reservation_status,'')='planned' then 'needs_confirmation'
    when c.resource_type='equipment' then 'blocked'
    when c.resource_type='vendor' and c.vendor_status in ('confirmed','completed') and coalesce(c.vendor_active,true) then 'ready'
    when c.resource_type='vendor' and c.vendor_status='requested' then 'needs_confirmation'
    when c.resource_type='vendor' then 'missing'
    else 'missing'
  end resource_status,
  case
    when c.waived_at is not null then null
    when c.resource_type='material' and c.safe_inventory_qty+coalesce(c.received_qty,0)>=c.required_quantity then null
    when c.resource_type='material' and c.purchase_order_line_id is not null and c.po_status='issued' and c.expected_delivery_date is not null and c.need_by_date is not null and c.expected_delivery_date>c.need_by_date then c.label||' arrives after it is needed'
    when c.resource_type='material' and c.purchase_order_line_id is not null and c.po_status='issued' then c.label||' is ordered but not received'
    when c.resource_type='material' then c.label||' is not reserved or received'
    when c.resource_type='equipment' and c.equipment_asset_id is null then c.label||' has no equipment assigned'
    when c.resource_type='equipment' and not coalesce(c.equipment_active,false) then c.label||' equipment is inactive'
    when c.resource_type='equipment' and coalesce(c.equipment_status,'available') in ('service','out_of_service') then c.label||' equipment is unavailable'
    when c.resource_type='equipment' and coalesce(c.conflict_count,0)>0 then c.label||' equipment is reserved for conflicting work'
    when c.resource_type='equipment' and c.next_service_date is not null and c.need_by_date is not null and c.next_service_date<=c.need_by_date then c.label||' needs service before the work starts'
    when c.resource_type='equipment' and coalesce(c.reservation_status,'')<>'confirmed' then c.label||' equipment reservation is not confirmed'
    when c.resource_type='vendor' and c.vendor_id is null then c.label||' has no vendor selected'
    when c.resource_type='vendor' and not coalesce(c.vendor_active,true) then c.label||' vendor is inactive'
    when c.resource_type='vendor' and c.vendor_status not in ('confirmed','completed') then c.label||' vendor is not confirmed'
    else null
  end blocking_reason,
  case
    when c.waived_at is not null then null
    when c.resource_type='material' and c.purchase_order_line_id is not null and c.po_status='issued' and c.expected_delivery_date is not null and c.need_by_date is not null and c.expected_delivery_date=c.need_by_date then c.label||' is scheduled to arrive the day it is needed'
    when c.resource_type='material' and coalesce(c.total_reserved_qty,0)>coalesce(c.quantity_on_hand,0) then c.label||' inventory is over-reserved across work packages'
    when c.resource_type='equipment' and c.reservation_status='planned' then c.label||' equipment reservation still needs confirmation'
    when c.resource_type='vendor' and c.vendor_status='requested' then c.label||' vendor confirmation is still pending'
    else null
  end warning_reason
from calc c;

create or replace function public.carez_enforce_work_package_start_readiness()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare v_ready boolean;v_reason text;
begin
  if new.work_package_operation_id is null then return new; end if;
  select ready_to_start_all,start_next_action into v_ready,v_reason
  from public.work_package_start_readiness
  where operation_id=new.work_package_operation_id and company_id=new.company_id;
  if not coalesce(v_ready,false) then
    raise exception 'This work is on hold: %',coalesce(v_reason,'Office must clear work readiness first');
  end if;
  return new;
end;
$$;

drop trigger if exists carez_employee_segment_readiness_gate on public.employee_task_segments;
create trigger carez_employee_segment_readiness_gate
before insert or update of work_package_operation_id on public.employee_task_segments
for each row execute function public.carez_enforce_work_package_start_readiness();

-- Re-point employee-facing readiness reads to the unified start-readiness view. The prior
-- inspection migration defines these functions; this keeps one source of truth without
-- duplicating large function bodies in every readiness extension.
do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='employee_portal_state' limit 1;
  if d is not null then
    d:=replace(d,'public.work_package_operation_readiness','public.work_package_start_readiness');
    d:=replace(d,'coalesce(rr.ready_to_start,true)','coalesce(rr.ready_to_start_all,true)');
    d:=replace(d,'rr.readiness_status','rr.start_readiness_status');
    d:=replace(d,'rr.next_action','rr.start_next_action');
    d:=replace(d,'rr.blocking_reasons','rr.all_blocking_reasons');
    d:=replace(d,'rr.warning_reasons','rr.all_warning_reasons');
    execute d;
  end if;

  select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='employee_start_work' limit 1;
  if d is not null then
    d:=replace(d,'public.work_package_operation_readiness','public.work_package_start_readiness');
    d:=replace(d,'select ready_to_start,next_action into v_ready,v_reason','select ready_to_start_all,start_next_action into v_ready,v_reason');
    execute d;
  end if;

  select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='employee_start_task' limit 1;
  if d is not null then
    d:=replace(d,'public.work_package_operation_readiness','public.work_package_start_readiness');
    d:=replace(d,'r.ready_to_start,r.next_action,r.package_name','r.ready_to_start_all,r.start_next_action,r.package_name');
    execute d;
  end if;

  select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='employee_clock_in' limit 1;
  if d is not null then
    d:=replace(d,'public.work_package_operation_readiness','public.work_package_start_readiness');
    d:=replace(d,'coalesce(r.ready_to_start,false)','coalesce(r.ready_to_start_all,false)');
    d:=replace(d,'not coalesce(r.ready_to_start,false)','not coalesce(r.ready_to_start_all,false)');
    d:=replace(d,'not r2.ready_to_start','not r2.ready_to_start_all');
    d:=replace(d,'r.next_action','r.start_next_action');
    d:=replace(d,'and r.ready_to_start','and r.ready_to_start_all');
    execute d;
  end if;
end $$;
