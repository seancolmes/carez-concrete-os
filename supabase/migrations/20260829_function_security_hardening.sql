-- Carez OS: narrow callable function surfaces and pin trusted search paths.

alter function public.set_updated_at() set search_path to pg_catalog, public;
alter function public.normalize_bank_text(text) set search_path to pg_catalog, public;
alter function public.carez_distance_ft(double precision,double precision,double precision,double precision) set search_path to pg_catalog, public;

-- Trigger functions execute through their triggers and are not public RPCs.
revoke all on function public.carez_ticket_document_sync_trigger() from public, anon, authenticated;
revoke all on function public.carez_ticket_operation_insert_sync_trigger() from public, anon, authenticated;
revoke all on function public.carez_ticket_operation_sync_trigger() from public, anon, authenticated;
revoke all on function public.carez_ticket_po_line_sync_trigger() from public, anon, authenticated;
revoke all on function public.carez_ticket_po_status_sync_trigger() from public, anon, authenticated;
revoke all on function public.carez_ticket_pour_sync_trigger() from public, anon, authenticated;
revoke all on function public.carez_ticket_receipt_sync_trigger() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.rls_auto_enable() from public, anon, authenticated;

-- Field operations require an authenticated employee session.
revoke all on function public.employee_clock_in(uuid,double precision,double precision,numeric,text) from public, anon;
revoke all on function public.employee_clock_out(double precision,double precision,numeric,text) from public, anon;
revoke all on function public.employee_complete_work_package_operation(uuid) from public, anon;
revoke all on function public.employee_end_break() from public, anon;
revoke all on function public.employee_portal_state() from public, anon;
revoke all on function public.employee_report_production(uuid,numeric,text) from public, anon;
revoke all on function public.employee_start_break() from public, anon;
revoke all on function public.employee_start_task(uuid,double precision,double precision,numeric) from public, anon;
revoke all on function public.employee_start_work(uuid,double precision,double precision,numeric) from public, anon;
revoke all on function public.employee_stop_task(double precision,double precision,numeric) from public, anon;

grant execute on function public.employee_clock_in(uuid,double precision,double precision,numeric,text) to authenticated;
grant execute on function public.employee_clock_out(double precision,double precision,numeric,text) to authenticated;
grant execute on function public.employee_complete_work_package_operation(uuid) to authenticated;
grant execute on function public.employee_end_break() to authenticated;
grant execute on function public.employee_portal_state() to authenticated;
grant execute on function public.employee_report_production(uuid,numeric,text) to authenticated;
grant execute on function public.employee_start_break() to authenticated;
grant execute on function public.employee_start_task(uuid,double precision,double precision,numeric) to authenticated;
grant execute on function public.employee_start_work(uuid,double precision,double precision,numeric) to authenticated;
grant execute on function public.employee_stop_task(double precision,double precision,numeric) to authenticated;

revoke all on function public.next_opportunity_number() from public, anon;
grant execute on function public.next_opportunity_number() to authenticated;

-- Intentionally anonymous RPCs are left unchanged: public proposal flows,
-- employee invite preview, and Outlook webhook functions protected by a
-- subscription/client-state secret.
