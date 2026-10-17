-- RLS does not govern TRUNCATE or DDL-like table privileges. App roles need neither.
revoke truncate,references,trigger on all tables in schema public from public,anon,authenticated;

-- A restrictive predicate narrows retained production policies as well as the
-- source bootstrap, whose policy names differ. Employee work uses scoped RPCs.
do $$ declare relation_name text;begin
 foreach relation_name in array array[
  'plaid_connections','plaid_accounts','plaid_transactions','bank_reconciliation_rules','bank_reconciliation_candidates',
  'company_expenses','company_cash_accounts','company_cash_balance_snapshots','company_cash_reserves','company_tax_remittances',
  'vendor_bills','vendor_bill_lines','vendor_payments','vendor_payment_allocations','payroll_runs','payroll_run_lines',
  'employee_tax_status','labor_tax_settings','li_risk_classes','labor_configuration_versions','labor_tax_year_accounts',
  'labor_tax_allocations','labor_basis_reviews'
 ] loop
  if to_regclass('public.'||quote_ident(relation_name)) is null then raise exception 'Required financial relation missing: %',relation_name;end if;
  execute format('revoke all on public.%I from public,anon',relation_name);
  execute format('alter table public.%I enable row level security',relation_name);
  execute format('create policy financial_role_boundary on public.%I as restrictive for all to authenticated using(company_id=(select public.get_my_company_id()) and (select public.get_my_role()) in (''owner'',''office'')) with check(company_id=(select public.get_my_company_id()) and (select public.get_my_role()) in (''owner'',''office''))',relation_name);
 end loop;
end $$;
