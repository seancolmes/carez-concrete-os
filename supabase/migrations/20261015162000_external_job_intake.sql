-- Existing external jobs keep their own evidence; this creates no opportunity,
-- accepted proposal, Award Decision, commercial baseline or payment transaction.
create table public.project_external_intakes (
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),
 project_id uuid not null,request_id uuid not null,request_payload jsonb not null,
 agreement_reference text not null,agreement_evidence text not null check(agreement_evidence in ('reported_signed_no_executed_copy','executed_copy_unverified')),
 supplied_agreement_amount numeric(12,2) not null check(supplied_agreement_amount>=0),
 external_proposal_reference text,external_proposal_amount numeric(12,2),provisional_change_reference text,provisional_change_amount numeric(12,2),
 external_notes text,planned_start date,created_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),
 unique(company_id,project_id),unique(company_id,request_id),
 foreign key(company_id,project_id) references public.projects(company_id,id) on delete restrict
);
alter table public.project_external_intakes enable row level security;
create policy external_intake_read on public.project_external_intakes for select to authenticated
 using(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'));
revoke all on public.project_external_intakes from public,anon,authenticated;
grant select on public.project_external_intakes to authenticated;
create or replace function public.carez_intake_external_job(p_request_id uuid,p_payload jsonb)
returns uuid language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare v_company uuid;v_role text;v_customer uuid;v_project uuid;v_existing public.project_external_intakes%rowtype;
 v_job text:=nullif(btrim(p_payload->>'job_number'),'');v_name text:=nullif(btrim(p_payload->>'name'),'');v_amount numeric;v_customer_name text;
begin
 select company_id,role into v_company,v_role from public.profiles where id=auth.uid();
 if v_company is null or v_role not in ('owner','office') then raise exception 'Owner or office access required.'; end if;
 if p_request_id is null or jsonb_typeof(p_payload)<>'object' or v_job is null or length(v_job)>80 or v_name is null or length(v_name)>240 then raise exception 'Original job number and name are required.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_company::text||lower(v_job),0));
 select * into v_existing from public.project_external_intakes where company_id=v_company and request_id=p_request_id;
 if found then
  if v_existing.request_payload is distinct from p_payload then raise exception 'This request already saved different values. Reopen the recorded job.'; end if;
  return v_existing.project_id;
 end if;
 if exists(select 1 from public.projects where company_id=v_company and lower(btrim(job_number))=lower(v_job)) then raise exception 'That original job number already exists. Open the existing project; do not import twice.'; end if;
 if nullif(btrim(p_payload->>'agreement_reference'),'') is null or p_payload->>'agreement_evidence' is null or p_payload->>'agreement_evidence' not in ('reported_signed_no_executed_copy','executed_copy_unverified') then raise exception 'Record the agreement source and evidence status.'; end if;
 v_amount:=(p_payload->>'agreement_amount')::numeric;
 if v_amount is null or v_amount<0 or v_amount::text in ('NaN','Infinity','-Infinity') or v_amount<>round(v_amount,2) then raise exception 'Enter the recorded agreement amount to two decimal places.'; end if;
 if p_payload->>'customer_id' is not null then
  select id into v_customer from public.customers where id=(p_payload->>'customer_id')::uuid and company_id=v_company and active;
  if v_customer is null then raise exception 'Selected customer is unavailable.'; end if;
 else
  v_customer_name:=nullif(btrim(p_payload->>'customer_name'),'');
  if v_customer_name is null then raise exception 'Choose an existing customer or enter a new customer.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_company::text||lower(v_customer_name),1));
  if exists(select 1 from public.customers where company_id=v_company and lower(btrim(name))=lower(v_customer_name)) then raise exception 'A customer with that name already exists. Choose the recorded customer.'; end if;
  insert into public.customers(company_id,name,contact_name,email,phone) values(v_company,v_customer_name,nullif(btrim(p_payload->>'contact_name'),''),nullif(btrim(p_payload->>'email'),''),nullif(btrim(p_payload->>'phone'),'')) returning id into v_customer;
 end if;
 if (p_payload->>'external_proposal_amount')::numeric<0 or (p_payload->>'provisional_change_amount')::numeric<0
 or coalesce(p_payload->>'external_proposal_amount','') in ('NaN','Infinity','-Infinity') or coalesce(p_payload->>'provisional_change_amount','') in ('NaN','Infinity','-Infinity') then raise exception 'External reference amounts must be finite and nonnegative.'; end if;
 insert into public.projects(company_id,customer_id,job_number,name,address,city,state,status,contract_value,next_action)
 values(v_company,v_customer,v_job,v_name,nullif(btrim(p_payload->>'address'),''),nullif(btrim(p_payload->>'city'),''),coalesce(nullif(btrim(p_payload->>'state'),''),''),'active',v_amount,'Review external agreement evidence and Job Setup before physical work.') returning id into v_project;
 insert into public.project_external_intakes(company_id,project_id,request_id,request_payload,agreement_reference,agreement_evidence,supplied_agreement_amount,external_proposal_reference,external_proposal_amount,provisional_change_reference,provisional_change_amount,external_notes,planned_start,created_by)
 values(v_company,v_project,p_request_id,p_payload,btrim(p_payload->>'agreement_reference'),p_payload->>'agreement_evidence',v_amount,nullif(btrim(p_payload->>'external_proposal_reference'),''),(p_payload->>'external_proposal_amount')::numeric,nullif(btrim(p_payload->>'provisional_change_reference'),''),(p_payload->>'provisional_change_amount')::numeric,nullif(btrim(p_payload->>'external_notes'),''),(p_payload->>'planned_start')::date,auth.uid());
 return v_project;
end $$;
revoke all on function public.carez_intake_external_job(uuid,jsonb) from public,anon;
grant execute on function public.carez_intake_external_job(uuid,jsonb) to authenticated;
