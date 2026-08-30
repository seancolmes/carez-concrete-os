create unique index if not exists takeoff_sets_company_id_id_uk on public.takeoff_sets(company_id,id);
create unique index if not exists company_documents_company_id_id_uk on public.company_documents(company_id,id);
create unique index if not exists takeoff_sheets_company_id_id_uk on public.takeoff_sheets(company_id,id);
create unique index if not exists takeoff_measurements_company_id_id_uk on public.takeoff_measurements(company_id,id);
create unique index if not exists plan_intelligence_runs_company_id_id_uk on public.plan_intelligence_runs(company_id,id);
create unique index if not exists plan_scopes_company_id_id_uk on public.plan_scopes(company_id,id);
create unique index if not exists plan_source_regions_company_id_id_uk on public.plan_source_regions(company_id,id);
create unique index if not exists plan_facts_company_id_id_uk on public.plan_facts(company_id,id);
create unique index if not exists plan_fact_decisions_company_id_id_uk on public.plan_fact_decisions(company_id,id);

alter table public.plan_intelligence_runs
  add constraint plan_intelligence_runs_company_set_fk foreign key(company_id,takeoff_set_id) references public.takeoff_sets(company_id,id) on delete cascade,
  add constraint plan_intelligence_runs_company_document_fk foreign key(company_id,source_document_id) references public.company_documents(company_id,id) on delete restrict;

alter table public.plan_scopes
  add constraint plan_scopes_company_set_fk foreign key(company_id,takeoff_set_id) references public.takeoff_sets(company_id,id) on delete cascade,
  add constraint plan_scopes_company_parent_fk foreign key(company_id,parent_scope_id) references public.plan_scopes(company_id,id) on delete set null,
  add constraint plan_scopes_company_sheet_fk foreign key(company_id,sheet_id) references public.takeoff_sheets(company_id,id) on delete set null,
  add constraint plan_scopes_company_measurement_fk foreign key(company_id,measurement_id) references public.takeoff_measurements(company_id,id) on delete set null;

alter table public.plan_source_regions
  add constraint plan_source_regions_company_run_fk foreign key(company_id,run_id) references public.plan_intelligence_runs(company_id,id) on delete cascade,
  add constraint plan_source_regions_company_set_fk foreign key(company_id,takeoff_set_id) references public.takeoff_sets(company_id,id) on delete cascade,
  add constraint plan_source_regions_company_sheet_fk foreign key(company_id,sheet_id) references public.takeoff_sheets(company_id,id) on delete set null;

alter table public.plan_facts
  add constraint plan_facts_company_run_fk foreign key(company_id,run_id) references public.plan_intelligence_runs(company_id,id) on delete cascade,
  add constraint plan_facts_company_set_fk foreign key(company_id,takeoff_set_id) references public.takeoff_sets(company_id,id) on delete cascade,
  add constraint plan_facts_company_scope_fk foreign key(company_id,scope_id) references public.plan_scopes(company_id,id) on delete set null,
  add constraint plan_facts_company_superseded_fk foreign key(company_id,superseded_by_fact_id) references public.plan_facts(company_id,id) on delete set null;

alter table public.plan_fact_sources
  add constraint plan_fact_sources_company_fact_fk foreign key(company_id,fact_id) references public.plan_facts(company_id,id) on delete cascade,
  add constraint plan_fact_sources_company_region_fk foreign key(company_id,source_region_id) references public.plan_source_regions(company_id,id) on delete cascade;

alter table public.plan_fact_relations
  add constraint plan_fact_relations_company_from_fk foreign key(company_id,from_fact_id) references public.plan_facts(company_id,id) on delete cascade,
  add constraint plan_fact_relations_company_to_fk foreign key(company_id,to_fact_id) references public.plan_facts(company_id,id) on delete cascade,
  add constraint plan_fact_relations_company_run_fk foreign key(company_id,run_id) references public.plan_intelligence_runs(company_id,id) on delete set null;

alter table public.plan_fact_decisions
  add constraint plan_fact_decisions_company_fact_fk foreign key(company_id,fact_id) references public.plan_facts(company_id,id) on delete cascade;

alter table public.takeoff_plan_fact_applications
  add constraint takeoff_plan_fact_applications_company_measurement_fk foreign key(company_id,measurement_id) references public.takeoff_measurements(company_id,id) on delete cascade,
  add constraint takeoff_plan_fact_applications_company_fact_fk foreign key(company_id,fact_id) references public.plan_facts(company_id,id) on delete restrict,
  add constraint takeoff_plan_fact_applications_company_decision_fk foreign key(company_id,decision_id) references public.plan_fact_decisions(company_id,id) on delete set null;
