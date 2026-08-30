alter table public.plan_fact_sources add column takeoff_set_id uuid not null references public.takeoff_sets(id) on delete cascade;
alter table public.plan_fact_relations add column takeoff_set_id uuid not null references public.takeoff_sets(id) on delete cascade;
alter table public.plan_fact_decisions add column takeoff_set_id uuid not null references public.takeoff_sets(id) on delete cascade;
alter table public.takeoff_plan_fact_applications add column takeoff_set_id uuid not null references public.takeoff_sets(id) on delete cascade;

create unique index if not exists plan_intelligence_runs_company_set_id_uk on public.plan_intelligence_runs(company_id,takeoff_set_id,id);
create unique index if not exists plan_scopes_company_set_id_uk on public.plan_scopes(company_id,takeoff_set_id,id);
create unique index if not exists plan_source_regions_company_set_id_uk on public.plan_source_regions(company_id,takeoff_set_id,id);
create unique index if not exists plan_facts_company_set_id_uk on public.plan_facts(company_id,takeoff_set_id,id);
create unique index if not exists takeoff_sheets_company_set_id_uk on public.takeoff_sheets(company_id,takeoff_set_id,id);
create unique index if not exists takeoff_measurements_company_set_id_uk on public.takeoff_measurements(company_id,takeoff_set_id,id);

alter table public.plan_scopes
  add constraint plan_scopes_set_parent_fk foreign key(company_id,takeoff_set_id,parent_scope_id) references public.plan_scopes(company_id,takeoff_set_id,id),
  add constraint plan_scopes_set_sheet_fk foreign key(company_id,takeoff_set_id,sheet_id) references public.takeoff_sheets(company_id,takeoff_set_id,id),
  add constraint plan_scopes_set_measurement_fk foreign key(company_id,takeoff_set_id,measurement_id) references public.takeoff_measurements(company_id,takeoff_set_id,id);

alter table public.plan_source_regions
  add constraint plan_source_regions_set_run_fk foreign key(company_id,takeoff_set_id,run_id) references public.plan_intelligence_runs(company_id,takeoff_set_id,id),
  add constraint plan_source_regions_set_sheet_fk foreign key(company_id,takeoff_set_id,sheet_id) references public.takeoff_sheets(company_id,takeoff_set_id,id);

alter table public.plan_facts
  add constraint plan_facts_set_run_fk foreign key(company_id,takeoff_set_id,run_id) references public.plan_intelligence_runs(company_id,takeoff_set_id,id),
  add constraint plan_facts_set_scope_fk foreign key(company_id,takeoff_set_id,scope_id) references public.plan_scopes(company_id,takeoff_set_id,id),
  add constraint plan_facts_set_superseded_fk foreign key(company_id,takeoff_set_id,superseded_by_fact_id) references public.plan_facts(company_id,takeoff_set_id,id);

alter table public.plan_fact_sources
  add constraint plan_fact_sources_set_fact_fk foreign key(company_id,takeoff_set_id,fact_id) references public.plan_facts(company_id,takeoff_set_id,id) on delete cascade,
  add constraint plan_fact_sources_set_region_fk foreign key(company_id,takeoff_set_id,source_region_id) references public.plan_source_regions(company_id,takeoff_set_id,id) on delete cascade;

alter table public.plan_fact_relations
  add constraint plan_fact_relations_set_from_fk foreign key(company_id,takeoff_set_id,from_fact_id) references public.plan_facts(company_id,takeoff_set_id,id) on delete cascade,
  add constraint plan_fact_relations_set_to_fk foreign key(company_id,takeoff_set_id,to_fact_id) references public.plan_facts(company_id,takeoff_set_id,id) on delete cascade,
  add constraint plan_fact_relations_set_run_fk foreign key(company_id,takeoff_set_id,run_id) references public.plan_intelligence_runs(company_id,takeoff_set_id,id);

alter table public.plan_fact_decisions
  add constraint plan_fact_decisions_set_fact_fk foreign key(company_id,takeoff_set_id,fact_id) references public.plan_facts(company_id,takeoff_set_id,id) on delete cascade;

alter table public.takeoff_plan_fact_applications
  add constraint takeoff_plan_fact_applications_set_measurement_fk foreign key(company_id,takeoff_set_id,measurement_id) references public.takeoff_measurements(company_id,takeoff_set_id,id) on delete cascade,
  add constraint takeoff_plan_fact_applications_set_fact_fk foreign key(company_id,takeoff_set_id,fact_id) references public.plan_facts(company_id,takeoff_set_id,id) on delete restrict;
