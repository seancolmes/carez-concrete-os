begin;
-- Isolated local contract/upgrade fixture. No hosted geometry is changed.
create extension if not exists pgtap with schema extensions;select extensions.no_plan();
alter table auth.users disable trigger on_auth_user_created;
insert into auth.users(id,email) values('f7100000-0000-4000-8000-000000000001','strip-owner@local.invalid'),('f7100000-0000-4000-8000-000000000002','strip-foreign@local.invalid');
alter table auth.users enable trigger on_auth_user_created;
insert into public.companies(id,name,operating_timezone,target_margin_percent,planned_productive_hours_annual,owner_compensation_target_annual,owner_planned_field_hours_annual,owner_field_rate) values('f7200000-0000-4000-8000-000000000001','Synthetic strip contractor','UTC',0,2000,0,0,0),('f7200000-0000-4000-8000-000000000002','Other strip contractor','UTC',0,2000,0,0,0);
insert into public.profiles(id,company_id,role) values('f7100000-0000-4000-8000-000000000001','f7200000-0000-4000-8000-000000000001','owner'),('f7100000-0000-4000-8000-000000000002','f7200000-0000-4000-8000-000000000002','owner');
select set_config('request.jwt.claim.sub','f7100000-0000-4000-8000-000000000001',true);set local role authenticated;
insert into public.estimates(id,company_id,estimate_number,name,status,version,created_by) values('f7300000-0000-4000-8000-000000000001','f7200000-0000-4000-8000-000000000001','SYN-STRIP','Synthetic strip estimate','draft',1,'f7100000-0000-4000-8000-000000000001');
insert into public.takeoff_sets(id,company_id,estimate_id,name,created_by) values('f7400000-0000-4000-8000-000000000001','f7200000-0000-4000-8000-000000000001','f7300000-0000-4000-8000-000000000001','Synthetic strip takeoff','f7100000-0000-4000-8000-000000000001');
create temp table strip_results(key text primary key,value jsonb);grant all on strip_results to authenticated;
insert into strip_results values('v5',public.carez_ensure_strip_footing_v5_template());
select extensions.lives_ok($$insert into strip_results values('v6',public.carez_ensure_strip_footing_v6_template())$$,'published v6 template reuses established compatibility mappings');
select extensions.is(public.carez_ensure_strip_footing_v6_template()->>'template_version_id',(select value->>'template_version_id' from strip_results where key='v6'),'template initialization reuses the same published version');
insert into strip_results values('condition',jsonb_build_object('id',public.carez_create_project_concrete_condition('f7400000-0000-4000-8000-000000000001',(select (value->>'template_version_id')::uuid from strip_results where key='v5'),'SYN-STRIP','Synthetic repeated-run condition')));
reset role;
select set_config('carez.project_condition_commit','1',true);
insert into public.project_condition_outputs(id,company_id,condition_version_id,output_key,label,resource_class,production_quantity,production_unit,status,pricing_status,unit_cost,direct_cost)
select 'f7500000-0000-4000-8000-000000000001','f7200000-0000-4000-8000-000000000001',(value->>'id')::uuid,'reinforcing.installed_lb','Recorded steel','material',50.768,'LB','ready','priced',2,101.54 from strip_results where key='condition';
insert into strip_results select 'original-version',to_jsonb(v) from public.project_concrete_condition_versions v where v.id=(select (value->>'id')::uuid from strip_results where key='condition');
set local role authenticated;
select extensions.lives_ok($$select public.carez_upgrade_strip_condition_draft_to_v6((select (value->>'id')::uuid from strip_results where key='condition'))$$,'editable v5 condition explicitly upgrades to v6');
select extensions.ok((select status='held' and production_quantity is null and unit_cost=2 and direct_cost=101.54 from public.project_condition_outputs where id='f7500000-0000-4000-8000-000000000001'),'upgrade preserves output identity and recorded price while holding stale quantity');
select extensions.ok((select v.plan_facts=o.value->'plan_facts' and v.method_inputs=o.value->'method_inputs' and v.commercial_inputs=o.value->'commercial_inputs' and v.compatibility_anchor_measurement_id is not distinct from (o.value->>'compatibility_anchor_measurement_id')::uuid from public.project_concrete_condition_versions v join strip_results o on o.key='original-version' where v.id=(select (value->>'id')::uuid from strip_results where key='condition')),'inputs and explicit primary anchor remain unchanged');
select extensions.ok(exists(select 1 from public.project_condition_holds where condition_version_id=(select (value->>'id')::uuid from strip_results where key='condition') and status='open' and hold_code='review_required'),'recalculation requirement is explicit');
select extensions.ok(not (public.carez_upgrade_strip_condition_draft_to_v6((select (value->>'id')::uuid from strip_results where key='condition'))->>'upgraded')::boolean,'upgrade replay is not another transformation');
create function pg_temp.strip_projection_fixture_commit(
  p_version uuid, p_runs uuid[], p_anchor uuid, p_include_detached boolean default true
) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare
  v_company uuid := public.get_my_company_id();
  v_version public.project_concrete_condition_versions%rowtype;
  v_condition public.project_concrete_conditions%rowtype;
  v_archetype public.platform_condition_archetype_versions%rowtype;
  v_template public.company_condition_template_versions%rowtype;
  v_modules jsonb; v_roles jsonb; v_outputs jsonb; v_updates jsonb := '[]';
  v_prior uuid[] := '{}'; v_all uuid[]; v_id uuid;
  v_measurement public.takeoff_measurements%rowtype;
  v_legacy jsonb; v_total numeric; v_own numeric; v_mode text;
begin
  select * into strict v_version from public.project_concrete_condition_versions
    where company_id=v_company and id=p_version;
  select * into strict v_condition from public.project_concrete_conditions
    where company_id=v_company and id=v_version.condition_id;
  select * into strict v_archetype from public.platform_condition_archetype_versions
    where id=v_version.archetype_version_id;
  select * into strict v_template from public.company_condition_template_versions
    where company_id=v_company and id=v_version.template_version_id;

  -- Keep every published module present. Only concrete is active in this
  -- cleanup fixture; retain loaded defaults (including the v5 board model).
  select jsonb_agg(jsonb_build_object(
    'module_key', m.module_key, 'instance_key',m.instance_key,
    'label',m.label,'enabled',m.module_key='concrete',
    'input_values',m.input_values,'input_provenance',m.input_provenance,
    'legacy_child_key',m.legacy_child_key,'sort_order',m.sort_order
  ) order by m.sort_order) into v_modules
  from public.project_condition_module_instances m
  where m.company_id=v_company and m.condition_version_id=p_version;

  select jsonb_agg(jsonb_build_object(
    'measurement_id',u.id,'role_key','run','role_instance_key','run-'||u.n,
    'is_primary',true,'sort_order',u.n*10
  ) order by u.n) into v_roles from unnest(p_runs) with ordinality u(id,n);
  select round(sum(raw_quantity)*2/27,4) into v_total
    from public.takeoff_measurements where company_id=v_company and id=any(p_runs);

  select jsonb_agg(jsonb_build_object(
    'output_key',d->>'key','output_instance_key','default',
    'module_key',d->>'module_key','module_instance_key','default',
    'driver_measurement_id',p_anchor,'resource_class',d->>'resource_class',
    'production_unit',d->>'unit','quantity_mode','derived',
    'status',case when d->>'module_key'='concrete' then 'ready' else 'inactive' end,
    'production_quantity',case when d->>'module_key'='concrete' then v_total else 0 end,
    'provenance',jsonb_build_object('authority','server','fixture',true),
    'calculation_trace',jsonb_build_object('conditionVersionId',p_version,
       'algorithm',d->>'algorithm','fixture','projection-cleanup-only'),
    'holds','[]'::jsonb
  ) order by n) into v_outputs
    from jsonb_array_elements(v_archetype.output_schema) with ordinality x(d,n);

  if v_condition.compatibility_projection_version_id is not null then
    select coalesce(array_agg(distinct measurement_id),'{}'::uuid[]) into v_prior
      from public.project_condition_measurement_roles
      where company_id=v_company
        and condition_version_id=v_condition.compatibility_projection_version_id;
  end if;
  select array_agg(distinct id order by id) into v_all
    from unnest(p_runs || case when p_include_detached then v_prior else '{}'::uuid[] end) u(id);

  foreach v_id in array v_all loop
    select * into strict v_measurement from public.takeoff_measurements
      where company_id=v_company and id=v_id;
    v_own:=round(v_measurement.raw_quantity*2/27,4);
    v_mode:=case when v_id=p_anchor then 'condition_projection'
      when v_id=any(p_runs) then 'suppressed' else 'restored' end;

    -- Always include every assembly component path, with the actual mapping
    -- key and component ID. Restored output drops Condition ownership and
    -- carries the detached run's own quantity instead of the prior aggregate.
    select jsonb_agg(jsonb_build_object(
      'assembly_component_id',paths.component_id,
      'component_key',paths.component_path_key,
      'condition_output_key',mapping.output_key,
      'production_quantity',case when d->>'module_key'='concrete'
          and v_mode<>'suppressed' then case when v_mode='condition_projection'
            then v_total else v_own end else 0 end,
      'estimated_man_hours',0,'unit_cost',case when mapping.output_key='concrete.procurement_cy' then 1 else 0 end,
      'direct_cost',case when mapping.output_key='concrete.procurement_cy'
          and v_mode<>'suppressed' then round(case when v_mode='condition_projection'
            then v_total else v_own end,2) else 0 end,
      'pricing_status',case when d->>'module_key'='concrete'
          and v_mode<>'suppressed' then 'priced' else 'not_priced' end,
      'is_active',d->>'module_key'='concrete' or v_mode='suppressed',
      'estimate_visible',mapping.output_key='concrete.procurement_cy' and v_mode<>'suppressed',
      'formula_trace',case when v_mode='restored' then
        jsonb_build_object('fixture','detached-geometry-restored') else
        jsonb_build_object('condition_version_id',p_version,
          'condition_output_key',mapping.output_key,'fixture',v_mode) end
    ) order by paths.component_path_key) into v_legacy
      from public.carez_assembly_component_paths(v_company,v_measurement.assembly_version_id) paths
      join public.condition_legacy_output_mappings mapping
        on mapping.company_id=v_company and mapping.template_version_id=v_template.id
        and mapping.legacy_assembly_component_id=paths.component_id
      join lateral jsonb_array_elements(v_archetype.output_schema) d
        on d->>'key'=mapping.output_key;
    v_updates:=v_updates||jsonb_build_array(jsonb_build_object(
      'measurement_id',v_id,'expected_updated_at',v_measurement.updated_at,
      'mode',v_mode,'outputs',v_legacy));
  end loop;

  return public.carez_commit_project_condition_calculation(
    p_version,v_version.updated_at,v_condition.compatibility_projection_version_id,
    p_anchor,v_version.plan_facts,v_version.method_inputs,v_version.production_inputs,
    v_version.commercial_inputs,v_version.drawing_inputs,v_version.input_provenance,
    v_version.output_overrides,v_modules,v_roles,v_outputs,v_updates);
end $$;

insert into strip_results values('projected-condition',jsonb_build_object('id',
  public.carez_create_project_concrete_condition(
    'f7400000-0000-4000-8000-000000000001',
    (select (value->>'template_version_id')::uuid from strip_results where key='v5'),
    'SYN-PROJECTION','Synthetic prior multi-run projection')));
insert into public.takeoff_sheets(id,company_id,takeoff_set_id,page_number,title)
values('f7600000-0000-4000-8000-000000000001','f7200000-0000-4000-8000-000000000001',
 'f7400000-0000-4000-8000-000000000001',1,'Synthetic projection sheet');
insert into public.takeoff_measurements(
 id,company_id,takeoff_set_id,sheet_id,estimate_id,assembly_version_id,
 name,measurement_type,raw_quantity,raw_unit,geometry,source,created_by)
select u.id,'f7200000-0000-4000-8000-000000000001',
 'f7400000-0000-4000-8000-000000000001','f7600000-0000-4000-8000-000000000001',
 'f7300000-0000-4000-8000-000000000001',
 (select (value->>'legacy_assembly_version_id')::uuid from strip_results where key='v5'),
 'Synthetic run '||u.n,'linear',18,'LF',
 jsonb_build_object('type','polyline','points',jsonb_build_array(
   jsonb_build_object('x',0,'y',u.n*20),jsonb_build_object('x',18,'y',u.n*20))),
 'manual','f7100000-0000-4000-8000-000000000001'
from unnest(array['f7700000-0000-4000-8000-000000000001'::uuid,
 'f7700000-0000-4000-8000-000000000002'::uuid]) with ordinality u(id,n);

select extensions.lives_ok($test$select pg_temp.strip_projection_fixture_commit(
 (select (value->>'id')::uuid from strip_results where key='projected-condition'),
 array['f7700000-0000-4000-8000-000000000001'::uuid,'f7700000-0000-4000-8000-000000000002'::uuid],
 'f7700000-0000-4000-8000-000000000001')$test$,
 'real v5 atomic commit establishes two-run projection and first-run anchor');

select extensions.ok((select count(*)=2 from public.project_condition_measurement_roles
 where condition_version_id=(select (value->>'id')::uuid from strip_results where key='projected-condition')),
 'prior projection has both actual run roles');
select extensions.ok(exists(select 1 from public.takeoff_measurement_outputs
 where measurement_id='f7700000-0000-4000-8000-000000000002'
   and not estimate_visible and production_quantity=0),
 'second run starts as a suppressed compatibility measurement');

insert into strip_results select 'projection-output-ids',jsonb_agg(id order by id) from public.takeoff_measurement_outputs where measurement_id in ('f7700000-0000-4000-8000-000000000001','f7700000-0000-4000-8000-000000000002');
select public.carez_upgrade_strip_condition_draft_to_v6(
 (select (value->>'id')::uuid from strip_results where key='projected-condition'));

select extensions.throws_like($test$select pg_temp.strip_projection_fixture_commit(
 (select (value->>'id')::uuid from strip_results where key='projected-condition'),
 array['f7700000-0000-4000-8000-000000000002'::uuid],
 'f7700000-0000-4000-8000-000000000002',false)$test$,
 '%Legacy measurement update set does not match current and prior Condition roles%',
 'v6 recalculation rejects omitting detached former anchor cleanup');

select extensions.lives_ok($test$select pg_temp.strip_projection_fixture_commit(
 (select (value->>'id')::uuid from strip_results where key='projected-condition'),
 array['f7700000-0000-4000-8000-000000000002'::uuid],
 'f7700000-0000-4000-8000-000000000002',true)$test$,
 'v6 recalculation restores detached former anchor and unsuppresses new anchor');

select extensions.ok(not exists(select 1 from public.project_condition_measurement_roles
 where measurement_id='f7700000-0000-4000-8000-000000000001'),
 'former anchor no longer belongs to the Condition');
select extensions.ok(exists(select 1 from public.takeoff_measurement_outputs
 where measurement_id='f7700000-0000-4000-8000-000000000001'
   and estimate_visible and production_quantity=1.3333
   and formula_trace->>'fixture'='detached-geometry-restored'
   and generated_estimate_item_id is not null),
 'detached former anchor regains its own quantity and estimate lineage, not aggregate quantity');
select extensions.ok(exists(select 1 from public.takeoff_measurement_outputs
 where measurement_id='f7700000-0000-4000-8000-000000000002'
   and estimate_visible and production_quantity=1.3333
   and generated_estimate_item_id is not null),
 'previously suppressed run becomes the sole projected anchor with its own estimate line');
select extensions.is((select compatibility_anchor_measurement_id from public.project_concrete_condition_versions
 where id=(select (value->>'id')::uuid from strip_results where key='projected-condition')),
 'f7700000-0000-4000-8000-000000000002'::uuid,
 'committed anchor changes only through the explicit recalculation payload');

select extensions.is((select jsonb_agg(id order by id) from public.takeoff_measurement_outputs where measurement_id in ('f7700000-0000-4000-8000-000000000001','f7700000-0000-4000-8000-000000000002')),(select value from strip_results where key='projection-output-ids'),'recalculation preserves both runs compatibility output identities');
select set_config('request.jwt.claim.sub','f7100000-0000-4000-8000-000000000002',true);
select extensions.throws_like($$select public.carez_upgrade_strip_condition_draft_to_v6((select (value->>'id')::uuid from strip_results where key='condition'))$$,'%Only a draft%','foreign tenant cannot upgrade the condition');
reset role;select * from extensions.finish();rollback;
