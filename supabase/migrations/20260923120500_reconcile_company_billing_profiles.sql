-- Reconcile the recovered company billing profile contract before Estimate readiness.
-- Existing compatible production data and grants are preserved.

create table if not exists public.company_billing_profiles (
  company_id uuid primary key references public.companies(id) on delete cascade,
  display_name text not null,
  legal_name text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  phone text,
  email text,
  website text,
  ubi_number text,
  contractor_license_number text,
  logo_path text not null default '/brand/carez-wordmark.png',
  payment_instructions text,
  invoice_footer text,
  default_terms_text text,
  default_due_days integer not null default 0 check (default_due_days >= 0),
  updated_at timestamptz not null default now()
);

do $$
declare
  v_company_id_att smallint;
  v_companies_id_att smallint;
begin
  if exists (
    select 1
    from (values
      ('company_id','uuid','NO'),
      ('display_name','text','NO'),
      ('legal_name','text','YES'),
      ('address_line1','text','YES'),
      ('address_line2','text','YES'),
      ('city','text','YES'),
      ('state','text','YES'),
      ('postal_code','text','YES'),
      ('phone','text','YES'),
      ('email','text','YES'),
      ('website','text','YES'),
      ('ubi_number','text','YES'),
      ('contractor_license_number','text','YES'),
      ('logo_path','text','NO'),
      ('payment_instructions','text','YES'),
      ('invoice_footer','text','YES'),
      ('default_terms_text','text','YES'),
      ('default_due_days','int4','NO'),
      ('updated_at','timestamptz','NO')
    ) expected(column_name,udt_name,is_nullable)
    left join information_schema.columns actual
      on actual.table_schema='public'
     and actual.table_name='company_billing_profiles'
     and actual.column_name=expected.column_name
    where actual.column_name is null
       or actual.udt_name<>expected.udt_name
       or actual.is_nullable<>expected.is_nullable
  ) then
    raise exception 'public.company_billing_profiles has an incompatible column contract.';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='company_billing_profiles'
      and column_name='logo_path'
      and regexp_replace(lower(coalesce(column_default,'')),'[[:space:]()]','','g')
          <>'''/brand/carez-wordmark.png''::text'
  ) or exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='company_billing_profiles'
      and column_name='default_due_days'
      and coalesce(column_default,'')<>'0'
  ) or exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='company_billing_profiles'
      and column_name='updated_at'
      and regexp_replace(lower(coalesce(column_default,'')),'[[:space:]()]','','g')<>'now'
  ) or exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='company_billing_profiles'
      and column_default is not null
      and column_name not in ('logo_path','default_due_days','updated_at')
  ) or (
    select count(*)
    from information_schema.columns
    where table_schema='public'
      and table_name='company_billing_profiles'
  )<>19 then
    raise exception 'public.company_billing_profiles has an incompatible column shape or default.';
  end if;

  select attnum into v_company_id_att
  from pg_attribute
  where attrelid='public.company_billing_profiles'::regclass
    and attname='company_id'
    and not attisdropped;

  select attnum into v_companies_id_att
  from pg_attribute
  where attrelid='public.companies'::regclass
    and attname='id'
    and not attisdropped;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.company_billing_profiles'::regclass
      and contype='p'
      and conkey=array[v_company_id_att]::smallint[]
  ) then
    raise exception 'public.company_billing_profiles must have company_id as its primary key.';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.company_billing_profiles'::regclass
      and contype='f'
      and conkey=array[v_company_id_att]::smallint[]
      and confrelid='public.companies'::regclass
      and confkey=array[v_companies_id_att]::smallint[]
      and confdeltype='c'
      and convalidated
  ) then
    raise exception 'public.company_billing_profiles must reference companies(id) with ON DELETE CASCADE.';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.company_billing_profiles'::regclass
      and contype='c'
      and regexp_replace(lower(pg_get_constraintdef(oid)),'[[:space:]()]','','g')
          ='checkdefault_due_days>=0'
      and convalidated
  ) then
    raise exception 'public.company_billing_profiles must enforce default_due_days >= 0.';
  end if;
end;
$$;

alter table public.company_billing_profiles enable row level security;

do $$
declare
  v_policy record;
  v_using_expression text;
  v_check_expression text;
begin
  select * into v_policy
  from pg_policy
  where polrelid='public.company_billing_profiles'::regclass
    and polname='company access billing profile';

  if not found then
    create policy "company access billing profile"
      on public.company_billing_profiles
      for all to authenticated
      using (company_id=public.get_my_company_id())
      with check (company_id=public.get_my_company_id());
  else
    v_using_expression:=regexp_replace(
      replace(lower(pg_get_expr(v_policy.polqual,v_policy.polrelid)),'public.',''),
      '[[:space:]()]','','g'
    );
    v_check_expression:=regexp_replace(
      replace(lower(pg_get_expr(v_policy.polwithcheck,v_policy.polrelid)),'public.',''),
      '[[:space:]()]','','g'
    );
    if v_policy.polcmd<>'*'
       or v_using_expression<>'company_id=get_my_company_id'
       or v_check_expression<>'company_id=get_my_company_id' then
      raise exception 'Policy "company access billing profile" has an incompatible tenant contract.';
    end if;
  end if;
end;
$$;

grant select,insert,update,delete on public.company_billing_profiles to authenticated;
grant all on public.company_billing_profiles to service_role;
