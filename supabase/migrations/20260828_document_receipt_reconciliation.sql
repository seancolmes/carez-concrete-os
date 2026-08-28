create or replace function public.reconcile_document_receipt_to_job_cost(
  p_document_id uuid,
  p_bank_transaction_id uuid,
  p_project_id uuid,
  p_cost_code_id uuid,
  p_vendor_id uuid default null,
  p_description text default null,
  p_remember_cost_code boolean default false
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
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
$$;
revoke all on function public.reconcile_document_receipt_to_job_cost(uuid,uuid,uuid,uuid,uuid,text,boolean) from public,anon;
grant execute on function public.reconcile_document_receipt_to_job_cost(uuid,uuid,uuid,uuid,uuid,text,boolean) to authenticated;

create or replace function public.reconcile_document_receipt_to_company_expense(
  p_document_id uuid,
  p_bank_transaction_id uuid,
  p_overhead_item_id uuid,
  p_category text,
  p_business_use_percent numeric default 100,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
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
$$;
revoke all on function public.reconcile_document_receipt_to_company_expense(uuid,uuid,uuid,text,numeric,text) from public,anon;
grant execute on function public.reconcile_document_receipt_to_company_expense(uuid,uuid,uuid,text,numeric,text) to authenticated;
