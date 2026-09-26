import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import test from 'node:test';

const migrationPath='supabase/migrations/20260926230000_trigger_function_acl_hardening.sql';
const gatePath='scripts/carez-release-gate.ts';

test('trigger helper ACL hardening migration is additive and protects the confirmed helpers',()=>{
  assert.equal(existsSync(migrationPath),true,'the ACL hardening migration must exist');
  const sql=readFileSync(migrationPath,'utf8');
  assert.match(sql,/snapshot_purchase_order_branding/i);
  assert.match(sql,/sync_project_award_record/i);
  assert.match(sql,/revoke execute/i);
  assert.match(sql,/public,\s*anon,\s*authenticated/i);
  assert.doesNotMatch(sql,/drop\s+(?:table|function|trigger)/i);
});

test('release gate audits trigger helpers with a narrow external RPC allowlist',()=>{
  const source=readFileSync(gatePath,'utf8');
  assert.match(source,/has_function_privilege\(['"]anon['"]/i);
  assert.match(source,/has_function_privilege\(['"]authenticated['"]/i);
  for(const api of ['get_public_proposal','submit_public_proposal_response','track_public_proposal_view']){
    assert.match(source,new RegExp(api));
  }
  assert.match(source,/pg_trigger/i);
  assert.match(source,/trigger-function ACL/i);
});
