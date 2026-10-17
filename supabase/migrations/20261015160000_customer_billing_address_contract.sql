-- Additive compatibility for environments where customer bill-to columns already exist.
-- Never infer customer addresses from job sites or change existing invoice snapshots.
alter table public.customers
  add column if not exists billing_address_line1 text,
  add column if not exists billing_address_line2 text,
  add column if not exists billing_city text,
  add column if not exists billing_state text,
  add column if not exists billing_postal_code text,
  add column if not exists billing_profile_revision integer not null default 0;

do $$
declare k text;
begin
  foreach k in array array['billing_address_line1','billing_address_line2','billing_city','billing_state','billing_postal_code'] loop
    if not exists(select 1 from information_schema.columns where table_schema='public'
      and table_name='customers' and column_name=k and data_type='text' and is_nullable='YES') then
      raise exception 'Customer billing column % has an incompatible definition; inspect before applying.',k;
    end if;
  end loop;
end $$;

create or replace function public.carez_customer_billing_revision()
returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin
  if row(new.contact_name,new.email,new.phone,new.billing_terms,new.billing_address_line1,new.billing_address_line2,new.billing_city,new.billing_state,new.billing_postal_code)
    is distinct from row(old.contact_name,old.email,old.phone,old.billing_terms,old.billing_address_line1,old.billing_address_line2,old.billing_city,old.billing_state,old.billing_postal_code) then
    new.billing_profile_revision:=old.billing_profile_revision+1;
  else new.billing_profile_revision:=old.billing_profile_revision;
  end if;
  return new;
end $$;
revoke all on function public.carez_customer_billing_revision() from public,anon,authenticated;
create trigger carez_customer_billing_revision before update on public.customers
for each row execute function public.carez_customer_billing_revision();

comment on column public.customers.billing_profile_revision is 'Optimistic concurrency for loaded contact/terms/bill-to edits; existing invoice snapshots are independent.';
