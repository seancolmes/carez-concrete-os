-- Explicit opt-in; preserve all published v1-v5 history and supplier evidence.
do $$ declare base public.platform_condition_archetype_versions%rowtype;outputs jsonb;begin
 select * into base from public.platform_condition_archetype_versions where archetype_code_snapshot='strip_wall_footing' and version_no=5 and status='published' and engine_key='concrete_condition_v1';
 if not found then raise exception 'Published Strip v5 prerequisite unavailable';end if;
 select jsonb_agg(case when o->>'key' in ('forms.stakes_ea','anchors_embeds.anchor_ea','reinforcing.installed_lb','reinforcing.procurement_lb','reinforcing.stock_bars_ea','labor.reinforcing_mh') then jsonb_set(o,'{algorithm}',to_jsonb((o->>'algorithm')||'-per-run-v6')) else o end order by n) into outputs from jsonb_array_elements(base.output_schema) with ordinality x(o,n);
 insert into public.platform_condition_archetype_versions(archetype_id,version_no,status,engine_key,role_schema,input_schema,module_schema,output_schema,projection_schema,notes,published_at)
 values(base.archetype_id,6,'published',base.engine_key,base.role_schema,base.input_schema,base.module_schema,outputs,base.projection_schema||'{"discrete_run_model":"per_run_v6"}'::jsonb,'Per-run resources. Closed-loop stock/lap reinforcing requires an explicit reasoned quantity; no open-run closure assumption.',clock_timestamp());
end $$;
create or replace function public.carez_ensure_strip_footing_v6_template()
returns jsonb
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_company uuid := public.get_my_company_id();
  v_base_result jsonb;
  v_base_template public.company_condition_template_versions%rowtype;
  v_archetype public.platform_condition_archetypes%rowtype;
  v_target public.platform_condition_archetype_versions%rowtype;
  v_existing public.company_condition_template_versions%rowtype;
  v_target_id uuid;
  v_mapping_count integer;
  v_module_defaults jsonb;
begin
  if v_company is null or public.get_my_role()='employee' then raise exception 'Office access required.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_company::text || ':strip_wall_footing:v6',0));

  v_base_result:=public.carez_ensure_strip_footing_v5_template();
  select * into v_base_template
  from public.company_condition_template_versions
  where company_id=v_company and id=(v_base_result->>'template_version_id')::uuid and status='published';
  if not found then raise exception 'Published Strip / Wall Footing v4 company template not found.'; end if;

  select * into v_archetype
  from public.platform_condition_archetypes
  where code='strip_wall_footing' and active;
  if not found then raise exception 'Active Strip / Wall Footing archetype not found.'; end if;

  select * into v_target
  from public.platform_condition_archetype_versions
  where archetype_id=v_archetype.id and version_no=6 and status='published' and engine_key='concrete_condition_v1'
  limit 1;
  if not found then raise exception 'Published Strip / Wall Footing v5 contract not found.'; end if;

  select template_version.* into v_existing
  from public.company_condition_template_versions template_version
  where template_version.company_id=v_company
    and template_version.template_id=v_base_template.template_id
    and template_version.archetype_version_id=v_target.id
    and template_version.status='published'
  order by template_version.version_no desc
  limit 1;
  if found then
    return jsonb_build_object(
      'template_version_id',v_existing.id,
      'legacy_assembly_version_id',v_existing.legacy_assembly_version_id,
      'created',false
    );
  end if;

  v_module_defaults:=coalesce(v_base_template.module_defaults,'{}'::jsonb) || jsonb_build_object(
    'forms',
    coalesce(v_base_template.module_defaults->'forms','{}'::jsonb) || jsonb_build_object(
      'inputs',
      coalesce(v_base_template.module_defaults->'forms'->'inputs','{}'::jsonb) || jsonb_build_object(
        'form_resource_model','physical_boards_v5'
      )
    )
  );

  insert into public.company_condition_template_versions(
    company_id,template_id,archetype_version_id,version_no,status,template_code_snapshot,template_name_snapshot,
    template_description_snapshot,module_defaults,input_defaults,input_provenance,pricing_defaults,legacy_assembly_version_id,notes,created_by
  ) values (
    v_company,v_base_template.template_id,v_target.id,
    coalesce((select max(version_no)+1 from public.company_condition_template_versions where company_id=v_company and template_id=v_base_template.template_id),1),
    'draft',v_base_template.template_code_snapshot,v_base_template.template_name_snapshot,v_base_template.template_description_snapshot,
    v_module_defaults,coalesce(v_base_template.input_defaults,'{}'::jsonb),
    coalesce(v_base_template.input_provenance,'{}'::jsonb),coalesce(v_base_template.pricing_defaults,'{}'::jsonb),
    v_base_template.legacy_assembly_version_id,
    'ADR-023 Strip / Wall Footing v5. Wood form-board demand is a physical installed quantity derived from geometry and board choice.',auth.uid()
  ) returning id into v_target_id;

  insert into public.condition_legacy_output_mappings(
    company_id,template_version_id,output_key,legacy_assembly_component_id,legacy_component_key_snapshot,output_unit_snapshot,created_by
  )
  select v_company,v_target_id,mapping.output_key,mapping.legacy_assembly_component_id,
         mapping.legacy_component_key_snapshot,mapping.output_unit_snapshot,auth.uid()
  from public.condition_legacy_output_mappings mapping
  where mapping.company_id=v_company and mapping.template_version_id=v_base_template.id
    and exists (select 1 from jsonb_array_elements(v_target.output_schema) output where output->>'key'=mapping.output_key);

  select count(*) into v_mapping_count
  from public.condition_legacy_output_mappings mapping
  where mapping.company_id=v_company and mapping.template_version_id=v_target_id;
  if v_mapping_count<>jsonb_array_length(v_target.output_schema) then
    raise exception 'Strip v6 compatibility projection is incomplete.';
  end if;

  perform public.carez_publish_company_condition_template_version(v_target_id);
  return jsonb_build_object(
    'template_version_id',v_target_id,
    'legacy_assembly_version_id',v_base_template.legacy_assembly_version_id,
    'created',true
  );
end;
$$;

revoke all on function public.carez_ensure_strip_footing_v6_template() from public,anon;
grant execute on function public.carez_ensure_strip_footing_v6_template() to authenticated,service_role;


create function public.carez_upgrade_strip_condition_draft_to_v6(p_condition_version_id uuid) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare company uuid:=public.get_my_company_id();source public.project_concrete_condition_versions%rowtype;cond public.project_concrete_conditions%rowtype;contract integer;target jsonb;tpl public.company_condition_template_versions%rowtype;begin
 if company is null or public.get_my_role() not in ('owner','office') then raise exception 'Office access required';end if;
 select * into source from public.project_concrete_condition_versions where company_id=company and id=p_condition_version_id for update;
 if not found or source.status<>'draft' then raise exception 'Only a draft Project Condition can be upgraded. Verified history is immutable';end if;
 select * into cond from public.project_concrete_conditions where company_id=company and id=source.condition_id for update;
 if not found or cond.status<>'active' then raise exception 'Active Project Condition unavailable';end if;
 if not exists(select 1 from public.takeoff_sets s join public.estimates e on e.company_id=s.company_id and e.id=s.estimate_id where s.company_id=company and s.id=cond.takeoff_set_id and s.status='active' and e.status not in ('accepted','approved','superseded'))
 or exists(select 1 from public.proposal_presentations p join public.takeoff_sets s on s.company_id=p.company_id and s.estimate_id=p.estimate_id where s.company_id=company and s.id=cond.takeoff_set_id) then raise exception 'This estimate revision is locked';end if;
 select version_no into contract from public.platform_condition_archetype_versions where id=source.archetype_version_id and archetype_code_snapshot='strip_wall_footing';
 if contract is null then raise exception 'Only Strip / Wall Footing supports this upgrade';end if;
 if contract>=6 then return jsonb_build_object('condition_version_id',source.id,'from_contract_version',contract,'to_contract_version',contract,'upgraded',false,'requires_recalculation',false);end if;
 if contract<>5 then raise exception 'This draft requires a separately reviewed physical form-board conversion before the per-run upgrade. Existing evidence is preserved';end if;
 target:=public.carez_ensure_strip_footing_v6_template();
 select * into tpl from public.company_condition_template_versions where company_id=company and id=(target->>'template_version_id')::uuid and status='published';
 if not found then raise exception 'Published v6 company template unavailable';end if;
 perform set_config('carez.project_condition_commit','1',true);
 update public.project_concrete_condition_versions set template_version_id=tpl.id,archetype_version_id=tpl.archetype_version_id,updated_at=clock_timestamp() where company_id=company and id=source.id;
 -- Retain output IDs, quote-line references, recorded prices and geometry. Old
 -- derived quantities cannot be treated as current before recalculation.
 update public.project_condition_outputs set status='held',production_quantity=null,pricing_status='missing_input',updated_at=clock_timestamp() where company_id=company and condition_version_id=source.id and status<>'inactive';
 insert into public.project_condition_holds(company_id,condition_version_id,hold_code,message) values(company,source.id,'review_required','Contract v6 selected. Recalculate and review per-run resources before pricing or verification.') on conflict do nothing;
 -- Keep the prior projection pointer until the atomic recalculation replaces
 -- it. Cleanup uses its saved role set to restore removed runs/former anchors.
 update public.project_concrete_conditions set updated_at=clock_timestamp() where company_id=company and id=cond.id;
 return jsonb_build_object('condition_version_id',source.id,'from_contract_version',contract,'to_contract_version',6,'upgraded',true,'requires_recalculation',true,'message','Contract v6 selected. Drawing assignments, primary anchor, output identities and supplier evidence are preserved. Recalculate and review per-run resources.');
end $$;
revoke all on function public.carez_upgrade_strip_condition_draft_to_v6(uuid) from public,anon;
grant execute on function public.carez_upgrade_strip_condition_draft_to_v6(uuid) to authenticated,service_role;
