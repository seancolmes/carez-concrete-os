-- Recovered operational relation contracts from the verified production catalog.
-- Catalog SHA256: 109fa8a04eacab94427d989d0171c94bec96d8e1ee2cbe0ad4ec3f7c4ed683f9
-- No business records, statutory rate rows, money or company-specific seeds.
-- Existing object values remain intact; canonical Proposal/Award/baseline authority is unchanged.
-- Missing columns on materialized source tables remain NULL rather than fabricating historic data.
-- Recovered PUBLIC policies are restricted to authenticated; anonymous table grants are revoked.
-- Workflow functions/read models and final write authority are qualified in later migrations.
set local search_path=pg_catalog,public,extensions;

-- Crew compatibility must precede the recovered tax-status view. These are
-- the same recorded-field mappings used by Crew administration, not tax inputs.
do $$ declare v_missing boolean; begin
 select not exists(select 1 from information_schema.columns where table_schema='public' and table_name='crew_members' and column_name='worker_type') into v_missing;
 alter table public.crew_members add column if not exists worker_type text not null default 'employee' check(worker_type in ('employee','owner','subcontractor'));
 alter table public.crew_members add column if not exists availability_type text not null default 'regular' check(availability_type in ('regular','on_call'));
 alter table public.crew_members add column if not exists start_date date;
 alter table public.crew_members add column if not exists end_date date;
 alter table public.crew_members add column if not exists notes text;
 alter table public.crew_members add column if not exists can_report_production boolean not null default false;
 alter table public.crew_members add column if not exists administration_revision integer not null default 0 check(administration_revision>=0);
 if v_missing then
  update public.crew_members set worker_type=case when is_owner then 'owner' when employment_type='subcontractor' then 'subcontractor' else 'employee' end,
   availability_type=case when employment_type='on_call' then 'on_call' else 'regular' end;
 end if;
end $$;

-- Additive compatibility for companies.
alter table public."companies" add column if not exists "labor_burden_percent" numeric(6,2);
alter table public."companies" add column if not exists "retailing_bo_rate_percent" numeric(8,5);
alter table public."companies" add column if not exists "wholesaling_bo_rate_percent" numeric(8,5);
alter table public."companies" add column if not exists "default_bo_classification" text;
alter table public."companies" add column if not exists "card_processing_reference_percent" numeric(8,5);

-- Additive compatibility for customer_payments.
alter table public."customer_payments" add column if not exists "status" text;
alter table public."customer_payments" add column if not exists "updated_at" timestamp with time zone;
alter table public."customer_payments" add column if not exists "bank_transaction_id" uuid;

-- Additive compatibility for daily_production_records.
alter table public."daily_production_records" add column if not exists "reported_by_crew_member_id" uuid;
alter table public."daily_production_records" add column if not exists "reported_by_profile_id" uuid;
alter table public."daily_production_records" add column if not exists "reported_at" timestamp with time zone;

-- Additive compatibility for employee_break_periods.
alter table public."employee_break_periods" add column if not exists "resume_production_task_id" uuid;
alter table public."employee_break_periods" add column if not exists "resume_work_package_operation_id" uuid;

-- Additive compatibility for employee_shift_sessions.
alter table public."employee_shift_sessions" add column if not exists "employee_profile_id" uuid;
alter table public."employee_shift_sessions" add column if not exists "device_label" text;
alter table public."employee_shift_sessions" add column if not exists "requires_review" boolean;

-- Additive compatibility for employee_task_segments.
alter table public."employee_task_segments" add column if not exists "crew_member_id" uuid;
alter table public."employee_task_segments" add column if not exists "project_id" uuid;

-- Additive compatibility for invoice_lines.
alter table public."invoice_lines" add column if not exists "source_budget_id" uuid;
alter table public."invoice_lines" add column if not exists "updated_at" timestamp with time zone;

-- Additive compatibility for leads.
alter table public."leads" add column if not exists "source_message_id" text;
alter table public."leads" add column if not exists "source_conversation_id" text;

-- Additive compatibility for pour_cost_items.
alter table public."pour_cost_items" add column if not exists "updated_at" timestamp with time zone;

-- Additive compatibility for pour_plans.
alter table public."pour_plans" add column if not exists "source_estimate_id" uuid;
alter table public."pour_plans" add column if not exists "source_work_package_id" uuid;

-- Additive compatibility for project_award_records.
alter table public."project_award_records" add column if not exists "estimate_id" uuid;
alter table public."project_award_records" add column if not exists "proposal_acceptance_id" uuid;

-- Additive compatibility for project_budget_sections.
alter table public."project_budget_sections" add column if not exists "source_estimate_section_id" uuid;
alter table public."project_budget_sections" add column if not exists "source_change_order_id" uuid;

-- Additive compatibility for project_budgets.
alter table public."project_budgets" add column if not exists "version" integer;
alter table public."project_budgets" add column if not exists "approved_at" timestamp with time zone;
alter table public."project_budgets" add column if not exists "sell_price" numeric(14,2);
alter table public."project_budgets" add column if not exists "bo_rate_percent" numeric(8,5);
alter table public."project_budgets" add column if not exists "payment_processing_rate_percent" numeric(8,5);
alter table public."project_budgets" add column if not exists "labor_hours" numeric(12,2);
alter table public."project_budgets" add column if not exists "direct_labor_cost" numeric(14,2);
alter table public."project_budgets" add column if not exists "material_cost" numeric(14,2);
alter table public."project_budgets" add column if not exists "equipment_cost" numeric(14,2);
alter table public."project_budgets" add column if not exists "subcontractor_cost" numeric(14,2);
alter table public."project_budgets" add column if not exists "other_direct_cost" numeric(14,2);
alter table public."project_budgets" add column if not exists "total_direct_cost" numeric(14,2);
alter table public."project_budgets" add column if not exists "overhead_cost" numeric(14,2);
alter table public."project_budgets" add column if not exists "revenue_cost_reserve" numeric(14,2);
alter table public."project_budgets" add column if not exists "total_company_cost" numeric(14,2);
alter table public."project_budgets" add column if not exists "budgeted_profit" numeric(14,2);
alter table public."project_budgets" add column if not exists "budgeted_margin_percent" numeric(8,2);
alter table public."project_budgets" add column if not exists "change_order_id" uuid;

-- Additive compatibility for project_costs.
alter table public."project_costs" add column if not exists "vendor_id" uuid;
alter table public."project_costs" add column if not exists "purchase_order_id" uuid;
alter table public."project_costs" add column if not exists "purchase_order_line_id" uuid;
alter table public."project_costs" add column if not exists "vendor_bill_id" uuid;
alter table public."project_costs" add column if not exists "vendor_bill_line_id" uuid;
alter table public."project_costs" add column if not exists "pour_plan_id" uuid;
alter table public."project_costs" add column if not exists "pour_cost_item_id" uuid;
alter table public."project_costs" add column if not exists "bank_transaction_id" uuid;
alter table public."project_costs" add column if not exists "work_package_operation_id" uuid;

-- Additive compatibility for project_inspections.
alter table public."project_inspections" add column if not exists "evidence_document_id" uuid;
alter table public."project_inspections" add column if not exists "source_estimate_id" uuid;
alter table public."project_inspections" add column if not exists "source_takeoff_measurement_id" uuid;
alter table public."project_inspections" add column if not exists "auto_generated" boolean;

-- Additive compatibility for projects.
alter table public."projects" add column if not exists "estimated_labor_hours" numeric(10,2);
alter table public."projects" add column if not exists "estimated_labor_cost" numeric(12,2);
alter table public."projects" add column if not exists "target_margin_percent" numeric(6,2);
alter table public."projects" add column if not exists "bo_classification" text;
alter table public."projects" add column if not exists "bo_rate_percent" numeric(8,5);
alter table public."projects" add column if not exists "payment_processing_rate_percent" numeric(8,5);
alter table public."projects" add column if not exists "legacy_approved_changes" numeric;
alter table public."projects" add column if not exists "legacy_billed" numeric(14,2);
alter table public."projects" add column if not exists "legacy_collected" numeric(14,2);
alter table public."projects" add column if not exists "lead_id" uuid;

-- Additive compatibility for purchase_order_lines.
alter table public."purchase_order_lines" add column if not exists "purchase_order_id" uuid;
alter table public."purchase_order_lines" add column if not exists "cost_code_id" uuid;
alter table public."purchase_order_lines" add column if not exists "pour_plan_id" uuid;
alter table public."purchase_order_lines" add column if not exists "pour_cost_item_id" uuid;
alter table public."purchase_order_lines" add column if not exists "budget_section_id" uuid;
alter table public."purchase_order_lines" add column if not exists "change_order_id" uuid;
alter table public."purchase_order_lines" add column if not exists "description" text;
alter table public."purchase_order_lines" add column if not exists "quantity" numeric(12,4);
alter table public."purchase_order_lines" add column if not exists "subtotal" numeric(14,2);
alter table public."purchase_order_lines" add column if not exists "sales_tax" numeric(14,2);
alter table public."purchase_order_lines" add column if not exists "total_cost" numeric(14,2);
alter table public."purchase_order_lines" add column if not exists "notes" text;
alter table public."purchase_order_lines" add column if not exists "sort_order" integer;
alter table public."purchase_order_lines" add column if not exists "updated_at" timestamp with time zone;

-- Additive compatibility for vendor_bill_lines.
alter table public."vendor_bill_lines" add column if not exists "vendor_bill_id" uuid;
alter table public."vendor_bill_lines" add column if not exists "purchase_order_line_id" uuid;
alter table public."vendor_bill_lines" add column if not exists "cost_code_id" uuid;
alter table public."vendor_bill_lines" add column if not exists "budget_section_id" uuid;
alter table public."vendor_bill_lines" add column if not exists "change_order_id" uuid;
alter table public."vendor_bill_lines" add column if not exists "pour_plan_id" uuid;
alter table public."vendor_bill_lines" add column if not exists "pour_cost_item_id" uuid;
alter table public."vendor_bill_lines" add column if not exists "description" text;
alter table public."vendor_bill_lines" add column if not exists "quantity" numeric(12,4);
alter table public."vendor_bill_lines" add column if not exists "subtotal" numeric(14,2);
alter table public."vendor_bill_lines" add column if not exists "sales_tax" numeric(14,2);
alter table public."vendor_bill_lines" add column if not exists "total_cost" numeric(14,2);
alter table public."vendor_bill_lines" add column if not exists "notes" text;
alter table public."vendor_bill_lines" add column if not exists "sort_order" integer;
alter table public."vendor_bill_lines" add column if not exists "updated_at" timestamp with time zone;
alter table public."vendor_bill_lines" add column if not exists "work_package_operation_id" uuid;

-- Additive compatibility for work_package_operations.
alter table public."work_package_operations" add column if not exists "source_estimate_item_id" uuid;
alter table public."work_package_operations" add column if not exists "started_at" timestamp with time zone;
alter table public."work_package_operations" add column if not exists "source_takeoff_output_id" uuid;
alter table public."work_package_operations" add column if not exists "source_assembly_component_id" uuid;
alter table public."work_package_operations" add column if not exists "source_budget_line_id" uuid;

-- Additive compatibility for work_package_resource_requirements.
alter table public."work_package_resource_requirements" add column if not exists "source_estimate_item_id" uuid;
alter table public."work_package_resource_requirements" add column if not exists "source_takeoff_output_id" uuid;
alter table public."work_package_resource_requirements" add column if not exists "source_budget_line_id" uuid;
alter table public."work_package_resource_requirements" add column if not exists "auto_generated" boolean;

-- Additive compatibility for work_packages.
alter table public."work_packages" add column if not exists "source_estimate_id" uuid;
alter table public."work_packages" add column if not exists "source_takeoff_measurement_id" uuid;
alter table public."work_packages" add column if not exists "source_assembly_version_id" uuid;

create table if not exists public."bid_price_feedback"(
 "id" uuid default gen_random_uuid() not null,
 "company_id" uuid not null,
 "lead_id" uuid not null,
 "estimate_id" uuid,
 "feedback_source" text not null,
 "competitor_name" text,
 "competitor_price" numeric,
 "scope_comparable" text default 'unknown'::text not null,
 "note" text,
 "recorded_at" timestamp with time zone default now() not null,
 "created_by" uuid,
 "created_at" timestamp with time zone default now() not null,
 constraint "bid_price_feedback_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
 constraint "bid_price_feedback_competitor_price_check" CHECK (competitor_price IS NULL OR competitor_price >= 0::numeric),
 constraint "bid_price_feedback_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL,
 constraint "bid_price_feedback_estimate_id_fkey" FOREIGN KEY (estimate_id) REFERENCES estimates(id) ON DELETE SET NULL,
 constraint "bid_price_feedback_feedback_source_check" CHECK (feedback_source = ANY (ARRAY['customer_claim'::text, 'gc_feedback'::text, 'public_bid_tab'::text, 'direct_competitor_quote'::text, 'owner_budget'::text, 'other'::text])),
 constraint "bid_price_feedback_lead_id_fkey" FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
 constraint "bid_price_feedback_pkey" PRIMARY KEY (id),
 constraint "bid_price_feedback_scope_comparable_check" CHECK (scope_comparable = ANY (ARRAY['yes'::text, 'no'::text, 'unknown'::text]))
);
alter table public."bid_price_feedback" enable row level security;
do $rls$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='bid_price_feedback' and policyname='office access bid price feedback') then create policy "office access bid price feedback" on public."bid_price_feedback" as PERMISSIVE for ALL to authenticated using(((company_id = get_my_company_id()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role <> 'employee'::text)))))) with check(((company_id = get_my_company_id()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role <> 'employee'::text))))));end if;end $rls$;
alter policy "office access bid price feedback" on public."bid_price_feedback" to authenticated;
revoke all on public."bid_price_feedback" from public,anon,authenticated;
grant select,insert,update,delete on public."bid_price_feedback" to authenticated;

create index if not exists bid_price_feedback_lead_idx ON public.bid_price_feedback USING btree (lead_id, recorded_at DESC);

create table if not exists public."billing_sequences"(
 "company_id" uuid not null,
 "next_invoice_number" integer default 1 not null,
 "updated_at" timestamp with time zone default now() not null,
 constraint "billing_sequences_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
 constraint "billing_sequences_next_invoice_number_check" CHECK (next_invoice_number > 0),
 constraint "billing_sequences_pkey" PRIMARY KEY (company_id)
);
alter table public."billing_sequences" enable row level security;
do $rls$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='billing_sequences' and policyname='company access billing sequences') then create policy "company access billing sequences" on public."billing_sequences" as PERMISSIVE for ALL to authenticated using((company_id = get_my_company_id())) with check((company_id = get_my_company_id()));end if;end $rls$;
alter policy "company access billing sequences" on public."billing_sequences" to authenticated;
revoke all on public."billing_sequences" from public,anon,authenticated;
grant select,insert,update,delete on public."billing_sequences" to authenticated;


create table if not exists public."company_cash_accounts"(
 "id" uuid default gen_random_uuid() not null,
 "company_id" uuid not null,
 "name" text not null,
 "account_type" text default 'checking'::text not null,
 "active" boolean default true not null,
 "notes" text,
 "created_at" timestamp with time zone default now() not null,
 "updated_at" timestamp with time zone default now() not null,
 "include_with_connected_banks" boolean default false not null,
 constraint "company_cash_accounts_account_type_check" CHECK (account_type = ANY (ARRAY['checking'::text, 'savings'::text, 'cash'::text, 'other'::text])),
 constraint "company_cash_accounts_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
 constraint "company_cash_accounts_company_id_name_key" UNIQUE (company_id, name),
 constraint "company_cash_accounts_pkey" PRIMARY KEY (id)
);
alter table public."company_cash_accounts" enable row level security;
do $rls$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='company_cash_accounts' and policyname='company access cash accounts') then create policy "company access cash accounts" on public."company_cash_accounts" as PERMISSIVE for ALL to authenticated using((company_id = get_my_company_id())) with check((company_id = get_my_company_id()));end if;end $rls$;
alter policy "company access cash accounts" on public."company_cash_accounts" to authenticated;
revoke all on public."company_cash_accounts" from public,anon,authenticated;
grant select,insert,update,delete on public."company_cash_accounts" to authenticated;


create table if not exists public."company_cash_reserves"(
 "id" uuid default gen_random_uuid() not null,
 "company_id" uuid not null,
 "reserve_type" text not null,
 "name" text not null,
 "amount" numeric(14,2) default 0 not null,
 "due_date" date,
 "active" boolean default true not null,
 "notes" text,
 "created_by" uuid,
 "created_at" timestamp with time zone default now() not null,
 "updated_at" timestamp with time zone default now() not null,
 constraint "company_cash_reserves_amount_check" CHECK (amount >= 0::numeric),
 constraint "company_cash_reserves_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
 constraint "company_cash_reserves_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL,
 constraint "company_cash_reserves_pkey" PRIMARY KEY (id),
 constraint "company_cash_reserves_reserve_type_check" CHECK (reserve_type = ANY (ARRAY['payroll'::text, 'payroll_tax'::text, 'bo_tax'::text, 'li'::text, 'emergency'::text, 'owner'::text, 'other'::text]))
);
alter table public."company_cash_reserves" enable row level security;
do $rls$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='company_cash_reserves' and policyname='company access cash reserves') then create policy "company access cash reserves" on public."company_cash_reserves" as PERMISSIVE for ALL to authenticated using((company_id = get_my_company_id())) with check((company_id = get_my_company_id()));end if;end $rls$;
alter policy "company access cash reserves" on public."company_cash_reserves" to authenticated;
revoke all on public."company_cash_reserves" from public,anon,authenticated;
grant select,insert,update,delete on public."company_cash_reserves" to authenticated;

create index if not exists company_cash_reserves_company_idx ON public.company_cash_reserves USING btree (company_id, active, due_date);

create table if not exists public."concrete_assembly_folders"(
 "id" uuid default gen_random_uuid() not null,
 "company_id" uuid not null,
 "parent_folder_id" uuid,
 "name" text not null,
 "description" text,
 "sort_order" integer default 0 not null,
 "active" boolean default true not null,
 "created_by" uuid,
 "created_at" timestamp with time zone default now() not null,
 "updated_at" timestamp with time zone default now() not null,
 constraint "concrete_assembly_folders_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
 constraint "concrete_assembly_folders_company_id_uk" UNIQUE (company_id, id),
 constraint "concrete_assembly_folders_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL,
 constraint "concrete_assembly_folders_name_chk" CHECK (length(TRIM(BOTH FROM name)) > 0),
 constraint "concrete_assembly_folders_parent_fk" FOREIGN KEY (company_id, parent_folder_id) REFERENCES concrete_assembly_folders(company_id, id) ON DELETE RESTRICT,
 constraint "concrete_assembly_folders_pkey" PRIMARY KEY (id)
);
alter table public."concrete_assembly_folders" enable row level security;
do $rls$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='concrete_assembly_folders' and policyname='office access concrete_assembly_folders') then create policy "office access concrete_assembly_folders" on public."concrete_assembly_folders" as PERMISSIVE for ALL to authenticated using(((company_id = ( SELECT get_my_company_id() AS get_my_company_id)) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role <> 'employee'::text)))))) with check(((company_id = ( SELECT get_my_company_id() AS get_my_company_id)) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role <> 'employee'::text))))));end if;end $rls$;
alter policy "office access concrete_assembly_folders" on public."concrete_assembly_folders" to authenticated;
revoke all on public."concrete_assembly_folders" from public,anon,authenticated;
grant select,insert,update,delete on public."concrete_assembly_folders" to authenticated;

create unique index if not exists concrete_assembly_folders_sibling_name_uk ON public.concrete_assembly_folders USING btree (company_id, COALESCE(parent_folder_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name)) WHERE active;
create index if not exists concrete_assembly_folders_tree_idx ON public.concrete_assembly_folders USING btree (company_id, parent_folder_id, sort_order, name);

create table if not exists public."document_sequences"(
 "company_id" uuid not null,
 "document_type" text not null,
 "prefix" text not null,
 "next_number" integer default 1 not null,
 "padding" integer default 4 not null,
 constraint "document_sequences_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
 constraint "document_sequences_next_number_check" CHECK (next_number > 0),
 constraint "document_sequences_padding_check" CHECK (padding >= 1 AND padding <= 10),
 constraint "document_sequences_pkey" PRIMARY KEY (company_id, document_type)
);
alter table public."document_sequences" enable row level security;
do $rls$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='document_sequences' and policyname='company access document sequences') then create policy "company access document sequences" on public."document_sequences" as PERMISSIVE for ALL to authenticated using((company_id = get_my_company_id())) with check((company_id = get_my_company_id()));end if;end $rls$;
alter policy "company access document sequences" on public."document_sequences" to authenticated;
revoke all on public."document_sequences" from public,anon,authenticated;
grant select,insert,update,delete on public."document_sequences" to authenticated;


create table if not exists public."employee_tax_status"(
 "id" uuid default gen_random_uuid() not null,
 "company_id" uuid not null,
 "crew_member_id" uuid not null,
 "tax_year" integer not null,
 "futa_cap_reached" boolean default false not null,
 "social_security_cap_reached" boolean default false not null,
 "wa_sui_cap_reached" boolean default false not null,
 "notes" text,
 "updated_at" timestamp with time zone default now() not null,
 constraint "employee_tax_status_company_id_crew_member_id_tax_year_key" UNIQUE (company_id, crew_member_id, tax_year),
 constraint "employee_tax_status_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
 constraint "employee_tax_status_crew_member_id_fkey" FOREIGN KEY (crew_member_id) REFERENCES crew_members(id) ON DELETE CASCADE,
 constraint "employee_tax_status_pkey" PRIMARY KEY (id)
);
alter table public."employee_tax_status" enable row level security;
do $rls$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='employee_tax_status' and policyname='company access employee tax status') then create policy "company access employee tax status" on public."employee_tax_status" as PERMISSIVE for ALL to authenticated using((company_id = get_my_company_id())) with check((company_id = get_my_company_id()));end if;end $rls$;
alter policy "company access employee tax status" on public."employee_tax_status" to authenticated;
revoke all on public."employee_tax_status" from public,anon,authenticated;
grant select,insert,update,delete on public."employee_tax_status" to authenticated;


create table if not exists public."equipment_assets"(
 "id" uuid default gen_random_uuid() not null,
 "company_id" uuid not null,
 "asset_number" text,
 "name" text not null,
 "category" text default 'tool'::text not null,
 "make" text,
 "model" text,
 "serial_number" text,
 "purchase_date" date,
 "purchase_cost" numeric,
 "status" text default 'available'::text not null,
 "assigned_project_id" uuid,
 "assigned_crew_member_id" uuid,
 "service_interval_hours" numeric,
 "current_meter_hours" numeric default 0 not null,
 "next_service_date" date,
 "notes" text,
 "active" boolean default true not null,
 "created_at" timestamp with time zone default now() not null,
 "updated_at" timestamp with time zone default now() not null,
 constraint "equipment_assets_assigned_crew_member_id_fkey" FOREIGN KEY (assigned_crew_member_id) REFERENCES crew_members(id) ON DELETE SET NULL,
 constraint "equipment_assets_assigned_project_id_fkey" FOREIGN KEY (assigned_project_id) REFERENCES projects(id) ON DELETE SET NULL,
 constraint "equipment_assets_pkey" PRIMARY KEY (id)
);
alter table public."equipment_assets" enable row level security;
do $rls$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='equipment_assets' and policyname='company access equipment') then create policy "company access equipment" on public."equipment_assets" as PERMISSIVE for ALL to authenticated using(((company_id = get_my_company_id()) AND (get_my_role() <> 'employee'::text))) with check(((company_id = get_my_company_id()) AND (get_my_role() <> 'employee'::text)));end if;end $rls$;
alter policy "company access equipment" on public."equipment_assets" to authenticated;
revoke all on public."equipment_assets" from public,anon,authenticated;
grant select,insert,update,delete on public."equipment_assets" to authenticated;

create index if not exists equipment_assets_company_idx ON public.equipment_assets USING btree (company_id, active, category);

create table if not exists public."inventory_items"(
 "id" uuid default gen_random_uuid() not null,
 "company_id" uuid not null,
 "name" text not null,
 "category" text default 'formwork'::text not null,
 "unit" text default 'EA'::text not null,
 "quantity_on_hand" numeric default 0 not null,
 "reorder_point" numeric default 0 not null,
 "target_quantity" numeric,
 "average_unit_cost" numeric default 0 not null,
 "storage_location" text,
 "active" boolean default true not null,
 "notes" text,
 "created_at" timestamp with time zone default now() not null,
 "updated_at" timestamp with time zone default now() not null,
 constraint "inventory_items_pkey" PRIMARY KEY (id)
);
alter table public."inventory_items" enable row level security;
do $rls$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='inventory_items' and policyname='company access inventory') then create policy "company access inventory" on public."inventory_items" as PERMISSIVE for ALL to authenticated using(((company_id = get_my_company_id()) AND (get_my_role() <> 'employee'::text))) with check(((company_id = get_my_company_id()) AND (get_my_role() <> 'employee'::text)));end if;end $rls$;
alter policy "company access inventory" on public."inventory_items" to authenticated;
revoke all on public."inventory_items" from public,anon,authenticated;
grant select,insert,update,delete on public."inventory_items" to authenticated;


create table if not exists public."labor_tax_settings"(
 "id" uuid default gen_random_uuid() not null,
 "company_id" uuid not null,
 "tax_year" integer not null,
 "social_security_rate" numeric(8,6) not null,
 "social_security_wage_base" numeric(12,2) not null,
 "medicare_rate" numeric(8,6) not null,
 "futa_rate" numeric(8,6) not null,
 "futa_wage_base" numeric(12,2) not null,
 "wa_sui_rate" numeric(8,6) not null,
 "wa_sui_wage_base" numeric(12,2) not null,
 "sick_leave_accrual_rate" numeric(8,6) default 0.025 not null,
 "created_at" timestamp with time zone default now() not null,
 "updated_at" timestamp with time zone default now() not null,
 constraint "labor_tax_settings_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
 constraint "labor_tax_settings_company_id_tax_year_key" UNIQUE (company_id, tax_year),
 constraint "labor_tax_settings_pkey" PRIMARY KEY (id)
);
alter table public."labor_tax_settings" enable row level security;
do $rls$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='labor_tax_settings' and policyname='company access labor tax settings') then create policy "company access labor tax settings" on public."labor_tax_settings" as PERMISSIVE for ALL to authenticated using((company_id = get_my_company_id())) with check((company_id = get_my_company_id()));end if;end $rls$;
alter policy "company access labor tax settings" on public."labor_tax_settings" to authenticated;
revoke all on public."labor_tax_settings" from public,anon,authenticated;
grant select,insert,update,delete on public."labor_tax_settings" to authenticated;


create table if not exists public."outlook_connections"(
 "id" uuid default gen_random_uuid() not null,
 "company_id" uuid not null,
 "microsoft_user_id" text,
 "mailbox_email" text,
 "mailbox_name" text,
 "access_token_ciphertext" text not null,
 "access_token_iv" text not null,
 "access_token_auth_tag" text not null,
 "refresh_token_ciphertext" text not null,
 "refresh_token_iv" text not null,
 "refresh_token_auth_tag" text not null,
 "token_expires_at" timestamp with time zone not null,
 "subscription_id" text,
 "subscription_client_state" text,
 "subscription_expires_at" timestamp with time zone,
 "last_sync_at" timestamp with time zone,
 "last_error" text,
 "status" text default 'active'::text not null,
 "created_by" uuid,
 "created_at" timestamp with time zone default now() not null,
 "updated_at" timestamp with time zone default now() not null,
 constraint "outlook_connections_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
 constraint "outlook_connections_company_id_key" UNIQUE (company_id),
 constraint "outlook_connections_pkey" PRIMARY KEY (id),
 constraint "outlook_connections_status_check" CHECK (status = ANY (ARRAY['active'::text, 'needs_attention'::text, 'disconnected'::text]))
);
alter table public."outlook_connections" enable row level security;
do $rls$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='outlook_connections' and policyname='owner access outlook connections') then create policy "owner access outlook connections" on public."outlook_connections" as PERMISSIVE for ALL to authenticated using(((company_id = get_my_company_id()) AND (get_my_role() <> 'employee'::text))) with check(((company_id = get_my_company_id()) AND (get_my_role() <> 'employee'::text)));end if;end $rls$;
alter policy "owner access outlook connections" on public."outlook_connections" to authenticated;
revoke all on public."outlook_connections" from public,anon,authenticated;
grant select,insert,update,delete on public."outlook_connections" to authenticated;


create table if not exists public."outlook_messages"(
 "id" uuid default gen_random_uuid() not null,
 "company_id" uuid not null,
 "outlook_message_id" text not null,
 "conversation_id" text,
 "internet_message_id" text,
 "subject" text,
 "sender_name" text,
 "sender_email" text,
 "received_at" timestamp with time zone,
 "body_preview" text,
 "web_link" text,
 "classification" text,
 "confidence" numeric,
 "lead_id" uuid,
 "created_at" timestamp with time zone default now() not null,
 constraint "outlook_messages_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
 constraint "outlook_messages_company_id_outlook_message_id_key" UNIQUE (company_id, outlook_message_id),
 constraint "outlook_messages_lead_id_fkey" FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL,
 constraint "outlook_messages_pkey" PRIMARY KEY (id)
);
alter table public."outlook_messages" enable row level security;
do $rls$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='outlook_messages' and policyname='owner access outlook messages') then create policy "owner access outlook messages" on public."outlook_messages" as PERMISSIVE for ALL to authenticated using(((company_id = get_my_company_id()) AND (get_my_role() <> 'employee'::text))) with check(((company_id = get_my_company_id()) AND (get_my_role() <> 'employee'::text)));end if;end $rls$;
alter policy "owner access outlook messages" on public."outlook_messages" to authenticated;
revoke all on public."outlook_messages" from public,anon,authenticated;
grant select,insert,update,delete on public."outlook_messages" to authenticated;


create table if not exists public."plaid_connections"(
 "id" uuid default gen_random_uuid() not null,
 "company_id" uuid not null,
 "item_id" text not null,
 "institution_id" text,
 "institution_name" text,
 "access_token_ciphertext" text not null,
 "token_iv" text not null,
 "token_auth_tag" text not null,
 "status" text default 'active'::text not null,
 "transactions_cursor" text,
 "last_transactions_sync_at" timestamp with time zone,
 "last_accounts_sync_at" timestamp with time zone,
 "last_realtime_balance_at" timestamp with time zone,
 "last_error_code" text,
 "last_error_message" text,
 "created_by" uuid,
 "created_at" timestamp with time zone default now() not null,
 "updated_at" timestamp with time zone default now() not null,
 constraint "plaid_connections_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
 constraint "plaid_connections_company_id_item_id_key" UNIQUE (company_id, item_id),
 constraint "plaid_connections_pkey" PRIMARY KEY (id),
 constraint "plaid_connections_status_check" CHECK (status = ANY (ARRAY['active'::text, 'needs_attention'::text, 'disconnected'::text]))
);
alter table public."plaid_connections" enable row level security;
do $rls$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='plaid_connections' and policyname='plaid_connections_company_policy') then create policy "plaid_connections_company_policy" on public."plaid_connections" as PERMISSIVE for ALL to authenticated using((company_id = get_my_company_id())) with check((company_id = get_my_company_id()));end if;end $rls$;
alter policy "plaid_connections_company_policy" on public."plaid_connections" to authenticated;
revoke all on public."plaid_connections" from public,anon,authenticated;
grant select,insert,update,delete on public."plaid_connections" to authenticated;

create index if not exists plaid_connections_company_idx ON public.plaid_connections USING btree (company_id, status);

create table if not exists public."project_budget_lines"(
 "id" uuid default gen_random_uuid() not null,
 "company_id" uuid not null,
 "budget_id" uuid not null,
 "budget_section_id" uuid,
 "source_estimate_item_id" uuid,
 "item_type" text not null,
 "cost_code_id" uuid,
 "catalog_item_id" uuid,
 "crew_member_id" uuid,
 "labor_task" text,
 "risk_class_code" text,
 "description" text not null,
 "quantity" numeric(12,4) default 0 not null,
 "unit" text default 'LS'::text not null,
 "unit_cost" numeric(12,4) default 0 not null,
 "direct_cost" numeric(14,2) default 0 not null,
 "regular_hours" numeric(10,2) default 0 not null,
 "overtime_hours" numeric(10,2) default 0 not null,
 "notes" text,
 "sort_order" integer default 0 not null,
 "created_at" timestamp with time zone default now() not null,
 "source_change_order_item_id" uuid,
 "source_takeoff_output_id" uuid,
 "source_takeoff_measurement_id" uuid,
 "source_assembly_version_id" uuid,
 "production_task_id" uuid,
 "production_quantity" numeric,
 "production_unit" text,
 "baseline_man_hours_per_unit" numeric,
 "baseline_source" text,
 constraint "project_budget_lines_budget_id_fkey" FOREIGN KEY (budget_id) REFERENCES project_budgets(id) ON DELETE CASCADE,
 constraint "project_budget_lines_budget_section_id_fkey" FOREIGN KEY (budget_section_id) REFERENCES project_budget_sections(id) ON DELETE SET NULL,
 constraint "project_budget_lines_catalog_item_id_fkey" FOREIGN KEY (catalog_item_id) REFERENCES cost_catalog_items(id) ON DELETE SET NULL,
 constraint "project_budget_lines_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
 constraint "project_budget_lines_cost_code_id_fkey" FOREIGN KEY (cost_code_id) REFERENCES cost_codes(id) ON DELETE RESTRICT,
 constraint "project_budget_lines_crew_member_id_fkey" FOREIGN KEY (crew_member_id) REFERENCES crew_members(id) ON DELETE SET NULL,
 constraint "project_budget_lines_pkey" PRIMARY KEY (id),
 constraint "project_budget_lines_production_task_id_fkey" FOREIGN KEY (production_task_id) REFERENCES production_tasks(id) ON DELETE SET NULL,
 constraint "project_budget_lines_source_assembly_version_id_fkey" FOREIGN KEY (source_assembly_version_id) REFERENCES concrete_assembly_versions(id) ON DELETE SET NULL,
 constraint "project_budget_lines_source_change_order_item_id_fkey" FOREIGN KEY (source_change_order_item_id) REFERENCES change_order_items(id) ON DELETE SET NULL,
 constraint "project_budget_lines_source_estimate_item_id_fkey" FOREIGN KEY (source_estimate_item_id) REFERENCES estimate_items(id) ON DELETE SET NULL,
 constraint "project_budget_lines_source_takeoff_measurement_id_fkey" FOREIGN KEY (source_takeoff_measurement_id) REFERENCES takeoff_measurements(id) ON DELETE SET NULL,
 constraint "project_budget_lines_source_takeoff_output_id_fkey" FOREIGN KEY (source_takeoff_output_id) REFERENCES takeoff_measurement_outputs(id) ON DELETE SET NULL
);
alter table public."project_budget_lines" enable row level security;
do $rls$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='project_budget_lines' and policyname='company access budget lines') then create policy "company access budget lines" on public."project_budget_lines" as PERMISSIVE for ALL to authenticated using((company_id = get_my_company_id())) with check((company_id = get_my_company_id()));end if;end $rls$;
alter policy "company access budget lines" on public."project_budget_lines" to authenticated;
revoke all on public."project_budget_lines" from public,anon,authenticated;
grant select,insert,update,delete on public."project_budget_lines" to authenticated;

create index if not exists budget_lines_budget_idx ON public.project_budget_lines USING btree (budget_id, sort_order);
create index if not exists project_budget_lines_assembly_version_idx ON public.project_budget_lines USING btree (source_assembly_version_id) WHERE (source_assembly_version_id IS NOT NULL);
create index if not exists project_budget_lines_production_task_idx ON public.project_budget_lines USING btree (production_task_id) WHERE (production_task_id IS NOT NULL);
create index if not exists project_budget_lines_takeoff_measurement_idx ON public.project_budget_lines USING btree (source_takeoff_measurement_id) WHERE (source_takeoff_measurement_id IS NOT NULL);
create index if not exists project_budget_lines_takeoff_output_idx ON public.project_budget_lines USING btree (source_takeoff_output_id) WHERE (source_takeoff_output_id IS NOT NULL);

create table if not exists public."project_document_sequences"(
 "company_id" uuid not null,
 "project_id" uuid not null,
 "document_type" text not null,
 "next_number" integer default 1 not null,
 constraint "project_document_sequences_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
 constraint "project_document_sequences_pkey" PRIMARY KEY (project_id, document_type),
 constraint "project_document_sequences_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
alter table public."project_document_sequences" enable row level security;
-- Internal ledger: no direct authenticated policy or table grant.
revoke all on public."project_document_sequences" from public,anon,authenticated;


create table if not exists public."vendors"(
 "id" uuid default gen_random_uuid() not null,
 "company_id" uuid not null,
 "name" text not null,
 "vendor_type" text default 'other'::text not null,
 "contact_name" text,
 "email" text,
 "phone" text,
 "address_line1" text,
 "address_line2" text,
 "city" text,
 "state" text,
 "postal_code" text,
 "payment_terms" text,
 "account_number" text,
 "notes" text,
 "active" boolean default true not null,
 "created_at" timestamp with time zone default now() not null,
 "updated_at" timestamp with time zone default now() not null,
 constraint "vendors_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
 constraint "vendors_company_id_name_key" UNIQUE (company_id, name),
 constraint "vendors_pkey" PRIMARY KEY (id),
 constraint "vendors_vendor_type_check" CHECK (vendor_type = ANY (ARRAY['concrete_supplier'::text, 'pump'::text, 'rebar_supplier'::text, 'building_materials'::text, 'equipment_rental'::text, 'trucking'::text, 'traffic_control'::text, 'subcontractor'::text, 'other'::text]))
);
alter table public."vendors" enable row level security;
do $rls$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='vendors' and policyname='company access vendors') then create policy "company access vendors" on public."vendors" as PERMISSIVE for ALL to authenticated using((company_id = get_my_company_id())) with check((company_id = get_my_company_id()));end if;end $rls$;
alter policy "company access vendors" on public."vendors" to authenticated;
revoke all on public."vendors" from public,anon,authenticated;
grant select,insert,update,delete on public."vendors" to authenticated;


create table if not exists public."bank_reconciliation_rules"(
 "id" uuid default gen_random_uuid() not null,
 "company_id" uuid not null,
 "name" text not null,
 "merchant_pattern" text not null,
 "direction" text default 'outflow'::text not null,
 "category_primary" text,
 "action_type" text not null,
 "overhead_item_id" uuid,
 "expense_category" text,
 "cost_code_id" uuid,
 "vendor_id" uuid,
 "business_use_percent" numeric default 100 not null,
 "auto_apply" boolean default false not null,
 "active" boolean default true not null,
 "use_count" integer default 0 not null,
 "last_used_at" timestamp with time zone,
 "created_by" uuid,
 "created_at" timestamp with time zone default now() not null,
 "updated_at" timestamp with time zone default now() not null,
 constraint "bank_reconciliation_rules_action_type_check" CHECK (action_type = ANY (ARRAY['company_expense'::text, 'job_cost'::text, 'ignore'::text])),
 constraint "bank_reconciliation_rules_business_use_percent_check" CHECK (business_use_percent >= 0::numeric AND business_use_percent <= 100::numeric),
 constraint "bank_reconciliation_rules_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
 constraint "bank_reconciliation_rules_cost_code_id_fkey" FOREIGN KEY (cost_code_id) REFERENCES cost_codes(id) ON DELETE SET NULL,
 constraint "bank_reconciliation_rules_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL,
 constraint "bank_reconciliation_rules_direction_check" CHECK (direction = ANY (ARRAY['inflow'::text, 'outflow'::text, 'any'::text])),
 constraint "bank_reconciliation_rules_overhead_item_id_fkey" FOREIGN KEY (overhead_item_id) REFERENCES overhead_items(id) ON DELETE SET NULL,
 constraint "bank_reconciliation_rules_pkey" PRIMARY KEY (id),
 constraint "bank_reconciliation_rules_vendor_id_fkey" FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL
);
alter table public."bank_reconciliation_rules" enable row level security;
do $rls$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='bank_reconciliation_rules' and policyname='company access bank reconciliation rules') then create policy "company access bank reconciliation rules" on public."bank_reconciliation_rules" as PERMISSIVE for ALL to authenticated using((company_id = get_my_company_id())) with check((company_id = get_my_company_id()));end if;end $rls$;
alter policy "company access bank reconciliation rules" on public."bank_reconciliation_rules" to authenticated;
revoke all on public."bank_reconciliation_rules" from public,anon,authenticated;
grant select,insert,update,delete on public."bank_reconciliation_rules" to authenticated;

create index if not exists bank_reconciliation_rules_company_idx ON public.bank_reconciliation_rules USING btree (company_id, active);

create table if not exists public."bid_scope_comparison_items"(
 "id" uuid default gen_random_uuid() not null,
 "company_id" uuid not null,
 "lead_id" uuid not null,
 "estimate_id" uuid,
 "bid_price_feedback_id" uuid,
 "description" text not null,
 "carez_status" text default 'included'::text not null,
 "competitor_status" text default 'unknown'::text not null,
 "equalization_amount" numeric default 0 not null,
 "note" text,
 "sort_order" integer default 0 not null,
 "created_by" uuid,
 "created_at" timestamp with time zone default now() not null,
 "updated_at" timestamp with time zone default now() not null,
 constraint "bid_scope_comparison_items_bid_price_feedback_id_fkey" FOREIGN KEY (bid_price_feedback_id) REFERENCES bid_price_feedback(id) ON DELETE SET NULL,
 constraint "bid_scope_comparison_items_carez_status_check" CHECK (carez_status = ANY (ARRAY['included'::text, 'excluded'::text, 'allowance'::text, 'unknown'::text])),
 constraint "bid_scope_comparison_items_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
 constraint "bid_scope_comparison_items_competitor_status_check" CHECK (competitor_status = ANY (ARRAY['included'::text, 'excluded'::text, 'allowance'::text, 'unknown'::text])),
 constraint "bid_scope_comparison_items_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL,
 constraint "bid_scope_comparison_items_estimate_id_fkey" FOREIGN KEY (estimate_id) REFERENCES estimates(id) ON DELETE SET NULL,
 constraint "bid_scope_comparison_items_lead_id_fkey" FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
 constraint "bid_scope_comparison_items_pkey" PRIMARY KEY (id)
);
alter table public."bid_scope_comparison_items" enable row level security;
do $rls$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='bid_scope_comparison_items' and policyname='office access bid scope comparison') then create policy "office access bid scope comparison" on public."bid_scope_comparison_items" as PERMISSIVE for ALL to authenticated using(((company_id = get_my_company_id()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role <> 'employee'::text)))))) with check(((company_id = get_my_company_id()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role <> 'employee'::text))))));end if;end $rls$;
alter policy "office access bid scope comparison" on public."bid_scope_comparison_items" to authenticated;
revoke all on public."bid_scope_comparison_items" from public,anon,authenticated;
grant select,insert,update,delete on public."bid_scope_comparison_items" to authenticated;

create index if not exists bid_scope_comparison_lead_idx ON public.bid_scope_comparison_items USING btree (lead_id, sort_order, created_at);

create table if not exists public."company_cash_balance_snapshots"(
 "id" uuid default gen_random_uuid() not null,
 "company_id" uuid not null,
 "cash_account_id" uuid not null,
 "balance_date" date default CURRENT_DATE not null,
 "balance" numeric(14,2) not null,
 "notes" text,
 "created_by" uuid,
 "created_at" timestamp with time zone default now() not null,
 constraint "company_cash_balance_snapshots_cash_account_id_balance_date_key" UNIQUE (cash_account_id, balance_date),
 constraint "company_cash_balance_snapshots_cash_account_id_fkey" FOREIGN KEY (cash_account_id) REFERENCES company_cash_accounts(id) ON DELETE CASCADE,
 constraint "company_cash_balance_snapshots_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
 constraint "company_cash_balance_snapshots_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL,
 constraint "company_cash_balance_snapshots_pkey" PRIMARY KEY (id)
);
alter table public."company_cash_balance_snapshots" enable row level security;
do $rls$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='company_cash_balance_snapshots' and policyname='company access cash balances') then create policy "company access cash balances" on public."company_cash_balance_snapshots" as PERMISSIVE for ALL to authenticated using((company_id = get_my_company_id())) with check((company_id = get_my_company_id()));end if;end $rls$;
alter policy "company access cash balances" on public."company_cash_balance_snapshots" to authenticated;
revoke all on public."company_cash_balance_snapshots" from public,anon,authenticated;
grant select,insert,update,delete on public."company_cash_balance_snapshots" to authenticated;

create index if not exists cash_balance_account_date_idx ON public.company_cash_balance_snapshots USING btree (cash_account_id, balance_date DESC, created_at DESC);

create table if not exists public."equipment_reservations"(
 "id" uuid default gen_random_uuid() not null,
 "company_id" uuid not null,
 "resource_requirement_id" uuid not null,
 "equipment_asset_id" uuid not null,
 "start_date" date not null,
 "end_date" date not null,
 "status" text default 'planned'::text not null,
 "notes" text,
 "created_by" uuid,
 "created_at" timestamp with time zone default now() not null,
 "updated_at" timestamp with time zone default now() not null,
 constraint "equipment_reservations_check" CHECK (end_date >= start_date),
 constraint "equipment_reservations_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
 constraint "equipment_reservations_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL,
 constraint "equipment_reservations_equipment_asset_id_fkey" FOREIGN KEY (equipment_asset_id) REFERENCES equipment_assets(id) ON DELETE CASCADE,
 constraint "equipment_reservations_pkey" PRIMARY KEY (id),
 constraint "equipment_reservations_resource_requirement_id_fkey" FOREIGN KEY (resource_requirement_id) REFERENCES work_package_resource_requirements(id) ON DELETE CASCADE,
 constraint "equipment_reservations_resource_requirement_id_key" UNIQUE (resource_requirement_id),
 constraint "equipment_reservations_status_check" CHECK (status = ANY (ARRAY['planned'::text, 'confirmed'::text, 'completed'::text, 'cancelled'::text]))
);
alter table public."equipment_reservations" enable row level security;
do $rls$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='equipment_reservations' and policyname='office access equipment reservations') then create policy "office access equipment reservations" on public."equipment_reservations" as PERMISSIVE for ALL to authenticated using(((company_id = get_my_company_id()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role <> 'employee'::text)))))) with check(((company_id = get_my_company_id()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role <> 'employee'::text))))));end if;end $rls$;
alter policy "office access equipment reservations" on public."equipment_reservations" to authenticated;
revoke all on public."equipment_reservations" from public,anon,authenticated;
grant select,insert,update,delete on public."equipment_reservations" to authenticated;

create index if not exists equipment_reservations_asset_dates_idx ON public.equipment_reservations USING btree (equipment_asset_id, start_date, end_date, status);

create table if not exists public."equipment_service_logs"(
 "id" uuid default gen_random_uuid() not null,
 "company_id" uuid not null,
 "equipment_id" uuid not null,
 "service_date" date default CURRENT_DATE not null,
 "meter_hours" numeric,
 "description" text not null,
 "cost" numeric default 0 not null,
 "vendor" text,
 "next_service_date" date,
 "notes" text,
 "created_at" timestamp with time zone default now() not null,
 constraint "equipment_service_logs_equipment_id_fkey" FOREIGN KEY (equipment_id) REFERENCES equipment_assets(id) ON DELETE CASCADE,
 constraint "equipment_service_logs_pkey" PRIMARY KEY (id)
);
alter table public."equipment_service_logs" enable row level security;
do $rls$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='equipment_service_logs' and policyname='company access equipment service') then create policy "company access equipment service" on public."equipment_service_logs" as PERMISSIVE for ALL to authenticated using(((company_id = get_my_company_id()) AND (get_my_role() <> 'employee'::text))) with check(((company_id = get_my_company_id()) AND (get_my_role() <> 'employee'::text)));end if;end $rls$;
alter policy "company access equipment service" on public."equipment_service_logs" to authenticated;
revoke all on public."equipment_service_logs" from public,anon,authenticated;
grant select,insert,update,delete on public."equipment_service_logs" to authenticated;


create table if not exists public."inventory_reservations"(
 "id" uuid default gen_random_uuid() not null,
 "company_id" uuid not null,
 "resource_requirement_id" uuid not null,
 "inventory_item_id" uuid not null,
 "quantity" numeric not null,
 "status" text default 'reserved'::text not null,
 "notes" text,
 "created_by" uuid,
 "created_at" timestamp with time zone default now() not null,
 "updated_at" timestamp with time zone default now() not null,
 constraint "inventory_reservations_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
 constraint "inventory_reservations_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL,
 constraint "inventory_reservations_inventory_item_id_fkey" FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE CASCADE,
 constraint "inventory_reservations_pkey" PRIMARY KEY (id),
 constraint "inventory_reservations_quantity_check" CHECK (quantity > 0::numeric),
 constraint "inventory_reservations_resource_requirement_id_fkey" FOREIGN KEY (resource_requirement_id) REFERENCES work_package_resource_requirements(id) ON DELETE CASCADE,
 constraint "inventory_reservations_resource_requirement_id_key" UNIQUE (resource_requirement_id),
 constraint "inventory_reservations_status_check" CHECK (status = ANY (ARRAY['reserved'::text, 'consumed'::text, 'released'::text, 'cancelled'::text]))
);
alter table public."inventory_reservations" enable row level security;
do $rls$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='inventory_reservations' and policyname='office access inventory reservations') then create policy "office access inventory reservations" on public."inventory_reservations" as PERMISSIVE for ALL to authenticated using(((company_id = get_my_company_id()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role <> 'employee'::text)))))) with check(((company_id = get_my_company_id()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role <> 'employee'::text))))));end if;end $rls$;
alter policy "office access inventory reservations" on public."inventory_reservations" to authenticated;
revoke all on public."inventory_reservations" from public,anon,authenticated;
grant select,insert,update,delete on public."inventory_reservations" to authenticated;

create index if not exists inventory_reservations_item_idx ON public.inventory_reservations USING btree (inventory_item_id, status);

create table if not exists public."inventory_transactions"(
 "id" uuid default gen_random_uuid() not null,
 "company_id" uuid not null,
 "inventory_item_id" uuid not null,
 "project_id" uuid,
 "transaction_type" text not null,
 "quantity" numeric not null,
 "unit_cost" numeric,
 "transaction_date" date default CURRENT_DATE not null,
 "note" text,
 "created_by" uuid,
 "created_at" timestamp with time zone default now() not null,
 "work_package_operation_id" uuid,
 constraint "inventory_transactions_inventory_item_id_fkey" FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE CASCADE,
 constraint "inventory_transactions_pkey" PRIMARY KEY (id),
 constraint "inventory_transactions_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
 constraint "inventory_transactions_work_package_operation_id_fkey" FOREIGN KEY (work_package_operation_id) REFERENCES work_package_operations(id) ON DELETE SET NULL
);
alter table public."inventory_transactions" enable row level security;
do $rls$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='inventory_transactions' and policyname='company access inventory transactions') then create policy "company access inventory transactions" on public."inventory_transactions" as PERMISSIVE for ALL to authenticated using(((company_id = get_my_company_id()) AND (get_my_role() <> 'employee'::text))) with check(((company_id = get_my_company_id()) AND (get_my_role() <> 'employee'::text)));end if;end $rls$;
alter policy "company access inventory transactions" on public."inventory_transactions" to authenticated;
revoke all on public."inventory_transactions" from public,anon,authenticated;
grant select,insert,update,delete on public."inventory_transactions" to authenticated;

create index if not exists inventory_transactions_work_package_operation_idx ON public.inventory_transactions USING btree (work_package_operation_id);

create table if not exists public."lead_inbox_candidates"(
 "id" uuid default gen_random_uuid() not null,
 "company_id" uuid not null,
 "outlook_message_id" uuid not null,
 "status" text default 'pending'::text not null,
 "confidence" numeric default 0 not null,
 "customer_name" text,
 "contact_name" text,
 "email" text,
 "phone" text,
 "project_name" text,
 "address" text,
 "city" text,
 "state" text default 'WA'::text,
 "postal_code" text,
 "scope" text,
 "bid_due" date,
 "created_lead_id" uuid,
 "created_at" timestamp with time zone default now() not null,
 "updated_at" timestamp with time zone default now() not null,
 constraint "lead_inbox_candidates_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
 constraint "lead_inbox_candidates_company_id_outlook_message_id_key" UNIQUE (company_id, outlook_message_id),
 constraint "lead_inbox_candidates_created_lead_id_fkey" FOREIGN KEY (created_lead_id) REFERENCES leads(id) ON DELETE SET NULL,
 constraint "lead_inbox_candidates_outlook_message_id_fkey" FOREIGN KEY (outlook_message_id) REFERENCES outlook_messages(id) ON DELETE CASCADE,
 constraint "lead_inbox_candidates_pkey" PRIMARY KEY (id),
 constraint "lead_inbox_candidates_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'created'::text, 'merged'::text, 'ignored'::text]))
);
alter table public."lead_inbox_candidates" enable row level security;
do $rls$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='lead_inbox_candidates' and policyname='owner access lead inbox candidates') then create policy "owner access lead inbox candidates" on public."lead_inbox_candidates" as PERMISSIVE for ALL to authenticated using(((company_id = get_my_company_id()) AND (get_my_role() <> 'employee'::text))) with check(((company_id = get_my_company_id()) AND (get_my_role() <> 'employee'::text)));end if;end $rls$;
alter policy "owner access lead inbox candidates" on public."lead_inbox_candidates" to authenticated;
revoke all on public."lead_inbox_candidates" from public,anon,authenticated;
grant select,insert,update,delete on public."lead_inbox_candidates" to authenticated;


create table if not exists public."plaid_accounts"(
 "id" uuid default gen_random_uuid() not null,
 "company_id" uuid not null,
 "connection_id" uuid not null,
 "plaid_account_id" text not null,
 "name" text not null,
 "official_name" text,
 "mask" text,
 "account_type" text,
 "account_subtype" text,
 "iso_currency_code" text,
 "current_balance" numeric(14,2),
 "available_balance" numeric(14,2),
 "include_in_cash" boolean default false not null,
 "active" boolean default true not null,
 "last_balance_at" timestamp with time zone,
 "created_at" timestamp with time zone default now() not null,
 "updated_at" timestamp with time zone default now() not null,
 constraint "plaid_accounts_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
 constraint "plaid_accounts_company_id_plaid_account_id_key" UNIQUE (company_id, plaid_account_id),
 constraint "plaid_accounts_connection_id_fkey" FOREIGN KEY (connection_id) REFERENCES plaid_connections(id) ON DELETE CASCADE,
 constraint "plaid_accounts_pkey" PRIMARY KEY (id)
);
alter table public."plaid_accounts" enable row level security;
do $rls$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='plaid_accounts' and policyname='plaid_accounts_company_policy') then create policy "plaid_accounts_company_policy" on public."plaid_accounts" as PERMISSIVE for ALL to authenticated using((company_id = get_my_company_id())) with check((company_id = get_my_company_id()));end if;end $rls$;
alter policy "plaid_accounts_company_policy" on public."plaid_accounts" to authenticated;
revoke all on public."plaid_accounts" from public,anon,authenticated;
grant select,insert,update,delete on public."plaid_accounts" to authenticated;

create index if not exists plaid_accounts_company_idx ON public.plaid_accounts USING btree (company_id, include_in_cash, active);

create table if not exists public."vendor_quotes"(
 "id" uuid default gen_random_uuid() not null,
 "company_id" uuid not null,
 "project_id" uuid not null,
 "vendor_id" uuid not null,
 "internal_quote_number" text not null,
 "vendor_quote_number" text,
 "quote_date" date default CURRENT_DATE not null,
 "expires_on" date,
 "status" text default 'received'::text not null,
 "budget_section_id" uuid,
 "change_order_id" uuid,
 "pour_plan_id" uuid,
 "notes" text,
 "created_by" uuid,
 "created_at" timestamp with time zone default now() not null,
 "updated_at" timestamp with time zone default now() not null,
 constraint "vendor_quotes_budget_section_id_fkey" FOREIGN KEY (budget_section_id) REFERENCES project_budget_sections(id) ON DELETE SET NULL,
 constraint "vendor_quotes_change_order_id_fkey" FOREIGN KEY (change_order_id) REFERENCES change_orders(id) ON DELETE SET NULL,
 constraint "vendor_quotes_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
 constraint "vendor_quotes_company_id_internal_quote_number_key" UNIQUE (company_id, internal_quote_number),
 constraint "vendor_quotes_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL,
 constraint "vendor_quotes_pkey" PRIMARY KEY (id),
 constraint "vendor_quotes_pour_plan_id_fkey" FOREIGN KEY (pour_plan_id) REFERENCES pour_plans(id) ON DELETE SET NULL,
 constraint "vendor_quotes_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
 constraint "vendor_quotes_status_check" CHECK (status = ANY (ARRAY['received'::text, 'accepted'::text, 'rejected'::text, 'expired'::text, 'converted'::text])),
 constraint "vendor_quotes_vendor_id_fkey" FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE RESTRICT
);
alter table public."vendor_quotes" enable row level security;
do $rls$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='vendor_quotes' and policyname='company access vendor_quotes') then create policy "company access vendor_quotes" on public."vendor_quotes" as PERMISSIVE for ALL to authenticated using((company_id = get_my_company_id())) with check((company_id = get_my_company_id()));end if;end $rls$;
alter policy "company access vendor_quotes" on public."vendor_quotes" to authenticated;
revoke all on public."vendor_quotes" from public,anon,authenticated;
grant select,insert,update,delete on public."vendor_quotes" to authenticated;


create table if not exists public."plaid_transactions"(
 "id" uuid default gen_random_uuid() not null,
 "company_id" uuid not null,
 "connection_id" uuid not null,
 "account_id" uuid,
 "plaid_transaction_id" text not null,
 "plaid_account_id" text not null,
 "transaction_date" date not null,
 "authorized_date" date,
 "name" text not null,
 "merchant_name" text,
 "plaid_amount" numeric(14,2) default 0 not null,
 "cash_amount" numeric(14,2) default 0 not null,
 "pending" boolean default false not null,
 "payment_channel" text,
 "category_primary" text,
 "category_detailed" text,
 "website" text,
 "logo_url" text,
 "removed" boolean default false not null,
 "review_status" text default 'unreviewed'::text not null,
 "matched_entity_type" text,
 "matched_entity_id" uuid,
 "match_note" text,
 "raw_data" jsonb,
 "created_at" timestamp with time zone default now() not null,
 "updated_at" timestamp with time zone default now() not null,
 "reconciled_at" timestamp with time zone,
 "reconciled_by" uuid,
 "reconciliation_source" text,
 "reconciliation_confidence" integer,
 "bank_rule_id" uuid,
 constraint "plaid_transactions_account_id_fkey" FOREIGN KEY (account_id) REFERENCES plaid_accounts(id) ON DELETE SET NULL,
 constraint "plaid_transactions_bank_rule_id_fkey" FOREIGN KEY (bank_rule_id) REFERENCES bank_reconciliation_rules(id) ON DELETE SET NULL,
 constraint "plaid_transactions_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
 constraint "plaid_transactions_company_id_plaid_transaction_id_key" UNIQUE (company_id, plaid_transaction_id),
 constraint "plaid_transactions_connection_id_fkey" FOREIGN KEY (connection_id) REFERENCES plaid_connections(id) ON DELETE CASCADE,
 constraint "plaid_transactions_pkey" PRIMARY KEY (id),
 constraint "plaid_transactions_reconciled_by_fkey" FOREIGN KEY (reconciled_by) REFERENCES auth.users(id) ON DELETE SET NULL,
 constraint "plaid_transactions_review_status_check" CHECK (review_status = ANY (ARRAY['unreviewed'::text, 'matched'::text, 'ignored'::text]))
);
alter table public."plaid_transactions" enable row level security;
do $rls$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='plaid_transactions' and policyname='plaid_transactions_company_policy') then create policy "plaid_transactions_company_policy" on public."plaid_transactions" as PERMISSIVE for ALL to authenticated using((company_id = get_my_company_id())) with check((company_id = get_my_company_id()));end if;end $rls$;
alter policy "plaid_transactions_company_policy" on public."plaid_transactions" to authenticated;
revoke all on public."plaid_transactions" from public,anon,authenticated;
grant select,insert,update,delete on public."plaid_transactions" to authenticated;

create index if not exists plaid_transactions_company_date_idx ON public.plaid_transactions USING btree (company_id, transaction_date DESC);
create index if not exists plaid_transactions_review_idx ON public.plaid_transactions USING btree (company_id, review_status, removed, pending);

create table if not exists public."purchase_orders"(
 "id" uuid default gen_random_uuid() not null,
 "company_id" uuid not null,
 "project_id" uuid not null,
 "vendor_id" uuid not null,
 "source_quote_id" uuid,
 "po_number" text not null,
 "status" text default 'draft'::text not null,
 "issue_date" date,
 "expected_delivery_date" date,
 "budget_section_id" uuid,
 "change_order_id" uuid,
 "pour_plan_id" uuid,
 "vendor_name_snapshot" text,
 "vendor_contact_snapshot" text,
 "vendor_email_snapshot" text,
 "vendor_phone_snapshot" text,
 "vendor_address_snapshot" text,
 "from_name_snapshot" text,
 "from_address_snapshot" text,
 "from_phone_snapshot" text,
 "from_email_snapshot" text,
 "from_ubi_snapshot" text,
 "from_license_snapshot" text,
 "delivery_instructions" text,
 "terms" text,
 "notes" text,
 "issued_at" timestamp with time zone,
 "closed_at" timestamp with time zone,
 "created_by" uuid,
 "created_at" timestamp with time zone default now() not null,
 "updated_at" timestamp with time zone default now() not null,
 "from_logo_storage_path_snapshot" text,
 constraint "purchase_orders_budget_section_id_fkey" FOREIGN KEY (budget_section_id) REFERENCES project_budget_sections(id) ON DELETE SET NULL,
 constraint "purchase_orders_change_order_id_fkey" FOREIGN KEY (change_order_id) REFERENCES change_orders(id) ON DELETE SET NULL,
 constraint "purchase_orders_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
 constraint "purchase_orders_company_id_po_number_key" UNIQUE (company_id, po_number),
 constraint "purchase_orders_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL,
 constraint "purchase_orders_pkey" PRIMARY KEY (id),
 constraint "purchase_orders_pour_plan_id_fkey" FOREIGN KEY (pour_plan_id) REFERENCES pour_plans(id) ON DELETE SET NULL,
 constraint "purchase_orders_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
 constraint "purchase_orders_source_quote_id_fkey" FOREIGN KEY (source_quote_id) REFERENCES vendor_quotes(id) ON DELETE SET NULL,
 constraint "purchase_orders_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'issued'::text, 'closed'::text, 'cancelled'::text])),
 constraint "purchase_orders_vendor_id_fkey" FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE RESTRICT
);
alter table public."purchase_orders" enable row level security;
do $rls$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='purchase_orders' and policyname='company access purchase_orders') then create policy "company access purchase_orders" on public."purchase_orders" as PERMISSIVE for ALL to authenticated using((company_id = get_my_company_id())) with check((company_id = get_my_company_id()));end if;end $rls$;
alter policy "company access purchase_orders" on public."purchase_orders" to authenticated;
revoke all on public."purchase_orders" from public,anon,authenticated;
grant select,insert,update,delete on public."purchase_orders" to authenticated;

create index if not exists purchase_orders_project_status_idx ON public.purchase_orders USING btree (project_id, status);

create table if not exists public."vendor_quote_lines"(
 "id" uuid default gen_random_uuid() not null,
 "company_id" uuid not null,
 "vendor_quote_id" uuid not null,
 "cost_code_id" uuid not null,
 "catalog_item_id" uuid,
 "pour_cost_item_id" uuid,
 "description" text not null,
 "quantity" numeric(12,4) default 1 not null,
 "unit" text default 'EA'::text not null,
 "unit_cost" numeric(12,4) default 0 not null,
 "subtotal" numeric(14,2) default 0 not null,
 "sales_tax" numeric(14,2) default 0 not null,
 "total_cost" numeric(14,2) default 0 not null,
 "notes" text,
 "sort_order" integer default 0 not null,
 "created_at" timestamp with time zone default now() not null,
 "updated_at" timestamp with time zone default now() not null,
 constraint "vendor_quote_lines_catalog_item_id_fkey" FOREIGN KEY (catalog_item_id) REFERENCES cost_catalog_items(id) ON DELETE SET NULL,
 constraint "vendor_quote_lines_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
 constraint "vendor_quote_lines_cost_code_id_fkey" FOREIGN KEY (cost_code_id) REFERENCES cost_codes(id) ON DELETE RESTRICT,
 constraint "vendor_quote_lines_pkey" PRIMARY KEY (id),
 constraint "vendor_quote_lines_pour_cost_item_id_fkey" FOREIGN KEY (pour_cost_item_id) REFERENCES pour_cost_items(id) ON DELETE SET NULL,
 constraint "vendor_quote_lines_quantity_check" CHECK (quantity >= 0::numeric),
 constraint "vendor_quote_lines_sales_tax_check" CHECK (sales_tax >= 0::numeric),
 constraint "vendor_quote_lines_subtotal_check" CHECK (subtotal >= 0::numeric),
 constraint "vendor_quote_lines_total_cost_check" CHECK (total_cost >= 0::numeric),
 constraint "vendor_quote_lines_unit_cost_check" CHECK (unit_cost >= 0::numeric),
 constraint "vendor_quote_lines_vendor_quote_id_fkey" FOREIGN KEY (vendor_quote_id) REFERENCES vendor_quotes(id) ON DELETE CASCADE
);
alter table public."vendor_quote_lines" enable row level security;
do $rls$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='vendor_quote_lines' and policyname='company access vendor_quote_lines') then create policy "company access vendor_quote_lines" on public."vendor_quote_lines" as PERMISSIVE for ALL to authenticated using((company_id = get_my_company_id())) with check((company_id = get_my_company_id()));end if;end $rls$;
alter policy "company access vendor_quote_lines" on public."vendor_quote_lines" to authenticated;
revoke all on public."vendor_quote_lines" from public,anon,authenticated;
grant select,insert,update,delete on public."vendor_quote_lines" to authenticated;


create table if not exists public."bank_reconciliation_candidates"(
 "id" uuid default gen_random_uuid() not null,
 "company_id" uuid not null,
 "bank_transaction_id" uuid not null,
 "candidate_type" text not null,
 "entity_type" text,
 "entity_id" uuid,
 "rule_id" uuid,
 "confidence" integer not null,
 "reason" text not null,
 "proposed_action" text,
 "metadata" jsonb default '{}'::jsonb not null,
 "status" text default 'active'::text not null,
 "created_at" timestamp with time zone default now() not null,
 "updated_at" timestamp with time zone default now() not null,
 constraint "bank_reconciliation_candidates_bank_transaction_id_fkey" FOREIGN KEY (bank_transaction_id) REFERENCES plaid_transactions(id) ON DELETE CASCADE,
 constraint "bank_reconciliation_candidates_candidate_type_check" CHECK (candidate_type = ANY (ARRAY['existing_customer_payment'::text, 'invoice_payment'::text, 'existing_vendor_payment'::text, 'vendor_bill_payment'::text, 'existing_company_expense'::text, 'company_expense'::text, 'existing_payroll'::text, 'payroll_run'::text, 'existing_tax_remittance'::text, 'tax_remittance'::text, 'internal_transfer'::text, 'job_cost'::text, 'ignore'::text])),
 constraint "bank_reconciliation_candidates_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
 constraint "bank_reconciliation_candidates_confidence_check" CHECK (confidence >= 0 AND confidence <= 100),
 constraint "bank_reconciliation_candidates_pkey" PRIMARY KEY (id),
 constraint "bank_reconciliation_candidates_rule_id_fkey" FOREIGN KEY (rule_id) REFERENCES bank_reconciliation_rules(id) ON DELETE SET NULL,
 constraint "bank_reconciliation_candidates_status_check" CHECK (status = ANY (ARRAY['active'::text, 'accepted'::text, 'rejected'::text, 'stale'::text]))
);
alter table public."bank_reconciliation_candidates" enable row level security;
do $rls$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='bank_reconciliation_candidates' and policyname='company access bank reconciliation candidates') then create policy "company access bank reconciliation candidates" on public."bank_reconciliation_candidates" as PERMISSIVE for ALL to authenticated using((company_id = get_my_company_id())) with check((company_id = get_my_company_id()));end if;end $rls$;
alter policy "company access bank reconciliation candidates" on public."bank_reconciliation_candidates" to authenticated;
revoke all on public."bank_reconciliation_candidates" from public,anon,authenticated;
grant select,insert,update,delete on public."bank_reconciliation_candidates" to authenticated;

create index if not exists bank_reconciliation_candidates_company_idx ON public.bank_reconciliation_candidates USING btree (company_id, status, confidence DESC);
create index if not exists bank_reconciliation_candidates_tx_idx ON public.bank_reconciliation_candidates USING btree (bank_transaction_id, status, confidence DESC);

create table if not exists public."company_expenses"(
 "id" uuid default gen_random_uuid() not null,
 "company_id" uuid not null,
 "overhead_item_id" uuid,
 "expense_date" date default CURRENT_DATE not null,
 "due_date" date,
 "category" text not null,
 "payee" text,
 "description" text not null,
 "subtotal" numeric(14,2) default 0 not null,
 "sales_tax" numeric(14,2) default 0 not null,
 "total_amount" numeric(14,2) default 0 not null,
 "business_use_percent" numeric(5,2) default 100 not null,
 "business_expense_amount" numeric(14,2) default 0 not null,
 "cash_source" text default 'company_account'::text not null,
 "payment_status" text default 'paid'::text not null,
 "paid_date" date,
 "payment_method" text,
 "reference_number" text,
 "receipt_reference" text,
 "notes" text,
 "created_by" uuid,
 "created_at" timestamp with time zone default now() not null,
 "updated_at" timestamp with time zone default now() not null,
 "source_type" text,
 "source_id" uuid,
 "bank_transaction_id" uuid,
 constraint "company_expenses_bank_transaction_id_fkey" FOREIGN KEY (bank_transaction_id) REFERENCES plaid_transactions(id) ON DELETE SET NULL,
 constraint "company_expenses_business_expense_amount_check" CHECK (business_expense_amount >= 0::numeric),
 constraint "company_expenses_business_use_percent_check" CHECK (business_use_percent >= 0::numeric AND business_use_percent <= 100::numeric),
 constraint "company_expenses_cash_source_check" CHECK (cash_source = ANY (ARRAY['company_account'::text, 'personal'::text, 'noncash'::text, 'other'::text])),
 constraint "company_expenses_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
 constraint "company_expenses_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL,
 constraint "company_expenses_overhead_item_id_fkey" FOREIGN KEY (overhead_item_id) REFERENCES overhead_items(id) ON DELETE SET NULL,
 constraint "company_expenses_payment_status_check" CHECK (payment_status = ANY (ARRAY['unpaid'::text, 'paid'::text, 'void'::text])),
 constraint "company_expenses_pkey" PRIMARY KEY (id),
 constraint "company_expenses_sales_tax_check" CHECK (sales_tax >= 0::numeric),
 constraint "company_expenses_subtotal_check" CHECK (subtotal >= 0::numeric),
 constraint "company_expenses_total_amount_check" CHECK (total_amount >= 0::numeric)
);
alter table public."company_expenses" enable row level security;
do $rls$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='company_expenses' and policyname='company access company expenses') then create policy "company access company expenses" on public."company_expenses" as PERMISSIVE for ALL to authenticated using((company_id = get_my_company_id())) with check((company_id = get_my_company_id()));end if;end $rls$;
alter policy "company access company expenses" on public."company_expenses" to authenticated;
revoke all on public."company_expenses" from public,anon,authenticated;
grant select,insert,update,delete on public."company_expenses" to authenticated;

create unique index if not exists company_expenses_bank_tx_uq ON public.company_expenses USING btree (company_id, bank_transaction_id) WHERE (bank_transaction_id IS NOT NULL);
create index if not exists company_expenses_company_date_idx ON public.company_expenses USING btree (company_id, expense_date DESC);
create index if not exists company_expenses_overhead_item_idx ON public.company_expenses USING btree (overhead_item_id);
create index if not exists company_expenses_payment_status_idx ON public.company_expenses USING btree (company_id, payment_status, due_date);
create unique index if not exists company_expenses_source_event_unique ON public.company_expenses USING btree (company_id, source_type, source_id) WHERE ((source_type IS NOT NULL) AND (source_id IS NOT NULL));

create table if not exists public."company_tax_remittances"(
 "id" uuid default gen_random_uuid() not null,
 "company_id" uuid not null,
 "tax_type" text not null,
 "payment_date" date default CURRENT_DATE not null,
 "amount" numeric(14,2) not null,
 "reference_number" text,
 "notes" text,
 "created_by" uuid,
 "created_at" timestamp with time zone default now() not null,
 "bank_transaction_id" uuid,
 constraint "company_tax_remittances_amount_check" CHECK (amount > 0::numeric),
 constraint "company_tax_remittances_bank_transaction_id_fkey" FOREIGN KEY (bank_transaction_id) REFERENCES plaid_transactions(id) ON DELETE SET NULL,
 constraint "company_tax_remittances_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
 constraint "company_tax_remittances_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL,
 constraint "company_tax_remittances_pkey" PRIMARY KEY (id),
 constraint "company_tax_remittances_tax_type_check" CHECK (tax_type = ANY (ARRAY['sales_tax'::text, 'bo'::text, 'payroll'::text, 'li'::text, 'other'::text]))
);
alter table public."company_tax_remittances" enable row level security;
do $rls$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='company_tax_remittances' and policyname='company access tax remittances') then create policy "company access tax remittances" on public."company_tax_remittances" as PERMISSIVE for ALL to authenticated using((company_id = get_my_company_id())) with check((company_id = get_my_company_id()));end if;end $rls$;
alter policy "company access tax remittances" on public."company_tax_remittances" to authenticated;
revoke all on public."company_tax_remittances" from public,anon,authenticated;
grant select,insert,update,delete on public."company_tax_remittances" to authenticated;

create unique index if not exists company_tax_remittances_bank_tx_uq ON public.company_tax_remittances USING btree (company_id, bank_transaction_id) WHERE (bank_transaction_id IS NOT NULL);
create index if not exists company_tax_remittances_company_date_idx ON public.company_tax_remittances USING btree (company_id, tax_type, payment_date DESC);

create table if not exists public."payroll_runs"(
 "id" uuid default gen_random_uuid() not null,
 "company_id" uuid not null,
 "period_start" date not null,
 "period_end" date not null,
 "pay_date" date,
 "status" text default 'draft'::text not null,
 "actual_cash_paid" numeric(14,2),
 "reference_number" text,
 "notes" text,
 "created_by" uuid,
 "approved_at" timestamp with time zone,
 "processed_at" timestamp with time zone,
 "voided_at" timestamp with time zone,
 "created_at" timestamp with time zone default now() not null,
 "updated_at" timestamp with time zone default now() not null,
 "bank_transaction_id" uuid,
 constraint "payroll_runs_actual_cash_paid_check" CHECK (actual_cash_paid IS NULL OR actual_cash_paid >= 0::numeric),
 constraint "payroll_runs_bank_transaction_id_fkey" FOREIGN KEY (bank_transaction_id) REFERENCES plaid_transactions(id) ON DELETE SET NULL,
 constraint "payroll_runs_check" CHECK (period_end >= period_start),
 constraint "payroll_runs_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
 constraint "payroll_runs_pkey" PRIMARY KEY (id),
 constraint "payroll_runs_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'approved'::text, 'processed'::text, 'void'::text]))
);
alter table public."payroll_runs" enable row level security;
do $rls$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='payroll_runs' and policyname='payroll_runs_company_policy') then create policy "payroll_runs_company_policy" on public."payroll_runs" as PERMISSIVE for ALL to authenticated using((company_id = get_my_company_id())) with check((company_id = get_my_company_id()));end if;end $rls$;
alter policy "payroll_runs_company_policy" on public."payroll_runs" to authenticated;
revoke all on public."payroll_runs" from public,anon,authenticated;
grant select,insert,update,delete on public."payroll_runs" to authenticated;

create unique index if not exists payroll_runs_bank_tx_uq ON public.payroll_runs USING btree (company_id, bank_transaction_id) WHERE (bank_transaction_id IS NOT NULL);
create index if not exists payroll_runs_company_status_idx ON public.payroll_runs USING btree (company_id, status, period_end DESC);

create table if not exists public."purchase_order_receipts"(
 "id" uuid default gen_random_uuid() not null,
 "company_id" uuid not null,
 "purchase_order_id" uuid not null,
 "purchase_order_line_id" uuid not null,
 "received_date" date default CURRENT_DATE not null,
 "quantity_received" numeric(12,4) default 0 not null,
 "delivery_ticket" text,
 "notes" text,
 "received_by" uuid,
 "created_at" timestamp with time zone default now() not null,
 constraint "purchase_order_receipts_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
 constraint "purchase_order_receipts_pkey" PRIMARY KEY (id),
 constraint "purchase_order_receipts_purchase_order_id_fkey" FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
 constraint "purchase_order_receipts_purchase_order_line_id_fkey" FOREIGN KEY (purchase_order_line_id) REFERENCES purchase_order_lines(id) ON DELETE CASCADE,
 constraint "purchase_order_receipts_quantity_received_check" CHECK (quantity_received >= 0::numeric),
 constraint "purchase_order_receipts_received_by_fkey" FOREIGN KEY (received_by) REFERENCES auth.users(id) ON DELETE SET NULL
);
alter table public."purchase_order_receipts" enable row level security;
do $rls$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='purchase_order_receipts' and policyname='company access purchase_order_receipts') then create policy "company access purchase_order_receipts" on public."purchase_order_receipts" as PERMISSIVE for ALL to authenticated using((company_id = get_my_company_id())) with check((company_id = get_my_company_id()));end if;end $rls$;
alter policy "company access purchase_order_receipts" on public."purchase_order_receipts" to authenticated;
revoke all on public."purchase_order_receipts" from public,anon,authenticated;
grant select,insert,update,delete on public."purchase_order_receipts" to authenticated;


create table if not exists public."vendor_bills"(
 "id" uuid default gen_random_uuid() not null,
 "company_id" uuid not null,
 "project_id" uuid not null,
 "vendor_id" uuid not null,
 "purchase_order_id" uuid,
 "vendor_bill_number" text not null,
 "bill_date" date default CURRENT_DATE not null,
 "due_date" date,
 "status" text default 'draft'::text not null,
 "notes" text,
 "posted_at" timestamp with time zone,
 "created_by" uuid,
 "created_at" timestamp with time zone default now() not null,
 "updated_at" timestamp with time zone default now() not null,
 constraint "vendor_bills_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
 constraint "vendor_bills_company_id_vendor_id_vendor_bill_number_key" UNIQUE (company_id, vendor_id, vendor_bill_number),
 constraint "vendor_bills_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL,
 constraint "vendor_bills_pkey" PRIMARY KEY (id),
 constraint "vendor_bills_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
 constraint "vendor_bills_purchase_order_id_fkey" FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE SET NULL,
 constraint "vendor_bills_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'posted'::text, 'void'::text])),
 constraint "vendor_bills_vendor_id_fkey" FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE RESTRICT
);
alter table public."vendor_bills" enable row level security;
do $rls$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='vendor_bills' and policyname='company access vendor_bills') then create policy "company access vendor_bills" on public."vendor_bills" as PERMISSIVE for ALL to authenticated using((company_id = get_my_company_id())) with check((company_id = get_my_company_id()));end if;end $rls$;
alter policy "company access vendor_bills" on public."vendor_bills" to authenticated;
revoke all on public."vendor_bills" from public,anon,authenticated;
grant select,insert,update,delete on public."vendor_bills" to authenticated;

create index if not exists vendor_bills_po_idx ON public.vendor_bills USING btree (purchase_order_id, status);

create table if not exists public."vendor_payments"(
 "id" uuid default gen_random_uuid() not null,
 "company_id" uuid not null,
 "vendor_id" uuid not null,
 "payment_date" date default CURRENT_DATE not null,
 "amount" numeric(14,2) not null,
 "processing_fee" numeric(12,2) default 0 not null,
 "payment_method" text default 'check'::text not null,
 "reference_number" text,
 "notes" text,
 "status" text default 'posted'::text not null,
 "created_by" uuid,
 "created_at" timestamp with time zone default now() not null,
 "updated_at" timestamp with time zone default now() not null,
 "voided_at" timestamp with time zone,
 "bank_transaction_id" uuid,
 constraint "vendor_payments_amount_check" CHECK (amount > 0::numeric),
 constraint "vendor_payments_bank_transaction_id_fkey" FOREIGN KEY (bank_transaction_id) REFERENCES plaid_transactions(id) ON DELETE SET NULL,
 constraint "vendor_payments_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
 constraint "vendor_payments_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL,
 constraint "vendor_payments_payment_method_check" CHECK (payment_method = ANY (ARRAY['check'::text, 'ach'::text, 'card'::text, 'cash'::text, 'wire'::text, 'other'::text])),
 constraint "vendor_payments_pkey" PRIMARY KEY (id),
 constraint "vendor_payments_processing_fee_check" CHECK (processing_fee >= 0::numeric),
 constraint "vendor_payments_status_check" CHECK (status = ANY (ARRAY['posted'::text, 'void'::text])),
 constraint "vendor_payments_vendor_id_fkey" FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE RESTRICT
);
alter table public."vendor_payments" enable row level security;
do $rls$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='vendor_payments' and policyname='company access vendor payments') then create policy "company access vendor payments" on public."vendor_payments" as PERMISSIVE for ALL to authenticated using((company_id = get_my_company_id())) with check((company_id = get_my_company_id()));end if;end $rls$;
alter policy "company access vendor payments" on public."vendor_payments" to authenticated;
revoke all on public."vendor_payments" from public,anon,authenticated;
grant select,insert,update,delete on public."vendor_payments" to authenticated;

create unique index if not exists vendor_payments_bank_tx_uq ON public.vendor_payments USING btree (company_id, bank_transaction_id) WHERE (bank_transaction_id IS NOT NULL);
create index if not exists vendor_payments_vendor_date_idx ON public.vendor_payments USING btree (vendor_id, payment_date DESC);

create table if not exists public."payroll_run_lines"(
 "id" uuid default gen_random_uuid() not null,
 "company_id" uuid not null,
 "payroll_run_id" uuid not null,
 "timecard_id" uuid not null,
 "crew_member_id" uuid,
 "worker_name" text not null,
 "work_date" date not null,
 "regular_hours" numeric(10,2) default 0 not null,
 "overtime_hours" numeric(10,2) default 0 not null,
 "gross_wages" numeric(14,2) default 0 not null,
 "employer_social_security" numeric(14,2) default 0 not null,
 "employer_medicare" numeric(14,2) default 0 not null,
 "employer_futa" numeric(14,2) default 0 not null,
 "employer_wa_sui" numeric(14,2) default 0 not null,
 "employer_li" numeric(14,2) default 0 not null,
 "sick_leave_reserve" numeric(14,2) default 0 not null,
 "payroll_funding_requirement" numeric(14,2) default 0 not null,
 "active" boolean default true not null,
 "created_at" timestamp with time zone default now() not null,
 constraint "payroll_run_lines_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
 constraint "payroll_run_lines_crew_member_id_fkey" FOREIGN KEY (crew_member_id) REFERENCES crew_members(id) ON DELETE SET NULL,
 constraint "payroll_run_lines_payroll_run_id_fkey" FOREIGN KEY (payroll_run_id) REFERENCES payroll_runs(id) ON DELETE CASCADE,
 constraint "payroll_run_lines_pkey" PRIMARY KEY (id),
 constraint "payroll_run_lines_timecard_id_fkey" FOREIGN KEY (timecard_id) REFERENCES timecards(id) ON DELETE RESTRICT
);
alter table public."payroll_run_lines" enable row level security;
do $rls$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='payroll_run_lines' and policyname='payroll_run_lines_company_policy') then create policy "payroll_run_lines_company_policy" on public."payroll_run_lines" as PERMISSIVE for ALL to authenticated using((company_id = get_my_company_id())) with check((company_id = get_my_company_id()));end if;end $rls$;
alter policy "payroll_run_lines_company_policy" on public."payroll_run_lines" to authenticated;
revoke all on public."payroll_run_lines" from public,anon,authenticated;
grant select,insert,update,delete on public."payroll_run_lines" to authenticated;

create index if not exists payroll_run_lines_company_worker_idx ON public.payroll_run_lines USING btree (company_id, crew_member_id);
create unique index if not exists payroll_run_lines_one_active_timecard ON public.payroll_run_lines USING btree (timecard_id) WHERE active;
create index if not exists payroll_run_lines_run_idx ON public.payroll_run_lines USING btree (payroll_run_id);

create table if not exists public."vendor_payment_allocations"(
 "id" uuid default gen_random_uuid() not null,
 "company_id" uuid not null,
 "vendor_payment_id" uuid not null,
 "vendor_bill_id" uuid not null,
 "amount" numeric(14,2) not null,
 "created_at" timestamp with time zone default now() not null,
 constraint "vendor_payment_allocations_amount_check" CHECK (amount > 0::numeric),
 constraint "vendor_payment_allocations_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
 constraint "vendor_payment_allocations_pkey" PRIMARY KEY (id),
 constraint "vendor_payment_allocations_vendor_bill_id_fkey" FOREIGN KEY (vendor_bill_id) REFERENCES vendor_bills(id) ON DELETE RESTRICT,
 constraint "vendor_payment_allocations_vendor_payment_id_fkey" FOREIGN KEY (vendor_payment_id) REFERENCES vendor_payments(id) ON DELETE CASCADE,
 constraint "vendor_payment_allocations_vendor_payment_id_vendor_bill_id_key" UNIQUE (vendor_payment_id, vendor_bill_id)
);
alter table public."vendor_payment_allocations" enable row level security;
do $rls$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='vendor_payment_allocations' and policyname='company access vendor payment allocations') then create policy "company access vendor payment allocations" on public."vendor_payment_allocations" as PERMISSIVE for ALL to authenticated using((company_id = get_my_company_id())) with check((company_id = get_my_company_id()));end if;end $rls$;
alter policy "company access vendor payment allocations" on public."vendor_payment_allocations" to authenticated;
revoke all on public."vendor_payment_allocations" from public,anon,authenticated;
grant select,insert,update,delete on public."vendor_payment_allocations" to authenticated;

create index if not exists vendor_payment_allocations_bill_idx ON public.vendor_payment_allocations USING btree (vendor_bill_id);
