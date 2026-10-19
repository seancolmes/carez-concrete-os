-- Isolated signup-compatible authorization fixture.
-- Real signup metadata + explicit UTC fixture calendar + privileged original
-- authorization-context assignment only. No assertion/business-record rewrite,
-- trigger bypass, account/company cleanup, or claim of onboarding qualification.
-- Isolated local Supabase only; run as postgres against the full source schema.
-- No production functions, guards, RLS policies, or calculation services are
-- replaced. The published component is the identity formula quantity -> LF.
-- Known calibrated 10/20 LF inputs exercise the database persistence contract;
-- TypeScript geometry calculation and joined Condition/browser lifecycle remain
-- covered separately. Every fixture object and write rolls back.
begin;
create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

insert into auth.users(id,raw_user_meta_data) values
  ('91600000-0000-4000-8000-000000000001', jsonb_build_object('company_name','Local Geometry History Fixture','full_name','Geometry Fixture Owner','operating_timezone','UTC')),
  ('91600000-0000-4000-8000-000000000002', jsonb_build_object('company_name','Local Geometry History Fixture','full_name','Geometry Fixture Employee','operating_timezone','UTC')),
  ('91600000-0000-4000-8000-000000000003', jsonb_build_object('company_name','Other Geometry History Tenant','full_name','Other Geometry Owner','operating_timezone','UTC'));
insert into public.companies(id,name,operating_timezone) values
  ('91600000-0000-4000-8000-000000000010', 'Local Geometry History Fixture', 'UTC'),
  ('91600000-0000-4000-8000-000000000011', 'Other Geometry History Tenant', 'UTC');
-- Privileged setup mirrors proposal-issue-runtime: preserve the original
-- company/role/name contexts after real signup; application ACLs stay unchanged.
update public.profiles p set company_id=v.company_id::uuid,full_name=v.full_name,role=v.role
from (values
  ('91600000-0000-4000-8000-000000000001', '91600000-0000-4000-8000-000000000010', 'Geometry Fixture Owner', 'owner'),
  ('91600000-0000-4000-8000-000000000002', '91600000-0000-4000-8000-000000000010', 'Geometry Fixture Employee', 'employee'),
  ('91600000-0000-4000-8000-000000000003', '91600000-0000-4000-8000-000000000011', 'Other Geometry Owner', 'owner')) v(id,company_id,full_name,role)
where p.id=v.id::uuid;

create temporary table geometry_history_case(
  measurement_id uuid primary key,
  scale_region_id uuid not null,
  before_geometry jsonb not null,
  after_geometry jsonb not null,
  before_outputs jsonb not null,
  after_outputs jsonb not null,
  current_revision timestamptz not null,
  saved_state jsonb
);
create function pg_temp.geometry_history_outputs(p_quantity numeric)
returns jsonb language sql immutable as $$
  select jsonb_build_array(jsonb_build_object(
    'assembly_component_id','91600000-0000-4000-8000-000000000062',
    'component_key','measured_lf','label','Measured fixture material',
    'production_quantity',p_quantity,'production_unit','LF','estimated_man_hours',0,
    'unit_cost',5,'direct_cost',round(p_quantity*5,2),'pricing_status','priced',
    'cost_source','Local published component default','price_source_kind','template_default',
    'price_source_label','Local published component default',
    'is_active',true,'estimate_visible',true,'resource_behavior','consumed_material',
    'formula_trace',jsonb_build_object('formula',jsonb_build_object('var','quantity'))
  ));
$$;
create function pg_temp.geometry_history_state(p_measurement_id uuid)
returns jsonb language sql stable security invoker set search_path=pg_catalog,public as $$
  select jsonb_build_object(
    'measurement',(select to_jsonb(m) from public.takeoff_measurements m where m.id=p_measurement_id),
    'outputs',coalesce((select jsonb_agg(to_jsonb(o) order by o.id)
      from public.takeoff_measurement_outputs o where o.measurement_id=p_measurement_id),'[]'::jsonb),
    'items',coalesce((select jsonb_agg(to_jsonb(i) order by i.id)
      from public.estimate_items i where i.source_takeoff_measurement_id=p_measurement_id),'[]'::jsonb)
  );
$$;
do $$
begin
  execute format('grant usage on schema %I to authenticated',
    (select nspname from pg_namespace where oid=pg_my_temp_schema()));
end;
$$;
grant select,insert,update on pg_temp.geometry_history_case to authenticated;
grant execute on function pg_temp.geometry_history_outputs(numeric),pg_temp.geometry_history_state(uuid) to authenticated;

select set_config('request.jwt.claim.sub','91600000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;

insert into public.estimates(id,company_id,estimate_number,name,status,version,created_by) values
  ('91600000-0000-4000-8000-000000000020','91600000-0000-4000-8000-000000000010',
   'E-LOCAL-GEOMETRY','Local checked geometry','draft',1,'91600000-0000-4000-8000-000000000001');
insert into public.estimate_sections(id,company_id,estimate_id,name,scope_type,sort_order) values
  ('91600000-0000-4000-8000-000000000021','91600000-0000-4000-8000-000000000010',
   '91600000-0000-4000-8000-000000000020','Measured fixture scope','footing',10);
insert into public.takeoff_sets(id,company_id,estimate_id,name,page_count,created_by) values
  ('91600000-0000-4000-8000-000000000030','91600000-0000-4000-8000-000000000010',
   '91600000-0000-4000-8000-000000000020','Checked geometry fixture',1,'91600000-0000-4000-8000-000000000001');
insert into public.takeoff_sheets(id,company_id,takeoff_set_id,page_number,sheet_number,title,page_width,page_height) values
  ('91600000-0000-4000-8000-000000000040','91600000-0000-4000-8000-000000000010',
   '91600000-0000-4000-8000-000000000030',1,'FIXTURE-1','Local geometry reference',1000,1000);
insert into public.concrete_assemblies(id,company_id,code,name,category,primary_measurement,created_by) values
  ('91600000-0000-4000-8000-000000000060','91600000-0000-4000-8000-000000000010',
   'LOCAL-GEOMETRY-HISTORY','Local measured material','Local fixture','LF','91600000-0000-4000-8000-000000000001');
insert into public.concrete_assembly_versions(
  id,company_id,assembly_id,version_no,status,source_type,source_label,
  assembly_code_snapshot,assembly_name_snapshot,category_snapshot,primary_measurement_snapshot,created_by
) values (
  '91600000-0000-4000-8000-000000000061','91600000-0000-4000-8000-000000000010',
  '91600000-0000-4000-8000-000000000060',1,'draft','manual','Local geometry-history fixture',
  'LOCAL-GEOMETRY-HISTORY','Local measured material','Local fixture','LF','91600000-0000-4000-8000-000000000001'
);
insert into public.concrete_assembly_components(
  id,company_id,assembly_version_id,component_key,label,estimate_item_type,output_unit,
  quantity_formula,pricing_strategy,default_unit_cost,resource_behavior,estimate_visible
) values (
  '91600000-0000-4000-8000-000000000062','91600000-0000-4000-8000-000000000010',
  '91600000-0000-4000-8000-000000000061','measured_lf','Measured fixture material','material','LF',
  '{"var":"quantity"}'::jsonb,'current_cost',5,'consumed_material',true
);
-- Publish through the real version validation/immutability triggers.
update public.concrete_assembly_versions set status='published'
where id='91600000-0000-4000-8000-000000000061';

do $$
declare v_scale uuid;v_measurement uuid;v_before jsonb;v_after jsonb;
begin
  -- 100 PDF units = 10 FT on a 1000x1000 page.
  v_scale:=public.carez_upsert_takeoff_scale_region(
    '91600000-0000-4000-8000-000000000040',null,'Local accepted scale',
    '{"x":0,"y":0,"width":1,"height":1}'::jsonb,'10 FT manual calibration','manual','manual',
    null,null,null,
    '{"ft_per_pdf_unit":0.1,"method":"manual","known_distance_ft":10,"pdf_distance":100,"points":[{"x":0.1,"y":0.1},{"x":0.2,"y":0.1}]}'::jsonb,
    true
  );
  v_before:='{"type":"polyline","points":[{"x":0.1,"y":0.1},{"x":0.2,"y":0.1}]}'::jsonb;
  v_after:='{"type":"polyline","points":[{"x":0.1,"y":0.1},{"x":0.3,"y":0.1}]}'::jsonb;
  v_measurement:=public.carez_commit_drawing_measurement(
    '91600000-0000-4000-8000-000000000030','91600000-0000-4000-8000-000000000040',
    '91600000-0000-4000-8000-000000000021','91600000-0000-4000-8000-000000000061',
    'Local geometry history run','','FIXTURE-1','linear',10,'LF','{}'::jsonb,'',
    v_before||'{"page_number":1}'::jsonb,pg_temp.geometry_history_outputs(10),v_scale,null
  );
  insert into pg_temp.geometry_history_case
    (measurement_id,scale_region_id,before_geometry,after_geometry,before_outputs,after_outputs,current_revision)
  select v_measurement,v_scale,v_before,v_after,pg_temp.geometry_history_outputs(10),pg_temp.geometry_history_outputs(20),updated_at
  from public.takeoff_measurements where id=v_measurement;
end;
$$;

select extensions.ok(
  exists(select 1 from pg_trigger where tgrelid='public.proposal_presentations'::regclass
    and tgname='guard_proposal_release' and tgenabled='O' and not tgisinternal),
  'production Proposal release guard remains enabled'
);
select extensions.ok(
  not (select prosecdef from pg_proc
    where oid='public.carez_update_drawing_measurement_checked(uuid,jsonb,numeric,text,jsonb,jsonb,uuid,jsonb,timestamptz)'::regprocedure)
  and not has_function_privilege('anon','public.carez_update_drawing_measurement_checked(uuid,jsonb,numeric,text,jsonb,jsonb,uuid,jsonb,timestamptz)','EXECUTE'),
  'checked geometry executes with invoker authority and denies anonymous execution'
);
select extensions.is(
  (select count(*) from public.carez_assembly_component_paths(
    '91600000-0000-4000-8000-000000000010','91600000-0000-4000-8000-000000000061')),
  1::bigint,'real published assembly exposes exactly its identity-formula component'
);
select extensions.ok(
  exists(select 1 from public.takeoff_scale_regions r join pg_temp.geometry_history_case c on c.scale_region_id=r.id
    join public.takeoff_sheets s on s.id=r.sheet_id
    where r.is_default and (r.calibration->>'ft_per_pdf_unit')::numeric=0.1 and s.scale_status='calibrated'),
  'scale RPC records the accepted calibration and calibrated sheet'
);
select extensions.ok(
  exists(select 1 from public.takeoff_measurements m join pg_temp.geometry_history_case c on c.measurement_id=m.id
    join public.takeoff_measurement_outputs o on o.measurement_id=m.id
    join public.estimate_items i on i.id=o.generated_estimate_item_id and i.source_takeoff_output_id=o.id
    where m.source='drawing' and m.raw_quantity=10 and m.raw_unit='LF' and m.scale_region_id=c.scale_region_id
      and o.production_quantity=10 and o.direct_cost=50 and i.quantity=10 and i.direct_cost=50
      and i.source_takeoff_measurement_id=m.id and i.source_assembly_version_id=m.assembly_version_id),
  'drawing commit preserves initial calibrated quantity, priced output and exact Estimate lineage'
);

select extensions.lives_ok($sql$
  select public.carez_update_drawing_measurement_checked(
    measurement_id,after_geometry||'{"page_number":1}'::jsonb,20,'LF','{}'::jsonb,
    after_outputs,scale_region_id,before_geometry,current_revision)
  from pg_temp.geometry_history_case
$sql$,'checked geometry commits against the confirmed geometry and revision');
update pg_temp.geometry_history_case c set
  current_revision=(select updated_at from public.takeoff_measurements where id=c.measurement_id),
  saved_state=pg_temp.geometry_history_state(c.measurement_id);
select extensions.ok(
  exists(select 1 from public.takeoff_measurements m join pg_temp.geometry_history_case c on c.measurement_id=m.id
    join public.takeoff_measurement_outputs o on o.measurement_id=m.id
    join public.estimate_items i on i.id=o.generated_estimate_item_id and i.source_takeoff_output_id=o.id
    where m.geometry=c.after_geometry||'{"page_number":1}'::jsonb and m.raw_quantity=20
      and o.production_quantity=20 and o.direct_cost=100 and i.quantity=20 and i.direct_cost=100),
  'confirmed edit updates saved geometry, output and Estimate quantities through the existing path'
);
select extensions.throws_ok($sql$
  select public.carez_update_drawing_measurement_checked(
    measurement_id,before_geometry,10,'LF','{}'::jsonb,before_outputs,scale_region_id,before_geometry,current_revision)
  from pg_temp.geometry_history_case
$sql$,'40001','Drawing changed since this history was recorded. Reload and review the current geometry.',
  'stale geometry cannot replay over a newer confirmed shape');
select extensions.ok(
  (select pg_temp.geometry_history_state(measurement_id)=saved_state from pg_temp.geometry_history_case),
  'stale geometry rejection changes neither geometry nor generated commercial facts'
);
-- now() is transaction-stable in a rollback-only fixture. Use an explicitly
-- stale expected revision; do not pretend successive commits advance wall time.
select extensions.throws_ok($sql$
  select public.carez_update_drawing_measurement_checked(
    measurement_id,before_geometry,10,'LF','{}'::jsonb,before_outputs,scale_region_id,
    after_geometry,current_revision-interval '1 microsecond')
  from pg_temp.geometry_history_case
$sql$,'40001','Drawing changed since this history was recorded. Reload and review the current geometry.',
  'stale revision is rejected even when expected geometry matches');
select extensions.ok(
  (select pg_temp.geometry_history_state(measurement_id)=saved_state from pg_temp.geometry_history_case),
  'stale revision rejection preserves the complete persisted state'
);

select extensions.lives_ok($sql$
  select public.carez_update_drawing_measurement_checked(
    measurement_id,before_geometry||'{"page_number":1}'::jsonb,10,'LF','{}'::jsonb,
    before_outputs,scale_region_id,after_geometry,current_revision)
  from pg_temp.geometry_history_case
$sql$,'checked undo restores the prior geometry through the server mutation');
update pg_temp.geometry_history_case c set
  current_revision=(select updated_at from public.takeoff_measurements where id=c.measurement_id);
select extensions.ok(
  exists(select 1 from public.takeoff_measurements m join pg_temp.geometry_history_case c on c.measurement_id=m.id
    join public.takeoff_measurement_outputs o on o.measurement_id=m.id
    join public.estimate_items i on i.id=o.generated_estimate_item_id and i.source_takeoff_output_id=o.id
    where m.geometry=c.before_geometry||'{"page_number":1}'::jsonb and m.raw_quantity=10
      and o.production_quantity=10 and o.direct_cost=50 and i.quantity=10 and i.direct_cost=50),
  'confirmed undo restores authoritative quantity and linked output cost'
);
select extensions.lives_ok($sql$
  select public.carez_update_drawing_measurement_checked(
    measurement_id,after_geometry||'{"page_number":1}'::jsonb,20,'LF','{}'::jsonb,
    after_outputs,scale_region_id,before_geometry,current_revision)
  from pg_temp.geometry_history_case
$sql$,'checked redo reapplies geometry through the same server mutation');
update pg_temp.geometry_history_case c set
  current_revision=(select updated_at from public.takeoff_measurements where id=c.measurement_id),
  saved_state=pg_temp.geometry_history_state(c.measurement_id);
select extensions.ok(
  exists(select 1 from public.takeoff_measurements m join pg_temp.geometry_history_case c on c.measurement_id=m.id
    join public.takeoff_measurement_outputs o on o.measurement_id=m.id
    join public.estimate_items i on i.id=o.generated_estimate_item_id and i.source_takeoff_output_id=o.id
    where m.geometry=c.after_geometry||'{"page_number":1}'::jsonb and m.raw_quantity=20
      and o.production_quantity=20 and o.direct_cost=100 and i.quantity=20 and i.direct_cost=100)
  and (select count(*) from public.takeoff_measurement_outputs o
       join pg_temp.geometry_history_case c on c.measurement_id=o.measurement_id)=1
  and (select count(*) from public.estimate_items i
       join pg_temp.geometry_history_case c on c.measurement_id=i.source_takeoff_measurement_id)=1,
  'confirmed redo restores quantities and retains one output and one Estimate item'
);

update public.takeoff_sets set status='archived' where id='91600000-0000-4000-8000-000000000030';
select extensions.throws_ok($sql$
  select public.carez_update_drawing_measurement_checked(
    measurement_id,before_geometry,10,'LF','{}'::jsonb,before_outputs,scale_region_id,after_geometry,current_revision)
  from pg_temp.geometry_history_case
$sql$,'P0001','Takeoff revision is read-only.','inactive Takeoff set blocks checked replay');
update public.takeoff_sets set status='active' where id='91600000-0000-4000-8000-000000000030';
select extensions.ok(
  (select pg_temp.geometry_history_state(measurement_id)=saved_state from pg_temp.geometry_history_case),
  'inactive-set rejection preserves geometry and generated facts'
);

update public.estimates set status='superseded' where id='91600000-0000-4000-8000-000000000020';
select extensions.throws_ok($sql$
  select public.carez_update_drawing_measurement_checked(
    measurement_id,before_geometry,10,'LF','{}'::jsonb,before_outputs,scale_region_id,after_geometry,current_revision)
  from pg_temp.geometry_history_case
$sql$,'P0001','This estimate revision is locked.','locked Estimate blocks the underlying geometry mutation');
update public.estimates set status='draft' where id='91600000-0000-4000-8000-000000000020';
select extensions.ok(
  (select pg_temp.geometry_history_state(measurement_id)=saved_state from pg_temp.geometry_history_case),
  'locked-Estimate rejection preserves geometry and generated facts'
);

select set_config('request.jwt.claim.sub','91600000-0000-4000-8000-000000000003',true);
select extensions.throws_ok($sql$
  select public.carez_update_drawing_measurement_checked(
    measurement_id,before_geometry,10,'LF','{}'::jsonb,before_outputs,scale_region_id,after_geometry,current_revision)
  from pg_temp.geometry_history_case
$sql$,'P0001','Drawing measurement unavailable. Reload before editing.','another tenant cannot replay geometry history');
select set_config('request.jwt.claim.sub','91600000-0000-4000-8000-000000000002',true);
select extensions.throws_ok($sql$
  select public.carez_update_drawing_measurement_checked(
    measurement_id,before_geometry,10,'LF','{}'::jsonb,before_outputs,scale_region_id,after_geometry,current_revision)
  from pg_temp.geometry_history_case
$sql$,'P0001',null::text,'employee cannot mutate geometry through checked replay');
select set_config('request.jwt.claim.sub','91600000-0000-4000-8000-000000000001',true);
select extensions.ok(
  (select pg_temp.geometry_history_state(measurement_id)=saved_state from pg_temp.geometry_history_case),
  'tenant and employee denials leave the owner persisted state unchanged'
);
select extensions.ok(
  not exists(select 1 from public.project_concrete_conditions where takeoff_set_id='91600000-0000-4000-8000-000000000030')
  and exists(select 1 from pg_trigger where tgrelid='public.proposal_presentations'::regclass
    and tgname='guard_proposal_release' and tgenabled='O' and not tgisinternal),
  'fixture remains unlinked geometry with production release guard intact'
);

reset role;
select * from extensions.finish();
rollback;
