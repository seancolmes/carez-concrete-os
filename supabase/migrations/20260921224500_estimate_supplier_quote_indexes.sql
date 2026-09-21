-- P1.2 follow-up: covering index for the supplier quote line Takeoff-output foreign key.

create index if not exists estimate_supplier_quote_lines_source_output_fk_idx
  on public.estimate_supplier_quote_lines(source_takeoff_output_id);
