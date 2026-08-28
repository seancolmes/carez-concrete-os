-- Project paperwork inherits the permanent job root.
-- Example: Job 26-001 -> 26-001-CO-001 and 26-001-PO-001.

create table if not exists public.project_document_sequences (
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  document_type text not null,
  next_number integer not null default 1,
  primary key(project_id,document_type)
);
alter table public.project_document_sequences enable row level security;

create or replace function public.allocate_project_document_number(p_company uuid,p_project uuid,p_document_type text,p_label text)
returns text
language plpgsql
security definer
set search_path=public
as $$
declare
  v_job text;
  v_next integer;
begin
  select job_number into v_job from public.projects where id=p_project and company_id=p_company;
  if v_job is null then raise exception 'Project/job number not found'; end if;
  insert into public.project_document_sequences(company_id,project_id,document_type,next_number)
  values(p_company,p_project,p_document_type,1)
  on conflict(project_id,document_type) do nothing;
  select next_number into v_next from public.project_document_sequences
  where project_id=p_project and document_type=p_document_type for update;
  update public.project_document_sequences set next_number=v_next+1
  where project_id=p_project and document_type=p_document_type;
  return v_job||'-'||p_label||'-'||lpad(v_next::text,3,'0');
end;
$$;
revoke all on function public.allocate_project_document_number(uuid,uuid,text,text) from public,anon,authenticated;

create or replace function public.carez_number_change_order()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  new.co_number:=public.allocate_project_document_number(new.company_id,new.project_id,'change_order','CO');
  return new;
end;
$$;
revoke all on function public.carez_number_change_order() from public,anon,authenticated;

drop trigger if exists carez_number_change_order on public.change_orders;
create trigger carez_number_change_order before insert on public.change_orders
for each row execute function public.carez_number_change_order();

create or replace function public.carez_number_purchase_order()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  new.po_number:=public.allocate_project_document_number(new.company_id,new.project_id,'purchase_order','PO');
  return new;
end;
$$;
revoke all on function public.carez_number_purchase_order() from public,anon,authenticated;

drop trigger if exists carez_number_purchase_order on public.purchase_orders;
create trigger carez_number_purchase_order before insert on public.purchase_orders
for each row execute function public.carez_number_purchase_order();
