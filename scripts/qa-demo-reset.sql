-- QA-only data reset. Never run against production.
-- Remove the existing QA tenant's objects from carez-documents and carez-branding
-- through the Storage API before running this transaction.
-- This preserves the two QA auth users and moves their profiles to a fresh tenant.
-- Published audit records in the former QA tenant remain archived and inaccessible
-- to these users because the database intentionally forbids their deletion.
-- No sample PDF is attached: the tester must upload a real plan set in Takeoff.
begin;

do $qa_demo$
declare
  old_company_id uuid;
  new_company_id uuid;
  tester_id uuid;
  customer_id uuid;
  opportunity_spine_id uuid;
  project_spine_id uuid;
  lead_id uuid;
  estimate_id uuid;
  project_id uuid;
  pour_id uuid;
  invoice_id uuid;
  local_today date := (now() at time zone 'America/Los_Angeles')::date;
begin
  if (select count(*) from public.profiles) <> 2
     or (select count(distinct company_id) from public.profiles) <> 1 then
    raise exception 'QA profile preflight changed; no data was reset';
  end if;
  select p.company_id into old_company_id from public.profiles p limit 1;
  if not exists (
    select 1 from public.companies
    where id = old_company_id and name in ('Carez QA Disposable', 'PourTrace QA Demo')
  ) then
    raise exception 'Active QA disposable company was not found';
  end if;
  if exists (select 1 from public.takeoff_sheet_metadata_events where company_id = old_company_id) then
    raise exception 'Protected Takeoff sheet events remain; no data was reset';
  end if;
  if exists (
    select 1 from storage.objects
    where bucket_id in ('carez-documents', 'carez-branding')
      and name like old_company_id::text || '/%'
  ) then
    raise exception 'QA Storage objects remain; remove them through the Storage API first';
  end if;

  select id into tester_id
  from public.profiles
  where company_id = old_company_id and role = 'owner'
  order by created_at, id
  limit 1;

  insert into public.companies (name) values ('PourTrace QA Demo')
  returning id into new_company_id;
  update public.profiles set company_id = new_company_id
  where company_id = old_company_id;
  if not found then raise exception 'QA profiles did not move'; end if;
  -- The prior tenant is left archived. Its immutable published records cannot be
  -- deleted under the normal audit triggers, and it has no remaining QA profiles.

  insert into public.customers (company_id, name, contact_name)
  values (new_company_id, 'Sample General Contractor', 'Demo Contact')
  returning id into customer_id;

  -- A draft opportunity is the real starting point for the tester's PDF upload.
  insert into public.job_spines (company_id, name, created_by)
  values (new_company_id, 'Plan upload test', tester_id)
  returning id into opportunity_spine_id;
  insert into public.leads
    (company_id, customer_id, customer_name, project_name, city, state,
     scope, status, opportunity_number, job_spine_id, bid_due)
  values
    (new_company_id, customer_id, 'Sample General Contractor',
     'Plan upload test', 'Tacoma', 'WA', 'Concrete scope to be measured from tester PDF',
     'estimating', 'QA-OPP-001', opportunity_spine_id, local_today + 14)
  returning id into lead_id;
  insert into public.estimates
    (company_id, lead_id, job_spine_id, estimate_number, opportunity_number,
     name, status, version, created_by)
  values
    (new_company_id, lead_id, opportunity_spine_id, 'QA-EST-001',
     'QA-OPP-001', 'Plan upload test', 'draft', 1, tester_id)
  returning id into estimate_id;
  insert into public.takeoff_sets
    (company_id, estimate_id, name, revision_label, status, created_by)
  values
    (new_company_id, estimate_id, 'Upload your own PDF set', 'Current', 'active', tester_id);

  -- A separate active example makes schedule, field, and billing review possible.
  insert into public.job_spines (company_id, name, created_by)
  values (new_company_id, 'Example active job', tester_id)
  returning id into project_spine_id;
  insert into public.projects
    (company_id, customer_id, job_spine_id, job_number, name, city, state,
     status, contract_value, next_action)
  values
    (new_company_id, customer_id, project_spine_id, 'QA-JOB-001',
     'Example active job', 'Tacoma', 'WA', 'active', 450000,
     'Review the next pour and field record')
  returning id into project_id;
  insert into public.pour_plans
    (company_id, project_id, name, scheduled_date, expected_concrete_yards, status)
  values
    (new_company_id, project_id, 'Foundation slab pour', local_today + 3,
     42, 'planning')
  returning id into pour_id;
  insert into public.work_schedule_items
    (company_id, project_id, schedule_date, item_type, title, start_time,
     crew_needed, status, created_by)
  values
    (new_company_id, project_id, local_today + 1, 'work',
     'Form and reinforcement check', '07:00', 5, 'planned', tester_id);
  insert into public.work_schedule_items
    (company_id, project_id, schedule_date, item_type, title, pour_plan_id,
     start_time, crew_needed, status, created_by)
  values
    (new_company_id, project_id, local_today + 3, 'pour',
     'Foundation slab pour', pour_id, '06:30', 7, 'planned', tester_id);
  insert into public.daily_logs
    (company_id, project_id, log_date, crew_count, work_completed,
     concrete_yards, notes, created_by)
  values
    (new_company_id, project_id, local_today - 1, 5,
     'Completed footing placement', 26,
     'Synthetic QA field record', tester_id);

  insert into public.invoices
    (company_id, project_id, customer_id, invoice_number, invoice_type,
     status, issue_date, due_date, from_name, bill_to_name, created_by)
  values
    (new_company_id, project_id, customer_id, 'QA-INV-001', 'progress',
     'sent', local_today - 7, local_today + 14,
     'PourTrace QA Demo', 'Sample General Contractor', tester_id)
  returning id into invoice_id;
  insert into public.invoice_lines
    (company_id, invoice_id, description, quantity, unit, unit_price,
     line_amount, source_type)
  values
    (new_company_id, invoice_id, 'Foundation work completed', 1, 'LS',
     75000, 75000, 'manual');

  if (select count(*) from public.takeoff_sets where company_id = new_company_id
      and source_document_id is null and page_count is null) <> 1 then
    raise exception 'PDF upload test state was not created';
  end if;
  if (select count(*) from public.takeoff_sheets where company_id = new_company_id) <> 0 then
    raise exception 'QA Takeoff must start without preloaded sheets';
  end if;
end;
$qa_demo$;

commit;
