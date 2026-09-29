import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

test('Opportunity Activity has a scoped authenticated read path',()=>{
  const reconciliation=readFileSync('supabase/migrations/20260924083000_reconcile_proposal_conversion_schema.sql','utf8');
  const grant=readFileSync('supabase/migrations/20260929052400_lead_activities_read_grant.sql','utf8');
  const view=readFileSync('components/opportunities/views/ScopeView.tsx','utf8');
  assert.match(reconciliation,/create policy "company access lead activities" on public\.lead_activities for all to authenticated[\s\S]*?using \(company_id=\(select public\.get_my_company_id\(\)\)/);
  assert.match(grant,/grant select on table public\.lead_activities to authenticated;/i);
  assert.doesNotMatch(grant,/disable row level security|grant all|to anon/i);
  assert.match(view,/from\('lead_activities'\)\.select\('id,activity_type,note,activity_date,created_at'\)\.eq\('lead_id',id\)\.eq\('company_id',companyId\)/);
});
