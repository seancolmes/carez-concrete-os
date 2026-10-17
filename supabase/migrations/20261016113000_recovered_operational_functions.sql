-- Restore the captured operational dependency closure only when a signature is absent.
-- Source catalog SHA256: 109fa8a04eacab94427d989d0171c94bec96d8e1ee2cbe0ad4ec3f7c4ed683f9
-- Existing canonical commercial, employee and authentication authority remains untouched.
-- Transaction guards and request-replay contracts follow in governed migrations.
set local search_path=pg_catalog,public,extensions;

-- allocate_project_document_number(uuid,uuid,text,text)
do $recovery$ begin if to_regprocedure('public.allocate_project_document_number(uuid,uuid,text,text)') is null then execute $captured$CREATE OR REPLACE FUNCTION public.allocate_project_document_number(p_company uuid, p_project uuid, p_document_type text, p_label text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_job text;
  v_next integer;
begin
  select job_number into v_job from public.projects where id=p_project and company_id=p_company;
  if v_job is null then raise exception 'Project/job number not found'; end if;
  insert into public.project_document_sequences(company_id,project_id,document_type,next_number)
  values(p_company,p_project,p_document_type,1)
  on conflict(project_id,document_type) do nothing;
  select next_number into v_next from public.project_document_sequences
  where project_id=p_project and document_type=p_document_type for update;
  update public.project_document_sequences set next_number=v_next+1
  where project_id=p_project and document_type=p_document_type;
  return v_job||'-'||p_label||'-'||lpad(v_next::text,3,'0');
end;
$function$;$captured$;end if;end $recovery$;
revoke all on function public.allocate_project_document_number(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.allocate_project_document_number(uuid,uuid,text,text) to service_role;

-- apply_bank_reconciliation_rule(uuid,uuid)
do $recovery$ begin if to_regprocedure('public.apply_bank_reconciliation_rule(uuid,uuid)') is null then execute $captured$CREATE OR REPLACE FUNCTION public.apply_bank_reconciliation_rule(p_bank_transaction_id uuid, p_rule_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_company uuid:=public.get_my_company_id(); v_rule public.bank_reconciliation_rules%rowtype; v_tx public.plaid_transactions%rowtype; v_entity uuid; v_direction text; v_norm text;
begin
  select * into v_rule from public.bank_reconciliation_rules where id=p_rule_id and company_id=v_company and active;
  if not found then raise exception 'Bank rule not found'; end if;
  select * into v_tx from public.plaid_transactions where id=p_bank_transaction_id and company_id=v_company for update;
  if not found then raise exception 'Bank transaction not found'; end if;
  if v_tx.pending or v_tx.removed or v_tx.review_status='matched' then raise exception 'Bank transaction is not available'; end if;
  v_direction:=case when v_tx.cash_amount>=0 then 'inflow' else 'outflow' end;
  v_norm:=public.normalize_bank_text(coalesce(v_tx.merchant_name,v_tx.name));
  if v_rule.direction<>'any' and v_rule.direction<>v_direction then raise exception 'Rule direction does not match transaction'; end if;
  if position(v_rule.merchant_pattern in v_norm)=0 and position(v_norm in v_rule.merchant_pattern)=0 then raise exception 'Rule merchant pattern does not match transaction'; end if;
  if v_rule.category_primary is not null and v_rule.category_primary<>coalesce(v_tx.category_primary,'') then raise exception 'Rule category does not match transaction'; end if;

  if v_rule.action_type='company_expense' then
    v_entity:=public.reconcile_bank_to_company_expense(v_tx.id,v_rule.overhead_item_id,v_rule.expense_category,v_rule.business_use_percent,null,false,false);
    update public.plaid_transactions set bank_rule_id=v_rule.id,reconciliation_source=case when v_rule.auto_apply then 'auto_rule' else 'approved_rule' end,reconciliation_confidence=99 where id=v_tx.id;
  elsif v_rule.action_type='ignore' then
    perform public.ignore_bank_transaction(v_tx.id,'Ignored by learned bank rule.',false,false);
    update public.plaid_transactions set bank_rule_id=v_rule.id,reconciliation_source=case when v_rule.auto_apply then 'auto_rule' else 'approved_rule' end,reconciliation_confidence=99 where id=v_tx.id;
    v_entity:=v_tx.id;
  else
    raise exception 'Job-cost rules require a project selection and cannot auto-post';
  end if;
  update public.bank_reconciliation_rules set use_count=use_count+1,last_used_at=now(),updated_at=now() where id=v_rule.id;
  return v_entity;
end;
$function$;$captured$;end if;end $recovery$;
revoke all on function public.apply_bank_reconciliation_rule(uuid,uuid) from public,anon,authenticated;
grant execute on function public.apply_bank_reconciliation_rule(uuid,uuid) to service_role,authenticated;

-- approve_payroll_run(uuid)
do $recovery$ begin if to_regprocedure('public.approve_payroll_run(uuid)') is null then execute $captured$CREATE OR REPLACE FUNCTION public.approve_payroll_run(p_payroll_run_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_company uuid:=public.get_my_company_id();
begin
  update public.payroll_runs set status='approved',approved_at=now(),updated_at=now()
  where id=p_payroll_run_id and company_id=v_company and status='draft';
  if not found then raise exception 'Draft payroll run not found'; end if;
end;$function$;$captured$;end if;end $recovery$;
revoke all on function public.approve_payroll_run(uuid) from public,anon,authenticated;
grant execute on function public.approve_payroll_run(uuid) to service_role,authenticated;

-- carez_assign_work_package_sequence()
do $recovery$ begin if to_regprocedure('public.carez_assign_work_package_sequence()') is null then execute $captured$CREATE OR REPLACE FUNCTION public.carez_assign_work_package_sequence()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.sequence is null or new.sequence=0 then
    select coalesce(max(o.sequence),0)+10
      into new.sequence
    from public.work_package_operations o
    where o.company_id=new.company_id
      and o.work_package_id=new.work_package_id;
  end if;
  return new;
end$function$;$captured$;end if;end $recovery$;
revoke all on function public.carez_assign_work_package_sequence() from public,anon,authenticated;
grant execute on function public.carez_assign_work_package_sequence() to service_role;

-- carez_distance_ft(float8,float8,float8,float8)
do $recovery$ begin if to_regprocedure('public.carez_distance_ft(float8,float8,float8,float8)') is null then execute $captured$CREATE OR REPLACE FUNCTION public.carez_distance_ft(lat1 double precision, lon1 double precision, lat2 double precision, lon2 double precision)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
 select case when lat1 is null or lon1 is null or lat2 is null or lon2 is null then null else
 round((3958.7613*2*asin(sqrt(power(sin(radians(lat2-lat1)/2),2)+cos(radians(lat1))*cos(radians(lat2))*power(sin(radians(lon2-lon1)/2),2)))*5280)::numeric,1) end;
$function$;$captured$;end if;end $recovery$;
revoke all on function public.carez_distance_ft(float8,float8,float8,float8) from public,anon,authenticated;
grant execute on function public.carez_distance_ft(float8,float8,float8,float8) to service_role;

-- carez_enforce_work_package_start_readiness()
do $recovery$ begin if to_regprocedure('public.carez_enforce_work_package_start_readiness()') is null then execute $captured$CREATE OR REPLACE FUNCTION public.carez_enforce_work_package_start_readiness()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;$captured$;end if;end $recovery$;
revoke all on function public.carez_enforce_work_package_start_readiness() from public,anon,authenticated;
grant execute on function public.carez_enforce_work_package_start_readiness() to service_role;

-- carez_guard_assembly_folder_cycle()
do $recovery$ begin if to_regprocedure('public.carez_guard_assembly_folder_cycle()') is null then execute $captured$CREATE OR REPLACE FUNCTION public.carez_guard_assembly_folder_cycle()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.parent_folder_id is null then return new; end if;
  if new.parent_folder_id=new.id then raise exception 'An assembly folder cannot contain itself.'; end if;
  if exists(
    with recursive ancestors(id,parent_folder_id) as (
      select f.id,f.parent_folder_id from public.concrete_assembly_folders f
      where f.company_id=new.company_id and f.id=new.parent_folder_id
      union
      select f.id,f.parent_folder_id from public.concrete_assembly_folders f
      join ancestors a on a.parent_folder_id=f.id
      where f.company_id=new.company_id
    )
    select 1 from ancestors where id=new.id
  ) then raise exception 'Assembly folder relationship would create a cycle.'; end if;
  return new;
end;
$function$;$captured$;end if;end $recovery$;
revoke all on function public.carez_guard_assembly_folder_cycle() from public,anon,authenticated;
grant execute on function public.carez_guard_assembly_folder_cycle() to service_role;

-- carez_number_purchase_order()
do $recovery$ begin if to_regprocedure('public.carez_number_purchase_order()') is null then execute $captured$CREATE OR REPLACE FUNCTION public.carez_number_purchase_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  new.po_number:=public.allocate_project_document_number(new.company_id,new.project_id,'purchase_order','PO');
  return new;
end;
$function$;$captured$;end if;end $recovery$;
revoke all on function public.carez_number_purchase_order() from public,anon,authenticated;
grant execute on function public.carez_number_purchase_order() to service_role;

-- carez_sync_inspection_schedule()
do $recovery$ begin if to_regprocedure('public.carez_sync_inspection_schedule()') is null then execute $captured$CREATE OR REPLACE FUNCTION public.carez_sync_inspection_schedule()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_task_id uuid;
  v_title text;
  v_schedule_status text;
begin
  if tg_op='DELETE' then
    delete from public.work_schedule_items where inspection_id=old.id;
    return old;
  end if;

  if new.required_for_operation_id is not null then
    select production_task_id into v_task_id
    from public.work_package_operations
    where id=new.required_for_operation_id and company_id=new.company_id;
  end if;

  if new.scheduled_date is null then
    delete from public.work_schedule_items where inspection_id=new.id;
    return new;
  end if;

  v_title:='Inspection — '||new.title;
  v_schedule_status:=case
    when new.status in ('passed','waived') then 'completed'
    when new.status='cancelled' then 'cancelled'
    when new.status='scheduled' then 'confirmed'
    else 'planned'
  end;

  insert into public.work_schedule_items(
    company_id,project_id,schedule_date,item_type,title,production_task_id,
    work_package_operation_id,start_time,crew_needed,status,notes,created_by,inspection_id
  ) values(
    new.company_id,new.project_id,new.scheduled_date,'inspection',v_title,v_task_id,
    new.required_for_operation_id,new.scheduled_time,0,v_schedule_status,
    nullif(concat_ws(' · ',new.authority,new.reference_number),''),new.created_by,new.id
  )
  on conflict(inspection_id) do update set
    project_id=excluded.project_id,
    schedule_date=excluded.schedule_date,
    title=excluded.title,
    production_task_id=excluded.production_task_id,
    work_package_operation_id=excluded.work_package_operation_id,
    start_time=excluded.start_time,
    status=excluded.status,
    notes=excluded.notes,
    updated_at=now();

  return new;
end$function$;$captured$;end if;end $recovery$;
revoke all on function public.carez_sync_inspection_schedule() from public,anon,authenticated;
grant execute on function public.carez_sync_inspection_schedule() to service_role;

-- carez_sync_ticket_work_packages_for_pour(uuid)
do $recovery$ begin if to_regprocedure('public.carez_sync_ticket_work_packages_for_pour(uuid)') is null then execute $captured$CREATE OR REPLACE FUNCTION public.carez_sync_ticket_work_packages_for_pour(p_pour_plan_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v record;
  o record;
  v_review text;
  v_reason text;
  v_changed boolean;
  v_ready boolean;
begin
  if p_pour_plan_id is null then return; end if;

  select d.*,pp.status as current_pour_status,pp.project_id as current_project_id
  into v
  from public.pour_delivery_actual_summary d
  join public.pour_plans pp on pp.id=d.pour_plan_id and pp.company_id=d.company_id
  where d.pour_plan_id=p_pour_plan_id;
  if not found then return; end if;

  for o in
    select wo.*,wp.project_id as package_project_id
    from public.work_package_operations wo
    join public.work_packages wp on wp.id=wo.work_package_id and wp.company_id=wo.company_id
    where wo.pour_plan_id=p_pour_plan_id
      and wo.measurement_method='ticket'
      and wo.status<>'cancelled'
  loop
    v_changed := o.actual_quantity is distinct from coalesce(v.delivered_cy,0);
    v_review := 'auto';
    v_reason := null;

    if o.package_project_id is distinct from v.current_project_id then
      v_review := 'needs_review';
      v_reason := 'Linked pour belongs to a different project.';
    elsif upper(coalesce(o.unit,''))<>'CY' then
      v_review := 'needs_review';
      v_reason := 'Concrete ticket production requires a CY work-package operation.';
    elsif coalesce(v.delivered_cy,0)<=0 then
      if v.current_pour_status='completed' then
        v_review := 'needs_review';
        v_reason := 'Pour is closed but no concrete delivery quantity is recorded.';
      end if;
    elsif coalesce(v.tickets_missing_photo,0)>0 then
      v_review := 'needs_review';
      v_reason := v.tickets_missing_photo||' concrete delivery ticket photo(s) still need matched evidence.';
    elsif abs(coalesce(v.delivered_cy,0)-o.planned_quantity)>greatest(1::numeric,o.planned_quantity*0.10) then
      if not v_changed and o.quantity_review_status in ('verified','excluded') then
        v_review := o.quantity_review_status;
        v_reason := o.quantity_review_reason;
      else
        v_review := 'needs_review';
        v_reason := 'Ticket actual differs from planned quantity by more than 10% or 1 CY.';
      end if;
    elsif not v_changed and o.quantity_review_status in ('verified','excluded') then
      v_review := o.quantity_review_status;
      v_reason := o.quantity_review_reason;
    end if;

    v_ready := o.package_project_id=v.current_project_id
      and upper(coalesce(o.unit,''))='CY'
      and v.current_pour_status='completed'
      and coalesce(v.delivered_cy,0)>0
      and coalesce(v.tickets_missing_photo,0)=0;

    update public.work_package_operations
    set actual_quantity=coalesce(v.delivered_cy,0),
        actual_quantity_source='delivery_tickets',
        quantity_review_status=v_review,
        quantity_review_reason=v_reason,
        quantity_synced_at=now(),
        status=case when v_ready then 'completed' else status end,
        completed_at=case when v_ready then coalesce(completed_at,now()) else completed_at end,
        completed_by_profile_id=case when v_ready then null else completed_by_profile_id end,
        completed_by_crew_member_id=case when v_ready then null else completed_by_crew_member_id end,
        completion_source=case when v_ready then 'delivery_tickets' else completion_source end,
        updated_at=now()
    where id=o.id and company_id=o.company_id;

    if v_ready then
      update public.work_packages p
      set status=case when exists(
        select 1 from public.work_package_operations q
        where q.work_package_id=p.id and q.status not in ('completed','cancelled')
      ) then 'active' else 'completed' end,
      updated_at=now()
      where p.id=o.work_package_id and p.company_id=o.company_id and p.status<>'cancelled';
    end if;
  end loop;
end$function$;$captured$;end if;end $recovery$;
revoke all on function public.carez_sync_ticket_work_packages_for_pour(uuid) from public,anon,authenticated;
grant execute on function public.carez_sync_ticket_work_packages_for_pour(uuid) to service_role;

-- carez_ticket_document_sync_trigger()
do $recovery$ begin if to_regprocedure('public.carez_ticket_document_sync_trigger()') is null then execute $captured$CREATE OR REPLACE FUNCTION public.carez_ticket_document_sync_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end$function$;$captured$;end if;end $recovery$;
revoke all on function public.carez_ticket_document_sync_trigger() from public,anon,authenticated;
grant execute on function public.carez_ticket_document_sync_trigger() to service_role;

-- carez_ticket_operation_insert_sync_trigger()
do $recovery$ begin if to_regprocedure('public.carez_ticket_operation_insert_sync_trigger()') is null then execute $captured$CREATE OR REPLACE FUNCTION public.carez_ticket_operation_insert_sync_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.measurement_method='ticket' and new.pour_plan_id is not null then
    perform public.carez_sync_ticket_work_packages_for_pour(new.pour_plan_id);
  end if;
  return new;
end$function$;$captured$;end if;end $recovery$;
revoke all on function public.carez_ticket_operation_insert_sync_trigger() from public,anon,authenticated;
grant execute on function public.carez_ticket_operation_insert_sync_trigger() to service_role;

-- carez_ticket_operation_sync_trigger()
do $recovery$ begin if to_regprocedure('public.carez_ticket_operation_sync_trigger()') is null then execute $captured$CREATE OR REPLACE FUNCTION public.carez_ticket_operation_sync_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if old.pour_plan_id is distinct from new.pour_plan_id and old.pour_plan_id is not null then
    perform public.carez_sync_ticket_work_packages_for_pour(old.pour_plan_id);
  end if;
  if new.measurement_method='ticket' and new.pour_plan_id is not null then
    perform public.carez_sync_ticket_work_packages_for_pour(new.pour_plan_id);
  end if;
  return new;
end$function$;$captured$;end if;end $recovery$;
revoke all on function public.carez_ticket_operation_sync_trigger() from public,anon,authenticated;
grant execute on function public.carez_ticket_operation_sync_trigger() to service_role;

-- carez_ticket_po_line_sync_trigger()
do $recovery$ begin if to_regprocedure('public.carez_ticket_po_line_sync_trigger()') is null then execute $captured$CREATE OR REPLACE FUNCTION public.carez_ticket_po_line_sync_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end$function$;$captured$;end if;end $recovery$;
revoke all on function public.carez_ticket_po_line_sync_trigger() from public,anon,authenticated;
grant execute on function public.carez_ticket_po_line_sync_trigger() to service_role;

-- carez_ticket_po_status_sync_trigger()
do $recovery$ begin if to_regprocedure('public.carez_ticket_po_status_sync_trigger()') is null then execute $captured$CREATE OR REPLACE FUNCTION public.carez_ticket_po_status_sync_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r record;
begin
  if old.status is distinct from new.status then
    for r in select distinct pour_plan_id from public.purchase_order_lines where purchase_order_id=new.id and company_id=new.company_id and pour_plan_id is not null loop
      perform public.carez_sync_ticket_work_packages_for_pour(r.pour_plan_id);
    end loop;
  end if;
  return new;
end$function$;$captured$;end if;end $recovery$;
revoke all on function public.carez_ticket_po_status_sync_trigger() from public,anon,authenticated;
grant execute on function public.carez_ticket_po_status_sync_trigger() to service_role;

-- carez_ticket_pour_sync_trigger()
do $recovery$ begin if to_regprocedure('public.carez_ticket_pour_sync_trigger()') is null then execute $captured$CREATE OR REPLACE FUNCTION public.carez_ticket_pour_sync_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.carez_sync_ticket_work_packages_for_pour(new.id);
  return new;
end$function$;$captured$;end if;end $recovery$;
revoke all on function public.carez_ticket_pour_sync_trigger() from public,anon,authenticated;
grant execute on function public.carez_ticket_pour_sync_trigger() to service_role;

-- carez_ticket_receipt_sync_trigger()
do $recovery$ begin if to_regprocedure('public.carez_ticket_receipt_sync_trigger()') is null then execute $captured$CREATE OR REPLACE FUNCTION public.carez_ticket_receipt_sync_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_new_pour uuid;v_old_pour uuid;
begin
  if tg_op<>'DELETE' then
    select pour_plan_id into v_new_pour from public.purchase_order_lines where id=new.purchase_order_line_id and company_id=new.company_id;
    perform public.carez_sync_ticket_work_packages_for_pour(v_new_pour);
  end if;
  if tg_op<>'INSERT' then
    select pour_plan_id into v_old_pour from public.purchase_order_lines where id=old.purchase_order_line_id and company_id=old.company_id;
    if v_old_pour is distinct from v_new_pour then perform public.carez_sync_ticket_work_packages_for_pour(v_old_pour); end if;
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end$function$;$captured$;end if;end $recovery$;
revoke all on function public.carez_ticket_receipt_sync_trigger() from public,anon,authenticated;
grant execute on function public.carez_ticket_receipt_sync_trigger() to service_role;

-- consume_work_package_inventory(uuid)
do $recovery$ begin if to_regprocedure('public.consume_work_package_inventory(uuid)') is null then execute $captured$CREATE OR REPLACE FUNCTION public.consume_work_package_inventory(p_requirement_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;$captured$;end if;end $recovery$;
revoke all on function public.consume_work_package_inventory(uuid) from public,anon,authenticated;
grant execute on function public.consume_work_package_inventory(uuid) to service_role,authenticated;

-- convert_vendor_quote_to_purchase_order(uuid)
do $recovery$ begin if to_regprocedure('public.convert_vendor_quote_to_purchase_order(uuid)') is null then execute $captured$CREATE OR REPLACE FUNCTION public.convert_vendor_quote_to_purchase_order(p_quote_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_company uuid:=public.get_my_company_id();
  q public.vendor_quotes%rowtype;
  v public.vendors%rowtype;
  bp public.company_billing_profiles%rowtype;
  v_po_id uuid;
  v_po_number text;
begin
  select * into q from public.vendor_quotes where id=p_quote_id and company_id=v_company for update;
  if q.id is null then raise exception 'Quote not found'; end if;
  if q.status not in ('received','accepted') then raise exception 'Only a received or accepted quote can be converted'; end if;
  if not exists(select 1 from public.vendor_quote_lines where vendor_quote_id=q.id) then raise exception 'Quote has no lines'; end if;
  select * into v from public.vendors where id=q.vendor_id and company_id=v_company;
  select * into bp from public.company_billing_profiles where company_id=v_company;
  v_po_number:=public.next_company_document_number('purchase_order');
  insert into public.purchase_orders(company_id,project_id,vendor_id,source_quote_id,po_number,status,budget_section_id,change_order_id,pour_plan_id,
    vendor_name_snapshot,vendor_contact_snapshot,vendor_email_snapshot,vendor_phone_snapshot,vendor_address_snapshot,
    from_name_snapshot,from_address_snapshot,from_phone_snapshot,from_email_snapshot,from_ubi_snapshot,from_license_snapshot,notes,created_by)
  values(v_company,q.project_id,q.vendor_id,q.id,v_po_number,'draft',q.budget_section_id,q.change_order_id,q.pour_plan_id,
    v.name,v.contact_name,v.email,v.phone,concat_ws(', ',nullif(v.address_line1,''),nullif(v.address_line2,''),nullif(v.city,''),nullif(v.state,''),nullif(v.postal_code,'')),
    coalesce(bp.display_name,'Carez Concrete'),concat_ws(', ',nullif(bp.address_line1,''),nullif(bp.address_line2,''),nullif(bp.city,''),nullif(bp.state,''),nullif(bp.postal_code,'')),bp.phone,bp.email,bp.ubi_number,bp.contractor_license_number,
    'Converted from '||q.internal_quote_number,q.created_by)
  returning id into v_po_id;
  insert into public.purchase_order_lines(company_id,purchase_order_id,cost_code_id,catalog_item_id,pour_plan_id,pour_cost_item_id,budget_section_id,change_order_id,description,quantity,unit,unit_cost,subtotal,sales_tax,total_cost,notes,sort_order)
  select v_company,v_po_id,l.cost_code_id,l.catalog_item_id,coalesce(q.pour_plan_id,pci.pour_plan_id),l.pour_cost_item_id,q.budget_section_id,q.change_order_id,l.description,l.quantity,l.unit,l.unit_cost,l.subtotal,l.sales_tax,l.total_cost,l.notes,l.sort_order
  from public.vendor_quote_lines l left join public.pour_cost_items pci on pci.id=l.pour_cost_item_id where l.vendor_quote_id=q.id;
  update public.vendor_quotes set status='converted',updated_at=now() where id=q.id;
  return v_po_id;
end;
$function$;$captured$;end if;end $recovery$;
revoke all on function public.convert_vendor_quote_to_purchase_order(uuid) from public,anon,authenticated;
grant execute on function public.convert_vendor_quote_to_purchase_order(uuid) to service_role,authenticated;

-- create_payroll_run(date,date,date,text)
do $recovery$ begin if to_regprocedure('public.create_payroll_run(date,date,date,text)') is null then execute $captured$CREATE OR REPLACE FUNCTION public.create_payroll_run(p_period_start date, p_period_end date, p_pay_date date DEFAULT NULL::date, p_notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_company uuid:=public.get_my_company_id();
  v_run uuid;
  v_count integer;
begin
  if v_company is null then raise exception 'Company not found'; end if;
  if p_period_start is null or p_period_end is null or p_period_end<p_period_start then raise exception 'Invalid payroll period'; end if;
  insert into public.payroll_runs(company_id,period_start,period_end,pay_date,notes,created_by)
  values(v_company,p_period_start,p_period_end,p_pay_date,nullif(trim(coalesce(p_notes,'')),''),auth.uid()) returning id into v_run;

  insert into public.payroll_run_lines(
    company_id,payroll_run_id,timecard_id,crew_member_id,worker_name,work_date,regular_hours,overtime_hours,
    gross_wages,employer_social_security,employer_medicare,employer_futa,employer_wa_sui,employer_li,sick_leave_reserve,payroll_funding_requirement
  )
  select
    t.company_id,v_run,t.id,t.crew_member_id,coalesce(c.name,t.worker_name),t.work_date,coalesce(t.regular_hours,0),coalesce(t.overtime_hours,0),
    coalesce(t.gross_wage_cost,0),coalesce(t.employer_social_security_cost,0),coalesce(t.employer_medicare_cost,0),coalesce(t.employer_futa_cost,0),coalesce(t.employer_wa_sui_cost,0),coalesce(t.employer_li_cost,0),coalesce(t.sick_leave_reserve_cost,0),
    round(coalesce(t.gross_wage_cost,0)+coalesce(t.employer_social_security_cost,0)+coalesce(t.employer_medicare_cost,0)+coalesce(t.employer_futa_cost,0)+coalesce(t.employer_wa_sui_cost,0)+coalesce(t.employer_li_cost,0),2)
  from public.timecards t
  join public.crew_members c on c.id=t.crew_member_id and c.company_id=t.company_id
  where t.company_id=v_company
    and t.work_date between p_period_start and p_period_end
    and coalesce(c.worker_type,'employee')='employee'
    and coalesce(c.is_owner,false)=false
    and not exists(select 1 from public.payroll_run_lines x where x.timecard_id=t.id and x.active);

  get diagnostics v_count=row_count;
  if v_count=0 then
    delete from public.payroll_runs where id=v_run;
    raise exception 'No unprocessed W-2 timecards were found in this period';
  end if;
  return v_run;
end;
$function$;$captured$;end if;end $recovery$;
revoke all on function public.create_payroll_run(date,date,date,text) from public,anon,authenticated;
grant execute on function public.create_payroll_run(date,date,date,text) to service_role,authenticated;

-- ignore_bank_transaction(uuid,text,boolean,boolean)
do $recovery$ begin if to_regprocedure('public.ignore_bank_transaction(uuid,text,boolean,boolean)') is null then execute $captured$CREATE OR REPLACE FUNCTION public.ignore_bank_transaction(p_bank_transaction_id uuid, p_note text DEFAULT NULL::text, p_remember_rule boolean DEFAULT false, p_rule_auto_apply boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_company uuid:=public.get_my_company_id(); v_tx public.plaid_transactions%rowtype; v_pattern text; v_rule uuid;
begin
  select * into v_tx from public.plaid_transactions where id=p_bank_transaction_id and company_id=v_company for update;
  if not found then raise exception 'Bank transaction not found'; end if;
  if v_tx.review_status='matched' then raise exception 'Matched transactions cannot be ignored'; end if;
  if p_remember_rule then
    v_pattern:=public.normalize_bank_text(coalesce(v_tx.merchant_name,v_tx.name));
    if v_pattern<>'' then insert into public.bank_reconciliation_rules(company_id,name,merchant_pattern,direction,category_primary,action_type,business_use_percent,auto_apply,created_by)
      values(v_company,coalesce(v_tx.merchant_name,v_tx.name)||' → Ignore',v_pattern,case when v_tx.cash_amount>=0 then 'inflow' else 'outflow' end,v_tx.category_primary,'ignore',100,p_rule_auto_apply,auth.uid()) returning id into v_rule; end if;
  end if;
  update public.plaid_transactions set review_status='ignored',match_note=coalesce(nullif(trim(p_note),''),'Ignored during bank reconciliation.'),reconciled_at=now(),reconciled_by=auth.uid(),reconciliation_source=case when v_rule is null then 'manual_ignore' else 'learned_rule' end,bank_rule_id=v_rule,updated_at=now() where id=v_tx.id;
  update public.bank_reconciliation_candidates set status='stale',updated_at=now() where bank_transaction_id=v_tx.id and status='active';
end;
$function$;$captured$;end if;end $recovery$;
revoke all on function public.ignore_bank_transaction(uuid,text,boolean,boolean) from public,anon,authenticated;
grant execute on function public.ignore_bank_transaction(uuid,text,boolean,boolean) to service_role,authenticated;

-- issue_purchase_order(uuid,date)
do $recovery$ begin if to_regprocedure('public.issue_purchase_order(uuid,date)') is null then execute $captured$CREATE OR REPLACE FUNCTION public.issue_purchase_order(p_po_id uuid, p_issue_date date DEFAULT CURRENT_DATE)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_company uuid:=public.get_my_company_id();
  po public.purchase_orders%rowtype;
  v public.vendors%rowtype;
  bp public.company_billing_profiles%rowtype;
begin
  select * into po from public.purchase_orders where id=p_po_id and company_id=v_company for update;
  if po.id is null then raise exception 'Purchase order not found'; end if;
  if po.status<>'draft' then raise exception 'Only draft purchase orders can be issued'; end if;
  if not exists(select 1 from public.purchase_order_lines where purchase_order_id=po.id) then raise exception 'Purchase order has no lines'; end if;
  select * into v from public.vendors where id=po.vendor_id and company_id=v_company;
  select * into bp from public.company_billing_profiles where company_id=v_company;
  update public.purchase_orders set status='issued',issue_date=coalesce(p_issue_date,current_date),issued_at=now(),
    vendor_name_snapshot=v.name,vendor_contact_snapshot=v.contact_name,vendor_email_snapshot=v.email,vendor_phone_snapshot=v.phone,
    vendor_address_snapshot=concat_ws(', ',nullif(v.address_line1,''),nullif(v.address_line2,''),nullif(v.city,''),nullif(v.state,''),nullif(v.postal_code,'')),
    from_name_snapshot=coalesce(bp.display_name,'Carez Concrete'),from_address_snapshot=concat_ws(', ',nullif(bp.address_line1,''),nullif(bp.address_line2,''),nullif(bp.city,''),nullif(bp.state,''),nullif(bp.postal_code,'')),
    from_phone_snapshot=bp.phone,from_email_snapshot=bp.email,from_ubi_snapshot=bp.ubi_number,from_license_snapshot=bp.contractor_license_number,updated_at=now()
  where id=po.id;
  update public.pour_plans set status='planning',updated_at=now() where project_id=po.project_id and status in ('authorized','hold');
end;
$function$;$captured$;end if;end $recovery$;
revoke all on function public.issue_purchase_order(uuid,date) from public,anon,authenticated;
grant execute on function public.issue_purchase_order(uuid,date) to service_role,authenticated;

-- link_document_to_bank_transaction(uuid,uuid)
do $recovery$ begin if to_regprocedure('public.link_document_to_bank_transaction(uuid,uuid)') is null then execute $captured$CREATE OR REPLACE FUNCTION public.link_document_to_bank_transaction(p_document_id uuid, p_bank_transaction_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_company uuid:=public.get_my_company_id();
  d public.company_documents%rowtype;
  t public.plaid_transactions%rowtype;
begin
  if v_company is null or public.get_my_role()='employee' then raise exception 'Owner access required'; end if;
  select * into d from public.company_documents where id=p_document_id and company_id=v_company for update;
  if not found then raise exception 'Document not found'; end if;
  select * into t from public.plaid_transactions where id=p_bank_transaction_id and company_id=v_company and coalesce(removed,false)=false;
  if not found then raise exception 'Bank transaction not found'; end if;
  update public.company_documents set bank_transaction_id=t.id,review_status='matched',reviewed_at=now(),reviewed_by=auth.uid(),updated_at=now()
  where id=d.id;
  return true;
end;
$function$;$captured$;end if;end $recovery$;
revoke all on function public.link_document_to_bank_transaction(uuid,uuid) from public,anon,authenticated;
grant execute on function public.link_document_to_bank_transaction(uuid,uuid) to service_role,authenticated;

-- link_document_to_po_receipt(uuid,uuid,numeric,date,text,text)
do $recovery$ begin if to_regprocedure('public.link_document_to_po_receipt(uuid,uuid,numeric,date,text,text)') is null then execute $captured$CREATE OR REPLACE FUNCTION public.link_document_to_po_receipt(p_document_id uuid, p_purchase_order_line_id uuid, p_quantity_received numeric, p_received_date date, p_delivery_ticket text DEFAULT NULL::text, p_notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_company uuid:=public.get_my_company_id();
  v_role text:=public.get_my_role();
  d public.company_documents%rowtype;
  l public.purchase_order_lines%rowtype;
  po public.purchase_orders%rowtype;
  v_receipt uuid;
begin
  if v_company is null or v_role='employee' then raise exception 'Owner access required'; end if;
  if coalesce(p_quantity_received,0)<=0 then raise exception 'Delivered quantity must be greater than zero'; end if;

  select * into d from public.company_documents where id=p_document_id and company_id=v_company for update;
  if not found then raise exception 'Document not found'; end if;
  if d.document_type not in ('concrete_ticket','delivery_ticket') then raise exception 'Only concrete or delivery tickets can create a PO receipt'; end if;
  if d.purchase_order_receipt_id is not null then return d.purchase_order_receipt_id; end if;

  select * into l from public.purchase_order_lines where id=p_purchase_order_line_id and company_id=v_company;
  if not found then raise exception 'PO line not found'; end if;
  select * into po from public.purchase_orders where id=l.purchase_order_id and company_id=v_company;
  if not found or po.status<>'issued' then raise exception 'Only an issued PO can receive a delivery'; end if;
  if d.project_id is not null and d.project_id<>po.project_id then raise exception 'Document job does not match the PO job'; end if;
  if d.vendor_id is not null and d.vendor_id<>po.vendor_id then raise exception 'Document vendor does not match the PO vendor'; end if;

  insert into public.purchase_order_receipts(
    company_id,purchase_order_id,purchase_order_line_id,received_date,quantity_received,delivery_ticket,notes,received_by
  ) values(
    v_company,po.id,l.id,coalesce(p_received_date,current_date),p_quantity_received,
    nullif(trim(coalesce(p_delivery_ticket,'')),''),nullif(trim(coalesce(p_notes,'')),''),auth.uid()
  ) returning id into v_receipt;

  update public.company_documents set
    project_id=po.project_id,
    vendor_id=po.vendor_id,
    purchase_order_id=po.id,
    purchase_order_receipt_id=v_receipt,
    reference_number=coalesce(nullif(trim(coalesce(p_delivery_ticket,'')),''),reference_number),
    document_date=coalesce(p_received_date,document_date,current_date),
    review_status='matched',reviewed_at=now(),reviewed_by=auth.uid(),updated_at=now()
  where id=d.id;
  return v_receipt;
end;
$function$;$captured$;end if;end $recovery$;
revoke all on function public.link_document_to_po_receipt(uuid,uuid,numeric,date,text,text) from public,anon,authenticated;
grant execute on function public.link_document_to_po_receipt(uuid,uuid,numeric,date,text,text) to service_role,authenticated;

-- link_document_to_vendor_bill(uuid,uuid)
do $recovery$ begin if to_regprocedure('public.link_document_to_vendor_bill(uuid,uuid)') is null then execute $captured$CREATE OR REPLACE FUNCTION public.link_document_to_vendor_bill(p_document_id uuid, p_vendor_bill_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_company uuid:=public.get_my_company_id();
  d public.company_documents%rowtype;
  b public.vendor_bills%rowtype;
begin
  if v_company is null or public.get_my_role()='employee' then raise exception 'Owner access required'; end if;
  select * into d from public.company_documents where id=p_document_id and company_id=v_company for update;
  if not found then raise exception 'Document not found'; end if;
  select * into b from public.vendor_bills where id=p_vendor_bill_id and company_id=v_company;
  if not found then raise exception 'Vendor bill not found'; end if;
  if d.project_id is not null and d.project_id<>b.project_id then raise exception 'Document job does not match the vendor bill'; end if;
  if d.vendor_id is not null and d.vendor_id<>b.vendor_id then raise exception 'Document vendor does not match the vendor bill'; end if;
  update public.company_documents set
    project_id=b.project_id,vendor_id=b.vendor_id,purchase_order_id=coalesce(b.purchase_order_id,purchase_order_id),
    vendor_bill_id=b.id,reference_number=coalesce(reference_number,b.vendor_bill_number),review_status='matched',
    reviewed_at=now(),reviewed_by=auth.uid(),updated_at=now()
  where id=d.id;
  return true;
end;
$function$;$captured$;end if;end $recovery$;
revoke all on function public.link_document_to_vendor_bill(uuid,uuid) from public,anon,authenticated;
grant execute on function public.link_document_to_vendor_bill(uuid,uuid) to service_role,authenticated;

-- next_company_document_number(text)
do $recovery$ begin if to_regprocedure('public.next_company_document_number(text)') is null then execute $captured$CREATE OR REPLACE FUNCTION public.next_company_document_number(p_document_type text)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_company uuid;
  v_prefix text;
  v_next integer;
  v_padding integer;
begin
  v_company:=public.get_my_company_id();
  if v_company is null then raise exception 'Company not found'; end if;
  if p_document_type not in ('purchase_order','procurement_quote') then raise exception 'Unsupported document type'; end if;
  insert into public.document_sequences(company_id,document_type,prefix,next_number,padding)
  values(v_company,p_document_type,case when p_document_type='purchase_order' then 'PO-' else 'PQ-' end,1,4)
  on conflict(company_id,document_type) do nothing;
  select prefix,next_number,padding into v_prefix,v_next,v_padding
  from public.document_sequences where company_id=v_company and document_type=p_document_type for update;
  update public.document_sequences set next_number=v_next+1 where company_id=v_company and document_type=p_document_type;
  return v_prefix||lpad(v_next::text,v_padding,'0');
end;
$function$;$captured$;end if;end $recovery$;
revoke all on function public.next_company_document_number(text) from public,anon,authenticated;
grant execute on function public.next_company_document_number(text) to service_role,authenticated;

-- normalize_bank_text(text)
do $recovery$ begin if to_regprocedure('public.normalize_bank_text(text)') is null then execute $captured$CREATE OR REPLACE FUNCTION public.normalize_bank_text(p_text text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select trim(regexp_replace(lower(coalesce(p_text,'')),'[^a-z0-9]+',' ','g'));
$function$;$captured$;end if;end $recovery$;
revoke all on function public.normalize_bank_text(text) from public,anon,authenticated;
grant execute on function public.normalize_bank_text(text) to service_role;

-- outlook_ingest_message(text,text,jsonb,jsonb,boolean)
do $recovery$ begin if to_regprocedure('public.outlook_ingest_message(text,text,jsonb,jsonb,boolean)') is null then execute $captured$CREATE OR REPLACE FUNCTION public.outlook_ingest_message(p_subscription_id text, p_client_state text, p_message jsonb, p_candidate jsonb, p_auto_create boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_conn public.outlook_connections%rowtype;
  v_msg public.outlook_messages%rowtype;
  v_lead uuid;
  v_opp text;
  v_customer text;
  v_project text;
begin
  select * into v_conn from public.outlook_connections
  where subscription_id=p_subscription_id and subscription_client_state=p_client_state and status='active';
  if not found then raise exception 'Invalid Outlook notification'; end if;

  insert into public.outlook_messages(company_id,outlook_message_id,conversation_id,internet_message_id,subject,sender_name,sender_email,received_at,body_preview,web_link,classification,confidence)
  values(v_conn.company_id,p_message->>'id',p_message->>'conversationId',p_message->>'internetMessageId',p_message->>'subject',p_message->>'senderName',p_message->>'senderEmail',nullif(p_message->>'receivedDateTime','')::timestamptz,p_message->>'bodyPreview',p_message->>'webLink',p_candidate->>'classification',coalesce((p_candidate->>'confidence')::numeric,0))
  on conflict(company_id,outlook_message_id) do update set classification=excluded.classification,confidence=excluded.confidence
  returning * into v_msg;

  if v_msg.lead_id is not null then return jsonb_build_object('status','existing','lead_id',v_msg.lead_id); end if;

  v_customer:=coalesce(nullif(p_candidate->>'customerName',''),nullif(p_message->>'senderName',''),nullif(p_message->>'senderEmail',''),'Unknown Customer');
  v_project:=coalesce(nullif(p_candidate->>'projectName',''),
    v_customer||case when nullif(p_candidate->>'address','') is not null then ' - '||(p_candidate->>'address') when nullif(p_candidate->>'city','') is not null then ' - '||(p_candidate->>'city') else '' end);

  if p_auto_create then
    v_opp:=public.next_opportunity_number_for_company(v_conn.company_id);
    insert into public.leads(company_id,opportunity_number,customer_name,contact_name,email,phone,project_name,address,city,state,postal_code,scope,bid_due,status,source,source_message_id,source_conversation_id,notes)
    values(v_conn.company_id,v_opp,v_customer,nullif(p_candidate->>'contactName',''),nullif(p_candidate->>'email',''),nullif(p_candidate->>'phone',''),v_project,nullif(p_candidate->>'address',''),nullif(p_candidate->>'city',''),coalesce(nullif(p_candidate->>'state',''),'WA'),nullif(p_candidate->>'postalCode',''),nullif(p_candidate->>'scope',''),nullif(p_candidate->>'bidDue','')::date,'new','outlook',p_message->>'id',p_message->>'conversationId','Automatically created from Outlook')
    returning id into v_lead;
    update public.outlook_messages set lead_id=v_lead where id=v_msg.id;
    insert into public.lead_activities(company_id,lead_id,activity_type,note)
    values(v_conn.company_id,v_lead,'email','Lead automatically created from Outlook email: '||coalesce(p_message->>'subject','No subject'));
    return jsonb_build_object('status','created','lead_id',v_lead,'opportunity_number',v_opp);
  end if;

  insert into public.lead_inbox_candidates(company_id,outlook_message_id,confidence,customer_name,contact_name,email,phone,project_name,address,city,state,postal_code,scope,bid_due)
  values(v_conn.company_id,v_msg.id,coalesce((p_candidate->>'confidence')::numeric,0),v_customer,nullif(p_candidate->>'contactName',''),nullif(p_candidate->>'email',''),nullif(p_candidate->>'phone',''),v_project,nullif(p_candidate->>'address',''),nullif(p_candidate->>'city',''),coalesce(nullif(p_candidate->>'state',''),'WA'),nullif(p_candidate->>'postalCode',''),nullif(p_candidate->>'scope',''),nullif(p_candidate->>'bidDue','')::date)
  on conflict(company_id,outlook_message_id) do nothing;
  return jsonb_build_object('status','candidate');
end;
$function$;$captured$;end if;end $recovery$;
revoke all on function public.outlook_ingest_message(text,text,jsonb,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.outlook_ingest_message(text,text,jsonb,jsonb,boolean) to service_role,authenticated;

-- outlook_webhook_connection(text,text)
do $recovery$ begin if to_regprocedure('public.outlook_webhook_connection(text,text)') is null then execute $captured$CREATE OR REPLACE FUNCTION public.outlook_webhook_connection(p_subscription_id text, p_client_state text)
 RETURNS TABLE(id uuid, company_id uuid, access_token_ciphertext text, access_token_iv text, access_token_auth_tag text, refresh_token_ciphertext text, refresh_token_iv text, refresh_token_auth_tag text, token_expires_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select c.id,c.company_id,c.access_token_ciphertext,c.access_token_iv,c.access_token_auth_tag,
         c.refresh_token_ciphertext,c.refresh_token_iv,c.refresh_token_auth_tag,c.token_expires_at
  from public.outlook_connections c
  where c.subscription_id=p_subscription_id and c.subscription_client_state=p_client_state and c.status='active'
  limit 1;
$function$;$captured$;end if;end $recovery$;
revoke all on function public.outlook_webhook_connection(text,text) from public,anon,authenticated;
grant execute on function public.outlook_webhook_connection(text,text) to service_role,authenticated;

-- outlook_webhook_update_tokens(text,text,text,text,text,text,text,text,timestamptz)
do $recovery$ begin if to_regprocedure('public.outlook_webhook_update_tokens(text,text,text,text,text,text,text,text,timestamptz)') is null then execute $captured$CREATE OR REPLACE FUNCTION public.outlook_webhook_update_tokens(p_subscription_id text, p_client_state text, p_access_cipher text, p_access_iv text, p_access_tag text, p_refresh_cipher text, p_refresh_iv text, p_refresh_tag text, p_expires_at timestamp with time zone)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.outlook_connections set
    access_token_ciphertext=p_access_cipher,access_token_iv=p_access_iv,access_token_auth_tag=p_access_tag,
    refresh_token_ciphertext=p_refresh_cipher,refresh_token_iv=p_refresh_iv,refresh_token_auth_tag=p_refresh_tag,
    token_expires_at=p_expires_at,updated_at=now(),last_error=null
  where subscription_id=p_subscription_id and subscription_client_state=p_client_state and status='active';
  return found;
end;
$function$;$captured$;end if;end $recovery$;
revoke all on function public.outlook_webhook_update_tokens(text,text,text,text,text,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.outlook_webhook_update_tokens(text,text,text,text,text,text,text,text,timestamptz) to service_role,authenticated;

-- post_vendor_bill(uuid)
do $recovery$ begin if to_regprocedure('public.post_vendor_bill(uuid)') is null then execute $captured$CREATE OR REPLACE FUNCTION public.post_vendor_bill(p_bill_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_company uuid:=public.get_my_company_id();
  b public.vendor_bills%rowtype;
begin
  select * into b from public.vendor_bills where id=p_bill_id and company_id=v_company for update;
  if b.id is null then raise exception 'Vendor bill not found'; end if;
  if b.status<>'draft' then raise exception 'Only draft vendor bills can be posted'; end if;
  if not exists(select 1 from public.vendor_bill_lines where vendor_bill_id=b.id) then raise exception 'Vendor bill has no lines'; end if;
  insert into public.project_costs(company_id,project_id,cost_code_id,catalog_item_id,cost_date,description,vendor_name,quantity,unit,unit_cost,subtotal,sales_tax,total_cost,source_type,reference_number,notes,created_by,budget_section_id,change_order_id,vendor_id,purchase_order_id,purchase_order_line_id,vendor_bill_id,vendor_bill_line_id,pour_plan_id,pour_cost_item_id)
  select v_company,b.project_id,l.cost_code_id,l.catalog_item_id,b.bill_date,l.description,v.name,l.quantity,l.unit,l.unit_cost,l.subtotal,l.sales_tax,l.total_cost,'vendor_invoice',b.vendor_bill_number,l.notes,b.created_by,l.budget_section_id,l.change_order_id,b.vendor_id,b.purchase_order_id,l.purchase_order_line_id,b.id,l.id,l.pour_plan_id,l.pour_cost_item_id
  from public.vendor_bill_lines l join public.vendors v on v.id=b.vendor_id where l.vendor_bill_id=b.id
  on conflict (vendor_bill_line_id) where vendor_bill_line_id is not null do nothing;
  update public.vendor_bills set status='posted',posted_at=now(),updated_at=now() where id=b.id;
  update public.pour_plans set status='planning',updated_at=now() where project_id=b.project_id and status in ('authorized','hold');
end;
$function$;$captured$;end if;end $recovery$;
revoke all on function public.post_vendor_bill(uuid) from public,anon,authenticated;
grant execute on function public.post_vendor_bill(uuid) to service_role,authenticated;

-- process_payroll_run(uuid,numeric,text)
do $recovery$ begin if to_regprocedure('public.process_payroll_run(uuid,numeric,text)') is null then execute $captured$CREATE OR REPLACE FUNCTION public.process_payroll_run(p_payroll_run_id uuid, p_actual_cash_paid numeric DEFAULT NULL::numeric, p_reference_number text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_company uuid:=public.get_my_company_id();
begin
  if p_actual_cash_paid is not null and p_actual_cash_paid<0 then raise exception 'Actual cash paid cannot be negative'; end if;
  update public.payroll_runs set status='processed',processed_at=now(),actual_cash_paid=case when p_actual_cash_paid is null then actual_cash_paid else round(p_actual_cash_paid,2) end,reference_number=nullif(trim(coalesce(p_reference_number,'')),''),updated_at=now()
  where id=p_payroll_run_id and company_id=v_company and status='approved';
  if not found then raise exception 'Approved payroll run not found'; end if;
end;$function$;$captured$;end if;end $recovery$;
revoke all on function public.process_payroll_run(uuid,numeric,text) from public,anon,authenticated;
grant execute on function public.process_payroll_run(uuid,numeric,text) to service_role,authenticated;

-- reconcile_bank_as_transfer(uuid,uuid)
do $recovery$ begin if to_regprocedure('public.reconcile_bank_as_transfer(uuid,uuid)') is null then execute $captured$CREATE OR REPLACE FUNCTION public.reconcile_bank_as_transfer(p_bank_transaction_id uuid, p_other_bank_transaction_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_company uuid:=public.get_my_company_id(); a public.plaid_transactions%rowtype; b public.plaid_transactions%rowtype;
begin
  select * into a from public.plaid_transactions where id=p_bank_transaction_id and company_id=v_company for update;
  select * into b from public.plaid_transactions where id=p_other_bank_transaction_id and company_id=v_company for update;
  if a.id is null or b.id is null or a.id=b.id then raise exception 'Transfer pair not found'; end if;
  if a.pending or b.pending or a.removed or b.removed or a.review_status='matched' or b.review_status='matched' then raise exception 'Transfer pair is not available'; end if;
  if a.account_id=b.account_id or a.cash_amount*b.cash_amount>=0 or abs(abs(a.cash_amount)-abs(b.cash_amount))>0.01 or abs(a.transaction_date-b.transaction_date)>3 then raise exception 'Transactions do not form a valid internal transfer pair'; end if;
  update public.plaid_transactions set review_status='matched',matched_entity_type='internal_transfer',matched_entity_id=case when id=a.id then b.id else a.id end,match_note='Internal transfer between Carez accounts',
    reconciled_at=now(),reconciled_by=auth.uid(),reconciliation_source='approved_suggestion',reconciliation_confidence=100,updated_at=now() where id in (a.id,b.id);
  update public.bank_reconciliation_candidates set status='stale',updated_at=now() where bank_transaction_id in (a.id,b.id) and status='active';
end;
$function$;$captured$;end if;end $recovery$;
revoke all on function public.reconcile_bank_as_transfer(uuid,uuid) from public,anon,authenticated;
grant execute on function public.reconcile_bank_as_transfer(uuid,uuid) to service_role,authenticated;

-- reconcile_bank_existing(uuid,text,uuid,text,integer)
do $recovery$ begin if to_regprocedure('public.reconcile_bank_existing(uuid,text,uuid,text,integer)') is null then execute $captured$CREATE OR REPLACE FUNCTION public.reconcile_bank_existing(p_bank_transaction_id uuid, p_entity_type text, p_entity_id uuid, p_note text DEFAULT NULL::text, p_confidence integer DEFAULT 100)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_company uuid:=public.get_my_company_id();
  v_tx public.plaid_transactions%rowtype;
  v_amount numeric;
  v_date date;
  v_entity_name text;
begin
  if v_company is null then raise exception 'Company not found'; end if;
  select * into v_tx from public.plaid_transactions where id=p_bank_transaction_id and company_id=v_company for update;
  if not found then raise exception 'Bank transaction not found'; end if;
  if v_tx.pending or v_tx.removed then raise exception 'Pending or removed transactions cannot be reconciled'; end if;
  if v_tx.review_status='matched' then raise exception 'Bank transaction is already reconciled'; end if;

  if p_entity_type='customer_payment' then
    select amount,received_date into v_amount,v_date from public.customer_payments where id=p_entity_id and company_id=v_company and status='posted' and bank_transaction_id is null;
    if not found or v_tx.cash_amount<=0 or abs(v_tx.cash_amount-v_amount)>0.01 or abs(v_tx.transaction_date-v_date)>5 then raise exception 'Customer payment does not match this bank transaction'; end if;
    update public.customer_payments set bank_transaction_id=v_tx.id,updated_at=now() where id=p_entity_id and company_id=v_company;
  elsif p_entity_type='vendor_payment' then
    select amount+processing_fee,payment_date into v_amount,v_date from public.vendor_payments where id=p_entity_id and company_id=v_company and status='posted' and bank_transaction_id is null;
    if not found or v_tx.cash_amount>=0 or abs(abs(v_tx.cash_amount)-v_amount)>0.01 or abs(v_tx.transaction_date-v_date)>5 then raise exception 'Vendor payment does not match this bank transaction'; end if;
    update public.vendor_payments set bank_transaction_id=v_tx.id,updated_at=now() where id=p_entity_id and company_id=v_company;
  elsif p_entity_type='company_expense' then
    select total_amount,coalesce(paid_date,expense_date) into v_amount,v_date from public.company_expenses where id=p_entity_id and company_id=v_company and payment_status='paid' and bank_transaction_id is null;
    if not found or v_tx.cash_amount>=0 or abs(abs(v_tx.cash_amount)-v_amount)>0.01 or abs(v_tx.transaction_date-v_date)>5 then raise exception 'Company expense does not match this bank transaction'; end if;
    update public.company_expenses set bank_transaction_id=v_tx.id,updated_at=now() where id=p_entity_id and company_id=v_company;
  elsif p_entity_type='payroll_run' then
    select actual_cash_paid,pay_date into v_amount,v_date from public.payroll_runs where id=p_entity_id and company_id=v_company and status='processed' and bank_transaction_id is null;
    if not found or v_amount is null or v_tx.cash_amount>=0 or abs(abs(v_tx.cash_amount)-v_amount)>0.01 or abs(v_tx.transaction_date-v_date)>5 then raise exception 'Payroll run does not match this bank transaction'; end if;
    update public.payroll_runs set bank_transaction_id=v_tx.id,updated_at=now() where id=p_entity_id and company_id=v_company;
  elsif p_entity_type='tax_remittance' then
    select amount,payment_date into v_amount,v_date from public.company_tax_remittances where id=p_entity_id and company_id=v_company and bank_transaction_id is null;
    if not found or v_tx.cash_amount>=0 or abs(abs(v_tx.cash_amount)-v_amount)>0.01 or abs(v_tx.transaction_date-v_date)>5 then raise exception 'Tax remittance does not match this bank transaction'; end if;
    update public.company_tax_remittances set bank_transaction_id=v_tx.id where id=p_entity_id and company_id=v_company;
  else
    raise exception 'Unsupported existing record type';
  end if;

  update public.plaid_transactions set review_status='matched',matched_entity_type=p_entity_type,matched_entity_id=p_entity_id,
    match_note=coalesce(p_note,'Matched to existing Carez record.'),reconciled_at=now(),reconciled_by=auth.uid(),
    reconciliation_source='existing_record',reconciliation_confidence=greatest(0,least(100,coalesce(p_confidence,100))),updated_at=now()
  where id=v_tx.id;
  update public.bank_reconciliation_candidates set status=case when entity_id=p_entity_id and entity_type=p_entity_type then 'accepted' else 'stale' end,updated_at=now() where bank_transaction_id=v_tx.id and status='active';
  return p_entity_id;
end;
$function$;$captured$;end if;end $recovery$;
revoke all on function public.reconcile_bank_existing(uuid,text,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.reconcile_bank_existing(uuid,text,uuid,text,integer) to service_role,authenticated;

-- reconcile_bank_to_company_expense(uuid,uuid,text,numeric,text,boolean,boolean)
do $recovery$ begin if to_regprocedure('public.reconcile_bank_to_company_expense(uuid,uuid,text,numeric,text,boolean,boolean)') is null then execute $captured$CREATE OR REPLACE FUNCTION public.reconcile_bank_to_company_expense(p_bank_transaction_id uuid, p_overhead_item_id uuid DEFAULT NULL::uuid, p_category text DEFAULT NULL::text, p_business_use_percent numeric DEFAULT NULL::numeric, p_description text DEFAULT NULL::text, p_remember_rule boolean DEFAULT false, p_rule_auto_apply boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_company uuid:=public.get_my_company_id(); v_tx public.plaid_transactions%rowtype; v_expense uuid; v_amount numeric; v_category text; v_business numeric; v_rule uuid; v_pattern text; v_overhead public.overhead_items%rowtype;
begin
  select * into v_tx from public.plaid_transactions where id=p_bank_transaction_id and company_id=v_company for update;
  if not found then raise exception 'Bank transaction not found'; end if;
  if v_tx.pending or v_tx.removed or v_tx.review_status='matched' or v_tx.cash_amount>=0 then raise exception 'This transaction cannot create a company expense'; end if;
  if p_overhead_item_id is not null then
    select * into v_overhead from public.overhead_items where id=p_overhead_item_id and company_id=v_company and active;
    if not found then raise exception 'Overhead item not found'; end if;
  end if;
  v_amount:=round(abs(v_tx.cash_amount),2);
  v_category:=coalesce(nullif(trim(p_category),''),v_overhead.category,'Other');
  v_business:=greatest(0,least(100,coalesce(p_business_use_percent,v_overhead.business_use_percent,100)));
  insert into public.company_expenses(company_id,overhead_item_id,expense_date,category,payee,description,subtotal,sales_tax,total_amount,business_use_percent,business_expense_amount,cash_source,payment_status,paid_date,payment_method,reference_number,notes,source_type,source_id,created_by,bank_transaction_id)
  values(v_company,p_overhead_item_id,v_tx.transaction_date,v_category,coalesce(v_tx.merchant_name,v_tx.name),coalesce(nullif(trim(p_description),''),coalesce(v_tx.merchant_name,v_tx.name)),v_amount,0,v_amount,v_business,round(v_amount*v_business/100,2),'company_account','paid',v_tx.transaction_date,'other',left(v_tx.name,120),'Created from bank reconciliation.','bank_transaction',v_tx.id,auth.uid(),v_tx.id) returning id into v_expense;
  if p_remember_rule then
    v_pattern:=public.normalize_bank_text(coalesce(v_tx.merchant_name,v_tx.name));
    if v_pattern<>'' then
      insert into public.bank_reconciliation_rules(company_id,name,merchant_pattern,direction,category_primary,action_type,overhead_item_id,expense_category,business_use_percent,auto_apply,created_by)
      values(v_company,coalesce(v_tx.merchant_name,v_tx.name)||' → '||v_category,v_pattern,'outflow',v_tx.category_primary,'company_expense',p_overhead_item_id,v_category,v_business,p_rule_auto_apply,auth.uid()) returning id into v_rule;
    end if;
  end if;
  update public.plaid_transactions set review_status='matched',matched_entity_type='company_expense',matched_entity_id=v_expense,match_note='Recorded company expense — '||v_category,
    reconciled_at=now(),reconciled_by=auth.uid(),reconciliation_source=case when v_rule is null then 'manual_classification' else 'learned_rule' end,reconciliation_confidence=100,bank_rule_id=v_rule,updated_at=now() where id=v_tx.id;
  update public.bank_reconciliation_candidates set status='stale',updated_at=now() where bank_transaction_id=v_tx.id and status='active';
  return v_expense;
end;
$function$;$captured$;end if;end $recovery$;
revoke all on function public.reconcile_bank_to_company_expense(uuid,uuid,text,numeric,text,boolean,boolean) from public,anon,authenticated;
grant execute on function public.reconcile_bank_to_company_expense(uuid,uuid,text,numeric,text,boolean,boolean) to service_role,authenticated;

-- reconcile_bank_to_invoice(uuid,uuid)
do $recovery$ begin if to_regprocedure('public.reconcile_bank_to_invoice(uuid,uuid)') is null then execute $captured$CREATE OR REPLACE FUNCTION public.reconcile_bank_to_invoice(p_bank_transaction_id uuid, p_invoice_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_company uuid:=public.get_my_company_id(); v_tx public.plaid_transactions%rowtype; v_invoice public.invoice_financial_summary%rowtype; v_payment uuid; v_amount numeric;
begin
  select * into v_tx from public.plaid_transactions where id=p_bank_transaction_id and company_id=v_company for update;
  if not found then raise exception 'Bank transaction not found'; end if;
  if v_tx.pending or v_tx.removed or v_tx.review_status='matched' or v_tx.cash_amount<=0 then raise exception 'This transaction cannot create a customer payment'; end if;
  select * into v_invoice from public.invoice_financial_summary where invoice_id=p_invoice_id and company_id=v_company;
  if not found or v_invoice.status<>'sent' or v_invoice.balance_due<=0 then raise exception 'Invoice is not available for payment'; end if;
  v_amount:=round(v_tx.cash_amount,2);
  if v_amount>v_invoice.balance_due+0.01 then raise exception 'Bank deposit exceeds invoice balance'; end if;
  insert into public.customer_payments(company_id,customer_id,project_id,received_date,amount,processing_fee,payment_method,reference_number,notes,status,created_by,bank_transaction_id)
  values(v_company,v_invoice.customer_id,v_invoice.project_id,v_tx.transaction_date,v_amount,0,'other',left(v_tx.name,120),'Created from bank reconciliation.','posted',auth.uid(),v_tx.id) returning id into v_payment;
  insert into public.payment_allocations(company_id,payment_id,invoice_id,amount) values(v_company,v_payment,p_invoice_id,v_amount);
  update public.plaid_transactions set review_status='matched',matched_entity_type='customer_payment',matched_entity_id=v_payment,match_note='Created payment for '||v_invoice.invoice_number,
    reconciled_at=now(),reconciled_by=auth.uid(),reconciliation_source='approved_suggestion',reconciliation_confidence=100,updated_at=now() where id=v_tx.id;
  update public.bank_reconciliation_candidates set status=case when entity_id=p_invoice_id and candidate_type='invoice_payment' then 'accepted' else 'stale' end,updated_at=now() where bank_transaction_id=v_tx.id and status='active';
  return v_payment;
end;
$function$;$captured$;end if;end $recovery$;
revoke all on function public.reconcile_bank_to_invoice(uuid,uuid) from public,anon,authenticated;
grant execute on function public.reconcile_bank_to_invoice(uuid,uuid) to service_role,authenticated;

-- reconcile_bank_to_job_cost(uuid,uuid,uuid,uuid,text,boolean)
do $recovery$ begin if to_regprocedure('public.reconcile_bank_to_job_cost(uuid,uuid,uuid,uuid,text,boolean)') is null then execute $captured$CREATE OR REPLACE FUNCTION public.reconcile_bank_to_job_cost(p_bank_transaction_id uuid, p_project_id uuid, p_cost_code_id uuid, p_vendor_id uuid DEFAULT NULL::uuid, p_description text DEFAULT NULL::text, p_remember_cost_code boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_company uuid:=public.get_my_company_id(); v_tx public.plaid_transactions%rowtype; v_cost uuid; v_amount numeric; v_code public.cost_codes%rowtype; v_vendor text; v_rule uuid; v_pattern text;
begin
  select * into v_tx from public.plaid_transactions where id=p_bank_transaction_id and company_id=v_company for update;
  if not found then raise exception 'Bank transaction not found'; end if;
  if v_tx.pending or v_tx.removed or v_tx.review_status='matched' or v_tx.cash_amount>=0 then raise exception 'This transaction cannot create a job cost'; end if;
  if not exists(select 1 from public.projects where id=p_project_id and company_id=v_company) then raise exception 'Project not found'; end if;
  select * into v_code from public.cost_codes where id=p_cost_code_id and company_id=v_company and active;
  if not found then raise exception 'Cost code not found'; end if;
  if p_vendor_id is not null then select name into v_vendor from public.vendors where id=p_vendor_id and company_id=v_company; end if;
  v_amount:=round(abs(v_tx.cash_amount),2);
  insert into public.project_costs(company_id,project_id,cost_code_id,cost_date,description,vendor_name,vendor_id,quantity,unit,unit_cost,subtotal,sales_tax,total_cost,source_type,reference_number,notes,created_by,bank_transaction_id)
  values(v_company,p_project_id,p_cost_code_id,v_tx.transaction_date,coalesce(nullif(trim(p_description),''),coalesce(v_tx.merchant_name,v_tx.name)),coalesce(v_vendor,v_tx.merchant_name),p_vendor_id,1,'LS',v_amount,v_amount,0,v_amount,'bank_transaction',left(v_tx.name,120),'Created from bank reconciliation.',auth.uid(),v_tx.id) returning id into v_cost;
  if p_remember_cost_code then
    v_pattern:=public.normalize_bank_text(coalesce(v_tx.merchant_name,v_tx.name));
    if v_pattern<>'' then
      insert into public.bank_reconciliation_rules(company_id,name,merchant_pattern,direction,category_primary,action_type,cost_code_id,vendor_id,business_use_percent,auto_apply,created_by)
      values(v_company,coalesce(v_tx.merchant_name,v_tx.name)||' → '||v_code.name,v_pattern,'outflow',v_tx.category_primary,'job_cost',p_cost_code_id,p_vendor_id,100,false,auth.uid()) returning id into v_rule;
    end if;
  end if;
  update public.plaid_transactions set review_status='matched',matched_entity_type='project_cost',matched_entity_id=v_cost,match_note='Recorded job cost — '||v_code.name,
    reconciled_at=now(),reconciled_by=auth.uid(),reconciliation_source=case when v_rule is null then 'manual_classification' else 'learned_rule' end,reconciliation_confidence=100,bank_rule_id=v_rule,updated_at=now() where id=v_tx.id;
  update public.bank_reconciliation_candidates set status='stale',updated_at=now() where bank_transaction_id=v_tx.id and status='active';
  return v_cost;
end;
$function$;$captured$;end if;end $recovery$;
revoke all on function public.reconcile_bank_to_job_cost(uuid,uuid,uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.reconcile_bank_to_job_cost(uuid,uuid,uuid,uuid,text,boolean) to service_role,authenticated;

-- reconcile_bank_to_payroll_run(uuid,uuid)
do $recovery$ begin if to_regprocedure('public.reconcile_bank_to_payroll_run(uuid,uuid)') is null then execute $captured$CREATE OR REPLACE FUNCTION public.reconcile_bank_to_payroll_run(p_bank_transaction_id uuid, p_payroll_run_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_company uuid:=public.get_my_company_id(); v_tx public.plaid_transactions%rowtype; v_run public.payroll_run_financial_summary%rowtype; v_amount numeric;
begin
  select * into v_tx from public.plaid_transactions where id=p_bank_transaction_id and company_id=v_company for update;
  if not found then raise exception 'Bank transaction not found'; end if;
  if v_tx.pending or v_tx.removed or v_tx.review_status='matched' or v_tx.cash_amount>=0 then raise exception 'This transaction cannot reconcile payroll'; end if;
  select * into v_run from public.payroll_run_financial_summary where payroll_run_id=p_payroll_run_id and company_id=v_company;
  if not found or v_run.status not in ('approved','processed') then raise exception 'Payroll run is not available for reconciliation'; end if;
  v_amount:=round(abs(v_tx.cash_amount),2);
  if v_run.status='approved' then
    if abs(v_amount-v_run.payroll_funding_requirement)>0.01 then raise exception 'Bank withdrawal does not equal approved payroll funding requirement'; end if;
    perform public.process_payroll_run(p_payroll_run_id,v_amount,left(v_tx.name,120));
  else
    if v_run.actual_cash_paid is null or abs(v_amount-v_run.actual_cash_paid)>0.01 then raise exception 'Bank withdrawal does not equal processed payroll cash'; end if;
  end if;
  update public.payroll_runs set bank_transaction_id=v_tx.id,updated_at=now() where id=p_payroll_run_id and company_id=v_company;
  update public.plaid_transactions set review_status='matched',matched_entity_type='payroll_run',matched_entity_id=p_payroll_run_id,match_note='Reconciled payroll run',
    reconciled_at=now(),reconciled_by=auth.uid(),reconciliation_source='approved_suggestion',reconciliation_confidence=100,updated_at=now() where id=v_tx.id;
  update public.bank_reconciliation_candidates set status=case when entity_id=p_payroll_run_id and candidate_type in ('existing_payroll','payroll_run') then 'accepted' else 'stale' end,updated_at=now() where bank_transaction_id=v_tx.id and status='active';
  return p_payroll_run_id;
end;
$function$;$captured$;end if;end $recovery$;
revoke all on function public.reconcile_bank_to_payroll_run(uuid,uuid) from public,anon,authenticated;
grant execute on function public.reconcile_bank_to_payroll_run(uuid,uuid) to service_role,authenticated;

-- reconcile_bank_to_tax(uuid,text)
do $recovery$ begin if to_regprocedure('public.reconcile_bank_to_tax(uuid,text)') is null then execute $captured$CREATE OR REPLACE FUNCTION public.reconcile_bank_to_tax(p_bank_transaction_id uuid, p_tax_type text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_company uuid:=public.get_my_company_id(); v_tx public.plaid_transactions%rowtype; v_id uuid; v_amount numeric;
begin
  if p_tax_type not in ('sales_tax','bo','payroll','li','other') then raise exception 'Invalid tax type'; end if;
  select * into v_tx from public.plaid_transactions where id=p_bank_transaction_id and company_id=v_company for update;
  if not found then raise exception 'Bank transaction not found'; end if;
  if v_tx.pending or v_tx.removed or v_tx.review_status='matched' or v_tx.cash_amount>=0 then raise exception 'This transaction cannot create a tax payment'; end if;
  v_amount:=round(abs(v_tx.cash_amount),2);
  insert into public.company_tax_remittances(company_id,tax_type,payment_date,amount,reference_number,notes,created_by,bank_transaction_id)
  values(v_company,p_tax_type,v_tx.transaction_date,v_amount,left(v_tx.name,120),'Created from bank reconciliation.',auth.uid(),v_tx.id) returning id into v_id;
  update public.plaid_transactions set review_status='matched',matched_entity_type='tax_remittance',matched_entity_id=v_id,match_note='Recorded tax remittance — '||p_tax_type,
    reconciled_at=now(),reconciled_by=auth.uid(),reconciliation_source='manual_classification',reconciliation_confidence=100,updated_at=now() where id=v_tx.id;
  update public.bank_reconciliation_candidates set status='stale',updated_at=now() where bank_transaction_id=v_tx.id and status='active';
  return v_id;
end;
$function$;$captured$;end if;end $recovery$;
revoke all on function public.reconcile_bank_to_tax(uuid,text) from public,anon,authenticated;
grant execute on function public.reconcile_bank_to_tax(uuid,text) to service_role,authenticated;

-- reconcile_bank_to_vendor_bill(uuid,uuid)
do $recovery$ begin if to_regprocedure('public.reconcile_bank_to_vendor_bill(uuid,uuid)') is null then execute $captured$CREATE OR REPLACE FUNCTION public.reconcile_bank_to_vendor_bill(p_bank_transaction_id uuid, p_vendor_bill_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_company uuid:=public.get_my_company_id(); v_tx public.plaid_transactions%rowtype; v_bill public.vendor_bill_ap_summary%rowtype; v_payment uuid; v_amount numeric;
begin
  select * into v_tx from public.plaid_transactions where id=p_bank_transaction_id and company_id=v_company for update;
  if not found then raise exception 'Bank transaction not found'; end if;
  if v_tx.pending or v_tx.removed or v_tx.review_status='matched' or v_tx.cash_amount>=0 then raise exception 'This transaction cannot create a vendor payment'; end if;
  select * into v_bill from public.vendor_bill_ap_summary where vendor_bill_id=p_vendor_bill_id and company_id=v_company;
  if not found or v_bill.status<>'posted' or v_bill.balance_due<=0 then raise exception 'Vendor bill is not available for payment'; end if;
  v_amount:=round(abs(v_tx.cash_amount),2);
  if v_amount>v_bill.balance_due+0.01 then raise exception 'Bank payment exceeds vendor bill balance'; end if;
  v_payment:=public.record_vendor_bill_payment(p_vendor_bill_id,v_tx.transaction_date,v_amount,'other',left(v_tx.name,120),0,'Created from bank reconciliation.');
  update public.vendor_payments set bank_transaction_id=v_tx.id,updated_at=now() where id=v_payment and company_id=v_company;
  update public.plaid_transactions set review_status='matched',matched_entity_type='vendor_payment',matched_entity_id=v_payment,match_note='Created vendor payment for '||coalesce(v_bill.vendor_bill_number,'vendor bill'),
    reconciled_at=now(),reconciled_by=auth.uid(),reconciliation_source='approved_suggestion',reconciliation_confidence=100,updated_at=now() where id=v_tx.id;
  update public.bank_reconciliation_candidates set status=case when entity_id=p_vendor_bill_id and candidate_type='vendor_bill_payment' then 'accepted' else 'stale' end,updated_at=now() where bank_transaction_id=v_tx.id and status='active';
  return v_payment;
end;
$function$;$captured$;end if;end $recovery$;
revoke all on function public.reconcile_bank_to_vendor_bill(uuid,uuid) from public,anon,authenticated;
grant execute on function public.reconcile_bank_to_vendor_bill(uuid,uuid) to service_role,authenticated;

-- reconcile_document_receipt_to_company_expense(uuid,uuid,uuid,text,numeric,text)
do $recovery$ begin if to_regprocedure('public.reconcile_document_receipt_to_company_expense(uuid,uuid,uuid,text,numeric,text)') is null then execute $captured$CREATE OR REPLACE FUNCTION public.reconcile_document_receipt_to_company_expense(p_document_id uuid, p_bank_transaction_id uuid, p_overhead_item_id uuid, p_category text, p_business_use_percent numeric DEFAULT 100, p_description text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_company uuid:=public.get_my_company_id();
  d public.company_documents%rowtype;
  v_expense uuid;
begin
  if v_company is null or public.get_my_role()='employee' then raise exception 'Owner access required'; end if;
  select * into d from public.company_documents where id=p_document_id and company_id=v_company for update;
  if not found then raise exception 'Receipt not found'; end if;
  if d.document_type<>'receipt' then raise exception 'Only receipt documents can use this workflow'; end if;
  if p_overhead_item_id is null and nullif(trim(coalesce(p_category,'')),'') is null then raise exception 'Choose an overhead item or category'; end if;

  v_expense:=public.reconcile_bank_to_company_expense(
    p_bank_transaction_id,p_overhead_item_id,nullif(trim(coalesce(p_category,'')),''),
    greatest(0,least(100,coalesce(p_business_use_percent,100))),
    coalesce(nullif(trim(coalesce(p_description,'')),''),d.title),false,false
  );

  update public.company_documents set
    bank_transaction_id=p_bank_transaction_id,review_status='matched',reviewed_at=now(),reviewed_by=auth.uid(),updated_at=now()
  where id=d.id;
  return v_expense;
end;
$function$;$captured$;end if;end $recovery$;
revoke all on function public.reconcile_document_receipt_to_company_expense(uuid,uuid,uuid,text,numeric,text) from public,anon,authenticated;
grant execute on function public.reconcile_document_receipt_to_company_expense(uuid,uuid,uuid,text,numeric,text) to service_role,authenticated;

-- reconcile_document_receipt_to_job_cost(uuid,uuid,uuid,uuid,uuid,text,boolean)
do $recovery$ begin if to_regprocedure('public.reconcile_document_receipt_to_job_cost(uuid,uuid,uuid,uuid,uuid,text,boolean)') is null then execute $captured$CREATE OR REPLACE FUNCTION public.reconcile_document_receipt_to_job_cost(p_document_id uuid, p_bank_transaction_id uuid, p_project_id uuid, p_cost_code_id uuid, p_vendor_id uuid DEFAULT NULL::uuid, p_description text DEFAULT NULL::text, p_remember_cost_code boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_company uuid:=public.get_my_company_id();
  d public.company_documents%rowtype;
  v_cost uuid;
begin
  if v_company is null or public.get_my_role()='employee' then raise exception 'Owner access required'; end if;
  select * into d from public.company_documents where id=p_document_id and company_id=v_company for update;
  if not found then raise exception 'Receipt not found'; end if;
  if d.document_type<>'receipt' then raise exception 'Only receipt documents can use this workflow'; end if;
  if d.project_id is not null and d.project_id<>p_project_id then raise exception 'Receipt job does not match the selected job'; end if;
  if d.vendor_id is not null and p_vendor_id is not null and d.vendor_id<>p_vendor_id then raise exception 'Receipt vendor does not match the selected vendor'; end if;

  v_cost:=public.reconcile_bank_to_job_cost(
    p_bank_transaction_id,p_project_id,p_cost_code_id,coalesce(p_vendor_id,d.vendor_id),
    coalesce(nullif(trim(coalesce(p_description,'')),''),d.title),p_remember_cost_code
  );

  update public.company_documents set
    project_id=p_project_id,vendor_id=coalesce(p_vendor_id,vendor_id),bank_transaction_id=p_bank_transaction_id,
    review_status='matched',reviewed_at=now(),reviewed_by=auth.uid(),updated_at=now()
  where id=d.id;
  return v_cost;
end;
$function$;$captured$;end if;end $recovery$;
revoke all on function public.reconcile_document_receipt_to_job_cost(uuid,uuid,uuid,uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.reconcile_document_receipt_to_job_cost(uuid,uuid,uuid,uuid,uuid,text,boolean) to service_role,authenticated;

-- record_vendor_bill_payment(uuid,date,numeric,text,text,numeric,text)
do $recovery$ begin if to_regprocedure('public.record_vendor_bill_payment(uuid,date,numeric,text,text,numeric,text)') is null then execute $captured$CREATE OR REPLACE FUNCTION public.record_vendor_bill_payment(p_vendor_bill_id uuid, p_payment_date date, p_amount numeric, p_payment_method text, p_reference_number text DEFAULT NULL::text, p_processing_fee numeric DEFAULT 0, p_notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_company uuid:=public.get_my_company_id();
  v_bill public.vendor_bill_ap_summary%rowtype;
  v_payment uuid;
  v_overhead_id uuid;
  v_category text:='Banking';
  v_business_use numeric:=100;
begin
  if v_company is null then raise exception 'Company not found'; end if;
  if p_amount is null or p_amount<=0 then raise exception 'Payment amount must be greater than zero'; end if;
  if p_processing_fee is null or p_processing_fee<0 then raise exception 'Processing fee cannot be negative'; end if;
  if p_payment_method not in ('check','ach','card','cash','wire','other') then raise exception 'Invalid payment method'; end if;
  select * into v_bill from public.vendor_bill_ap_summary where vendor_bill_id=p_vendor_bill_id and company_id=v_company;
  if not found then raise exception 'Vendor bill not found'; end if;
  if v_bill.status<>'posted' then raise exception 'Only posted vendor bills can be paid'; end if;
  if v_bill.balance_due<=0 then raise exception 'Vendor bill is already paid'; end if;
  if p_amount>v_bill.balance_due then raise exception 'Payment exceeds vendor bill balance'; end if;

  insert into public.vendor_payments(company_id,vendor_id,payment_date,amount,processing_fee,payment_method,reference_number,notes,status,created_by)
  values(v_company,v_bill.vendor_id,coalesce(p_payment_date,current_date),round(p_amount,2),round(coalesce(p_processing_fee,0),2),p_payment_method,nullif(trim(coalesce(p_reference_number,'')),''),nullif(trim(coalesce(p_notes,'')),''),'posted',auth.uid()) returning id into v_payment;

  insert into public.vendor_payment_allocations(company_id,vendor_payment_id,vendor_bill_id,amount)
  values(v_company,v_payment,p_vendor_bill_id,round(p_amount,2));

  if coalesce(p_processing_fee,0)>0 then
    select id,category,business_use_percent into v_overhead_id,v_category,v_business_use
    from public.overhead_items
    where company_id=v_company and name='Bank account / ACH / wire fees' and active=true
    order by sort_order nulls last,created_at limit 1;

    insert into public.company_expenses(company_id,overhead_item_id,expense_date,category,payee,description,subtotal,sales_tax,total_amount,business_use_percent,business_expense_amount,cash_source,payment_status,paid_date,payment_method,reference_number,notes,source_type,source_id,created_by)
    values(v_company,v_overhead_id,coalesce(p_payment_date,current_date),coalesce(v_category,'Banking'),v_bill.vendor_name,
      'Vendor payment fee' || case when v_bill.vendor_bill_number is not null then ' — '||v_bill.vendor_bill_number else '' end,
      round(p_processing_fee,2),0,round(p_processing_fee,2),coalesce(v_business_use,100),round(p_processing_fee*coalesce(v_business_use,100)/100,2),
      'company_account','paid',coalesce(p_payment_date,current_date),p_payment_method,nullif(trim(coalesce(p_reference_number,'')),''),'Automatically created from vendor payment.','vendor_payment_fee',v_payment,auth.uid());
  end if;
  return v_payment;
end;
$function$;$captured$;end if;end $recovery$;
revoke all on function public.record_vendor_bill_payment(uuid,date,numeric,text,text,numeric,text) from public,anon,authenticated;
grant execute on function public.record_vendor_bill_payment(uuid,date,numeric,text,text,numeric,text) to service_role,authenticated;

-- validate_procurement_header_links()
do $recovery$ begin if to_regprocedure('public.validate_procurement_header_links()') is null then execute $captured$CREATE OR REPLACE FUNCTION public.validate_procurement_header_links()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_project uuid;
begin
  if new.budget_section_id is not null then
    select b.project_id into v_project from public.project_budget_sections s join public.project_budgets b on b.id=s.budget_id where s.id=new.budget_section_id;
    if v_project is distinct from new.project_id then raise exception 'Budget scope belongs to a different project'; end if;
  end if;
  if new.change_order_id is not null then
    select project_id into v_project from public.change_orders where id=new.change_order_id;
    if v_project is distinct from new.project_id then raise exception 'Change order belongs to a different project'; end if;
  end if;
  if new.pour_plan_id is not null then
    select project_id into v_project from public.pour_plans where id=new.pour_plan_id;
    if v_project is distinct from new.project_id then raise exception 'Pour plan belongs to a different project'; end if;
  end if;
  return new;
end;
$function$;$captured$;end if;end $recovery$;
revoke all on function public.validate_procurement_header_links() from public,anon,authenticated;
grant execute on function public.validate_procurement_header_links() to service_role;

-- validate_procurement_line_links()
do $recovery$ begin if to_regprocedure('public.validate_procurement_line_links()') is null then execute $captured$CREATE OR REPLACE FUNCTION public.validate_procurement_line_links()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_project uuid; v_link_project uuid; v_plan uuid;
begin
  if tg_table_name='vendor_quote_lines' then
    select project_id into v_project from public.vendor_quotes where id=new.vendor_quote_id;
  elsif tg_table_name='purchase_order_lines' then
    select project_id into v_project from public.purchase_orders where id=new.purchase_order_id;
  elsif tg_table_name='vendor_bill_lines' then
    select project_id into v_project from public.vendor_bills where id=new.vendor_bill_id;
  else
    return new;
  end if;
  if new.pour_cost_item_id is not null then
    select pour_plan_id into v_plan from public.pour_cost_items where id=new.pour_cost_item_id;
    select project_id into v_link_project from public.pour_plans where id=v_plan;
    if v_link_project is distinct from v_project then raise exception 'Pour cost item belongs to a different project'; end if;
    if tg_table_name in ('purchase_order_lines','vendor_bill_lines') and new.pour_plan_id is not null and new.pour_plan_id is distinct from v_plan then raise exception 'Pour cost item does not belong to selected pour plan'; end if;
  end if;
  if tg_table_name in ('purchase_order_lines','vendor_bill_lines') and new.pour_plan_id is not null then
    select project_id into v_link_project from public.pour_plans where id=new.pour_plan_id;
    if v_link_project is distinct from v_project then raise exception 'Pour plan belongs to a different project'; end if;
  end if;
  if tg_table_name in ('purchase_order_lines','vendor_bill_lines') and new.budget_section_id is not null then
    select b.project_id into v_link_project from public.project_budget_sections s join public.project_budgets b on b.id=s.budget_id where s.id=new.budget_section_id;
    if v_link_project is distinct from v_project then raise exception 'Budget scope belongs to a different project'; end if;
  end if;
  if tg_table_name in ('purchase_order_lines','vendor_bill_lines') and new.change_order_id is not null then
    select project_id into v_link_project from public.change_orders where id=new.change_order_id;
    if v_link_project is distinct from v_project then raise exception 'Change order belongs to a different project'; end if;
  end if;
  return new;
end;
$function$;$captured$;end if;end $recovery$;
revoke all on function public.validate_procurement_line_links() from public,anon,authenticated;
grant execute on function public.validate_procurement_line_links() to service_role;

-- validate_proposal_engagement_event()
do $recovery$ begin if to_regprocedure('public.validate_proposal_engagement_event()') is null then execute $captured$CREATE OR REPLACE FUNCTION public.validate_proposal_engagement_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_recent integer;
begin
  if new.event_type in ('question','change_request') and nullif(trim(coalesce(new.customer_message,'')),'') is null then
    raise exception 'A message is required';
  end if;
  if new.event_type='decline' and nullif(trim(coalesce(new.decline_reason,'')),'') is null then
    raise exception 'A decline reason is required';
  end if;
  if new.event_type<>'view' then
    select count(*) into v_recent
    from public.proposal_engagement_events
    where presentation_id=new.presentation_id
      and event_type<>'view'
      and created_at>now()-interval '1 hour';
    if v_recent>=20 then
      raise exception 'Too many proposal responses. Please contact Carez directly.';
    end if;
  end if;
  return new;
end;
$function$;$captured$;end if;end $recovery$;
revoke all on function public.validate_proposal_engagement_event() from public,anon,authenticated;
grant execute on function public.validate_proposal_engagement_event() to service_role;

-- void_payroll_run(uuid)
do $recovery$ begin if to_regprocedure('public.void_payroll_run(uuid)') is null then execute $captured$CREATE OR REPLACE FUNCTION public.void_payroll_run(p_payroll_run_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_company uuid:=public.get_my_company_id();
begin
  update public.payroll_runs set status='void',voided_at=now(),updated_at=now()
  where id=p_payroll_run_id and company_id=v_company and status in ('draft','approved');
  if not found then raise exception 'Open payroll run not found'; end if;
  update public.payroll_run_lines set active=false where payroll_run_id=p_payroll_run_id and company_id=v_company and active;
end;$function$;$captured$;end if;end $recovery$;
revoke all on function public.void_payroll_run(uuid) from public,anon,authenticated;
grant execute on function public.void_payroll_run(uuid) to service_role,authenticated;

-- void_vendor_payment(uuid)
do $recovery$ begin if to_regprocedure('public.void_vendor_payment(uuid)') is null then execute $captured$CREATE OR REPLACE FUNCTION public.void_vendor_payment(p_vendor_payment_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_company uuid:=public.get_my_company_id();
begin
  if v_company is null then raise exception 'Company not found'; end if;
  update public.vendor_payments set status='void',voided_at=now(),updated_at=now()
  where id=p_vendor_payment_id and company_id=v_company and status='posted';
  if not found then raise exception 'Posted vendor payment not found'; end if;
  update public.company_expenses set payment_status='void',updated_at=now()
  where company_id=v_company and source_type='vendor_payment_fee' and source_id=p_vendor_payment_id and payment_status<>'void';
end;
$function$;$captured$;end if;end $recovery$;
revoke all on function public.void_vendor_payment(uuid) from public,anon,authenticated;
grant execute on function public.void_vendor_payment(uuid) to service_role,authenticated;
