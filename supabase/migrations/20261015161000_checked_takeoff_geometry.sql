-- Optimistic concurrency for confirmed geometry history. Existing mutation owns
-- locks, commercial protection, invalidation and output persistence.
create or replace function public.carez_update_drawing_measurement_checked(
  p_measurement_id uuid, p_geometry jsonb, p_raw_quantity numeric,
  p_raw_unit text, p_variables jsonb, p_outputs jsonb,
  p_scale_region_id uuid, p_expected_geometry jsonb, p_expected_updated_at timestamptz
) returns uuid language plpgsql security invoker set search_path=public as $$
declare v_row public.takeoff_measurements%rowtype; v_current jsonb;
begin
  if public.get_my_company_id() is null then raise exception 'Company access required.'; end if;
  select * into v_row from public.takeoff_measurements
    where id=p_measurement_id and company_id=public.get_my_company_id() for update;
  if not found then raise exception 'Drawing measurement unavailable. Reload before editing.'; end if;
  v_current := jsonb_build_object('type',v_row.geometry->'type','points',v_row.geometry->'points');
  if jsonb_array_length(coalesce(v_row.geometry->'holes','[]'::jsonb))>0 then
    v_current:=v_current||jsonb_build_object('holes',v_row.geometry->'holes');
  end if;
  if p_expected_updated_at is null or p_expected_geometry is null
    or v_row.updated_at is distinct from p_expected_updated_at
    or v_current is distinct from p_expected_geometry then
    raise exception 'Drawing changed since this history was recorded. Reload and review the current geometry.' using errcode='40001';
  end if;
  if not exists(select 1 from public.takeoff_sets where id=v_row.takeoff_set_id
    and company_id=v_row.company_id and status='active') then raise exception 'Takeoff revision is read-only.'; end if;
  return public.carez_update_drawing_measurement(p_measurement_id,p_geometry,p_raw_quantity,p_raw_unit,p_variables,p_outputs,p_scale_region_id);
end $$;
revoke all on function public.carez_update_drawing_measurement_checked(uuid,jsonb,numeric,text,jsonb,jsonb,uuid,jsonb,timestamptz) from public,anon;
grant execute on function public.carez_update_drawing_measurement_checked(uuid,jsonb,numeric,text,jsonb,jsonb,uuid,jsonb,timestamptz) to authenticated;
