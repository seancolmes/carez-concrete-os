-- Trigger helpers are invoked by PostgreSQL, never directly by app roles.
revoke execute on function public.carez_validate_supplier_quote_access_item()
  from public, anon, authenticated;
