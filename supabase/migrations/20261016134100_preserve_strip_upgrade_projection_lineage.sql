-- Preserve the previous projection until atomic recalculation cleans up removed roles.
create or replace function public.carez_upgrade_strip_condition_draft_to_v6(p_condition_version_id uuid) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
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
