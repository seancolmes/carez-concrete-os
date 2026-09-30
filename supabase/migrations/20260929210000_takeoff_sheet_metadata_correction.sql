-- Sheet labels may be corrected by an authenticated Takeoff editor on an active, unissued revision.
-- Keep PDF page identity stable and record every actual label change in the same transaction.
create table public.takeoff_sheet_metadata_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  takeoff_set_id uuid not null,
  sheet_id uuid not null,
  page_number integer not null,
  old_sheet_number text,
  new_sheet_number text,
  old_title text,
  new_title text,
  actor_id uuid not null,
  occurred_at timestamptz not null default now(),
  check (old_sheet_number is distinct from new_sheet_number or old_title is distinct from new_title)
);
create index takeoff_sheet_metadata_events_sheet_idx
  on public.takeoff_sheet_metadata_events(company_id, takeoff_set_id, sheet_id, occurred_at);

alter table public.takeoff_sheet_metadata_events enable row level security;
create policy takeoff_sheet_metadata_events_read on public.takeoff_sheet_metadata_events
  for select to authenticated
  using (company_id = public.get_my_company_id());
revoke all on public.takeoff_sheet_metadata_events from public, anon, authenticated;
grant select on public.takeoff_sheet_metadata_events to authenticated;

create function public.carez_guard_takeoff_sheet_metadata()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_set_status text;
  v_estimate_status text;
  v_estimate_id uuid;
begin
  if new.id is distinct from old.id
    or new.company_id is distinct from old.company_id
    or new.takeoff_set_id is distinct from old.takeoff_set_id
    or new.page_number is distinct from old.page_number then
    raise exception 'Drawing sheet page identity cannot be changed.';
  end if;

  if new.sheet_number is not distinct from old.sheet_number
    and new.title is not distinct from old.title then
    return new;
  end if;

  if auth.uid() is null
    or new.company_id is distinct from public.get_my_company_id()
    or public.get_my_role() = 'employee' then
    raise exception 'Takeoff editing authority required to change a sheet label.';
  end if;
  if (new.sheet_number is not null and
      (length(btrim(new.sheet_number)) = 0 or length(new.sheet_number) > 80 or new.sheet_number <> btrim(new.sheet_number)))
    or (new.title is not null and
      (length(btrim(new.title)) = 0 or length(new.title) > 180 or new.title <> btrim(new.title))) then
    raise exception 'Sheet number or title is invalid.';
  end if;

  select ts.status, ts.estimate_id, e.status
    into v_set_status, v_estimate_id, v_estimate_status
    from public.takeoff_sets ts
    join public.estimates e on e.id = ts.estimate_id and e.company_id = ts.company_id
    where ts.id = new.takeoff_set_id and ts.company_id = new.company_id
    for update of ts, e;
  if not found or v_set_status <> 'active' or v_estimate_status in ('accepted', 'approved', 'superseded') then
    raise exception 'This takeoff revision is locked.';
  end if;
  if exists (
    select 1 from public.proposal_presentations p
    where p.company_id = new.company_id and p.estimate_id = v_estimate_id
  ) then
    raise exception 'This estimate revision was already issued.';
  end if;
  return new;
end
$$;
create trigger carez_guard_takeoff_sheet_metadata
  before update on public.takeoff_sheets for each row
  execute function public.carez_guard_takeoff_sheet_metadata();

create function public.carez_audit_takeoff_sheet_metadata()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if new.sheet_number is distinct from old.sheet_number or new.title is distinct from old.title then
    insert into public.takeoff_sheet_metadata_events (
      company_id, takeoff_set_id, sheet_id, page_number,
      old_sheet_number, new_sheet_number, old_title, new_title, actor_id
    ) values (
      new.company_id, new.takeoff_set_id, new.id, new.page_number,
      old.sheet_number, new.sheet_number, old.title, new.title, auth.uid()
    );
  end if;
  return new;
end
$$;
create trigger carez_audit_takeoff_sheet_metadata
  after update of sheet_number, title on public.takeoff_sheets for each row
  execute function public.carez_audit_takeoff_sheet_metadata();

create function public.carez_immutable_takeoff_sheet_metadata_event()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  raise exception 'Sheet metadata history is append-only.';
end
$$;
create trigger carez_immutable_takeoff_sheet_metadata_event
  before update or delete on public.takeoff_sheet_metadata_events for each row
  execute function public.carez_immutable_takeoff_sheet_metadata_event();

-- The UI calls this RPC so it fails closed until this migration is installed.
-- The guard and audit triggers also protect direct table updates and automatic naming.
create function public.carez_correct_takeoff_sheet_metadata(
  p_takeoff_set_id uuid,
  p_sheet_id uuid,
  p_page_number integer,
  p_expected_updated_at timestamptz,
  p_sheet_number text,
  p_title text
) returns void language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if auth.uid() is null or public.get_my_company_id() is null
    or public.get_my_role() = 'employee' then
    raise exception 'Takeoff editing authority required to change a sheet label.';
  end if;
  if p_takeoff_set_id is null or p_sheet_id is null or p_page_number is null
    or p_expected_updated_at is null then
    raise exception 'A selected drawing sheet and version are required.';
  end if;

  update public.takeoff_sheets s
    set sheet_number = nullif(btrim(p_sheet_number), ''),
        title = nullif(btrim(p_title), '')
    where s.id = p_sheet_id
      and s.company_id = public.get_my_company_id()
      and s.takeoff_set_id = p_takeoff_set_id
      and s.page_number = p_page_number
      and s.updated_at = p_expected_updated_at
      and (s.sheet_number is distinct from nullif(btrim(p_sheet_number), '')
        or s.title is distinct from nullif(btrim(p_title), ''));
  if not found then
    raise exception 'Sheet changed or was not found. Refresh and try again.';
  end if;
end
$$;

revoke all on function public.carez_guard_takeoff_sheet_metadata(),
  public.carez_audit_takeoff_sheet_metadata(),
  public.carez_immutable_takeoff_sheet_metadata_event() from public, anon, authenticated;
revoke all on function public.carez_correct_takeoff_sheet_metadata(uuid, uuid, integer, timestamptz, text, text)
  from public, anon, authenticated;
grant execute on function public.carez_correct_takeoff_sheet_metadata(uuid, uuid, integer, timestamptz, text, text)
  to authenticated;
