-- Forward-only bridge from the captured pre-Job-Spine production shape.
-- Canonical QA/fresh installs are verified and left unchanged. No migration
-- history is rewritten. Existing financial values/views and legacy IDs survive.
do $bridge$
declare v_count integer; v_spine uuid; r record; k record; v_touch jsonb:='[]';begin
if to_regclass('public.job_spines') is not null then
 select count(*) into v_count from unnest(array['accepted_scope_snapshot_items','accepted_scope_snapshots','approved_commercial_delta_items','approved_commercial_deltas','award_decisions','change_order_events','change_order_number_sequences','commercial_baseline_items','commercial_baselines','company_invoice_number_sequences','cost_catalog_categories','estimate_supplier_quote_access_items','estimate_supplier_quote_access_tokens','estimate_supplier_quote_submission_events','job_number_sequences','job_spine_migration_reviews','job_spines','project_startup_items','proposal_acceptance_resolutions','takeoff_sheet_metadata_events']) n where to_regclass('public.'||n) is null;
 if v_count<>0 then raise exception 'Canonical bridge: partially installed baseline tables require contract review';end if;
 if not exists(select 1 from pg_attribute where attrelid='public.change_order_items'::regclass and attname='affected_commercial_baseline_item_id' and not attisdropped) then raise exception 'Canonical bridge: missing expected change_order_items.affected_commercial_baseline_item_id';end if;
 if not exists(select 1 from pg_attribute where attrelid='public.change_order_items'::regclass and attname='labor_tax_year' and not attisdropped) then raise exception 'Canonical bridge: missing expected change_order_items.labor_tax_year';end if;
 if not exists(select 1 from pg_attribute where attrelid='public.change_orders'::regclass and attname='approved_by' and not attisdropped) then raise exception 'Canonical bridge: missing expected change_orders.approved_by';end if;
 if not exists(select 1 from pg_attribute where attrelid='public.change_orders'::regclass and attname='authorization_document_reference' and not attisdropped) then raise exception 'Canonical bridge: missing expected change_orders.authorization_document_reference';end if;
 if not exists(select 1 from pg_attribute where attrelid='public.change_orders'::regclass and attname='authorization_kind' and not attisdropped) then raise exception 'Canonical bridge: missing expected change_orders.authorization_kind';end if;
 if not exists(select 1 from pg_attribute where attrelid='public.change_orders'::regclass and attname='authorization_note' and not attisdropped) then raise exception 'Canonical bridge: missing expected change_orders.authorization_note';end if;
 if not exists(select 1 from pg_attribute where attrelid='public.change_orders'::regclass and attname='authorization_reference' and not attisdropped) then raise exception 'Canonical bridge: missing expected change_orders.authorization_reference';end if;
 if not exists(select 1 from pg_attribute where attrelid='public.change_orders'::regclass and attname='external_authorized_at' and not attisdropped) then raise exception 'Canonical bridge: missing expected change_orders.external_authorized_at';end if;
 if not exists(select 1 from pg_attribute where attrelid='public.change_orders'::regclass and attname='external_authorized_by' and not attisdropped) then raise exception 'Canonical bridge: missing expected change_orders.external_authorized_by';end if;
 if not exists(select 1 from pg_attribute where attrelid='public.change_orders'::regclass and attname='idempotency_key' and not attisdropped) then raise exception 'Canonical bridge: missing expected change_orders.idempotency_key';end if;
 if not exists(select 1 from pg_attribute where attrelid='public.change_orders'::regclass and attname='reversal_of_change_order_id' and not attisdropped) then raise exception 'Canonical bridge: missing expected change_orders.reversal_of_change_order_id';end if;
 if not exists(select 1 from pg_attribute where attrelid='public.change_orders'::regclass and attname='voided_at' and not attisdropped) then raise exception 'Canonical bridge: missing expected change_orders.voided_at';end if;
 if not exists(select 1 from pg_attribute where attrelid='public.cost_catalog_items'::regclass and attname='category_id' and not attisdropped) then raise exception 'Canonical bridge: missing expected cost_catalog_items.category_id';end if;
 if not exists(select 1 from pg_attribute where attrelid='public.employee_break_periods'::regclass and attname='notes' and not attisdropped) then raise exception 'Canonical bridge: missing expected employee_break_periods.notes';end if;
 if not exists(select 1 from pg_attribute where attrelid='public.employee_task_segments'::regclass and attname='updated_at' and not attisdropped) then raise exception 'Canonical bridge: missing expected employee_task_segments.updated_at';end if;
 if not exists(select 1 from pg_attribute where attrelid='public.estimate_items'::regclass and attname='revision_source_estimate_item_id' and not attisdropped) then raise exception 'Canonical bridge: missing expected estimate_items.revision_source_estimate_item_id';end if;
 if not exists(select 1 from pg_attribute where attrelid='public.estimate_items'::regclass and attname='revision_source_takeoff_measurement_id' and not attisdropped) then raise exception 'Canonical bridge: missing expected estimate_items.revision_source_takeoff_measurement_id';end if;
 if not exists(select 1 from pg_attribute where attrelid='public.estimate_items'::regclass and attname='revision_source_takeoff_output_id' and not attisdropped) then raise exception 'Canonical bridge: missing expected estimate_items.revision_source_takeoff_output_id';end if;
 if not exists(select 1 from pg_attribute where attrelid='public.estimates'::regclass and attname='job_spine_id' and not attisdropped) then raise exception 'Canonical bridge: missing expected estimates.job_spine_id';end if;
 if not exists(select 1 from pg_attribute where attrelid='public.estimates'::regclass and attname='parent_proposal_revision_id' and not attisdropped) then raise exception 'Canonical bridge: missing expected estimates.parent_proposal_revision_id';end if;
 if not exists(select 1 from pg_attribute where attrelid='public.leads'::regclass and attname='job_spine_id' and not attisdropped) then raise exception 'Canonical bridge: missing expected leads.job_spine_id';end if;
 if not exists(select 1 from pg_attribute where attrelid='public.overhead_rate_snapshots'::regclass and attname='created_by' and not attisdropped) then raise exception 'Canonical bridge: missing expected overhead_rate_snapshots.created_by';end if;
 if not exists(select 1 from pg_attribute where attrelid='public.overhead_rate_snapshots'::regclass and attname='source_label' and not attisdropped) then raise exception 'Canonical bridge: missing expected overhead_rate_snapshots.source_label';end if;
 if not exists(select 1 from pg_attribute where attrelid='public.overhead_rate_snapshots'::regclass and attname='source_type' and not attisdropped) then raise exception 'Canonical bridge: missing expected overhead_rate_snapshots.source_type';end if;
 if not exists(select 1 from pg_attribute where attrelid='public.project_award_records'::regclass and attname='award_decision_id' and not attisdropped) then raise exception 'Canonical bridge: missing expected project_award_records.award_decision_id';end if;
 if not exists(select 1 from pg_attribute where attrelid='public.project_budget_sections'::regclass and attname='budget_direct_labor_cost' and not attisdropped) then raise exception 'Canonical bridge: missing expected project_budget_sections.budget_direct_labor_cost';end if;
 if not exists(select 1 from pg_attribute where attrelid='public.project_budget_sections'::regclass and attname='budget_equipment_cost' and not attisdropped) then raise exception 'Canonical bridge: missing expected project_budget_sections.budget_equipment_cost';end if;
 if not exists(select 1 from pg_attribute where attrelid='public.project_budget_sections'::regclass and attname='budget_labor_hours' and not attisdropped) then raise exception 'Canonical bridge: missing expected project_budget_sections.budget_labor_hours';end if;
 if not exists(select 1 from pg_attribute where attrelid='public.project_budget_sections'::regclass and attname='budget_material_cost' and not attisdropped) then raise exception 'Canonical bridge: missing expected project_budget_sections.budget_material_cost';end if;
 if not exists(select 1 from pg_attribute where attrelid='public.project_budget_sections'::regclass and attname='budget_other_cost' and not attisdropped) then raise exception 'Canonical bridge: missing expected project_budget_sections.budget_other_cost';end if;
 if not exists(select 1 from pg_attribute where attrelid='public.project_budget_sections'::regclass and attname='budget_sell_amount' and not attisdropped) then raise exception 'Canonical bridge: missing expected project_budget_sections.budget_sell_amount';end if;
 if not exists(select 1 from pg_attribute where attrelid='public.project_budget_sections'::regclass and attname='budget_subcontractor_cost' and not attisdropped) then raise exception 'Canonical bridge: missing expected project_budget_sections.budget_subcontractor_cost';end if;
 if not exists(select 1 from pg_attribute where attrelid='public.project_budget_sections'::regclass and attname='updated_at' and not attisdropped) then raise exception 'Canonical bridge: missing expected project_budget_sections.updated_at';end if;
 if not exists(select 1 from pg_attribute where attrelid='public.project_budgets'::regclass and attname='created_by' and not attisdropped) then raise exception 'Canonical bridge: missing expected project_budgets.created_by';end if;
 if not exists(select 1 from pg_attribute where attrelid='public.project_budgets'::regclass and attname='updated_at' and not attisdropped) then raise exception 'Canonical bridge: missing expected project_budgets.updated_at';end if;
 if not exists(select 1 from pg_attribute where attrelid='public.project_inspections'::regclass and attname='resulted_by' and not attisdropped) then raise exception 'Canonical bridge: missing expected project_inspections.resulted_by';end if;
 if not exists(select 1 from pg_attribute where attrelid='public.project_payment_milestones'::regclass and attname='award_decision_id' and not attisdropped) then raise exception 'Canonical bridge: missing expected project_payment_milestones.award_decision_id';end if;
 if not exists(select 1 from pg_attribute where attrelid='public.projects'::regclass and attname='award_decision_id' and not attisdropped) then raise exception 'Canonical bridge: missing expected projects.award_decision_id';end if;
 if not exists(select 1 from pg_attribute where attrelid='public.projects'::regclass and attname='job_spine_id' and not attisdropped) then raise exception 'Canonical bridge: missing expected projects.job_spine_id';end if;
 if not exists(select 1 from pg_attribute where attrelid='public.proposal_presentations'::regclass and attname='internal_commercial_snapshot' and not attisdropped) then raise exception 'Canonical bridge: missing expected proposal_presentations.internal_commercial_snapshot';end if;
 if not exists(select 1 from pg_attribute where attrelid='public.proposal_presentations'::regclass and attname='job_spine_id' and not attisdropped) then raise exception 'Canonical bridge: missing expected proposal_presentations.job_spine_id';end if;
 if not exists(select 1 from pg_attribute where attrelid='public.proposal_presentations'::regclass and attname='parent_revision_id' and not attisdropped) then raise exception 'Canonical bridge: missing expected proposal_presentations.parent_revision_id';end if;
 if not exists(select 1 from pg_attribute where attrelid='public.timecards'::regclass and attname='approval_status' and not attisdropped) then raise exception 'Canonical bridge: missing expected timecards.approval_status';end if;
 return;end if;
if to_regclass('public.accepted_scope_snapshot_items') is not null then raise exception 'Canonical bridge: unexpected partial accepted_scope_snapshot_items';end if;
if to_regclass('public.accepted_scope_snapshots') is not null then raise exception 'Canonical bridge: unexpected partial accepted_scope_snapshots';end if;
if to_regclass('public.approved_commercial_delta_items') is not null then raise exception 'Canonical bridge: unexpected partial approved_commercial_delta_items';end if;
if to_regclass('public.approved_commercial_deltas') is not null then raise exception 'Canonical bridge: unexpected partial approved_commercial_deltas';end if;
if to_regclass('public.award_decisions') is not null then raise exception 'Canonical bridge: unexpected partial award_decisions';end if;
if to_regclass('public.change_order_events') is not null then raise exception 'Canonical bridge: unexpected partial change_order_events';end if;
if to_regclass('public.change_order_number_sequences') is not null then raise exception 'Canonical bridge: unexpected partial change_order_number_sequences';end if;
if to_regclass('public.commercial_baseline_items') is not null then raise exception 'Canonical bridge: unexpected partial commercial_baseline_items';end if;
if to_regclass('public.commercial_baselines') is not null then raise exception 'Canonical bridge: unexpected partial commercial_baselines';end if;
if to_regclass('public.company_invoice_number_sequences') is not null then raise exception 'Canonical bridge: unexpected partial company_invoice_number_sequences';end if;
if to_regclass('public.cost_catalog_categories') is not null then raise exception 'Canonical bridge: unexpected partial cost_catalog_categories';end if;
if to_regclass('public.estimate_supplier_quote_access_items') is not null then raise exception 'Canonical bridge: unexpected partial estimate_supplier_quote_access_items';end if;
if to_regclass('public.estimate_supplier_quote_access_tokens') is not null then raise exception 'Canonical bridge: unexpected partial estimate_supplier_quote_access_tokens';end if;
if to_regclass('public.estimate_supplier_quote_submission_events') is not null then raise exception 'Canonical bridge: unexpected partial estimate_supplier_quote_submission_events';end if;
if to_regclass('public.job_number_sequences') is not null then raise exception 'Canonical bridge: unexpected partial job_number_sequences';end if;
if to_regclass('public.job_spine_migration_reviews') is not null then raise exception 'Canonical bridge: unexpected partial job_spine_migration_reviews';end if;
if to_regclass('public.job_spines') is not null then raise exception 'Canonical bridge: unexpected partial job_spines';end if;
if to_regclass('public.project_startup_items') is not null then raise exception 'Canonical bridge: unexpected partial project_startup_items';end if;
if to_regclass('public.proposal_acceptance_resolutions') is not null then raise exception 'Canonical bridge: unexpected partial proposal_acceptance_resolutions';end if;
if to_regclass('public.takeoff_sheet_metadata_events') is not null then raise exception 'Canonical bridge: unexpected partial takeoff_sheet_metadata_events';end if;
if not exists(select 1 from pg_attribute where attrelid='public.change_order_items'::regclass and attname='id' and atttypid='uuid'::regtype and attnotnull) or not exists(select 1 from pg_attribute where attrelid='public.change_order_items'::regclass and attname='company_id' and atttypid='uuid'::regtype and attnotnull) then raise exception 'Canonical bridge: identity drift change_order_items';end if;
if not exists(select 1 from pg_attribute where attrelid='public.change_orders'::regclass and attname='id' and atttypid='uuid'::regtype and attnotnull) or not exists(select 1 from pg_attribute where attrelid='public.change_orders'::regclass and attname='company_id' and atttypid='uuid'::regtype and attnotnull) then raise exception 'Canonical bridge: identity drift change_orders';end if;
if not exists(select 1 from pg_attribute where attrelid='public.cost_catalog_items'::regclass and attname='id' and atttypid='uuid'::regtype and attnotnull) or not exists(select 1 from pg_attribute where attrelid='public.cost_catalog_items'::regclass and attname='company_id' and atttypid='uuid'::regtype and attnotnull) then raise exception 'Canonical bridge: identity drift cost_catalog_items';end if;
if not exists(select 1 from pg_attribute where attrelid='public.cost_codes'::regclass and attname='id' and atttypid='uuid'::regtype and attnotnull) or not exists(select 1 from pg_attribute where attrelid='public.cost_codes'::regclass and attname='company_id' and atttypid='uuid'::regtype and attnotnull) then raise exception 'Canonical bridge: identity drift cost_codes';end if;
if not exists(select 1 from pg_attribute where attrelid='public.crew_members'::regclass and attname='id' and atttypid='uuid'::regtype and attnotnull) or not exists(select 1 from pg_attribute where attrelid='public.crew_members'::regclass and attname='company_id' and atttypid='uuid'::regtype and attnotnull) then raise exception 'Canonical bridge: identity drift crew_members';end if;
if not exists(select 1 from pg_attribute where attrelid='public.customer_payments'::regclass and attname='id' and atttypid='uuid'::regtype and attnotnull) or not exists(select 1 from pg_attribute where attrelid='public.customer_payments'::regclass and attname='company_id' and atttypid='uuid'::regtype and attnotnull) then raise exception 'Canonical bridge: identity drift customer_payments';end if;
if not exists(select 1 from pg_attribute where attrelid='public.customers'::regclass and attname='id' and atttypid='uuid'::regtype and attnotnull) or not exists(select 1 from pg_attribute where attrelid='public.customers'::regclass and attname='company_id' and atttypid='uuid'::regtype and attnotnull) then raise exception 'Canonical bridge: identity drift customers';end if;
if not exists(select 1 from pg_attribute where attrelid='public.employee_shift_sessions'::regclass and attname='id' and atttypid='uuid'::regtype and attnotnull) or not exists(select 1 from pg_attribute where attrelid='public.employee_shift_sessions'::regclass and attname='company_id' and atttypid='uuid'::regtype and attnotnull) then raise exception 'Canonical bridge: identity drift employee_shift_sessions';end if;
if not exists(select 1 from pg_attribute where attrelid='public.invoices'::regclass and attname='id' and atttypid='uuid'::regtype and attnotnull) or not exists(select 1 from pg_attribute where attrelid='public.invoices'::regclass and attname='company_id' and atttypid='uuid'::regtype and attnotnull) then raise exception 'Canonical bridge: identity drift invoices';end if;
if not exists(select 1 from pg_attribute where attrelid='public.payroll_runs'::regclass and attname='id' and atttypid='uuid'::regtype and attnotnull) or not exists(select 1 from pg_attribute where attrelid='public.payroll_runs'::regclass and attname='company_id' and atttypid='uuid'::regtype and attnotnull) then raise exception 'Canonical bridge: identity drift payroll_runs';end if;
if not exists(select 1 from pg_attribute where attrelid='public.pour_plans'::regclass and attname='id' and atttypid='uuid'::regtype and attnotnull) or not exists(select 1 from pg_attribute where attrelid='public.pour_plans'::regclass and attname='company_id' and atttypid='uuid'::regtype and attnotnull) then raise exception 'Canonical bridge: identity drift pour_plans';end if;
if not exists(select 1 from pg_attribute where attrelid='public.production_tasks'::regclass and attname='id' and atttypid='uuid'::regtype and attnotnull) or not exists(select 1 from pg_attribute where attrelid='public.production_tasks'::regclass and attname='company_id' and atttypid='uuid'::regtype and attnotnull) then raise exception 'Canonical bridge: identity drift production_tasks';end if;
if not exists(select 1 from pg_attribute where attrelid='public.profiles'::regclass and attname='id' and atttypid='uuid'::regtype and attnotnull) or not exists(select 1 from pg_attribute where attrelid='public.profiles'::regclass and attname='company_id' and atttypid='uuid'::regtype and attnotnull) then raise exception 'Canonical bridge: identity drift profiles';end if;
if not exists(select 1 from pg_attribute where attrelid='public.project_award_records'::regclass and attname='id' and atttypid='uuid'::regtype and attnotnull) or not exists(select 1 from pg_attribute where attrelid='public.project_award_records'::regclass and attname='company_id' and atttypid='uuid'::regtype and attnotnull) then raise exception 'Canonical bridge: identity drift project_award_records';end if;
if not exists(select 1 from pg_attribute where attrelid='public.project_budget_sections'::regclass and attname='id' and atttypid='uuid'::regtype and attnotnull) or not exists(select 1 from pg_attribute where attrelid='public.project_budget_sections'::regclass and attname='company_id' and atttypid='uuid'::regtype and attnotnull) then raise exception 'Canonical bridge: identity drift project_budget_sections';end if;
if not exists(select 1 from pg_attribute where attrelid='public.project_budgets'::regclass and attname='id' and atttypid='uuid'::regtype and attnotnull) or not exists(select 1 from pg_attribute where attrelid='public.project_budgets'::regclass and attname='company_id' and atttypid='uuid'::regtype and attnotnull) then raise exception 'Canonical bridge: identity drift project_budgets';end if;
if not exists(select 1 from pg_attribute where attrelid='public.project_inspections'::regclass and attname='id' and atttypid='uuid'::regtype and attnotnull) or not exists(select 1 from pg_attribute where attrelid='public.project_inspections'::regclass and attname='company_id' and atttypid='uuid'::regtype and attnotnull) then raise exception 'Canonical bridge: identity drift project_inspections';end if;
if not exists(select 1 from pg_attribute where attrelid='public.projects'::regclass and attname='id' and atttypid='uuid'::regtype and attnotnull) or not exists(select 1 from pg_attribute where attrelid='public.projects'::regclass and attname='company_id' and atttypid='uuid'::regtype and attnotnull) then raise exception 'Canonical bridge: identity drift projects';end if;
if not exists(select 1 from pg_attribute where attrelid='public.proposal_presentations'::regclass and attname='id' and atttypid='uuid'::regtype and attnotnull) or not exists(select 1 from pg_attribute where attrelid='public.proposal_presentations'::regclass and attname='company_id' and atttypid='uuid'::regtype and attnotnull) then raise exception 'Canonical bridge: identity drift proposal_presentations';end if;
if not exists(select 1 from pg_attribute where attrelid='public.timecards'::regclass and attname='id' and atttypid='uuid'::regtype and attnotnull) or not exists(select 1 from pg_attribute where attrelid='public.timecards'::regclass and attname='company_id' and atttypid='uuid'::regtype and attnotnull) then raise exception 'Canonical bridge: identity drift timecards';end if;
if not exists(select 1 from pg_attribute where attrelid='public.work_package_operations'::regclass and attname='id' and atttypid='uuid'::regtype and attnotnull) or not exists(select 1 from pg_attribute where attrelid='public.work_package_operations'::regclass and attname='company_id' and atttypid='uuid'::regtype and attnotnull) then raise exception 'Canonical bridge: identity drift work_package_operations';end if;
if not exists(select 1 from pg_attribute where attrelid='public.work_packages'::regclass and attname='id' and atttypid='uuid'::regtype and attnotnull) or not exists(select 1 from pg_attribute where attrelid='public.work_packages'::regclass and attname='company_id' and atttypid='uuid'::regtype and attnotnull) then raise exception 'Canonical bridge: identity drift work_packages';end if;
if not exists(select 1 from pg_attribute where attrelid='public.work_schedule_items'::regclass and attname='id' and atttypid='uuid'::regtype and attnotnull) or not exists(select 1 from pg_attribute where attrelid='public.work_schedule_items'::regclass and attname='company_id' and atttypid='uuid'::regtype and attnotnull) then raise exception 'Canonical bridge: identity drift work_schedule_items';end if;
execute $ddl$drop trigger if exists capture_project_award_record on public.estimates;$ddl$;
execute $ddl$alter table public."employee_task_segments" add column "updated_at" timestamp with time zone;$ddl$;
execute $ddl$alter table public."employee_task_segments" alter column "updated_at" set default now();$ddl$;
execute $ddl$alter table public."projects" add column "job_spine_id" uuid;$ddl$;
execute $ddl$alter table public."projects" add column "award_decision_id" uuid;$ddl$;
execute $ddl$alter table public."timecards" add column "approval_status" text;$ddl$;
execute $ddl$alter table public."timecards" alter column "approval_status" set default 'approved'::text;$ddl$;
execute $ddl$alter table public."change_order_items" add column "labor_tax_year" integer;$ddl$;
execute $ddl$alter table public."change_order_items" add column "affected_commercial_baseline_item_id" uuid;$ddl$;
execute $ddl$alter table public."change_orders" add column "authorization_kind" text;$ddl$;
execute $ddl$alter table public."change_orders" add column "authorization_reference" text;$ddl$;
execute $ddl$alter table public."change_orders" add column "external_authorized_by" text;$ddl$;
execute $ddl$alter table public."change_orders" add column "external_authorized_at" timestamp with time zone;$ddl$;
execute $ddl$alter table public."change_orders" add column "authorization_note" text;$ddl$;
execute $ddl$alter table public."change_orders" add column "authorization_document_reference" text;$ddl$;
execute $ddl$alter table public."change_orders" add column "voided_at" timestamp with time zone;$ddl$;
execute $ddl$alter table public."change_orders" add column "approved_by" uuid;$ddl$;
execute $ddl$alter table public."change_orders" add column "reversal_of_change_order_id" uuid;$ddl$;
execute $ddl$alter table public."change_orders" add column "idempotency_key" uuid;$ddl$;
execute $ddl$alter table public."change_orders" alter column "idempotency_key" set default gen_random_uuid();$ddl$;
execute $ddl$alter table public."estimate_items" add column "revision_source_estimate_item_id" uuid;$ddl$;
execute $ddl$alter table public."estimate_items" add column "revision_source_takeoff_output_id" uuid;$ddl$;
execute $ddl$alter table public."estimate_items" add column "revision_source_takeoff_measurement_id" uuid;$ddl$;
execute $ddl$alter table public."cost_catalog_items" add column "category_id" uuid;$ddl$;
execute $ddl$alter table public."employee_break_periods" add column "notes" text;$ddl$;
execute $ddl$alter table public."estimates" add column "job_spine_id" uuid;$ddl$;
execute $ddl$alter table public."estimates" add column "parent_proposal_revision_id" uuid;$ddl$;
execute $ddl$alter table public."leads" add column "job_spine_id" uuid;$ddl$;
execute $ddl$alter table public."overhead_rate_snapshots" add column "source_type" text;$ddl$;
execute $ddl$alter table public."overhead_rate_snapshots" add column "source_label" text;$ddl$;
execute $ddl$alter table public."overhead_rate_snapshots" add column "created_by" uuid;$ddl$;
execute $ddl$alter table public."project_budget_sections" add column "budget_labor_hours" numeric(12,2);$ddl$;
execute $ddl$alter table public."project_budget_sections" alter column "budget_labor_hours" set default 0;$ddl$;
execute $ddl$alter table public."project_budget_sections" add column "budget_direct_labor_cost" numeric(14,2);$ddl$;
execute $ddl$alter table public."project_budget_sections" alter column "budget_direct_labor_cost" set default 0;$ddl$;
execute $ddl$alter table public."project_budget_sections" add column "budget_material_cost" numeric(14,2);$ddl$;
execute $ddl$alter table public."project_budget_sections" alter column "budget_material_cost" set default 0;$ddl$;
execute $ddl$alter table public."project_budget_sections" add column "budget_equipment_cost" numeric(14,2);$ddl$;
execute $ddl$alter table public."project_budget_sections" alter column "budget_equipment_cost" set default 0;$ddl$;
execute $ddl$alter table public."project_budget_sections" add column "budget_subcontractor_cost" numeric(14,2);$ddl$;
execute $ddl$alter table public."project_budget_sections" alter column "budget_subcontractor_cost" set default 0;$ddl$;
execute $ddl$alter table public."project_budget_sections" add column "budget_other_cost" numeric(14,2);$ddl$;
execute $ddl$alter table public."project_budget_sections" alter column "budget_other_cost" set default 0;$ddl$;
execute $ddl$alter table public."project_budget_sections" add column "budget_sell_amount" numeric(14,2);$ddl$;
execute $ddl$alter table public."project_budget_sections" alter column "budget_sell_amount" set default 0;$ddl$;
execute $ddl$alter table public."project_budget_sections" add column "updated_at" timestamp with time zone;$ddl$;
execute $ddl$alter table public."project_budget_sections" alter column "updated_at" set default now();$ddl$;
execute $ddl$alter table public."project_budgets" add column "created_by" uuid;$ddl$;
execute $ddl$alter table public."project_budgets" add column "updated_at" timestamp with time zone;$ddl$;
execute $ddl$alter table public."project_budgets" alter column "updated_at" set default now();$ddl$;
execute $ddl$alter table public."project_inspections" add column "resulted_by" uuid;$ddl$;
execute $ddl$alter table public."project_award_records" add column "award_decision_id" uuid;$ddl$;
execute $ddl$alter table public."project_payment_milestones" add column "award_decision_id" uuid;$ddl$;
execute $ddl$alter table public."proposal_presentations" add column "job_spine_id" uuid;$ddl$;
execute $ddl$alter table public."proposal_presentations" add column "parent_revision_id" uuid;$ddl$;
execute $ddl$alter table public."proposal_presentations" add column "internal_commercial_snapshot" jsonb;$ddl$;
execute $ddl$CREATE TABLE public.accepted_scope_snapshot_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    snapshot_id uuid NOT NULL,
    source_estimate_item_id uuid NOT NULL,
    source_takeoff_output_id uuid,
    source_takeoff_measurement_id uuid,
    item_facts jsonb NOT NULL,
    production_quantity numeric,
    production_unit text,
    direct_cost numeric NOT NULL,
    sell_amount numeric,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT accepted_scope_snapshot_items_item_facts_check CHECK ((jsonb_typeof(item_facts) = 'object'::text))
);$ddl$;
execute $ddl$CREATE TABLE public.accepted_scope_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    job_spine_id uuid NOT NULL,
    award_decision_id uuid NOT NULL,
    proposal_revision_id uuid NOT NULL,
    estimate_id uuid NOT NULL,
    source_fingerprint text NOT NULL,
    source_schema_version integer NOT NULL,
    accepted_facts jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT accepted_scope_snapshots_accepted_facts_check CHECK ((jsonb_typeof(accepted_facts) = 'object'::text)),
    CONSTRAINT accepted_scope_snapshots_source_schema_version_check CHECK ((source_schema_version = 1))
);$ddl$;
execute $ddl$CREATE TABLE public.approved_commercial_delta_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    commercial_delta_id uuid NOT NULL,
    commercial_baseline_id uuid NOT NULL,
    source_change_order_item_id uuid NOT NULL,
    affected_commercial_baseline_item_id uuid,
    quantity numeric(14,4) NOT NULL,
    unit text NOT NULL,
    direct_cost_delta numeric(14,2) NOT NULL,
    source_facts jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT approved_commercial_delta_items_quantity_check CHECK ((quantity >= (0)::numeric)),
    CONSTRAINT approved_commercial_delta_items_source_facts_check CHECK ((jsonb_typeof(source_facts) = 'object'::text))
);$ddl$;
execute $ddl$CREATE TABLE public.approved_commercial_deltas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    project_id uuid NOT NULL,
    change_order_id uuid NOT NULL,
    commercial_baseline_id uuid NOT NULL,
    approved_by uuid NOT NULL,
    approved_at timestamp with time zone NOT NULL,
    authorization_kind text NOT NULL,
    authorization_reference text,
    external_authorized_by text,
    external_authorized_at timestamp with time zone,
    authorization_note text,
    authorization_document_reference text,
    source_fingerprint text NOT NULL,
    total_direct_cost_delta numeric(14,2) NOT NULL,
    sell_delta numeric(14,2) NOT NULL,
    source_facts jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT approved_commercial_deltas_authorization_kind_check CHECK ((authorization_kind = ANY (ARRAY['external_customer'::text, 'external_gc'::text, 'internal_no_cost'::text]))),
    CONSTRAINT approved_commercial_deltas_source_facts_check CHECK ((jsonb_typeof(source_facts) = 'object'::text))
);$ddl$;
execute $ddl$CREATE TABLE public.award_decisions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    job_spine_id uuid NOT NULL,
    proposal_revision_id uuid NOT NULL,
    estimate_id uuid NOT NULL,
    project_id uuid NOT NULL,
    award_type text DEFAULT 'full_exact_revision'::text NOT NULL,
    decision_version integer DEFAULT 1 NOT NULL,
    award_status text DEFAULT 'awarded'::text NOT NULL,
    authorized_actor_id uuid NOT NULL,
    decided_at timestamp with time zone DEFAULT now() NOT NULL,
    effective_at timestamp with time zone DEFAULT now() NOT NULL,
    evidence_reference text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT award_decisions_award_status_check CHECK ((award_status = 'awarded'::text)),
    CONSTRAINT award_decisions_award_type_check CHECK ((award_type = 'full_exact_revision'::text)),
    CONSTRAINT award_decisions_decision_version_check CHECK ((decision_version > 0))
);$ddl$;
execute $ddl$CREATE TABLE public.change_order_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    project_id uuid NOT NULL,
    change_order_id uuid NOT NULL,
    from_status text,
    to_status text NOT NULL,
    actor_id uuid NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    note text,
    evidence jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT change_order_events_evidence_check CHECK ((jsonb_typeof(evidence) = 'object'::text))
);$ddl$;
execute $ddl$CREATE TABLE public.commercial_baselines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    job_spine_id uuid NOT NULL,
    project_id uuid NOT NULL,
    award_decision_id uuid NOT NULL,
    accepted_scope_snapshot_id uuid NOT NULL,
    proposal_revision_id uuid NOT NULL,
    estimate_id uuid NOT NULL,
    baseline_kind text DEFAULT 'original_award'::text NOT NULL,
    total_direct_cost numeric NOT NULL,
    total_sell numeric NOT NULL,
    financial_facts jsonb NOT NULL,
    provenance jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT commercial_baselines_baseline_kind_check CHECK ((baseline_kind = 'original_award'::text)),
    CONSTRAINT commercial_baselines_financial_facts_check CHECK ((jsonb_typeof(financial_facts) = 'object'::text)),
    CONSTRAINT commercial_baselines_provenance_check CHECK ((jsonb_typeof(provenance) = 'object'::text))
);$ddl$;
execute $ddl$CREATE TABLE public.change_order_number_sequences (
    company_id uuid NOT NULL,
    project_id uuid NOT NULL,
    last_number integer DEFAULT 0 NOT NULL,
    CONSTRAINT change_order_number_sequences_last_number_check CHECK ((last_number >= 0))
);$ddl$;
execute $ddl$CREATE TABLE public.commercial_baseline_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    baseline_id uuid NOT NULL,
    snapshot_item_id uuid NOT NULL,
    quantity numeric NOT NULL,
    unit text NOT NULL,
    production_quantity numeric,
    production_unit text,
    direct_cost numeric NOT NULL,
    sell_amount numeric,
    source_facts jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT commercial_baseline_items_source_facts_check CHECK ((jsonb_typeof(source_facts) = 'object'::text))
);$ddl$;
execute $ddl$CREATE TABLE public.company_invoice_number_sequences (
    company_id uuid NOT NULL,
    last_number integer DEFAULT 0 NOT NULL,
    CONSTRAINT company_invoice_number_sequences_last_number_check CHECK ((last_number >= 0))
);$ddl$;
execute $ddl$CREATE TABLE public.cost_catalog_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cost_catalog_categories_name_check CHECK (((length(TRIM(BOTH FROM name)) >= 1) AND (length(TRIM(BOTH FROM name)) <= 80)))
);$ddl$;
execute $ddl$CREATE TABLE public.estimate_supplier_quote_access_items (
    company_id uuid NOT NULL,
    access_token_id uuid NOT NULL,
    source_takeoff_output_id uuid NOT NULL
);$ddl$;
execute $ddl$CREATE TABLE public.estimate_supplier_quote_access_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    quote_id uuid NOT NULL,
    token uuid DEFAULT gen_random_uuid() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '14 days'::interval) NOT NULL,
    revoked_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);$ddl$;
execute $ddl$CREATE TABLE public.estimate_supplier_quote_submission_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    quote_id uuid NOT NULL,
    access_token_id uuid,
    quote_line_id uuid,
    source_takeoff_output_id uuid,
    output_label text,
    prior_unit_cost numeric,
    quoted_unit_cost numeric NOT NULL,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL
);$ddl$;
execute $ddl$CREATE TABLE public.job_number_sequences (
    company_id uuid NOT NULL,
    sequence_year integer NOT NULL,
    next_number integer DEFAULT 1 NOT NULL,
    CONSTRAINT job_number_sequences_next_number_check CHECK ((next_number > 0))
);$ddl$;
execute $ddl$CREATE TABLE public.job_spine_migration_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    job_spine_id uuid NOT NULL,
    phase_type text NOT NULL,
    phase_id uuid NOT NULL,
    reason text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone,
    resolved_by uuid,
    CONSTRAINT job_spine_migration_reviews_phase_type_check CHECK ((phase_type = ANY (ARRAY['opportunity'::text, 'estimate'::text, 'proposal'::text, 'project'::text])))
);$ddl$;
execute $ddl$CREATE TABLE public.job_spines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    name text NOT NULL,
    review_state text DEFAULT 'clear'::text NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT job_spines_review_state_check CHECK ((review_state = ANY (ARRAY['clear'::text, 'review_required'::text])))
);$ddl$;
execute $ddl$CREATE TABLE public.project_startup_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    project_id uuid NOT NULL,
    title text NOT NULL,
    detail text,
    status text DEFAULT 'open'::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    notes text,
    completed_at timestamp with time zone,
    completed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT project_startup_items_status_check CHECK ((status = ANY (ARRAY['open'::text, 'done'::text, 'not_needed'::text])))
);$ddl$;
execute $ddl$CREATE TABLE public.proposal_acceptance_resolutions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    proposal_revision_id uuid NOT NULL,
    decision_mode text NOT NULL,
    scope_resolution jsonb DEFAULT '[]'::jsonb NOT NULL,
    alternate_resolution jsonb DEFAULT '[]'::jsonb NOT NULL,
    allowances jsonb DEFAULT '[]'::jsonb NOT NULL,
    unit_prices jsonb DEFAULT '[]'::jsonb NOT NULL,
    inclusions jsonb DEFAULT '[]'::jsonb NOT NULL,
    exclusions jsonb DEFAULT '[]'::jsonb NOT NULL,
    clarifications jsonb DEFAULT '[]'::jsonb NOT NULL,
    terms jsonb DEFAULT '{}'::jsonb NOT NULL,
    evidence jsonb NOT NULL,
    effective_direct_cost numeric NOT NULL,
    effective_sell numeric NOT NULL,
    source_fingerprint text NOT NULL,
    resolved_by uuid NOT NULL,
    resolved_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT proposal_acceptance_resolutions_allowances_check CHECK ((jsonb_typeof(allowances) = 'array'::text)),
    CONSTRAINT proposal_acceptance_resolutions_alternate_resolution_check CHECK ((jsonb_typeof(alternate_resolution) = 'array'::text)),
    CONSTRAINT proposal_acceptance_resolutions_clarifications_check CHECK ((jsonb_typeof(clarifications) = 'array'::text)),
    CONSTRAINT proposal_acceptance_resolutions_decision_mode_check CHECK ((decision_mode = ANY (ARRAY['full'::text, 'partial'::text, 'negotiated'::text]))),
    CONSTRAINT proposal_acceptance_resolutions_effective_direct_cost_check CHECK ((effective_direct_cost >= (0)::numeric)),
    CONSTRAINT proposal_acceptance_resolutions_effective_sell_check CHECK ((effective_sell >= (0)::numeric)),
    CONSTRAINT proposal_acceptance_resolutions_evidence_check CHECK ((jsonb_typeof(evidence) = 'object'::text)),
    CONSTRAINT proposal_acceptance_resolutions_exclusions_check CHECK ((jsonb_typeof(exclusions) = 'array'::text)),
    CONSTRAINT proposal_acceptance_resolutions_inclusions_check CHECK ((jsonb_typeof(inclusions) = 'array'::text)),
    CONSTRAINT proposal_acceptance_resolutions_scope_resolution_check CHECK ((jsonb_typeof(scope_resolution) = 'array'::text)),
    CONSTRAINT proposal_acceptance_resolutions_source_fingerprint_check CHECK ((length(TRIM(BOTH FROM source_fingerprint)) > 0)),
    CONSTRAINT proposal_acceptance_resolutions_terms_check CHECK ((jsonb_typeof(terms) = 'object'::text)),
    CONSTRAINT proposal_acceptance_resolutions_unit_prices_check CHECK ((jsonb_typeof(unit_prices) = 'array'::text))
);$ddl$;
execute $ddl$CREATE TABLE public.takeoff_sheet_metadata_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    takeoff_set_id uuid NOT NULL,
    sheet_id uuid NOT NULL,
    page_number integer NOT NULL,
    old_sheet_number text,
    new_sheet_number text,
    old_title text,
    new_title text,
    actor_id uuid NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT takeoff_sheet_metadata_events_check CHECK (((old_sheet_number IS DISTINCT FROM new_sheet_number) OR (old_title IS DISTINCT FROM new_title)))
);$ddl$;
execute $ddl$ALTER TABLE ONLY public.accepted_scope_snapshot_items
    ADD CONSTRAINT accepted_scope_snapshot_items_company_id_id_key UNIQUE (company_id, id);$ddl$;
execute $ddl$ALTER TABLE ONLY public.accepted_scope_snapshot_items
    ADD CONSTRAINT accepted_scope_snapshot_items_company_id_snapshot_id_source_key UNIQUE (company_id, snapshot_id, source_estimate_item_id);$ddl$;
execute $ddl$ALTER TABLE ONLY public.accepted_scope_snapshot_items
    ADD CONSTRAINT accepted_scope_snapshot_items_pkey PRIMARY KEY (id);$ddl$;
execute $ddl$ALTER TABLE ONLY public.accepted_scope_snapshots
    ADD CONSTRAINT accepted_scope_snapshots_company_id_award_decision_id_key UNIQUE (company_id, award_decision_id);$ddl$;
execute $ddl$ALTER TABLE ONLY public.accepted_scope_snapshots
    ADD CONSTRAINT accepted_scope_snapshots_company_id_id_key UNIQUE (company_id, id);$ddl$;
execute $ddl$ALTER TABLE ONLY public.accepted_scope_snapshots
    ADD CONSTRAINT accepted_scope_snapshots_pkey PRIMARY KEY (id);$ddl$;
execute $ddl$ALTER TABLE ONLY public.approved_commercial_delta_items
    ADD CONSTRAINT approved_commercial_delta_ite_company_id_commercial_delta_i_key UNIQUE (company_id, commercial_delta_id, source_change_order_item_id);$ddl$;
execute $ddl$ALTER TABLE ONLY public.approved_commercial_delta_items
    ADD CONSTRAINT approved_commercial_delta_items_company_id_id_key UNIQUE (company_id, id);$ddl$;
execute $ddl$ALTER TABLE ONLY public.approved_commercial_delta_items
    ADD CONSTRAINT approved_commercial_delta_items_pkey PRIMARY KEY (id);$ddl$;
execute $ddl$ALTER TABLE ONLY public.approved_commercial_deltas
    ADD CONSTRAINT approved_commercial_deltas_company_id_change_order_id_key UNIQUE (company_id, change_order_id);$ddl$;
execute $ddl$ALTER TABLE ONLY public.approved_commercial_deltas
    ADD CONSTRAINT approved_commercial_deltas_company_id_id_commercial_baselin_key UNIQUE (company_id, id, commercial_baseline_id);$ddl$;
execute $ddl$ALTER TABLE ONLY public.approved_commercial_deltas
    ADD CONSTRAINT approved_commercial_deltas_company_id_id_key UNIQUE (company_id, id);$ddl$;
execute $ddl$ALTER TABLE ONLY public.approved_commercial_deltas
    ADD CONSTRAINT approved_commercial_deltas_pkey PRIMARY KEY (id);$ddl$;
execute $ddl$ALTER TABLE ONLY public.award_decisions
    ADD CONSTRAINT award_decisions_company_id_id_key UNIQUE (company_id, id);$ddl$;
execute $ddl$ALTER TABLE ONLY public.award_decisions
    ADD CONSTRAINT award_decisions_company_id_proposal_revision_id_key UNIQUE (company_id, proposal_revision_id);$ddl$;
execute $ddl$ALTER TABLE ONLY public.award_decisions
    ADD CONSTRAINT award_decisions_pkey PRIMARY KEY (id);$ddl$;
execute $ddl$ALTER TABLE ONLY public.change_order_events
    ADD CONSTRAINT change_order_events_company_id_id_key UNIQUE (company_id, id);$ddl$;
execute $ddl$ALTER TABLE ONLY public.change_order_events
    ADD CONSTRAINT change_order_events_pkey PRIMARY KEY (id);$ddl$;
execute $ddl$ALTER TABLE ONLY public.change_order_number_sequences
    ADD CONSTRAINT change_order_number_sequences_pkey PRIMARY KEY (company_id, project_id);$ddl$;
execute $ddl$ALTER TABLE ONLY public.commercial_baseline_items
    ADD CONSTRAINT commercial_baseline_items_company_id_baseline_id_snapshot_i_key UNIQUE (company_id, baseline_id, snapshot_item_id);$ddl$;
execute $ddl$ALTER TABLE ONLY public.commercial_baseline_items
    ADD CONSTRAINT commercial_baseline_items_pkey PRIMARY KEY (id);$ddl$;
execute $ddl$ALTER TABLE ONLY public.commercial_baselines
    ADD CONSTRAINT commercial_baselines_company_id_award_decision_id_key UNIQUE (company_id, award_decision_id);$ddl$;
execute $ddl$ALTER TABLE ONLY public.commercial_baselines
    ADD CONSTRAINT commercial_baselines_company_id_id_key UNIQUE (company_id, id);$ddl$;
execute $ddl$ALTER TABLE ONLY public.commercial_baselines
    ADD CONSTRAINT commercial_baselines_company_id_project_id_baseline_kind_key UNIQUE (company_id, project_id, baseline_kind);$ddl$;
execute $ddl$ALTER TABLE ONLY public.commercial_baselines
    ADD CONSTRAINT commercial_baselines_pkey PRIMARY KEY (id);$ddl$;
execute $ddl$ALTER TABLE ONLY public.company_invoice_number_sequences
    ADD CONSTRAINT company_invoice_number_sequences_pkey PRIMARY KEY (company_id);$ddl$;
execute $ddl$ALTER TABLE ONLY public.cost_catalog_categories
    ADD CONSTRAINT cost_catalog_categories_company_id_id_key UNIQUE (company_id, id);$ddl$;
execute $ddl$ALTER TABLE ONLY public.cost_catalog_categories
    ADD CONSTRAINT cost_catalog_categories_pkey PRIMARY KEY (id);$ddl$;
execute $ddl$ALTER TABLE ONLY public.estimate_supplier_quote_access_tokens
    ADD CONSTRAINT estimate_supplier_quote_access_company_id_id_key UNIQUE (company_id, id);$ddl$;
execute $ddl$ALTER TABLE ONLY public.estimate_supplier_quote_access_items
    ADD CONSTRAINT estimate_supplier_quote_access_items_pkey PRIMARY KEY (access_token_id, source_takeoff_output_id);$ddl$;
execute $ddl$ALTER TABLE ONLY public.estimate_supplier_quote_access_tokens
    ADD CONSTRAINT estimate_supplier_quote_access_tokens_pkey PRIMARY KEY (id);$ddl$;
execute $ddl$ALTER TABLE ONLY public.estimate_supplier_quote_access_tokens
    ADD CONSTRAINT estimate_supplier_quote_access_tokens_token_key UNIQUE (token);$ddl$;
execute $ddl$ALTER TABLE ONLY public.estimate_supplier_quote_submission_events
    ADD CONSTRAINT estimate_supplier_quote_submission_events_pkey PRIMARY KEY (id);$ddl$;
execute $ddl$ALTER TABLE ONLY public.job_number_sequences
    ADD CONSTRAINT job_number_sequences_pkey PRIMARY KEY (company_id, sequence_year);$ddl$;
execute $ddl$ALTER TABLE ONLY public.job_spine_migration_reviews
    ADD CONSTRAINT job_spine_migration_reviews_company_id_phase_type_phase_id_key UNIQUE (company_id, phase_type, phase_id);$ddl$;
execute $ddl$ALTER TABLE ONLY public.job_spine_migration_reviews
    ADD CONSTRAINT job_spine_migration_reviews_pkey PRIMARY KEY (id);$ddl$;
execute $ddl$ALTER TABLE ONLY public.job_spines
    ADD CONSTRAINT job_spines_company_id_id_key UNIQUE (company_id, id);$ddl$;
execute $ddl$ALTER TABLE ONLY public.job_spines
    ADD CONSTRAINT job_spines_pkey PRIMARY KEY (id);$ddl$;
execute $ddl$ALTER TABLE ONLY public.project_startup_items
    ADD CONSTRAINT project_startup_items_company_id_id_key UNIQUE (company_id, id);$ddl$;
execute $ddl$ALTER TABLE ONLY public.project_startup_items
    ADD CONSTRAINT project_startup_items_pkey PRIMARY KEY (id);$ddl$;
execute $ddl$ALTER TABLE ONLY public.proposal_acceptance_resolutions
    ADD CONSTRAINT proposal_acceptance_resolutio_company_id_proposal_revision__key UNIQUE (company_id, proposal_revision_id);$ddl$;
execute $ddl$ALTER TABLE ONLY public.proposal_acceptance_resolutions
    ADD CONSTRAINT proposal_acceptance_resolutions_company_id_id_key UNIQUE (company_id, id);$ddl$;
execute $ddl$ALTER TABLE ONLY public.proposal_acceptance_resolutions
    ADD CONSTRAINT proposal_acceptance_resolutions_pkey PRIMARY KEY (id);$ddl$;
execute $ddl$ALTER TABLE ONLY public.takeoff_sheet_metadata_events
    ADD CONSTRAINT takeoff_sheet_metadata_events_pkey PRIMARY KEY (id);$ddl$;
execute $ddl$CREATE UNIQUE INDEX commercial_baseline_items_company_baseline_id_uk ON public.commercial_baseline_items USING btree (company_id, baseline_id, id);$ddl$;
execute $ddl$CREATE UNIQUE INDEX commercial_baseline_items_company_id_uk ON public.commercial_baseline_items USING btree (company_id, id);$ddl$;
execute $ddl$CREATE UNIQUE INDEX cost_catalog_categories_company_name_uk ON public.cost_catalog_categories USING btree (company_id, lower(name));$ddl$;
execute $ddl$CREATE INDEX estimate_supplier_quote_access_items_output_idx ON public.estimate_supplier_quote_access_items USING btree (source_takeoff_output_id);$ddl$;
execute $ddl$CREATE INDEX estimate_supplier_quote_access_quote_idx ON public.estimate_supplier_quote_access_tokens USING btree (company_id, quote_id, created_at DESC);$ddl$;
execute $ddl$CREATE INDEX estimate_supplier_quote_submission_quote_idx ON public.estimate_supplier_quote_submission_events USING btree (company_id, quote_id, submitted_at DESC);$ddl$;
execute $ddl$CREATE INDEX proposal_acceptance_resolutions_lookup_idx ON public.proposal_acceptance_resolutions USING btree (company_id, proposal_revision_id, resolved_at DESC);$ddl$;
execute $ddl$CREATE INDEX takeoff_sheet_metadata_events_sheet_idx ON public.takeoff_sheet_metadata_events USING btree (company_id, takeoff_set_id, sheet_id, occurred_at);$ddl$;
if not exists(select 1 from pg_constraint c where c.conrelid='public.change_order_items'::regclass and c.contype in ('p','u') and (select array_agg(a.attname::text order by u.n) from unnest(c.conkey) with ordinality u(num,n) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=u.num)=array['company_id','id']::text[]) then
execute $ddl$alter table public."change_order_items" add constraint "carez_forward_key_0" unique ("company_id","id");$ddl$;
end if;
if not exists(select 1 from pg_constraint c where c.conrelid='public.change_orders'::regclass and c.contype in ('p','u') and (select array_agg(a.attname::text order by u.n) from unnest(c.conkey) with ordinality u(num,n) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=u.num)=array['company_id','id']::text[]) then
execute $ddl$alter table public."change_orders" add constraint "carez_forward_key_1" unique ("company_id","id");$ddl$;
end if;
if not exists(select 1 from pg_constraint c where c.conrelid='public.change_orders'::regclass and c.contype in ('p','u') and (select array_agg(a.attname::text order by u.n) from unnest(c.conkey) with ordinality u(num,n) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=u.num)=array['company_id','idempotency_key']::text[]) then
execute $ddl$alter table public."change_orders" add constraint "carez_forward_key_2" unique ("company_id","idempotency_key");$ddl$;
end if;
if not exists(select 1 from pg_constraint c where c.conrelid='public.change_orders'::regclass and c.contype in ('p','u') and (select array_agg(a.attname::text order by u.n) from unnest(c.conkey) with ordinality u(num,n) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=u.num)=array['company_id','project_id','co_number']::text[]) then
execute $ddl$alter table public."change_orders" add constraint "carez_forward_key_3" unique ("company_id","project_id","co_number");$ddl$;
end if;
if not exists(select 1 from pg_constraint c where c.conrelid='public.cost_catalog_items'::regclass and c.contype in ('p','u') and (select array_agg(a.attname::text order by u.n) from unnest(c.conkey) with ordinality u(num,n) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=u.num)=array['company_id','id']::text[]) then
execute $ddl$alter table public."cost_catalog_items" add constraint "carez_forward_key_4" unique ("company_id","id");$ddl$;
end if;
if not exists(select 1 from pg_constraint c where c.conrelid='public.cost_codes'::regclass and c.contype in ('p','u') and (select array_agg(a.attname::text order by u.n) from unnest(c.conkey) with ordinality u(num,n) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=u.num)=array['company_id','id']::text[]) then
execute $ddl$alter table public."cost_codes" add constraint "carez_forward_key_5" unique ("company_id","id");$ddl$;
end if;
if not exists(select 1 from pg_constraint c where c.conrelid='public.crew_members'::regclass and c.contype in ('p','u') and (select array_agg(a.attname::text order by u.n) from unnest(c.conkey) with ordinality u(num,n) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=u.num)=array['company_id','id']::text[]) then
execute $ddl$alter table public."crew_members" add constraint "carez_forward_key_6" unique ("company_id","id");$ddl$;
end if;
if not exists(select 1 from pg_constraint c where c.conrelid='public.customer_payments'::regclass and c.contype in ('p','u') and (select array_agg(a.attname::text order by u.n) from unnest(c.conkey) with ordinality u(num,n) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=u.num)=array['company_id','id']::text[]) then
execute $ddl$alter table public."customer_payments" add constraint "carez_forward_key_7" unique ("company_id","id");$ddl$;
end if;
if not exists(select 1 from pg_constraint c where c.conrelid='public.customers'::regclass and c.contype in ('p','u') and (select array_agg(a.attname::text order by u.n) from unnest(c.conkey) with ordinality u(num,n) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=u.num)=array['company_id','id']::text[]) then
execute $ddl$alter table public."customers" add constraint "carez_forward_key_8" unique ("company_id","id");$ddl$;
end if;
if not exists(select 1 from pg_constraint c where c.conrelid='public.daily_logs'::regclass and c.contype in ('p','u') and (select array_agg(a.attname::text order by u.n) from unnest(c.conkey) with ordinality u(num,n) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=u.num)=array['company_id','id']::text[]) then
execute $ddl$alter table public."daily_logs" add constraint "carez_forward_key_9" unique ("company_id","id");$ddl$;
end if;
if not exists(select 1 from pg_constraint c where c.conrelid='public.daily_production_records'::regclass and c.contype in ('p','u') and (select array_agg(a.attname::text order by u.n) from unnest(c.conkey) with ordinality u(num,n) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=u.num)=array['company_id','id']::text[]) then
execute $ddl$alter table public."daily_production_records" add constraint "carez_forward_key_10" unique ("company_id","id");$ddl$;
end if;
if not exists(select 1 from pg_constraint c where c.conrelid='public.daily_production_records'::regclass and c.contype in ('p','u') and (select array_agg(a.attname::text order by u.n) from unnest(c.conkey) with ordinality u(num,n) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=u.num)=array['company_id','project_id','work_date','production_task_id']::text[]) then
execute $ddl$alter table public."daily_production_records" add constraint "carez_forward_key_11" unique ("company_id","project_id","work_date","production_task_id");$ddl$;
end if;
if not exists(select 1 from pg_constraint c where c.conrelid='public.employee_break_periods'::regclass and c.contype in ('p','u') and (select array_agg(a.attname::text order by u.n) from unnest(c.conkey) with ordinality u(num,n) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=u.num)=array['company_id','id']::text[]) then
execute $ddl$alter table public."employee_break_periods" add constraint "carez_forward_key_12" unique ("company_id","id");$ddl$;
end if;
if not exists(select 1 from pg_constraint c where c.conrelid='public.employee_shift_sessions'::regclass and c.contype in ('p','u') and (select array_agg(a.attname::text order by u.n) from unnest(c.conkey) with ordinality u(num,n) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=u.num)=array['company_id','id']::text[]) then
execute $ddl$alter table public."employee_shift_sessions" add constraint "carez_forward_key_13" unique ("company_id","id");$ddl$;
end if;
if not exists(select 1 from pg_constraint c where c.conrelid='public.employee_task_segments'::regclass and c.contype in ('p','u') and (select array_agg(a.attname::text order by u.n) from unnest(c.conkey) with ordinality u(num,n) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=u.num)=array['company_id','id']::text[]) then
execute $ddl$alter table public."employee_task_segments" add constraint "carez_forward_key_14" unique ("company_id","id");$ddl$;
end if;
if not exists(select 1 from pg_constraint c where c.conrelid='public.estimate_items'::regclass and c.contype in ('p','u') and (select array_agg(a.attname::text order by u.n) from unnest(c.conkey) with ordinality u(num,n) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=u.num)=array['company_id','id']::text[]) then
execute $ddl$alter table public."estimate_items" add constraint "carez_forward_key_15" unique ("company_id","id");$ddl$;
end if;
if not exists(select 1 from pg_constraint c where c.conrelid='public.invoice_lines'::regclass and c.contype in ('p','u') and (select array_agg(a.attname::text order by u.n) from unnest(c.conkey) with ordinality u(num,n) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=u.num)=array['company_id','id']::text[]) then
execute $ddl$alter table public."invoice_lines" add constraint "carez_forward_key_16" unique ("company_id","id");$ddl$;
end if;
if not exists(select 1 from pg_constraint c where c.conrelid='public.invoices'::regclass and c.contype in ('p','u') and (select array_agg(a.attname::text order by u.n) from unnest(c.conkey) with ordinality u(num,n) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=u.num)=array['company_id','id']::text[]) then
execute $ddl$alter table public."invoices" add constraint "carez_forward_key_17" unique ("company_id","id");$ddl$;
end if;
if not exists(select 1 from pg_constraint c where c.conrelid='public.leads'::regclass and c.contype in ('p','u') and (select array_agg(a.attname::text order by u.n) from unnest(c.conkey) with ordinality u(num,n) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=u.num)=array['company_id','id']::text[]) then
execute $ddl$alter table public."leads" add constraint "carez_forward_key_18" unique ("company_id","id");$ddl$;
end if;
if not exists(select 1 from pg_constraint c where c.conrelid='public.payment_allocations'::regclass and c.contype in ('p','u') and (select array_agg(a.attname::text order by u.n) from unnest(c.conkey) with ordinality u(num,n) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=u.num)=array['company_id','id']::text[]) then
execute $ddl$alter table public."payment_allocations" add constraint "carez_forward_key_19" unique ("company_id","id");$ddl$;
end if;
if not exists(select 1 from pg_constraint c where c.conrelid='public.payment_allocations'::regclass and c.contype in ('p','u') and (select array_agg(a.attname::text order by u.n) from unnest(c.conkey) with ordinality u(num,n) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=u.num)=array['company_id','payment_id','invoice_id']::text[]) then
execute $ddl$alter table public."payment_allocations" add constraint "carez_forward_key_20" unique ("company_id","payment_id","invoice_id");$ddl$;
end if;
if not exists(select 1 from pg_constraint c where c.conrelid='public.payroll_runs'::regclass and c.contype in ('p','u') and (select array_agg(a.attname::text order by u.n) from unnest(c.conkey) with ordinality u(num,n) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=u.num)=array['company_id','id']::text[]) then
execute $ddl$alter table public."payroll_runs" add constraint "carez_forward_key_21" unique ("company_id","id");$ddl$;
end if;
if not exists(select 1 from pg_constraint c where c.conrelid='public.pour_authorization_snapshots'::regclass and c.contype in ('p','u') and (select array_agg(a.attname::text order by u.n) from unnest(c.conkey) with ordinality u(num,n) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=u.num)=array['company_id','id']::text[]) then
execute $ddl$alter table public."pour_authorization_snapshots" add constraint "carez_forward_key_22" unique ("company_id","id");$ddl$;
end if;
if not exists(select 1 from pg_constraint c where c.conrelid='public.pour_cost_items'::regclass and c.contype in ('p','u') and (select array_agg(a.attname::text order by u.n) from unnest(c.conkey) with ordinality u(num,n) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=u.num)=array['company_id','id']::text[]) then
execute $ddl$alter table public."pour_cost_items" add constraint "carez_forward_key_23" unique ("company_id","id");$ddl$;
end if;
if not exists(select 1 from pg_constraint c where c.conrelid='public.pour_plans'::regclass and c.contype in ('p','u') and (select array_agg(a.attname::text order by u.n) from unnest(c.conkey) with ordinality u(num,n) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=u.num)=array['company_id','id']::text[]) then
execute $ddl$alter table public."pour_plans" add constraint "carez_forward_key_24" unique ("company_id","id");$ddl$;
end if;
if not exists(select 1 from pg_constraint c where c.conrelid='public.production_tasks'::regclass and c.contype in ('p','u') and (select array_agg(a.attname::text order by u.n) from unnest(c.conkey) with ordinality u(num,n) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=u.num)=array['company_id','id']::text[]) then
execute $ddl$alter table public."production_tasks" add constraint "carez_forward_key_25" unique ("company_id","id");$ddl$;
end if;
if not exists(select 1 from pg_constraint c where c.conrelid='public.profiles'::regclass and c.contype in ('p','u') and (select array_agg(a.attname::text order by u.n) from unnest(c.conkey) with ordinality u(num,n) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=u.num)=array['company_id','id']::text[]) then
execute $ddl$alter table public."profiles" add constraint "carez_forward_key_26" unique ("company_id","id");$ddl$;
end if;
if not exists(select 1 from pg_constraint c where c.conrelid='public.project_award_records'::regclass and c.contype in ('p','u') and (select array_agg(a.attname::text order by u.n) from unnest(c.conkey) with ordinality u(num,n) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=u.num)=array['company_id','id']::text[]) then
execute $ddl$alter table public."project_award_records" add constraint "carez_forward_key_27" unique ("company_id","id");$ddl$;
end if;
if not exists(select 1 from pg_constraint c where c.conrelid='public.project_award_records'::regclass and c.contype in ('p','u') and (select array_agg(a.attname::text order by u.n) from unnest(c.conkey) with ordinality u(num,n) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=u.num)=array['company_id','project_id']::text[]) then
execute $ddl$alter table public."project_award_records" add constraint "carez_forward_key_28" unique ("company_id","project_id");$ddl$;
end if;
if not exists(select 1 from pg_constraint c where c.conrelid='public.project_budget_sections'::regclass and c.contype in ('p','u') and (select array_agg(a.attname::text order by u.n) from unnest(c.conkey) with ordinality u(num,n) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=u.num)=array['company_id','budget_id','name']::text[]) then
execute $ddl$alter table public."project_budget_sections" add constraint "carez_forward_key_29" unique ("company_id","budget_id","name");$ddl$;
end if;
if not exists(select 1 from pg_constraint c where c.conrelid='public.project_budget_sections'::regclass and c.contype in ('p','u') and (select array_agg(a.attname::text order by u.n) from unnest(c.conkey) with ordinality u(num,n) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=u.num)=array['company_id','id']::text[]) then
execute $ddl$alter table public."project_budget_sections" add constraint "carez_forward_key_30" unique ("company_id","id");$ddl$;
end if;
if not exists(select 1 from pg_constraint c where c.conrelid='public.project_budgets'::regclass and c.contype in ('p','u') and (select array_agg(a.attname::text order by u.n) from unnest(c.conkey) with ordinality u(num,n) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=u.num)=array['company_id','id']::text[]) then
execute $ddl$alter table public."project_budgets" add constraint "carez_forward_key_31" unique ("company_id","id");$ddl$;
end if;
if not exists(select 1 from pg_constraint c where c.conrelid='public.project_closeouts'::regclass and c.contype in ('p','u') and (select array_agg(a.attname::text order by u.n) from unnest(c.conkey) with ordinality u(num,n) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=u.num)=array['company_id','id']::text[]) then
execute $ddl$alter table public."project_closeouts" add constraint "carez_forward_key_32" unique ("company_id","id");$ddl$;
end if;
if not exists(select 1 from pg_constraint c where c.conrelid='public.project_closeouts'::regclass and c.contype in ('p','u') and (select array_agg(a.attname::text order by u.n) from unnest(c.conkey) with ordinality u(num,n) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=u.num)=array['company_id','project_id']::text[]) then
execute $ddl$alter table public."project_closeouts" add constraint "carez_forward_key_33" unique ("company_id","project_id");$ddl$;
end if;
if not exists(select 1 from pg_constraint c where c.conrelid='public.project_costs'::regclass and c.contype in ('p','u') and (select array_agg(a.attname::text order by u.n) from unnest(c.conkey) with ordinality u(num,n) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=u.num)=array['company_id','id']::text[]) then
execute $ddl$alter table public."project_costs" add constraint "carez_forward_key_34" unique ("company_id","id");$ddl$;
end if;
if not exists(select 1 from pg_constraint c where c.conrelid='public.project_inspections'::regclass and c.contype in ('p','u') and (select array_agg(a.attname::text order by u.n) from unnest(c.conkey) with ordinality u(num,n) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=u.num)=array['company_id','id']::text[]) then
execute $ddl$alter table public."project_inspections" add constraint "carez_forward_key_35" unique ("company_id","id");$ddl$;
end if;
if not exists(select 1 from pg_constraint c where c.conrelid='public.project_payment_milestones'::regclass and c.contype in ('p','u') and (select array_agg(a.attname::text order by u.n) from unnest(c.conkey) with ordinality u(num,n) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=u.num)=array['company_id','id']::text[]) then
execute $ddl$alter table public."project_payment_milestones" add constraint "carez_forward_key_36" unique ("company_id","id");$ddl$;
end if;
if not exists(select 1 from pg_constraint c where c.conrelid='public.project_scope_progress_updates'::regclass and c.contype in ('p','u') and (select array_agg(a.attname::text order by u.n) from unnest(c.conkey) with ordinality u(num,n) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=u.num)=array['company_id','budget_section_id','as_of_date']::text[]) then
execute $ddl$alter table public."project_scope_progress_updates" add constraint "carez_forward_key_37" unique ("company_id","budget_section_id","as_of_date");$ddl$;
end if;
if not exists(select 1 from pg_constraint c where c.conrelid='public.projects'::regclass and c.contype in ('p','u') and (select array_agg(a.attname::text order by u.n) from unnest(c.conkey) with ordinality u(num,n) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=u.num)=array['company_id','id']::text[]) then
execute $ddl$alter table public."projects" add constraint "carez_forward_key_38" unique ("company_id","id");$ddl$;
end if;
if not exists(select 1 from pg_constraint c where c.conrelid='public.proposal_presentations'::regclass and c.contype in ('p','u') and (select array_agg(a.attname::text order by u.n) from unnest(c.conkey) with ordinality u(num,n) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=u.num)=array['company_id','id']::text[]) then
execute $ddl$alter table public."proposal_presentations" add constraint "carez_forward_key_39" unique ("company_id","id");$ddl$;
end if;
if not exists(select 1 from pg_constraint c where c.conrelid='public.scope_drift_events'::regclass and c.contype in ('p','u') and (select array_agg(a.attname::text order by u.n) from unnest(c.conkey) with ordinality u(num,n) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=u.num)=array['company_id','id']::text[]) then
execute $ddl$alter table public."scope_drift_events" add constraint "carez_forward_key_40" unique ("company_id","id");$ddl$;
end if;
if not exists(select 1 from pg_constraint c where c.conrelid='public.timecards'::regclass and c.contype in ('p','u') and (select array_agg(a.attname::text order by u.n) from unnest(c.conkey) with ordinality u(num,n) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=u.num)=array['company_id','id']::text[]) then
execute $ddl$alter table public."timecards" add constraint "carez_forward_key_41" unique ("company_id","id");$ddl$;
end if;
if not exists(select 1 from pg_constraint c where c.conrelid='public.work_package_operations'::regclass and c.contype in ('p','u') and (select array_agg(a.attname::text order by u.n) from unnest(c.conkey) with ordinality u(num,n) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=u.num)=array['company_id','id']::text[]) then
execute $ddl$alter table public."work_package_operations" add constraint "carez_forward_key_42" unique ("company_id","id");$ddl$;
end if;
if not exists(select 1 from pg_constraint c where c.conrelid='public.work_package_resource_requirements'::regclass and c.contype in ('p','u') and (select array_agg(a.attname::text order by u.n) from unnest(c.conkey) with ordinality u(num,n) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=u.num)=array['company_id','id']::text[]) then
execute $ddl$alter table public."work_package_resource_requirements" add constraint "carez_forward_key_43" unique ("company_id","id");$ddl$;
end if;
if not exists(select 1 from pg_constraint c where c.conrelid='public.work_packages'::regclass and c.contype in ('p','u') and (select array_agg(a.attname::text order by u.n) from unnest(c.conkey) with ordinality u(num,n) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=u.num)=array['company_id','id']::text[]) then
execute $ddl$alter table public."work_packages" add constraint "carez_forward_key_44" unique ("company_id","id");$ddl$;
end if;
if not exists(select 1 from pg_constraint c where c.conrelid='public.work_schedule_assignments'::regclass and c.contype in ('p','u') and (select array_agg(a.attname::text order by u.n) from unnest(c.conkey) with ordinality u(num,n) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=u.num)=array['company_id','schedule_item_id','crew_member_id']::text[]) then
execute $ddl$alter table public."work_schedule_assignments" add constraint "carez_forward_key_45" unique ("company_id","schedule_item_id","crew_member_id");$ddl$;
end if;
if not exists(select 1 from pg_constraint c where c.conrelid='public.work_schedule_items'::regclass and c.contype in ('p','u') and (select array_agg(a.attname::text order by u.n) from unnest(c.conkey) with ordinality u(num,n) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=u.num)=array['company_id','id']::text[]) then
execute $ddl$alter table public."work_schedule_items" add constraint "carez_forward_key_46" unique ("company_id","id");$ddl$;
end if;
execute $ddl$ALTER TABLE ONLY public.accepted_scope_snapshot_items
    ADD CONSTRAINT accepted_scope_snapshot_items_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;$ddl$;
execute $ddl$ALTER TABLE ONLY public.accepted_scope_snapshot_items
    ADD CONSTRAINT accepted_scope_snapshot_items_company_id_snapshot_id_fkey FOREIGN KEY (company_id, snapshot_id) REFERENCES public.accepted_scope_snapshots(company_id, id) ON DELETE RESTRICT;$ddl$;
execute $ddl$ALTER TABLE ONLY public.accepted_scope_snapshot_items
    ADD CONSTRAINT accepted_scope_snapshot_items_source_estimate_item_id_fkey FOREIGN KEY (source_estimate_item_id) REFERENCES public.estimate_items(id) ON DELETE RESTRICT;$ddl$;
execute $ddl$ALTER TABLE ONLY public.accepted_scope_snapshots
    ADD CONSTRAINT accepted_scope_snapshots_company_id_award_decision_id_fkey FOREIGN KEY (company_id, award_decision_id) REFERENCES public.award_decisions(company_id, id) ON DELETE RESTRICT;$ddl$;
execute $ddl$ALTER TABLE ONLY public.accepted_scope_snapshots
    ADD CONSTRAINT accepted_scope_snapshots_company_id_estimate_id_fkey FOREIGN KEY (company_id, estimate_id) REFERENCES public.estimates(company_id, id) ON DELETE RESTRICT;$ddl$;
execute $ddl$ALTER TABLE ONLY public.accepted_scope_snapshots
    ADD CONSTRAINT accepted_scope_snapshots_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;$ddl$;
execute $ddl$ALTER TABLE ONLY public.accepted_scope_snapshots
    ADD CONSTRAINT accepted_scope_snapshots_company_id_job_spine_id_fkey FOREIGN KEY (company_id, job_spine_id) REFERENCES public.job_spines(company_id, id) ON DELETE RESTRICT;$ddl$;
execute $ddl$ALTER TABLE ONLY public.accepted_scope_snapshots
    ADD CONSTRAINT accepted_scope_snapshots_company_id_proposal_revision_id_fkey FOREIGN KEY (company_id, proposal_revision_id) REFERENCES public.proposal_presentations(company_id, id) ON DELETE RESTRICT;$ddl$;
execute $ddl$ALTER TABLE ONLY public.approved_commercial_delta_items
    ADD CONSTRAINT approved_commercial_delta_ite_company_id_commercial_baseli_fkey FOREIGN KEY (company_id, commercial_baseline_id, affected_commercial_baseline_item_id) REFERENCES public.commercial_baseline_items(company_id, baseline_id, id) ON DELETE RESTRICT;$ddl$;
execute $ddl$ALTER TABLE ONLY public.approved_commercial_delta_items
    ADD CONSTRAINT approved_commercial_delta_ite_company_id_commercial_delta__fkey FOREIGN KEY (company_id, commercial_delta_id, commercial_baseline_id) REFERENCES public.approved_commercial_deltas(company_id, id, commercial_baseline_id) ON DELETE RESTRICT;$ddl$;
execute $ddl$ALTER TABLE ONLY public.approved_commercial_delta_items
    ADD CONSTRAINT approved_commercial_delta_ite_company_id_source_change_ord_fkey FOREIGN KEY (company_id, source_change_order_item_id) REFERENCES public.change_order_items(company_id, id) ON DELETE RESTRICT;$ddl$;
execute $ddl$ALTER TABLE ONLY public.approved_commercial_deltas
    ADD CONSTRAINT approved_commercial_deltas_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE RESTRICT;$ddl$;
execute $ddl$ALTER TABLE ONLY public.approved_commercial_deltas
    ADD CONSTRAINT approved_commercial_deltas_company_id_change_order_id_fkey FOREIGN KEY (company_id, change_order_id) REFERENCES public.change_orders(company_id, id) ON DELETE RESTRICT;$ddl$;
execute $ddl$ALTER TABLE ONLY public.approved_commercial_deltas
    ADD CONSTRAINT approved_commercial_deltas_company_id_commercial_baseline__fkey FOREIGN KEY (company_id, commercial_baseline_id) REFERENCES public.commercial_baselines(company_id, id) ON DELETE RESTRICT;$ddl$;
execute $ddl$ALTER TABLE ONLY public.approved_commercial_deltas
    ADD CONSTRAINT approved_commercial_deltas_company_id_project_id_fkey FOREIGN KEY (company_id, project_id) REFERENCES public.projects(company_id, id) ON DELETE RESTRICT;$ddl$;
execute $ddl$ALTER TABLE ONLY public.award_decisions
    ADD CONSTRAINT award_decisions_authorized_actor_id_fkey FOREIGN KEY (authorized_actor_id) REFERENCES auth.users(id) ON DELETE RESTRICT;$ddl$;
execute $ddl$ALTER TABLE ONLY public.award_decisions
    ADD CONSTRAINT award_decisions_company_id_estimate_id_fkey FOREIGN KEY (company_id, estimate_id) REFERENCES public.estimates(company_id, id) ON DELETE RESTRICT;$ddl$;
execute $ddl$ALTER TABLE ONLY public.award_decisions
    ADD CONSTRAINT award_decisions_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;$ddl$;
execute $ddl$ALTER TABLE ONLY public.award_decisions
    ADD CONSTRAINT award_decisions_company_id_job_spine_id_fkey FOREIGN KEY (company_id, job_spine_id) REFERENCES public.job_spines(company_id, id) ON DELETE RESTRICT;$ddl$;
execute $ddl$ALTER TABLE ONLY public.award_decisions
    ADD CONSTRAINT award_decisions_company_id_project_id_fkey FOREIGN KEY (company_id, project_id) REFERENCES public.projects(company_id, id) ON DELETE RESTRICT;$ddl$;
execute $ddl$ALTER TABLE ONLY public.award_decisions
    ADD CONSTRAINT award_decisions_company_id_proposal_revision_id_fkey FOREIGN KEY (company_id, proposal_revision_id) REFERENCES public.proposal_presentations(company_id, id) ON DELETE RESTRICT;$ddl$;
execute $ddl$ALTER TABLE ONLY public.change_order_events
    ADD CONSTRAINT change_order_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE RESTRICT;$ddl$;
execute $ddl$ALTER TABLE ONLY public.change_order_events
    ADD CONSTRAINT change_order_events_company_id_change_order_id_fkey FOREIGN KEY (company_id, change_order_id) REFERENCES public.change_orders(company_id, id) ON DELETE RESTRICT;$ddl$;
execute $ddl$ALTER TABLE ONLY public.change_order_events
    ADD CONSTRAINT change_order_events_company_id_project_id_fkey FOREIGN KEY (company_id, project_id) REFERENCES public.projects(company_id, id) ON DELETE RESTRICT;$ddl$;
execute $ddl$ALTER TABLE ONLY public.change_order_items
    ADD CONSTRAINT change_order_items_company_id_affected_commercial_baseline_fkey FOREIGN KEY (company_id, affected_commercial_baseline_item_id) REFERENCES public.commercial_baseline_items(company_id, id) ON DELETE RESTRICT;$ddl$;
execute $ddl$ALTER TABLE ONLY public.change_order_items
    ADD CONSTRAINT change_order_items_company_id_labor_tax_year_risk_class_co_fkey FOREIGN KEY (company_id, labor_tax_year, risk_class_code) REFERENCES public.li_risk_classes(company_id, tax_year, code);$ddl$;
execute $ddl$ALTER TABLE ONLY public.change_order_number_sequences
    ADD CONSTRAINT change_order_number_sequences_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;$ddl$;
execute $ddl$ALTER TABLE ONLY public.change_order_number_sequences
    ADD CONSTRAINT change_order_number_sequences_company_id_project_id_fkey FOREIGN KEY (company_id, project_id) REFERENCES public.projects(company_id, id) ON DELETE RESTRICT;$ddl$;
execute $ddl$ALTER TABLE ONLY public.change_orders
    ADD CONSTRAINT change_orders_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE RESTRICT;$ddl$;
execute $ddl$ALTER TABLE ONLY public.change_orders
    ADD CONSTRAINT change_orders_company_id_reversal_of_change_order_id_fkey FOREIGN KEY (company_id, reversal_of_change_order_id) REFERENCES public.change_orders(company_id, id) ON DELETE RESTRICT;$ddl$;
execute $ddl$ALTER TABLE ONLY public.commercial_baseline_items
    ADD CONSTRAINT commercial_baseline_items_company_id_baseline_id_fkey FOREIGN KEY (company_id, baseline_id) REFERENCES public.commercial_baselines(company_id, id) ON DELETE RESTRICT;$ddl$;
execute $ddl$ALTER TABLE ONLY public.commercial_baseline_items
    ADD CONSTRAINT commercial_baseline_items_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;$ddl$;
execute $ddl$ALTER TABLE ONLY public.commercial_baseline_items
    ADD CONSTRAINT commercial_baseline_items_company_id_snapshot_item_id_fkey FOREIGN KEY (company_id, snapshot_item_id) REFERENCES public.accepted_scope_snapshot_items(company_id, id) ON DELETE RESTRICT;$ddl$;
execute $ddl$ALTER TABLE ONLY public.commercial_baselines
    ADD CONSTRAINT commercial_baselines_company_id_accepted_scope_snapshot_id_fkey FOREIGN KEY (company_id, accepted_scope_snapshot_id) REFERENCES public.accepted_scope_snapshots(company_id, id) ON DELETE RESTRICT;$ddl$;
execute $ddl$ALTER TABLE ONLY public.commercial_baselines
    ADD CONSTRAINT commercial_baselines_company_id_award_decision_id_fkey FOREIGN KEY (company_id, award_decision_id) REFERENCES public.award_decisions(company_id, id) ON DELETE RESTRICT;$ddl$;
execute $ddl$ALTER TABLE ONLY public.commercial_baselines
    ADD CONSTRAINT commercial_baselines_company_id_estimate_id_fkey FOREIGN KEY (company_id, estimate_id) REFERENCES public.estimates(company_id, id) ON DELETE RESTRICT;$ddl$;
execute $ddl$ALTER TABLE ONLY public.commercial_baselines
    ADD CONSTRAINT commercial_baselines_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;$ddl$;
execute $ddl$ALTER TABLE ONLY public.commercial_baselines
    ADD CONSTRAINT commercial_baselines_company_id_job_spine_id_fkey FOREIGN KEY (company_id, job_spine_id) REFERENCES public.job_spines(company_id, id) ON DELETE RESTRICT;$ddl$;
execute $ddl$ALTER TABLE ONLY public.commercial_baselines
    ADD CONSTRAINT commercial_baselines_company_id_project_id_fkey FOREIGN KEY (company_id, project_id) REFERENCES public.projects(company_id, id) ON DELETE RESTRICT;$ddl$;
execute $ddl$ALTER TABLE ONLY public.commercial_baselines
    ADD CONSTRAINT commercial_baselines_company_id_proposal_revision_id_fkey FOREIGN KEY (company_id, proposal_revision_id) REFERENCES public.proposal_presentations(company_id, id) ON DELETE RESTRICT;$ddl$;
execute $ddl$ALTER TABLE ONLY public.company_invoice_number_sequences
    ADD CONSTRAINT company_invoice_number_sequences_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;$ddl$;
execute $ddl$ALTER TABLE ONLY public.cost_catalog_categories
    ADD CONSTRAINT cost_catalog_categories_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;$ddl$;
execute $ddl$ALTER TABLE ONLY public.cost_catalog_items
    ADD CONSTRAINT cost_catalog_items_company_category_fk FOREIGN KEY (company_id, category_id) REFERENCES public.cost_catalog_categories(company_id, id) ON DELETE SET NULL (category_id);$ddl$;
execute $ddl$ALTER TABLE ONLY public.estimate_items
    ADD CONSTRAINT estimate_items_revision_source_estimate_item_id_fkey FOREIGN KEY (revision_source_estimate_item_id) REFERENCES public.estimate_items(id) ON DELETE RESTRICT;$ddl$;
execute $ddl$ALTER TABLE ONLY public.estimate_items
    ADD CONSTRAINT estimate_items_revision_source_takeoff_measurement_id_fkey FOREIGN KEY (revision_source_takeoff_measurement_id) REFERENCES public.takeoff_measurements(id) ON DELETE RESTRICT;$ddl$;
execute $ddl$ALTER TABLE ONLY public.estimate_items
    ADD CONSTRAINT estimate_items_revision_source_takeoff_output_id_fkey FOREIGN KEY (revision_source_takeoff_output_id) REFERENCES public.takeoff_measurement_outputs(id) ON DELETE RESTRICT;$ddl$;
execute $ddl$ALTER TABLE ONLY public.estimate_supplier_quote_access_items
    ADD CONSTRAINT estimate_supplier_quote_access_it_source_takeoff_output_id_fkey FOREIGN KEY (source_takeoff_output_id) REFERENCES public.takeoff_measurement_outputs(id) ON DELETE CASCADE;$ddl$;
execute $ddl$ALTER TABLE ONLY public.estimate_supplier_quote_access_items
    ADD CONSTRAINT estimate_supplier_quote_access_items_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;$ddl$;
execute $ddl$ALTER TABLE ONLY public.estimate_supplier_quote_access_items
    ADD CONSTRAINT estimate_supplier_quote_access_items_token_company_fk FOREIGN KEY (company_id, access_token_id) REFERENCES public.estimate_supplier_quote_access_tokens(company_id, id) ON DELETE CASCADE;$ddl$;
execute $ddl$ALTER TABLE ONLY public.estimate_supplier_quote_access_tokens
    ADD CONSTRAINT estimate_supplier_quote_access_quote_company_fk FOREIGN KEY (company_id, quote_id) REFERENCES public.estimate_supplier_quotes(company_id, id) ON DELETE CASCADE;$ddl$;
execute $ddl$ALTER TABLE ONLY public.estimate_supplier_quote_access_tokens
    ADD CONSTRAINT estimate_supplier_quote_access_tokens_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;$ddl$;
execute $ddl$ALTER TABLE ONLY public.estimate_supplier_quote_access_tokens
    ADD CONSTRAINT estimate_supplier_quote_access_tokens_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;$ddl$;
execute $ddl$ALTER TABLE ONLY public.estimate_supplier_quote_submission_events
    ADD CONSTRAINT estimate_supplier_quote_submissio_source_takeoff_output_id_fkey FOREIGN KEY (source_takeoff_output_id) REFERENCES public.takeoff_measurement_outputs(id) ON DELETE SET NULL;$ddl$;
execute $ddl$ALTER TABLE ONLY public.estimate_supplier_quote_submission_events
    ADD CONSTRAINT estimate_supplier_quote_submission_company_fk FOREIGN KEY (company_id, quote_id) REFERENCES public.estimate_supplier_quotes(company_id, id) ON DELETE CASCADE;$ddl$;
execute $ddl$ALTER TABLE ONLY public.estimate_supplier_quote_submission_events
    ADD CONSTRAINT estimate_supplier_quote_submission_events_access_token_id_fkey FOREIGN KEY (access_token_id) REFERENCES public.estimate_supplier_quote_access_tokens(id) ON DELETE SET NULL;$ddl$;
execute $ddl$ALTER TABLE ONLY public.estimate_supplier_quote_submission_events
    ADD CONSTRAINT estimate_supplier_quote_submission_events_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;$ddl$;
execute $ddl$ALTER TABLE ONLY public.estimate_supplier_quote_submission_events
    ADD CONSTRAINT estimate_supplier_quote_submission_events_quote_line_id_fkey FOREIGN KEY (quote_line_id) REFERENCES public.estimate_supplier_quote_lines(id) ON DELETE SET NULL;$ddl$;
execute $ddl$ALTER TABLE ONLY public.estimates
    ADD CONSTRAINT estimates_job_spine_fk FOREIGN KEY (company_id, job_spine_id) REFERENCES public.job_spines(company_id, id) ON DELETE RESTRICT;$ddl$;
execute $ddl$ALTER TABLE ONLY public.estimates
    ADD CONSTRAINT estimates_parent_proposal_fk FOREIGN KEY (parent_proposal_revision_id) REFERENCES public.proposal_presentations(id) ON DELETE RESTRICT;$ddl$;
execute $ddl$ALTER TABLE ONLY public.job_number_sequences
    ADD CONSTRAINT job_number_sequences_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;$ddl$;
execute $ddl$ALTER TABLE ONLY public.job_spine_migration_reviews
    ADD CONSTRAINT job_spine_migration_reviews_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;$ddl$;
execute $ddl$ALTER TABLE ONLY public.job_spine_migration_reviews
    ADD CONSTRAINT job_spine_migration_reviews_company_id_job_spine_id_fkey FOREIGN KEY (company_id, job_spine_id) REFERENCES public.job_spines(company_id, id) ON DELETE CASCADE;$ddl$;
execute $ddl$ALTER TABLE ONLY public.job_spine_migration_reviews
    ADD CONSTRAINT job_spine_migration_reviews_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES auth.users(id) ON DELETE SET NULL;$ddl$;
execute $ddl$ALTER TABLE ONLY public.job_spines
    ADD CONSTRAINT job_spines_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;$ddl$;
execute $ddl$ALTER TABLE ONLY public.job_spines
    ADD CONSTRAINT job_spines_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;$ddl$;
execute $ddl$ALTER TABLE ONLY public.job_spines
    ADD CONSTRAINT job_spines_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;$ddl$;
execute $ddl$ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_job_spine_fk FOREIGN KEY (company_id, job_spine_id) REFERENCES public.job_spines(company_id, id) ON DELETE RESTRICT;$ddl$;
execute $ddl$ALTER TABLE ONLY public.overhead_rate_snapshots
    ADD CONSTRAINT overhead_rate_snapshots_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;$ddl$;
execute $ddl$ALTER TABLE ONLY public.project_award_records
    ADD CONSTRAINT project_award_records_company_id_award_decision_id_fkey FOREIGN KEY (company_id, award_decision_id) REFERENCES public.award_decisions(company_id, id) ON DELETE RESTRICT;$ddl$;
execute $ddl$ALTER TABLE ONLY public.project_budgets
    ADD CONSTRAINT project_budgets_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;$ddl$;
execute $ddl$ALTER TABLE ONLY public.project_inspections
    ADD CONSTRAINT project_inspections_resulted_by_fkey FOREIGN KEY (resulted_by) REFERENCES public.profiles(id) ON DELETE SET NULL;$ddl$;
execute $ddl$ALTER TABLE ONLY public.project_payment_milestones
    ADD CONSTRAINT project_payment_milestone_award_record_fk FOREIGN KEY (company_id, award_record_id) REFERENCES public.project_award_records(company_id, id) ON DELETE RESTRICT;$ddl$;
execute $ddl$ALTER TABLE ONLY public.project_payment_milestones
    ADD CONSTRAINT project_payment_milestones_company_id_award_decision_id_fkey FOREIGN KEY (company_id, award_decision_id) REFERENCES public.award_decisions(company_id, id) ON DELETE RESTRICT;$ddl$;
execute $ddl$ALTER TABLE ONLY public.project_startup_items
    ADD CONSTRAINT project_startup_items_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;$ddl$;
execute $ddl$ALTER TABLE ONLY public.project_startup_items
    ADD CONSTRAINT project_startup_items_company_id_project_id_fkey FOREIGN KEY (company_id, project_id) REFERENCES public.projects(company_id, id) ON DELETE CASCADE;$ddl$;
execute $ddl$ALTER TABLE ONLY public.project_startup_items
    ADD CONSTRAINT project_startup_items_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;$ddl$;
execute $ddl$ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_award_decision_fk FOREIGN KEY (company_id, award_decision_id) REFERENCES public.award_decisions(company_id, id) ON DELETE RESTRICT;$ddl$;
execute $ddl$ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_job_spine_fk FOREIGN KEY (company_id, job_spine_id) REFERENCES public.job_spines(company_id, id) ON DELETE RESTRICT;$ddl$;
execute $ddl$ALTER TABLE ONLY public.proposal_acceptance_resolutions
    ADD CONSTRAINT proposal_acceptance_resolutio_company_id_proposal_revision_fkey FOREIGN KEY (company_id, proposal_revision_id) REFERENCES public.proposal_presentations(company_id, id) ON DELETE RESTRICT;$ddl$;
execute $ddl$ALTER TABLE ONLY public.proposal_acceptance_resolutions
    ADD CONSTRAINT proposal_acceptance_resolutions_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;$ddl$;
execute $ddl$ALTER TABLE ONLY public.proposal_acceptance_resolutions
    ADD CONSTRAINT proposal_acceptance_resolutions_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES auth.users(id) ON DELETE RESTRICT;$ddl$;
execute $ddl$ALTER TABLE ONLY public.proposal_presentations
    ADD CONSTRAINT proposal_presentations_job_spine_fk FOREIGN KEY (company_id, job_spine_id) REFERENCES public.job_spines(company_id, id) ON DELETE RESTRICT;$ddl$;
execute $ddl$ALTER TABLE ONLY public.proposal_presentations
    ADD CONSTRAINT proposals_parent_revision_fk FOREIGN KEY (parent_revision_id) REFERENCES public.proposal_presentations(id) ON DELETE RESTRICT;$ddl$;
execute $ddl$ALTER TABLE ONLY public.takeoff_sheet_metadata_events
    ADD CONSTRAINT takeoff_sheet_metadata_events_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT;$ddl$;
for r in select conname from pg_constraint where conrelid='public.project_payment_milestones'::regclass and contype='f' and confrelid='public.project_award_records'::regclass and array_length(conkey,1)=1 loop execute format('alter table public.project_payment_milestones drop constraint %I',r.conname);end loop;
for r in select t.tgname,c.relname,t.tgenabled from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace join pg_proc f on f.oid=t.tgfoid where n.nspname='public' and c.relname in ('leads','estimates','projects','proposal_presentations') and not t.tgisinternal and f.proname='set_updated_at' and t.tgenabled in ('O','A','R') loop v_touch:=v_touch||jsonb_build_array(jsonb_build_object('table',r.relname,'name',r.tgname,'mode',r.tgenabled));execute format('alter table public.%I disable trigger %I',r.relname,r.tgname);end loop;
execute $ddl$do $backfill$
declare r record; v_spine uuid;
begin
  for r in select * from public.leads where job_spine_id is null order by created_at,id loop
    insert into public.job_spines(company_id,name) values(r.company_id,coalesce(nullif(trim(r.project_name),''),r.customer_name)) returning id into v_spine;
    update public.leads set job_spine_id=v_spine where id=r.id;
  end loop;
  for r in select * from public.estimates where job_spine_id is null order by created_at,id loop
    v_spine:=null;
    if r.lead_id is not null then select job_spine_id into v_spine from public.leads where id=r.lead_id and company_id=r.company_id; end if;
    if v_spine is null then
      insert into public.job_spines(company_id,name,review_state,created_by) values(r.company_id,coalesce(nullif(trim(r.name),''),'Estimate'),'review_required',r.created_by) returning id into v_spine;
      insert into public.job_spine_migration_reviews(company_id,job_spine_id,phase_type,phase_id,reason)
      values(r.company_id,v_spine,'estimate',r.id,'No trustworthy Opportunity relationship existed during backfill.');
    end if;
    update public.estimates set job_spine_id=v_spine where id=r.id;
  end loop;
  for r in select * from public.projects where job_spine_id is null order by created_at,id loop
    v_spine:=null;
    if r.source_estimate_id is not null then select job_spine_id into v_spine from public.estimates where id=r.source_estimate_id and company_id=r.company_id; end if;
    if v_spine is null then
      select (array_agg(job_spine_id order by job_spine_id))[1] into v_spine from public.estimates where project_id=r.id and company_id=r.company_id having count(distinct job_spine_id)=1;
    end if;
    if v_spine is null then
      insert into public.job_spines(company_id,name,review_state) values(r.company_id,coalesce(nullif(trim(r.name),''),'Project'),'review_required') returning id into v_spine;
      insert into public.job_spine_migration_reviews(company_id,job_spine_id,phase_type,phase_id,reason)
      values(r.company_id,v_spine,'project',r.id,'No unambiguous source Estimate relationship existed during backfill.');
    end if;
    update public.projects set job_spine_id=v_spine where id=r.id;
  end loop;
  update public.proposal_presentations p set job_spine_id=e.job_spine_id from public.estimates e
  where e.id=p.estimate_id and e.company_id=p.company_id;
end
$backfill$;$ddl$;
execute $ddl$do $legacy$
declare r record; v_spine uuid;
begin
  for r in select p.id,p.company_id,p.job_spine_id from public.proposal_presentations p where (p.response_state='accepted' or p.status='accepted') and p.internal_commercial_snapshot is null loop
    v_spine:=r.job_spine_id;
    if v_spine is not null then
      insert into public.job_spine_migration_reviews(company_id,job_spine_id,phase_type,phase_id,reason)
      values(r.company_id,v_spine,'proposal',r.id,'Historical customer acceptance has no trustworthy frozen internal cost and production evidence; award is held.')
      on conflict(company_id,phase_type,phase_id) do nothing;
    end if;
  end loop;
end
$legacy$;$ddl$;
for r in select value from jsonb_array_elements(v_touch) loop execute format('alter table public.%I enable %s trigger %I',r.value->>'table',case r.value->>'mode' when 'A' then 'always' when 'R' then 'replica' else '' end,r.value->>'name');end loop;
execute $ddl$CREATE FUNCTION public.carez_assign_phase_job_spine() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'auth'
    AS $$
declare v_spine uuid; v_lead_spine uuid; v_project_spine uuid; v_name text;
begin
  if new.job_spine_id is not null then
    if not exists(select 1 from public.job_spines s where s.id=new.job_spine_id and s.company_id=new.company_id) then raise exception 'Job Spine must belong to the phase company.'; end if;
    return new;
  end if;
  if tg_table_name='estimates' then
    if new.lead_id is not null then select job_spine_id into v_lead_spine from public.leads where id=new.lead_id and company_id=new.company_id; end if;
    if new.project_id is not null then select job_spine_id into v_project_spine from public.projects where id=new.project_id and company_id=new.company_id; end if;
    if v_lead_spine is not null and v_project_spine is not null and v_lead_spine<>v_project_spine then raise exception 'Estimate Opportunity and Project have conflicting Job Spine identities.'; end if;
    v_spine:=coalesce(v_lead_spine,v_project_spine);
  elsif tg_table_name='projects' then
    if new.source_estimate_id is not null then
      select job_spine_id into v_spine from public.estimates where id=new.source_estimate_id and company_id=new.company_id;
    end if;
  end if;
  if v_spine is null then
    if tg_table_name='leads' then v_name:=new.project_name; else v_name:=new.name; end if;
    insert into public.job_spines(company_id,name,created_by,updated_by)
    values(new.company_id,coalesce(nullif(trim(v_name),''),'Job'),auth.uid(),auth.uid()) returning id into v_spine;
  end if;
  new.job_spine_id:=v_spine;
  return new;
end
$$;$ddl$;
execute $ddl$revoke all on function public.carez_assign_phase_job_spine() from public,anon,authenticated;$ddl$;
execute $ddl$CREATE FUNCTION public.carez_audit_takeoff_sheet_metadata() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
begin
  if new.sheet_number is distinct from old.sheet_number or new.title is distinct from old.title then
    insert into public.takeoff_sheet_metadata_events (
      company_id, takeoff_set_id, sheet_id, page_number,
      old_sheet_number, new_sheet_number, old_title, new_title, actor_id
    ) values (
      new.company_id, new.takeoff_set_id, new.id, new.page_number,
      old.sheet_number, new.sheet_number, old.title, new.title, auth.uid()
    );
  end if;
  return new;
end
$$;$ddl$;
execute $ddl$revoke all on function public.carez_audit_takeoff_sheet_metadata() from public,anon,authenticated;$ddl$;
execute $ddl$CREATE FUNCTION public.carez_award_proposal_and_create_project(p_proposal_revision_id uuid, p_effective_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_evidence_reference text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'auth', 'extensions'
    AS $$
declare
  v_company uuid; v_actor uuid; p public.proposal_presentations%rowtype; e public.estimates%rowtype;
  v_hold text; v_spine uuid; v_project uuid; v_award uuid; v_snapshot uuid; v_baseline uuid;
  v_facts jsonb; v_summary jsonb; v_item jsonb; v_snapshot_item uuid; v_year integer:=extract(year from now())::integer; v_seq integer;
  v_effective_sell numeric; v_resolution_fingerprint text;
begin
  v_actor:=auth.uid(); v_company:=public.get_my_company_id();
  if v_actor is null or v_company is null or public.get_my_role()='employee' then raise exception 'Owner or office access required.'; end if;
  select * into p from public.proposal_presentations where id=p_proposal_revision_id and company_id=v_company for update;
  if not found then raise exception 'Issued Proposal revision not found.'; end if;
  if exists(select 1 from public.award_decisions a where a.company_id=v_company and a.proposal_revision_id=p.id) then
    select a.id,a.project_id into v_award,v_project from public.award_decisions a where a.company_id=v_company and a.proposal_revision_id=p.id;
    select id into v_snapshot from public.accepted_scope_snapshots where company_id=v_company and award_decision_id=v_award;
    select id into v_baseline from public.commercial_baselines where company_id=v_company and award_decision_id=v_award;
    return jsonb_build_object('project_id',v_project,'award_decision_id',v_award,'snapshot_id',v_snapshot,'baseline_id',v_baseline,'already_awarded',true);
  end if;
  v_hold:=public.carez_get_proposal_award_hold(p.id); if v_hold is not null then raise exception using message=v_hold,errcode='P0001'; end if;
  select * into e from public.estimates where id=p.estimate_id and company_id=v_company for update;
  if not found or e.status not in ('ready','accepted','approved') then raise exception 'Award held: source Estimate is not in a released state.'; end if;
  v_facts:=public.carez_get_proposal_acceptance_facts(p.id); v_summary:=v_facts->'financial_summary'; v_effective_sell:=coalesce((v_summary->>'selected_sell_price')::numeric,p.base_sell_price);
  select source_fingerprint into v_resolution_fingerprint from public.proposal_acceptance_resolutions where company_id=v_company and proposal_revision_id=p.id;
  v_spine:=coalesce(p.job_spine_id,e.job_spine_id);
  if v_spine is null then
    insert into public.job_spines(company_id,name,created_by,updated_by) values(v_company,coalesce(nullif(trim(e.name),''),'Job'),v_actor,v_actor) returning id into v_spine;
    if e.lead_id is not null then update public.leads set job_spine_id=v_spine,updated_at=now() where id=e.lead_id and company_id=v_company and job_spine_id is null; end if;
    update public.estimates set job_spine_id=v_spine where id=e.id and company_id=v_company and job_spine_id is null;
    update public.proposal_presentations set job_spine_id=v_spine where id=p.id and company_id=v_company and job_spine_id is null;
  end if;
  v_project:=e.project_id;
  if v_project is not null then
    if not exists(select 1 from public.projects pr where pr.id=v_project and pr.company_id=v_company and pr.job_spine_id=v_spine and (pr.source_estimate_id is null or pr.source_estimate_id=e.id) and pr.award_decision_id is null) then raise exception 'Award held: linked Project has conflicting source or Award lineage.'; end if;
  else
    insert into public.job_number_sequences(company_id,sequence_year,next_number) values(v_company,v_year,2) on conflict(company_id,sequence_year) do update set next_number=public.job_number_sequences.next_number+1 returning next_number-1 into v_seq;
    insert into public.projects(company_id,customer_id,job_number,name,address,city,state,status,contract_value,source_estimate_id,job_spine_id)
    values(v_company,(select l.customer_id from public.leads l where l.id=e.lead_id and l.company_id=v_company),'JOB-'||v_year::text||'-'||lpad(v_seq::text,4,'0'),coalesce(nullif(p.snapshot#>>'{lead,project_name}',''),e.name),p.snapshot#>>'{lead,address}',p.snapshot#>>'{lead,city}',coalesce(nullif(p.snapshot#>>'{lead,state}',''),'WA'),'active',v_effective_sell,e.id,v_spine) returning id into v_project;
  end if;
  update public.projects set job_spine_id=v_spine,source_estimate_id=coalesce(source_estimate_id,e.id),contract_value=v_effective_sell where id=v_project and company_id=v_company;
  insert into public.award_decisions(company_id,job_spine_id,proposal_revision_id,estimate_id,project_id,authorized_actor_id,decided_at,effective_at,evidence_reference) values(v_company,v_spine,p.id,e.id,v_project,v_actor,now(),coalesce(p_effective_at,now()),nullif(trim(p_evidence_reference),'')) returning id into v_award;
  insert into public.accepted_scope_snapshots(company_id,job_spine_id,award_decision_id,proposal_revision_id,estimate_id,source_fingerprint,source_schema_version,accepted_facts)
  values(v_company,v_spine,v_award,p.id,e.id,coalesce(v_resolution_fingerprint,p.release_commercial_fingerprint),1,jsonb_build_object('proposal_revision_id',p.id,'estimate_id',e.id,'proposal',v_facts->'proposal','estimate',v_facts->'estimate','sections',v_facts->'sections','items',v_facts->'items','takeoff_sets',v_facts->'takeoff_sets','takeoff_sheets',v_facts->'takeoff_sheets','measurements',v_facts->'measurements','measurement_outputs',v_facts->'measurement_outputs','conditions',v_facts->'conditions','condition_versions',v_facts->'condition_versions','condition_modules',v_facts->'condition_modules','condition_roles',v_facts->'condition_roles','condition_outputs',v_facts->'condition_outputs','financial_summary',v_summary)) returning id into v_snapshot;
  for v_item in select value from jsonb_array_elements(v_facts->'items') loop
    insert into public.accepted_scope_snapshot_items(company_id,snapshot_id,source_estimate_item_id,source_takeoff_output_id,source_takeoff_measurement_id,item_facts,production_quantity,production_unit,direct_cost)
    values(v_company,v_snapshot,(v_item->>'id')::uuid,nullif(v_item->>'source_takeoff_output_id','')::uuid,nullif(v_item->>'source_takeoff_measurement_id','')::uuid,v_item,nullif(v_item->>'production_quantity','')::numeric,v_item->>'production_unit',(v_item->>'direct_cost')::numeric) returning id into v_snapshot_item;
  end loop;
  insert into public.commercial_baselines(company_id,job_spine_id,project_id,award_decision_id,accepted_scope_snapshot_id,proposal_revision_id,estimate_id,total_direct_cost,total_sell,financial_facts,provenance)
  values(v_company,v_spine,v_project,v_award,v_snapshot,p.id,e.id,(v_summary->>'total_direct_cost')::numeric,v_effective_sell,v_summary,jsonb_build_object('source','accepted_scope_snapshot','snapshot_id',v_snapshot,'proposal_revision_id',p.id,'estimate_id',e.id,'release_fingerprint',coalesce(v_resolution_fingerprint,p.release_commercial_fingerprint))) returning id into v_baseline;
  insert into public.commercial_baseline_items(company_id,baseline_id,snapshot_item_id,quantity,unit,production_quantity,production_unit,direct_cost,sell_amount,source_facts)
  select v_company,v_baseline,si.id,(si.item_facts->>'quantity')::numeric,si.item_facts->>'unit',si.production_quantity,si.production_unit,si.direct_cost,null,si.item_facts from public.accepted_scope_snapshot_items si where si.company_id=v_company and si.snapshot_id=v_snapshot;
  update public.projects set award_decision_id=v_award where id=v_project and company_id=v_company;
  update public.estimates set status='accepted',approved_at=coalesce(approved_at,now()),project_id=v_project,job_spine_id=v_spine,updated_at=now() where id=e.id and company_id=v_company;
  if e.lead_id is not null then update public.leads set status='won',updated_at=now() where id=e.lead_id and company_id=v_company; end if;
  return jsonb_build_object('project_id',v_project,'award_decision_id',v_award,'snapshot_id',v_snapshot,'baseline_id',v_baseline,'already_awarded',false);
end
$$;$ddl$;
execute $ddl$revoke all on function public.carez_award_proposal_and_create_project(uuid, timestamp with time zone, text) from public,anon,authenticated;$ddl$;
execute $ddl$CREATE FUNCTION public.carez_can_manage_commercial_changes() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
  select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('owner','office'))
$$;$ddl$;
execute $ddl$revoke all on function public.carez_can_manage_commercial_changes() from public,anon,authenticated;$ddl$;
execute $ddl$CREATE FUNCTION public.carez_capture_proposal_commercial_snapshot() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'extensions'
    AS $$
declare v_estimate jsonb; v_summary jsonb;
begin
  select to_jsonb(e) into v_estimate from public.estimates e where e.id=new.estimate_id and e.company_id=new.company_id;
  if v_estimate is null then raise exception 'Proposal Estimate source is missing.'; end if;
  select to_jsonb(s) into v_summary from public.estimate_financial_summary s where s.estimate_id=new.estimate_id and s.company_id=new.company_id;
  if v_summary is null then raise exception 'Financial summary is required to freeze internal commercial evidence.'; end if;
  if coalesce((v_summary->>'selected_sell_price')::numeric,0)<>new.base_sell_price
     or coalesce((new.snapshot#>>'{pricing,base_sell_price}')::numeric,new.base_sell_price)<>new.base_sell_price then
    raise exception 'Issued Sell does not match the frozen Estimate commercial summary.';
  end if;
  new.job_spine_id:=(v_estimate->>'job_spine_id')::uuid;
  new.parent_revision_id:=(v_estimate->>'parent_proposal_revision_id')::uuid;
  new.internal_commercial_snapshot:=jsonb_build_object(
    'schema_version',1,'captured_at',clock_timestamp(),'estimate',v_estimate,'financial_summary',v_summary,
    'sections',coalesce((select jsonb_agg(to_jsonb(s) order by s.sort_order,s.id) from public.estimate_sections s where s.company_id=new.company_id and s.estimate_id=new.estimate_id),'[]'),
    'items',coalesce((select jsonb_agg(to_jsonb(i) order by i.sort_order,i.id) from public.estimate_items i where i.company_id=new.company_id and i.estimate_id=new.estimate_id),'[]'),
    'takeoff_sets',coalesce((select jsonb_agg(to_jsonb(ts) order by ts.id) from public.takeoff_sets ts where ts.company_id=new.company_id and ts.estimate_id=new.estimate_id),'[]'),
    'takeoff_sheets',coalesce((select jsonb_agg(to_jsonb(sh) order by sh.takeoff_set_id,sh.sort_order,sh.id) from public.takeoff_sheets sh join public.takeoff_sets ts on ts.id=sh.takeoff_set_id where ts.company_id=new.company_id and ts.estimate_id=new.estimate_id),'[]'),
    'measurements',coalesce((select jsonb_agg(to_jsonb(m) order by m.id) from public.takeoff_measurements m where m.company_id=new.company_id and m.estimate_id=new.estimate_id),'[]'),
    'measurement_outputs',coalesce((select jsonb_agg(to_jsonb(o) order by o.id) from public.takeoff_measurement_outputs o join public.takeoff_measurements m on m.id=o.measurement_id where m.company_id=new.company_id and m.estimate_id=new.estimate_id),'[]'),
    'conditions',coalesce((select jsonb_agg(to_jsonb(c) order by c.id) from public.project_concrete_conditions c join public.takeoff_sets ts on ts.id=c.takeoff_set_id where c.company_id=new.company_id and ts.estimate_id=new.estimate_id),'[]'),
    'condition_versions',coalesce((select jsonb_agg(to_jsonb(v) order by v.condition_id,v.revision_no) from public.project_concrete_condition_versions v join public.project_concrete_conditions c on c.id=v.condition_id join public.takeoff_sets ts on ts.id=c.takeoff_set_id where v.company_id=new.company_id and ts.estimate_id=new.estimate_id),'[]'),
    'condition_modules',coalesce((select jsonb_agg(to_jsonb(m) order by m.condition_version_id,m.sort_order,m.id) from public.project_condition_module_instances m join public.project_concrete_condition_versions v on v.id=m.condition_version_id join public.project_concrete_conditions c on c.id=v.condition_id join public.takeoff_sets ts on ts.id=c.takeoff_set_id where m.company_id=new.company_id and ts.estimate_id=new.estimate_id),'[]'),
    'condition_roles',coalesce((select jsonb_agg(to_jsonb(r) order by r.condition_version_id,r.sort_order,r.id) from public.project_condition_measurement_roles r join public.project_concrete_condition_versions v on v.id=r.condition_version_id join public.project_concrete_conditions c on c.id=v.condition_id join public.takeoff_sets ts on ts.id=c.takeoff_set_id where r.company_id=new.company_id and ts.estimate_id=new.estimate_id),'[]'),
    'condition_outputs',coalesce((select jsonb_agg(to_jsonb(o) order by o.condition_version_id,o.output_key,o.output_instance_key) from public.project_condition_outputs o join public.project_concrete_condition_versions v on v.id=o.condition_version_id join public.project_concrete_conditions c on c.id=v.condition_id join public.takeoff_sets ts on ts.id=c.takeoff_set_id where o.company_id=new.company_id and ts.estimate_id=new.estimate_id),'[]'),
    'proposal',new.snapshot);
  return new;
end
$$;$ddl$;
execute $ddl$revoke all on function public.carez_capture_proposal_commercial_snapshot() from public,anon,authenticated;$ddl$;
execute $ddl$CREATE FUNCTION public.carez_change_order_status_event() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
begin
  if tg_op='INSERT' then
    insert into public.change_order_events(company_id,project_id,change_order_id,to_status,actor_id,evidence)
    values(new.company_id,new.project_id,new.id,new.status,coalesce(auth.uid(),new.created_by),jsonb_build_object('event','created'));
    return new;
  end if;
  if new.status is distinct from old.status then
    if not public.carez_can_manage_commercial_changes() then raise exception 'Commercial Change Order authority required.'; end if;
    if not ((old.status='draft' and new.status in ('submitted','void'))
      or (old.status='submitted' and new.status in ('draft','approved','rejected','void'))) then
      raise exception 'Invalid Change Order status transition: % to %.',old.status,new.status;
    end if;
  end if;
  if old.status in ('approved','rejected','void') and (to_jsonb(new)-array['updated_at']) is distinct from (to_jsonb(old)-array['updated_at']) then
    raise exception 'Closed Change Orders are immutable.';
  end if;
  if old.status='submitted' and (to_jsonb(new)-array['status','updated_at','submitted_at','rejected_at','voided_at','approved_at','approved_by']) is distinct from (to_jsonb(old)-array['status','updated_at','submitted_at','rejected_at','voided_at','approved_at','approved_by']) then
    raise exception 'Submitted Change Orders are frozen; return to Draft before editing.';
  end if;
  return new;
end
$$;$ddl$;
execute $ddl$revoke all on function public.carez_change_order_status_event() from public,anon,authenticated;$ddl$;
execute $ddl$CREATE FUNCTION public.carez_commercial_actor_company() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
  select p.company_id from public.profiles p where p.id=auth.uid()
$$;$ddl$;
execute $ddl$revoke all on function public.carez_commercial_actor_company() from public,anon,authenticated;$ddl$;
execute $ddl$CREATE FUNCTION public.carez_correct_takeoff_sheet_metadata(p_takeoff_set_id uuid, p_sheet_id uuid, p_page_number integer, p_expected_updated_at timestamp with time zone, p_sheet_number text, p_title text) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
begin
  if auth.uid() is null or public.get_my_company_id() is null
    or public.get_my_role() = 'employee' then
    raise exception 'Takeoff editing authority required to change a sheet label.';
  end if;
  if p_takeoff_set_id is null or p_sheet_id is null or p_page_number is null
    or p_expected_updated_at is null then
    raise exception 'A selected drawing sheet and version are required.';
  end if;

  update public.takeoff_sheets s
    set sheet_number = nullif(btrim(p_sheet_number), ''),
        title = nullif(btrim(p_title), '')
    where s.id = p_sheet_id
      and s.company_id = public.get_my_company_id()
      and s.takeoff_set_id = p_takeoff_set_id
      and s.page_number = p_page_number
      and s.updated_at = p_expected_updated_at
      and (s.sheet_number is distinct from nullif(btrim(p_sheet_number), '')
        or s.title is distinct from nullif(btrim(p_title), ''));
  if not found then
    raise exception 'Sheet changed or was not found. Refresh and try again.';
  end if;
end
$$;$ddl$;
execute $ddl$revoke all on function public.carez_correct_takeoff_sheet_metadata(uuid, uuid, integer, timestamp with time zone, text, text) from public,anon,authenticated;$ddl$;
execute $ddl$CREATE FUNCTION public.carez_create_change_order(p_project_id uuid, p_title text, p_change_type text, p_requested_date date DEFAULT CURRENT_DATE, p_description text DEFAULT NULL::text, p_reason text DEFAULT NULL::text, p_requested_by text DEFAULT NULL::text, p_overhead_snapshot_id uuid DEFAULT NULL::uuid, p_overhead_rate_snapshot numeric DEFAULT 0, p_reversal_of_change_order_id uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
declare v_company uuid; v_id uuid; v_number integer; v_project public.projects%rowtype; v_estimate public.estimates%rowtype; v_original public.change_orders%rowtype;
begin
  v_company:=public.carez_commercial_actor_company();
  if auth.uid() is null or not public.carez_can_manage_commercial_changes() then raise exception 'Owner or office authority required.'; end if;
  select * into v_project from public.projects where id=p_project_id and company_id=v_company for update;
  if not found then raise exception 'Project not found.'; end if;
  select * into v_estimate from public.estimates where id=v_project.source_estimate_id and company_id=v_company;
  if not found then raise exception 'Award source Estimate not found.'; end if;
  if p_reversal_of_change_order_id is not null then
    select * into v_original from public.change_orders where id=p_reversal_of_change_order_id and company_id=v_company
      and project_id=p_project_id and status='approved' and reversal_of_change_order_id is null for share;
    if not found or not exists(select 1 from public.approved_commercial_deltas d where d.company_id=v_company and d.change_order_id=v_original.id) then raise exception 'Only an unreversed approved Change Order from this Project can be reversed.'; end if;
    if exists(select 1 from public.change_orders where company_id=v_company and reversal_of_change_order_id=v_original.id) then raise exception 'This approved Change Order already has a reversal.'; end if;
    if (v_original.change_type='additive' and p_change_type<>'deductive') or (v_original.change_type='deductive' and p_change_type<>'additive') or (v_original.change_type='no_cost' and p_change_type<>'no_cost') then
      raise exception 'Reversal Change Order type must counter the original approved change.';
    end if;
  end if;
  insert into public.change_order_number_sequences(company_id,project_id,last_number) values(v_company,p_project_id,1)
  on conflict(company_id,project_id) do update set last_number=public.change_order_number_sequences.last_number+1
  returning last_number into v_number;
  insert into public.change_orders(company_id,project_id,co_number,title,description,reason,requested_by,requested_date,change_type,
    target_margin_percent,bo_rate_percent,payment_processing_rate_percent,overhead_snapshot_id,overhead_rate_snapshot,created_by,reversal_of_change_order_id)
  values(v_company,p_project_id,'CO-'||lpad(v_number::text,3,'0'),btrim(p_title),nullif(btrim(p_description),''),nullif(btrim(p_reason),''),
    nullif(btrim(p_requested_by),''),coalesce(p_requested_date,current_date),p_change_type,coalesce(v_estimate.target_margin_percent,30),
    coalesce(v_estimate.bo_rate_percent,0.471),coalesce(v_estimate.payment_processing_rate_percent,0),p_overhead_snapshot_id,
    greatest(coalesce(p_overhead_rate_snapshot,0),0),auth.uid(),p_reversal_of_change_order_id) returning id into v_id;
  return v_id;
end
$$;$ddl$;
execute $ddl$revoke all on function public.carez_create_change_order(uuid, text, text, date, text, text, text, uuid, numeric, uuid) from public,anon,authenticated;$ddl$;
execute $ddl$CREATE FUNCTION public.carez_create_next_proposal_revision(p_proposal_revision_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'auth', 'extensions'
    AS $$
declare
  v_company uuid; v_actor uuid; p public.proposal_presentations%rowtype; e public.estimates%rowtype;
  v_new_estimate uuid; v_version integer; v_section record; v_item record; v_new_section uuid; v_section_map jsonb:='{}'::jsonb;
begin
  v_actor:=auth.uid(); v_company:=public.get_my_company_id();
  if v_actor is null or v_company is null or public.get_my_role()='employee' then raise exception 'Owner or office access required.'; end if;
  select * into p from public.proposal_presentations where id=p_proposal_revision_id and company_id=v_company for update;
  if not found then raise exception 'Issued Proposal revision not found.'; end if;
  select * into e from public.estimates where id=p.estimate_id and company_id=v_company for update;
  if not found then raise exception 'Source Estimate revision not found.'; end if;
  if exists(select 1 from public.award_decisions a where a.company_id=v_company and a.proposal_revision_id=p.id) then raise exception 'An awarded Proposal cannot be revised.'; end if;
  select id into v_new_estimate from public.estimates where company_id=v_company and parent_proposal_revision_id=p.id;
  if v_new_estimate is not null then return jsonb_build_object('estimate_id',v_new_estimate,'already_created',true); end if;
  select coalesce(max(version),e.version)+1 into v_version from public.estimates where company_id=v_company and estimate_number=e.estimate_number;
  insert into public.estimates(company_id,project_id,estimate_number,name,status,version,expected_start_date,target_margin_percent,bo_classification,bo_rate_percent,payment_processing_rate_percent,overhead_snapshot_id,overhead_rate_snapshot,proposed_sell_price,notes,approved_at,created_by,lead_id,opportunity_number,job_spine_id,parent_proposal_revision_id)
  values(v_company,null,e.estimate_number,e.name,'draft',v_version,e.expected_start_date,e.target_margin_percent,e.bo_classification,e.bo_rate_percent,e.payment_processing_rate_percent,e.overhead_snapshot_id,e.overhead_rate_snapshot,e.proposed_sell_price,e.notes,null,v_actor,e.lead_id,e.opportunity_number,e.job_spine_id,p.id)
  returning id into v_new_estimate;
  for v_section in select * from public.estimate_sections where estimate_id=e.id and company_id=v_company order by sort_order,id loop
    insert into public.estimate_sections(company_id,estimate_id,name,scope_type,sort_order,notes)
    values(v_company,v_new_estimate,v_section.name,v_section.scope_type,v_section.sort_order,v_section.notes) returning id into v_new_section;
    v_section_map:=jsonb_set(v_section_map,array[v_section.id::text],to_jsonb(v_new_section),true);
  end loop;
  for v_item in select * from public.estimate_items where estimate_id=e.id and company_id=v_company order by sort_order,id loop
    insert into public.estimate_items(company_id,estimate_id,section_id,item_type,cost_code_id,catalog_item_id,crew_member_id,labor_task,risk_class_code,description,quantity,unit,unit_cost,direct_cost,regular_hours,overtime_hours,base_hourly_rate_snapshot,social_security_rate_snapshot,medicare_rate_snapshot,futa_rate_snapshot,wa_sui_rate_snapshot,li_employer_rate_snapshot,sick_leave_accrual_rate_snapshot,notes,sort_order,source_takeoff_output_id,source_takeoff_measurement_id,source_assembly_version_id,production_task_id,production_quantity,production_unit,baseline_man_hours_per_unit,baseline_source,price_source_kind,price_source_id,price_source_label,price_source_reference,price_effective_date,price_override_by,price_override_at,job_man_hours_per_unit,labor_assumption_override_by,labor_assumption_override_at,labor_rate_override_by,labor_rate_override_at,revision_source_estimate_item_id,revision_source_takeoff_output_id,revision_source_takeoff_measurement_id)
    values(v_company,v_new_estimate,(v_section_map->>v_item.section_id::text)::uuid,v_item.item_type,v_item.cost_code_id,v_item.catalog_item_id,v_item.crew_member_id,v_item.labor_task,v_item.risk_class_code,v_item.description,v_item.quantity,v_item.unit,v_item.unit_cost,v_item.direct_cost,v_item.regular_hours,v_item.overtime_hours,v_item.base_hourly_rate_snapshot,v_item.social_security_rate_snapshot,v_item.medicare_rate_snapshot,v_item.futa_rate_snapshot,v_item.wa_sui_rate_snapshot,v_item.li_employer_rate_snapshot,v_item.sick_leave_accrual_rate_snapshot,v_item.notes,v_item.sort_order,null,null,v_item.source_assembly_version_id,v_item.production_task_id,v_item.production_quantity,v_item.production_unit,v_item.baseline_man_hours_per_unit,v_item.baseline_source,v_item.price_source_kind,v_item.price_source_id,v_item.price_source_label,v_item.price_source_reference,v_item.price_effective_date,v_item.price_override_by,v_item.price_override_at,v_item.job_man_hours_per_unit,v_item.labor_assumption_override_by,v_item.labor_assumption_override_at,v_item.labor_rate_override_by,v_item.labor_rate_override_at,v_item.id,v_item.source_takeoff_output_id,v_item.source_takeoff_measurement_id);
  end loop;
  insert into public.proposal_settings(company_id,estimate_id,audience_type,executive_summary,customer_message,schedule_summary,payment_summary,warranty_summary,why_carez,pricing_note,terms_text,show_quantities,validity_days,created_by)
  select company_id,v_new_estimate,audience_type,executive_summary,customer_message,schedule_summary,payment_summary,warranty_summary,why_carez,pricing_note,terms_text,show_quantities,validity_days,v_actor from public.proposal_settings where estimate_id=e.id and company_id=v_company;
  insert into public.proposal_clarifications(company_id,estimate_id,category,clarification_text,published,sort_order,created_by)
  select company_id,v_new_estimate,category,clarification_text,published,sort_order,v_actor from public.proposal_clarifications where estimate_id=e.id and company_id=v_company;
  insert into public.bid_value_options(company_id,lead_id,estimate_id,name,customer_description,sell_price_change,company_cost_change,schedule_days_change,function_quality_note,approval_required,status,created_by)
  select company_id,lead_id,v_new_estimate,name,customer_description,sell_price_change,company_cost_change,schedule_days_change,function_quality_note,approval_required,'suggested',v_actor from public.bid_value_options where estimate_id=e.id and company_id=v_company;
  return jsonb_build_object('estimate_id',v_new_estimate,'version',v_version,'parent_proposal_revision_id',p.id,'already_created',false);
end
$$;$ddl$;
execute $ddl$revoke all on function public.carez_create_next_proposal_revision(uuid) from public,anon,authenticated;$ddl$;
execute $ddl$CREATE FUNCTION public.carez_get_proposal_acceptance_facts(p_proposal_revision_id uuid) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
declare
  v_proposal public.proposal_presentations%rowtype;
  v_resolution public.proposal_acceptance_resolutions%rowtype;
  v_items jsonb;
  v_summary jsonb;
begin
  select * into v_proposal from public.proposal_presentations where id=p_proposal_revision_id and company_id=public.get_my_company_id();
  if not found or v_proposal.internal_commercial_snapshot is null then raise exception 'Issued Proposal commercial evidence is unavailable.'; end if;
  select * into v_resolution from public.proposal_acceptance_resolutions where company_id=public.get_my_company_id() and proposal_revision_id=p_proposal_revision_id;
  if not found then return v_proposal.internal_commercial_snapshot; end if;
  select coalesce(jsonb_agg(
    case
      when selected.item->>'accepted_quantity' is not null
        then jsonb_set(item,'{quantity}',to_jsonb((selected.item->>'accepted_quantity')::numeric),true)
      else item
    end order by item->>'id'
  ),'[]'::jsonb)
  into v_items
  from jsonb_array_elements(coalesce(v_proposal.internal_commercial_snapshot->'items','[]'::jsonb)) item
  left join lateral (
    select value as item from jsonb_array_elements(v_resolution.scope_resolution) value where value->>'estimate_item_id'=item->>'id' limit 1
  ) selected on true
  where selected.item is null or coalesce((selected.item->>'included')::boolean,true);
  v_summary := jsonb_set(jsonb_set(coalesce(v_proposal.internal_commercial_snapshot->'financial_summary','{}'::jsonb),'{selected_sell_price}',to_jsonb(v_resolution.effective_sell),true),'{total_direct_cost}',to_jsonb(v_resolution.effective_direct_cost),true);
  return jsonb_set(jsonb_set(v_proposal.internal_commercial_snapshot,'{items}',v_items,true),'{financial_summary}',v_summary,true);
end;
$$;$ddl$;
execute $ddl$revoke all on function public.carez_get_proposal_acceptance_facts(uuid) from public,anon,authenticated;$ddl$;
execute $ddl$CREATE FUNCTION public.carez_get_proposal_award_hold(p_proposal_revision_id uuid) RETURNS text
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public'
    AS $$
declare v_company uuid; p public.proposal_presentations%rowtype; v_item jsonb; v_resolution public.proposal_acceptance_resolutions%rowtype;
begin
  v_company:=public.get_my_company_id();
  if v_company is null or public.get_my_role()='employee' then return 'Owner or office access is required.'; end if;
  select * into p from public.proposal_presentations where id=p_proposal_revision_id and company_id=v_company;
  if not found then return 'Issued Proposal revision not found.'; end if;
  if p.status in ('declined','superseded','revoked') then return 'This Proposal revision is declined, superseded, or revoked.'; end if;
  if p.response_state in ('question','change_requested','option_interest','declined') or p.status='needs_reply' then return 'Resolve the customer response by issuing a clean next revision before award.'; end if;
  if p.internal_commercial_snapshot is null or p.internal_commercial_snapshot->>'schema_version' is distinct from '1' then return 'Award held: this historical Proposal has no trustworthy frozen internal cost and production evidence. Create and issue a reviewed next revision before award.'; end if;
  select * into v_resolution from public.proposal_acceptance_resolutions where company_id=v_company and proposal_revision_id=p.id;
  if jsonb_typeof(p.snapshot->'options')='array' and jsonb_array_length(p.snapshot->'options')>0 and not found then return 'Award held: resolve each alternate before award.'; end if;
  if jsonb_typeof(p.internal_commercial_snapshot->'items') is distinct from 'array' or jsonb_array_length(p.internal_commercial_snapshot->'items')=0 then return 'Award held: no frozen Estimate scope items were captured.'; end if;
  if coalesce((p.internal_commercial_snapshot->'financial_summary'->>'selected_sell_price')::numeric,0)<=0 and not found then return 'Award held: required Sell evidence is missing from the frozen Estimate.'; end if;
  for v_item in select value from jsonb_array_elements(p.internal_commercial_snapshot->'items') loop
    if v_item->>'quantity' is null or v_item->>'unit' is null or v_item->>'direct_cost' is null then return 'Award held: an Estimate item is missing quantity, unit, or Direct Cost evidence.'; end if;
    if v_item->>'source_takeoff_output_id' is not null and (v_item->>'production_quantity' is null or v_item->>'production_unit' is null) then return 'Award held: a Takeoff-linked item is missing Production Quantity evidence.'; end if;
  end loop;
  if exists(select 1 from jsonb_array_elements(coalesce(p.internal_commercial_snapshot->'condition_outputs','[]'::jsonb)) x where x->>'status'='held') then return 'Award held: a Concrete Condition output is unresolved.'; end if;
  if exists(select 1 from public.proposal_engagement_events x where x.presentation_id=p.id and x.handled_at is null and x.event_type in ('question','change_request','option_interest','decline')) then return 'Resolve outstanding customer questions or change requests before award.'; end if;
  return null;
end
$$;$ddl$;
execute $ddl$revoke all on function public.carez_get_proposal_award_hold(uuid) from public,anon,authenticated;$ddl$;
execute $ddl$CREATE FUNCTION public.carez_get_public_vendor_quote(p_token uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
declare
  v_token public.estimate_supplier_quote_access_tokens%rowtype;
  v_quote public.estimate_supplier_quotes%rowtype;
  v_set public.estimate_supplier_quote_sets%rowtype;
  v_estimate public.estimates%rowtype;
  v_editable boolean;
begin
  select * into v_token from public.estimate_supplier_quote_access_tokens
    where token = p_token and revoked_at is null and expires_at > now();
  if not found then return null; end if;
  select * into v_quote from public.estimate_supplier_quotes
    where id = v_token.quote_id and company_id = v_token.company_id;
  if not found then return null; end if;
  select * into v_set from public.estimate_supplier_quote_sets
    where id = v_quote.quote_set_id and company_id = v_token.company_id;
  if not found then return null; end if;
  select * into v_estimate from public.estimates
    where id = v_set.estimate_id and company_id = v_token.company_id;
  if not found then return null; end if;
  v_editable := v_estimate.status not in ('accepted', 'approved', 'superseded')
    and v_set.status <> 'archived'
    and v_quote.status not in ('declined', 'selected')
    and (v_quote.expires_at is null or v_quote.expires_at >= current_date)
    and not exists (select 1 from public.proposal_presentations p
      where p.company_id = v_token.company_id and p.estimate_id = v_estimate.id);
  return jsonb_build_object(
    'supplier_name', v_quote.supplier_name,
    'quote_number', v_quote.supplier_quote_number,
    'quote_set', v_set.name,
    'scope_note', v_set.scope_note,
    'estimate_name', v_estimate.name,
    'expires_at', v_token.expires_at,
    'editable', v_editable,
    'outputs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id, 'label', o.label, 'quantity', o.production_quantity,
        'unit', o.production_unit, 'unit_cost', ql.quoted_unit_cost,
        'source_reference', ql.source_reference
      ) order by m.created_at, o.label, o.id)
      from public.takeoff_measurement_outputs o
      join public.takeoff_measurements m
        on m.company_id = o.company_id and m.id = o.measurement_id
      join public.estimate_supplier_quote_access_items access_item
        on access_item.access_token_id = v_token.id and access_item.source_takeoff_output_id = o.id
      left join lateral (
        select l.quoted_unit_cost, l.source_reference
        from public.estimate_supplier_quote_lines l
        where l.company_id = v_token.company_id and l.quote_id = v_quote.id
          and l.source_takeoff_output_id = o.id
        order by l.created_at desc, l.id desc limit 1
      ) ql on true
      where m.company_id = v_token.company_id and m.estimate_id = v_estimate.id
        and m.status = 'active' and o.is_active = true and o.estimate_visible = true
        and o.estimate_item_type <> 'labor'
        and o.generated_estimate_item_id is not null
        and nullif(trim(o.production_unit), '') is not null
    ), '[]'::jsonb)
  );
end;
$$;$ddl$;
execute $ddl$revoke all on function public.carez_get_public_vendor_quote(uuid) from public,anon,authenticated;$ddl$;
execute $ddl$CREATE FUNCTION public.carez_guard_acceptance_resolution() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
begin
  if tg_op <> 'INSERT' then raise exception 'Acceptance resolution is immutable. Create a new Proposal revision.'; end if;
  return new;
end;
$$;$ddl$;
execute $ddl$revoke all on function public.carez_guard_acceptance_resolution() from public,anon,authenticated;$ddl$;
execute $ddl$CREATE FUNCTION public.carez_guard_change_order_item() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
declare v_status text; v_company uuid;
begin
  v_company:=case when tg_op='DELETE' then old.company_id else new.company_id end;
  if not public.carez_can_manage_commercial_changes() or v_company is distinct from public.carez_commercial_actor_company() then
    raise exception 'Commercial Change Order authority required.';
  end if;
  select co.status into v_status from public.change_orders co
    where co.id=case when tg_op='DELETE' then old.change_order_id else new.change_order_id end and co.company_id=v_company for update;
  if v_status<>'draft' then raise exception 'Only draft Change Orders can change items.'; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end
$$;$ddl$;
execute $ddl$revoke all on function public.carez_guard_change_order_item() from public,anon,authenticated;$ddl$;
execute $ddl$CREATE FUNCTION public.carez_guard_issued_estimate() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
declare v_estimate_id uuid; v_company_id uuid; v_proposal_id uuid; v_payload jsonb;
begin
  if tg_op='DELETE' then
    v_estimate_id:=old.id; v_company_id:=old.company_id;
  else
    v_estimate_id:=new.id; v_company_id:=new.company_id;
  end if;
  select p.id into v_proposal_id from public.proposal_presentations p
  where p.company_id=v_company_id and p.estimate_id=v_estimate_id limit 1;
  if v_proposal_id is null then if tg_op='DELETE' then return old; else return new; end if; end if;
  if tg_op='DELETE' then raise exception 'Issued Estimate history cannot be deleted.'; end if;
  if (to_jsonb(new)-'status'-'approved_at'-'project_id'-'updated_at') is distinct from
     (to_jsonb(old)-'status'-'approved_at'-'project_id'-'updated_at') then
    raise exception 'Issued Estimate commercial facts are immutable. Create a next revision.';
  end if;
  if new.status is distinct from old.status and not exists(
    select 1 from public.award_decisions a where a.company_id=v_company_id and a.proposal_revision_id=v_proposal_id
      and a.estimate_id=v_estimate_id and a.project_id=new.project_id
  ) then raise exception 'Issued Estimate stage can change only through its Award Decision.'; end if;
  if new.project_id is distinct from old.project_id and not exists(
    select 1 from public.award_decisions a where a.company_id=v_company_id and a.proposal_revision_id=v_proposal_id
      and a.estimate_id=v_estimate_id and a.project_id=new.project_id
  ) then raise exception 'Issued Estimate Project linkage can change only through its Award Decision.'; end if;
  if new.approved_at is distinct from old.approved_at and not exists(
    select 1 from public.award_decisions a where a.company_id=v_company_id and a.proposal_revision_id=v_proposal_id and a.estimate_id=v_estimate_id
  ) then raise exception 'Issued Estimate approval can change only through its Award Decision.'; end if;
  return new;
end
$$;$ddl$;
execute $ddl$revoke all on function public.carez_guard_issued_estimate() from public,anon,authenticated;$ddl$;
execute $ddl$CREATE FUNCTION public.carez_guard_issued_estimate_child() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
declare v_payload jsonb; v_company_id uuid; v_estimate_id uuid;
begin
  v_payload:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_company_id:=(v_payload->>'company_id')::uuid; v_estimate_id:=(v_payload->>'estimate_id')::uuid;
  if exists(select 1 from public.proposal_presentations p where p.company_id=v_company_id and p.estimate_id=v_estimate_id) then
    raise exception 'Issued Estimate scope and Proposal terms are immutable. Create a next revision.';
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end
$$;$ddl$;
execute $ddl$revoke all on function public.carez_guard_issued_estimate_child() from public,anon,authenticated;$ddl$;
execute $ddl$CREATE FUNCTION public.carez_guard_takeoff_sheet_metadata() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
declare
  v_set_status text;
  v_estimate_status text;
  v_estimate_id uuid;
begin
  if new.id is distinct from old.id
    or new.company_id is distinct from old.company_id
    or new.takeoff_set_id is distinct from old.takeoff_set_id
    or new.page_number is distinct from old.page_number then
    raise exception 'Drawing sheet page identity cannot be changed.';
  end if;

  if new.sheet_number is not distinct from old.sheet_number
    and new.title is not distinct from old.title then
    return new;
  end if;

  if auth.uid() is null
    or new.company_id is distinct from public.get_my_company_id()
    or public.get_my_role() = 'employee' then
    raise exception 'Takeoff editing authority required to change a sheet label.';
  end if;
  if (new.sheet_number is not null and
      (length(btrim(new.sheet_number)) = 0 or length(new.sheet_number) > 80 or new.sheet_number <> btrim(new.sheet_number)))
    or (new.title is not null and
      (length(btrim(new.title)) = 0 or length(new.title) > 180 or new.title <> btrim(new.title))) then
    raise exception 'Sheet number or title is invalid.';
  end if;

  select ts.status, ts.estimate_id, e.status
    into v_set_status, v_estimate_id, v_estimate_status
    from public.takeoff_sets ts
    join public.estimates e on e.id = ts.estimate_id and e.company_id = ts.company_id
    where ts.id = new.takeoff_set_id and ts.company_id = new.company_id
    for update of ts, e;
  if not found or v_set_status <> 'active' or v_estimate_status in ('accepted', 'approved', 'superseded') then
    raise exception 'This takeoff revision is locked.';
  end if;
  if exists (
    select 1 from public.proposal_presentations p
    where p.company_id = new.company_id and p.estimate_id = v_estimate_id
  ) then
    raise exception 'This estimate revision was already issued.';
  end if;
  return new;
end
$$;$ddl$;
execute $ddl$revoke all on function public.carez_guard_takeoff_sheet_metadata() from public,anon,authenticated;$ddl$;
execute $ddl$CREATE FUNCTION public.carez_immutable_change_order_event() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
begin raise exception 'Change Order history is append-only.'; end
$$;$ddl$;
execute $ddl$revoke all on function public.carez_immutable_change_order_event() from public,anon,authenticated;$ddl$;
execute $ddl$CREATE FUNCTION public.carez_immutable_commercial_delta() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
begin raise exception 'Approved commercial Change Order evidence is immutable.'; end
$$;$ddl$;
execute $ddl$revoke all on function public.carez_immutable_commercial_delta() from public,anon,authenticated;$ddl$;
execute $ddl$CREATE FUNCTION public.carez_immutable_commercial_record() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$ begin raise exception '% records are immutable.',tg_table_name; end $$;$ddl$;
execute $ddl$revoke all on function public.carez_immutable_commercial_record() from public,anon,authenticated;$ddl$;
execute $ddl$CREATE FUNCTION public.carez_immutable_takeoff_sheet_metadata_event() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
begin
  raise exception 'Sheet metadata history is append-only.';
end
$$;$ddl$;
execute $ddl$revoke all on function public.carez_immutable_takeoff_sheet_metadata_event() from public,anon,authenticated;$ddl$;
execute $ddl$CREATE FUNCTION public.carez_list_approved_change_order_references(p_project_id uuid DEFAULT NULL::uuid) RETURNS TABLE(id uuid, project_id uuid, co_number text, title text, status text, field_work_status text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
declare
  v_company uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  v_company:=public.carez_commercial_actor_company();
  if v_company is null then
    raise exception 'Company profile missing.';
  end if;

  if p_project_id is not null and not exists(
    select 1 from public.projects p where p.id=p_project_id and p.company_id=v_company
  ) then
    raise exception 'Project not found.';
  end if;

  return query
    select co.id,co.project_id,co.co_number,co.title,co.status,co.field_work_status
    from public.change_orders co
    where co.company_id=v_company
      and co.status='approved'
      and (p_project_id is null or co.project_id=p_project_id)
    order by co.co_number;
end
$$;$ddl$;
execute $ddl$revoke all on function public.carez_list_approved_change_order_references(uuid) from public,anon,authenticated;$ddl$;
execute $ddl$CREATE FUNCTION public.carez_preserve_awarded_project_contract_value() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
begin
  if old.award_decision_id is not null and new.contract_value is distinct from old.contract_value then
    raise exception 'Original Award contract_value is immutable; approved changes are appended separately.';
  end if;
  return new;
end
$$;$ddl$;
execute $ddl$revoke all on function public.carez_preserve_awarded_project_contract_value() from public,anon,authenticated;$ddl$;
execute $ddl$CREATE FUNCTION public.carez_protect_issued_proposal_delete() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$ begin raise exception 'Issued Proposal history cannot be deleted.'; end $$;$ddl$;
execute $ddl$revoke all on function public.carez_protect_issued_proposal_delete() from public,anon,authenticated;$ddl$;
execute $ddl$CREATE FUNCTION public.carez_protect_proposal_commercial_snapshot() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  if new.internal_commercial_snapshot is distinct from old.internal_commercial_snapshot
     or (old.job_spine_id is not null and new.job_spine_id is distinct from old.job_spine_id)
     or (old.parent_revision_id is not null and new.parent_revision_id is distinct from old.parent_revision_id) then
    raise exception 'Issued Proposal commercial evidence and lineage are immutable.';
  end if;
  return new;
end
$$;$ddl$;
execute $ddl$revoke all on function public.carez_protect_proposal_commercial_snapshot() from public,anon,authenticated;$ddl$;
execute $ddl$CREATE FUNCTION public.carez_resolve_proposal_acceptance(p_proposal_revision_id uuid, p_decision_mode text, p_scope_resolution jsonb, p_alternate_resolution jsonb DEFAULT '[]'::jsonb, p_allowances jsonb DEFAULT '[]'::jsonb, p_unit_prices jsonb DEFAULT '[]'::jsonb, p_inclusions jsonb DEFAULT '[]'::jsonb, p_exclusions jsonb DEFAULT '[]'::jsonb, p_clarifications jsonb DEFAULT '[]'::jsonb, p_terms jsonb DEFAULT '{}'::jsonb, p_evidence jsonb DEFAULT '{}'::jsonb, p_effective_direct_cost numeric DEFAULT NULL::numeric, p_effective_sell numeric DEFAULT NULL::numeric) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'auth', 'extensions'
    AS $$
declare
  v_company uuid := public.get_my_company_id();
  v_actor uuid := auth.uid();
  v_proposal public.proposal_presentations%rowtype;
  v_item jsonb;
  v_items jsonb;
  v_existing public.proposal_acceptance_resolutions%rowtype;
  v_resolution_id uuid;
  v_fingerprint text;
begin
  if v_actor is null or v_company is null or public.get_my_role() = 'employee' then raise exception 'Owner or office access required.'; end if;
  if p_decision_mode not in ('full','partial','negotiated') then raise exception 'Acceptance decision mode must be full, partial, or negotiated.'; end if;
  if jsonb_typeof(coalesce(p_scope_resolution,'[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_alternate_resolution,'[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_allowances,'[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_unit_prices,'[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_inclusions,'[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_exclusions,'[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_clarifications,'[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_terms,'{}'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_evidence,'{}'::jsonb)) <> 'object' then
    raise exception 'Acceptance resolution facts must use the governed array/object shapes.';
  end if;
  if nullif(trim(coalesce(p_evidence->>'source_reference','')),'') is null then raise exception 'Acceptance evidence reference is required.'; end if;
  if p_effective_direct_cost is null or p_effective_direct_cost < 0 or p_effective_sell is null or p_effective_sell < 0 then raise exception 'Effective Direct Cost and Sell are required and cannot be negative.'; end if;

  select * into v_proposal from public.proposal_presentations where id = p_proposal_revision_id and company_id = v_company for update;
  if not found then raise exception 'Proposal revision not found.'; end if;
  if v_proposal.status not in ('sent','viewed','needs_reply','accepted') or v_proposal.response_state in ('question','change_requested','option_interest','declined') then raise exception 'Proposal revision is not eligible for acceptance resolution.'; end if;
  if v_proposal.internal_commercial_snapshot is null then raise exception 'Issued Proposal is missing frozen internal commercial evidence.'; end if;

  if p_decision_mode = 'partial' and jsonb_array_length(coalesce(p_scope_resolution,'[]'::jsonb)) = 0 then raise exception 'Partial acceptance requires at least one scope resolution.'; end if;
  v_items := coalesce(v_proposal.internal_commercial_snapshot->'items','[]'::jsonb);
  for v_item in select value from jsonb_array_elements(coalesce(p_scope_resolution,'[]'::jsonb)) loop
    if nullif(trim(v_item->>'estimate_item_id'),'') is null then raise exception 'Each scope resolution requires an Estimate item ID.'; end if;
    if jsonb_typeof(v_item->'included') <> 'boolean' then raise exception 'Each scope resolution requires an explicit included decision.'; end if;
    if not exists (select 1 from jsonb_array_elements(v_items) source where source->>'id' = v_item->>'estimate_item_id') then raise exception 'Acceptance resolution references an item outside the issued Proposal snapshot.'; end if;
    if v_item ? 'accepted_quantity' and (jsonb_typeof(v_item->'accepted_quantity') <> 'number' or (v_item->>'accepted_quantity')::numeric < 0) then raise exception 'Accepted quantity must be a nonnegative number.'; end if;
    if v_item ? 'accepted_unit_price' and (jsonb_typeof(v_item->'accepted_unit_price') <> 'number' or (v_item->>'accepted_unit_price')::numeric < 0) then raise exception 'Accepted unit price must be a nonnegative number.'; end if;
  end loop;

  select * into v_existing from public.proposal_acceptance_resolutions where company_id=v_company and proposal_revision_id=p_proposal_revision_id;
  if found then
    return jsonb_build_object('resolution_id',v_existing.id,'proposal_revision_id',p_proposal_revision_id,'already_resolved',true);
  end if;
  v_fingerprint := encode(extensions.digest(convert_to(jsonb_build_object('proposal_revision_id',p_proposal_revision_id,'decision_mode',p_decision_mode,'scope_resolution',coalesce(p_scope_resolution,'[]'::jsonb),'alternate_resolution',coalesce(p_alternate_resolution,'[]'::jsonb),'allowances',coalesce(p_allowances,'[]'::jsonb),'unit_prices',coalesce(p_unit_prices,'[]'::jsonb),'inclusions',coalesce(p_inclusions,'[]'::jsonb),'exclusions',coalesce(p_exclusions,'[]'::jsonb),'clarifications',coalesce(p_clarifications,'[]'::jsonb),'terms',coalesce(p_terms,'{}'::jsonb),'evidence',p_evidence,'effective_direct_cost',p_effective_direct_cost,'effective_sell',p_effective_sell)::text,'utf8'),'sha256'),'hex');
  insert into public.proposal_acceptance_resolutions(company_id,proposal_revision_id,decision_mode,scope_resolution,alternate_resolution,allowances,unit_prices,inclusions,exclusions,clarifications,terms,evidence,effective_direct_cost,effective_sell,source_fingerprint,resolved_by)
  values(v_company,p_proposal_revision_id,p_decision_mode,coalesce(p_scope_resolution,'[]'::jsonb),coalesce(p_alternate_resolution,'[]'::jsonb),coalesce(p_allowances,'[]'::jsonb),coalesce(p_unit_prices,'[]'::jsonb),coalesce(p_inclusions,'[]'::jsonb),coalesce(p_exclusions,'[]'::jsonb),coalesce(p_clarifications,'[]'::jsonb),coalesce(p_terms,'{}'::jsonb),p_evidence,p_effective_direct_cost,p_effective_sell,v_fingerprint,v_actor)
  returning id into v_resolution_id;
  return jsonb_build_object('resolution_id',v_resolution_id,'proposal_revision_id',p_proposal_revision_id,'already_resolved',false,'source_fingerprint',v_fingerprint);
end;
$$;$ddl$;
execute $ddl$revoke all on function public.carez_resolve_proposal_acceptance(uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, numeric, numeric) from public,anon,authenticated;$ddl$;
execute $ddl$CREATE FUNCTION public.carez_save_unmeasured_condition_draft(p_condition_version_id uuid, p_inputs jsonb, p_input_provenance jsonb, p_modules jsonb) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_company uuid := public.get_my_company_id();
  v_version public.project_concrete_condition_versions%rowtype;
  v_set public.takeoff_sets%rowtype;
  v_estimate_status text;
  v_module jsonb;
begin
  if v_company is null or public.get_my_role() = 'employee' then
    raise exception 'Office access required.';
  end if;
  if jsonb_typeof(p_inputs) is distinct from 'object'
     or jsonb_typeof(p_input_provenance) is distinct from 'object'
     or jsonb_typeof(p_modules) is distinct from 'array' then
    raise exception 'Condition draft inputs, provenance, and modules are required.';
  end if;

  select * into v_version
  from public.project_concrete_condition_versions
  where id = p_condition_version_id and company_id = v_company
  for update;
  if not found or v_version.status <> 'draft' then
    raise exception 'Editable Condition draft not found.';
  end if;

  select takeoff_set.* into v_set
  from public.project_concrete_conditions condition
  join public.takeoff_sets takeoff_set
    on takeoff_set.id = condition.takeoff_set_id and takeoff_set.company_id = condition.company_id
  where condition.id = v_version.condition_id and condition.company_id = v_company;
  if not found or v_set.status <> 'active' then
    raise exception 'Active takeoff set not found.';
  end if;
  select status into v_estimate_status
  from public.estimates where id = v_set.estimate_id and company_id = v_company;
  if v_estimate_status is null or v_estimate_status in ('accepted','approved','superseded')
     or exists(select 1 from public.proposal_presentations
               where estimate_id = v_set.estimate_id and company_id = v_company) then
    raise exception 'This estimate revision is locked.';
  end if;

  if exists(select 1 from public.project_concrete_conditions
            where id = v_version.condition_id and company_id = v_company
              and compatibility_projection_version_id = v_version.id)
     or exists(select 1 from public.project_condition_measurement_roles
               where condition_version_id = v_version.id and company_id = v_company)
     or exists(select 1 from public.project_condition_outputs
               where condition_version_id = v_version.id and company_id = v_company) then
    raise exception 'Use the atomic Condition calculation action after linking a takeoff.';
  end if;

  update public.project_concrete_condition_versions set
    plan_facts = coalesce(p_inputs->'planFacts','{}'::jsonb),
    method_inputs = coalesce(p_inputs->'methods','{}'::jsonb),
    production_inputs = coalesce(p_inputs->'production','{}'::jsonb),
    commercial_inputs = coalesce(p_inputs->'commercial','{}'::jsonb),
    drawing_inputs = coalesce(p_inputs->'drawing','{}'::jsonb),
    input_provenance = p_input_provenance
  where id = v_version.id and company_id = v_company;

  delete from public.project_condition_module_instances
  where condition_version_id = v_version.id and company_id = v_company;

  for v_module in select value from jsonb_array_elements(p_modules) loop
    insert into public.project_condition_module_instances(
      company_id,condition_version_id,module_key,instance_key,label,enabled,
      input_values,input_provenance,legacy_child_key,sort_order,created_by
    ) values (
      v_company,v_version.id,v_module->>'moduleKey',coalesce(nullif(v_module->>'instanceKey',''),'default'),
      v_module->>'label',coalesce((v_module->>'enabled')::boolean,true),
      coalesce(v_module->'inputValues','{}'::jsonb),coalesce(v_module->'inputProvenance','{}'::jsonb),
      nullif(v_module->>'legacyChildKey',''),coalesce((v_module->>'sortOrder')::integer,0),auth.uid()
    );
  end loop;
end;
$$;$ddl$;
execute $ddl$revoke all on function public.carez_save_unmeasured_condition_draft(uuid, jsonb, jsonb, jsonb) from public,anon,authenticated;$ddl$;
execute $ddl$CREATE FUNCTION public.carez_submit_public_vendor_quote_line(p_token uuid, p_output_id uuid, p_unit_cost numeric, p_source_reference text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
declare
  v_token public.estimate_supplier_quote_access_tokens%rowtype;
  v_quote public.estimate_supplier_quotes%rowtype;
  v_set public.estimate_supplier_quote_sets%rowtype;
  v_estimate public.estimates%rowtype;
  v_output public.takeoff_measurement_outputs%rowtype;
  v_line_id uuid;
  v_prior_cost numeric;
begin
  if p_unit_cost is null or p_unit_cost < 0 or p_unit_cost > 1000000000 then
    raise exception 'Enter a valid unit price.';
  end if;
  if length(coalesce(p_source_reference, '')) > 250 then
    raise exception 'Reference is too long.';
  end if;
  select * into v_token from public.estimate_supplier_quote_access_tokens
    where token = p_token and revoked_at is null and expires_at > now()
    for update;
  if not found then return false; end if;
  select * into v_quote from public.estimate_supplier_quotes
    where id = v_token.quote_id and company_id = v_token.company_id for update;
  if not found or v_quote.status in ('declined', 'selected') then return false; end if;
  select * into v_set from public.estimate_supplier_quote_sets
    where id = v_quote.quote_set_id and company_id = v_token.company_id;
  if not found or v_set.status = 'archived' then return false; end if;
  select * into v_estimate from public.estimates
    where id = v_set.estimate_id and company_id = v_token.company_id for update;
  if not found or v_estimate.status in ('accepted', 'approved', 'superseded')
    or (v_quote.expires_at is not null and v_quote.expires_at < current_date)
    or exists (select 1 from public.proposal_presentations p
      where p.company_id = v_token.company_id and p.estimate_id = v_estimate.id)
  then return false; end if;
  select o.* into v_output from public.takeoff_measurement_outputs o
    join public.takeoff_measurements m
      on m.company_id = o.company_id and m.id = o.measurement_id
    join public.estimate_supplier_quote_access_items access_item
      on access_item.access_token_id = v_token.id and access_item.source_takeoff_output_id = o.id
    where o.id = p_output_id and o.company_id = v_token.company_id
      and m.estimate_id = v_estimate.id and m.status = 'active'
      and o.is_active = true and o.estimate_visible = true
      and o.estimate_item_type <> 'labor'
      and o.generated_estimate_item_id is not null
      and nullif(trim(o.production_unit), '') is not null
    for update of o;
  if not found then return false; end if;
  select quoted_unit_cost into v_prior_cost from public.estimate_supplier_quote_lines
    where company_id = v_token.company_id and quote_id = v_quote.id
      and source_takeoff_output_id = v_output.id
    order by created_at desc, id desc limit 1;
  -- Each submission is new evidence. Never rewrite a line the office may have selected.
  insert into public.estimate_supplier_quote_lines (
    company_id, quote_id, source_takeoff_output_id, generated_estimate_item_id,
    catalog_item_id, description, quoted_unit, quoted_unit_cost, source_reference
  ) values (
    v_token.company_id, v_quote.id, v_output.id, v_output.generated_estimate_item_id,
    v_output.catalog_item_id, coalesce(nullif(trim(v_output.label), ''), 'Supplier quoted resource'),
    v_output.production_unit, p_unit_cost, nullif(trim(p_source_reference), '')
  ) returning id into v_line_id;
  if v_quote.status = 'requested' then
    update public.estimate_supplier_quotes
      set status = 'received', updated_at = now()
      where id = v_quote.id and company_id = v_token.company_id;
  end if;
  insert into public.estimate_supplier_quote_submission_events (
    company_id, quote_id, access_token_id, quote_line_id,
    source_takeoff_output_id, output_label, prior_unit_cost, quoted_unit_cost
  ) values (
    v_token.company_id, v_quote.id, v_token.id, v_line_id,
    v_output.id, v_output.label, v_prior_cost, p_unit_cost
  );
  return true;
end;
$$;$ddl$;
execute $ddl$revoke all on function public.carez_submit_public_vendor_quote_line(uuid, uuid, numeric, text) from public,anon,authenticated;$ddl$;
execute $ddl$CREATE FUNCTION public.carez_transition_change_order(p_change_order_id uuid, p_transition text, p_note text DEFAULT NULL::text, p_authorization_kind text DEFAULT NULL::text, p_authorization_reference text DEFAULT NULL::text, p_external_authorized_by text DEFAULT NULL::text, p_external_authorized_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_authorization_note text DEFAULT NULL::text, p_authorization_document_reference text DEFAULT NULL::text, p_sell_delta numeric DEFAULT NULL::numeric) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
declare v_company uuid; v_co public.change_orders%rowtype; v_to text; v_sell numeric; v_original_sell numeric;
begin
  v_company:=public.carez_commercial_actor_company();
  if auth.uid() is null or not public.carez_can_manage_commercial_changes() then raise exception 'Owner or office authority required.'; end if;
  select * into v_co from public.change_orders where id=p_change_order_id and company_id=v_company for update;
  if not found then raise exception 'Change Order not found.'; end if;
  v_to:=case p_transition when 'submit' then 'submitted' when 'return_to_draft' then 'draft' when 'reject' then 'rejected' when 'void' then 'void' else null end;
  if v_to is null or not ((v_co.status='draft' and v_to in ('submitted','void')) or (v_co.status='submitted' and v_to in ('draft','rejected','void'))) then
    raise exception 'Invalid Change Order transition.';
  end if;
  if v_to='submitted' then
    if not exists(select 1 from public.change_order_items i where i.company_id=v_company and i.change_order_id=v_co.id) then raise exception 'Add at least one item before submission.'; end if;
    v_sell:=p_sell_delta;
    if v_sell is null then select recommended_sell_price into v_sell from public.change_order_financial_summary where change_order_id=v_co.id; end if;
    if v_sell is null then raise exception 'Selected Sell delta is required.'; end if;
    if (v_co.change_type='additive' and v_sell<0) or (v_co.change_type='deductive' and v_sell>0) or (v_co.change_type='no_cost' and v_sell<>0) then raise exception 'Sell delta sign does not match Change Order type.'; end if;
    if v_co.reversal_of_change_order_id is not null then
      select d.sell_delta into v_original_sell from public.approved_commercial_deltas d
        where d.company_id=v_company and d.change_order_id=v_co.reversal_of_change_order_id;
      if not found or v_sell<>-v_original_sell then raise exception 'Reversal Change Order Sell must exactly offset the original approved Sell delta.'; end if;
    end if;
    if p_authorization_kind in ('external_customer','external_gc') then
      if nullif(btrim(p_authorization_reference),'') is null or nullif(btrim(p_external_authorized_by),'') is null or p_external_authorized_at is null then raise exception 'External authorization evidence is incomplete.'; end if;
    elsif p_authorization_kind='internal_no_cost' then
      if v_co.change_type<>'no_cost' or v_sell<>0 or nullif(btrim(p_authorization_note),'') is null then raise exception 'Internal no-cost basis requires documented zero-Sell internal exposure.'; end if;
    else raise exception 'Select documented external authorization or the permitted internal no-cost basis.'; end if;
    update public.change_orders set status='submitted',submitted_at=now(),proposed_sell_price=v_sell,
      authorization_kind=p_authorization_kind,authorization_reference=nullif(btrim(p_authorization_reference),''),
      external_authorized_by=nullif(btrim(p_external_authorized_by),''),external_authorized_at=p_external_authorized_at,
      authorization_note=nullif(btrim(p_authorization_note),''),authorization_document_reference=nullif(btrim(p_authorization_document_reference),''),updated_at=now()
    where id=v_co.id and company_id=v_company;
  else
    update public.change_orders set status=v_to,updated_at=now(),
      rejected_at=case when v_to='rejected' then now() else rejected_at end,
      voided_at=case when v_to='void' then now() else voided_at end
    where id=v_co.id and company_id=v_company;
  end if;
  insert into public.change_order_events(company_id,project_id,change_order_id,from_status,to_status,actor_id,note,evidence)
  values(v_company,v_co.project_id,v_co.id,v_co.status,v_to,auth.uid(),nullif(btrim(p_note),''),
    case when v_to='submitted' then jsonb_build_object('authorization_kind',p_authorization_kind,'authorization_reference',p_authorization_reference,
      'external_authorized_by',p_external_authorized_by,'external_authorized_at',p_external_authorized_at,
      'authorization_note',p_authorization_note,'authorization_document_reference',p_authorization_document_reference) else jsonb_build_object('transition',p_transition) end);
  return jsonb_build_object('change_order_id',v_co.id,'status',v_to);
end
$$;$ddl$;
execute $ddl$revoke all on function public.carez_transition_change_order(uuid, text, text, text, text, text, timestamp with time zone, text, text, numeric) from public,anon,authenticated;$ddl$;
execute $ddl$CREATE FUNCTION public.carez_update_change_order(p_change_order_id uuid, p_values jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
declare v_company uuid; v_status text; v_change_type text; v_sell numeric;
begin
  v_company:=public.carez_commercial_actor_company();
  if auth.uid() is null or not public.carez_can_manage_commercial_changes() then raise exception 'Owner or office authority required.'; end if;
  select status,change_type into v_status,v_change_type from public.change_orders
    where id=p_change_order_id and company_id=v_company for update;
  if not found or v_status<>'draft' then raise exception 'Only draft Change Orders can be edited.'; end if;
  v_sell:=nullif(p_values->>'proposed_sell_price','')::numeric;
  if v_sell is not null and ((v_change_type='additive' and v_sell<0) or (v_change_type='deductive' and v_sell>0) or (v_change_type='no_cost' and v_sell<>0)) then
    raise exception 'Sell delta sign does not match Change Order type.';
  end if;
  update public.change_orders set target_margin_percent=coalesce((p_values->>'target_margin_percent')::numeric,target_margin_percent),
    payment_processing_rate_percent=coalesce((p_values->>'payment_processing_rate_percent')::numeric,payment_processing_rate_percent),
    proposed_sell_price=v_sell,
    field_work_status=coalesce(nullif(p_values->>'field_work_status',''),field_work_status),updated_at=now()
  where id=p_change_order_id and company_id=v_company;
end
$$;$ddl$;
execute $ddl$revoke all on function public.carez_update_change_order(uuid, jsonb) from public,anon,authenticated;$ddl$;
execute $ddl$CREATE FUNCTION public.carez_validate_supplier_quote_access_item() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
begin
  if not exists (
    select 1 from public.estimate_supplier_quote_access_tokens t
    join public.estimate_supplier_quotes q
      on q.id = t.quote_id and q.company_id = t.company_id
    join public.estimate_supplier_quote_sets s
      on s.id = q.quote_set_id and s.company_id = t.company_id
    join public.takeoff_measurement_outputs o
      on o.id = new.source_takeoff_output_id and o.company_id = t.company_id
    join public.takeoff_measurements m
      on m.id = o.measurement_id and m.company_id = t.company_id
    where t.id = new.access_token_id and t.company_id = new.company_id
      and m.estimate_id = s.estimate_id
      and m.status = 'active' and o.is_active = true and o.estimate_visible = true
      and o.estimate_item_type <> 'labor' and o.generated_estimate_item_id is not null
      and nullif(trim(o.production_unit), '') is not null
  ) then
    raise exception 'Supplier link resource must belong to this estimate revision.';
  end if;
  return new;
end;
$$;$ddl$;
execute $ddl$revoke all on function public.carez_validate_supplier_quote_access_item() from public,anon,authenticated;$ddl$;
execute $ddl$CREATE FUNCTION public.submit_public_proposal_ready_intent(p_token uuid, p_name text, p_email text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
declare
  v_token public.proposal_access_tokens%rowtype;
  v_presentation public.proposal_presentations%rowtype;
  v_name text:=nullif(trim(coalesce(p_name,'')), '');
  v_email text:=nullif(trim(coalesce(p_email,'')), '');
begin
  if v_name is null or v_email is null then
    raise exception 'Name and email are required to send your response.';
  end if;

  select * into v_token from public.proposal_access_tokens
    where token=p_token and revoked_at is null and (expires_at is null or expires_at>now());
  if not found then return false; end if;

  select * into v_presentation from public.proposal_presentations
    where proposal_access_token_id=v_token.id for update;
  if not found or v_presentation.status not in ('sent','viewed','needs_reply') then
    raise exception 'This proposal is no longer open for responses.';
  end if;
  if exists(select 1 from public.proposal_acceptances where estimate_id=v_presentation.estimate_id) then
    raise exception 'This proposal has already been accepted.';
  end if;

  if v_presentation.response_state='ready_to_proceed' then
    return true;
  end if;

  insert into public.proposal_engagement_events
    (company_id,presentation_id,event_type,customer_name,customer_email)
    values(v_presentation.company_id,v_presentation.id,'ready_to_proceed',v_name,v_email);
  update public.proposal_presentations set response_state='ready_to_proceed',
    status='needs_reply',last_response_at=now(),updated_at=now()
    where id=v_presentation.id and company_id=v_presentation.company_id;

  if v_presentation.lead_id is not null then
    update public.leads set status='follow_up',follow_up=current_date,updated_at=now()
      where id=v_presentation.lead_id and company_id=v_presentation.company_id
        and status not in ('won','lost');
    insert into public.lead_activities(company_id,lead_id,activity_type,note,next_follow_up)
      values(v_presentation.company_id,v_presentation.lead_id,'proposal_response',
        'Customer is ready to proceed with '||v_presentation.proposal_number,current_date);
  end if;
  return true;
end;
$$;$ddl$;
execute $ddl$revoke all on function public.submit_public_proposal_ready_intent(uuid, text, text) from public,anon,authenticated;$ddl$;
execute $ddl$CREATE FUNCTION public.sync_project_award_record() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
begin
  insert into public.project_award_records(company_id,project_id,award_decision_id,agreement_number,proposal_number,original_contract_value,accepted_at,authorization_text)
  select new.company_id,new.project_id,new.id,
    'AWD-'||upper(substr(new.id::text,1,8)),pp.proposal_number,p.contract_value,new.decided_at,
    coalesce(new.evidence_reference,'Accepted exact Proposal revision')
  from public.projects p left join public.proposal_presentations pp on pp.company_id=new.company_id and pp.id=new.proposal_revision_id
  where p.company_id=new.company_id and p.id=new.project_id
  on conflict(company_id,project_id) do nothing;
  if not exists(select 1 from public.project_award_records where company_id=new.company_id and project_id=new.project_id and award_decision_id=new.id) then raise exception 'Existing agreement authority conflicts with this Award. Historical agreement retained; review its lineage before adoption.';end if;
  return new;
end;
$$;$ddl$;
execute $ddl$revoke all on function public.sync_project_award_record() from public,anon,authenticated;$ddl$;
execute $ddl$CREATE VIEW public.commercial_baseline_item_references WITH (security_invoker='true') AS
 SELECT b.company_id,
    cb.project_id,
    b.id,
    COALESCE((b.source_facts ->> 'description'::text), 'Accepted scope item'::text) AS description,
    b.quantity,
    b.unit,
    b.direct_cost,
    b.sell_amount
   FROM (public.commercial_baseline_items b
     JOIN public.commercial_baselines cb ON (((cb.company_id = b.company_id) AND (cb.id = b.baseline_id))))
  WHERE (public.carez_can_manage_commercial_changes() AND (b.company_id = public.carez_commercial_actor_company()));$ddl$;
execute $ddl$CREATE VIEW public.project_authorized_contract_summary WITH (security_invoker='true') AS
 SELECT p.company_id,
    p.id AS project_id,
    b.id AS commercial_baseline_id,
    b.total_sell AS original_contract_value,
    (b.total_sell + COALESCE(sum(d.sell_delta), (0)::numeric)) AS authorized_contract_value
   FROM ((public.projects p
     JOIN public.commercial_baselines b ON (((b.company_id = p.company_id) AND (b.project_id = p.id) AND (b.baseline_kind = 'original_award'::text))))
     LEFT JOIN public.approved_commercial_deltas d ON (((d.company_id = p.company_id) AND (d.project_id = p.id))))
  WHERE (public.carez_can_manage_commercial_changes() AND (p.company_id = public.carez_commercial_actor_company()))
  GROUP BY p.company_id, p.id, b.id, b.total_sell;$ddl$;
execute $ddl$CREATE VIEW public.project_startup_readiness WITH (security_invoker='true') AS
 WITH scheduled AS (
         SELECT s.company_id,
            s.project_id,
            min(s.schedule_date) AS next_work_date,
            (count(DISTINCT a.crew_member_id))::integer AS crew_assigned_count
           FROM (public.work_schedule_items s
             LEFT JOIN public.work_schedule_assignments a ON (((a.company_id = s.company_id) AND (a.schedule_item_id = s.id))))
          WHERE (s.status <> 'cancelled'::text)
          GROUP BY s.company_id, s.project_id
        ), manual AS (
         SELECT project_startup_items.company_id,
            project_startup_items.project_id,
            (count(*))::integer AS manual_count,
            (count(*) FILTER (WHERE (project_startup_items.status = 'open'::text)))::integer AS manual_open,
            (count(*) FILTER (WHERE (project_startup_items.status = ANY (ARRAY['done'::text, 'not_needed'::text]))))::integer AS manual_clear
           FROM public.project_startup_items
          GROUP BY project_startup_items.company_id, project_startup_items.project_id
        ), facts AS (
         SELECT p.company_id,
            p.id AS project_id,
            p.job_number,
            p.name,
            p.address,
            p.city,
            p.state,
            c.name AS customer_name,
            c.contact_name,
            c.phone AS customer_phone,
            c.email AS customer_email,
            (EXISTS ( SELECT 1
                   FROM public.project_award_records a
                  WHERE ((a.company_id = p.company_id) AND (a.project_id = p.id) AND (a.status = 'accepted'::text)))) AS has_awarded_budget,
            ((c.phone IS NOT NULL) OR (c.email IS NOT NULL)) AS has_customer_contact,
            ((NULLIF(btrim(COALESCE(p.address, ''::text)), ''::text) IS NOT NULL) AND (NULLIF(btrim(COALESCE(p.city, ''::text)), ''::text) IS NOT NULL)) AS has_jobsite,
            s.next_work_date,
            s.crew_assigned_count,
            COALESCE((s.next_work_date IS NOT NULL), false) AS has_work_scheduled,
            COALESCE(m.manual_count, 0) AS manual_count,
            COALESCE(m.manual_open, 0) AS manual_open,
            COALESCE(m.manual_clear, 0) AS manual_clear
           FROM (((public.projects p
             LEFT JOIN public.customers c ON (((c.company_id = p.company_id) AND (c.id = p.customer_id))))
             LEFT JOIN scheduled s ON (((s.company_id = p.company_id) AND (s.project_id = p.id))))
             LEFT JOIN manual m ON (((m.company_id = p.company_id) AND (m.project_id = p.id))))
          WHERE (p.status = ANY (ARRAY['active'::text, 'scheduled'::text, 'on_hold'::text]))
        )
 SELECT company_id,
    project_id,
    job_number,
    name,
    address,
    city,
    state,
    customer_name,
    contact_name,
    customer_phone,
    customer_email,
    has_awarded_budget,
    has_customer_contact,
    has_jobsite,
    next_work_date,
    crew_assigned_count,
    has_work_scheduled,
    manual_count,
    manual_open,
    manual_clear,
    (5 + manual_count) AS total_steps,
    (((((
        CASE
            WHEN has_awarded_budget THEN 1
            ELSE 0
        END +
        CASE
            WHEN has_customer_contact THEN 1
            ELSE 0
        END) +
        CASE
            WHEN has_jobsite THEN 1
            ELSE 0
        END) +
        CASE
            WHEN has_work_scheduled THEN 1
            ELSE 0
        END) +
        CASE
            WHEN (COALESCE(crew_assigned_count, 0) > 0) THEN 1
            ELSE 0
        END) + manual_clear) AS ready_steps,
        CASE
            WHEN (has_awarded_budget AND has_customer_contact AND has_jobsite AND has_work_scheduled AND (COALESCE(crew_assigned_count, 0) > 0) AND (manual_open = 0)) THEN 'ready'::text
            ELSE 'needs_setup'::text
        END AS readiness_status,
    NULL::date AS next_pour_date,
    NULL::text AS next_pour_name,
    NULL::text AS next_pour_status,
    0 AS open_po_count
   FROM facts f;$ddl$;
execute $ddl$CREATE TRIGGER accepted_scope_snapshot_items_immutable BEFORE DELETE OR UPDATE ON public.accepted_scope_snapshot_items FOR EACH ROW EXECUTE FUNCTION public.carez_immutable_commercial_record();$ddl$;
execute $ddl$CREATE TRIGGER accepted_scope_snapshots_immutable BEFORE DELETE OR UPDATE ON public.accepted_scope_snapshots FOR EACH ROW EXECUTE FUNCTION public.carez_immutable_commercial_record();$ddl$;
execute $ddl$CREATE TRIGGER approved_commercial_delta_items_immutable BEFORE DELETE OR UPDATE ON public.approved_commercial_delta_items FOR EACH ROW EXECUTE FUNCTION public.carez_immutable_commercial_delta();$ddl$;
execute $ddl$CREATE TRIGGER approved_commercial_deltas_immutable BEFORE DELETE OR UPDATE ON public.approved_commercial_deltas FOR EACH ROW EXECUTE FUNCTION public.carez_immutable_commercial_delta();$ddl$;
execute $ddl$CREATE TRIGGER award_decisions_immutable BEFORE DELETE OR UPDATE ON public.award_decisions FOR EACH ROW EXECUTE FUNCTION public.carez_immutable_commercial_record();$ddl$;
execute $ddl$CREATE TRIGGER capture_proposal_commercial_snapshot BEFORE INSERT ON public.proposal_presentations FOR EACH ROW EXECUTE FUNCTION public.carez_capture_proposal_commercial_snapshot();$ddl$;
execute $ddl$CREATE TRIGGER carez_audit_takeoff_sheet_metadata AFTER UPDATE OF sheet_number, title ON public.takeoff_sheets FOR EACH ROW EXECUTE FUNCTION public.carez_audit_takeoff_sheet_metadata();$ddl$;
execute $ddl$CREATE TRIGGER carez_guard_takeoff_sheet_metadata BEFORE UPDATE ON public.takeoff_sheets FOR EACH ROW EXECUTE FUNCTION public.carez_guard_takeoff_sheet_metadata();$ddl$;
execute $ddl$CREATE TRIGGER carez_immutable_takeoff_sheet_metadata_event BEFORE DELETE OR UPDATE ON public.takeoff_sheet_metadata_events FOR EACH ROW EXECUTE FUNCTION public.carez_immutable_takeoff_sheet_metadata_event();$ddl$;
execute $ddl$CREATE TRIGGER change_order_events_immutable BEFORE DELETE OR UPDATE ON public.change_order_events FOR EACH ROW EXECUTE FUNCTION public.carez_immutable_change_order_event();$ddl$;
execute $ddl$CREATE TRIGGER change_order_items_guard BEFORE INSERT OR DELETE OR UPDATE ON public.change_order_items FOR EACH ROW EXECUTE FUNCTION public.carez_guard_change_order_item();$ddl$;
execute $ddl$CREATE TRIGGER change_orders_status_event AFTER INSERT OR UPDATE ON public.change_orders FOR EACH ROW EXECUTE FUNCTION public.carez_change_order_status_event();$ddl$;
execute $ddl$CREATE TRIGGER commercial_baseline_items_immutable BEFORE DELETE OR UPDATE ON public.commercial_baseline_items FOR EACH ROW EXECUTE FUNCTION public.carez_immutable_commercial_record();$ddl$;
execute $ddl$CREATE TRIGGER commercial_baselines_immutable BEFORE DELETE OR UPDATE ON public.commercial_baselines FOR EACH ROW EXECUTE FUNCTION public.carez_immutable_commercial_record();$ddl$;
execute $ddl$CREATE TRIGGER estimates_assign_job_spine BEFORE INSERT ON public.estimates FOR EACH ROW EXECUTE FUNCTION public.carez_assign_phase_job_spine();$ddl$;
execute $ddl$CREATE TRIGGER guard_issued_estimate BEFORE DELETE OR UPDATE ON public.estimates FOR EACH ROW EXECUTE FUNCTION public.carez_guard_issued_estimate();$ddl$;
execute $ddl$CREATE TRIGGER guard_issued_estimate_items BEFORE INSERT OR DELETE OR UPDATE ON public.estimate_items FOR EACH ROW EXECUTE FUNCTION public.carez_guard_issued_estimate_child();$ddl$;
execute $ddl$CREATE TRIGGER guard_issued_estimate_sections BEFORE INSERT OR DELETE OR UPDATE ON public.estimate_sections FOR EACH ROW EXECUTE FUNCTION public.carez_guard_issued_estimate_child();$ddl$;
execute $ddl$CREATE TRIGGER guard_issued_proposal_clarifications BEFORE INSERT OR DELETE OR UPDATE ON public.proposal_clarifications FOR EACH ROW EXECUTE FUNCTION public.carez_guard_issued_estimate_child();$ddl$;
execute $ddl$CREATE TRIGGER guard_issued_proposal_options BEFORE INSERT OR DELETE OR UPDATE ON public.bid_value_options FOR EACH ROW EXECUTE FUNCTION public.carez_guard_issued_estimate_child();$ddl$;
execute $ddl$CREATE TRIGGER guard_issued_proposal_settings BEFORE INSERT OR DELETE OR UPDATE ON public.proposal_settings FOR EACH ROW EXECUTE FUNCTION public.carez_guard_issued_estimate_child();$ddl$;
execute $ddl$CREATE TRIGGER job_spines_updated_at BEFORE UPDATE ON public.job_spines FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();$ddl$;
execute $ddl$CREATE TRIGGER leads_assign_job_spine BEFORE INSERT ON public.leads FOR EACH ROW EXECUTE FUNCTION public.carez_assign_phase_job_spine();$ddl$;
execute $ddl$CREATE TRIGGER project_startup_items_updated_at BEFORE UPDATE ON public.project_startup_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();$ddl$;
execute $ddl$CREATE TRIGGER projects_assign_job_spine BEFORE INSERT ON public.projects FOR EACH ROW EXECUTE FUNCTION public.carez_assign_phase_job_spine();$ddl$;
execute $ddl$CREATE TRIGGER projects_preserve_awarded_contract_value BEFORE UPDATE OF contract_value ON public.projects FOR EACH ROW EXECUTE FUNCTION public.carez_preserve_awarded_project_contract_value();$ddl$;
execute $ddl$CREATE TRIGGER proposal_acceptance_resolutions_immutable BEFORE DELETE OR UPDATE ON public.proposal_acceptance_resolutions FOR EACH ROW EXECUTE FUNCTION public.carez_guard_acceptance_resolution();$ddl$;
execute $ddl$CREATE TRIGGER protect_issued_proposal_delete BEFORE DELETE ON public.proposal_presentations FOR EACH ROW EXECUTE FUNCTION public.carez_protect_issued_proposal_delete();$ddl$;
execute $ddl$CREATE TRIGGER protect_proposal_commercial_snapshot BEFORE UPDATE ON public.proposal_presentations FOR EACH ROW EXECUTE FUNCTION public.carez_protect_proposal_commercial_snapshot();$ddl$;
execute $ddl$CREATE TRIGGER sync_project_award_record_after_insert AFTER INSERT ON public.award_decisions FOR EACH ROW EXECUTE FUNCTION public.sync_project_award_record();$ddl$;
execute $ddl$CREATE TRIGGER validate_supplier_quote_access_item BEFORE INSERT OR UPDATE ON public.estimate_supplier_quote_access_items FOR EACH ROW EXECUTE FUNCTION public.carez_validate_supplier_quote_access_item();$ddl$;
execute $ddl$alter table public.leads alter column job_spine_id set not null;$ddl$;
execute $ddl$alter table public.estimates alter column job_spine_id set not null;$ddl$;
execute $ddl$alter table public.proposal_presentations alter column job_spine_id set not null;$ddl$;
execute $ddl$alter table public.projects alter column job_spine_id set not null;$ddl$;
execute $ddl$alter table public.proposal_engagement_events drop constraint proposal_engagement_events_event_type_check;alter table public.proposal_engagement_events add constraint proposal_engagement_events_event_type_check check (event_type in ('view','question','change_request','option_interest','ready_to_proceed','decline','accept'));$ddl$;
execute $ddl$alter table public.proposal_presentations drop constraint proposal_presentations_response_state_check;alter table public.proposal_presentations add constraint proposal_presentations_response_state_check check (response_state in ('none','question','change_requested','option_interest','ready_to_proceed','declined','accepted'));$ddl$;
execute $ddl$revoke all on table public.accepted_scope_snapshot_items from public,anon,authenticated;$ddl$;
execute $ddl$revoke all on table public.accepted_scope_snapshots from public,anon,authenticated;$ddl$;
execute $ddl$revoke all on table public.approved_commercial_delta_items from public,anon,authenticated;$ddl$;
execute $ddl$revoke all on table public.approved_commercial_deltas from public,anon,authenticated;$ddl$;
execute $ddl$revoke all on table public.award_decisions from public,anon,authenticated;$ddl$;
execute $ddl$revoke all on table public.change_order_events from public,anon,authenticated;$ddl$;
execute $ddl$revoke all on table public.change_order_number_sequences from public,anon,authenticated;$ddl$;
execute $ddl$revoke all on table public.commercial_baseline_item_references from public,anon,authenticated;$ddl$;
execute $ddl$revoke all on table public.commercial_baseline_items from public,anon,authenticated;$ddl$;
execute $ddl$revoke all on table public.commercial_baselines from public,anon,authenticated;$ddl$;
execute $ddl$revoke all on table public.company_invoice_number_sequences from public,anon,authenticated;$ddl$;
execute $ddl$revoke all on table public.cost_catalog_categories from public,anon,authenticated;$ddl$;
execute $ddl$revoke all on table public.estimate_supplier_quote_access_items from public,anon,authenticated;$ddl$;
execute $ddl$revoke all on table public.estimate_supplier_quote_access_tokens from public,anon,authenticated;$ddl$;
execute $ddl$revoke all on table public.estimate_supplier_quote_submission_events from public,anon,authenticated;$ddl$;
execute $ddl$revoke all on table public.job_number_sequences from public,anon,authenticated;$ddl$;
execute $ddl$revoke all on table public.job_spine_migration_reviews from public,anon,authenticated;$ddl$;
execute $ddl$revoke all on table public.job_spines from public,anon,authenticated;$ddl$;
execute $ddl$revoke all on table public.project_authorized_contract_summary from public,anon,authenticated;$ddl$;
execute $ddl$revoke all on table public.project_startup_items from public,anon,authenticated;$ddl$;
execute $ddl$revoke all on table public.project_startup_readiness from public,anon,authenticated;$ddl$;
execute $ddl$revoke all on table public.proposal_acceptance_resolutions from public,anon,authenticated;$ddl$;
execute $ddl$revoke all on table public.takeoff_sheet_metadata_events from public,anon,authenticated;$ddl$;
execute $ddl$CREATE UNIQUE INDEX change_orders_single_reversal_idx ON public.change_orders USING btree (company_id, reversal_of_change_order_id) WHERE (reversal_of_change_order_id IS NOT NULL);$ddl$;
execute $ddl$CREATE UNIQUE INDEX estimates_parent_proposal_revision_key ON public.estimates USING btree (parent_proposal_revision_id) WHERE (parent_proposal_revision_id IS NOT NULL);$ddl$;
execute $ddl$CREATE UNIQUE INDEX projects_award_decision_key ON public.projects USING btree (company_id, award_decision_id) WHERE (award_decision_id IS NOT NULL);$ddl$;
execute $ddl$ALTER TABLE public.accepted_scope_snapshot_items ENABLE ROW LEVEL SECURITY;$ddl$;
execute $ddl$ALTER TABLE public.accepted_scope_snapshots ENABLE ROW LEVEL SECURITY;$ddl$;
execute $ddl$ALTER TABLE public.approved_commercial_delta_items ENABLE ROW LEVEL SECURITY;$ddl$;
execute $ddl$ALTER TABLE public.approved_commercial_deltas ENABLE ROW LEVEL SECURITY;$ddl$;
execute $ddl$CREATE POLICY approved_delta_item_management_read ON public.approved_commercial_delta_items FOR SELECT TO authenticated USING (((company_id = public.carez_commercial_actor_company()) AND public.carez_can_manage_commercial_changes()));$ddl$;
execute $ddl$CREATE POLICY approved_delta_management_read ON public.approved_commercial_deltas FOR SELECT TO authenticated USING (((company_id = public.carez_commercial_actor_company()) AND public.carez_can_manage_commercial_changes()));$ddl$;
execute $ddl$ALTER TABLE public.award_decisions ENABLE ROW LEVEL SECURITY;$ddl$;
execute $ddl$CREATE POLICY "carez company read accepted_scope_snapshot_items" ON public.accepted_scope_snapshot_items FOR SELECT TO authenticated USING ((company_id = public.get_my_company_id()));$ddl$;
execute $ddl$CREATE POLICY "carez company read accepted_scope_snapshots" ON public.accepted_scope_snapshots FOR SELECT TO authenticated USING ((company_id = public.get_my_company_id()));$ddl$;
execute $ddl$CREATE POLICY "carez company read award_decisions" ON public.award_decisions FOR SELECT TO authenticated USING ((company_id = public.get_my_company_id()));$ddl$;
execute $ddl$CREATE POLICY "carez company read commercial_baseline_items" ON public.commercial_baseline_items FOR SELECT TO authenticated USING ((company_id = public.get_my_company_id()));$ddl$;
execute $ddl$CREATE POLICY "carez company read commercial_baselines" ON public.commercial_baselines FOR SELECT TO authenticated USING ((company_id = public.get_my_company_id()));$ddl$;
execute $ddl$CREATE POLICY "carez company read job_number_sequences" ON public.job_number_sequences FOR SELECT TO authenticated USING ((company_id = public.get_my_company_id()));$ddl$;
execute $ddl$CREATE POLICY "carez company read job_spine_migration_reviews" ON public.job_spine_migration_reviews FOR SELECT TO authenticated USING ((company_id = public.get_my_company_id()));$ddl$;
execute $ddl$CREATE POLICY "carez company read job_spines" ON public.job_spines FOR SELECT TO authenticated USING ((company_id = public.get_my_company_id()));$ddl$;
execute $ddl$CREATE POLICY "carez company resolve migration review" ON public.job_spine_migration_reviews FOR UPDATE TO authenticated USING ((company_id = public.get_my_company_id())) WITH CHECK ((company_id = public.get_my_company_id()));$ddl$;
execute $ddl$CREATE POLICY "carez company update job spine" ON public.job_spines FOR UPDATE TO authenticated USING ((company_id = public.get_my_company_id())) WITH CHECK ((company_id = public.get_my_company_id()));$ddl$;
execute $ddl$CREATE POLICY change_order_event_management_read ON public.change_order_events FOR SELECT TO authenticated USING (((company_id = public.carez_commercial_actor_company()) AND public.carez_can_manage_commercial_changes()));$ddl$;
execute $ddl$ALTER TABLE public.change_order_events ENABLE ROW LEVEL SECURITY;$ddl$;
execute $ddl$ALTER TABLE public.change_order_number_sequences ENABLE ROW LEVEL SECURITY;$ddl$;
execute $ddl$ALTER TABLE public.commercial_baseline_items ENABLE ROW LEVEL SECURITY;$ddl$;
execute $ddl$ALTER TABLE public.commercial_baselines ENABLE ROW LEVEL SECURITY;$ddl$;
execute $ddl$CREATE POLICY "company catalog categories" ON public.cost_catalog_categories TO authenticated USING ((company_id = public.get_my_company_id())) WITH CHECK ((company_id = public.get_my_company_id()));$ddl$;
execute $ddl$ALTER TABLE public.company_invoice_number_sequences ENABLE ROW LEVEL SECURITY;$ddl$;
execute $ddl$ALTER TABLE public.cost_catalog_categories ENABLE ROW LEVEL SECURITY;$ddl$;
execute $ddl$ALTER TABLE public.estimate_supplier_quote_access_items ENABLE ROW LEVEL SECURITY;$ddl$;
execute $ddl$ALTER TABLE public.estimate_supplier_quote_access_tokens ENABLE ROW LEVEL SECURITY;$ddl$;
execute $ddl$ALTER TABLE public.estimate_supplier_quote_submission_events ENABLE ROW LEVEL SECURITY;$ddl$;
execute $ddl$ALTER TABLE public.job_number_sequences ENABLE ROW LEVEL SECURITY;$ddl$;
execute $ddl$ALTER TABLE public.job_spine_migration_reviews ENABLE ROW LEVEL SECURITY;$ddl$;
execute $ddl$ALTER TABLE public.job_spines ENABLE ROW LEVEL SECURITY;$ddl$;
execute $ddl$CREATE POLICY "office access estimate supplier quote link items" ON public.estimate_supplier_quote_access_items TO authenticated USING (((company_id = ( SELECT public.get_my_company_id() AS get_my_company_id)) AND (( SELECT public.get_my_role() AS get_my_role) <> 'employee'::text))) WITH CHECK (((company_id = ( SELECT public.get_my_company_id() AS get_my_company_id)) AND (( SELECT public.get_my_role() AS get_my_role) <> 'employee'::text)));$ddl$;
execute $ddl$CREATE POLICY "office access estimate supplier quote links" ON public.estimate_supplier_quote_access_tokens TO authenticated USING (((company_id = ( SELECT public.get_my_company_id() AS get_my_company_id)) AND (( SELECT public.get_my_role() AS get_my_role) <> 'employee'::text))) WITH CHECK (((company_id = ( SELECT public.get_my_company_id() AS get_my_company_id)) AND (( SELECT public.get_my_role() AS get_my_role) <> 'employee'::text)));$ddl$;
execute $ddl$CREATE POLICY "office reads supplier quote submissions" ON public.estimate_supplier_quote_submission_events FOR SELECT TO authenticated USING (((company_id = ( SELECT public.get_my_company_id() AS get_my_company_id)) AND (( SELECT public.get_my_role() AS get_my_role) <> 'employee'::text)));$ddl$;
execute $ddl$CREATE POLICY project_startup_item_owner_office ON public.project_startup_items TO authenticated USING (((company_id = public.get_my_company_id()) AND (public.get_my_role() = ANY (ARRAY['owner'::text, 'office'::text])))) WITH CHECK (((company_id = public.get_my_company_id()) AND (public.get_my_role() = ANY (ARRAY['owner'::text, 'office'::text]))));$ddl$;
execute $ddl$ALTER TABLE public.project_startup_items ENABLE ROW LEVEL SECURITY;$ddl$;
execute $ddl$ALTER TABLE public.proposal_acceptance_resolutions ENABLE ROW LEVEL SECURITY;$ddl$;
execute $ddl$CREATE POLICY proposal_acceptance_resolutions_select ON public.proposal_acceptance_resolutions FOR SELECT TO authenticated USING (((company_id = public.get_my_company_id()) AND (public.get_my_role() <> 'employee'::text)));$ddl$;
execute $ddl$ALTER TABLE public.takeoff_sheet_metadata_events ENABLE ROW LEVEL SECURITY;$ddl$;
execute $ddl$CREATE POLICY takeoff_sheet_metadata_events_read ON public.takeoff_sheet_metadata_events FOR SELECT TO authenticated USING ((company_id = public.get_my_company_id()));$ddl$;
execute $ddl$REVOKE ALL ON FUNCTION public.carez_assign_phase_job_spine() FROM PUBLIC;$ddl$;
execute $ddl$REVOKE ALL ON FUNCTION public.carez_audit_takeoff_sheet_metadata() FROM PUBLIC;$ddl$;
execute $ddl$REVOKE ALL ON FUNCTION public.carez_award_proposal_and_create_project(p_proposal_revision_id uuid, p_effective_at timestamp with time zone, p_evidence_reference text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.carez_award_proposal_and_create_project(p_proposal_revision_id uuid, p_effective_at timestamp with time zone, p_evidence_reference text) TO authenticated;$ddl$;
execute $ddl$REVOKE ALL ON FUNCTION public.carez_can_manage_commercial_changes() FROM PUBLIC;
GRANT ALL ON FUNCTION public.carez_can_manage_commercial_changes() TO authenticated;$ddl$;
execute $ddl$REVOKE ALL ON FUNCTION public.carez_capture_proposal_commercial_snapshot() FROM PUBLIC;$ddl$;
execute $ddl$REVOKE ALL ON FUNCTION public.carez_change_order_status_event() FROM PUBLIC;$ddl$;
execute $ddl$REVOKE ALL ON FUNCTION public.carez_commercial_actor_company() FROM PUBLIC;
GRANT ALL ON FUNCTION public.carez_commercial_actor_company() TO authenticated;$ddl$;
execute $ddl$REVOKE ALL ON FUNCTION public.carez_correct_takeoff_sheet_metadata(p_takeoff_set_id uuid, p_sheet_id uuid, p_page_number integer, p_expected_updated_at timestamp with time zone, p_sheet_number text, p_title text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.carez_correct_takeoff_sheet_metadata(p_takeoff_set_id uuid, p_sheet_id uuid, p_page_number integer, p_expected_updated_at timestamp with time zone, p_sheet_number text, p_title text) TO authenticated;$ddl$;
execute $ddl$REVOKE ALL ON FUNCTION public.carez_create_change_order(p_project_id uuid, p_title text, p_change_type text, p_requested_date date, p_description text, p_reason text, p_requested_by text, p_overhead_snapshot_id uuid, p_overhead_rate_snapshot numeric, p_reversal_of_change_order_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.carez_create_change_order(p_project_id uuid, p_title text, p_change_type text, p_requested_date date, p_description text, p_reason text, p_requested_by text, p_overhead_snapshot_id uuid, p_overhead_rate_snapshot numeric, p_reversal_of_change_order_id uuid) TO authenticated;$ddl$;
execute $ddl$REVOKE ALL ON FUNCTION public.carez_create_next_proposal_revision(p_proposal_revision_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.carez_create_next_proposal_revision(p_proposal_revision_id uuid) TO authenticated;$ddl$;
execute $ddl$REVOKE ALL ON FUNCTION public.carez_get_proposal_acceptance_facts(p_proposal_revision_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.carez_get_proposal_acceptance_facts(p_proposal_revision_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.carez_get_proposal_acceptance_facts(p_proposal_revision_id uuid) TO service_role;$ddl$;
execute $ddl$REVOKE ALL ON FUNCTION public.carez_get_proposal_award_hold(p_proposal_revision_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.carez_get_proposal_award_hold(p_proposal_revision_id uuid) TO authenticated;$ddl$;
execute $ddl$REVOKE ALL ON FUNCTION public.carez_get_public_vendor_quote(p_token uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.carez_get_public_vendor_quote(p_token uuid) TO anon;
GRANT ALL ON FUNCTION public.carez_get_public_vendor_quote(p_token uuid) TO authenticated;
GRANT ALL ON FUNCTION public.carez_get_public_vendor_quote(p_token uuid) TO service_role;$ddl$;
execute $ddl$REVOKE ALL ON FUNCTION public.carez_guard_acceptance_resolution() FROM PUBLIC;$ddl$;
execute $ddl$REVOKE ALL ON FUNCTION public.carez_guard_change_order_item() FROM PUBLIC;$ddl$;
execute $ddl$REVOKE ALL ON FUNCTION public.carez_guard_issued_estimate() FROM PUBLIC;$ddl$;
execute $ddl$REVOKE ALL ON FUNCTION public.carez_guard_issued_estimate_child() FROM PUBLIC;$ddl$;
execute $ddl$REVOKE ALL ON FUNCTION public.carez_guard_takeoff_sheet_metadata() FROM PUBLIC;$ddl$;
execute $ddl$REVOKE ALL ON FUNCTION public.carez_immutable_change_order_event() FROM PUBLIC;$ddl$;
execute $ddl$REVOKE ALL ON FUNCTION public.carez_immutable_commercial_delta() FROM PUBLIC;$ddl$;
execute $ddl$REVOKE ALL ON FUNCTION public.carez_immutable_commercial_record() FROM PUBLIC;$ddl$;
execute $ddl$REVOKE ALL ON FUNCTION public.carez_immutable_takeoff_sheet_metadata_event() FROM PUBLIC;$ddl$;
execute $ddl$REVOKE ALL ON FUNCTION public.carez_list_approved_change_order_references(p_project_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.carez_list_approved_change_order_references(p_project_id uuid) TO authenticated;$ddl$;
execute $ddl$REVOKE ALL ON FUNCTION public.carez_preserve_awarded_project_contract_value() FROM PUBLIC;$ddl$;
execute $ddl$REVOKE ALL ON FUNCTION public.carez_protect_issued_proposal_delete() FROM PUBLIC;$ddl$;
execute $ddl$REVOKE ALL ON FUNCTION public.carez_protect_proposal_commercial_snapshot() FROM PUBLIC;$ddl$;
execute $ddl$REVOKE ALL ON FUNCTION public.carez_resolve_proposal_acceptance(p_proposal_revision_id uuid, p_decision_mode text, p_scope_resolution jsonb, p_alternate_resolution jsonb, p_allowances jsonb, p_unit_prices jsonb, p_inclusions jsonb, p_exclusions jsonb, p_clarifications jsonb, p_terms jsonb, p_evidence jsonb, p_effective_direct_cost numeric, p_effective_sell numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION public.carez_resolve_proposal_acceptance(p_proposal_revision_id uuid, p_decision_mode text, p_scope_resolution jsonb, p_alternate_resolution jsonb, p_allowances jsonb, p_unit_prices jsonb, p_inclusions jsonb, p_exclusions jsonb, p_clarifications jsonb, p_terms jsonb, p_evidence jsonb, p_effective_direct_cost numeric, p_effective_sell numeric) TO authenticated;
GRANT ALL ON FUNCTION public.carez_resolve_proposal_acceptance(p_proposal_revision_id uuid, p_decision_mode text, p_scope_resolution jsonb, p_alternate_resolution jsonb, p_allowances jsonb, p_unit_prices jsonb, p_inclusions jsonb, p_exclusions jsonb, p_clarifications jsonb, p_terms jsonb, p_evidence jsonb, p_effective_direct_cost numeric, p_effective_sell numeric) TO service_role;$ddl$;
execute $ddl$REVOKE ALL ON FUNCTION public.carez_save_unmeasured_condition_draft(p_condition_version_id uuid, p_inputs jsonb, p_input_provenance jsonb, p_modules jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.carez_save_unmeasured_condition_draft(p_condition_version_id uuid, p_inputs jsonb, p_input_provenance jsonb, p_modules jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.carez_save_unmeasured_condition_draft(p_condition_version_id uuid, p_inputs jsonb, p_input_provenance jsonb, p_modules jsonb) TO service_role;$ddl$;
execute $ddl$REVOKE ALL ON FUNCTION public.carez_submit_public_vendor_quote_line(p_token uuid, p_output_id uuid, p_unit_cost numeric, p_source_reference text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.carez_submit_public_vendor_quote_line(p_token uuid, p_output_id uuid, p_unit_cost numeric, p_source_reference text) TO anon;
GRANT ALL ON FUNCTION public.carez_submit_public_vendor_quote_line(p_token uuid, p_output_id uuid, p_unit_cost numeric, p_source_reference text) TO authenticated;
GRANT ALL ON FUNCTION public.carez_submit_public_vendor_quote_line(p_token uuid, p_output_id uuid, p_unit_cost numeric, p_source_reference text) TO service_role;$ddl$;
execute $ddl$REVOKE ALL ON FUNCTION public.carez_transition_change_order(p_change_order_id uuid, p_transition text, p_note text, p_authorization_kind text, p_authorization_reference text, p_external_authorized_by text, p_external_authorized_at timestamp with time zone, p_authorization_note text, p_authorization_document_reference text, p_sell_delta numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION public.carez_transition_change_order(p_change_order_id uuid, p_transition text, p_note text, p_authorization_kind text, p_authorization_reference text, p_external_authorized_by text, p_external_authorized_at timestamp with time zone, p_authorization_note text, p_authorization_document_reference text, p_sell_delta numeric) TO authenticated;$ddl$;
execute $ddl$REVOKE ALL ON FUNCTION public.carez_update_change_order(p_change_order_id uuid, p_values jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.carez_update_change_order(p_change_order_id uuid, p_values jsonb) TO authenticated;$ddl$;
execute $ddl$REVOKE ALL ON FUNCTION public.carez_validate_supplier_quote_access_item() FROM PUBLIC;$ddl$;
execute $ddl$REVOKE ALL ON FUNCTION public.submit_public_proposal_ready_intent(p_token uuid, p_name text, p_email text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.submit_public_proposal_ready_intent(p_token uuid, p_name text, p_email text) TO anon;
GRANT ALL ON FUNCTION public.submit_public_proposal_ready_intent(p_token uuid, p_name text, p_email text) TO authenticated;
GRANT ALL ON FUNCTION public.submit_public_proposal_ready_intent(p_token uuid, p_name text, p_email text) TO service_role;$ddl$;
execute $ddl$REVOKE ALL ON FUNCTION public.sync_project_award_record() FROM PUBLIC;$ddl$;
execute $ddl$GRANT SELECT ON TABLE public.accepted_scope_snapshot_items TO authenticated;$ddl$;
execute $ddl$GRANT SELECT ON TABLE public.accepted_scope_snapshots TO authenticated;$ddl$;
execute $ddl$GRANT SELECT ON TABLE public.approved_commercial_delta_items TO authenticated;$ddl$;
execute $ddl$GRANT SELECT ON TABLE public.approved_commercial_deltas TO authenticated;$ddl$;
execute $ddl$GRANT SELECT ON TABLE public.award_decisions TO authenticated;$ddl$;
execute $ddl$GRANT SELECT ON TABLE public.change_order_events TO authenticated;$ddl$;
execute $ddl$GRANT SELECT ON TABLE public.commercial_baselines TO authenticated;$ddl$;
execute $ddl$GRANT SELECT ON TABLE public.commercial_baseline_items TO authenticated;$ddl$;
execute $ddl$GRANT SELECT ON TABLE public.commercial_baseline_item_references TO authenticated;$ddl$;
execute $ddl$GRANT SELECT,INSERT,UPDATE ON TABLE public.cost_catalog_categories TO authenticated;$ddl$;
execute $ddl$GRANT SELECT,INSERT ON TABLE public.estimate_supplier_quote_access_items TO authenticated;
GRANT ALL ON TABLE public.estimate_supplier_quote_access_items TO service_role;$ddl$;
execute $ddl$GRANT SELECT,INSERT ON TABLE public.estimate_supplier_quote_access_tokens TO authenticated;
GRANT ALL ON TABLE public.estimate_supplier_quote_access_tokens TO service_role;$ddl$;
execute $ddl$GRANT SELECT ON TABLE public.estimate_supplier_quote_submission_events TO authenticated;
GRANT ALL ON TABLE public.estimate_supplier_quote_submission_events TO service_role;$ddl$;
execute $ddl$GRANT SELECT,UPDATE ON TABLE public.job_spine_migration_reviews TO authenticated;$ddl$;
execute $ddl$GRANT SELECT,INSERT,UPDATE ON TABLE public.job_spines TO authenticated;$ddl$;
execute $ddl$GRANT SELECT ON TABLE public.project_authorized_contract_summary TO authenticated;$ddl$;
execute $ddl$GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.project_startup_items TO authenticated;$ddl$;
execute $ddl$GRANT SELECT ON TABLE public.project_startup_readiness TO authenticated;$ddl$;
execute $ddl$GRANT SELECT ON TABLE public.proposal_acceptance_resolutions TO authenticated;$ddl$;
execute $ddl$GRANT SELECT ON TABLE public.takeoff_sheet_metadata_events TO authenticated;$ddl$;
execute $ddl$insert into public.job_number_sequences(company_id,sequence_year,next_number) select company_id,yr,max(num)+1 from (select company_id,substring(job_number from 5 for 4)::integer yr,substring(job_number from 10)::integer num from public.projects where job_number ~ '^JOB-[0-9]{4}-[0-9]+$' union all select company_id,2000+substring(job_number from 1 for 2)::integer,substring(job_number from 4)::integer from public.projects where job_number ~ '^[0-9]{2}-[0-9]+$') n group by company_id,yr on conflict(company_id,sequence_year) do update set next_number=greatest(public.job_number_sequences.next_number,excluded.next_number);$ddl$;
execute $ddl$insert into public.change_order_number_sequences(company_id,project_id,last_number) select company_id,project_id,max(num) from (select company_id,project_id,substring(co_number from 'CO-([0-9]+)$')::integer num from public.change_orders where co_number ~ '(^|-)CO-[0-9]+$' union all select company_id,project_id,greatest(next_number-1,0) from public.project_document_sequences where document_type='change_order') n group by company_id,project_id on conflict(company_id,project_id) do update set last_number=greatest(public.change_order_number_sequences.last_number,excluded.last_number);$ddl$;
execute $ddl$-- Reconcile historical production Proposal authority after the accepted P1.4 guard.
-- This migration changes trigger authority and function ACLs only; it does not
-- invoke historical conversion functions or modify Proposal/Estimate/Project rows.
do $$
begin
  if not exists (
    select 1
    from pg_trigger trigger_row
    join pg_class table_row on table_row.oid=trigger_row.tgrelid
    join pg_namespace table_schema on table_schema.oid=table_row.relnamespace
    join pg_proc trigger_function on trigger_function.oid=trigger_row.tgfoid
    join pg_namespace function_schema on function_schema.oid=trigger_function.pronamespace
    where table_schema.nspname='public'
      and table_row.relname='proposal_presentations'
      and trigger_row.tgname='guard_proposal_release'
      and not trigger_row.tgisinternal
      and trigger_row.tgenabled='O'
      and trigger_row.tgtype=7
      and function_schema.nspname='public'
      and trigger_function.proname='carez_guard_proposal_release'
      and pg_get_function_identity_arguments(trigger_function.oid)=''
  ) then
    raise exception 'P1.4 guard_proposal_release trigger invoking public.carez_guard_proposal_release() is required before Proposal authority cutover';
  end if;

  drop trigger if exists carez_proposal_audit_gate on public.proposal_presentations;

  if to_regprocedure('public.accept_public_proposal(uuid,text,text,text)') is not null then
    execute 'revoke execute on function public.accept_public_proposal(uuid,text,text,text) from public, anon, authenticated';
  end if;
  if to_regprocedure('public.award_accepted_estimate(uuid)') is not null then
    execute 'revoke execute on function public.award_accepted_estimate(uuid) from public, anon, authenticated';
  end if;
  if to_regprocedure('public.create_estimate_revision(uuid)') is not null then
    execute 'revoke execute on function public.create_estimate_revision(uuid) from public, anon, authenticated';
  end if;
end;
$$;$ddl$;
end $bridge$;
