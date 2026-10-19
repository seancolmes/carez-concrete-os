-- Isolated v7 pricing/lineage fixture. Disposable local database after 135300.
-- Database persistence/pricing/upgrade qualification, NOT a test of the TypeScript calculator.
-- The pg_temp helper follows strip-v6-runtime.sql's real atomic-commit projection seam.
-- Its synthetic outputs explicitly use 36 LF x 2 FT x 1 FT / 27, 5% ordering allowance.
\set ON_ERROR_STOP on
begin;
create extension if not exists pgtap with schema extensions;
select extensions.no_plan();
alter table auth.users disable trigger on_auth_user_created;
insert into auth.users(id,email) values
 ('f8100000-0000-4000-8000-000000000001','strip-v7-owner@local.invalid'),
 ('f8100000-0000-4000-8000-000000000002','strip-v7-other@local.invalid'),
 ('f8100000-0000-4000-8000-000000000003','strip-v7-employee@local.invalid');
alter table auth.users enable trigger on_auth_user_created;
insert into public.companies(id,name,operating_timezone,target_margin_percent,planned_productive_hours_annual,owner_compensation_target_annual,owner_planned_field_hours_annual,owner_field_rate) values
 ('f8200000-0000-4000-8000-000000000001','Synthetic Strip v7 contractor','UTC',20,2000,0,0,0),
 ('f8200000-0000-4000-8000-000000000002','Other synthetic Strip contractor','UTC',20,2000,0,0,0);
insert into public.profiles(id,company_id,role) values
 ('f8100000-0000-4000-8000-000000000001','f8200000-0000-4000-8000-000000000001','owner'),
 ('f8100000-0000-4000-8000-000000000002','f8200000-0000-4000-8000-000000000002','owner'),
 ('f8100000-0000-4000-8000-000000000003','f8200000-0000-4000-8000-000000000001','employee');
select set_config('request.jwt.claim.sub','f8100000-0000-4000-8000-000000000001',true);
set local role authenticated;
-- Record an explicit synthetic zero-overhead plan through its supported command.
select public.carez_save_company_plan('f8900000-0000-4000-8000-000000000100',0,'{"target_margin_percent":20,"planned_productive_hours_annual":2000,"owner_compensation_target_annual":0,"owner_planned_field_hours_annual":0,"owner_field_rate":0}');
update public.overhead_items set active=false where company_id='f8200000-0000-4000-8000-000000000001';
insert into public.estimates(id,company_id,estimate_number,name,status,version,created_by,target_margin_percent,bo_rate_percent,payment_processing_rate_percent,proposed_sell_price)
values('f8300000-0000-4000-8000-000000000001','f8200000-0000-4000-8000-000000000001','SYN-V7','Synthetic v7 benchmark','draft',1,'f8100000-0000-4000-8000-000000000001',20,0,0,0);
select public.carez_attach_estimate_overhead('f8900000-0000-4000-8000-000000000101','f8300000-0000-4000-8000-000000000001',(select updated_at from public.estimates where id='f8300000-0000-4000-8000-000000000001'));
insert into public.takeoff_sets(id,company_id,estimate_id,name,created_by)
values('f8400000-0000-4000-8000-000000000001','f8200000-0000-4000-8000-000000000001','f8300000-0000-4000-8000-000000000001','Synthetic v7 takeoff','f8100000-0000-4000-8000-000000000001');
create temp table strip_v7_results(key text primary key,value jsonb);
grant all on strip_v7_results to authenticated;
insert into strip_v7_results values('v6',public.carez_ensure_strip_footing_v6_template());
insert into strip_v7_results select 'published-v6-before',to_jsonb(a) from public.platform_condition_archetype_versions a where a.archetype_code_snapshot='strip_wall_footing' and a.version_no=6 and a.status='published';
insert into strip_v7_results values('v7',public.carez_ensure_strip_footing_v7_template());
select extensions.is(public.carez_ensure_strip_footing_v7_template()->>'template_version_id',(select value->>'template_version_id' from strip_v7_results where key='v7'),'v7 template initialization is stable');
select extensions.is((select to_jsonb(a) from public.platform_condition_archetype_versions a where a.archetype_code_snapshot='strip_wall_footing' and a.version_no=6 and a.status='published'),(select value from strip_v7_results where key='published-v6-before'),'published v6 is unchanged');
select extensions.is((select value->>'legacy_assembly_version_id' from strip_v7_results where key='v7'),(select value->>'legacy_assembly_version_id' from strip_v7_results where key='v6'),'v7 retains compatibility assembly identity');
insert into strip_v7_results values('condition',jsonb_build_object('id',public.carez_create_project_concrete_condition('f8400000-0000-4000-8000-000000000001',(select (value->>'template_version_id')::uuid from strip_v7_results where key='v6'),'SYN-V7','Synthetic benchmark condition')));
insert into public.takeoff_sheets(id,company_id,takeoff_set_id,page_number,title)
values('f8600000-0000-4000-8000-000000000001','f8200000-0000-4000-8000-000000000001','f8400000-0000-4000-8000-000000000001',1,'Synthetic 36 LF sheet');
insert into public.takeoff_measurements(id,company_id,takeoff_set_id,sheet_id,estimate_id,assembly_version_id,name,measurement_type,raw_quantity,raw_unit,geometry,source,created_by)
values('f8700000-0000-4000-8000-000000000001','f8200000-0000-4000-8000-000000000001','f8400000-0000-4000-8000-000000000001','f8600000-0000-4000-8000-000000000001','f8300000-0000-4000-8000-000000000001',(select (value->>'legacy_assembly_version_id')::uuid from strip_v7_results where key='v6'),'Synthetic 36 LF run','linear',36,'LF','{"type":"polyline","points":[{"x":0,"y":0},{"x":36,"y":0}]}'::jsonb,'manual','f8100000-0000-4000-8000-000000000001');

create function pg_temp.strip_v7_projection_commit(p_version uuid,p_run uuid)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare
 company uuid:=public.get_my_company_id(); v public.project_concrete_condition_versions%rowtype;
 c public.project_concrete_conditions%rowtype; a public.platform_condition_archetype_versions%rowtype;
 t public.company_condition_template_versions%rowtype; m public.takeoff_measurements%rowtype;
 modules jsonb;roles jsonb;outputs jsonb;legacy jsonb;updates jsonb;
 installed numeric;ordered numeric;
begin
 select * into strict v from public.project_concrete_condition_versions where company_id=company and id=p_version;
 select * into strict c from public.project_concrete_conditions where company_id=company and id=v.condition_id;
 select * into strict a from public.platform_condition_archetype_versions where id=v.archetype_version_id;
 select * into strict t from public.company_condition_template_versions where company_id=company and id=v.template_version_id;
 select * into strict m from public.takeoff_measurements where company_id=company and id=p_run;
 installed:=round(m.raw_quantity*2*1/27,4);
 ordered:=round(m.raw_quantity*2*1/27*(1+5::numeric/100),4);
 select jsonb_agg(jsonb_build_object('module_key',x.module_key,'instance_key',x.instance_key,'label',x.label,
  'enabled',x.module_key='concrete','input_values',x.input_values,'input_provenance',x.input_provenance,
  'legacy_child_key',x.legacy_child_key,'sort_order',x.sort_order) order by x.sort_order)
 into modules from public.project_condition_module_instances x where x.company_id=company and x.condition_version_id=p_version;
 roles:=jsonb_build_array(jsonb_build_object('measurement_id',p_run,'role_key','run','role_instance_key','run-1','is_primary',true,'sort_order',10));
 select jsonb_agg(jsonb_build_object('output_key',d->>'key','output_instance_key','default','module_key',d->>'module_key',
  'module_instance_key','default','driver_measurement_id',p_run,'resource_class',d->>'resource_class','production_unit',d->>'unit',
  'quantity_mode','derived','status',case when d->>'module_key'='concrete' then 'ready' else 'inactive' end,
  'production_quantity',case d->>'key' when 'concrete.installed_cy' then installed when 'concrete.procurement_cy' then ordered else 0 end,
  'provenance',jsonb_build_object('authority','server','fixture',true),
  'calculation_trace',jsonb_build_object('conditionVersionId',p_version,'algorithm',d->>'algorithm','fixture','synthetic-projection-seam','length_ft',m.raw_quantity,'width_ft',2,'depth_ft',1,'waste_pct',5),
  'holds','[]'::jsonb) order by n) into outputs from jsonb_array_elements(a.output_schema) with ordinality x(d,n);
 select jsonb_agg(jsonb_build_object('assembly_component_id',p.component_id,'component_key',p.component_path_key,
  'condition_output_key',map.output_key,
  'production_quantity',case map.output_key when 'concrete.installed_cy' then installed when 'concrete.procurement_cy' then ordered else 0 end,
  'estimated_man_hours',0,'unit_cost',case when d->>'module_key'='concrete' then 1 else 0 end,
  'direct_cost',case map.output_key when 'concrete.installed_cy' then round(installed,2) when 'concrete.procurement_cy' then round(ordered,2) else 0 end,
  'pricing_status',case when d->>'module_key'='concrete' then 'priced' else 'not_priced' end,
  'is_active',d->>'module_key'='concrete',
  'estimate_visible',(d->>'module_key'='concrete' and (a.version_no<7 or map.output_key='concrete.procurement_cy')),
  'formula_trace',jsonb_build_object('condition_version_id',p_version,'condition_output_key',map.output_key,'fixture','synthetic-projection-seam')) order by p.component_path_key)
 into legacy from public.carez_assembly_component_paths(company,m.assembly_version_id) p
 join public.condition_legacy_output_mappings map on map.company_id=company and map.template_version_id=t.id and map.legacy_assembly_component_id=p.component_id
 join lateral jsonb_array_elements(a.output_schema) d on d->>'key'=map.output_key;
 updates:=jsonb_build_array(jsonb_build_object('measurement_id',p_run,'expected_updated_at',m.updated_at,'mode','condition_projection','outputs',legacy));
 return public.carez_commit_project_condition_calculation(p_version,v.updated_at,c.compatibility_projection_version_id,p_run,
  v.plan_facts||'{"width_ft":2,"depth_ft":1}'::jsonb,v.method_inputs,v.production_inputs,v.commercial_inputs||'{"concrete_waste_pct":5}'::jsonb,
  v.drawing_inputs,v.input_provenance,v.output_overrides,modules,roles,outputs,updates);
end $$;

select extensions.is(round(36::numeric*2*1/27,6),2.666667::numeric,'explicit synthetic installed basis is 2.666667 CY to six decimals');
select extensions.is(round(36::numeric*2*1/27*1.05,4),2.8::numeric,'explicit synthetic ordered basis is 2.8 CY');
select extensions.lives_ok($$select pg_temp.strip_v7_projection_commit((select (value->>'id')::uuid from strip_v7_results where key='condition'),'f8700000-0000-4000-8000-000000000001')$$,'real v6 commit creates compatibility outputs and generated estimate items');
insert into strip_v7_results select 'installed',to_jsonb(o) from public.takeoff_measurement_outputs o join public.condition_legacy_output_mappings m on m.company_id=o.company_id and m.legacy_assembly_component_id=o.assembly_component_id and m.template_version_id=(select (value->>'template_version_id')::uuid from strip_v7_results where key='v6') where o.measurement_id='f8700000-0000-4000-8000-000000000001' and m.output_key='concrete.installed_cy';
insert into strip_v7_results select 'ordered',to_jsonb(o) from public.takeoff_measurement_outputs o join public.condition_legacy_output_mappings m on m.company_id=o.company_id and m.legacy_assembly_component_id=o.assembly_component_id and m.template_version_id=(select (value->>'template_version_id')::uuid from strip_v7_results where key='v6') where o.measurement_id='f8700000-0000-4000-8000-000000000001' and m.output_key='concrete.procurement_cy';
select public.carez_update_takeoff_output_price((select (value->>'id')::uuid from strip_v7_results where key='installed'),150);
select public.carez_update_takeoff_output_price((select (value->>'id')::uuid from strip_v7_results where key='ordered'),150);
insert into public.estimate_supplier_quote_sets(id,company_id,estimate_id,name,created_by) values('f8800000-0000-4000-8000-000000000001','f8200000-0000-4000-8000-000000000001','f8300000-0000-4000-8000-000000000001','Synthetic concrete quote set','f8100000-0000-4000-8000-000000000001');
insert into public.estimate_supplier_quotes(id,company_id,quote_set_id,supplier_name,supplier_quote_number,quote_date,status,created_by) values('f8810000-0000-4000-8000-000000000001','f8200000-0000-4000-8000-000000000001','f8800000-0000-4000-8000-000000000001','Synthetic supplier','SYN-Q-150',current_date,'received','f8100000-0000-4000-8000-000000000001');
insert into public.estimate_supplier_quote_lines(id,company_id,quote_id,source_takeoff_output_id,generated_estimate_item_id,description,quoted_unit,quoted_unit_cost,source_reference,created_by)
select case key when 'ordered' then 'f8820000-0000-4000-8000-000000000001'::uuid else 'f8820000-0000-4000-8000-000000000002'::uuid end,'f8200000-0000-4000-8000-000000000001','f8810000-0000-4000-8000-000000000001',(value->>'id')::uuid,(value->>'generated_estimate_item_id')::uuid,'Synthetic '||key||' CY price evidence','CY',150,'Synthetic source; not real vendor evidence','f8100000-0000-4000-8000-000000000001' from strip_v7_results where key in ('ordered','installed');
select public.carez_select_estimate_supplier_quote_line('f8820000-0000-4000-8000-000000000001');
insert into strip_v7_results select 'installed-priced-before',to_jsonb(o) from public.takeoff_measurement_outputs o where o.id=(select (value->>'id')::uuid from strip_v7_results where key='installed');
insert into strip_v7_results select 'ordered-selected-before',to_jsonb(o) from public.takeoff_measurement_outputs o where o.id=(select (value->>'id')::uuid from strip_v7_results where key='ordered');
insert into strip_v7_results select 'version-before',to_jsonb(v) from public.project_concrete_condition_versions v where v.id=(select (value->>'id')::uuid from strip_v7_results where key='condition');
select extensions.throws_like($$select public.carez_upgrade_strip_condition_draft_to_v7('f8900000-0000-4000-8000-000000000010',(select (value->>'id')::uuid from strip_v7_results where key='condition'),(select (value->>'updated_at')::timestamptz-interval '1 second' from strip_v7_results where key='version-before'),'Synthetic stale request',true)$$,'%Draft changed%','stale expected revision is rejected');
select extensions.throws_like($$select public.carez_upgrade_strip_condition_draft_to_v7('f8900000-0000-4000-8000-000000000011',(select (value->>'id')::uuid from strip_v7_results where key='condition'),(select (value->>'updated_at')::timestamptz from strip_v7_results where key='version-before'),'Synthetic unacknowledged request',false)$$,'%acknowledgment%','installed-price removal requires explicit acknowledgment');
select extensions.throws_like($$select public.carez_upgrade_strip_condition_draft_to_v7('f8900000-0000-4000-8000-000000000012',(select (value->>'id')::uuid from strip_v7_results where key='condition'),(select (value->>'updated_at')::timestamptz from strip_v7_results where key='version-before'),' ',true)$$,'%reason%','blank upgrade reason is rejected');
insert into strip_v7_results values('upgrade',public.carez_upgrade_strip_condition_draft_to_v7('f8900000-0000-4000-8000-000000000001',(select (value->>'id')::uuid from strip_v7_results where key='condition'),(select (value->>'updated_at')::timestamptz from strip_v7_results where key='version-before'),'Synthetic explicit ordered-only supply price basis',true));
select extensions.is(public.carez_upgrade_strip_condition_draft_to_v7('f8900000-0000-4000-8000-000000000001',(select (value->>'id')::uuid from strip_v7_results where key='condition'),(select (value->>'updated_at')::timestamptz from strip_v7_results where key='version-before'),'Synthetic explicit ordered-only supply price basis',true),(select value from strip_v7_results where key='upgrade'),'identical retry returns the recorded result despite the old expected timestamp');
select extensions.throws_like($$select public.carez_upgrade_strip_condition_draft_to_v7('f8900000-0000-4000-8000-000000000001',(select (value->>'id')::uuid from strip_v7_results where key='condition'),(select (value->>'updated_at')::timestamptz from strip_v7_results where key='version-before'),'Changed request payload',true)$$,'%reused with different values%','request identity cannot be reused with changed evidence');
select extensions.ok((select v.plan_facts=b.value->'plan_facts' and v.method_inputs=b.value->'method_inputs' and v.commercial_inputs=b.value->'commercial_inputs' and v.compatibility_anchor_measurement_id is not distinct from (b.value->>'compatibility_anchor_measurement_id')::uuid from public.project_concrete_condition_versions v cross join strip_v7_results b where b.key='version-before' and v.id=(b.value->>'id')::uuid),'upgrade preserves physical/commercial inputs and explicit primary anchor');
select extensions.is((select c.compatibility_projection_version_id from public.project_concrete_conditions c join public.project_concrete_condition_versions v on v.company_id=c.company_id and v.condition_id=c.id where v.id=(select (value->>'id')::uuid from strip_v7_results where key='condition')),(select (value->>'id')::uuid from strip_v7_results where key='condition'),'upgrade retains prior projection lineage until explicit recalculation');
select extensions.is((select count(*) from public.condition_price_basis_upgrades where condition_version_id=(select (value->>'id')::uuid from strip_v7_results where key='condition')),1::bigint,'upgrade is audited exactly once');
select extensions.ok((select exists(select 1 from jsonb_array_elements(h.before_facts->'installed_legacy_outputs') o where o->>'id'=b.value->>'id' and o->>'pricing_status'='manual_override' and (o->>'unit_cost')::numeric=150 and (o->>'generated_estimate_item_id')::uuid=(b.value->>'generated_estimate_item_id')::uuid) from public.condition_price_basis_upgrades h cross join strip_v7_results b where b.key='installed-priced-before' and h.condition_version_id=(select (value->>'id')::uuid from strip_v7_results where key='condition')),'audit retains removed manual installed price and old generated-item identity');
select extensions.ok((select jsonb_array_length(before_facts->'installed_estimate_items')=1 and jsonb_array_length(before_facts->'installed_supplier_quote_lines')=1 from public.condition_price_basis_upgrades where condition_version_id=(select (value->>'id')::uuid from strip_v7_results where key='condition')),'audit retains removed installed estimate line and unselected supplier evidence');
select extensions.ok((select unit_cost=0 and direct_cost=0 and pricing_status='not_priced' and not estimate_visible and generated_estimate_item_id is null and price_source_kind is null from public.takeoff_measurement_outputs where id=(select (value->>'id')::uuid from strip_v7_results where key='installed')),'upgrade removes installed duplicate price but retains compatibility output identity');
select extensions.ok(not exists(select 1 from public.estimate_items where id=(select (value->>'generated_estimate_item_id')::uuid from strip_v7_results where key='installed')),'only the installed duplicate commercial line is removed');
select extensions.ok((select o.unit_cost=150 and o.price_source_kind='supplier_quote' and o.price_source_id='f8820000-0000-4000-8000-000000000001'::uuid and o.generated_estimate_item_id=(b.value->>'generated_estimate_item_id')::uuid from public.takeoff_measurement_outputs o cross join strip_v7_results b where b.key='ordered-selected-before' and o.id=(b.value->>'id')::uuid),'upgrade preserves selected procurement quote, price, output and generated-item identity');
select extensions.ok(exists(select 1 from public.project_condition_holds where condition_version_id=(select (value->>'id')::uuid from strip_v7_results where key='condition') and hold_code='review_required' and status='open'),'upgrade explicitly requires recalculation/review');
select extensions.ok((select count(*)=1 and bool_and(basis_ready is false) from public.strip_v7_commercial_quantity_basis where estimate_id='f8300000-0000-4000-8000-000000000001'),'held upgrade projection cannot qualify a Proposal quantity basis before recalculation');
select extensions.lives_ok($$select pg_temp.strip_v7_projection_commit((select (value->>'id')::uuid from strip_v7_results where key='condition'),'f8700000-0000-4000-8000-000000000001')$$,'real v7 commit succeeds using the existing projection seam');
select extensions.ok((select production_quantity=2.6667 and direct_cost=0 and unit_cost=0 and not estimate_visible and generated_estimate_item_id is null and price_source_kind is null from public.takeoff_measurement_outputs where id=(select (value->>'id')::uuid from strip_v7_results where key='installed')),'v7 recalculation cannot revive the installed manual price even with a priced synthetic payload');
select extensions.ok((select production_quantity=2.8 and unit_cost=150 and direct_cost=420 and price_source_kind='supplier_quote' and price_source_id='f8820000-0000-4000-8000-000000000001'::uuid from public.takeoff_measurement_outputs where id=(select (value->>'id')::uuid from strip_v7_results where key='ordered')),'selected $150 supplier quote survives recalculation rather than payload $1');
select extensions.ok((select generated_estimate_item_id=(value->>'generated_estimate_item_id')::uuid from public.takeoff_measurement_outputs cross join strip_v7_results where key='ordered-selected-before' and id=(value->>'id')::uuid),'procurement generated-item identity survives recalculation');
select extensions.ok((select unit_cost=150 and direct_cost=420 and production_quantity=2.8 from public.project_condition_outputs where condition_version_id=(select (value->>'id')::uuid from strip_v7_results where key='condition') and output_key='concrete.procurement_cy'),'condition output inherits the retained selected procurement price');
select extensions.ok((select i.quantity=2.8 and i.production_quantity=2.6667 and i.unit='CY' and i.production_unit='CY' and i.unit_cost=150 and i.direct_cost=420 from public.estimate_items i where i.id=(select (value->>'generated_estimate_item_id')::uuid from strip_v7_results where key='ordered-selected-before')),'Estimate cost quantity is ordered CY while production quantity remains installed CY');
select extensions.ok((select o.production_quantity=2.8 and o.production_unit='CY' and p.production_quantity=2.8 and p.production_unit='CY' from public.takeoff_measurement_outputs o join public.project_condition_outputs p on p.company_id=o.company_id and p.legacy_takeoff_output_id=o.id and p.output_key='concrete.procurement_cy' where o.id=(select (value->>'id')::uuid from strip_v7_results where key='ordered')),'raw procurement compatibility and Condition outputs retain ordered quantity');
select extensions.is((select count(*) from information_schema.columns where table_schema='public' and table_name='condition_legacy_reconciliation'),22::bigint,'reconciliation retains its existing 22-column contract');
select extensions.ok((select count(*)=2 and bool_and(reconciliation_status='exact') from public.condition_legacy_reconciliation where condition_version_id=(select (value->>'id')::uuid from strip_v7_results where key='condition') and output_key in ('concrete.installed_cy','concrete.procurement_cy')),'both v7 concrete outputs reconcile exactly with distinct cost and production quantities');
select extensions.ok(not exists(select 1 from public.condition_legacy_reconciliation where condition_version_id=(select (value->>'id')::uuid from strip_v7_results where key='condition') and reconciliation_status not in ('exact','inactive')),'every synthetic output reconciles exactly or is explicitly inactive');
select extensions.ok((select count(*)=1 and bool_and(basis_ready is true and installed_quantity=2.6667 and ordered_quantity=2.8 and production_unit='CY' and condition_version_id=(select (value->>'id')::uuid from strip_v7_results where key='condition') and legacy_output_id=(select (value->>'id')::uuid from strip_v7_results where key='ordered') and estimate_item_id=(select (value->>'generated_estimate_item_id')::uuid from strip_v7_results where key='ordered-selected-before')) from public.strip_v7_commercial_quantity_basis where estimate_id='f8300000-0000-4000-8000-000000000001'),'Proposal quantity-basis view has one qualified row with installed customer quantity and ordered supply quantity');
select extensions.ok((select reloptions @> array['security_invoker=true'] from pg_class where oid='public.strip_v7_commercial_quantity_basis'::regclass),'commercial quantity-basis view executes under tenant RLS');
-- Local fault injection only, within a rolled-back subtransaction. No trigger,
-- constraint or authorization is disabled; this is not a supported user edit.
reset role;
create function pg_temp.strip_v7_missing_link(p_link text) returns boolean language plpgsql as $$
declare qualified boolean;begin
 begin
  if p_link='item_measurement' then
   update public.estimate_items set source_takeoff_measurement_id=null where id=(select (value->>'generated_estimate_item_id')::uuid from strip_v7_results where key='ordered-selected-before');
  elsif p_link='legacy_backlink' then
   update public.takeoff_measurement_outputs set generated_estimate_item_id=null where id=(select (value->>'id')::uuid from strip_v7_results where key='ordered');
  else raise exception 'Unknown local fault';end if;
  select count(*)=1 and bool_and(basis_ready is false and quantity_basis='ordered_concrete') into qualified
   from public.strip_v7_commercial_quantity_basis where estimate_id='f8300000-0000-4000-8000-000000000001';
  raise exception using errcode='PT007',message='Roll back synthetic linkage fault';
 exception when sqlstate 'PT007' then return qualified;end;
end $$;
select extensions.ok(pg_temp.strip_v7_missing_link('item_measurement'),'missing item measurement pointer remains classified but unavailable, never ordered customer scope');
select extensions.ok(pg_temp.strip_v7_missing_link('legacy_backlink'),'missing legacy generated-item backlink remains classified but unavailable');
set local role authenticated;
select extensions.is((select count(*) from public.estimate_items where estimate_id='f8300000-0000-4000-8000-000000000001' and direct_cost<>0),1::bigint,'concrete supply is priced once');
select extensions.is((select total_direct_cost from public.estimate_financial_summary where estimate_id='f8300000-0000-4000-8000-000000000001'),420::numeric,'real estimate summary Direct Cost is $420');
select extensions.is((select recommended_sell_price from public.estimate_financial_summary where estimate_id='f8300000-0000-4000-8000-000000000001'),525::numeric,'existing formula yields $525 Sell at overhead 0, B&O 0, processing 0, margin 20%');
select extensions.is((select selected_sell_price from public.estimate_financial_summary where estimate_id='f8300000-0000-4000-8000-000000000001'),525::numeric,'calculated Sell remains selected without an entered proposed price');
select extensions.throws_like($$select public.carez_update_takeoff_output_price((select (value->>'id')::uuid from strip_v7_results where key='installed'),150)$$,'%Price ordered concrete supply instead%','v7 installed reference cannot be repriced manually');
select extensions.throws_like($$select public.carez_select_estimate_supplier_quote_line('f8820000-0000-4000-8000-000000000002')$$,'%Quoted Takeoff output not found%','existing installed quote evidence cannot revive reference pricing');
select extensions.throws_like($$select public.carez_update_takeoff_output_price((select (value->>'id')::uuid from strip_v7_results where key='ordered'),'NaN'::numeric)$$,'%finite and nonnegative%','NaN unit cost is rejected');
select extensions.throws_like($$select public.carez_update_takeoff_output_price((select (value->>'id')::uuid from strip_v7_results where key='ordered'),'Infinity'::numeric)$$,'%finite and nonnegative%','positive infinity unit cost is rejected');
select extensions.throws_like($$select public.carez_update_takeoff_output_price((select (value->>'id')::uuid from strip_v7_results where key='ordered'),'-Infinity'::numeric)$$,'%finite and nonnegative%','negative infinity unit cost is rejected');
select extensions.throws_like($$select public.carez_update_takeoff_output_price((select (value->>'id')::uuid from strip_v7_results where key='ordered'),null)$$,'%finite and nonnegative%','missing unit cost is rejected');
select extensions.throws_like($$select public.carez_update_takeoff_output_price((select (value->>'id')::uuid from strip_v7_results where key='ordered'),-1)$$,'%finite and nonnegative%','negative unit cost is rejected');
-- NOT VALID preserves older evidence while enforcing every new insert/update.
-- Invalid evidence is attempted only inside exception assertions; no constraint is weakened.
select extensions.throws_like($bad$insert into public.estimate_supplier_quote_lines(id,company_id,quote_id,source_takeoff_output_id,generated_estimate_item_id,description,quoted_unit,quoted_unit_cost,created_by)
select 'f8820000-0000-4000-8000-000000000003','f8200000-0000-4000-8000-000000000001','f8810000-0000-4000-8000-000000000001',o.id,o.generated_estimate_item_id,'Synthetic invalid NaN evidence','CY','NaN'::numeric,'f8100000-0000-4000-8000-000000000001'
from public.takeoff_measurement_outputs o where o.id=(select (value->>'id')::uuid from strip_v7_results where key='ordered')$bad$,'%carez_supplier_quote_cost_finite%','new supplier NaN quote evidence is rejected by the declared finite constraint');
select extensions.throws_like($bad$insert into public.estimate_supplier_quote_lines(id,company_id,quote_id,source_takeoff_output_id,generated_estimate_item_id,description,quoted_unit,quoted_unit_cost,created_by)
select 'f8820000-0000-4000-8000-000000000004','f8200000-0000-4000-8000-000000000001','f8810000-0000-4000-8000-000000000001',o.id,o.generated_estimate_item_id,'Synthetic invalid infinity evidence','CY','Infinity'::numeric,'f8100000-0000-4000-8000-000000000001'
from public.takeoff_measurement_outputs o where o.id=(select (value->>'id')::uuid from strip_v7_results where key='ordered')$bad$,'%carez_supplier_quote_cost_finite%','new supplier infinity quote evidence is rejected by the declared finite constraint');
select extensions.throws_like($bad$update public.estimate_supplier_quote_lines set quoted_unit_cost='NaN'::numeric where id='f8820000-0000-4000-8000-000000000001'$bad$,'%carez_supplier_quote_cost_finite%','an existing valid quote line cannot be updated to NaN');
select extensions.ok(not exists(select 1 from public.estimate_supplier_quote_lines where id in ('f8820000-0000-4000-8000-000000000003','f8820000-0000-4000-8000-000000000004')),'invalid quote insert attempts leave no evidence rows');
select extensions.is((select quoted_unit_cost from public.estimate_supplier_quote_lines where id='f8820000-0000-4000-8000-000000000001'),150::numeric,'rejected quote update leaves recorded supplier amount unchanged');
-- Probe the selected-output write boundary without manufacturing historical bad quote evidence.
select extensions.throws_like($bad$update public.takeoff_measurement_outputs set unit_cost='NaN'::numeric,direct_cost='NaN'::numeric,price_source_kind='supplier_quote' where id=(select (value->>'id')::uuid from strip_v7_results where key='ordered')$bad$,'%Selected ordered-concrete supplier price must be finite%','v7 BEFORE trigger rejects a nonfinite selected-output write');
select extensions.ok((select unit_cost=150 and direct_cost=420 and price_source_kind='supplier_quote' from public.takeoff_measurement_outputs where id=(select (value->>'id')::uuid from strip_v7_results where key='ordered')),'rejected selected-output write preserves the recorded finite amount');
select extensions.lives_ok($$select public.carez_update_takeoff_output_price((select (value->>'id')::uuid from strip_v7_results where key='ordered'),0)$$,'recorded zero unit price remains valid');
select extensions.ok((select unit_cost=0 and direct_cost=0 and pricing_status='manual_override' from public.takeoff_measurement_outputs where id=(select (value->>'id')::uuid from strip_v7_results where key='ordered')),'valid zero is not converted to missing or a prior quote price');
select public.carez_select_estimate_supplier_quote_line('f8820000-0000-4000-8000-000000000001');
select pg_temp.strip_v7_projection_commit((select (value->>'id')::uuid from strip_v7_results where key='condition'),'f8700000-0000-4000-8000-000000000001');
select extensions.ok((select o.price_source_kind=b.value->>'price_source_kind' and o.price_source_id=(b.value->>'price_source_id')::uuid and o.price_source_label=b.value->>'price_source_label' and o.price_source_reference=b.value->>'price_source_reference' and o.price_effective_date=(b.value->>'price_effective_date')::date and o.unit_cost=(b.value->>'unit_cost')::numeric from public.takeoff_measurement_outputs o cross join strip_v7_results b where b.key='ordered-selected-before' and o.id=(b.value->>'id')::uuid),'real quote reselection and repeated recalculation preserve dated supplier provenance');
select extensions.is((select total_direct_cost from public.estimate_financial_summary where estimate_id='f8300000-0000-4000-8000-000000000001'),420::numeric,'repeated recalculation still prices ordered supply exactly once');
-- Fresh v7 condition: no v6 upgrade, no inherited manual installed override,
-- no old generated item to hide an initialization defect.
insert into public.estimates(id,company_id,estimate_number,name,status,version,created_by,target_margin_percent,bo_rate_percent,payment_processing_rate_percent,proposed_sell_price)
values('f8300000-0000-4000-8000-000000000002','f8200000-0000-4000-8000-000000000001','SYN-V7-FRESH','Synthetic fresh v7 benchmark','draft',1,'f8100000-0000-4000-8000-000000000001',20,0,0,0);
select public.carez_attach_estimate_overhead('f8900000-0000-4000-8000-000000000102','f8300000-0000-4000-8000-000000000002',(select updated_at from public.estimates where id='f8300000-0000-4000-8000-000000000002'));
insert into public.takeoff_sets(id,company_id,estimate_id,name,created_by)
values('f8400000-0000-4000-8000-000000000002','f8200000-0000-4000-8000-000000000001','f8300000-0000-4000-8000-000000000002','Synthetic fresh v7 takeoff','f8100000-0000-4000-8000-000000000001');
insert into strip_v7_results values('fresh-condition',jsonb_build_object('id',public.carez_create_project_concrete_condition('f8400000-0000-4000-8000-000000000002',(select (value->>'template_version_id')::uuid from strip_v7_results where key='v7'),'SYN-V7-FRESH','Synthetic freshly initialized v7 condition')));
select extensions.ok((select a.version_no=7 and v.template_version_id=(select (value->>'template_version_id')::uuid from strip_v7_results where key='v7') from public.project_concrete_condition_versions v join public.platform_condition_archetype_versions a on a.id=v.archetype_version_id where v.id=(select (value->>'id')::uuid from strip_v7_results where key='fresh-condition')),'fresh initializer uses the immutable v7 contract and published company template');
select extensions.is((select count(*) from public.condition_price_basis_upgrades where condition_version_id=(select (value->>'id')::uuid from strip_v7_results where key='fresh-condition')),0::bigint,'fresh v7 initialization fabricates no upgrade event');
select extensions.is((select count(*) from public.strip_v7_commercial_quantity_basis where estimate_id='f8300000-0000-4000-8000-000000000002'),0::bigint,'uncomputed fresh condition supplies no customer quantity basis');
insert into public.takeoff_sheets(id,company_id,takeoff_set_id,page_number,title)
values('f8600000-0000-4000-8000-000000000002','f8200000-0000-4000-8000-000000000001','f8400000-0000-4000-8000-000000000002',1,'Synthetic fresh 36 LF sheet');
insert into public.takeoff_measurements(id,company_id,takeoff_set_id,sheet_id,estimate_id,assembly_version_id,name,measurement_type,raw_quantity,raw_unit,geometry,source,created_by)
values('f8700000-0000-4000-8000-000000000002','f8200000-0000-4000-8000-000000000001','f8400000-0000-4000-8000-000000000002','f8600000-0000-4000-8000-000000000002','f8300000-0000-4000-8000-000000000002',(select (value->>'legacy_assembly_version_id')::uuid from strip_v7_results where key='v7'),'Synthetic fresh 36 LF run','linear',36,'LF','{"type":"polyline","points":[{"x":0,"y":0},{"x":36,"y":0}]}'::jsonb,'manual','f8100000-0000-4000-8000-000000000001');
select extensions.lives_ok($$select pg_temp.strip_v7_projection_commit((select (value->>'id')::uuid from strip_v7_results where key='fresh-condition'),'f8700000-0000-4000-8000-000000000002')$$,'fresh v7 real commit derives installed production from the complete payload even before Condition output rows exist');
insert into strip_v7_results select 'fresh-ordered',to_jsonb(o) from public.takeoff_measurement_outputs o join public.condition_legacy_output_mappings m on m.company_id=o.company_id and m.legacy_assembly_component_id=o.assembly_component_id and m.template_version_id=(select (value->>'template_version_id')::uuid from strip_v7_results where key='v7') where o.measurement_id='f8700000-0000-4000-8000-000000000002' and m.output_key='concrete.procurement_cy';
select extensions.ok((select count(*)=1 and bool_and(not o.estimate_visible and o.generated_estimate_item_id is null and o.unit_cost=0 and o.direct_cost=0 and o.production_quantity=2.6667) from public.takeoff_measurement_outputs o join public.condition_legacy_output_mappings m on m.company_id=o.company_id and m.legacy_assembly_component_id=o.assembly_component_id and m.template_version_id=(select (value->>'template_version_id')::uuid from strip_v7_results where key='v7') where o.measurement_id='f8700000-0000-4000-8000-000000000002' and m.output_key='concrete.installed_cy'),'fresh installed output is reference-only despite a priced synthetic payload');
select extensions.ok((select i.quantity=2.8 and i.production_quantity=2.6667 and i.source_takeoff_output_id=(b.value->>'id')::uuid from public.estimate_items i cross join strip_v7_results b where b.key='fresh-ordered' and i.id=(b.value->>'generated_estimate_item_id')::uuid),'fresh generated line separately records ordered cost quantity and installed production quantity');
insert into public.estimate_supplier_quote_sets(id,company_id,estimate_id,name,created_by) values('f8800000-0000-4000-8000-000000000002','f8200000-0000-4000-8000-000000000001','f8300000-0000-4000-8000-000000000002','Synthetic fresh concrete quote set','f8100000-0000-4000-8000-000000000001');
insert into public.estimate_supplier_quotes(id,company_id,quote_set_id,supplier_name,supplier_quote_number,quote_date,status,created_by) values('f8810000-0000-4000-8000-000000000002','f8200000-0000-4000-8000-000000000001','f8800000-0000-4000-8000-000000000002','Synthetic fresh supplier','SYN-FRESH-Q-150',current_date,'received','f8100000-0000-4000-8000-000000000001');
insert into public.estimate_supplier_quote_lines(id,company_id,quote_id,source_takeoff_output_id,generated_estimate_item_id,description,quoted_unit,quoted_unit_cost,source_reference,created_by)
select 'f8820000-0000-4000-8000-000000000005','f8200000-0000-4000-8000-000000000001','f8810000-0000-4000-8000-000000000002',(value->>'id')::uuid,(value->>'generated_estimate_item_id')::uuid,'Synthetic fresh procurement evidence','CY',150,'Synthetic source; not real vendor evidence','f8100000-0000-4000-8000-000000000001' from strip_v7_results where key='fresh-ordered';
select public.carez_select_estimate_supplier_quote_line('f8820000-0000-4000-8000-000000000005');
select extensions.lives_ok($$select pg_temp.strip_v7_projection_commit((select (value->>'id')::uuid from strip_v7_results where key='fresh-condition'),'f8700000-0000-4000-8000-000000000002')$$,'fresh v7 selected supplier survives recalculation');
select extensions.ok((select i.id=(b.value->>'generated_estimate_item_id')::uuid and i.quantity=2.8 and i.production_quantity=2.6667 and i.unit_cost=150 and i.direct_cost=420 and i.price_source_kind='supplier_quote' and i.price_source_id='f8820000-0000-4000-8000-000000000005'::uuid from public.estimate_items i cross join strip_v7_results b where b.key='fresh-ordered' and i.id=(b.value->>'generated_estimate_item_id')::uuid),'fresh generated-item identity, selected price and both quantity facts survive recalculation');
select extensions.ok((select count(*)=1 and bool_and(basis_ready is true and installed_quantity=2.6667 and ordered_quantity=2.8) from public.strip_v7_commercial_quantity_basis where estimate_id='f8300000-0000-4000-8000-000000000002'),'fresh Proposal basis is qualified only after complete matching projection evidence');
select extensions.ok((select count(*)=2 and bool_and(reconciliation_status='exact') from public.condition_legacy_reconciliation where condition_version_id=(select (value->>'id')::uuid from strip_v7_results where key='fresh-condition') and output_key in ('concrete.installed_cy','concrete.procurement_cy')),'fresh v7 concrete outputs reconcile exactly');
select extensions.ok((select total_direct_cost=420 and recommended_sell_price=525 from public.estimate_financial_summary where estimate_id='f8300000-0000-4000-8000-000000000002'),'fresh initialized estimate also prices concrete once at $420 Direct Cost and $525 Sell');
select set_config('request.jwt.claim.sub','f8100000-0000-4000-8000-000000000002',true);
select extensions.is((select count(*) from public.condition_price_basis_upgrades),0::bigint,'foreign company cannot read upgrade history');
select extensions.is((select count(*) from public.strip_v7_commercial_quantity_basis),0::bigint,'foreign company cannot read either qualified customer quantity basis');
select extensions.throws_like($$select public.carez_upgrade_strip_condition_draft_to_v7('f8900000-0000-4000-8000-000000000020',(select (value->>'id')::uuid from strip_v7_results where key='condition'),(select (value->>'updated_at')::timestamptz from strip_v7_results where key='version-before'),'Foreign request',true)$$,'%locked or unavailable%','foreign company cannot upgrade the condition');
select extensions.throws_like($$select public.carez_update_takeoff_output_price((select (value->>'id')::uuid from strip_v7_results where key='ordered'),150)$$,'%Takeoff output not found%','foreign company cannot price the output');
select set_config('request.jwt.claim.sub','f8100000-0000-4000-8000-000000000003',true);
select extensions.throws_like($$select public.carez_upgrade_strip_condition_draft_to_v7('f8900000-0000-4000-8000-000000000021',(select (value->>'id')::uuid from strip_v7_results where key='condition'),(select (value->>'updated_at')::timestamptz from strip_v7_results where key='version-before'),'Employee request',true)$$,'%Owner or office authority required%','employee cannot authorize removal of installed-price evidence');
select set_config('request.jwt.claim.sub','f8100000-0000-4000-8000-000000000001',true);
select extensions.lives_ok($$select public.carez_verify_project_condition_version((select (value->>'id')::uuid from strip_v7_results where key='condition'),'Synthetic database projection fixture verification; not physical-calculator acceptance')$$,'real verification command verifies the reconciled synthetic condition');
select extensions.throws_like($$select public.carez_upgrade_strip_condition_draft_to_v7('f8900000-0000-4000-8000-000000000022',(select (value->>'id')::uuid from strip_v7_results where key='condition'),(select updated_at from public.project_concrete_condition_versions where id=(select (value->>'id')::uuid from strip_v7_results where key='condition')),'Verified request',true)$$,'%Draft changed or is verified%','verified condition cannot be upgraded');
select extensions.throws_like($$select public.carez_update_takeoff_output_price((select (value->>'id')::uuid from strip_v7_results where key='ordered'),151)$$,'%Verified Project Concrete Condition pricing is immutable%','verified procurement price remains immutable');
insert into strip_v7_results select 'verified-v7-before',to_jsonb(v) from public.project_concrete_condition_versions v where v.id=(select (value->>'id')::uuid from strip_v7_results where key='condition');
insert into strip_v7_results values('next-v7',jsonb_build_object('id',public.carez_create_project_condition_revision((select (value->>'id')::uuid from strip_v7_results where key='condition'))));
select extensions.lives_ok($$select pg_temp.strip_v7_projection_commit((select (value->>'id')::uuid from strip_v7_results where key='next-v7'),'f8700000-0000-4000-8000-000000000001')$$,'normal verified-v7 to draft-v7 revision recalculates through the real commit command');
select extensions.ok((select count(*)=1 and bool_and(basis_ready is true and condition_version_id=(select (value->>'id')::uuid from strip_v7_results where key='next-v7') and installed_quantity=2.6667 and ordered_quantity=2.8) from public.strip_v7_commercial_quantity_basis where estimate_id='f8300000-0000-4000-8000-000000000001'),'only current v7 projection supplies live Proposal basis; retained history creates no duplicate');
select extensions.is((select to_jsonb(v) from public.project_concrete_condition_versions v where v.id=(select (value->>'id')::uuid from strip_v7_results where key='condition')),(select value from strip_v7_results where key='verified-v7-before'),'new draft projection preserves the verified historical version');
reset role;
select extensions.throws_like($$update public.condition_price_basis_upgrades set reason='Changed history' where request_id='f8900000-0000-4000-8000-000000000001'$$,'%history is immutable%','audit history cannot be rewritten even by privileged fixture connection');
-- Isolated lock arrangement, not an issued-proposal workflow test. No history is changed.
set local role authenticated;
insert into strip_v7_results values('locked-condition',jsonb_build_object('id',public.carez_create_project_concrete_condition('f8400000-0000-4000-8000-000000000001',(select (value->>'template_version_id')::uuid from strip_v7_results where key='v6'),'SYN-V7-LOCK','Synthetic locked-estimate condition')));
reset role;
update public.estimates set status='accepted' where id='f8300000-0000-4000-8000-000000000001';
set local role authenticated;
select extensions.throws_like($$select public.carez_upgrade_strip_condition_draft_to_v7('f8900000-0000-4000-8000-000000000023',(select (value->>'id')::uuid from strip_v7_results where key='locked-condition'),(select updated_at from public.project_concrete_condition_versions where id=(select (value->>'id')::uuid from strip_v7_results where key='locked-condition')),'Locked estimate request',true)$$,'%locked or unavailable%','accepted estimate revision cannot be upgraded');
reset role;
select * from extensions.finish();
rollback;
