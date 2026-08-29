-- Correct trigger return semantics for DELETE while keeping published assembly snapshots immutable.

create or replace function public.carez_guard_published_assembly_version()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'published' then
      raise exception 'Published assembly versions are immutable. Create a new version.';
    end if;
    return old;
  end if;

  if old.status = 'published' then
    raise exception 'Published assembly versions are immutable. Create a new version.';
  end if;

  if new.status = 'published' and new.published_at is null then
    new.published_at = now();
  end if;
  return new;
end;
$$;

revoke all on function public.carez_guard_published_assembly_version() from public, anon, authenticated;

create or replace function public.carez_guard_published_assembly_child()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_id uuid;
  v_status text;
begin
  if tg_op = 'DELETE' then
    v_id := old.assembly_version_id;
  else
    v_id := new.assembly_version_id;
  end if;

  select status into v_status
  from public.concrete_assembly_versions
  where id = v_id;

  if v_status = 'published' then
    raise exception 'Published assembly components and variables are immutable. Create a new assembly version.';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.carez_guard_published_assembly_child() from public, anon, authenticated;
