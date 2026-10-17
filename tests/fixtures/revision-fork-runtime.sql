-- Isolated revision graph fork regression; all synthetic records roll back.
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
-- PRIVATE DRAFT: persistence/fork regression only, NOT Proposal issuance
-- acceptance. The caller prepends the synthetic identity/template base and
-- real projection helper from strip-v6-runtime.sql, excluding its assertions
-- and its deliberately held/unmeasured first Condition.

insert into strip_results values('history',jsonb_build_object('id',
 public.carez_create_project_concrete_condition(
  'f7400000-0000-4000-8000-000000000001',
  (select (value->>'template_version_id')::uuid from strip_results where key='v5'),
  'SYN-HISTORY','Historical footing label')));
insert into public.estimate_sections(id,company_id,estimate_id,name,scope_type,sort_order)
 values('f7800000-0000-4000-8000-000000000001','f7200000-0000-4000-8000-000000000001',
 'f7300000-0000-4000-8000-000000000001','Synthetic fork footing scope','base',10);
insert into public.takeoff_sheets(id,company_id,takeoff_set_id,page_number,title,
 page_width,page_height,scale_status,calibration)
 values('f7600000-0000-4000-8000-000000000001','f7200000-0000-4000-8000-000000000001',
 'f7400000-0000-4000-8000-000000000001',1,'Synthetic calibrated drawing',100,100,
 'calibrated','{"ft_per_pdf_unit":1,"fixture":"calibration-retained"}');
insert into public.takeoff_scale_regions(id,company_id,takeoff_set_id,sheet_id,name,
 region_bounds,scale_label,scale_kind,source_type,source_text,calibration,is_default,created_by)
 values('f7900000-0000-4000-8000-000000000001','f7200000-0000-4000-8000-000000000001',
 'f7400000-0000-4000-8000-000000000001','f7600000-0000-4000-8000-000000000001',
 'Synthetic confirmed region',null,'1 PDF unit = 1 ft','manual','manual',
 'Synthetic calibration evidence','{"ft_per_pdf_unit":1,"fixture":"region-retained"}',true,
 'f7100000-0000-4000-8000-000000000001');

-- Privileged HISTORICAL fixture seed: a formerly verified method profile.
-- Its binding is established while verified, then it is retired normally.
reset role;
insert into public.takeoff_method_profiles(id,company_id,takeoff_set_id,assembly_version_id,
 revision_no,name,status,method_inputs,verification_notes,verified_by,verified_at,created_by)
 select 'f7a00000-0000-4000-8000-000000000001','f7200000-0000-4000-8000-000000000001',
 'f7400000-0000-4000-8000-000000000001',(value->>'legacy_assembly_version_id')::uuid,
 1,'Synthetic historical method','verified','{}','Historical fixture; no qualification claim',
 'f7100000-0000-4000-8000-000000000001','2026-01-01T00:00:00Z',
 'f7100000-0000-4000-8000-000000000001' from strip_results where key='v5';
set local role authenticated;
insert into public.takeoff_measurements(id,company_id,takeoff_set_id,sheet_id,estimate_id,
 estimate_section_id,assembly_version_id,name,measurement_type,raw_quantity,raw_unit,
 geometry,source,scale_region_id,method_profile_id,created_by)
 select u.id,'f7200000-0000-4000-8000-000000000001',
 'f7400000-0000-4000-8000-000000000001','f7600000-0000-4000-8000-000000000001',
 'f7300000-0000-4000-8000-000000000001','f7800000-0000-4000-8000-000000000001',
 (select (value->>'legacy_assembly_version_id')::uuid from strip_results where key='v5'),
 'Synthetic separate footing '||u.n,'linear',18,'LF',
 jsonb_build_object('type','polyline','points',jsonb_build_array(
  jsonb_build_object('x',0,'y',u.n*20),jsonb_build_object('x',18,'y',u.n*20))),
 'drawing','f7900000-0000-4000-8000-000000000001','f7a00000-0000-4000-8000-000000000001',
 'f7100000-0000-4000-8000-000000000001'
 from unnest(array['f7700000-0000-4000-8000-000000000001'::uuid,
 'f7700000-0000-4000-8000-000000000002'::uuid]) with ordinality u(id,n);
update public.project_concrete_condition_versions set
 legacy_method_profile_id='f7a00000-0000-4000-8000-000000000001',
 plan_facts='{"width_ft":2,"depth_ft":1}',commercial_inputs='{"concrete_waste_pct":0}'
 where id=(select (value->>'id')::uuid from strip_results where key='history');
-- Real existing atomic persistence, with two primary role occurrences.
select pg_temp.strip_projection_fixture_commit(
 (select (value->>'id')::uuid from strip_results where key='history'),
 array['f7700000-0000-4000-8000-000000000001'::uuid,'f7700000-0000-4000-8000-000000000002'::uuid],
 'f7700000-0000-4000-8000-000000000001');

insert into public.estimate_supplier_quote_sets(id,company_id,estimate_id,name)
 values('f7b00000-0000-4000-8000-000000000001','f7200000-0000-4000-8000-000000000001',
 'f7300000-0000-4000-8000-000000000001','Synthetic retained supplier evidence');
insert into public.estimate_supplier_quotes(id,company_id,quote_set_id,supplier_name,
 supplier_quote_number,quote_date,status)
 values('f7c00000-0000-4000-8000-000000000001','f7200000-0000-4000-8000-000000000001',
 'f7b00000-0000-4000-8000-000000000001','Synthetic supplier','SYN-Q-1',current_date,'received');
insert into public.estimate_supplier_quote_lines(id,company_id,quote_id,source_takeoff_output_id,
 generated_estimate_item_id,description,quoted_unit,quoted_unit_cost,source_reference)
 select 'f7d00000-0000-4000-8000-000000000001',o.company_id,
 'f7c00000-0000-4000-8000-000000000001',o.id,o.generated_estimate_item_id,
 'Synthetic concrete price evidence',o.production_unit,123.45,'SYN-Q-1-line-1'
 from public.takeoff_measurement_outputs o join public.project_condition_outputs co
 on co.legacy_takeoff_output_id=o.id and co.company_id=o.company_id
 where co.condition_version_id=(select (value->>'id')::uuid from strip_results where key='history')
 and co.output_key='concrete.procurement_cy';
select public.carez_select_estimate_supplier_quote_line('f7d00000-0000-4000-8000-000000000001');

-- Extra repeated module plus nested current-graph IDs exercise identity
-- remapping beyond FK columns. The helper's quantities remain fixture data.
insert into public.project_condition_module_instances(company_id,condition_version_id,
 module_key,instance_key,label,enabled,input_values,input_provenance,sort_order)
 select 'f7200000-0000-4000-8000-000000000001',(value->>'id')::uuid,
 'reinforcing','synthetic-second-set','Synthetic repeated reinforcing set',false,'{}','{}',999
 from strip_results where key='history';
update public.project_condition_outputs set calculation_trace=calculation_trace||
 jsonb_build_object('measurementIds',jsonb_build_array(
 'f7700000-0000-4000-8000-000000000001','f7700000-0000-4000-8000-000000000002'),
 'supplier',jsonb_build_object('source_kind','supplier_quote',
 'source_id','f7d00000-0000-4000-8000-000000000001'))
 where condition_version_id=(select (value->>'id')::uuid from strip_results where key='history');
insert into public.project_condition_holds(company_id,condition_version_id,output_id,
 hold_code,status,message,details,resolved_at)
 select company_id,condition_version_id,id,'review_required','resolved',
 'Synthetic resolved historical output review','{"fixture":"resolved-history"}',clock_timestamp()
 from public.project_condition_outputs where
 condition_version_id=(select (value->>'id')::uuid from strip_results where key='history')
 and output_key='concrete.procurement_cy';

-- Privileged HISTORICAL seed only: nullable attribution is a supported legacy
-- shape. Disable just the verification guard for this single source update;
-- restore it before creating the next draft, retiring the profile, or forking.
reset role;
alter table public.project_concrete_condition_versions disable trigger project_concrete_condition_versions_guard;
update public.project_concrete_condition_versions set status='verified',verified_by=null,
 verified_at=null,verification_notes='Historical fixture; deleted/unavailable attribution'
 where id=(select (value->>'id')::uuid from strip_results where key='history');
alter table public.project_concrete_condition_versions enable trigger project_concrete_condition_versions_guard;
set local role authenticated;
insert into strip_results values('later-draft',jsonb_build_object('id',
 public.carez_create_project_condition_revision(
 (select (value->>'id')::uuid from strip_results where key='history'))));
update public.project_concrete_conditions set name='Current footing label'
 where id=(select condition_id from public.project_concrete_condition_versions
 where id=(select (value->>'id')::uuid from strip_results where key='history'));
update public.project_concrete_condition_versions set
 compatibility_anchor_measurement_id='f7700000-0000-4000-8000-000000000001',
 verification_notes='Synthetic later draft, review still required'
 where id=(select (value->>'id')::uuid from strip_results where key='later-draft');
insert into public.project_condition_holds(company_id,condition_version_id,hold_code,message,details)
 select 'f7200000-0000-4000-8000-000000000001',(value->>'id')::uuid,
 'review_required','Synthetic later draft still requires review','{"fixture":"open-draft"}'
 from strip_results where key='later-draft';
-- Existing role history survives an excluded run. It is not new active work.
update public.takeoff_measurements set status='excluded'
 where id='f7700000-0000-4000-8000-000000000002';
update public.takeoff_method_profiles set status='retired'
 where id='f7a00000-0000-4000-8000-000000000001';
update public.estimates set proposed_sell_price=1000 where id='f7300000-0000-4000-8000-000000000001';

-- Historical Proposal seed: release guard is disabled ONLY for this insert.
-- The actual capture_proposal_commercial_snapshot trigger stays ENABLED.
-- Therefore no success here establishes an approved/issuable estimate.
reset role;
insert into public.proposal_access_tokens(id,company_id,estimate_id,token)
 values('f7e00000-0000-4000-8000-000000000001','f7200000-0000-4000-8000-000000000001',
 'f7300000-0000-4000-8000-000000000001','f7e00000-0000-4000-8000-000000000002');
alter table public.proposal_presentations disable trigger guard_proposal_release;
insert into public.proposal_presentations(id,company_id,estimate_id,proposal_access_token_id,
 proposal_number,base_sell_price,source_estimate_updated_at,snapshot,status,response_state,
 created_by,release_commercial_fingerprint,release_warning_fingerprint)
 select 'f7f00000-0000-4000-8000-000000000001',e.company_id,e.id,
 'f7e00000-0000-4000-8000-000000000001','SYN-FORK-P-R1',s.selected_sell_price,e.updated_at,
 jsonb_build_object('pricing',jsonb_build_object('base_sell_price',s.selected_sell_price),
 'options','[]'::jsonb,'fixture','historical-persistence-only'),'sent','none',
 'f7100000-0000-4000-8000-000000000001','fixture-not-a-release','fixture-not-a-release'
 from public.estimates e join public.estimate_financial_summary s on s.estimate_id=e.id
 where e.id='f7300000-0000-4000-8000-000000000001';
alter table public.proposal_presentations enable trigger guard_proposal_release;

create temp table fork_original_rows(table_name text,id uuid,payload jsonb,primary key(table_name,id));
do $$ declare name text;begin
 foreach name in array array['estimates','estimate_sections','estimate_items','takeoff_sets',
 'takeoff_sheets','takeoff_scale_regions','takeoff_method_profiles','takeoff_measurements',
 'takeoff_measurement_outputs','project_concrete_conditions','project_concrete_condition_versions',
 'project_condition_module_instances','project_condition_measurement_roles','project_condition_outputs',
 'project_condition_holds','estimate_supplier_quote_sets','estimate_supplier_quotes',
 'estimate_supplier_quote_lines','proposal_access_tokens','proposal_presentations'] loop
 execute format('insert into fork_original_rows select %L,id,to_jsonb(t) from public.%I t where company_id=$1',name,name)
 using 'f7200000-0000-4000-8000-000000000001'::uuid;
 end loop;
end $$;
create function pg_temp.fork_originals_unchanged() returns boolean language plpgsql as $$
declare r record;actual jsonb;begin
 for r in select * from fork_original_rows loop
 execute format('select to_jsonb(t) from public.%I t where id=$1',r.table_name) into actual using r.id;
 if actual is distinct from r.payload then return false;end if;
 end loop;return true;end $$;

-- A late quote-line insertion fails AFTER earlier graph rows are copied.
-- This proves rollback, rather than only checking preflight validation.
create function pg_temp.fail_late_supplier_line() returns trigger language plpgsql as $$
begin raise exception 'Synthetic late supplier-line fork failure';end $$;
create trigger synthetic_fail_late_supplier_line before insert on public.estimate_supplier_quote_lines
 for each row execute function pg_temp.fail_late_supplier_line();
set local role authenticated;
select extensions.throws_like($t$select public.carez_create_next_proposal_revision(
 'f7f00000-0000-4000-8000-000000000001')$t$,'%Synthetic late supplier-line fork failure%',
 'late graph failure is surfaced by the actual authenticated fork');
reset role;
select extensions.ok(not exists(select 1 from public.estimates where
 parent_proposal_revision_id='f7f00000-0000-4000-8000-000000000001')
 and not exists(select 1 from public.proposal_revision_forks where
 proposal_revision_id='f7f00000-0000-4000-8000-000000000001'),
 'late failure rolls back child Estimate and private receipt');
select extensions.ok(pg_temp.fork_originals_unchanged(),'late failure leaves all original graph rows byte-equivalent');
drop trigger synthetic_fail_late_supplier_line on public.estimate_supplier_quote_lines;
drop function pg_temp.fail_late_supplier_line();
set local role authenticated;
select extensions.lives_ok($t$insert into strip_results values('fork',
 public.carez_create_next_proposal_revision('f7f00000-0000-4000-8000-000000000001'))$t$,
 'authenticated owner forks full historical graph without disabling runtime validators');
insert into strip_results values('retry',public.carez_create_next_proposal_revision(
 'f7f00000-0000-4000-8000-000000000001'));
select extensions.ok((select value->>'estimate_id' from strip_results where key='fork')=
 (select value->>'estimate_id' from strip_results where key='retry') and
 (select (value->>'already_created')::boolean from strip_results where key='retry'),
 'retry returns the same completed child graph');

-- Ordinary authenticated callers cannot use the exact-copy exception or
-- write its receipt. Tests intentionally run before RESET ROLE.
select extensions.throws_like($t$select * from public.proposal_revision_forks$t$,
 '%permission denied%','authenticated cannot read private fork receipts/maps');
select extensions.throws_like($t$select public.carez_revision_fork_id('{}','takeoff_sets',null)$t$,
 '%permission denied%','authenticated cannot call private map helper');
select extensions.throws_like($t$select public.carez_revision_fork_trace('{}','{}')$t$,
 '%permission denied%','authenticated cannot call private trace helper');
select extensions.throws_like($t$select public.carez_revision_fork_copy_expected('estimates','{}')$t$,
 '%permission denied%','authenticated cannot call exact-row bypass helper');
select extensions.throws_like($t$select public.carez_revision_fork_write(null,'estimates','{}',false)$t$,
 '%permission denied%','authenticated cannot call private graph writer');
select extensions.throws_like($t$select public.carez_create_next_proposal_revision_source_core(
 'f7f00000-0000-4000-8000-000000000001')$t$,'%permission denied%',
 'authenticated cannot call private source-core fork');
select extensions.throws_like($t$select public.carez_create_next_proposal_revision_before_graph(
 'f7f00000-0000-4000-8000-000000000001')$t$,'%permission denied%',
 'authenticated cannot call retired pre-graph fork');
select set_config('request.jwt.claim.sub','f7100000-0000-4000-8000-000000000002',true);
select extensions.throws_like($t$select public.carez_create_next_proposal_revision(
 'f7f00000-0000-4000-8000-000000000001')$t$,'%Issued Proposal revision not found%',
 'foreign company cannot fork the source Proposal');
select set_config('request.jwt.claim.sub','f7100000-0000-4000-8000-000000000001',true);

-- Privileged assertions inspect private maps; no command is invoked here.
reset role;
insert into strip_results select 'maps',maps from public.proposal_revision_forks
 where proposal_revision_id='f7f00000-0000-4000-8000-000000000001';
select extensions.ok(pg_temp.fork_originals_unchanged(),
 'successful fork and retry preserve original graph, issued snapshot, and token');
select extensions.ok((select status='complete' and copy_table is null and copy_payload is null
 from public.proposal_revision_forks where proposal_revision_id='f7f00000-0000-4000-8000-000000000001'),
 'receipt finishes with no reusable pending copy exception');

do $verify$ declare maps jsonb:=(select value from strip_results where key='maps');
 dest uuid:=(select (value->>'estimate_id')::uuid from strip_results where key='fork');
 relation text;old text;copied text;original jsonb;actual jsonb;spec jsonb;f text;target text;
 expected uuid;counted integer;old_estimate uuid:='f7300000-0000-4000-8000-000000000001';
 fk jsonb:='{
 "takeoff_sets":{"estimate_id":"estimates"},
 "takeoff_sheets":{"takeoff_set_id":"takeoff_sets"},
 "takeoff_scale_regions":{"takeoff_set_id":"takeoff_sets","sheet_id":"takeoff_sheets"},
 "takeoff_method_profiles":{"takeoff_set_id":"takeoff_sets"},
 "takeoff_measurements":{"takeoff_set_id":"takeoff_sets","sheet_id":"takeoff_sheets","estimate_id":"estimates","estimate_section_id":"estimate_sections","scale_region_id":"takeoff_scale_regions","method_profile_id":"takeoff_method_profiles"},
 "takeoff_measurement_outputs":{"measurement_id":"takeoff_measurements","generated_estimate_item_id":"estimate_items"},
 "project_concrete_conditions":{"takeoff_set_id":"takeoff_sets","compatibility_projection_version_id":"project_concrete_condition_versions"},
 "project_concrete_condition_versions":{"condition_id":"project_concrete_conditions","source_version_id":"project_concrete_condition_versions","legacy_method_profile_id":"takeoff_method_profiles","compatibility_anchor_measurement_id":"takeoff_measurements"},
 "project_condition_module_instances":{"condition_version_id":"project_concrete_condition_versions"},
 "project_condition_measurement_roles":{"condition_version_id":"project_concrete_condition_versions","measurement_id":"takeoff_measurements"},
 "project_condition_outputs":{"condition_version_id":"project_concrete_condition_versions","module_instance_id":"project_condition_module_instances","driver_measurement_role_id":"project_condition_measurement_roles","legacy_takeoff_output_id":"takeoff_measurement_outputs","generated_estimate_item_id":"estimate_items"},
 "project_condition_holds":{"condition_version_id":"project_concrete_condition_versions","output_id":"project_condition_outputs"},
 "estimate_supplier_quote_sets":{"estimate_id":"estimates"},
 "estimate_supplier_quotes":{"quote_set_id":"estimate_supplier_quote_sets"},
 "estimate_supplier_quote_lines":{"quote_id":"estimate_supplier_quotes","source_takeoff_output_id":"takeoff_measurement_outputs","generated_estimate_item_id":"estimate_items"},
 "estimate_items":{"estimate_id":"estimates","section_id":"estimate_sections","source_takeoff_output_id":"takeoff_measurement_outputs","source_takeoff_measurement_id":"takeoff_measurements"}}
 '::jsonb;
begin
 if dest is null or maps is null then raise exception 'Fork did not produce inspectable child graph';end if;
 for relation,spec in select * from jsonb_each(maps) loop
  if jsonb_typeof(spec)<>'object' then raise exception 'Invalid map %',relation;end if;
  select count(*) into counted from jsonb_object_keys(spec);
  if counted<>(select count(*) from fork_original_rows where table_name=relation) then
   raise exception 'Source/map cardinality mismatch for %',relation;end if;
  for old,copied in select * from jsonb_each_text(spec) loop
   if old=copied then raise exception 'Fork reused % identity %',relation,old;end if;
   select payload into strict original from fork_original_rows where table_name=relation and id=old::uuid;
   execute format('select to_jsonb(t) from public.%I t where id=$1',relation) into actual using copied::uuid;
   if actual is null or actual->>'company_id'<>'f7200000-0000-4000-8000-000000000001' then
    raise exception 'Copied row missing or wrong tenant: %.%',relation,copied;end if;
   for f,target in select * from jsonb_each_text(coalesce(fk->relation,'{}')) loop
    expected:=case when original->>f is null then null else (maps->target->>(original->>f))::uuid end;
    if (actual->>f)::uuid is distinct from expected then
     raise exception 'Cross-graph FK remained/went wrong: %.%',relation,f;end if;
   end loop;
   if relation='estimate_items' and (
    actual->>'revision_source_estimate_item_id' is distinct from old or
    actual->'revision_source_takeoff_output_id' is distinct from original->'source_takeoff_output_id' or
    actual->'revision_source_takeoff_measurement_id' is distinct from original->'source_takeoff_measurement_id') then
    raise exception 'Explicit original commercial lineage missing';end if;
   if relation in ('estimate_items','takeoff_measurement_outputs') and original->>'price_source_kind'='supplier_quote'
    and actual->>'price_source_id' is distinct from maps->'estimate_supplier_quote_lines'->>(original->>'price_source_id') then
    raise exception 'Selected supplier price still points to source graph';end if;
  end loop;
 end loop;
 if exists(select 1 from public.proposal_presentations where estimate_id=dest)
  or exists(select 1 from public.proposal_access_tokens where estimate_id=dest) then
  raise exception 'Draft inherited issued presentation/access authority';end if;
 if (select count(*) from public.estimates where parent_proposal_revision_id='f7f00000-0000-4000-8000-000000000001')<>1 then
  raise exception 'Retry duplicated child Estimate';end if;
end $verify$;
select extensions.pass('all copied identities, tenant scope, graph FKs, commercial source lineage and retry counts verified');

do $specific$ declare maps jsonb:=(select value from strip_results where key='maps');
 h uuid:=(select (value->>'id')::uuid from strip_results where key='history');
 d uuid:=(select (value->>'id')::uuid from strip_results where key='later-draft');
 copied_h uuid;copied_d uuid;trace jsonb;copied_condition uuid;
begin
 copied_h:=(maps->'project_concrete_condition_versions'->>h::text)::uuid;
 copied_d:=(maps->'project_concrete_condition_versions'->>d::text)::uuid;
 if not exists(select 1 from public.takeoff_sheets where id=(maps->'takeoff_sheets'->>'f7600000-0000-4000-8000-000000000001')::uuid
  and calibration='{"ft_per_pdf_unit":1,"fixture":"calibration-retained"}' and scale_status='calibrated')
  or not exists(select 1 from public.takeoff_scale_regions where id=(maps->'takeoff_scale_regions'->>'f7900000-0000-4000-8000-000000000001')::uuid
  and calibration='{"ft_per_pdf_unit":1,"fixture":"region-retained"}' and is_default) then
  raise exception 'Calibration/default region changed';end if;
 if not exists(select 1 from public.takeoff_method_profiles where id=(maps->'takeoff_method_profiles'->>'f7a00000-0000-4000-8000-000000000001')::uuid
  and status='retired' and verified_at='2026-01-01T00:00:00Z') then raise exception 'Historical retired profile lost';end if;
 if not exists(select 1 from public.project_concrete_condition_versions where id=copied_h
  and status='verified' and verified_by is null and verified_at is null
  and condition_name_snapshot='Historical footing label') then
  raise exception 'Historical verification attribution/label was fabricated';end if;
 if not exists(select 1 from public.project_concrete_condition_versions where id=copied_d
  and status='draft' and source_version_id=copied_h and condition_name_snapshot='Current footing label') then
  raise exception 'Later draft ancestry/current snapshot changed';end if;
 if (select count(*) from public.project_condition_measurement_roles where condition_version_id in(copied_h,copied_d))<>4
  or (select count(*) from public.project_condition_module_instances where condition_version_id in(copied_h,copied_d)
   and instance_key='synthetic-second-set')<>2 then raise exception 'Repeated role/module history lost';end if;
 if not exists(select 1 from public.takeoff_measurements
  where id=(maps->'takeoff_measurements'->>'f7700000-0000-4000-8000-000000000002')::uuid
  and status='excluded') then raise exception 'Excluded geometry history changed';end if;
 if not exists(select 1 from public.project_condition_holds where condition_version_id=copied_d and status='open'
  and message='Synthetic later draft still requires review')
  or not exists(select 1 from public.project_condition_holds where condition_version_id=copied_h and status='resolved'
  and output_id in(select id from public.project_condition_outputs where condition_version_id=copied_h)) then
  raise exception 'Open/resolved hold or output link lost';end if;
 select calculation_trace into strict trace from public.project_condition_outputs
 where condition_version_id=copied_h and output_key='concrete.procurement_cy';
 if trace->>'conditionVersionId' is distinct from copied_h::text
  or trace->'measurementIds' is distinct from jsonb_build_array(
   maps->'takeoff_measurements'->>'f7700000-0000-4000-8000-000000000001',
   maps->'takeoff_measurements'->>'f7700000-0000-4000-8000-000000000002')
  or trace#>>'{supplier,source_id}' is distinct from maps->'estimate_supplier_quote_lines'->>'f7d00000-0000-4000-8000-000000000001' then
  raise exception 'Nested trace still references source graph';end if;
 if not exists(select 1 from public.estimate_supplier_quotes where id=(maps->'estimate_supplier_quotes'->>'f7c00000-0000-4000-8000-000000000001')::uuid
  and status='selected') or not exists(select 1 from public.estimate_supplier_quote_lines
  where id=(maps->'estimate_supplier_quote_lines'->>'f7d00000-0000-4000-8000-000000000001')::uuid and quoted_unit_cost=123.45) then
  raise exception 'Selected supplier price evidence lost';end if;
 if not exists(select 1 from public.proposal_presentations where id='f7f00000-0000-4000-8000-000000000001'
  and internal_commercial_snapshot->>'schema_version'='1'
  and jsonb_array_length(internal_commercial_snapshot->'measurements')=2
  and jsonb_array_length(internal_commercial_snapshot->'condition_versions')=2
  and jsonb_array_length(internal_commercial_snapshot->'items')>0) then
  raise exception 'Seed did not use actual frozen commercial snapshot capture';end if;
end $specific$;
select extensions.pass('calibration, retired binding, historical NULL attribution, ancestry, repeated roles/modules, nested traces, supplier evidence and holds verified');
select extensions.ok(not exists(select 1 from pg_trigger where
 (tgrelid='public.proposal_presentations'::regclass and tgname in('guard_proposal_release','capture_proposal_commercial_snapshot')
 or tgrelid='public.project_concrete_condition_versions'::regclass and tgname='project_concrete_condition_versions_guard')
 and tgenabled<>'O'), 'all temporarily touched historical-seed guards restored before/after fork');
select * from extensions.finish();rollback;
