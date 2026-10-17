-- Resource selections/reservations and inventory movements are atomic and replay-safe.
set local search_path=pg_catalog,public,extensions;
alter table public.inventory_items alter column average_unit_cost drop not null;
alter table public.inventory_items alter column average_unit_cost drop default;
create or replace function public.carez_guard_procurement_source_line()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare
 v jsonb; prior jsonb; h record; linked record; parent uuid; parent_field text;
 expected text; field text; value numeric;
begin
 v:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 if tg_op='UPDATE' then
  prior:=to_jsonb(old);
  if v->>'id' is distinct from prior->>'id' or v->>'company_id' is distinct from prior->>'company_id' then
   raise exception 'Source identity and company cannot change';
  end if;
 end if;
 if tg_table_name='vendor_quote_lines' then
  parent_field:='vendor_quote_id'; expected:='received'; parent:=(v->>parent_field)::uuid;
  select id,company_id,project_id,vendor_id,status into h from public.vendor_quotes where id=parent for update;
 elsif tg_table_name='purchase_order_lines' then
  parent_field:='purchase_order_id'; expected:='draft'; parent:=(v->>parent_field)::uuid;
  select id,company_id,project_id,vendor_id,status into h from public.purchase_orders where id=parent for update;
 elsif tg_table_name='vendor_bill_lines' then
  parent_field:='vendor_bill_id'; expected:='draft'; parent:=(v->>parent_field)::uuid;
  select id,company_id,project_id,vendor_id,status,purchase_order_id into h from public.vendor_bills where id=parent for update;
 elsif tg_table_name='purchase_order_receipts' then
  parent_field:='purchase_order_id'; expected:='issued'; parent:=(v->>parent_field)::uuid;
  select id,company_id,project_id,vendor_id,status into h from public.purchase_orders where id=parent for update;
 else raise exception 'Unsupported procurement source'; end if;
 if h.id is null then
  -- A cascading parent deletion has already established the parent permission.
  if tg_op='DELETE' then return old; end if;
  raise exception 'Procurement parent is unavailable';
 end if;
 if h.company_id is distinct from (v->>'company_id')::uuid then raise exception 'Procurement parent belongs to another company'; end if;
 if current_user not in ('postgres','supabase_admin','service_role') and h.company_id is distinct from public.get_my_company_id() then raise exception 'Company authority required'; end if;
 if tg_op='UPDATE' and v->>parent_field is distinct from prior->>parent_field then raise exception 'Source lines cannot be moved between records'; end if;
 if tg_table_name='purchase_order_lines' and tg_op='UPDATE' and h.status='issued'
  and (to_jsonb(new)-array['work_package_operation_id','updated_at'])=(to_jsonb(old)-array['work_package_operation_id','updated_at'])
  and exists(select 1 from public.financial_command_requests r where r.company_id=h.company_id and r.request_id=nullif(current_setting('carez.resource_request',true),'')::uuid and r.actor_id=auth.uid() and r.command in ('resource_create','resource_link_po') and r.result is null)
 then
  if not exists(select 1 from public.work_package_operations o join public.work_packages w on w.company_id=o.company_id and w.id=o.work_package_id where o.company_id=h.company_id and o.id=new.work_package_operation_id and w.project_id=h.project_id) then raise exception 'PO operation belongs to another job';end if;
  return new;
 end if;
 if h.status is distinct from expected then raise exception 'This % is locked in its current state',tg_table_name; end if;
 if tg_op='DELETE' then return old; end if;
 foreach field in array array['quantity','unit_cost','subtotal','sales_tax','total_cost','quantity_received'] loop
  if v ? field then
   value:=(v->>field)::numeric;
   if value is null or value::text in ('NaN','Infinity','-Infinity') or value<0 then raise exception 'Invalid %',field; end if;
  end if;
 end loop;
 if tg_table_name='purchase_order_receipts' then
  if (v->>'quantity_received')::numeric<=0 then raise exception 'Receipt quantity must be greater than zero'; end if;
  select purchase_order_id,company_id into linked from public.purchase_order_lines where id=(v->>'purchase_order_line_id')::uuid;
  if linked.company_id is distinct from h.company_id or linked.purchase_order_id is distinct from parent then raise exception 'Receipt line does not belong to this purchase order'; end if;
 elsif tg_table_name='vendor_bill_lines' and v->>'purchase_order_line_id' is not null then
  select l.purchase_order_id,l.company_id,p.project_id,p.vendor_id into linked from public.purchase_order_lines l
   join public.purchase_orders p on p.id=l.purchase_order_id and p.company_id=l.company_id where l.id=(v->>'purchase_order_line_id')::uuid;
  if linked.company_id is distinct from h.company_id or linked.purchase_order_id is distinct from h.purchase_order_id
   or linked.project_id is distinct from h.project_id or linked.vendor_id is distinct from h.vendor_id then
   raise exception 'Bill line does not belong to this bill purchase order, vendor and job';
  end if;
 end if;
 if tg_table_name<>'purchase_order_receipts' then
  if not exists(select 1 from public.cost_codes c where c.id=(v->>'cost_code_id')::uuid and c.company_id=h.company_id) then raise exception 'Cost code belongs to another company or is unavailable'; end if;
  if v->>'catalog_item_id' is not null and not exists(select 1 from public.cost_catalog_items c where c.id=(v->>'catalog_item_id')::uuid and c.company_id=h.company_id) then raise exception 'Catalog item belongs to another company or is unavailable'; end if;
 end if;
 return new;
end $$;
revoke all on function public.carez_guard_procurement_source_line() from public,anon,authenticated;

create function public.carez_resource_command_v1(p_request_id uuid,p_command text,p_values jsonb) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_request jsonb;v_company uuid;v_id uuid;v_req public.work_package_resource_requirements%rowtype;v_item public.inventory_items%rowtype;v_line public.purchase_order_lines%rowtype;v_po public.purchase_orders%rowtype;
 v_operation public.work_package_operations%rowtype;v_project uuid;v_inventory uuid;v_equipment uuid;v_vendor uuid;v_qty numeric;v_reserve numeric;v_cost numeric;v_date date;v_end date;v_type text;v_unit text;v_reason text;v_delta numeric;v_res public.inventory_reservations%rowtype;v_equipment_before jsonb;
begin
 if p_command is null or p_command not in ('create','reserve_material','link_po','consume','reserve_equipment','vendor','waive','restore','delete','create_inventory','adjust_inventory') then raise exception 'Unknown resource command';end if;
 v_request:=public.carez_financial_request_begin(p_request_id,'resource_'||p_command,jsonb_build_object('actor_id',auth.uid(),'values',p_values));if (v_request->>'replay')::boolean then return v_request->'result';end if;v_company:=(v_request->>'company_id')::uuid;
 if p_values is null or jsonb_typeof(p_values)<>'object' then raise exception 'Resource values required';end if;
 if p_command='create_inventory' then
  if nullif(btrim(p_values->>'name'),'') is null or nullif(btrim(p_values->>'unit'),'') is null then raise exception 'Inventory name and unit required';end if;
  v_qty:=public.carez_procurement_number(p_values,'quantity_on_hand',1000);v_reserve:=public.carez_procurement_number(p_values,'reorder_point',1000);
  v_cost:=case when nullif(p_values->>'average_unit_cost','') is null then null else public.carez_procurement_number(p_values,'average_unit_cost',1000) end;
  insert into public.inventory_items(company_id,name,category,unit,quantity_on_hand,reorder_point,target_quantity,average_unit_cost,storage_location,notes)
   values(v_company,btrim(p_values->>'name'),coalesce(nullif(p_values->>'category',''),'formwork'),btrim(p_values->>'unit'),v_qty,v_reserve,case when nullif(p_values->>'target_quantity','') is null then null else public.carez_procurement_number(p_values,'target_quantity',1000) end,v_cost,nullif(btrim(p_values->>'storage_location'),''),nullif(btrim(p_values->>'notes'),'')) returning id into v_id;
 elsif p_command='adjust_inventory' then
  select * into v_item from public.inventory_items where company_id=v_company and id=(p_values->>'inventory_item_id')::uuid for update;
  if not found or v_item.quantity_on_hand is null or v_item.quantity_on_hand::text in ('NaN','Infinity','-Infinity') then raise exception 'Recorded inventory quantity unavailable';end if;
  if nullif(btrim(p_values->>'quantity'),'') is null then raise exception 'Adjustment quantity required';end if;v_qty:=(p_values->>'quantity')::numeric;
  if v_qty::text in ('NaN','Infinity','-Infinity') or v_qty=0 then raise exception 'Adjustment must be finite and nonzero';end if;
  v_type:=p_values->>'transaction_type';if v_type is null or v_type not in ('in','out','adjustment') then raise exception 'Choose a valid movement type';end if;
  v_delta:=case when v_type='out' then -abs(v_qty) when v_type='in' then abs(v_qty) else v_qty end;
  if v_item.quantity_on_hand+v_delta<0 then raise exception 'Inventory cannot go below zero';end if;
  v_project:=nullif(p_values->>'project_id','')::uuid;if v_project is not null and not exists(select 1 from public.projects where company_id=v_company and id=v_project) then raise exception 'Inventory movement job unavailable';end if;
  v_date:=public.carez_procurement_date(p_values->>'transaction_date');v_cost:=case when nullif(p_values->>'unit_cost','') is null then null else public.carez_procurement_number(p_values,'unit_cost',1000) end;
  insert into public.inventory_transactions(company_id,inventory_item_id,project_id,transaction_type,quantity,unit_cost,transaction_date,note,created_by) values(v_company,v_item.id,v_project,v_type,v_delta,v_cost,v_date,nullif(btrim(p_values->>'note'),''),auth.uid()) returning id into v_id;
  update public.inventory_items set quantity_on_hand=quantity_on_hand+v_delta,updated_at=clock_timestamp() where company_id=v_company and id=v_item.id;
 else
  if p_command='create' then
   select * into v_operation from public.work_package_operations where company_id=v_company and id=(p_values->>'work_package_operation_id')::uuid for update;
   if not found or v_operation.status in ('completed','cancelled') then raise exception 'Open work operation unavailable';end if;
   v_type:=p_values->>'resource_type';if v_type is null or v_type not in ('material','equipment','vendor') then raise exception 'Choose a valid resource type';end if;
   if nullif(btrim(p_values->>'label'),'') is null then raise exception 'Resource label required';end if;
   v_qty:=public.carez_procurement_number(p_values,'required_quantity',1000,true);v_unit:=coalesce(nullif(btrim(p_values->>'unit'),''),'EA');
   v_inventory:=case when v_type='material' then nullif(p_values->>'inventory_item_id','')::uuid end;v_equipment:=case when v_type='equipment' then nullif(p_values->>'equipment_asset_id','')::uuid end;v_vendor:=case when v_type='vendor' then nullif(p_values->>'vendor_id','')::uuid end;
   insert into public.work_package_resource_requirements(company_id,work_package_operation_id,resource_type,label,required_quantity,unit,inventory_item_id,equipment_asset_id,vendor_id,required_before_start,need_offset_days,need_by_override,vendor_status,vendor_reference,notes,created_by)
    values(v_company,v_operation.id,v_type,btrim(p_values->>'label'),v_qty,v_unit,v_inventory,v_equipment,v_vendor,coalesce((p_values->>'required_before_start')::boolean,false),coalesce(nullif(p_values->>'need_offset_days','')::integer,0),public.carez_procurement_date(p_values->>'need_by_override',false),case when v_type='vendor' then coalesce(nullif(p_values->>'vendor_status',''),'needed') else 'needed' end,nullif(btrim(p_values->>'vendor_reference'),''),nullif(btrim(p_values->>'notes'),''),auth.uid()) returning * into v_req;
  else
   select * into v_req from public.work_package_resource_requirements where company_id=v_company and id=(p_values->>'requirement_id')::uuid for update;
   if not found then raise exception 'Resource requirement unavailable';end if;
   select * into v_operation from public.work_package_operations where company_id=v_company and id=v_req.work_package_operation_id for update;
   if not found then raise exception 'Work operation unavailable';end if;
  end if;
  select project_id into v_project from public.work_packages where company_id=v_company and id=v_operation.work_package_id;
  if v_project is null then raise exception 'Work package job unavailable';end if;
  v_id:=v_req.id;
  select * into v_res from public.inventory_reservations where company_id=v_company and resource_requirement_id=v_req.id for update;
  select to_jsonb(r) into v_equipment_before from public.equipment_reservations r where r.company_id=v_company and r.resource_requirement_id=v_req.id for update;
  if p_command='create' then
   if v_inventory is not null and not exists(select 1 from public.inventory_items where company_id=v_company and id=v_inventory and active and upper(unit)=upper(v_req.unit)) then raise exception 'Active inventory with the same unit is required';end if;
   if v_equipment is not null and not exists(select 1 from public.equipment_assets where company_id=v_company and id=v_equipment and active) then raise exception 'Active equipment unavailable';end if;
   if v_vendor is not null and not exists(select 1 from public.vendors where company_id=v_company and id=v_vendor and active) then raise exception 'Active vendor unavailable';end if;
  end if;
  if p_command='delete' then delete from public.work_package_resource_requirements where company_id=v_company and id=v_req.id;
  elsif p_command='waive' then
   v_reason:=nullif(btrim(p_values->>'waiver_reason'),'');if v_reason is null then raise exception 'Waiver reason required';end if;
   update public.work_package_resource_requirements set waived_at=clock_timestamp(),waived_by=auth.uid(),waiver_reason=v_reason,updated_at=clock_timestamp() where company_id=v_company and id=v_req.id;
  elsif p_command='restore' then update public.work_package_resource_requirements set waived_at=null,waived_by=null,waiver_reason=null,updated_at=clock_timestamp() where company_id=v_company and id=v_req.id;
  elsif p_command='vendor' then
   v_vendor:=nullif(p_values->>'vendor_id','')::uuid;if v_req.resource_type<>'vendor' or (v_vendor is not null and not exists(select 1 from public.vendors where company_id=v_company and id=v_vendor and active)) then raise exception 'Vendor requirement or active vendor unavailable';end if;
   update public.work_package_resource_requirements set vendor_id=v_vendor,vendor_status=coalesce(nullif(p_values->>'vendor_status',''),'needed'),vendor_reference=nullif(btrim(p_values->>'vendor_reference'),''),updated_at=clock_timestamp() where company_id=v_company and id=v_req.id;
  elsif p_command='consume' then perform public.consume_work_package_inventory(v_req.id);
  end if;
  if p_command='link_po' or (p_command='create' and v_req.resource_type='material' and nullif(p_values->>'purchase_order_line_id','') is not null) then
   if v_req.resource_type<>'material' then raise exception 'Material requirement required';end if;
   select * into v_line from public.purchase_order_lines where company_id=v_company and id=(p_values->>'purchase_order_line_id')::uuid for update;
   if not found then raise exception 'PO line unavailable';end if;
   select * into v_po from public.purchase_orders where company_id=v_company and id=v_line.purchase_order_id and project_id=v_project and status in ('draft','issued') for update;
   if not found or upper(v_line.unit)<>upper(v_req.unit) then raise exception 'PO must belong to this job and use the same unit';end if;
   if v_line.work_package_operation_id is not null and v_line.work_package_operation_id<>v_operation.id then raise exception 'PO line is already linked to different work';end if;
   if exists(select 1 from public.work_package_resource_requirements where company_id=v_company and purchase_order_line_id=v_line.id and id<>v_req.id and waived_at is null) then raise exception 'PO line already supplies another requirement. Use distinct source lines; no quantity allocation is recorded.';end if;
   perform set_config('carez.resource_request',p_request_id::text,true);
   update public.work_package_resource_requirements set purchase_order_line_id=v_line.id,updated_at=clock_timestamp() where company_id=v_company and id=v_req.id;
   update public.purchase_order_lines set work_package_operation_id=v_operation.id,updated_at=clock_timestamp() where company_id=v_company and id=v_line.id;
  end if;
  if p_command='reserve_material' or (p_command='create' and v_req.resource_type='material' and v_inventory is not null and nullif(p_values->>'reserve_quantity','') is not null and (p_values->>'reserve_quantity')::numeric<>0) then
   if v_req.resource_type<>'material' then raise exception 'Material requirement required';end if;
   v_inventory:=coalesce(nullif(p_values->>'inventory_item_id','')::uuid,v_inventory);v_qty:=public.carez_procurement_number(p_values,case when p_command='create' then 'reserve_quantity' else 'quantity' end,1000,true);
   select * into v_item from public.inventory_items where company_id=v_company and id=v_inventory and active for update;
   if not found or upper(v_item.unit)<>upper(v_req.unit) then raise exception 'Active inventory with the same unit is required';end if;
   update public.work_package_resource_requirements set inventory_item_id=v_inventory,updated_at=clock_timestamp() where company_id=v_company and id=v_req.id;
   insert into public.inventory_reservations(company_id,resource_requirement_id,inventory_item_id,quantity,status,created_by) values(v_company,v_req.id,v_inventory,v_qty,'reserved',auth.uid()) on conflict(resource_requirement_id) do update set inventory_item_id=excluded.inventory_item_id,quantity=excluded.quantity,status='reserved',updated_at=clock_timestamp();
  end if;
  if p_command='reserve_equipment' or (p_command='create' and v_req.resource_type='equipment' and v_equipment is not null and nullif(p_values->>'reservation_start','') is not null) then
   if v_req.resource_type<>'equipment' then raise exception 'Equipment requirement required';end if;
   v_equipment:=coalesce(nullif(p_values->>'equipment_asset_id','')::uuid,v_equipment);
   if not exists(select 1 from public.equipment_assets where company_id=v_company and id=v_equipment and active) then raise exception 'Active equipment unavailable';end if;
   v_date:=public.carez_procurement_date(case when p_command='create' then p_values->>'reservation_start' else p_values->>'start_date' end);
   v_end:=coalesce(public.carez_procurement_date(case when p_command='create' then p_values->>'reservation_end' else p_values->>'end_date' end,false),v_date);if v_end<v_date then raise exception 'Reservation end cannot precede start';end if;
   update public.work_package_resource_requirements set equipment_asset_id=v_equipment,updated_at=clock_timestamp() where company_id=v_company and id=v_req.id;
   insert into public.equipment_reservations(company_id,resource_requirement_id,equipment_asset_id,start_date,end_date,status,created_by) values(v_company,v_req.id,v_equipment,v_date,v_end,case when coalesce((p_values->>case when p_command='create' then 'equipment_confirmed' else 'confirmed' end)::boolean,false) then 'confirmed' else 'planned' end,auth.uid()) on conflict(resource_requirement_id) do update set equipment_asset_id=excluded.equipment_asset_id,start_date=excluded.start_date,end_date=excluded.end_date,status=excluded.status,updated_at=clock_timestamp();
  end if;
 end if;
 return public.carez_financial_request_finish(p_request_id,jsonb_build_object('ok',true,'id',v_id,'requirement_before',case when p_command='create' or v_req.id is null then null else to_jsonb(v_req) end,'requirement_after',(select to_jsonb(r) from public.work_package_resource_requirements r where r.company_id=v_company and r.id=v_req.id),'reservation_before',case when v_res.id is null then null else to_jsonb(v_res) end,'reservation_after',(select to_jsonb(r) from public.inventory_reservations r where r.company_id=v_company and r.resource_requirement_id=v_req.id),'equipment_reservation_before',v_equipment_before,'equipment_reservation_after',(select to_jsonb(r) from public.equipment_reservations r where r.company_id=v_company and r.resource_requirement_id=v_req.id),'inventory_before',case when v_item.id is null then null else to_jsonb(v_item) end,'inventory_after',(select to_jsonb(i) from public.inventory_items i where i.company_id=v_company and i.id=case when p_command='create_inventory' then v_id else v_item.id end)));
end $$;
revoke all on function public.carez_resource_command_v1(uuid,text,jsonb) from public,anon;
grant execute on function public.carez_resource_command_v1(uuid,text,jsonb) to authenticated;
revoke insert,update,delete on public.work_package_resource_requirements,public.inventory_reservations,public.equipment_reservations,public.inventory_items,public.inventory_transactions from authenticated;
revoke all on function public.consume_work_package_inventory(uuid) from public,anon,authenticated;
CREATE OR REPLACE FUNCTION public.consume_work_package_inventory(p_requirement_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO pg_catalog,public
AS $function$
declare
  v_company_id uuid;
  v_res public.inventory_reservations%rowtype;
  v_req public.work_package_resource_requirements%rowtype;
  v_item public.inventory_items%rowtype;
  v_project_id uuid;
  v_role text;
  v_date date;
begin
  select company_id,role into v_company_id,v_role from public.profiles where id=auth.uid();
  if v_company_id is null or v_role not in ('owner','office') then raise exception 'Owner access required'; end if;

  select * into v_req from public.work_package_resource_requirements
    where id=p_requirement_id and company_id=v_company_id and resource_type='material'
    for update;
  if not found then raise exception 'Material requirement not found'; end if;

  select * into v_res from public.inventory_reservations
    where resource_requirement_id=v_req.id and company_id=v_company_id
    for update;
  if not found then raise exception 'Reserve inventory before marking it used'; end if;
  if v_res.status='consumed' then return; end if;
  if v_res.status<>'reserved' then raise exception 'Only reserved inventory can be consumed'; end if;
  if v_res.inventory_item_id is distinct from v_req.inventory_item_id then raise exception 'Reservation inventory does not match the requirement; reserve the intended item before consumption';end if;

  select * into v_item from public.inventory_items
    where id=v_res.inventory_item_id and company_id=v_company_id
    for update;
  if not found then raise exception 'Inventory item not found'; end if;
  if v_item.quantity_on_hand is null or v_item.quantity_on_hand::text in ('NaN','Infinity','-Infinity') then raise exception 'Recorded stock quantity unavailable';end if;
  if v_item.average_unit_cost is not null and (v_item.average_unit_cost::text in ('NaN','Infinity','-Infinity') or v_item.average_unit_cost<0) then raise exception 'Recorded inventory cost is invalid; verify the cost before consumption';end if;
  if v_res.quantity is null or v_res.quantity::text in ('NaN','Infinity','-Infinity') or v_res.quantity<=0 or upper(v_req.unit)<>upper(v_item.unit) then raise exception 'Verified reservation quantity and matching inventory unit required';end if;
  if coalesce(v_item.quantity_on_hand,0)<v_res.quantity then
    raise exception 'Only % % is on hand; % is reserved',v_item.quantity_on_hand,v_item.unit,v_res.quantity;
  end if;

  select wp.project_id into v_project_id
  from public.work_package_operations o
  join public.work_packages wp on wp.id=o.work_package_id and wp.company_id=o.company_id
  where o.id=v_req.work_package_operation_id and o.company_id=v_company_id;

  v_date:=public.carez_company_calendar_date(v_company_id,clock_timestamp());
  if v_date is null then raise exception 'Company calendar unavailable for inventory movement';end if;
  insert into public.inventory_transactions(
    company_id,inventory_item_id,project_id,transaction_type,quantity,unit_cost,transaction_date,note,created_by,work_package_operation_id
  ) values(
    v_company_id,v_res.inventory_item_id,v_project_id,'out',-v_res.quantity,v_item.average_unit_cost,
    v_date,
    'Consumed from Work Package resource reservation',auth.uid(),v_req.work_package_operation_id
  );

  update public.inventory_items
  set quantity_on_hand=quantity_on_hand-v_res.quantity,updated_at=now()
  where id=v_item.id and company_id=v_company_id;

  update public.inventory_reservations
  set status='consumed',updated_at=now()
  where id=v_res.id and company_id=v_company_id;
end;
$function$
;
revoke all on function public.consume_work_package_inventory(uuid) from public,anon,authenticated;
