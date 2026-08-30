create table public.concrete_rebar_sizes (
  id uuid primary key default gen_random_uuid(),
  bar_number integer not null unique check(bar_number>0),
  designation text not null unique check(designation ~ '^#[0-9]+$'),
  metric_designation integer not null,
  nominal_diameter_in numeric(6,3) not null check(nominal_diameter_in>0),
  nominal_area_in2 numeric(6,2) not null check(nominal_area_in2>0),
  weight_lb_per_ft numeric(7,3) not null check(weight_lb_per_ft>0),
  sort_order integer not null,
  active boolean not null default true,
  source_label text not null,
  source_reference text not null,
  created_at timestamptz not null default now()
);

alter table public.concrete_rebar_sizes enable row level security;
create policy "authenticated users read concrete rebar sizes" on public.concrete_rebar_sizes for select to authenticated using (true);
revoke all on public.concrete_rebar_sizes from anon,authenticated;
grant select on public.concrete_rebar_sizes to authenticated;

insert into public.concrete_rebar_sizes(bar_number,designation,metric_designation,nominal_diameter_in,nominal_area_in2,weight_lb_per_ft,sort_order,source_label,source_reference) values
 (3,'#3',10,.375,.11,.376,3,'ASTM A615/A615M nominal reinforcing-bar table','ASTM A615/A615M Table 1'),
 (4,'#4',13,.500,.20,.668,4,'ASTM A615/A615M nominal reinforcing-bar table','ASTM A615/A615M Table 1'),
 (5,'#5',16,.625,.31,1.043,5,'ASTM A615/A615M nominal reinforcing-bar table','ASTM A615/A615M Table 1'),
 (6,'#6',19,.750,.44,1.502,6,'ASTM A615/A615M nominal reinforcing-bar table','ASTM A615/A615M Table 1'),
 (7,'#7',22,.875,.60,2.044,7,'ASTM A615/A615M nominal reinforcing-bar table','ASTM A615/A615M Table 1'),
 (8,'#8',25,1.000,.79,2.670,8,'ASTM A615/A615M nominal reinforcing-bar table','ASTM A615/A615M Table 1'),
 (9,'#9',29,1.128,1.00,3.400,9,'ASTM A615/A615M nominal reinforcing-bar table','ASTM A615/A615M Table 1'),
 (10,'#10',32,1.270,1.27,4.303,10,'ASTM A615/A615M nominal reinforcing-bar table','ASTM A615/A615M Table 1'),
 (11,'#11',36,1.410,1.56,5.313,11,'ASTM A615/A615M nominal reinforcing-bar table','ASTM A615/A615M Table 1'),
 (14,'#14',43,1.693,2.25,7.650,14,'ASTM A615/A615M nominal reinforcing-bar table','ASTM A615/A615M Table 1'),
 (18,'#18',57,2.257,4.00,13.600,18,'ASTM A615/A615M nominal reinforcing-bar table','ASTM A615/A615M Table 1')
on conflict (bar_number) do update set designation=excluded.designation,metric_designation=excluded.metric_designation,nominal_diameter_in=excluded.nominal_diameter_in,nominal_area_in2=excluded.nominal_area_in2,weight_lb_per_ft=excluded.weight_lb_per_ft,sort_order=excluded.sort_order,source_label=excluded.source_label,source_reference=excluded.source_reference;
