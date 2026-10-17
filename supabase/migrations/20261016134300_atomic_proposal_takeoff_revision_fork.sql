-- One atomic, tenant-scoped next-revision fork. Issued commercial authority,
-- public access tokens and audit events remain on their original revision.
create table public.proposal_revision_forks(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),
 proposal_revision_id uuid not null references public.proposal_presentations(id),source_estimate_id uuid not null references public.estimates(id),
 estimate_id uuid not null references public.estimates(id),actor_id uuid not null references auth.users(id),
 status text not null check(status in ('copying','complete')),maps jsonb not null,source_fingerprint text not null,
 copy_table text,copy_payload jsonb,created_at timestamptz not null default clock_timestamp(),completed_at timestamptz,
 unique(company_id,proposal_revision_id),unique(company_id,estimate_id)
);
alter table public.proposal_revision_forks enable row level security;
revoke all on public.proposal_revision_forks from public,anon,authenticated;

-- This exact-row exception is reachable only inside the private definer fork.
-- Ordinary callers cannot write its pending payload or bypass any validator.
-- It preserves existing historical labels/retired bindings/excluded role history;
-- subsequent editing/calculation still uses the normal validation rules.
create function public.carez_revision_fork_copy_expected(p_table text,p_row jsonb) returns boolean
language sql volatile security invoker set search_path=pg_catalog,public,pg_temp as $$
 select exists(select 1 from public.proposal_revision_forks f where f.id=nullif(current_setting('carez.revision_fork',true),'')::uuid
 and f.company_id=public.get_my_company_id() and f.status='copying' and f.copy_table=p_table and (f.copy_payload-'updated_at')=(p_row-'updated_at'))
$$;
revoke all on function public.carez_revision_fork_copy_expected(text,jsonb) from public,anon,authenticated;

do $guards$ declare name text;definition text;begin
 foreach name in array array['carez_validate_measurement_method_profile','carez_validate_project_condition_version','carez_validate_project_condition_measurement_role','carez_guard_project_condition_version'] loop
  select pg_get_functiondef(('public.'||name||'()')::regprocedure) into definition;
  if definition !~* '\mbegin\M' then raise exception 'Fork validator body unavailable: %',name;end if;
  definition:=regexp_replace(definition,'\mbegin\M',$guard$begin
 if current_user not in ('authenticated','anon') then
  if tg_op in ('INSERT','UPDATE') and public.carez_revision_fork_copy_expected(tg_table_name,to_jsonb(new)) then return new;end if;
 end if;
$guard$,'i');
  execute definition;
 end loop;
end $guards$;

create function public.carez_revision_fork_id(p_maps jsonb,p_table text,p_old uuid) returns uuid
language plpgsql immutable security invoker set search_path=pg_catalog,public,pg_temp as $$
declare result uuid;begin
 if p_old is null then return null;end if;
 result:=(p_maps->p_table->>p_old::text)::uuid;
 if result is null then raise exception 'Revision fork relationship is outside the selected graph: %.%',p_table,p_old;end if;return result;
end $$;
revoke all on function public.carez_revision_fork_id(jsonb,text,uuid) from public,anon,authenticated;

create function public.carez_revision_fork_trace(p_value jsonb,p_maps jsonb) returns jsonb
language plpgsql immutable security invoker set search_path=pg_catalog,public,pg_temp as $$
declare k text;v jsonb;result jsonb;replacement text;kind text;begin
 if jsonb_typeof(p_value)='array' then
  select coalesce(jsonb_agg(public.carez_revision_fork_trace(x,p_maps) order by n),'[]') into result from jsonb_array_elements(p_value) with ordinality a(x,n);return result;
 end if;
 if jsonb_typeof(p_value) is distinct from 'object' then return p_value;end if;
 result:='{}';
 for k,v in select * from jsonb_each(p_value) loop
  replacement:=null;kind:=null;
  if k in ('condition_version_id','conditionVersionId') then kind:='project_concrete_condition_versions';
  elsif k in ('measurement_id','measurementId') then kind:='takeoff_measurements';
  elsif k='source_id' and p_value->>'source_kind'='supplier_quote' then kind:='estimate_supplier_quote_lines';
  elsif k='sourceId' then
   select value->>(v#>>'{}') into replacement from jsonb_each(p_maps) where value ? (v#>>'{}') limit 1;
  end if;
  if kind is not null and v<>'null'::jsonb then replacement:=(public.carez_revision_fork_id(p_maps,kind,(v#>>'{}')::uuid))::text;end if;
  if k in ('measurementIds','measurement_ids') and jsonb_typeof(v)='array' then
   select coalesce(jsonb_agg(to_jsonb(public.carez_revision_fork_id(p_maps,'takeoff_measurements',(x#>>'{}')::uuid)) order by n),'[]') into v from jsonb_array_elements(v) with ordinality a(x,n);
  elsif replacement is not null then v:=to_jsonb(replacement);
  else v:=public.carez_revision_fork_trace(v,p_maps);end if;
  result:=result||jsonb_build_object(k,v);
 end loop;return result;
end $$;
revoke all on function public.carez_revision_fork_trace(jsonb,jsonb) from public,anon,authenticated;

create function public.carez_revision_fork_write(p_fork uuid,p_table text,p_payload jsonb,p_update boolean default false) returns void
language plpgsql security invoker set search_path=pg_catalog,public,pg_temp as $$
declare cols text;projection text;typed jsonb;company uuid;affected integer;begin
 select company_id into company from public.proposal_revision_forks where id=p_fork and status='copying';
 if company is null or company is distinct from public.get_my_company_id() or (p_payload->>'company_id')::uuid is distinct from company then raise exception 'Invalid private revision fork scope';end if;
 if p_table<>all(array['estimates','estimate_items','takeoff_sets','takeoff_sheets','takeoff_scale_regions','takeoff_method_profiles','takeoff_measurements','takeoff_measurement_outputs','project_concrete_conditions','project_concrete_condition_versions','project_condition_module_instances','project_condition_measurement_roles','project_condition_outputs','project_condition_holds','estimate_supplier_quote_sets','estimate_supplier_quotes','estimate_supplier_quote_lines']) then raise exception 'Unsupported fork relation';end if;
 select string_agg(format('%I',attname),',' order by attnum),string_agg(format('s.%I',attname),',' order by attnum) into cols,projection from pg_attribute where attrelid=('public.'||p_table)::regclass and attnum>0 and not attisdropped and attgenerated='' and attidentity='';
 execute format('select to_jsonb(jsonb_populate_record(null::public.%I,$1))',p_table) into typed using p_payload;
 update public.proposal_revision_forks set copy_table=p_table,copy_payload=typed where id=p_fork;
 if p_update then
  execute format('update public.%I t set (%s)=(select %s from jsonb_populate_record(null::public.%I,$1) s) where t.id=($1->>''id'')::uuid and t.company_id=$2',p_table,cols,projection,p_table) using typed,company;
  get diagnostics affected=row_count;if affected<>1 then raise exception 'Fork destination disappeared';end if;
 else execute format('insert into public.%I(%s) select %s from jsonb_populate_record(null::public.%I,$1) s',p_table,cols,projection,p_table) using typed;end if;
 update public.proposal_revision_forks set copy_table=null,copy_payload=null where id=p_fork;
end $$;
revoke all on function public.carez_revision_fork_write(uuid,text,jsonb,boolean) from public,anon,authenticated;

alter function public.carez_create_next_proposal_revision(uuid) rename to carez_create_next_proposal_revision_before_graph;
revoke all on function public.carez_create_next_proposal_revision_before_graph(uuid) from public,anon,authenticated;
create or replace function public.carez_create_next_proposal_revision_source_core(p_proposal_revision_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth,extensions,pg_temp
as $function$
declare
  v_company uuid; v_actor uuid; p public.proposal_presentations%rowtype; e public.estimates%rowtype;
  v_new_estimate uuid; v_version integer; v_section record; v_item record; v_new_section uuid; v_section_map jsonb:='{}'::jsonb;
begin
  v_actor:=auth.uid(); v_company:=public.get_my_company_id();
  if v_actor is null or v_company is null or public.get_my_role()='employee' then raise exception 'Owner or office access required.'; end if;
  select * into p from public.proposal_presentations where id=p_proposal_revision_id and company_id=v_company for update;
  if not found then raise exception 'Issued Proposal revision not found.'; end if;
  select * into e from public.estimates where id=p.estimate_id and company_id=v_company for update;
  if not found then raise exception 'Source Estimate revision not found.'; end if;
  if exists(select 1 from public.award_decisions a where a.company_id=v_company and a.proposal_revision_id=p.id) then raise exception 'An awarded Proposal cannot be revised.'; end if;
  select id into v_new_estimate from public.estimates where company_id=v_company and parent_proposal_revision_id=p.id;
  if v_new_estimate is not null then return jsonb_build_object('estimate_id',v_new_estimate,'already_created',true); end if;
  select coalesce(max(version),e.version)+1 into v_version from public.estimates where company_id=v_company and estimate_number=e.estimate_number;
  insert into public.estimates(company_id,project_id,estimate_number,name,status,version,expected_start_date,target_margin_percent,bo_classification,bo_rate_percent,payment_processing_rate_percent,overhead_snapshot_id,overhead_rate_snapshot,proposed_sell_price,notes,approved_at,created_by,lead_id,opportunity_number,job_spine_id,parent_proposal_revision_id)
  values(v_company,null,e.estimate_number,e.name,'draft',v_version,e.expected_start_date,e.target_margin_percent,e.bo_classification,e.bo_rate_percent,e.payment_processing_rate_percent,e.overhead_snapshot_id,e.overhead_rate_snapshot,e.proposed_sell_price,e.notes,null,v_actor,e.lead_id,e.opportunity_number,e.job_spine_id,p.id)
  returning id into v_new_estimate;
  for v_section in select * from public.estimate_sections where estimate_id=e.id and company_id=v_company order by sort_order,id loop
    insert into public.estimate_sections(company_id,estimate_id,name,scope_type,sort_order,notes)
    values(v_company,v_new_estimate,v_section.name,v_section.scope_type,v_section.sort_order,v_section.notes) returning id into v_new_section;
    v_section_map:=jsonb_set(v_section_map,array[v_section.id::text],to_jsonb(v_new_section),true);
  end loop;
  for v_item in select * from public.estimate_items where estimate_id=e.id and company_id=v_company order by sort_order,id loop
    insert into public.estimate_items(company_id,estimate_id,section_id,item_type,cost_code_id,catalog_item_id,crew_member_id,labor_task,risk_class_code,description,quantity,unit,unit_cost,direct_cost,regular_hours,overtime_hours,base_hourly_rate_snapshot,social_security_rate_snapshot,medicare_rate_snapshot,futa_rate_snapshot,wa_sui_rate_snapshot,li_employer_rate_snapshot,sick_leave_accrual_rate_snapshot,notes,sort_order,source_takeoff_output_id,source_takeoff_measurement_id,source_assembly_version_id,production_task_id,production_quantity,production_unit,baseline_man_hours_per_unit,baseline_source,price_source_kind,price_source_id,price_source_label,price_source_reference,price_effective_date,price_override_by,price_override_at,job_man_hours_per_unit,labor_assumption_override_by,labor_assumption_override_at,labor_rate_override_by,labor_rate_override_at,revision_source_estimate_item_id,revision_source_takeoff_output_id,revision_source_takeoff_measurement_id)
    values(v_company,v_new_estimate,(v_section_map->>v_item.section_id::text)::uuid,v_item.item_type,v_item.cost_code_id,v_item.catalog_item_id,v_item.crew_member_id,v_item.labor_task,v_item.risk_class_code,v_item.description,v_item.quantity,v_item.unit,v_item.unit_cost,v_item.direct_cost,v_item.regular_hours,v_item.overtime_hours,v_item.base_hourly_rate_snapshot,v_item.social_security_rate_snapshot,v_item.medicare_rate_snapshot,v_item.futa_rate_snapshot,v_item.wa_sui_rate_snapshot,v_item.li_employer_rate_snapshot,v_item.sick_leave_accrual_rate_snapshot,v_item.notes,v_item.sort_order,null,null,v_item.source_assembly_version_id,v_item.production_task_id,v_item.production_quantity,v_item.production_unit,v_item.baseline_man_hours_per_unit,v_item.baseline_source,v_item.price_source_kind,v_item.price_source_id,v_item.price_source_label,v_item.price_source_reference,v_item.price_effective_date,v_item.price_override_by,v_item.price_override_at,v_item.job_man_hours_per_unit,v_item.labor_assumption_override_by,v_item.labor_assumption_override_at,v_item.labor_rate_override_by,v_item.labor_rate_override_at,v_item.id,v_item.source_takeoff_output_id,v_item.source_takeoff_measurement_id);
  end loop;
  insert into public.proposal_settings(company_id,estimate_id,audience_type,executive_summary,customer_message,schedule_summary,payment_summary,warranty_summary,why_carez,pricing_note,terms_text,show_quantities,validity_days,created_by)
  select company_id,v_new_estimate,audience_type,executive_summary,customer_message,schedule_summary,payment_summary,warranty_summary,why_carez,pricing_note,terms_text,show_quantities,validity_days,v_actor from public.proposal_settings where estimate_id=e.id and company_id=v_company;
  insert into public.proposal_clarifications(company_id,estimate_id,category,clarification_text,published,sort_order,created_by)
  select company_id,v_new_estimate,category,clarification_text,published,sort_order,v_actor from public.proposal_clarifications where estimate_id=e.id and company_id=v_company;
  insert into public.bid_value_options(company_id,lead_id,estimate_id,name,customer_description,sell_price_change,company_cost_change,schedule_days_change,function_quality_note,approval_required,status,created_by)
  select company_id,lead_id,v_new_estimate,name,customer_description,sell_price_change,company_cost_change,schedule_days_change,function_quality_note,approval_required,'suggested',v_actor from public.bid_value_options where estimate_id=e.id and company_id=v_company;
  return jsonb_build_object('estimate_id',v_new_estimate,'version',v_version,'parent_proposal_revision_id',p.id,'already_created',false,'section_map',v_section_map);
end
$function$;
revoke all on function public.carez_create_next_proposal_revision_source_core(uuid) from public,anon,authenticated;

create function public.carez_create_next_proposal_revision(p_proposal_revision_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,auth,extensions,pg_temp as $$
declare
 company uuid:=public.get_my_company_id();actor uuid:=auth.uid();p public.proposal_presentations%rowtype;e public.estimates%rowtype;
 receipt public.proposal_revision_forks%rowtype;fork uuid;result jsonb;dest uuid;maps jsonb:='{}';spec jsonb;row_data jsonb;payload jsonb;old_id uuid;ids jsonb;
 graph jsonb:='{}';rows jsonb;key text;target text;old_value uuid;source_fingerprint text;v record;condition_row jsonb;pending integer;progress boolean;
 old_fork text:=current_setting('carez.revision_fork',true);old_commit text:=current_setting('carez.project_condition_commit',true);old_verify text:=current_setting('carez.project_condition_verify',true);
begin
 if actor is null or company is null or public.get_my_role() not in ('owner','office') then raise exception 'Owner or office access required';end if;
 select * into p from public.proposal_presentations where company_id=company and id=p_proposal_revision_id for update;
 if not found then raise exception 'Issued Proposal revision not found';end if;
 select * into e from public.estimates where company_id=company and id=p.estimate_id for update;
 if not found then raise exception 'Source Estimate revision not found';end if;
 if exists(select 1 from public.award_decisions where company_id=company and proposal_revision_id=p.id) then raise exception 'An awarded Proposal cannot be revised';end if;
 select * into receipt from public.proposal_revision_forks where company_id=company and proposal_revision_id=p.id;
 if found then
  if receipt.status<>'complete' then raise exception 'Revision fork completion is unavailable. Review the prior attempt';end if;
  return jsonb_build_object('estimate_id',receipt.estimate_id,'already_created',true,'takeoff_graph_copied',true);
 end if;
 if exists(select 1 from public.estimates where company_id=company and parent_proposal_revision_id=p.id) then raise exception 'An older next revision exists without a graph receipt. Review its edits before copying Takeoff; nothing was overwritten';end if;
 for row_data in execute $select$select to_jsonb(t) from public.takeoff_sets t where t.company_id=$1 and (t.estimate_id=$2) order by t.id for update$select$ using company,e.id,maps loop
  graph:=jsonb_set(graph,array['takeoff_sets'],coalesce(graph->'takeoff_sets','[]')||jsonb_build_array(row_data),true);maps:=jsonb_set(maps,array['takeoff_sets'],coalesce(maps->'takeoff_sets','{}')||jsonb_build_object(row_data->>'id',gen_random_uuid()),true);
 end loop;
 for row_data in execute $select$select to_jsonb(t) from public.takeoff_sheets t where t.company_id=$1 and ((($3->'takeoff_sets') ? t.takeoff_set_id::text)) order by t.id for update$select$ using company,e.id,maps loop
  graph:=jsonb_set(graph,array['takeoff_sheets'],coalesce(graph->'takeoff_sheets','[]')||jsonb_build_array(row_data),true);maps:=jsonb_set(maps,array['takeoff_sheets'],coalesce(maps->'takeoff_sheets','{}')||jsonb_build_object(row_data->>'id',gen_random_uuid()),true);
 end loop;
 for row_data in execute $select$select to_jsonb(t) from public.takeoff_scale_regions t where t.company_id=$1 and ((($3->'takeoff_sets') ? t.takeoff_set_id::text) and (($3->'takeoff_sheets') ? t.sheet_id::text)) order by t.id for update$select$ using company,e.id,maps loop
  graph:=jsonb_set(graph,array['takeoff_scale_regions'],coalesce(graph->'takeoff_scale_regions','[]')||jsonb_build_array(row_data),true);maps:=jsonb_set(maps,array['takeoff_scale_regions'],coalesce(maps->'takeoff_scale_regions','{}')||jsonb_build_object(row_data->>'id',gen_random_uuid()),true);
 end loop;
 for row_data in execute $select$select to_jsonb(t) from public.takeoff_method_profiles t where t.company_id=$1 and ((($3->'takeoff_sets') ? t.takeoff_set_id::text)) order by t.id for update$select$ using company,e.id,maps loop
  graph:=jsonb_set(graph,array['takeoff_method_profiles'],coalesce(graph->'takeoff_method_profiles','[]')||jsonb_build_array(row_data),true);maps:=jsonb_set(maps,array['takeoff_method_profiles'],coalesce(maps->'takeoff_method_profiles','{}')||jsonb_build_object(row_data->>'id',gen_random_uuid()),true);
 end loop;
 for row_data in execute $select$select to_jsonb(t) from public.takeoff_measurements t where t.company_id=$1 and (t.estimate_id=$2 and (($3->'takeoff_sets') ? t.takeoff_set_id::text)) order by t.id for update$select$ using company,e.id,maps loop
  graph:=jsonb_set(graph,array['takeoff_measurements'],coalesce(graph->'takeoff_measurements','[]')||jsonb_build_array(row_data),true);maps:=jsonb_set(maps,array['takeoff_measurements'],coalesce(maps->'takeoff_measurements','{}')||jsonb_build_object(row_data->>'id',gen_random_uuid()),true);
 end loop;
 for row_data in execute $select$select to_jsonb(t) from public.takeoff_measurement_outputs t where t.company_id=$1 and ((($3->'takeoff_measurements') ? t.measurement_id::text)) order by t.id for update$select$ using company,e.id,maps loop
  graph:=jsonb_set(graph,array['takeoff_measurement_outputs'],coalesce(graph->'takeoff_measurement_outputs','[]')||jsonb_build_array(row_data),true);maps:=jsonb_set(maps,array['takeoff_measurement_outputs'],coalesce(maps->'takeoff_measurement_outputs','{}')||jsonb_build_object(row_data->>'id',gen_random_uuid()),true);
 end loop;
 for row_data in execute $select$select to_jsonb(t) from public.project_concrete_conditions t where t.company_id=$1 and ((($3->'takeoff_sets') ? t.takeoff_set_id::text)) order by t.id for update$select$ using company,e.id,maps loop
  graph:=jsonb_set(graph,array['project_concrete_conditions'],coalesce(graph->'project_concrete_conditions','[]')||jsonb_build_array(row_data),true);maps:=jsonb_set(maps,array['project_concrete_conditions'],coalesce(maps->'project_concrete_conditions','{}')||jsonb_build_object(row_data->>'id',gen_random_uuid()),true);
 end loop;
 for row_data in execute $select$select to_jsonb(t) from public.project_concrete_condition_versions t where t.company_id=$1 and ((($3->'project_concrete_conditions') ? t.condition_id::text)) order by t.id for update$select$ using company,e.id,maps loop
  graph:=jsonb_set(graph,array['project_concrete_condition_versions'],coalesce(graph->'project_concrete_condition_versions','[]')||jsonb_build_array(row_data),true);maps:=jsonb_set(maps,array['project_concrete_condition_versions'],coalesce(maps->'project_concrete_condition_versions','{}')||jsonb_build_object(row_data->>'id',gen_random_uuid()),true);
 end loop;
 for row_data in execute $select$select to_jsonb(t) from public.project_condition_module_instances t where t.company_id=$1 and ((($3->'project_concrete_condition_versions') ? t.condition_version_id::text)) order by t.id for update$select$ using company,e.id,maps loop
  graph:=jsonb_set(graph,array['project_condition_module_instances'],coalesce(graph->'project_condition_module_instances','[]')||jsonb_build_array(row_data),true);maps:=jsonb_set(maps,array['project_condition_module_instances'],coalesce(maps->'project_condition_module_instances','{}')||jsonb_build_object(row_data->>'id',gen_random_uuid()),true);
 end loop;
 for row_data in execute $select$select to_jsonb(t) from public.project_condition_measurement_roles t where t.company_id=$1 and ((($3->'project_concrete_condition_versions') ? t.condition_version_id::text)) order by t.id for update$select$ using company,e.id,maps loop
  graph:=jsonb_set(graph,array['project_condition_measurement_roles'],coalesce(graph->'project_condition_measurement_roles','[]')||jsonb_build_array(row_data),true);maps:=jsonb_set(maps,array['project_condition_measurement_roles'],coalesce(maps->'project_condition_measurement_roles','{}')||jsonb_build_object(row_data->>'id',gen_random_uuid()),true);
 end loop;
 for row_data in execute $select$select to_jsonb(t) from public.project_condition_outputs t where t.company_id=$1 and ((($3->'project_concrete_condition_versions') ? t.condition_version_id::text)) order by t.id for update$select$ using company,e.id,maps loop
  graph:=jsonb_set(graph,array['project_condition_outputs'],coalesce(graph->'project_condition_outputs','[]')||jsonb_build_array(row_data),true);maps:=jsonb_set(maps,array['project_condition_outputs'],coalesce(maps->'project_condition_outputs','{}')||jsonb_build_object(row_data->>'id',gen_random_uuid()),true);
 end loop;
 for row_data in execute $select$select to_jsonb(t) from public.project_condition_holds t where t.company_id=$1 and ((($3->'project_concrete_condition_versions') ? t.condition_version_id::text)) order by t.id for update$select$ using company,e.id,maps loop
  graph:=jsonb_set(graph,array['project_condition_holds'],coalesce(graph->'project_condition_holds','[]')||jsonb_build_array(row_data),true);maps:=jsonb_set(maps,array['project_condition_holds'],coalesce(maps->'project_condition_holds','{}')||jsonb_build_object(row_data->>'id',gen_random_uuid()),true);
 end loop;
 for row_data in execute $select$select to_jsonb(t) from public.estimate_supplier_quote_sets t where t.company_id=$1 and (t.estimate_id=$2) order by t.id for update$select$ using company,e.id,maps loop
  graph:=jsonb_set(graph,array['estimate_supplier_quote_sets'],coalesce(graph->'estimate_supplier_quote_sets','[]')||jsonb_build_array(row_data),true);maps:=jsonb_set(maps,array['estimate_supplier_quote_sets'],coalesce(maps->'estimate_supplier_quote_sets','{}')||jsonb_build_object(row_data->>'id',gen_random_uuid()),true);
 end loop;
 for row_data in execute $select$select to_jsonb(t) from public.estimate_supplier_quotes t where t.company_id=$1 and ((($3->'estimate_supplier_quote_sets') ? t.quote_set_id::text)) order by t.id for update$select$ using company,e.id,maps loop
  graph:=jsonb_set(graph,array['estimate_supplier_quotes'],coalesce(graph->'estimate_supplier_quotes','[]')||jsonb_build_array(row_data),true);maps:=jsonb_set(maps,array['estimate_supplier_quotes'],coalesce(maps->'estimate_supplier_quotes','{}')||jsonb_build_object(row_data->>'id',gen_random_uuid()),true);
 end loop;
 for row_data in execute $select$select to_jsonb(t) from public.estimate_supplier_quote_lines t where t.company_id=$1 and ((($3->'estimate_supplier_quotes') ? t.quote_id::text)) order by t.id for update$select$ using company,e.id,maps loop
  graph:=jsonb_set(graph,array['estimate_supplier_quote_lines'],coalesce(graph->'estimate_supplier_quote_lines','[]')||jsonb_build_array(row_data),true);maps:=jsonb_set(maps,array['estimate_supplier_quote_lines'],coalesce(maps->'estimate_supplier_quote_lines','{}')||jsonb_build_object(row_data->>'id',gen_random_uuid()),true);
 end loop;

 source_fingerprint:=encode(extensions.digest(convert_to(graph::text,'UTF8'),'sha256'),'hex');
 result:=public.carez_create_next_proposal_revision_source_core(p.id);dest:=(result->>'estimate_id')::uuid;
 maps:=maps||jsonb_build_object('estimates',jsonb_build_object(e.id,dest),'estimate_sections',result->'section_map');
 select coalesce(jsonb_object_agg(revision_source_estimate_item_id::text,id),'{}') into ids from public.estimate_items where company_id=company and estimate_id=dest;
 if (select count(*) from jsonb_object_keys(ids))<>(select count(*) from public.estimate_items where company_id=company and estimate_id=e.id) then raise exception 'Revision item lineage is not bijective';end if;
 maps:=maps||jsonb_build_object('estimate_items',ids);
 insert into public.proposal_revision_forks(company_id,proposal_revision_id,source_estimate_id,estimate_id,actor_id,status,maps,source_fingerprint)
 values(company,p.id,e.id,dest,actor,'copying',maps,source_fingerprint) returning id into fork;
 perform set_config('carez.revision_fork',fork::text,true);perform set_config('carez.project_condition_commit','1',true);perform set_config('carez.project_condition_verify','1',true);
for row_data in select value from jsonb_array_elements(coalesce(graph->'takeoff_sets','[]')) loop
 payload:=row_data||jsonb_build_object('id',public.carez_revision_fork_id(maps,'takeoff_sets',(row_data->>'id')::uuid));
 payload:=jsonb_set(payload,array['estimate_id'],coalesce(to_jsonb(public.carez_revision_fork_id(maps,'estimates',(row_data->>'estimate_id')::uuid)),'null'),true);
 payload:=jsonb_set(payload,array['created_at'],to_jsonb(clock_timestamp()),true);
 payload:=jsonb_set(payload,array['updated_at'],to_jsonb(clock_timestamp()),true);
 payload:=jsonb_set(payload,'{created_by}',to_jsonb(actor),true);
 perform public.carez_revision_fork_write(fork,'takeoff_sets',payload);end loop;
for row_data in select value from jsonb_array_elements(coalesce(graph->'takeoff_sheets','[]')) loop
 payload:=row_data||jsonb_build_object('id',public.carez_revision_fork_id(maps,'takeoff_sheets',(row_data->>'id')::uuid));
 payload:=jsonb_set(payload,array['takeoff_set_id'],coalesce(to_jsonb(public.carez_revision_fork_id(maps,'takeoff_sets',(row_data->>'takeoff_set_id')::uuid)),'null'),true);
 payload:=jsonb_set(payload,array['created_at'],to_jsonb(clock_timestamp()),true);
 payload:=jsonb_set(payload,array['updated_at'],to_jsonb(clock_timestamp()),true);
 perform public.carez_revision_fork_write(fork,'takeoff_sheets',payload);end loop;
for row_data in select value from jsonb_array_elements(coalesce(graph->'takeoff_scale_regions','[]')) loop
 payload:=row_data||jsonb_build_object('id',public.carez_revision_fork_id(maps,'takeoff_scale_regions',(row_data->>'id')::uuid));
 payload:=jsonb_set(payload,array['takeoff_set_id'],coalesce(to_jsonb(public.carez_revision_fork_id(maps,'takeoff_sets',(row_data->>'takeoff_set_id')::uuid)),'null'),true);
 payload:=jsonb_set(payload,array['sheet_id'],coalesce(to_jsonb(public.carez_revision_fork_id(maps,'takeoff_sheets',(row_data->>'sheet_id')::uuid)),'null'),true);
 payload:=jsonb_set(payload,array['created_at'],to_jsonb(clock_timestamp()),true);
 payload:=jsonb_set(payload,array['updated_at'],to_jsonb(clock_timestamp()),true);
 payload:=jsonb_set(payload,'{created_by}',to_jsonb(actor),true);
 perform public.carez_revision_fork_write(fork,'takeoff_scale_regions',payload);end loop;
for row_data in select value from jsonb_array_elements(coalesce(graph->'takeoff_method_profiles','[]')) loop
 payload:=row_data||jsonb_build_object('id',public.carez_revision_fork_id(maps,'takeoff_method_profiles',(row_data->>'id')::uuid));
 payload:=jsonb_set(payload,array['takeoff_set_id'],coalesce(to_jsonb(public.carez_revision_fork_id(maps,'takeoff_sets',(row_data->>'takeoff_set_id')::uuid)),'null'),true);
 payload:=jsonb_set(payload,array['created_at'],to_jsonb(clock_timestamp()),true);
 payload:=jsonb_set(payload,array['updated_at'],to_jsonb(clock_timestamp()),true);
 payload:=jsonb_set(payload,'{created_by}',to_jsonb(actor),true);
 perform public.carez_revision_fork_write(fork,'takeoff_method_profiles',payload);end loop;
for row_data in select value from jsonb_array_elements(coalesce(graph->'takeoff_measurements','[]')) loop
 payload:=row_data||jsonb_build_object('id',public.carez_revision_fork_id(maps,'takeoff_measurements',(row_data->>'id')::uuid));
 payload:=jsonb_set(payload,array['takeoff_set_id'],coalesce(to_jsonb(public.carez_revision_fork_id(maps,'takeoff_sets',(row_data->>'takeoff_set_id')::uuid)),'null'),true);
 payload:=jsonb_set(payload,array['sheet_id'],coalesce(to_jsonb(public.carez_revision_fork_id(maps,'takeoff_sheets',(row_data->>'sheet_id')::uuid)),'null'),true);
 payload:=jsonb_set(payload,array['estimate_id'],coalesce(to_jsonb(public.carez_revision_fork_id(maps,'estimates',(row_data->>'estimate_id')::uuid)),'null'),true);
 payload:=jsonb_set(payload,array['estimate_section_id'],coalesce(to_jsonb(public.carez_revision_fork_id(maps,'estimate_sections',(row_data->>'estimate_section_id')::uuid)),'null'),true);
 payload:=jsonb_set(payload,array['scale_region_id'],coalesce(to_jsonb(public.carez_revision_fork_id(maps,'takeoff_scale_regions',(row_data->>'scale_region_id')::uuid)),'null'),true);
 payload:=jsonb_set(payload,array['method_profile_id'],coalesce(to_jsonb(public.carez_revision_fork_id(maps,'takeoff_method_profiles',(row_data->>'method_profile_id')::uuid)),'null'),true);
 payload:=jsonb_set(payload,array['created_at'],to_jsonb(clock_timestamp()),true);
 payload:=jsonb_set(payload,array['updated_at'],to_jsonb(clock_timestamp()),true);
 payload:=jsonb_set(payload,'{created_by}',to_jsonb(actor),true);
 perform public.carez_revision_fork_write(fork,'takeoff_measurements',payload);end loop;
for row_data in select value from jsonb_array_elements(coalesce(graph->'takeoff_measurement_outputs','[]')) loop
 payload:=row_data||jsonb_build_object('id',public.carez_revision_fork_id(maps,'takeoff_measurement_outputs',(row_data->>'id')::uuid));
 payload:=jsonb_set(payload,array['measurement_id'],coalesce(to_jsonb(public.carez_revision_fork_id(maps,'takeoff_measurements',(row_data->>'measurement_id')::uuid)),'null'),true);
 payload:=jsonb_set(payload,array['generated_estimate_item_id'],coalesce(to_jsonb(public.carez_revision_fork_id(maps,'estimate_items',(row_data->>'generated_estimate_item_id')::uuid)),'null'),true);
 if row_data->>'price_source_kind'='supplier_quote' then payload:=jsonb_set(payload,'{price_source_id}',coalesce(to_jsonb(public.carez_revision_fork_id(maps,'estimate_supplier_quote_lines',(row_data->>'price_source_id')::uuid)),'null'),true);end if;
 payload:=jsonb_set(payload,array['formula_trace'],public.carez_revision_fork_trace(row_data->'formula_trace',maps),true);
 payload:=jsonb_set(payload,array['created_at'],to_jsonb(clock_timestamp()),true);
 payload:=jsonb_set(payload,array['updated_at'],to_jsonb(clock_timestamp()),true);
 perform public.carez_revision_fork_write(fork,'takeoff_measurement_outputs',payload);end loop;
for row_data in select value from jsonb_array_elements(coalesce(graph->'project_concrete_conditions','[]')) loop
 payload:=row_data||jsonb_build_object('id',public.carez_revision_fork_id(maps,'project_concrete_conditions',(row_data->>'id')::uuid));
 payload:=jsonb_set(payload,array['takeoff_set_id'],coalesce(to_jsonb(public.carez_revision_fork_id(maps,'takeoff_sets',(row_data->>'takeoff_set_id')::uuid)),'null'),true);
 payload:=jsonb_set(payload,array['compatibility_projection_version_id'],'null',true);
 payload:=jsonb_set(payload,array['created_at'],to_jsonb(clock_timestamp()),true);
 payload:=jsonb_set(payload,array['updated_at'],to_jsonb(clock_timestamp()),true);
 payload:=jsonb_set(payload,'{created_by}',to_jsonb(actor),true);
 perform public.carez_revision_fork_write(fork,'project_concrete_conditions',payload);end loop;
for row_data in select to_jsonb(i) from public.estimate_items i where company_id=company and estimate_id=e.id order by id loop
 payload:=row_data||jsonb_build_object('id',public.carez_revision_fork_id(maps,'estimate_items',(row_data->>'id')::uuid));
 payload:=jsonb_set(payload,array['estimate_id'],coalesce(to_jsonb(public.carez_revision_fork_id(maps,'estimates',(row_data->>'estimate_id')::uuid)),'null'),true);
 payload:=jsonb_set(payload,array['section_id'],coalesce(to_jsonb(public.carez_revision_fork_id(maps,'estimate_sections',(row_data->>'section_id')::uuid)),'null'),true);
 payload:=jsonb_set(payload,array['source_takeoff_output_id'],coalesce(to_jsonb(public.carez_revision_fork_id(maps,'takeoff_measurement_outputs',(row_data->>'source_takeoff_output_id')::uuid)),'null'),true);
 payload:=jsonb_set(payload,array['source_takeoff_measurement_id'],coalesce(to_jsonb(public.carez_revision_fork_id(maps,'takeoff_measurements',(row_data->>'source_takeoff_measurement_id')::uuid)),'null'),true);
 if row_data->>'price_source_kind'='supplier_quote' then payload:=jsonb_set(payload,'{price_source_id}',coalesce(to_jsonb(public.carez_revision_fork_id(maps,'estimate_supplier_quote_lines',(row_data->>'price_source_id')::uuid)),'null'),true);end if;
 payload:=jsonb_set(payload,array['created_at'],to_jsonb(clock_timestamp()),true);
 payload:=jsonb_set(payload,array['updated_at'],to_jsonb(clock_timestamp()),true);
 payload:=payload||jsonb_build_object('revision_source_estimate_item_id',row_data->'id','revision_source_takeoff_output_id',row_data->'source_takeoff_output_id','revision_source_takeoff_measurement_id',row_data->'source_takeoff_measurement_id');
 perform public.carez_revision_fork_write(fork,'estimate_items',payload,true);end loop;

 pending:=coalesce(jsonb_array_length(graph->'project_concrete_condition_versions'),0);
 while pending>0 loop
  progress:=false;
  for row_data in select value from jsonb_array_elements(graph->'project_concrete_condition_versions') order by (value->>'status'='draft'),(value->>'revision_no')::integer,value->>'id' loop
   if exists(select 1 from public.project_concrete_condition_versions where id=public.carez_revision_fork_id(maps,'project_concrete_condition_versions',(row_data->>'id')::uuid)) then continue;end if;
   if row_data->>'source_version_id' is not null and not exists(select 1 from public.project_concrete_condition_versions where id=public.carez_revision_fork_id(maps,'project_concrete_condition_versions',(row_data->>'source_version_id')::uuid)) then continue;end if;
payload:=row_data||jsonb_build_object('id',public.carez_revision_fork_id(maps,'project_concrete_condition_versions',(row_data->>'id')::uuid));
 payload:=jsonb_set(payload,array['condition_id'],coalesce(to_jsonb(public.carez_revision_fork_id(maps,'project_concrete_conditions',(row_data->>'condition_id')::uuid)),'null'),true);
 payload:=jsonb_set(payload,array['legacy_method_profile_id'],coalesce(to_jsonb(public.carez_revision_fork_id(maps,'takeoff_method_profiles',(row_data->>'legacy_method_profile_id')::uuid)),'null'),true);
 payload:=jsonb_set(payload,array['source_version_id'],coalesce(to_jsonb(public.carez_revision_fork_id(maps,'project_concrete_condition_versions',(row_data->>'source_version_id')::uuid)),'null'),true);
 payload:=jsonb_set(payload,array['compatibility_anchor_measurement_id'],coalesce(to_jsonb(public.carez_revision_fork_id(maps,'takeoff_measurements',(row_data->>'compatibility_anchor_measurement_id')::uuid)),'null'),true);
 payload:=jsonb_set(payload,array['input_provenance'],public.carez_revision_fork_trace(row_data->'input_provenance',maps),true);
 payload:=jsonb_set(payload,array['created_at'],to_jsonb(clock_timestamp()),true);
 payload:=jsonb_set(payload,array['updated_at'],to_jsonb(clock_timestamp()),true);
 payload:=jsonb_set(payload,'{created_by}',to_jsonb(actor),true);
   payload:=payload||jsonb_build_object('status','draft','verified_by',null,'verified_at',null);
   perform public.carez_revision_fork_write(fork,'project_concrete_condition_versions',payload);
   old_id:=(row_data->>'id')::uuid;
   for condition_row in select value from jsonb_array_elements(coalesce(graph->'project_condition_module_instances','[]')) where value->>'condition_version_id'=old_id::text loop
    row_data:=condition_row;
    payload:=row_data||jsonb_build_object('id',public.carez_revision_fork_id(maps,'project_condition_module_instances',(row_data->>'id')::uuid));
 payload:=jsonb_set(payload,array['condition_version_id'],coalesce(to_jsonb(public.carez_revision_fork_id(maps,'project_concrete_condition_versions',(row_data->>'condition_version_id')::uuid)),'null'),true);
 payload:=jsonb_set(payload,array['input_provenance'],public.carez_revision_fork_trace(row_data->'input_provenance',maps),true);
 payload:=jsonb_set(payload,array['created_at'],to_jsonb(clock_timestamp()),true);
 payload:=jsonb_set(payload,array['updated_at'],to_jsonb(clock_timestamp()),true);
 payload:=jsonb_set(payload,'{created_by}',to_jsonb(actor),true);
    perform public.carez_revision_fork_write(fork,'project_condition_module_instances',payload);
   end loop;
   for condition_row in select value from jsonb_array_elements(coalesce(graph->'project_condition_measurement_roles','[]')) where value->>'condition_version_id'=old_id::text loop
    row_data:=condition_row;
    payload:=row_data||jsonb_build_object('id',public.carez_revision_fork_id(maps,'project_condition_measurement_roles',(row_data->>'id')::uuid));
 payload:=jsonb_set(payload,array['condition_version_id'],coalesce(to_jsonb(public.carez_revision_fork_id(maps,'project_concrete_condition_versions',(row_data->>'condition_version_id')::uuid)),'null'),true);
 payload:=jsonb_set(payload,array['measurement_id'],coalesce(to_jsonb(public.carez_revision_fork_id(maps,'takeoff_measurements',(row_data->>'measurement_id')::uuid)),'null'),true);
 payload:=jsonb_set(payload,array['created_at'],to_jsonb(clock_timestamp()),true);
 payload:=jsonb_set(payload,'{created_by}',to_jsonb(actor),true);
    perform public.carez_revision_fork_write(fork,'project_condition_measurement_roles',payload);
   end loop;
   for condition_row in select value from jsonb_array_elements(coalesce(graph->'project_condition_outputs','[]')) where value->>'condition_version_id'=old_id::text loop
    row_data:=condition_row;
    payload:=row_data||jsonb_build_object('id',public.carez_revision_fork_id(maps,'project_condition_outputs',(row_data->>'id')::uuid));
 payload:=jsonb_set(payload,array['condition_version_id'],coalesce(to_jsonb(public.carez_revision_fork_id(maps,'project_concrete_condition_versions',(row_data->>'condition_version_id')::uuid)),'null'),true);
 payload:=jsonb_set(payload,array['module_instance_id'],coalesce(to_jsonb(public.carez_revision_fork_id(maps,'project_condition_module_instances',(row_data->>'module_instance_id')::uuid)),'null'),true);
 payload:=jsonb_set(payload,array['driver_measurement_role_id'],coalesce(to_jsonb(public.carez_revision_fork_id(maps,'project_condition_measurement_roles',(row_data->>'driver_measurement_role_id')::uuid)),'null'),true);
 payload:=jsonb_set(payload,array['legacy_takeoff_output_id'],coalesce(to_jsonb(public.carez_revision_fork_id(maps,'takeoff_measurement_outputs',(row_data->>'legacy_takeoff_output_id')::uuid)),'null'),true);
 payload:=jsonb_set(payload,array['generated_estimate_item_id'],coalesce(to_jsonb(public.carez_revision_fork_id(maps,'estimate_items',(row_data->>'generated_estimate_item_id')::uuid)),'null'),true);
 payload:=jsonb_set(payload,array['provenance'],public.carez_revision_fork_trace(row_data->'provenance',maps),true);
 payload:=jsonb_set(payload,array['calculation_trace'],public.carez_revision_fork_trace(row_data->'calculation_trace',maps),true);
 payload:=jsonb_set(payload,array['created_at'],to_jsonb(clock_timestamp()),true);
 payload:=jsonb_set(payload,array['updated_at'],to_jsonb(clock_timestamp()),true);
    perform public.carez_revision_fork_write(fork,'project_condition_outputs',payload);
   end loop;
   for condition_row in select value from jsonb_array_elements(coalesce(graph->'project_condition_holds','[]')) where value->>'condition_version_id'=old_id::text loop
    row_data:=condition_row;
    payload:=row_data||jsonb_build_object('id',public.carez_revision_fork_id(maps,'project_condition_holds',(row_data->>'id')::uuid));
 payload:=jsonb_set(payload,array['condition_version_id'],coalesce(to_jsonb(public.carez_revision_fork_id(maps,'project_concrete_condition_versions',(row_data->>'condition_version_id')::uuid)),'null'),true);
 payload:=jsonb_set(payload,array['output_id'],coalesce(to_jsonb(public.carez_revision_fork_id(maps,'project_condition_outputs',(row_data->>'output_id')::uuid)),'null'),true);
 payload:=jsonb_set(payload,array['created_at'],to_jsonb(clock_timestamp()),true);
 payload:=jsonb_set(payload,array['updated_at'],to_jsonb(clock_timestamp()),true);
    perform public.carez_revision_fork_write(fork,'project_condition_holds',payload);
   end loop;

   select value into row_data from jsonb_array_elements(graph->'project_concrete_condition_versions') where value->>'id'=old_id::text;
   if row_data->>'status'<>'draft' then
    select to_jsonb(copied_version) into payload from public.project_concrete_condition_versions copied_version where copied_version.id=public.carez_revision_fork_id(maps,'project_concrete_condition_versions',old_id);
    payload:=payload||jsonb_build_object('status',row_data->'status','verified_by',row_data->'verified_by','verified_at',row_data->'verified_at');
    perform public.carez_revision_fork_write(fork,'project_concrete_condition_versions',payload,true);
   end if;
   pending:=pending-1;progress:=true;
  end loop;
  if not progress then raise exception 'Revision Condition ancestry is cyclic or outside the selected graph';end if;
 end loop;
for row_data in select value from jsonb_array_elements(coalesce(graph->'estimate_supplier_quote_sets','[]')) loop
 payload:=row_data||jsonb_build_object('id',public.carez_revision_fork_id(maps,'estimate_supplier_quote_sets',(row_data->>'id')::uuid));
 payload:=jsonb_set(payload,array['estimate_id'],coalesce(to_jsonb(public.carez_revision_fork_id(maps,'estimates',(row_data->>'estimate_id')::uuid)),'null'),true);
 payload:=jsonb_set(payload,array['created_at'],to_jsonb(clock_timestamp()),true);
 payload:=jsonb_set(payload,array['updated_at'],to_jsonb(clock_timestamp()),true);
 payload:=jsonb_set(payload,'{created_by}',to_jsonb(actor),true);
 perform public.carez_revision_fork_write(fork,'estimate_supplier_quote_sets',payload);end loop;
for row_data in select value from jsonb_array_elements(coalesce(graph->'estimate_supplier_quotes','[]')) loop
 payload:=row_data||jsonb_build_object('id',public.carez_revision_fork_id(maps,'estimate_supplier_quotes',(row_data->>'id')::uuid));
 payload:=jsonb_set(payload,array['quote_set_id'],coalesce(to_jsonb(public.carez_revision_fork_id(maps,'estimate_supplier_quote_sets',(row_data->>'quote_set_id')::uuid)),'null'),true);
 payload:=jsonb_set(payload,array['created_at'],to_jsonb(clock_timestamp()),true);
 payload:=jsonb_set(payload,array['updated_at'],to_jsonb(clock_timestamp()),true);
 payload:=jsonb_set(payload,'{created_by}',to_jsonb(actor),true);
 perform public.carez_revision_fork_write(fork,'estimate_supplier_quotes',payload);end loop;
for row_data in select value from jsonb_array_elements(coalesce(graph->'estimate_supplier_quote_lines','[]')) loop
 payload:=row_data||jsonb_build_object('id',public.carez_revision_fork_id(maps,'estimate_supplier_quote_lines',(row_data->>'id')::uuid));
 payload:=jsonb_set(payload,array['quote_id'],coalesce(to_jsonb(public.carez_revision_fork_id(maps,'estimate_supplier_quotes',(row_data->>'quote_id')::uuid)),'null'),true);
 payload:=jsonb_set(payload,array['source_takeoff_output_id'],coalesce(to_jsonb(public.carez_revision_fork_id(maps,'takeoff_measurement_outputs',(row_data->>'source_takeoff_output_id')::uuid)),'null'),true);
 payload:=jsonb_set(payload,array['generated_estimate_item_id'],coalesce(to_jsonb(public.carez_revision_fork_id(maps,'estimate_items',(row_data->>'generated_estimate_item_id')::uuid)),'null'),true);
 payload:=jsonb_set(payload,array['created_at'],to_jsonb(clock_timestamp()),true);
 payload:=jsonb_set(payload,'{created_by}',to_jsonb(actor),true);
 perform public.carez_revision_fork_write(fork,'estimate_supplier_quote_lines',payload);end loop;

 for row_data in select value from jsonb_array_elements(coalesce(graph->'project_concrete_conditions','[]')) loop
  update public.project_concrete_conditions set compatibility_projection_version_id=public.carez_revision_fork_id(maps,'project_concrete_condition_versions',(row_data->>'compatibility_projection_version_id')::uuid)
  where company_id=company and id=public.carez_revision_fork_id(maps,'project_concrete_conditions',(row_data->>'id')::uuid);
 end loop;
 update public.proposal_revision_forks set status='complete',copy_table=null,copy_payload=null,completed_at=clock_timestamp() where id=fork;
 perform set_config('carez.revision_fork',coalesce(old_fork,''),true);perform set_config('carez.project_condition_commit',coalesce(old_commit,''),true);perform set_config('carez.project_condition_verify',coalesce(old_verify,''),true);
 return (result-'section_map')||jsonb_build_object('takeoff_graph_copied',true,'fork_id',fork);
end $$;
revoke all on function public.carez_create_next_proposal_revision(uuid) from public,anon;
grant execute on function public.carez_create_next_proposal_revision(uuid) to authenticated;
