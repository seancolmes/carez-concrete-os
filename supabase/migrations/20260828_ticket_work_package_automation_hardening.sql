-- Trigger hardening for concrete ticket -> work package automation.

create or replace function public.carez_ticket_document_sync_trigger()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_receipt uuid;v_line uuid;v_pour uuid;
begin
  if tg_op='INSERT' then
    if new.purchase_order_receipt_id is not null then
      select r.purchase_order_line_id into v_line from public.purchase_order_receipts r where r.id=new.purchase_order_receipt_id and r.company_id=new.company_id;
      select pour_plan_id into v_pour from public.purchase_order_lines where id=v_line and company_id=new.company_id;
      perform public.carez_sync_ticket_work_packages_for_pour(v_pour);
    end if;
    return new;
  elsif tg_op='UPDATE' then
    if new.purchase_order_receipt_id is not null then
      select r.purchase_order_line_id into v_line from public.purchase_order_receipts r where r.id=new.purchase_order_receipt_id and r.company_id=new.company_id;
      select pour_plan_id into v_pour from public.purchase_order_lines where id=v_line and company_id=new.company_id;
      perform public.carez_sync_ticket_work_packages_for_pour(v_pour);
    end if;
    if old.purchase_order_receipt_id is not null and (old.purchase_order_receipt_id is distinct from new.purchase_order_receipt_id or old.review_status is distinct from new.review_status) then
      select r.purchase_order_line_id into v_line from public.purchase_order_receipts r where r.id=old.purchase_order_receipt_id and r.company_id=old.company_id;
      select pour_plan_id into v_pour from public.purchase_order_lines where id=v_line and company_id=old.company_id;
      perform public.carez_sync_ticket_work_packages_for_pour(v_pour);
    end if;
    return new;
  else
    if old.purchase_order_receipt_id is not null then
      select r.purchase_order_line_id into v_line from public.purchase_order_receipts r where r.id=old.purchase_order_receipt_id and r.company_id=old.company_id;
      select pour_plan_id into v_pour from public.purchase_order_lines where id=v_line and company_id=old.company_id;
      perform public.carez_sync_ticket_work_packages_for_pour(v_pour);
    end if;
    return old;
  end if;
end$$;

create or replace function public.carez_ticket_po_line_sync_trigger()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' then
    if new.pour_plan_id is not null then perform public.carez_sync_ticket_work_packages_for_pour(new.pour_plan_id); end if;
    return new;
  elsif tg_op='UPDATE' then
    if new.pour_plan_id is not null then perform public.carez_sync_ticket_work_packages_for_pour(new.pour_plan_id); end if;
    if old.pour_plan_id is not null and old.pour_plan_id is distinct from new.pour_plan_id then perform public.carez_sync_ticket_work_packages_for_pour(old.pour_plan_id); end if;
    return new;
  else
    if old.pour_plan_id is not null then perform public.carez_sync_ticket_work_packages_for_pour(old.pour_plan_id); end if;
    return old;
  end if;
end$$;

create or replace function public.carez_ticket_po_status_sync_trigger()
returns trigger language plpgsql security definer set search_path=public as $$
declare r record;
begin
  if old.status is distinct from new.status then
    for r in select distinct pour_plan_id from public.purchase_order_lines where purchase_order_id=new.id and company_id=new.company_id and pour_plan_id is not null loop
      perform public.carez_sync_ticket_work_packages_for_pour(r.pour_plan_id);
    end loop;
  end if;
  return new;
end$$;

drop trigger if exists carez_ticket_po_status_sync on public.purchase_orders;
create trigger carez_ticket_po_status_sync after update of status on public.purchase_orders
for each row execute function public.carez_ticket_po_status_sync_trigger();
