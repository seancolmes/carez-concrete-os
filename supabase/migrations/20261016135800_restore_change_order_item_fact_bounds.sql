-- The recovered table predates the declared Change Order item contract. Restore
-- physical-input bounds and tenant-qualified baseline lineage without changing
-- signed Direct Cost or Sell credits. Existing facts are never rewritten.
do $$
declare field text;constraint_name text;
begin
 foreach field in array array['quantity','unit_cost','regular_hours','overtime_hours'] loop
  constraint_name:='change_order_items_'||field||'_check';
  if not exists(select 1 from pg_constraint where conrelid='public.change_order_items'::regclass and conname=constraint_name) then
   execute format('alter table public.change_order_items add constraint %I check (%I >= 0) not valid',constraint_name,field);
   -- Fail closed on conflicting existing facts; do not normalize or discard them.
   execute format('alter table public.change_order_items validate constraint %I',constraint_name);
  end if;
 end loop;
 if not exists(select 1 from pg_constraint where conrelid='public.change_order_items'::regclass
  and contype='f' and confrelid='public.commercial_baseline_items'::regclass) then
  alter table public.change_order_items add constraint carez_co_item_baseline_tenant_fk
   foreign key(company_id,affected_commercial_baseline_item_id)
   references public.commercial_baseline_items(company_id,id) on delete restrict not valid;
  alter table public.change_order_items validate constraint carez_co_item_baseline_tenant_fk;
 end if;
end $$;
