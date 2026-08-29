-- Atomically file an uploaded PDF as a company plan document and bind it to one editable takeoff revision.
-- Storage upload happens before this RPC; if this transaction fails, the client removes that uploaded blob.

create or replace function public.carez_attach_takeoff_plan(
  p_takeoff_set_id uuid,
  p_storage_path text,
  p_source_filename text,
  p_mime_type text default 'application/pdf'
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_company_id uuid;
  v_estimate_id uuid;
  v_existing_document_id uuid;
  v_document_id uuid;
begin
  v_company_id := public.get_my_company_id();
  if v_company_id is null or not exists(
    select 1 from public.profiles p
    where p.id=(select auth.uid()) and p.role <> 'employee'
  ) then
    raise exception 'Owner access required.';
  end if;

  if nullif(trim(p_storage_path),'') is null or nullif(trim(p_source_filename),'') is null then
    raise exception 'PDF plan file is required.';
  end if;
  if lower(coalesce(p_mime_type,'')) <> 'application/pdf'
     and lower(p_source_filename) not like '%.pdf' then
    raise exception 'The drawing workspace currently requires a PDF plan set.';
  end if;

  select ts.estimate_id, ts.source_document_id
  into v_estimate_id, v_existing_document_id
  from public.takeoff_sets ts
  where ts.id=p_takeoff_set_id
    and ts.company_id=v_company_id
    and ts.status='active'
  for update;

  if v_estimate_id is null then raise exception 'Active takeoff set not found.'; end if;
  if v_existing_document_id is not null then
    raise exception 'This takeoff revision already has a source plan. Create a new takeoff/estimate revision to replace plans.';
  end if;

  if exists(
    select 1 from public.proposal_presentations pp
    where pp.company_id=v_company_id and pp.estimate_id=v_estimate_id
  ) or exists(
    select 1 from public.estimates e
    where e.id=v_estimate_id and e.company_id=v_company_id
      and e.status in ('accepted','approved','superseded')
  ) then
    raise exception 'This estimate revision is locked.';
  end if;

  if exists(
    select 1 from public.takeoff_measurements m
    where m.company_id=v_company_id
      and m.takeoff_set_id=p_takeoff_set_id
      and m.status='active'
  ) then
    raise exception 'This takeoff already contains measurements. Create a new takeoff revision before attaching different source plans.';
  end if;

  insert into public.company_documents(
    company_id,document_type,title,storage_path,mime_type,source,
    review_status,reviewed_at,reviewed_by,notes,created_by
  ) values (
    v_company_id,'plan',trim(p_source_filename),trim(p_storage_path),'application/pdf','upload',
    'filed',now(),(select auth.uid()),'Source plans for takeoff set '||p_takeoff_set_id::text,(select auth.uid())
  ) returning id into v_document_id;

  update public.takeoff_sets
  set source_document_id=v_document_id,
      source_filename=trim(p_source_filename),
      page_count=null
  where id=p_takeoff_set_id and company_id=v_company_id;

  return v_document_id;
end;
$$;

grant execute on function public.carez_attach_takeoff_plan(uuid,text,text,text) to authenticated;
revoke execute on function public.carez_attach_takeoff_plan(uuid,text,text,text) from public, anon;

comment on function public.carez_attach_takeoff_plan(uuid,text,text,text)
is 'Atomically creates the source plan document record and binds it to an editable takeoff revision; replacement requires a new revision.';
