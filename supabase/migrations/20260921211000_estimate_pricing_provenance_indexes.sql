-- P1.1 pricing provenance: cover override actor foreign keys.
create index if not exists takeoff_outputs_price_override_by_idx
  on public.takeoff_measurement_outputs(price_override_by)
  where price_override_by is not null;

create index if not exists estimate_items_price_override_by_idx
  on public.estimate_items(price_override_by)
  where price_override_by is not null;
