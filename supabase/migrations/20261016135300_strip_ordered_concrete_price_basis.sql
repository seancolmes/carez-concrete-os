-- Strip v7: installed CY remains physical production/labor authority; ordered CY
-- is the single concrete supply demand. Never rewrite published v1-v6 contracts,
-- issued estimates, selected supplier evidence, or shared compatibility components.
set local search_path=pg_catalog,public,extensions,pg_temp;

do $$ declare base public.platform_condition_archetype_versions%rowtype; outputs jsonb;begin
 select * into base from public.platform_condition_archetype_versions
 where archetype_code_snapshot='strip_wall_footing' and version_no=6 and status='published' and engine_key='concrete_condition_v1';
 if not found then raise exception 'Published Strip v6 prerequisite unavailable';end if;
 select jsonb_agg(case when o->>'key'='concrete.installed_cy' then o||'{"estimate_visible":false,"pricing_basis":"installed_reference"}'::jsonb
  when o->>'key'='concrete.procurement_cy' then o||'{"estimate_visible":true,"pricing_basis":"ordered_supply"}'::jsonb else o end order by n)
 into outputs from jsonb_array_elements(base.output_schema) with ordinality x(o,n);
 insert into public.platform_condition_archetype_versions(archetype_id,version_no,status,engine_key,role_schema,input_schema,module_schema,output_schema,projection_schema,notes,published_at)
 values(base.archetype_id,7,'published',base.engine_key,base.role_schema,base.input_schema,base.module_schema,outputs,
  base.projection_schema||'{"concrete_price_basis":"ordered_supply_once_v7"}'::jsonb,
  'Installed CY is measured production and placement-labor basis. Ordered CY is the single priced concrete supply quantity. Physical v6 calculations are unchanged.',clock_timestamp());
end $$;

-- Resolve policy from the actual tenant/version/anchor/component mapping, never
-- from a client-supplied trace flag. Output rows can be absent during atomic commit.
create function public.carez_strip_v7_output_key(p_company uuid,p_measurement uuid,p_component uuid)
returns text language sql stable security invoker set search_path=pg_catalog,public,pg_temp as $$
 select m.output_key from public.project_concrete_condition_versions v
 join public.project_concrete_conditions c on c.company_id=v.company_id and c.id=v.condition_id and c.status='active'
 join public.platform_condition_archetype_versions a on a.id=v.archetype_version_id
 join public.condition_legacy_output_mappings m on m.company_id=v.company_id and m.template_version_id=v.template_version_id
 where p_company=public.get_my_company_id() and v.company_id=p_company
  and v.compatibility_anchor_measurement_id=p_measurement and m.legacy_assembly_component_id=p_component
  and a.archetype_code_snapshot='strip_wall_footing' and a.version_no=7 and a.status='published'
  and m.output_key in ('concrete.installed_cy','concrete.procurement_cy')
 limit 1
$$;
revoke all on function public.carez_strip_v7_output_key(uuid,uuid,uuid) from public,anon;
grant execute on function public.carez_strip_v7_output_key(uuid,uuid,uuid) to authenticated,service_role;

-- Reject new nonfinite quote evidence without rewriting older supplier records.
alter table public.estimate_supplier_quote_lines add constraint carez_supplier_quote_cost_finite
 check(quoted_unit_cost::text not in ('NaN','Infinity','-Infinity')) not valid;
create function public.carez_guard_v7_concrete_price() returns trigger language plpgsql security invoker
set search_path=pg_catalog,public,pg_temp as $$ declare basis text;begin
 basis:=public.carez_strip_v7_output_key(new.company_id,new.measurement_id,new.assembly_component_id);
 if basis='concrete.installed_cy' and (new.estimate_visible is distinct from false or new.unit_cost is distinct from 0 or new.direct_cost is distinct from 0) then
  raise exception 'Installed concrete is a reference and placement-labor basis. Price ordered concrete supply instead.';end if;
 if basis='concrete.procurement_cy' and new.price_source_kind='supplier_quote' and
  (new.unit_cost is null or new.unit_cost<0 or new.unit_cost::text in ('NaN','Infinity','-Infinity') or new.direct_cost is null or new.direct_cost::text in ('NaN','Infinity','-Infinity')) then
  raise exception 'Selected ordered-concrete supplier price must be finite and nonnegative';end if;
 return new;
end $$;
create trigger carez_v7_concrete_price before insert or update on public.takeoff_measurement_outputs
 for each row execute function public.carez_guard_v7_concrete_price();
revoke all on function public.carez_guard_v7_concrete_price() from public,anon,authenticated,service_role;

create table public.condition_price_basis_upgrades(
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id),
 condition_version_id uuid not null references public.project_concrete_condition_versions(id),
 estimate_id uuid not null references public.estimates(id),
 request_id uuid not null unique,
 actor_id uuid not null,
 reason text not null check(length(btrim(reason))>0),
 from_contract_version integer not null check(from_contract_version=6),
 to_contract_version integer not null check(to_contract_version=7),
 before_facts jsonb not null,
 recorded_at timestamptz not null default clock_timestamp()
);
alter table public.condition_price_basis_upgrades enable row level security;
create policy condition_price_basis_upgrades_read on public.condition_price_basis_upgrades for select to authenticated
 using(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'));
revoke all on public.condition_price_basis_upgrades from public,anon,authenticated;
grant select on public.condition_price_basis_upgrades to authenticated,service_role;
create function public.carez_guard_price_basis_upgrade_history() returns trigger language plpgsql
set search_path=pg_catalog,public,pg_temp as $$ begin raise exception 'Condition price-basis upgrade history is immutable';end $$;
create trigger carez_price_basis_upgrade_history_immutable before update or delete on public.condition_price_basis_upgrades
 for each row execute function public.carez_guard_price_basis_upgrade_history();
revoke all on function public.carez_guard_price_basis_upgrade_history() from public,anon,authenticated,service_role;

create function public.carez_upgrade_strip_condition_draft_to_v7(
 p_request_id uuid,p_condition_version_id uuid,p_expected_updated_at timestamptz,p_reason text,p_acknowledge_price_removal boolean
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,extensions,pg_temp as $$
declare request jsonb;company uuid;source public.project_concrete_condition_versions%rowtype;cond public.project_concrete_conditions%rowtype;
 estimate public.estimates%rowtype;contract integer;target jsonb;tpl public.company_condition_template_versions%rowtype;
 facts jsonb;event uuid;installed uuid[];items uuid[];anchor uuid;
begin
 request:=public.carez_financial_request_begin(p_request_id,'strip_price_basis_v7',jsonb_build_object('actor_id',auth.uid(),
  'condition_version_id',p_condition_version_id,'expected_updated_at',p_expected_updated_at,'reason',p_reason,'acknowledged',p_acknowledge_price_removal));
 if (request->>'replay')::boolean then return request->'result';end if;company:=(request->>'company_id')::uuid;
 if p_expected_updated_at is null or nullif(btrim(p_reason),'') is null or p_acknowledge_price_removal is distinct from true then
  raise exception 'A current draft, reason and acknowledgment of installed-price removal are required';end if;
 select v.* into source from public.project_concrete_condition_versions v where v.company_id=company and v.id=p_condition_version_id;
 select c.* into cond from public.project_concrete_conditions c where c.company_id=company and c.id=source.condition_id;
 select e.* into estimate from public.estimates e join public.takeoff_sets s on s.company_id=e.company_id and s.estimate_id=e.id
  where s.company_id=company and s.id=cond.takeoff_set_id and s.status='active' for update of e;
 if not found or estimate.status in ('accepted','approved','superseded') or exists(select 1 from public.proposal_presentations where company_id=company and estimate_id=estimate.id) then
  raise exception 'This estimate revision is locked or unavailable';end if;
 select * into source from public.project_concrete_condition_versions where company_id=company and id=p_condition_version_id for update;
 if not found or source.status<>'draft' or source.updated_at is distinct from p_expected_updated_at then raise exception 'Draft changed or is verified; reopen it before upgrading';end if;
 select * into cond from public.project_concrete_conditions where company_id=company and id=source.condition_id for update;
 if cond.status is distinct from 'active' then raise exception 'Active Project Concrete Condition unavailable';end if;
 if not exists(select 1 from public.takeoff_sets where company_id=company and id=cond.takeoff_set_id and estimate_id=estimate.id and status='active') then raise exception 'Condition scope changed; reopen before upgrading';end if;
 select version_no into contract from public.platform_condition_archetype_versions where id=source.archetype_version_id and archetype_code_snapshot='strip_wall_footing';
 if contract is distinct from 6 then raise exception 'Upgrade this editable Strip draft to physical contract v6 before selecting the v7 price basis';end if;
 target:=public.carez_ensure_strip_footing_v7_template();
 select * into tpl from public.company_condition_template_versions where company_id=company and id=(target->>'template_version_id')::uuid and status='published';
 if not found then raise exception 'Published v7 company template unavailable';end if;
 anchor:=source.compatibility_anchor_measurement_id;
 if anchor is null then
  select v.compatibility_anchor_measurement_id into anchor from public.project_concrete_condition_versions v
   where v.company_id=company and v.id=cond.compatibility_projection_version_id and v.condition_id=cond.id;
 end if;
 select coalesce(array_agg(o.id),'{}'::uuid[]),coalesce(array_agg(o.generated_estimate_item_id) filter(where o.generated_estimate_item_id is not null),'{}'::uuid[])
 into installed,items from public.takeoff_measurement_outputs o
 join public.condition_legacy_output_mappings m on m.company_id=o.company_id and m.legacy_assembly_component_id=o.assembly_component_id
 where o.company_id=company and o.measurement_id=anchor
  and m.template_version_id=source.template_version_id and m.output_key='concrete.installed_cy';
 if exists(select 1 from public.project_condition_outputs o where o.company_id=company
  and o.generated_estimate_item_id=any(items) and o.condition_version_id<>source.id) then
  raise exception 'Historical Condition versions still reference the installed price line. Preserve that history and use a new Estimate revision before changing this price basis.';
 end if;
 facts:=jsonb_build_object('condition_version',to_jsonb(source),
  'condition_outputs',coalesce((select jsonb_agg(to_jsonb(o)) from public.project_condition_outputs o where o.company_id=company and o.condition_version_id=source.id),'[]'::jsonb),
  'installed_legacy_outputs',coalesce((select jsonb_agg(to_jsonb(o)) from public.takeoff_measurement_outputs o where o.company_id=company and o.id=any(installed)),'[]'::jsonb),
  'installed_estimate_items',coalesce((select jsonb_agg(to_jsonb(i)) from public.estimate_items i where i.company_id=company and i.id=any(items)),'[]'::jsonb),
  'installed_supplier_quote_lines',coalesce((select jsonb_agg(to_jsonb(q)) from public.estimate_supplier_quote_lines q where q.company_id=company and q.source_takeoff_output_id=any(installed)),'[]'::jsonb));
 insert into public.condition_price_basis_upgrades(company_id,condition_version_id,estimate_id,request_id,actor_id,reason,from_contract_version,to_contract_version,before_facts)
 values(company,source.id,estimate.id,p_request_id,auth.uid(),btrim(p_reason),6,7,facts) returning id into event;
 perform set_config('carez.project_condition_commit','1',true);
 update public.project_concrete_condition_versions set template_version_id=tpl.id,archetype_version_id=tpl.archetype_version_id,updated_at=clock_timestamp() where company_id=company and id=source.id;
 -- Archive the removed duplicate demand above, then remove only its live price
 -- and generated commercial line. Do not transfer an installed supplier quote.
 update public.takeoff_measurement_outputs set unit_cost=0,direct_cost=0,pricing_status='not_priced',estimate_visible=false,
  cost_source=null,price_source_kind=null,price_source_id=null,price_source_label=null,price_source_reference=null,price_effective_date=null,
  price_override_by=null,price_override_at=null,generated_estimate_item_id=null,updated_at=clock_timestamp()
 where company_id=company and id=any(installed);
 -- Release only this editable version's live backlink before removing its
 -- duplicate commercial line. The complete prior rows are already in the audit.
 update public.project_condition_outputs set generated_estimate_item_id=null
  where company_id=company and condition_version_id=source.id and generated_estimate_item_id=any(items);
 delete from public.estimate_items where company_id=company and id=any(items) and source_takeoff_output_id=any(installed);
 update public.project_condition_outputs set status='held',production_quantity=null,pricing_status='missing_input',
  unit_cost=case when output_key='concrete.installed_cy' then 0 else unit_cost end,
  direct_cost=case when output_key='concrete.installed_cy' then 0 else direct_cost end,
  generated_estimate_item_id=case when output_key='concrete.installed_cy' then null else generated_estimate_item_id end,
  updated_at=clock_timestamp() where company_id=company and condition_version_id=source.id and status<>'inactive';
 insert into public.project_condition_holds(company_id,condition_version_id,hold_code,message) values(company,source.id,'review_required',
  'Contract v7 selected. Recalculate: installed CY is a reference and labor basis; only ordered CY prices concrete supply. Prior installed-price evidence is retained in upgrade history.') on conflict do nothing;
 update public.project_concrete_conditions set updated_at=clock_timestamp() where company_id=company and id=cond.id;
 return public.carez_financial_request_finish(p_request_id,jsonb_build_object('condition_version_id',source.id,'from_contract_version',6,'to_contract_version',7,
  'upgraded',true,'requires_recalculation',true,'audit_id',event,'message','Contract v7 selected. Installed price removed and audited; ordered-concrete prices and supplier evidence retained. Recalculate and review.'));
end $$;
revoke all on function public.carez_upgrade_strip_condition_draft_to_v7(uuid,uuid,timestamptz,text,boolean) from public,anon;
grant execute on function public.carez_upgrade_strip_condition_draft_to_v7(uuid,uuid,timestamptz,text,boolean) to authenticated,service_role;

-- New Proposal snapshots can distinguish installed customer scope from the
-- ordered supply demand. Missing/mismatched projection evidence is an explicit
-- unavailable basis, never permission to substitute the ordered quantity.
create view public.strip_v7_commercial_quantity_basis with(security_invoker=true) as
with live as (
 select v.*,c.compatibility_projection_version_id,s.estimate_id
 from public.project_concrete_conditions c
 join public.project_concrete_condition_versions v on v.company_id=c.company_id and v.condition_id=c.id
  and (v.id=c.compatibility_projection_version_id or (c.compatibility_projection_version_id is null
   and v.revision_no=(select max(r.revision_no) from public.project_concrete_condition_versions r where r.company_id=c.company_id and r.condition_id=c.id)))
 join public.platform_condition_archetype_versions a on a.id=v.archetype_version_id
  and a.archetype_code_snapshot='strip_wall_footing' and a.version_no=7 and a.status='published'
 join public.takeoff_sets s on s.company_id=c.company_id and s.id=c.takeoff_set_id
 where c.status='active'
)
select item.company_id,item.estimate_id,item.id as estimate_item_id,v.id as condition_version_id,
 legacy.id as legacy_output_id,installed.production_quantity as installed_quantity,
 legacy.production_quantity as ordered_quantity,legacy.production_unit,
 coalesce((v.compatibility_projection_version_id=v.id and proc.status='ready' and installed.status='ready'
  and m.output_key='concrete.procurement_cy' and proc.output_key=m.output_key
  and legacy.generated_estimate_item_id=item.id and legacy.measurement_id=v.compatibility_anchor_measurement_id
  and item.source_takeoff_output_id=legacy.id and item.source_takeoff_measurement_id=v.compatibility_anchor_measurement_id
  and proc.generated_estimate_item_id=item.id and proc.legacy_takeoff_output_id=legacy.id
  and proc.production_quantity is not distinct from legacy.production_quantity
  and item.quantity is not distinct from legacy.production_quantity
  and installed.production_quantity is not null and item.production_quantity is not distinct from installed.production_quantity
  and upper(installed.production_unit)=upper(legacy.production_unit)),false) as basis_ready,
 case when m.output_key='concrete.procurement_cy' or proc.output_key='concrete.procurement_cy' then 'ordered_concrete'
  when m.output_key=proc.output_key and m.output_key<>'concrete.installed_cy' then 'other'
  else 'unavailable' end as quantity_basis
from live v
join public.estimate_items item on item.company_id=v.company_id and item.estimate_id=v.estimate_id
 and (item.source_takeoff_measurement_id=v.compatibility_anchor_measurement_id
  or exists(select 1 from public.takeoff_measurement_outputs o where o.company_id=item.company_id
   and o.measurement_id=v.compatibility_anchor_measurement_id and (o.id=item.source_takeoff_output_id or o.generated_estimate_item_id=item.id))
  or exists(select 1 from public.project_condition_outputs o where o.company_id=v.company_id
   and o.condition_version_id=v.id and o.generated_estimate_item_id=item.id))
-- Classification precedes reconciliation: damaged backlinks/mappings remain
-- explicit unavailable rows instead of making ordered CY look like legacy scope.
left join public.takeoff_measurement_outputs legacy on legacy.company_id=item.company_id
 and (legacy.id=item.source_takeoff_output_id or legacy.generated_estimate_item_id=item.id)
left join public.condition_legacy_output_mappings m on m.company_id=v.company_id and m.template_version_id=v.template_version_id and m.legacy_assembly_component_id=legacy.assembly_component_id
left join public.project_condition_outputs proc on proc.company_id=v.company_id and proc.condition_version_id=v.id and proc.output_instance_key='default'
 and (proc.generated_estimate_item_id=item.id or proc.legacy_takeoff_output_id=legacy.id)
left join public.project_condition_outputs installed on installed.company_id=v.company_id and installed.condition_version_id=v.id and installed.output_key='concrete.installed_cy' and installed.output_instance_key='default'
;
revoke all on public.strip_v7_commercial_quantity_basis from public,anon;
grant select on public.strip_v7_commercial_quantity_basis to authenticated,service_role;

-- New immutable company template; retain existing compatibility component identities.
create or replace function public.carez_ensure_strip_footing_v7_template()
returns jsonb
language plpgsql
security invoker
set search_path=pg_catalog,public,extensions,pg_temp
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
  perform pg_advisory_xact_lock(hashtextextended(v_company::text || ':strip_wall_footing:v7',0));

  v_base_result:=public.carez_ensure_strip_footing_v6_template();
  select * into v_base_template
  from public.company_condition_template_versions
  where company_id=v_company and id=(v_base_result->>'template_version_id')::uuid and status='published';
  if not found then raise exception 'Published Strip / Wall Footing v6 company template not found.'; end if;

  select * into v_archetype
  from public.platform_condition_archetypes
  where code='strip_wall_footing' and active;
  if not found then raise exception 'Active Strip / Wall Footing archetype not found.'; end if;

  select * into v_target
  from public.platform_condition_archetype_versions
  where archetype_id=v_archetype.id and version_no=7 and status='published' and engine_key='concrete_condition_v1'
  limit 1;
  if not found then raise exception 'Published Strip / Wall Footing v7 contract not found.'; end if;

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
    'Strip v7: installed concrete is measured production and labor basis; ordered concrete is the single priced supply demand. Shared published compatibility components are unchanged.',auth.uid()
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
    raise exception 'Strip v7 compatibility projection is incomplete.';
  end if;

  perform public.carez_publish_company_condition_template_version(v_target_id);
  return jsonb_build_object(
    'template_version_id',v_target_id,
    'legacy_assembly_version_id',v_base_template.legacy_assembly_version_id,
    'created',true
  );
end;
$$;
revoke all on function public.carez_ensure_strip_footing_v7_template() from public,anon;
grant execute on function public.carez_ensure_strip_footing_v7_template() to authenticated,service_role;

-- Source-owned sticky-selection sync with only the v7 price-basis branches added.
CREATE OR REPLACE FUNCTION public.carez_sync_takeoff_measurement_outputs(p_measurement_id uuid, p_outputs jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO pg_catalog,public,extensions,pg_temp
AS $function$
declare
  v_company uuid:=public.get_my_company_id();
  v_measurement public.takeoff_measurements%rowtype;
  v_payload jsonb;
  v_component public.concrete_assembly_components%rowtype;
  v_output public.takeoff_measurement_outputs%rowtype;
  v_item_id uuid;
  v_expected integer;
  v_actual integer;
  v_path text;
  v_active boolean;
  v_visible boolean;
  v_behavior text;
  v_qty numeric;
  v_hours numeric;
  v_baseline_man_hours_per_unit numeric;
  v_job_man_hours_per_unit numeric;
  v_labor_assumption_override_by uuid;
  v_labor_assumption_override_at timestamptz;
  v_labor_rate_override_by uuid;
  v_labor_rate_override_at timestamptz;
  v_unit_cost numeric;
  v_direct numeric;
  v_cost_source text;
  v_status text;
  v_price_source_kind text;
  v_price_source_id uuid;
  v_price_source_label text;
  v_price_source_reference text;
  v_price_effective_date date;
  v_price_override_by uuid;
  v_price_override_at timestamptz;
  v_sort integer:=100;
  v_basis_key text;
  v_production_qty numeric;
  v_installed_count integer;
begin
  if v_company is null or not exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role<>'employee') then
    raise exception 'Owner access required.';
  end if;

  select * into v_measurement
  from public.takeoff_measurements
  where id=p_measurement_id and company_id=v_company
  for update;
  if not found then raise exception 'Takeoff measurement not found.'; end if;

  if jsonb_typeof(coalesce(p_outputs,'[]'::jsonb))<>'array' then
    raise exception 'Assembly outputs must be an array.';
  end if;

  select count(*) into v_expected
  from public.carez_assembly_component_paths(v_company,v_measurement.assembly_version_id);
  select count(distinct value->>'component_key') into v_actual
  from jsonb_array_elements(p_outputs);
  if v_expected=0 or jsonb_array_length(p_outputs)<>v_expected or v_actual<>v_expected then
    raise exception 'Assembly output set is incomplete or contains duplicate component paths.';
  end if;
  if exists(
    select 1
    from jsonb_array_elements(p_outputs) p(value)
    where not exists(
      select 1
      from public.carez_assembly_component_paths(v_company,v_measurement.assembly_version_id) f
      where f.component_id=nullif(p.value->>'assembly_component_id','')::uuid
        and f.component_path_key=p.value->>'component_key'
    )
  ) then
    raise exception 'Assembly output component path does not belong to the takeoff assembly.';
  end if;

  for v_payload in select value from jsonb_array_elements(p_outputs) loop
    v_path:=v_payload->>'component_key';
    select c.* into v_component
    from public.concrete_assembly_components c
    join public.carez_assembly_component_paths(v_company,v_measurement.assembly_version_id) f on f.component_id=c.id
    where c.company_id=v_company
      and f.component_path_key=v_path
      and c.id=nullif(v_payload->>'assembly_component_id','')::uuid
    limit 1;
    if v_component.id is null then raise exception 'Output component path does not belong to the takeoff assembly.'; end if;

    v_active:=coalesce(nullif(v_payload->>'is_active','')::boolean,true);
    v_visible:=coalesce(nullif(v_payload->>'estimate_visible','')::boolean,v_component.estimate_visible,true);
    v_behavior:=coalesce(
      nullif(v_payload->>'resource_behavior',''),
      nullif(v_component.resource_behavior,''),
      case v_component.estimate_item_type
        when 'labor' then 'labor'
        when 'material' then 'consumed_material'
        when 'equipment' then 'owned_equipment'
        when 'subcontractor' then 'subcontractor'
        else 'legacy_other'
      end
    );
    v_qty:=case when v_active then greatest(coalesce((v_payload->>'production_quantity')::numeric,0),0) else 0 end;
    v_baseline_man_hours_per_unit:=case when v_component.estimate_item_type='labor' then nullif(v_payload->>'baseline_man_hours_per_unit','')::numeric else null end;
    v_hours:=case when v_active then greatest(coalesce((v_payload->>'estimated_man_hours')::numeric,0),0) else 0 end;

    select * into v_output
    from public.takeoff_measurement_outputs o
    where o.company_id=v_company
      and o.measurement_id=v_measurement.id
      and o.assembly_component_id=v_component.id
      and o.component_key=v_path
    for update;

    v_job_man_hours_per_unit:=case when v_component.estimate_item_type='labor' and v_output.id is not null then v_output.job_man_hours_per_unit else null end;
    v_labor_assumption_override_by:=case when v_component.estimate_item_type='labor' and v_output.id is not null then v_output.labor_assumption_override_by else null end;
    v_labor_assumption_override_at:=case when v_component.estimate_item_type='labor' and v_output.id is not null then v_output.labor_assumption_override_at else null end;
    v_labor_rate_override_by:=case when v_component.estimate_item_type='labor' and v_output.id is not null then v_output.labor_rate_override_by else null end;
    v_labor_rate_override_at:=case when v_component.estimate_item_type='labor' and v_output.id is not null then v_output.labor_rate_override_at else null end;

    if v_active and v_component.estimate_item_type='labor' and v_job_man_hours_per_unit is not null then
      v_hours:=round(v_qty*v_job_man_hours_per_unit,4);
    end if;

    v_basis_key:=public.carez_strip_v7_output_key(v_company,v_measurement.id,v_component.id);
    v_production_qty:=v_qty;
    if v_basis_key='concrete.procurement_cy' then
      -- Output order is not authority: resolve the installed sibling through the
      -- actual current template/component mapping in this complete atomic batch.
      select count(*),min((p->>'production_quantity')::numeric) into v_installed_count,v_production_qty
      from jsonb_array_elements(p_outputs) p
      where public.carez_strip_v7_output_key(v_company,v_measurement.id,(p->>'assembly_component_id')::uuid)='concrete.installed_cy';
      if v_installed_count<>1 or v_production_qty is null or v_production_qty<0 or v_production_qty::text in ('NaN','Infinity','-Infinity') then
       raise exception 'Installed concrete production quantity is unavailable in this calculation batch';end if;
    end if;
    if v_basis_key='concrete.installed_cy' then
      v_visible:=false;v_unit_cost:=0;v_direct:=0;v_cost_source:=null;
      v_status:=case when v_payload->>'pricing_status'='missing_input' then 'missing_input' else 'not_priced' end;
      v_price_source_kind:=null;v_price_source_id:=null;v_price_source_label:=null;
      v_price_source_reference:=null;v_price_effective_date:=null;v_price_override_by:=null;v_price_override_at:=null;
    elsif v_basis_key='concrete.procurement_cy' and v_active and v_output.price_source_kind='supplier_quote' then
      -- Preserve the recorded selection, including zero and its dated supplier
      -- basis. Recalculation neither selects a new quote nor reapplies catalog cost.
      if v_output.unit_cost is null or v_output.unit_cost<0 or v_output.unit_cost::text in ('NaN','Infinity','-Infinity')
       or not exists(select 1 from public.estimate_supplier_quote_lines l
        join public.estimate_supplier_quotes q on q.company_id=l.company_id and q.id=l.quote_id
        join public.estimate_supplier_quote_sets s on s.company_id=q.company_id and s.id=q.quote_set_id
        where l.company_id=v_company and l.id=v_output.price_source_id and l.source_takeoff_output_id=v_output.id
         and s.estimate_id=v_measurement.estimate_id and upper(trim(l.quoted_unit))=upper(trim(v_component.output_unit))) then
       raise exception 'Recorded ordered-concrete supplier selection is unavailable or has changed scope; review its evidence before recalculating';end if;
      v_unit_cost:=v_output.unit_cost;v_cost_source:=v_output.cost_source;
      v_status:=case when v_payload->>'pricing_status'='missing_input' then 'missing_input' else 'priced' end;
      v_price_source_kind:=v_output.price_source_kind;v_price_source_id:=v_output.price_source_id;
      v_price_source_label:=v_output.price_source_label;v_price_source_reference:=v_output.price_source_reference;
      v_price_effective_date:=v_output.price_effective_date;v_price_override_by:=v_output.price_override_by;v_price_override_at:=v_output.price_override_at;
      v_direct:=round(v_qty*v_unit_cost,2);
    elsif v_active and v_output.id is not null and v_output.pricing_status='manual_override' then
      v_unit_cost:=greatest(coalesce(v_output.unit_cost,0),0);
      v_cost_source:=coalesce(v_output.cost_source,'manual_override');
      v_status:='manual_override';
      v_price_source_kind:=coalesce(v_output.price_source_kind,'manual_override');
      v_price_source_id:=v_output.price_source_id;
      v_price_source_label:=coalesce(v_output.price_source_label,'Manual estimate override');
      v_price_source_reference:=v_output.price_source_reference;
      v_price_effective_date:=v_output.price_effective_date;
      v_price_override_by:=v_output.price_override_by;
      v_price_override_at:=v_output.price_override_at;
      v_direct:=round((case when v_component.estimate_item_type='labor' then v_hours else v_qty end)*v_unit_cost,2);
    elsif v_active
       and v_component.estimate_item_type='labor'
       and v_output.id is not null
       and v_output.labor_rate_override_at is not null then
      v_unit_cost:=greatest(coalesce(v_output.unit_cost,0),0);
      v_cost_source:=coalesce(v_output.cost_source,'selected labor profile');
      v_status:=case when v_unit_cost>0 then 'priced' else 'missing_labor_rate' end;
      v_price_source_kind:=v_output.price_source_kind;
      v_price_source_id:=v_output.price_source_id;
      v_price_source_label:=v_output.price_source_label;
      v_price_source_reference:=v_output.price_source_reference;
      v_price_effective_date:=v_output.price_effective_date;
      v_price_override_by:=null;
      v_price_override_at:=null;
      v_direct:=round(v_hours*v_unit_cost,2);
    else
      v_unit_cost:=case when v_active then greatest(coalesce((v_payload->>'unit_cost')::numeric,0),0) else 0 end;
      v_cost_source:=case when v_active then nullif(v_payload->>'cost_source','') else null end;
      v_status:=case
        when coalesce(v_payload->>'pricing_status','')='missing_input' then 'missing_input'
        when v_active then coalesce(v_payload->>'pricing_status','missing_price')
        else 'not_priced'
      end;
      if v_status='priced' then
        v_price_source_kind:=nullif(v_payload->>'price_source_kind','');
        v_price_source_id:=nullif(v_payload->>'price_source_id','')::uuid;
        v_price_source_label:=nullif(v_payload->>'price_source_label','');
        v_price_source_reference:=nullif(v_payload->>'price_source_reference','');
        v_price_effective_date:=nullif(v_payload->>'price_effective_date','')::date;
      else
        v_price_source_kind:=null;
        v_price_source_id:=null;
        v_price_source_label:=null;
        v_price_source_reference:=null;
        v_price_effective_date:=null;
      end if;
      v_price_override_by:=null;
      v_price_override_at:=null;
      v_direct:=case
        when not v_active then 0
        when v_component.estimate_item_type='labor' then round(v_hours*v_unit_cost,2)
        else greatest(coalesce((v_payload->>'direct_cost')::numeric,0),0)
      end;
    end if;

    if v_output.id is null then
      insert into public.takeoff_measurement_outputs(
        company_id,measurement_id,assembly_component_id,component_key,label,estimate_item_type,
        cost_code_id,catalog_item_id,production_task_id,production_quantity,production_unit,
        estimated_man_hours,baseline_man_hours_per_unit,baseline_source,
        job_man_hours_per_unit,labor_assumption_override_by,labor_assumption_override_at,
        labor_rate_override_by,labor_rate_override_at,
        unit_cost,cost_source,
        price_source_kind,price_source_id,price_source_label,price_source_reference,price_effective_date,
        price_override_by,price_override_at,
        direct_cost,pricing_status,is_active,resource_behavior,estimate_visible,formula_trace
      ) values(
        v_company,v_measurement.id,v_component.id,v_path,v_component.label,v_component.estimate_item_type,
        v_component.cost_code_id,v_component.catalog_item_id,v_component.production_task_id,v_qty,v_component.output_unit,
        v_hours,v_baseline_man_hours_per_unit,v_component.baseline_source,
        v_job_man_hours_per_unit,v_labor_assumption_override_by,v_labor_assumption_override_at,
        v_labor_rate_override_by,v_labor_rate_override_at,
        v_unit_cost,v_cost_source,
        v_price_source_kind,v_price_source_id,v_price_source_label,v_price_source_reference,v_price_effective_date,
        v_price_override_by,v_price_override_at,
        v_direct,v_status,v_active,v_behavior,v_visible,coalesce(v_payload->'formula_trace','{}'::jsonb)
      ) returning * into v_output;
    else
      update public.takeoff_measurement_outputs set
        production_quantity=v_qty,
        production_unit=v_component.output_unit,
        estimated_man_hours=v_hours,
        baseline_man_hours_per_unit=v_baseline_man_hours_per_unit,
        baseline_source=v_component.baseline_source,
        job_man_hours_per_unit=v_job_man_hours_per_unit,
        labor_assumption_override_by=v_labor_assumption_override_by,
        labor_assumption_override_at=v_labor_assumption_override_at,
        labor_rate_override_by=v_labor_rate_override_by,
        labor_rate_override_at=v_labor_rate_override_at,
        unit_cost=v_unit_cost,
        cost_source=v_cost_source,
        price_source_kind=v_price_source_kind,
        price_source_id=v_price_source_id,
        price_source_label=v_price_source_label,
        price_source_reference=v_price_source_reference,
        price_effective_date=v_price_effective_date,
        price_override_by=v_price_override_by,
        price_override_at=v_price_override_at,
        direct_cost=v_direct,
        pricing_status=v_status,
        is_active=v_active,
        resource_behavior=v_behavior,
        estimate_visible=v_visible,
        formula_trace=coalesce(v_payload->'formula_trace','{}'::jsonb),
        updated_at=now()
      where id=v_output.id
      returning * into v_output;
    end if;

    if not v_active or not v_visible then
      delete from public.estimate_items where company_id=v_company and source_takeoff_output_id=v_output.id;
      update public.takeoff_measurement_outputs set generated_estimate_item_id=null where id=v_output.id;
    else
      select id into v_item_id
      from public.estimate_items
      where company_id=v_company and source_takeoff_output_id=v_output.id
      for update;
      if v_item_id is null then
        insert into public.estimate_items(
          company_id,estimate_id,section_id,item_type,cost_code_id,catalog_item_id,labor_task,risk_class_code,
          description,quantity,unit,unit_cost,direct_cost,regular_hours,overtime_hours,notes,sort_order,
          source_takeoff_output_id,source_takeoff_measurement_id,source_assembly_version_id,production_task_id,
          production_quantity,production_unit,baseline_man_hours_per_unit,baseline_source,
          job_man_hours_per_unit,labor_assumption_override_by,labor_assumption_override_at,
          labor_rate_override_by,labor_rate_override_at,
          price_source_kind,price_source_id,price_source_label,price_source_reference,price_effective_date,
          price_override_by,price_override_at
        ) values(
          v_company,v_measurement.estimate_id,v_measurement.estimate_section_id,v_component.estimate_item_type,
          v_component.cost_code_id,v_component.catalog_item_id,v_component.labor_task,
          case when v_component.estimate_item_type='labor' then v_measurement.risk_class_code else null end,
          v_measurement.name||' — '||v_path||' — '||v_component.label,
          case when v_component.estimate_item_type='labor' then v_hours else v_qty end,
          case when v_component.estimate_item_type='labor' then 'HR' else v_component.output_unit end,
          v_unit_cost,v_direct,case when v_component.estimate_item_type='labor' then v_hours else 0 end,0,
          'Generated by Takeoff / Assembly Engine. Edit the physical takeoff or component price rather than this line.',
          v_sort,v_output.id,v_measurement.id,v_measurement.assembly_version_id,v_component.production_task_id,
          v_production_qty,v_component.output_unit,v_baseline_man_hours_per_unit,v_component.baseline_source,
          v_job_man_hours_per_unit,v_labor_assumption_override_by,v_labor_assumption_override_at,
          v_labor_rate_override_by,v_labor_rate_override_at,
          v_price_source_kind,v_price_source_id,v_price_source_label,v_price_source_reference,v_price_effective_date,
          v_price_override_by,v_price_override_at
        ) returning id into v_item_id;
      else
        update public.estimate_items set
          quantity=case when v_component.estimate_item_type='labor' then v_hours else v_qty end,
          unit=case when v_component.estimate_item_type='labor' then 'HR' else v_component.output_unit end,
          unit_cost=v_unit_cost,
          direct_cost=v_direct,
          regular_hours=case when v_component.estimate_item_type='labor' then v_hours else 0 end,
          overtime_hours=0,
          production_task_id=v_component.production_task_id,
          production_quantity=v_production_qty,
          production_unit=v_component.output_unit,
          baseline_man_hours_per_unit=v_baseline_man_hours_per_unit,
          baseline_source=v_component.baseline_source,
          job_man_hours_per_unit=v_job_man_hours_per_unit,
          labor_assumption_override_by=v_labor_assumption_override_by,
          labor_assumption_override_at=v_labor_assumption_override_at,
          labor_rate_override_by=v_labor_rate_override_by,
          labor_rate_override_at=v_labor_rate_override_at,
          price_source_kind=v_price_source_kind,
          price_source_id=v_price_source_id,
          price_source_label=v_price_source_label,
          price_source_reference=v_price_source_reference,
          price_effective_date=v_price_effective_date,
          price_override_by=v_price_override_by,
          price_override_at=v_price_override_at,
          updated_at=now()
        where id=v_item_id and company_id=v_company;
      end if;
      update public.takeoff_measurement_outputs set generated_estimate_item_id=v_item_id where id=v_output.id;
      v_sort:=v_sort+10;
    end if;
  end loop;
end;
$function$;
-- Preserve the existing pricing boundary and reject pricing a v7 reference.
create or replace function public.carez_update_takeoff_output_price(p_output_id uuid,p_unit_cost numeric)
returns void
language plpgsql
set search_path=pg_catalog,public,extensions,pg_temp
as $function$
declare
  v_company_id uuid:=public.get_my_company_id();
  v_output public.takeoff_measurement_outputs%rowtype;
  v_estimate_id uuid;
  v_new_cost numeric;
  v_condition_output_count integer;
  v_override_at timestamptz:=now();
begin
  if v_company_id is null or public.get_my_role()='employee' then
    raise exception 'Owner access required.';
  end if;
  if p_unit_cost is null or p_unit_cost<0 or p_unit_cost::text in ('NaN','Infinity','-Infinity') then
    raise exception 'Unit cost must be finite and nonnegative.';
  end if;

  select * into v_output
  from public.takeoff_measurement_outputs
  where id=p_output_id and company_id=v_company_id
  for update;
  if not found then raise exception 'Takeoff output not found.'; end if;
  if public.carez_strip_v7_output_key(v_company_id,v_output.measurement_id,v_output.assembly_component_id)='concrete.installed_cy' then
    raise exception 'Installed concrete is a reference and placement-labor basis. Price ordered concrete supply instead.';end if;

  select estimate_id into v_estimate_id
  from public.takeoff_measurements
  where id=v_output.measurement_id and company_id=v_company_id;

  if exists(select 1 from public.proposal_presentations where company_id=v_company_id and estimate_id=v_estimate_id)
     or exists(select 1 from public.estimates where id=v_estimate_id and company_id=v_company_id and status in ('accepted','approved','superseded')) then
    raise exception 'This estimate revision is locked.';
  end if;

  if exists(
    select 1
    from public.project_condition_outputs condition_output
    join public.project_concrete_condition_versions condition_version
      on condition_version.company_id=condition_output.company_id
     and condition_version.id=condition_output.condition_version_id
    where condition_output.company_id=v_company_id
      and condition_output.legacy_takeoff_output_id=p_output_id
      and condition_version.status='verified'
  ) then
    raise exception 'Verified Project Concrete Condition pricing is immutable. Create a new Condition revision before overriding price.';
  end if;

  select count(*) into v_condition_output_count
  from public.project_condition_outputs
  where company_id=v_company_id and legacy_takeoff_output_id=p_output_id;
  if v_condition_output_count>1 then
    raise exception 'Takeoff output is linked to multiple Project Condition outputs. Reconcile lineage before changing price.';
  end if;

  if v_output.estimate_item_type='labor' then
    v_new_cost:=round(coalesce(v_output.estimated_man_hours,0)*p_unit_cost,2);
  else
    v_new_cost:=round(coalesce(v_output.production_quantity,0)*p_unit_cost,2);
  end if;

  update public.takeoff_measurement_outputs
  set unit_cost=p_unit_cost,
      direct_cost=v_new_cost,
      pricing_status='manual_override',
      cost_source='manual takeoff override',
      price_source_kind='manual_override',
      price_source_id=null,
      price_source_label='Manual estimate override',
      price_source_reference=null,
      price_effective_date=current_date,
      price_override_by=auth.uid(),
      price_override_at=v_override_at,
      updated_at=v_override_at
  where id=p_output_id and company_id=v_company_id;

  update public.estimate_items
  set unit_cost=p_unit_cost,
      direct_cost=v_new_cost,
      price_source_kind='manual_override',
      price_source_id=null,
      price_source_label='Manual estimate override',
      price_source_reference=null,
      price_effective_date=current_date,
      price_override_by=auth.uid(),
      price_override_at=v_override_at,
      updated_at=v_override_at
  where id=v_output.generated_estimate_item_id and company_id=v_company_id;

  if v_condition_output_count=1 then
    perform set_config('carez.project_condition_commit','1',true);
    update public.project_condition_outputs condition_output
    set unit_cost=p_unit_cost,
        direct_cost=v_new_cost,
        pricing_status='manual_override',
        generated_estimate_item_id=coalesce(v_output.generated_estimate_item_id,condition_output.generated_estimate_item_id),
        provenance=coalesce(condition_output.provenance,'{}'::jsonb) || jsonb_build_object(
          'pricing',jsonb_build_object(
            'mode','explicit_override',
            'source_kind','manual_override',
            'source_label','Manual estimate override',
            'effective_date',current_date,
            'updated_by',auth.uid(),
            'updated_at',v_override_at
          )
        ),
        updated_at=v_override_at
    where condition_output.company_id=v_company_id
      and condition_output.legacy_takeoff_output_id=p_output_id
      and exists(
        select 1 from public.project_concrete_condition_versions condition_version
        where condition_version.company_id=v_company_id
          and condition_version.id=condition_output.condition_version_id
          and condition_version.status='draft'
      );
  end if;
end;
$function$;

-- Preserve all22 view columns and legacy semantics; v7 has distinct order/production bases.
create or replace view public.condition_legacy_reconciliation
with (security_invoker = true)
as
select
  output.company_id,
  output.condition_version_id,
  output.id as condition_output_id,
  output.output_key,
  output.output_instance_key,
  output.status as condition_status,
  output.production_quantity as condition_quantity,
  output.production_unit as condition_unit,
  output.direct_cost as condition_direct_cost,
  output.legacy_takeoff_output_id,
  legacy.production_quantity as legacy_quantity,
  legacy.production_unit as legacy_unit,
  legacy.direct_cost as legacy_direct_cost,
  output.generated_estimate_item_id,
  legacy.generated_estimate_item_id as legacy_estimate_item_id,
  case
    when condition.compatibility_projection_version_id is distinct from output.condition_version_id then 'superseded'
    when output.legacy_takeoff_output_id is null or legacy.id is null then 'unmapped'
    when legacy.formula_trace->>'condition_version_id' is distinct from output.condition_version_id::text then 'lineage_mismatch'
    when upper(output.production_unit) <> upper(legacy.production_unit) then 'unit_mismatch'
    when output.status = 'held'
      and legacy.pricing_status = 'missing_input'
      and legacy.production_quantity = 0
      and output.generated_estimate_item_id is not distinct from legacy.generated_estimate_item_id then 'held'
    when output.status = 'inactive'
      and legacy.production_quantity = 0
      and not legacy.estimate_visible
      and legacy.generated_estimate_item_id is null
      and estimate.id is null then 'inactive'
    when output.status = 'ready'
      and (not (pricing_archetype.archetype_code_snapshot='strip_wall_footing' and pricing_archetype.version_no=7 and output.output_key='concrete.procurement_cy') or estimate.id is not null)
      and output.production_quantity is not distinct from legacy.production_quantity
      and output.direct_cost is not distinct from legacy.direct_cost
      and output.generated_estimate_item_id is not distinct from legacy.generated_estimate_item_id
      and (
        estimate.id is null
        or (
          estimate.source_takeoff_output_id = legacy.id
          and estimate.source_takeoff_measurement_id = version.compatibility_anchor_measurement_id
          and case when pricing_archetype.archetype_code_snapshot='strip_wall_footing' and pricing_archetype.version_no=7 and output.output_key='concrete.procurement_cy' then
            installed.status='ready' and installed.production_quantity is not null
            and upper(installed.production_unit)=upper(legacy.production_unit)
            and estimate.quantity is not distinct from legacy.production_quantity
            and estimate.production_quantity is not distinct from installed.production_quantity
          else estimate.production_quantity is not distinct from legacy.production_quantity end
          and upper(estimate.production_unit) = upper(legacy.production_unit)
          and estimate.direct_cost is not distinct from legacy.direct_cost
        )
      ) then 'exact'
    else 'mismatch'
  end as reconciliation_status,
  condition.compatibility_projection_version_id = output.condition_version_id as is_current_projection,
  version.compatibility_anchor_measurement_id,
  legacy.pricing_status as legacy_pricing_status,
  legacy.is_active as legacy_is_active,
  legacy.estimate_visible as legacy_estimate_visible,
  estimate.id as estimate_item_id
from public.project_condition_outputs output
join public.project_concrete_condition_versions version
  on version.company_id = output.company_id and version.id = output.condition_version_id
join public.project_concrete_conditions condition
  on condition.company_id = version.company_id and condition.id = version.condition_id
left join public.platform_condition_archetype_versions pricing_archetype on pricing_archetype.id=version.archetype_version_id
left join public.project_condition_outputs installed on installed.company_id=output.company_id and installed.condition_version_id=output.condition_version_id and installed.output_key='concrete.installed_cy' and installed.output_instance_key=output.output_instance_key
left join public.takeoff_measurement_outputs legacy
  on legacy.id = output.legacy_takeoff_output_id and legacy.company_id = output.company_id
left join public.estimate_items estimate
  on estimate.id = output.generated_estimate_item_id and estimate.company_id = output.company_id;
