-- Governed procurement commands; retained financial history is not rewritten.
set local search_path=pg_catalog,public,extensions;
-- Keep both source-era and deployed review vocabulary without relabeling decisions.
do $$declare c record;begin
 for c in select conname from pg_constraint where conrelid='public.work_package_operations'::regclass and contype='c' and pg_get_constraintdef(oid) like '%quantity_review_status%' loop
  execute format('alter table public.work_package_operations drop constraint %I',c.conname);
 end loop;
end $$;
alter table public.work_package_operations add constraint operation_quantity_review_contract check(quantity_review_status in ('auto','review_required','approved','needs_review','verified','excluded')) not valid;

CREATE OR REPLACE FUNCTION public.carez_sync_ticket_work_packages_for_pour(p_pour_plan_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO pg_catalog,public
AS $function$
declare
  v record;
  v_company uuid;
  o record;
  v_review text;
  v_reason text;
  v_changed boolean;
  v_ready boolean;
begin
  if p_pour_plan_id is null then return; end if;
  select company_id into v_company from public.pour_plans where id=p_pour_plan_id for update;
  if not found then return; end if;

  select d.*,pp.status as current_pour_status,pp.project_id as current_project_id
  into v
  from public.pour_delivery_actual_summary d
  join public.pour_plans pp on pp.id=d.pour_plan_id and pp.company_id=d.company_id
  where d.pour_plan_id=p_pour_plan_id and d.company_id=v_company;
  if not found then return; end if;

  for o in
    select wo.*,wp.project_id as package_project_id
    from public.work_package_operations wo
    join public.work_packages wp on wp.id=wo.work_package_id and wp.company_id=wo.company_id
    where wo.pour_plan_id=p_pour_plan_id and wo.company_id=v_company
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
      if not v_changed and o.quantity_review_status in ('verified','excluded','approved') then
        v_review := o.quantity_review_status;
        v_reason := o.quantity_review_reason;
      else
        v_review := 'needs_review';
        v_reason := 'Ticket actual differs from planned quantity by more than 10% or 1 CY.';
      end if;
    elsif not v_changed and o.quantity_review_status in ('verified','excluded','approved') then
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
end$function$
;
revoke all on function public.carez_sync_ticket_work_packages_for_pour(uuid) from public,anon,authenticated;

CREATE OR REPLACE FUNCTION public.issue_purchase_order(p_po_id uuid, p_issue_date date DEFAULT CURRENT_DATE)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO pg_catalog,public
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
    from_name_snapshot=coalesce(nullif(btrim(bp.display_name),''),(select name from public.companies where id=v_company)),from_address_snapshot=concat_ws(', ',nullif(bp.address_line1,''),nullif(bp.address_line2,''),nullif(bp.city,''),nullif(bp.state,''),nullif(bp.postal_code,'')),
    from_phone_snapshot=bp.phone,from_email_snapshot=bp.email,from_ubi_snapshot=bp.ubi_number,from_license_snapshot=bp.contractor_license_number,updated_at=now()
  where id=po.id;
  update public.pour_plans set status='planning',updated_at=now() where company_id=v_company and project_id=po.project_id and status='authorized';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.post_vendor_bill(p_bill_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO pg_catalog,public
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
  from public.vendor_bill_lines l join public.vendors v on v.id=b.vendor_id and v.company_id=v_company where l.vendor_bill_id=b.id and l.company_id=v_company
  on conflict (vendor_bill_line_id) where vendor_bill_line_id is not null do nothing;
  if exists(select 1 from public.vendor_bill_lines l left join public.project_costs c on c.company_id=l.company_id and c.vendor_bill_line_id=l.id where l.company_id=v_company and l.vendor_bill_id=b.id and (c.id is null or c.source_type is distinct from 'vendor_invoice' or c.reference_number is distinct from b.vendor_bill_number or (c.project_id,c.vendor_id,c.vendor_bill_id,c.purchase_order_id,c.purchase_order_line_id,c.cost_code_id,c.catalog_item_id,c.budget_section_id,c.change_order_id,c.pour_plan_id,c.pour_cost_item_id,c.cost_date,c.quantity,c.unit,c.unit_cost,c.subtotal,c.sales_tax,c.total_cost) is distinct from (b.project_id,b.vendor_id,b.id,b.purchase_order_id,l.purchase_order_line_id,l.cost_code_id,l.catalog_item_id,l.budget_section_id,l.change_order_id,l.pour_plan_id,l.pour_cost_item_id,b.bill_date,l.quantity,l.unit,l.unit_cost,l.subtotal,l.sales_tax,l.total_cost))) then raise exception 'Existing bill cost does not match its recorded source; posting was not confirmed';end if;
  update public.vendor_bills set status='posted',posted_at=now(),updated_at=now() where id=b.id;
  update public.pour_plans set status='planning',updated_at=now() where company_id=v_company and project_id=b.project_id and status='authorized';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.convert_vendor_quote_to_purchase_order(p_quote_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO pg_catalog,public
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
    coalesce(nullif(btrim(bp.display_name),''),(select name from public.companies where id=v_company)),concat_ws(', ',nullif(bp.address_line1,''),nullif(bp.address_line2,''),nullif(bp.city,''),nullif(bp.state,''),nullif(bp.postal_code,'')),bp.phone,bp.email,bp.ubi_number,bp.contractor_license_number,
    'Converted from '||q.internal_quote_number,q.created_by)
  returning id into v_po_id;
  insert into public.purchase_order_lines(company_id,purchase_order_id,cost_code_id,catalog_item_id,pour_plan_id,pour_cost_item_id,budget_section_id,change_order_id,description,quantity,unit,unit_cost,subtotal,sales_tax,total_cost,notes,sort_order)
  select v_company,v_po_id,l.cost_code_id,l.catalog_item_id,coalesce(q.pour_plan_id,pci.pour_plan_id),l.pour_cost_item_id,q.budget_section_id,q.change_order_id,l.description,l.quantity,l.unit,l.unit_cost,l.subtotal,l.sales_tax,l.total_cost,l.notes,l.sort_order
  from public.vendor_quote_lines l left join public.pour_cost_items pci on pci.id=l.pour_cost_item_id where l.vendor_quote_id=q.id and l.company_id=v_company;
  update public.vendor_quotes set status='converted',updated_at=now() where id=q.id;
  return v_po_id;
end;
$function$
;


create function public.carez_procurement_number(p_values jsonb,p_key text,p_scale integer,p_positive boolean default false) returns numeric language plpgsql immutable set search_path=pg_catalog as $$
declare n numeric;begin
 if nullif(btrim(p_values->>p_key),'') is null then raise exception '% is required',p_key;end if;
 n:=(p_values->>p_key)::numeric;
 if n::text in ('NaN','Infinity','-Infinity') or n<0 or (p_positive and n=0) or n<>round(n,p_scale) then raise exception '% must be a finite nonnegative value with at most % decimal places',p_key,p_scale;end if;
 return n;
end $$;
revoke all on function public.carez_procurement_number(jsonb,text,integer,boolean) from public,anon,authenticated;
create function public.carez_procurement_date(p_value text,p_required boolean default true) returns date language plpgsql immutable set search_path=pg_catalog as $$
declare d date;begin
 if nullif(btrim(p_value),'') is null then if p_required then raise exception 'Recorded date is required';else return null;end if;end if;
 d:=p_value::date;if not isfinite(d) then raise exception 'Recorded date must be finite';end if;return d;
end $$;
revoke all on function public.carez_procurement_date(text,boolean) from public,anon,authenticated;

create function public.carez_procurement_scope(p_company uuid,p_project uuid,p_values jsonb) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare v uuid;begin
 if not exists(select 1 from public.projects where company_id=p_company and id=p_project) then raise exception 'Job unavailable';end if;
 v:=nullif(p_values->>'budget_section_id','')::uuid;
 if v is not null and not exists(select 1 from public.project_budget_sections s join public.project_budgets b on b.company_id=s.company_id and b.id=s.budget_id where s.company_id=p_company and s.id=v and b.project_id=p_project) then raise exception 'Budget scope does not belong to this job';end if;
 v:=nullif(p_values->>'change_order_id','')::uuid;
 if v is not null and not exists(select 1 from public.change_orders where company_id=p_company and project_id=p_project and id=v) then raise exception 'Change order does not belong to this job';end if;
 v:=nullif(p_values->>'pour_plan_id','')::uuid;
 if v is not null and not exists(select 1 from public.pour_plans where company_id=p_company and project_id=p_project and id=v) then raise exception 'Pour does not belong to this job';end if;
 v:=nullif(p_values->>'pour_cost_item_id','')::uuid;
 if v is not null and not exists(select 1 from public.pour_cost_items i join public.pour_plans p on p.company_id=i.company_id and p.id=i.pour_plan_id where i.company_id=p_company and i.id=v and p.project_id=p_project and (nullif(p_values->>'pour_plan_id','') is null or p.id=(p_values->>'pour_plan_id')::uuid)) then raise exception 'Pour cost item does not match the job and pour';end if;
end $$;
revoke all on function public.carez_procurement_scope(uuid,uuid,jsonb) from public,anon,authenticated;

-- Shared triggers read optional fields through JSON; quote/bill shapes differ.
create or replace function public.validate_procurement_header_links() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin perform public.carez_procurement_scope(new.company_id,new.project_id,to_jsonb(new));return new;end $$;
revoke all on function public.validate_procurement_header_links() from public,anon,authenticated;
create or replace function public.validate_procurement_line_links() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare v jsonb:=to_jsonb(new);v_project uuid;begin
 if tg_table_name='vendor_quote_lines' then select project_id into v_project from public.vendor_quotes where company_id=new.company_id and id=(v->>'vendor_quote_id')::uuid;
 elsif tg_table_name='purchase_order_lines' then select project_id into v_project from public.purchase_orders where company_id=new.company_id and id=(v->>'purchase_order_id')::uuid;
 elsif tg_table_name='vendor_bill_lines' then select project_id into v_project from public.vendor_bills where company_id=new.company_id and id=(v->>'vendor_bill_id')::uuid;
 else raise exception 'Unknown procurement line';end if;
 perform public.carez_procurement_scope(new.company_id,v_project,v);return new;
end $$;
revoke all on function public.validate_procurement_line_links() from public,anon,authenticated;

create function public.carez_procurement_command_v1(p_request_id uuid,p_command text,p_values jsonb) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_request jsonb;v_company uuid;v_result jsonb;v_id uuid;v_parent uuid;v_project uuid;v_vendor uuid;v_line_id uuid;v_date date;v_count integer;
 v_quote public.vendor_quotes%rowtype;v_po public.purchase_orders%rowtype;v_bill public.vendor_bills%rowtype;
 v_ql public.vendor_quote_lines%rowtype;v_pl public.purchase_order_lines%rowtype;v_bl public.vendor_bill_lines%rowtype;
 v_receipt public.purchase_order_receipts%rowtype;v_doc public.company_documents%rowtype;v_line jsonb;v_other record;
 v_quantity numeric;v_unit_cost numeric;v_tax numeric;v_status text;v_title text;
begin
 if p_command is null or p_command not in ('create_vendor','create_quote','add_quote_line','delete_quote_line','quote_status','convert_quote','create_po','add_po_line','delete_po_line','issue_po','close_po','create_bill','add_bill_line','delete_bill_line','post_bill','void_bill','receipt','document_receipt') then raise exception 'Unknown procurement command';end if;
 v_request:=public.carez_financial_request_begin(p_request_id,'procurement_'||p_command,jsonb_build_object('actor_id',auth.uid(),'values',p_values));
 if (v_request->>'replay')::boolean then return v_request->'result';end if;
 v_company:=(v_request->>'company_id')::uuid;
 if p_values is null or jsonb_typeof(p_values)<>'object' then raise exception 'Procurement values required';end if;
 if p_command='create_vendor' then
  if nullif(btrim(p_values->>'name'),'') is null then raise exception 'Vendor name required';end if;
  insert into public.vendors(company_id,name,vendor_type,contact_name,email,phone,address_line1,address_line2,city,state,postal_code,payment_terms,account_number,notes)
  values(v_company,btrim(p_values->>'name'),coalesce(nullif(p_values->>'vendor_type',''),'other'),nullif(btrim(p_values->>'contact_name'),''),nullif(btrim(p_values->>'email'),''),nullif(btrim(p_values->>'phone'),''),nullif(btrim(p_values->>'address_line1'),''),nullif(btrim(p_values->>'address_line2'),''),nullif(btrim(p_values->>'city'),''),nullif(btrim(p_values->>'state'),''),nullif(btrim(p_values->>'postal_code'),''),nullif(btrim(p_values->>'payment_terms'),''),nullif(btrim(p_values->>'account_number'),''),nullif(btrim(p_values->>'notes'),'')) returning id into v_id;
 elsif p_command in ('create_quote','create_po','create_bill') then
  v_project:=nullif(p_values->>'project_id','')::uuid;v_vendor:=nullif(p_values->>'vendor_id','')::uuid;
  if p_command='create_bill' and nullif(p_values->>'purchase_order_id','') is not null then
   select * into v_po from public.purchase_orders where company_id=v_company and id=(p_values->>'purchase_order_id')::uuid for update;
   if not found or v_po.status not in ('issued','closed') then raise exception 'Vendor bill requires an issued or closed PO';end if;
   v_project:=v_po.project_id;v_vendor:=v_po.vendor_id;
  end if;
  perform public.carez_procurement_scope(v_company,v_project,p_values);
  if not exists(select 1 from public.vendors where company_id=v_company and id=v_vendor) then raise exception 'Vendor unavailable';end if;
  if p_command='create_quote' then
   insert into public.vendor_quotes(company_id,project_id,vendor_id,internal_quote_number,vendor_quote_number,quote_date,expires_on,budget_section_id,change_order_id,pour_plan_id,notes,created_by)
   values(v_company,v_project,v_vendor,public.next_company_document_number('procurement_quote'),nullif(btrim(p_values->>'vendor_quote_number'),''),public.carez_procurement_date(p_values->>'quote_date'),public.carez_procurement_date(p_values->>'expires_on',false),nullif(p_values->>'budget_section_id','')::uuid,nullif(p_values->>'change_order_id','')::uuid,nullif(p_values->>'pour_plan_id','')::uuid,nullif(btrim(p_values->>'notes'),''),auth.uid()) returning id into v_id;
  elsif p_command='create_po' then
   insert into public.purchase_orders(company_id,project_id,vendor_id,po_number,status,expected_delivery_date,budget_section_id,change_order_id,pour_plan_id,delivery_instructions,terms,notes,created_by)
   values(v_company,v_project,v_vendor,public.next_company_document_number('purchase_order'),'draft',public.carez_procurement_date(p_values->>'expected_delivery_date',false),nullif(p_values->>'budget_section_id','')::uuid,nullif(p_values->>'change_order_id','')::uuid,nullif(p_values->>'pour_plan_id','')::uuid,nullif(btrim(p_values->>'delivery_instructions'),''),nullif(btrim(p_values->>'terms'),''),nullif(btrim(p_values->>'notes'),''),auth.uid()) returning id into v_id;
  else
   v_title:=nullif(btrim(p_values->>'vendor_bill_number'),'');if v_title is null then raise exception 'Vendor invoice number required';end if;
   if exists(select 1 from public.vendor_bills where company_id=v_company and vendor_id=v_vendor and vendor_bill_number=v_title and status<>'void') then raise exception 'This vendor invoice number is already recorded; open its existing bill';end if;
   insert into public.vendor_bills(company_id,project_id,vendor_id,purchase_order_id,vendor_bill_number,bill_date,due_date,notes,created_by)
   values(v_company,v_project,v_vendor,v_po.id,v_title,public.carez_procurement_date(p_values->>'bill_date'),public.carez_procurement_date(p_values->>'due_date',false),nullif(btrim(p_values->>'notes'),''),auth.uid()) returning id into v_id;
  end if;
 elsif p_command in ('add_quote_line','delete_quote_line','quote_status','convert_quote') then
  select * into v_quote from public.vendor_quotes where company_id=v_company and id=(p_values->>'vendor_quote_id')::uuid for update;
  if not found then raise exception 'Quote unavailable';end if;v_parent:=v_quote.id;v_project:=v_quote.project_id;
  if p_command='convert_quote' then
   select count(*)::integer,min(id::text)::uuid into v_count,v_id from public.purchase_orders where company_id=v_company and source_quote_id=v_quote.id;
   if v_count>1 then raise exception 'Multiple POs reference this quote; resolve the existing records';end if;
   if v_count=0 then v_id:=public.convert_vendor_quote_to_purchase_order(v_quote.id);end if;
  elsif v_quote.status<>'received' then raise exception 'Only received quotes can be edited';
  elsif p_command='quote_status' then
   v_status:=p_values->>'status';if v_status is null or v_status not in ('accepted','rejected') then raise exception 'Invalid quote decision';end if;
   update public.vendor_quotes set status=v_status,updated_at=clock_timestamp() where id=v_quote.id and company_id=v_company;v_id:=v_quote.id;
  elsif p_command='delete_quote_line' then
   delete from public.vendor_quote_lines where id=(p_values->>'line_id')::uuid and vendor_quote_id=v_quote.id and company_id=v_company returning id into v_id;
   if not found then raise exception 'Quote line unavailable for this parent';end if;
  end if;
 elsif p_command in ('add_po_line','delete_po_line','issue_po','close_po','receipt') then
  select * into v_po from public.purchase_orders where company_id=v_company and id=(p_values->>'purchase_order_id')::uuid for update;
  if not found then raise exception 'Purchase order unavailable';end if;v_parent:=v_po.id;v_project:=v_po.project_id;
  if p_command in ('add_po_line','delete_po_line','issue_po') and v_po.status<>'draft' then raise exception 'Only draft POs can be edited or issued';end if;
  if p_command='delete_po_line' then
   delete from public.purchase_order_lines where id=(p_values->>'line_id')::uuid and purchase_order_id=v_po.id and company_id=v_company returning id into v_id;
   if not found then raise exception 'PO line unavailable for this parent';end if;
  elsif p_command='issue_po' then
   v_date:=public.carez_procurement_date(p_values->>'issue_date',false);
   v_date:=coalesce(v_date,public.carez_company_calendar_date(v_company,clock_timestamp()));if v_date is null then raise exception 'Company calendar unavailable; select an issue date';end if;
   perform public.issue_purchase_order(v_po.id,v_date);v_id:=v_po.id;
  elsif p_command='close_po' then
   v_status:=p_values->>'status';if v_status is null or v_status not in ('closed','cancelled') then raise exception 'Invalid PO close decision';end if;
   if v_po.status not in ('draft','issued') then raise exception 'PO is already closed';end if;
   select actual_cost into v_quantity from public.purchase_order_financial_summary where company_id=v_company and purchase_order_id=v_po.id;
   if not found or v_quantity is null or v_quantity::text in ('NaN','Infinity','-Infinity') then raise exception 'PO actual-cost basis unavailable';end if;
   if v_status='cancelled' and v_quantity>0 then raise exception 'A PO with actual vendor costs cannot be cancelled; close it instead';end if;
   update public.purchase_orders set status=v_status,closed_at=case when v_status='closed' then clock_timestamp() else null end,updated_at=clock_timestamp() where id=v_po.id and company_id=v_company;
   update public.pour_plans set status='planning',updated_at=clock_timestamp() where company_id=v_company and project_id=v_po.project_id and status='authorized';v_id:=v_po.id;
  end if;
 elsif p_command in ('add_bill_line','delete_bill_line','post_bill','void_bill') then
  select * into v_bill from public.vendor_bills where company_id=v_company and id=(p_values->>'vendor_bill_id')::uuid for update;
  if not found or v_bill.status<>'draft' then raise exception 'Draft vendor bill unavailable';end if;v_parent:=v_bill.id;v_project:=v_bill.project_id;
  if p_command='delete_bill_line' then
   delete from public.vendor_bill_lines where id=(p_values->>'line_id')::uuid and vendor_bill_id=v_bill.id and company_id=v_company returning id into v_id;
   if not found then raise exception 'Bill line unavailable for this parent';end if;
  elsif p_command='post_bill' then perform public.post_vendor_bill(v_bill.id);v_id:=v_bill.id;
  elsif p_command='void_bill' then update public.vendor_bills set status='void',updated_at=clock_timestamp() where company_id=v_company and id=v_bill.id;v_id:=v_bill.id;end if;
 end if;
 -- Common line calculation is server-owned and shares existing scope validation.
 if p_command in ('add_quote_line','add_po_line','add_bill_line') then
  v_quantity:=public.carez_procurement_number(p_values,'quantity',4);v_unit_cost:=public.carez_procurement_number(p_values,'unit_cost',4);v_tax:=public.carez_procurement_number(p_values,'sales_tax',2);
  v_line:=p_values||jsonb_build_object('quantity',v_quantity,'unit_cost',v_unit_cost,'subtotal',round(v_quantity*v_unit_cost,2),'sales_tax',v_tax,'total_cost',round(v_quantity*v_unit_cost,2)+v_tax,'unit',coalesce(nullif(p_values->>'unit',''),'EA'),'sort_order',0);
  if p_command='add_quote_line' then
   v_line:=v_line||jsonb_build_object('pour_plan_id',v_quote.pour_plan_id);
  elsif p_command='add_po_line' then
   v_line:=v_line||jsonb_build_object('pour_plan_id',coalesce(nullif(p_values->>'pour_plan_id','')::uuid,v_po.pour_plan_id),'budget_section_id',coalesce(nullif(p_values->>'budget_section_id','')::uuid,v_po.budget_section_id),'change_order_id',coalesce(nullif(p_values->>'change_order_id','')::uuid,v_po.change_order_id));
   if nullif(p_values->>'pour_cost_item_id','') is not null then
    select pour_plan_id into v_line_id from public.pour_cost_items where company_id=v_company and id=(p_values->>'pour_cost_item_id')::uuid;
    if not found then raise exception 'Pour cost item unavailable';end if;
    if nullif(p_values->>'pour_plan_id','') is not null and (p_values->>'pour_plan_id')::uuid<>v_line_id then raise exception 'Pour cost item conflicts with selected pour';end if;
    v_line:=v_line||jsonb_build_object('pour_plan_id',v_line_id);
   end if;
  elsif p_command='add_bill_line' and nullif(p_values->>'purchase_order_line_id','') is not null then
   select * into v_pl from public.purchase_order_lines where company_id=v_company and id=(p_values->>'purchase_order_line_id')::uuid and purchase_order_id=v_bill.purchase_order_id for update;
   if not found then raise exception 'PO line does not belong to this bill';end if;
   v_line:=v_line||jsonb_build_object('cost_code_id',v_pl.cost_code_id,'catalog_item_id',v_pl.catalog_item_id,'budget_section_id',v_pl.budget_section_id,'change_order_id',v_pl.change_order_id,'pour_plan_id',v_pl.pour_plan_id,'pour_cost_item_id',v_pl.pour_cost_item_id,'description',coalesce(nullif(btrim(p_values->>'description'),''),v_pl.description),'unit',coalesce(nullif(p_values->>'unit',''),v_pl.unit));
  end if;
  if nullif(btrim(v_line->>'description'),'') is null then raise exception 'Line description required';end if;
  perform public.carez_procurement_scope(v_company,v_project,v_line);
  if p_command='add_quote_line' then
   v_ql:=jsonb_populate_record(null::public.vendor_quote_lines,v_line);
   insert into public.vendor_quote_lines(company_id,vendor_quote_id,cost_code_id,catalog_item_id,pour_cost_item_id,description,quantity,unit,unit_cost,subtotal,sales_tax,total_cost,notes,sort_order) values(v_company,v_parent,v_ql.cost_code_id,v_ql.catalog_item_id,v_ql.pour_cost_item_id,v_ql.description,v_ql.quantity,v_ql.unit,v_ql.unit_cost,v_ql.subtotal,v_ql.sales_tax,v_ql.total_cost,v_ql.notes,v_ql.sort_order) returning id into v_id;
  elsif p_command='add_po_line' then
   v_pl:=jsonb_populate_record(null::public.purchase_order_lines,v_line);
   insert into public.purchase_order_lines(company_id,purchase_order_id,cost_code_id,catalog_item_id,budget_section_id,change_order_id,pour_plan_id,pour_cost_item_id,description,quantity,unit,unit_cost,subtotal,sales_tax,total_cost,notes,sort_order) values(v_company,v_parent,v_pl.cost_code_id,v_pl.catalog_item_id,v_pl.budget_section_id,v_pl.change_order_id,v_pl.pour_plan_id,v_pl.pour_cost_item_id,v_pl.description,v_pl.quantity,v_pl.unit,v_pl.unit_cost,v_pl.subtotal,v_pl.sales_tax,v_pl.total_cost,v_pl.notes,v_pl.sort_order) returning id into v_id;
  elsif p_command='add_bill_line' then
   v_bl:=jsonb_populate_record(null::public.vendor_bill_lines,v_line);
   insert into public.vendor_bill_lines(company_id,vendor_bill_id,cost_code_id,catalog_item_id,budget_section_id,change_order_id,pour_plan_id,pour_cost_item_id,purchase_order_line_id,description,quantity,unit,unit_cost,subtotal,sales_tax,total_cost,notes,sort_order) values(v_company,v_parent,v_bl.cost_code_id,v_bl.catalog_item_id,v_bl.budget_section_id,v_bl.change_order_id,v_bl.pour_plan_id,v_bl.pour_cost_item_id,v_bl.purchase_order_line_id,v_bl.description,v_bl.quantity,v_bl.unit,v_bl.unit_cost,v_bl.subtotal,v_bl.sales_tax,v_bl.total_cost,v_bl.notes,v_bl.sort_order) returning id into v_id;
  end if;
 end if;
 if p_command in ('receipt','document_receipt') then
  v_line_id:=nullif(p_values->>'purchase_order_line_id','')::uuid;
  select * into v_pl from public.purchase_order_lines where company_id=v_company and id=v_line_id for update;
  if not found or (p_command='receipt' and v_pl.purchase_order_id<>v_po.id) then raise exception 'Receipt line does not belong to this PO';end if;
  select * into v_po from public.purchase_orders where company_id=v_company and id=v_pl.purchase_order_id for update;
  if not found or v_po.status<>'issued' then raise exception 'Only issued POs can receive deliveries';end if;
  v_quantity:=public.carez_procurement_number(p_values,'quantity_received',4,true);v_date:=public.carez_procurement_date(p_values->>'received_date');
  if p_command='document_receipt' then
   select * into v_doc from public.company_documents where company_id=v_company and id=(p_values->>'id')::uuid and visibility<>'office_private' for update;
   if not found or v_doc.document_type not in ('concrete_ticket','delivery_ticket') then raise exception 'Delivery evidence unavailable';end if;
   if (v_doc.project_id is not null and v_doc.project_id<>v_po.project_id) or (v_doc.vendor_id is not null and v_doc.vendor_id<>v_po.vendor_id) then raise exception 'Delivery evidence belongs to a different job or vendor';end if;
   if v_doc.purchase_order_receipt_id is not null then
    select * into v_receipt from public.purchase_order_receipts where company_id=v_company and id=v_doc.purchase_order_receipt_id;
    if not found or (v_receipt.purchase_order_line_id,v_receipt.quantity_received,v_receipt.received_date,v_receipt.delivery_ticket,v_receipt.notes) is distinct from (v_line_id,v_quantity,v_date,nullif(btrim(p_values->>'delivery_ticket'),''),nullif(btrim(p_values->>'notes'),'')) then raise exception 'This evidence is already linked to a different recorded receipt';end if;
    v_id:=v_receipt.id;
   end if;
  end if;
  if v_id is null then
   insert into public.purchase_order_receipts(company_id,purchase_order_id,purchase_order_line_id,received_date,quantity_received,delivery_ticket,notes,received_by)
   values(v_company,v_po.id,v_line_id,v_date,v_quantity,nullif(btrim(p_values->>'delivery_ticket'),''),nullif(btrim(p_values->>'notes'),''),auth.uid()) returning id into v_id;
   if p_command='document_receipt' then
    update public.company_documents set project_id=v_po.project_id,vendor_id=v_po.vendor_id,purchase_order_id=v_po.id,purchase_order_receipt_id=v_id,reference_number=coalesce(nullif(btrim(p_values->>'delivery_ticket'),''),reference_number),document_date=v_date,review_status='matched',reviewed_at=clock_timestamp(),reviewed_by=auth.uid(),updated_at=clock_timestamp() where company_id=v_company and id=v_doc.id;
   end if;
  end if;
 end if;
 if v_id is null then raise exception 'Procurement outcome was not confirmed';end if;
 v_result:=jsonb_build_object('ok',true,'id',v_id);return public.carez_financial_request_finish(p_request_id,v_result);
end $$;
revoke all on function public.carez_procurement_command_v1(uuid,text,jsonb) from public,anon;
grant execute on function public.carez_procurement_command_v1(uuid,text,jsonb) to authenticated;
revoke insert,update,delete on public.vendor_quotes,public.vendor_quote_lines,public.purchase_orders,public.purchase_order_lines,public.vendor_bills,public.vendor_bill_lines,public.purchase_order_receipts from authenticated;
revoke all on function public.convert_vendor_quote_to_purchase_order(uuid),public.issue_purchase_order(uuid,date),public.post_vendor_bill(uuid),public.link_document_to_po_receipt(uuid,uuid,numeric,date,text,text) from public,anon,authenticated;

create function public.carez_guard_receipt_evidence_link() returns trigger language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
 if tg_op<>'DELETE' and new.purchase_order_receipt_id is not null and not exists(select 1 from public.purchase_order_receipts r join public.purchase_orders p on p.company_id=r.company_id and p.id=r.purchase_order_id join public.purchase_order_lines l on l.company_id=r.company_id and l.id=r.purchase_order_line_id and l.purchase_order_id=p.id where r.company_id=new.company_id and r.id=new.purchase_order_receipt_id and p.id=new.purchase_order_id and p.project_id=new.project_id and p.vendor_id=new.vendor_id) then raise exception 'Recorded receipt evidence does not match its PO, job and vendor';end if;
 if current_user in ('postgres','supabase_admin','service_role') then if tg_op='DELETE' then return old;else return new;end if;end if;
 if tg_op='DELETE' and old.purchase_order_receipt_id is not null then raise exception 'Recorded delivery evidence cannot be deleted';end if;
 if tg_op='UPDATE' and (new.purchase_order_receipt_id,new.company_id,new.project_id,new.vendor_id,new.purchase_order_id,new.storage_path) is distinct from (old.purchase_order_receipt_id,old.company_id,old.project_id,old.vendor_id,old.purchase_order_id,old.storage_path) and (old.purchase_order_receipt_id is not null or new.purchase_order_receipt_id is not null) then raise exception 'Use governed delivery evidence linking';end if;
 if tg_op='INSERT' and new.purchase_order_receipt_id is not null then raise exception 'Use governed delivery evidence linking';end if;
 if tg_op='DELETE' then return old;else return new;end if;
end $$;
revoke all on function public.carez_guard_receipt_evidence_link() from public,anon,authenticated;
create trigger receipt_evidence_link before insert or update or delete on public.company_documents for each row execute function public.carez_guard_receipt_evidence_link();

-- Bill-derived actual costs cannot be preseeded, rewritten or erased through raw DML.
-- Ordinary manual costs retain their existing editing boundary.
create function public.carez_guard_bill_cost_source() returns trigger language plpgsql security invoker set search_path=pg_catalog,public as $$
declare l public.vendor_bill_lines%rowtype;b public.vendor_bills%rowtype;begin
 if tg_op='DELETE' then if old.vendor_bill_line_id is not null then raise exception 'Recorded bill costs cannot be deleted';end if;return old;end if;
 if tg_op='UPDATE' and old.vendor_bill_line_id is not null and new.vendor_bill_line_id is distinct from old.vendor_bill_line_id then raise exception 'Bill cost source cannot change';end if;
 if new.vendor_bill_line_id is null then return new;end if;
 if current_user not in ('postgres','supabase_admin','service_role') then raise exception 'Use governed vendor bill posting';end if;
 select * into l from public.vendor_bill_lines where company_id=new.company_id and id=new.vendor_bill_line_id;
 if not found then raise exception 'Bill cost source line unavailable';end if;
 select * into b from public.vendor_bills where company_id=l.company_id and id=l.vendor_bill_id;
 if not found or new.source_type is distinct from 'vendor_invoice' or new.reference_number is distinct from b.vendor_bill_number or (new.project_id,new.vendor_id,new.vendor_bill_id,new.purchase_order_id,new.purchase_order_line_id,new.cost_code_id,new.catalog_item_id,new.budget_section_id,new.change_order_id,new.pour_plan_id,new.pour_cost_item_id,new.cost_date,new.quantity,new.unit,new.unit_cost,new.subtotal,new.sales_tax,new.total_cost) is distinct from (b.project_id,b.vendor_id,b.id,b.purchase_order_id,l.purchase_order_line_id,l.cost_code_id,l.catalog_item_id,l.budget_section_id,l.change_order_id,l.pour_plan_id,l.pour_cost_item_id,b.bill_date,l.quantity,l.unit,l.unit_cost,l.subtotal,l.sales_tax,l.total_cost) then raise exception 'Bill cost must match its recorded source';end if;
 return new;
end $$;
revoke all on function public.carez_guard_bill_cost_source() from public,anon,authenticated;
create trigger bill_cost_source_guard before insert or update or delete on public.project_costs for each row execute function public.carez_guard_bill_cost_source();

create function public.carez_guard_procurement_history_delete() returns trigger language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
 if auth.uid() is not null then raise exception 'Procurement history cannot be cascade-deleted; retain the job and its recorded quotes, orders and bills';end if;
 return old;
end $$;
revoke all on function public.carez_guard_procurement_history_delete() from public,anon,authenticated;
create trigger retained_quote_history before delete on public.vendor_quotes for each row execute function public.carez_guard_procurement_history_delete();
create trigger retained_po_history before delete on public.purchase_orders for each row execute function public.carez_guard_procurement_history_delete();
create trigger retained_bill_history before delete on public.vendor_bills for each row execute function public.carez_guard_procurement_history_delete();

-- Raw operation-source edits take the same company mutex BEFORE target row locks.
-- Employee attendance/status updates do not modify these source columns.
create function public.carez_lock_operation_source_company() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare c uuid;begin
 if auth.uid() is not null then
  select company_id into c from public.profiles where id=auth.uid();
  if c is null then raise exception 'Company context unavailable';end if;
  perform 1 from public.companies where id=c for update;
 end if;
 return null;
end $$;
revoke all on function public.carez_lock_operation_source_company() from public,anon,authenticated;
create trigger operation_source_company_lock before insert or update of pour_plan_id,measurement_method,planned_quantity on public.work_package_operations for each statement execute function public.carez_lock_operation_source_company();
