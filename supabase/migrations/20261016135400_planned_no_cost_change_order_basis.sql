-- Internal no-cost approval tests planned company exposure, before work is incurred.
-- base_company_cost is the shared planned Direct Cost + snapshotted overhead basis.
-- Preserve the production actual-cost view, authorization, zero Sell and immutable
-- delta writes; retain the current closeout company lock and all existing ACLs.
create or replace function public.carez_approve_change_order_v2(p_change_order_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare v_company uuid; v_actor uuid; v_co public.change_orders%rowtype; v_baseline public.commercial_baselines%rowtype; v_original_sell numeric(14,2);
  v_cost numeric(14,2); v_exposure numeric(14,2); v_fingerprint text; v_facts jsonb; v_delta uuid; v_item record; v_existing public.approved_commercial_deltas%rowtype;
begin
  v_actor:=auth.uid(); v_company:=public.carez_commercial_actor_company();
  if v_actor is null or v_company is null or not public.carez_can_manage_commercial_changes() then raise exception 'Owner or office approval authority required.'; end if;
  perform 1 from public.companies where id=v_company for update;
  if not found then raise exception 'Company unavailable';end if;
  select * into v_co from public.change_orders where id=p_change_order_id and company_id=v_company for update;
  if not found then raise exception 'Change Order not found.'; end if;
  select * into v_existing from public.approved_commercial_deltas where company_id=v_company and change_order_id=v_co.id;
  if found then
    if v_co.status='approved' then return jsonb_build_object('change_order_id',v_co.id,'delta_id',v_existing.id,'already_approved',true,'source_fingerprint',v_existing.source_fingerprint); end if;
    raise exception 'Conflicting approval evidence exists for this Change Order.';
  end if;
  if v_co.status='approved' then raise exception 'Approved legacy Change Order has no canonical commercial delta. Reconcile its recorded authority before changing it.';end if;
  if v_co.status<>'submitted' then raise exception 'Only submitted Change Orders can be approved.'; end if;
  select * into v_baseline from public.commercial_baselines where company_id=v_company and project_id=v_co.project_id and baseline_kind='original_award' for share;
  if not found then raise exception 'Original Commercial Baseline not found.'; end if;
  if not exists(select 1 from public.change_order_items where company_id=v_company and change_order_id=v_co.id) then raise exception 'Submitted Change Order has no items.'; end if;
  select coalesce(sum(direct_cost),0)::numeric(14,2) into v_cost from public.change_order_items where company_id=v_company and change_order_id=v_co.id;
  select base_company_cost into v_exposure from public.change_order_financial_summary where company_id=v_company and change_order_id=v_co.id;
  if v_co.authorization_kind in ('external_customer','external_gc') then
    if nullif(btrim(v_co.authorization_reference),'') is null or nullif(btrim(v_co.external_authorized_by),'') is null or v_co.external_authorized_at is null then raise exception 'External authorization evidence is incomplete.'; end if;
  elsif v_co.authorization_kind='internal_no_cost' then
    if v_co.change_type<>'no_cost' or coalesce(v_co.proposed_sell_price,0)<>0 or v_co.field_work_status not in ('directed','in_progress','complete')
      or coalesce(v_co.authorization_note,'')='' or coalesce(v_exposure,0)<=0 then raise exception 'Internal no-cost authority requires documented positive internal exposure and zero Sell.'; end if;
  else raise exception 'Documented external authorization is required.'; end if;
  if v_co.change_type='additive' and coalesce(v_co.proposed_sell_price,0)<0 then raise exception 'Additive Sell delta must be non-negative.'; end if;
  if v_co.change_type='deductive' and coalesce(v_co.proposed_sell_price,0)>0 then raise exception 'Deductive Sell delta must be non-positive.'; end if;
  if v_co.change_type='no_cost' and coalesce(v_co.proposed_sell_price,0)<>0 then raise exception 'No-cost Sell delta must be zero.'; end if;
  if v_co.reversal_of_change_order_id is not null then
    select d.sell_delta into v_original_sell from public.approved_commercial_deltas d
      where d.company_id=v_company and d.change_order_id=v_co.reversal_of_change_order_id;
    if not found or coalesce(v_co.proposed_sell_price,0)<>-v_original_sell then raise exception 'Reversal Change Order Sell must exactly offset the original approved Sell delta.'; end if;
  end if;
  select jsonb_build_object('change_order',to_jsonb(v_co)-array['approved_by','approved_at','updated_at'],
    'items',coalesce(jsonb_agg(to_jsonb(i) order by i.sort_order,i.id),'[]'::jsonb)) into v_facts
  from public.change_order_items i where i.company_id=v_company and i.change_order_id=v_co.id;
  v_fingerprint:=encode(extensions.digest(convert_to(v_facts::text,'UTF8'),'sha256'),'hex');
  insert into public.approved_commercial_deltas(company_id,project_id,change_order_id,commercial_baseline_id,approved_by,approved_at,
    authorization_kind,authorization_reference,external_authorized_by,external_authorized_at,authorization_note,authorization_document_reference,
    source_fingerprint,total_direct_cost_delta,sell_delta,source_facts)
  values(v_company,v_co.project_id,v_co.id,v_baseline.id,v_actor,now(),v_co.authorization_kind,v_co.authorization_reference,
    v_co.external_authorized_by,v_co.external_authorized_at,v_co.authorization_note,v_co.authorization_document_reference,
    v_fingerprint,v_cost,coalesce(v_co.proposed_sell_price,0),v_facts) returning id into v_delta;
  for v_item in select * from public.change_order_items where company_id=v_company and change_order_id=v_co.id order by sort_order,id loop
    insert into public.approved_commercial_delta_items(company_id,commercial_delta_id,commercial_baseline_id,source_change_order_item_id,affected_commercial_baseline_item_id,quantity,unit,direct_cost_delta,source_facts)
    values(v_company,v_delta,v_baseline.id,v_item.id,v_item.affected_commercial_baseline_item_id,v_item.quantity,v_item.unit,v_item.direct_cost,to_jsonb(v_item));
  end loop;
  update public.change_orders set status='approved',approved_by=v_actor,approved_at=now(),updated_at=now() where id=v_co.id and company_id=v_company;
  insert into public.change_order_events(company_id,project_id,change_order_id,from_status,to_status,actor_id,evidence)
  values(v_company,v_co.project_id,v_co.id,'submitted','approved',v_actor,jsonb_build_object('commercial_delta_id',v_delta,'source_fingerprint',v_fingerprint));
  return jsonb_build_object('change_order_id',v_co.id,'delta_id',v_delta,'already_approved',false,'source_fingerprint',v_fingerprint);
end
$$;
