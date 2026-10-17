-- Source terms for externally awarded jobs. Never amend an issued invoice or
-- infer net payment terms from the billing-application submission cutoff.
alter table public.project_external_intakes add column retainage_percent numeric(6,3) check(retainage_percent between 0 and 100);
alter table public.project_external_intakes add column billing_submission_day integer check(billing_submission_day between 1 and 31);
alter table public.project_external_intakes add column billing_submission_channel text;
alter table public.invoices add column retainage_source jsonb;
alter function public.carez_intake_external_job(uuid,jsonb) rename to carez_intake_external_job_source_core;
revoke all on function public.carez_intake_external_job_source_core(uuid,jsonb) from public,anon,authenticated;
create function public.carez_intake_external_job(p_request_id uuid,p_payload jsonb) returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare project uuid;percent numeric;day numeric;begin
 percent:=nullif(btrim(p_payload->>'retainage_percent'),'')::numeric;
 day:=nullif(btrim(p_payload->>'billing_submission_day'),'')::numeric;
 if percent is not null and (percent::text in ('NaN','Infinity','-Infinity') or percent<0 or percent>100 or percent<>round(percent,3)) then raise exception 'Recorded retainage must be finite between 0 and 100';end if;
 if day is not null and (day::text in ('NaN','Infinity','-Infinity') or day<1 or day>31 or day<>trunc(day)) then raise exception 'Submission cutoff must be an integer between 1 and 31';end if;
 project:=public.carez_intake_external_job_source_core(p_request_id,p_payload);
 update public.project_external_intakes set retainage_percent=percent,billing_submission_day=day::integer,billing_submission_channel=nullif(btrim(p_payload->>'billing_submission_channel'),'') where company_id=public.get_my_company_id() and project_id=project and request_id=p_request_id;
 if not found then raise exception 'External billing source was not confirmed';end if;return project;
end $$;
revoke all on function public.carez_intake_external_job(uuid,jsonb) from public,anon;
grant execute on function public.carez_intake_external_job(uuid,jsonb) to authenticated;
