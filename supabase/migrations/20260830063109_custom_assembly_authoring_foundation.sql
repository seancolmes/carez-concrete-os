-- Custom user-authored assembly foundation. Extends the existing immutable assembly/version model.

alter table public.concrete_assemblies
  add constraint concrete_assemblies_company_id_uk unique(company_id,id);

alter table public.concrete_assembly_versions
  add constraint concrete_assembly_versions_company_id_uk unique(company_id,id),
  add constraint concrete_assembly_versions_company_assembly_fk
    foreign key(company_id,assembly_id)
    references public.concrete_assemblies(company_id,id)
    on delete cascade;

alter table public.concrete_assembly_variables
  add constraint concrete_assembly_variables_company_version_id_uk unique(company_id,assembly_version_id,id),
  add constraint concrete_assembly_variables_company_version_fk
    foreign key(company_id,assembly_version_id)
    references public.concrete_assembly_versions(company_id,id)
    on delete cascade;

alter table public.concrete_assembly_components
  add constraint concrete_assembly_components_company_version_fk
    foreign key(company_id,assembly_version_id)
    references public.concrete_assembly_versions(company_id,id)
    on delete cascade;

alter table public.concrete_assembly_versions
  add column assembly_code_snapshot text,
  add column assembly_name_snapshot text,
  add column category_snapshot text,
  add column primary_measurement_snapshot text,
  add column description_snapshot text;

-- Published versions are immutable in normal operation. Disable only the two version-update triggers for this one metadata backfill.
alter table public.concrete_assembly_versions disable trigger carez_guard_published_assembly_version;
alter table public.concrete_assembly_versions disable trigger carez_concrete_assembly_versions_touch;
update public.concrete_assembly_versions v
set assembly_code_snapshot=a.code,
    assembly_name_snapshot=a.name,
    category_snapshot=a.category,
    primary_measurement_snapshot=a.primary_measurement,
    description_snapshot=a.description
from public.concrete_assemblies a
where a.id=v.assembly_id and a.company_id=v.company_id;
alter table public.concrete_assembly_versions enable trigger carez_concrete_assembly_versions_touch;
alter table public.concrete_assembly_versions enable trigger carez_guard_published_assembly_version;

alter table public.concrete_assembly_versions
  alter column assembly_code_snapshot set not null,
  alter column assembly_name_snapshot set not null,
  alter column category_snapshot set not null,
  alter column primary_measurement_snapshot set not null,
  add constraint concrete_assembly_versions_measurement_snapshot_chk
    check(primary_measurement_snapshot in ('LF','SF','EA','CY'));

create table public.concrete_assembly_folders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  parent_folder_id uuid,
  name text not null,
  description text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint concrete_assembly_folders_name_chk check(length(trim(name))>0),
  constraint concrete_assembly_folders_company_id_uk unique(company_id,id),
  constraint concrete_assembly_folders_parent_fk
    foreign key(company_id,parent_folder_id)
    references public.concrete_assembly_folders(company_id,id)
    on delete restrict
);
create unique index concrete_assembly_folders_sibling_name_uk
  on public.concrete_assembly_folders(
    company_id,
    coalesce(parent_folder_id,'00000000-0000-0000-0000-000000000000'::uuid),
    lower(name)
  ) where active;
create index concrete_assembly_folders_tree_idx
  on public.concrete_assembly_folders(company_id,parent_folder_id,sort_order,name);

alter table public.concrete_assemblies add column folder_id uuid;
alter table public.concrete_assemblies
  add constraint concrete_assemblies_folder_fk
    foreign key(company_id,folder_id)
    references public.concrete_assembly_folders(company_id,id)
    on delete restrict;
create index concrete_assemblies_folder_idx
  on public.concrete_assemblies(company_id,folder_id,active,category,name);

alter table public.concrete_assembly_variables
  add column property_group text,
  add column expose_in_takeoff boolean not null default true,
  add column allow_override boolean not null default true;

create table public.concrete_assembly_property_bindings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  assembly_version_id uuid not null,
  variable_id uuid not null,
  source_namespace text not null,
  source_key text not null,
  precedence integer not null default 100,
  notes text,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint concrete_assembly_property_bindings_namespace_chk
    check(source_namespace in ('takeoff','project','parent','plan_fact','property')),
  constraint concrete_assembly_property_bindings_key_chk check(length(trim(source_key))>0),
  constraint concrete_assembly_property_bindings_precedence_chk check(precedence between 0 and 10000),
  constraint concrete_assembly_property_bindings_variable_fk
    foreign key(company_id,assembly_version_id,variable_id)
    references public.concrete_assembly_variables(company_id,assembly_version_id,id)
    on delete cascade,
  constraint concrete_assembly_property_bindings_uk
    unique(assembly_version_id,variable_id,source_namespace,source_key)
);
create index concrete_assembly_property_bindings_version_idx
  on public.concrete_assembly_property_bindings(company_id,assembly_version_id,sort_order,precedence desc);

create table public.concrete_assembly_children (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  assembly_version_id uuid not null,
  child_assembly_version_id uuid not null,
  child_key text not null,
  label text not null,
  quantity_formula jsonb not null default '{"const":1}'::jsonb,
  variable_bindings jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint concrete_assembly_children_key_chk check(length(trim(child_key))>0),
  constraint concrete_assembly_children_label_chk check(length(trim(label))>0),
  constraint concrete_assembly_children_self_chk check(assembly_version_id<>child_assembly_version_id),
  constraint concrete_assembly_children_formula_chk check(jsonb_typeof(quantity_formula) in ('object','number')),
  constraint concrete_assembly_children_bindings_chk check(jsonb_typeof(variable_bindings)='object'),
  constraint concrete_assembly_children_parent_fk
    foreign key(company_id,assembly_version_id)
    references public.concrete_assembly_versions(company_id,id)
    on delete cascade,
  constraint concrete_assembly_children_child_fk
    foreign key(company_id,child_assembly_version_id)
    references public.concrete_assembly_versions(company_id,id)
    on delete restrict,
  constraint concrete_assembly_children_uk unique(assembly_version_id,child_key)
);
create index concrete_assembly_children_parent_idx
  on public.concrete_assembly_children(company_id,assembly_version_id,sort_order);
create index concrete_assembly_children_child_idx
  on public.concrete_assembly_children(company_id,child_assembly_version_id);

create or replace function public.carez_guard_published_assembly_child()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  v_old_status text;
  v_new_status text;
begin
  if tg_op in ('UPDATE','DELETE') then
    select status into v_old_status from public.concrete_assembly_versions where id=old.assembly_version_id;
    if v_old_status='published' then
      raise exception 'Published assembly components, properties, bindings, and child links are immutable. Create a new assembly version.';
    end if;
  end if;
  if tg_op in ('INSERT','UPDATE') then
    select status into v_new_status from public.concrete_assembly_versions where id=new.assembly_version_id;
    if v_new_status='published' then
      raise exception 'Published assembly components, properties, bindings, and child links are immutable. Create a new assembly version.';
    end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.carez_guard_published_assembly_child() from public,anon,authenticated;

create or replace function public.carez_guard_assembly_folder_cycle()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if new.parent_folder_id is null then return new; end if;
  if new.parent_folder_id=new.id then raise exception 'An assembly folder cannot contain itself.'; end if;
  if exists(
    with recursive ancestors(id,parent_folder_id) as (
      select f.id,f.parent_folder_id from public.concrete_assembly_folders f
      where f.company_id=new.company_id and f.id=new.parent_folder_id
      union
      select f.id,f.parent_folder_id from public.concrete_assembly_folders f
      join ancestors a on a.parent_folder_id=f.id
      where f.company_id=new.company_id
    )
    select 1 from ancestors where id=new.id
  ) then raise exception 'Assembly folder relationship would create a cycle.'; end if;
  return new;
end;
$$;
revoke all on function public.carez_guard_assembly_folder_cycle() from public,anon,authenticated;

create or replace function public.carez_guard_assembly_child_cycle()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if new.assembly_version_id=new.child_assembly_version_id then raise exception 'An assembly version cannot include itself.'; end if;
  if exists(
    with recursive descendants(version_id) as (
      select new.child_assembly_version_id
      union
      select c.child_assembly_version_id from public.concrete_assembly_children c
      join descendants d on d.version_id=c.assembly_version_id
      where c.company_id=new.company_id and c.id<>new.id
    )
    select 1 from descendants where version_id=new.assembly_version_id
  ) then raise exception 'Assembly child relationship would create a cycle.'; end if;
  return new;
end;
$$;
revoke all on function public.carez_guard_assembly_child_cycle() from public,anon,authenticated;

create or replace function public.carez_formula_ast_is_valid(p_expr jsonb)
returns boolean
language plpgsql
immutable
security invoker
set search_path=public
as $$
declare
  v_type text;
  v_op text;
  v_arg jsonb;
  v_case jsonb;
begin
  if p_expr is null then return false; end if;
  v_type:=jsonb_typeof(p_expr);
  if v_type='number' then return true; end if;
  if v_type<>'object' then return false; end if;
  if p_expr ? 'const' then return jsonb_typeof(p_expr->'const')='number'; end if;
  if p_expr ? 'var' then return jsonb_typeof(p_expr->'var')='string' and length(trim(p_expr->>'var'))>0; end if;
  v_op:=coalesce(p_expr->>'op','');
  if v_op in ('add','sub','mul','div','min','max') then
    if jsonb_typeof(p_expr->'args')<>'array' then return false; end if;
    if v_op='div' and jsonb_array_length(p_expr->'args')<>2 then return false; end if;
    for v_arg in select value from jsonb_array_elements(p_expr->'args') loop
      if not public.carez_formula_ast_is_valid(v_arg) then return false; end if;
    end loop;
    return true;
  elsif v_op in ('ceil','floor','round') then
    return public.carez_formula_ast_is_valid(p_expr->'value');
  elsif v_op='piecewise_lte' then
    if not public.carez_formula_ast_is_valid(p_expr->'value') or jsonb_typeof(p_expr->'cases')<>'array' then return false; end if;
    for v_case in select value from jsonb_array_elements(p_expr->'cases') loop
      if jsonb_typeof(v_case)<>'object' or jsonb_typeof(v_case->'lte')<>'number' or not (v_case ? 'then') or not public.carez_formula_ast_is_valid(v_case->'then') then return false; end if;
    end loop;
    return (p_expr ? 'else') and public.carez_formula_ast_is_valid(p_expr->'else');
  end if;
  return false;
end;
$$;
revoke all on function public.carez_formula_ast_is_valid(jsonb) from public,anon;
grant execute on function public.carez_formula_ast_is_valid(jsonb) to authenticated,service_role;

create or replace function public.carez_validate_assembly_version_publish()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if new.status='published' and old.status<>'published' then
    if not exists(select 1 from public.concrete_assembly_components c where c.company_id=new.company_id and c.assembly_version_id=new.id)
       and not exists(select 1 from public.concrete_assembly_children c where c.company_id=new.company_id and c.assembly_version_id=new.id) then
      raise exception 'An assembly version must contain at least one output component or child assembly before publishing.';
    end if;
    if exists(
      select 1 from public.concrete_assembly_components c
      where c.company_id=new.company_id and c.assembly_version_id=new.id
        and (not public.carez_formula_ast_is_valid(c.quantity_formula)
          or (c.labor_rate_formula is not null and not public.carez_formula_ast_is_valid(c.labor_rate_formula)))
    ) then raise exception 'Every assembly component formula must use the supported deterministic formula syntax.'; end if;
    if exists(
      select 1 from public.concrete_assembly_children c
      join public.concrete_assembly_versions v on v.id=c.child_assembly_version_id and v.company_id=c.company_id
      where c.company_id=new.company_id and c.assembly_version_id=new.id and v.status<>'published'
    ) then raise exception 'Every child assembly version must be published before the parent can be published.'; end if;
    if exists(
      select 1 from public.concrete_assembly_children c
      where c.company_id=new.company_id and c.assembly_version_id=new.id
        and not public.carez_formula_ast_is_valid(c.quantity_formula)
    ) then raise exception 'Every child quantity formula must use the supported deterministic formula syntax.'; end if;
    if exists(
      select 1 from public.concrete_assembly_children c
      cross join lateral jsonb_each(c.variable_bindings) b
      where c.company_id=new.company_id and c.assembly_version_id=new.id
        and (not exists(
          select 1 from public.concrete_assembly_variables cv
          where cv.company_id=c.company_id and cv.assembly_version_id=c.child_assembly_version_id and cv.variable_key=b.key
        ) or not public.carez_formula_ast_is_valid(b.value))
    ) then raise exception 'Child property bindings must target child properties and use supported deterministic formulas.'; end if;
    if exists(
      select 1 from public.concrete_assembly_property_bindings b
      where b.company_id=new.company_id and b.assembly_version_id=new.id and b.source_namespace='property'
        and not exists(
          select 1 from public.concrete_assembly_variables v
          where v.company_id=b.company_id and v.assembly_version_id=b.assembly_version_id and v.variable_key=b.source_key
        )
    ) then raise exception 'Property-to-property bindings must reference a property in the same assembly version.'; end if;
  end if;
  return new;
end;
$$;
revoke all on function public.carez_validate_assembly_version_publish() from public,anon,authenticated;

create unique index concrete_assembly_versions_one_draft_uk on public.concrete_assembly_versions(assembly_id) where status='draft';

alter table public.concrete_assembly_folders enable row level security;
alter table public.concrete_assembly_property_bindings enable row level security;
alter table public.concrete_assembly_children enable row level security;

create policy "office access concrete_assembly_folders" on public.concrete_assembly_folders for all to authenticated
using(company_id=(select public.get_my_company_id()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role<>'employee'))
with check(company_id=(select public.get_my_company_id()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role<>'employee'));
create policy "office access concrete_assembly_property_bindings" on public.concrete_assembly_property_bindings for all to authenticated
using(company_id=(select public.get_my_company_id()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role<>'employee'))
with check(company_id=(select public.get_my_company_id()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role<>'employee'));
create policy "office access concrete_assembly_children" on public.concrete_assembly_children for all to authenticated
using(company_id=(select public.get_my_company_id()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role<>'employee'))
with check(company_id=(select public.get_my_company_id()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role<>'employee'));

revoke all on public.concrete_assembly_folders,public.concrete_assembly_property_bindings,public.concrete_assembly_children from anon,authenticated;
grant select,insert,update,delete on public.concrete_assembly_folders,public.concrete_assembly_property_bindings,public.concrete_assembly_children to authenticated;
grant all on public.concrete_assembly_folders,public.concrete_assembly_property_bindings,public.concrete_assembly_children to service_role;

revoke all on public.concrete_assemblies,public.concrete_assembly_versions,public.concrete_assembly_variables,public.concrete_assembly_components from anon,authenticated;
grant select,insert,update,delete on public.concrete_assemblies,public.concrete_assembly_versions,public.concrete_assembly_variables,public.concrete_assembly_components to authenticated;

drop policy "office access concrete_assemblies" on public.concrete_assemblies;
create policy "office access concrete_assemblies" on public.concrete_assemblies for all to authenticated
using(company_id=(select public.get_my_company_id()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role<>'employee'))
with check(company_id=(select public.get_my_company_id()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role<>'employee'));
drop policy "office access concrete_assembly_versions" on public.concrete_assembly_versions;
create policy "office access concrete_assembly_versions" on public.concrete_assembly_versions for all to authenticated
using(company_id=(select public.get_my_company_id()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role<>'employee'))
with check(company_id=(select public.get_my_company_id()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role<>'employee'));
drop policy "office access concrete_assembly_variables" on public.concrete_assembly_variables;
create policy "office access concrete_assembly_variables" on public.concrete_assembly_variables for all to authenticated
using(company_id=(select public.get_my_company_id()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role<>'employee'))
with check(company_id=(select public.get_my_company_id()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role<>'employee'));
drop policy "office access concrete_assembly_components" on public.concrete_assembly_components;
create policy "office access concrete_assembly_components" on public.concrete_assembly_components for all to authenticated
using(company_id=(select public.get_my_company_id()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role<>'employee'))
with check(company_id=(select public.get_my_company_id()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role<>'employee'));

create trigger carez_concrete_assembly_folders_touch before update on public.concrete_assembly_folders for each row execute function public.carez_takeoff_touch_updated_at();
create trigger carez_concrete_assembly_property_bindings_touch before update on public.concrete_assembly_property_bindings for each row execute function public.carez_takeoff_touch_updated_at();
create trigger carez_concrete_assembly_children_touch before update on public.concrete_assembly_children for each row execute function public.carez_takeoff_touch_updated_at();
create trigger carez_guard_assembly_folder_cycle before insert or update of parent_folder_id on public.concrete_assembly_folders for each row execute function public.carez_guard_assembly_folder_cycle();
create trigger carez_guard_published_assembly_bindings before insert or update or delete on public.concrete_assembly_property_bindings for each row execute function public.carez_guard_published_assembly_child();
create trigger carez_guard_published_assembly_children before insert or update or delete on public.concrete_assembly_children for each row execute function public.carez_guard_published_assembly_child();
create trigger carez_guard_assembly_child_cycle before insert or update on public.concrete_assembly_children for each row execute function public.carez_guard_assembly_child_cycle();
create trigger carez_validate_assembly_version_publish before update on public.concrete_assembly_versions for each row execute function public.carez_validate_assembly_version_publish();

create or replace function public.carez_create_custom_assembly(
  p_code text,p_name text,p_category text,p_primary_measurement text,p_folder_id uuid default null,p_description text default null
)
returns jsonb
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_company uuid:=public.get_my_company_id();
  v_assembly uuid;
  v_version uuid;
  v_measurement text:=upper(trim(coalesce(p_primary_measurement,'')));
begin
  if v_company is null or public.get_my_role()='employee' then raise exception 'Owner access required.'; end if;
  if nullif(trim(p_code),'') is null or nullif(trim(p_name),'') is null or nullif(trim(p_category),'') is null then raise exception 'Assembly code, name, and category are required.'; end if;
  if v_measurement not in ('LF','SF','EA','CY') then raise exception 'Primary measurement must be LF, SF, EA, or CY.'; end if;
  if p_folder_id is not null and not exists(select 1 from public.concrete_assembly_folders f where f.id=p_folder_id and f.company_id=v_company and f.active) then raise exception 'Assembly folder not found.'; end if;
  insert into public.concrete_assemblies(company_id,folder_id,code,name,category,primary_measurement,description,created_by)
  values(v_company,p_folder_id,trim(p_code),trim(p_name),trim(p_category),v_measurement,nullif(trim(coalesce(p_description,'')),''),auth.uid()) returning id into v_assembly;
  insert into public.concrete_assembly_versions(
    company_id,assembly_id,version_no,status,source_type,source_label,
    assembly_code_snapshot,assembly_name_snapshot,category_snapshot,primary_measurement_snapshot,description_snapshot,created_by
  ) values(
    v_company,v_assembly,1,'draft','manual','User-authored Carez assembly',
    trim(p_code),trim(p_name),trim(p_category),v_measurement,nullif(trim(coalesce(p_description,'')),''),auth.uid()
  ) returning id into v_version;
  return jsonb_build_object('assembly_id',v_assembly,'assembly_version_id',v_version,'version_no',1,'status','draft');
end;
$$;
revoke all on function public.carez_create_custom_assembly(text,text,text,text,uuid,text) from public,anon;
grant execute on function public.carez_create_custom_assembly(text,text,text,text,uuid,text) to authenticated,service_role;

create or replace function public.carez_create_assembly_revision(p_assembly_version_id uuid)
returns uuid
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_company uuid:=public.get_my_company_id();
  v_source public.concrete_assembly_versions%rowtype;
  v_assembly public.concrete_assemblies%rowtype;
  v_new uuid;
  v_next integer;
begin
  if v_company is null or public.get_my_role()='employee' then raise exception 'Owner access required.'; end if;
  select * into v_source from public.concrete_assembly_versions where id=p_assembly_version_id and company_id=v_company;
  if not found then raise exception 'Assembly version not found.'; end if;
  if v_source.status='draft' then raise exception 'Continue editing the existing draft instead of creating a revision from it.'; end if;
  select * into v_assembly from public.concrete_assemblies where id=v_source.assembly_id and company_id=v_company for update;
  if not found then raise exception 'Assembly not found.'; end if;
  if exists(select 1 from public.concrete_assembly_versions where company_id=v_company and assembly_id=v_source.assembly_id and status='draft') then raise exception 'This assembly already has a draft revision.'; end if;
  select coalesce(max(version_no),0)+1 into v_next from public.concrete_assembly_versions where company_id=v_company and assembly_id=v_source.assembly_id;
  insert into public.concrete_assembly_versions(
    company_id,assembly_id,version_no,status,source_type,source_label,source_year,source_reference,default_risk_class_code,notes,
    assembly_code_snapshot,assembly_name_snapshot,category_snapshot,primary_measurement_snapshot,description_snapshot,created_by
  ) values(
    v_company,v_source.assembly_id,v_next,'draft',v_source.source_type,v_source.source_label,v_source.source_year,v_source.source_reference,v_source.default_risk_class_code,v_source.notes,
    v_assembly.code,v_assembly.name,v_assembly.category,v_assembly.primary_measurement,v_assembly.description,auth.uid()
  ) returning id into v_new;
  insert into public.concrete_assembly_variables(
    company_id,assembly_version_id,variable_key,label,value_type,unit,default_value,min_value,max_value,required,help_text,sort_order,property_group,expose_in_takeoff,allow_override
  )
  select company_id,v_new,variable_key,label,value_type,unit,default_value,min_value,max_value,required,help_text,sort_order,property_group,expose_in_takeoff,allow_override
  from public.concrete_assembly_variables where company_id=v_company and assembly_version_id=v_source.id;
  insert into public.concrete_assembly_components(
    company_id,assembly_version_id,component_key,label,estimate_item_type,cost_code_id,catalog_item_id,production_task_id,output_unit,quantity_formula,labor_rate_formula,baseline_source,pricing_strategy,default_unit_cost,labor_task,notes,sort_order
  )
  select company_id,v_new,component_key,label,estimate_item_type,cost_code_id,catalog_item_id,production_task_id,output_unit,quantity_formula,labor_rate_formula,baseline_source,pricing_strategy,default_unit_cost,labor_task,notes,sort_order
  from public.concrete_assembly_components where company_id=v_company and assembly_version_id=v_source.id;
  insert into public.concrete_assembly_children(company_id,assembly_version_id,child_assembly_version_id,child_key,label,quantity_formula,variable_bindings,sort_order,created_by)
  select company_id,v_new,child_assembly_version_id,child_key,label,quantity_formula,variable_bindings,sort_order,auth.uid()
  from public.concrete_assembly_children where company_id=v_company and assembly_version_id=v_source.id;
  insert into public.concrete_assembly_property_bindings(company_id,assembly_version_id,variable_id,source_namespace,source_key,precedence,notes,sort_order,created_by)
  select b.company_id,v_new,nv.id,b.source_namespace,b.source_key,b.precedence,b.notes,b.sort_order,auth.uid()
  from public.concrete_assembly_property_bindings b
  join public.concrete_assembly_variables ov on ov.id=b.variable_id and ov.company_id=b.company_id
  join public.concrete_assembly_variables nv on nv.company_id=b.company_id and nv.assembly_version_id=v_new and nv.variable_key=ov.variable_key
  where b.company_id=v_company and b.assembly_version_id=v_source.id;
  return v_new;
end;
$$;
revoke all on function public.carez_create_assembly_revision(uuid) from public,anon;
grant execute on function public.carez_create_assembly_revision(uuid) to authenticated,service_role;

create or replace function public.carez_publish_assembly_version(p_assembly_version_id uuid)
returns uuid
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_company uuid:=public.get_my_company_id();
  v_version public.concrete_assembly_versions%rowtype;
begin
  if v_company is null or public.get_my_role()='employee' then raise exception 'Owner access required.'; end if;
  select * into v_version from public.concrete_assembly_versions where id=p_assembly_version_id and company_id=v_company for update;
  if not found then raise exception 'Assembly version not found.'; end if;
  if v_version.status<>'draft' then raise exception 'Only a draft assembly version can be published.'; end if;
  update public.concrete_assembly_versions set status='published',published_at=coalesce(published_at,now()) where id=v_version.id and company_id=v_company;
  return v_version.id;
end;
$$;
revoke all on function public.carez_publish_assembly_version(uuid) from public,anon;
grant execute on function public.carez_publish_assembly_version(uuid) to authenticated,service_role;
