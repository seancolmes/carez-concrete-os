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
grant execute on function public.carez_create_custom_assembly(text,text,text,text,uuid,text) to authenticated,service_role;;
