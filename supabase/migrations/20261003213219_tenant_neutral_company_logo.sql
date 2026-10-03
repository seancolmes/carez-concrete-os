-- Company logos belong to each contractor. A new tenant must not inherit the
-- former Carez brand in its billing profile or customer-facing documents.
alter table public.company_billing_profiles
  alter column logo_path drop default,
  alter column logo_path drop not null;

update public.company_billing_profiles
set logo_path = null
where logo_path = '/brand/carez-wordmark.png';
