create table pour_records (
  id uuid primary key,
  company_id uuid not null,
  placed_cy numeric not null
);

alter table pour_records enable row level security;

create policy pour_records_company_select
on pour_records
for select
using (company_id = current_setting('app.company_id')::uuid);
