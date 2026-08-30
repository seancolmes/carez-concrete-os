drop policy if exists "office create plan intelligence runs" on public.plan_intelligence_runs;
drop policy if exists "office update plan intelligence runs" on public.plan_intelligence_runs;
drop policy if exists "office create plan scopes" on public.plan_scopes;
drop policy if exists "office update plan scopes" on public.plan_scopes;

create policy "office create plan intelligence runs" on public.plan_intelligence_runs
for insert to authenticated
with check (company_id=(select public.get_my_company_id()) and (select public.get_my_role())<>'employee');

create policy "office update plan intelligence runs" on public.plan_intelligence_runs
for update to authenticated
using (company_id=(select public.get_my_company_id()) and (select public.get_my_role())<>'employee')
with check (company_id=(select public.get_my_company_id()) and (select public.get_my_role())<>'employee');

create policy "office create plan scopes" on public.plan_scopes
for insert to authenticated
with check (company_id=(select public.get_my_company_id()) and (select public.get_my_role())<>'employee');

create policy "office update plan scopes" on public.plan_scopes
for update to authenticated
using (company_id=(select public.get_my_company_id()) and (select public.get_my_role())<>'employee')
with check (company_id=(select public.get_my_company_id()) and (select public.get_my_role())<>'employee');
