-- Carez OS: atomically consume reserved inventory into a Work Package operation

create or replace function public.consume_work_package_inventory(p_requirement_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_company_id uuid;
  v_res public.inventory_reservations%rowtype;
  v_req public.work_package_resource_requirements%rowtype;
  v_item public.inventory_items%rowtype;
  v_project_id uuid;
  v_role text;
begin
  select company_id,role into v_company_id,v_role from public.profiles where id=auth.uid();
  if v_company_id is null or v_role='employee' then raise exception 'Owner access required'; end if;

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

  select * into v_item from public.inventory_items
    where id=v_res.inventory_item_id and company_id=v_company_id
    for update;
  if not found then raise exception 'Inventory item not found'; end if;
  if coalesce(v_item.quantity_on_hand,0)<v_res.quantity then
    raise exception 'Only % % is on hand; % is reserved',v_item.quantity_on_hand,v_item.unit,v_res.quantity;
  end if;

  select wp.project_id into v_project_id
  from public.work_package_operations o
  join public.work_packages wp on wp.id=o.work_package_id and wp.company_id=o.company_id
  where o.id=v_req.work_package_operation_id and o.company_id=v_company_id;

  insert into public.inventory_transactions(
    company_id,inventory_item_id,project_id,transaction_type,quantity,unit_cost,transaction_date,note,created_by,work_package_operation_id
  ) values(
    v_company_id,v_res.inventory_item_id,v_project_id,'out',-v_res.quantity,v_item.average_unit_cost,
    (now() at time zone 'America/Los_Angeles')::date,
    'Consumed from Work Package resource reservation',auth.uid(),v_req.work_package_operation_id
  );

  update public.inventory_items
  set quantity_on_hand=quantity_on_hand-v_res.quantity,updated_at=now()
  where id=v_item.id and company_id=v_company_id;

  update public.inventory_reservations
  set status='consumed',updated_at=now()
  where id=v_res.id and company_id=v_company_id;
end;
$$;

grant execute on function public.consume_work_package_inventory(uuid) to authenticated;
