begin;
create extension if not exists pgtap with schema extensions;
insert into public.companies(id,name)
values ('a1111111-1111-4111-8111-111111111111','Trigger ACL fixture');
insert into public.job_spines(id,company_id,name,updated_at)
values ('a2222222-2222-4222-8222-222222222222','a1111111-1111-4111-8111-111111111111','ACL fixture spine','2000-01-01 00:00:00+00');

select extensions.plan(12);
select extensions.ok(not has_function_privilege('anon','public.snapshot_purchase_order_branding()','execute'),'anon cannot directly execute purchase-order branding snapshot helper');
select extensions.ok(not has_function_privilege('authenticated','public.snapshot_purchase_order_branding()','execute'),'authenticated cannot directly execute purchase-order branding snapshot helper');
select extensions.ok(not has_function_privilege('anon','public.sync_project_award_record()','execute'),'anon cannot directly execute project award sync helper');
select extensions.ok(not has_function_privilege('authenticated','public.sync_project_award_record()','execute'),'authenticated cannot directly execute project award sync helper');
select extensions.ok(has_function_privilege('anon','public.get_public_proposal(uuid)','execute'),'anon retains the public Proposal retrieval RPC');
select extensions.ok(has_function_privilege('anon','public.track_public_proposal_view(uuid)','execute'),'anon retains the public Proposal view-tracking RPC');
select extensions.ok(has_function_privilege('anon','public.submit_public_proposal_response(uuid,text,text,text,text,text,uuid)','execute'),'anon retains the public Proposal response RPC');
select extensions.ok(has_function_privilege('authenticated','public.get_public_proposal(uuid)','execute'),'authenticated retains the public Proposal retrieval RPC');
select extensions.ok(has_function_privilege('authenticated','public.track_public_proposal_view(uuid)','execute'),'authenticated retains the public Proposal view-tracking RPC');
select extensions.ok(has_function_privilege('authenticated','public.submit_public_proposal_response(uuid,text,text,text,text,text,uuid)','execute'),'authenticated retains the public Proposal response RPC');
select extensions.ok(exists(select 1 from pg_trigger where tgname='sync_project_award_record_after_insert' and tgfoid='public.sync_project_award_record()'::regprocedure),'award-record trigger remains installed');

do $$
declare v_before timestamptz;
begin
  select updated_at into v_before from public.job_spines where id='a2222222-2222-4222-8222-222222222222';
  perform pg_sleep(0.01);
  update public.job_spines set name='ACL fixture spine updated' where id='a2222222-2222-4222-8222-222222222222';
  if (select updated_at from public.job_spines where id='a2222222-2222-4222-8222-222222222222') <= v_before then
    raise exception 'revoking direct helper EXECUTE disabled normal set_updated_at trigger behavior';
  end if;
end
$$;
select extensions.ok((select updated_at>'2000-01-01 00:00:00+00' from public.job_spines where id='a2222222-2222-4222-8222-222222222222'),'normal trigger execution remains functional after ACL hardening');
select * from extensions.finish();
rollback;
