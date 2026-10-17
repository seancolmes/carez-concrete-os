-- Serialize source-line edits with issue/post/convert, and preserve consumed inventory.
-- No historical rows are changed. Existing malformed records must be corrected explicitly.
set local search_path=pg_catalog,public,extensions;

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
do $$ declare name text; begin
 foreach name in array array['vendor_quote_lines','purchase_order_lines','vendor_bill_lines','purchase_order_receipts'] loop
  execute format('drop trigger if exists carez_procurement_source_guard on public.%I',name);
  execute format('create trigger carez_procurement_source_guard before insert or update or delete on public.%I for each row execute function public.carez_guard_procurement_source_line()',name);
 end loop;
end $$;

create or replace function public.carez_guard_procurement_party_links()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare v jsonb; po record;
begin
 v:=to_jsonb(new);
 if not exists(select 1 from public.projects p where p.id=new.project_id and p.company_id=new.company_id)
  or not exists(select 1 from public.vendors v where v.id=new.vendor_id and v.company_id=new.company_id) then raise exception 'Job and vendor must belong to this company'; end if;
 if tg_op='UPDATE' and (new.company_id,new.project_id,new.vendor_id,new.id) is distinct from (old.company_id,old.project_id,old.vendor_id,old.id) then
  raise exception 'Procurement identity, company, job and vendor cannot change';
 end if;
 if tg_table_name='vendor_bills' and v->>'purchase_order_id' is not null then
  select company_id,project_id,vendor_id into po from public.purchase_orders where id=(v->>'purchase_order_id')::uuid;
  if (po.company_id,po.project_id,po.vendor_id) is distinct from (new.company_id,new.project_id,new.vendor_id) then raise exception 'Bill purchase order belongs to a different company, vendor or job'; end if;
 end if;
 if tg_table_name='vendor_bills' and tg_op='UPDATE'
  and to_jsonb(new)->>'purchase_order_id' is distinct from to_jsonb(old)->>'purchase_order_id'
  and exists(select 1 from public.vendor_bill_lines l where l.vendor_bill_id=new.id) then
  raise exception 'Bill purchase order cannot change while source lines exist';
 end if;
 return new;
end $$;
revoke all on function public.carez_guard_procurement_party_links() from public,anon,authenticated;
do $$ declare name text; begin
 foreach name in array array['vendor_quotes','purchase_orders','vendor_bills'] loop
  execute format('drop trigger if exists carez_procurement_party_guard on public.%I',name);
  execute format('create trigger carez_procurement_party_guard before insert or update on public.%I for each row execute function public.carez_guard_procurement_party_links()',name);
 end loop;
end $$;

create or replace function public.carez_guard_inventory_reservation()
returns trigger language plpgsql security invoker set search_path=pg_catalog,public as $$
declare r public.work_package_resource_requirements%rowtype; v public.inventory_reservations%rowtype;
begin
 v:=case when tg_op='DELETE' then old else new end;
 select * into r from public.work_package_resource_requirements where id=v.resource_requirement_id for update;
 if r.id is null and tg_op='DELETE' and old.status<>'consumed' then return old; end if;
 if r.id is null or r.company_id is distinct from v.company_id or r.resource_type<>'material' then raise exception 'Material requirement belongs to another company or is unavailable'; end if;
 if not exists(select 1 from public.inventory_items i where i.id=v.inventory_item_id and i.company_id=v.company_id) then raise exception 'Inventory belongs to another company or is unavailable'; end if;
 if tg_op in ('UPDATE','DELETE') and old.status='consumed' then raise exception 'Consumed inventory reservation is immutable'; end if;
 if tg_op='UPDATE' and (old.id,old.company_id,old.resource_requirement_id) is distinct from (new.id,new.company_id,new.resource_requirement_id) then raise exception 'Reservation identity cannot change'; end if;
 if tg_op<>'DELETE' and (new.quantity is null or new.quantity::text in ('NaN','Infinity','-Infinity') or new.quantity<=0) then raise exception 'Reservation quantity must be finite and greater than zero'; end if;
 if tg_op<>'DELETE' and new.status='consumed' and (tg_op='INSERT' or old.status is distinct from 'consumed') and current_user not in ('postgres','supabase_admin','service_role') then raise exception 'Use governed inventory consumption'; end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
revoke all on function public.carez_guard_inventory_reservation() from public,anon,authenticated;
drop trigger if exists carez_inventory_reservation_guard on public.inventory_reservations;
create trigger carez_inventory_reservation_guard before insert or update or delete on public.inventory_reservations for each row execute function public.carez_guard_inventory_reservation();

create or replace function public.carez_guard_consumed_resource()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if exists(select 1 from public.inventory_reservations r where r.resource_requirement_id=old.id and r.status='consumed') then
  if tg_op='DELETE' then raise exception 'Consumed material requirement cannot be deleted'; end if;
  if (new.company_id,new.work_package_operation_id,new.resource_type,new.inventory_item_id,new.required_quantity,new.unit)
    is distinct from (old.company_id,old.work_package_operation_id,old.resource_type,old.inventory_item_id,old.required_quantity,old.unit) then
   raise exception 'Consumed material quantity and source cannot change';
  end if;
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
revoke all on function public.carez_guard_consumed_resource() from public,anon,authenticated;
drop trigger if exists carez_consumed_resource_guard on public.work_package_resource_requirements;
create trigger carez_consumed_resource_guard before update or delete on public.work_package_resource_requirements for each row execute function public.carez_guard_consumed_resource();
