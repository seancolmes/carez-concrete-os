import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

function check(environment:string,branch:string,url:string){
  return spawnSync(process.execPath,['scripts/check-preview-environment.mjs'],{
    env:{...process.env,VERCEL_ENV:environment,VERCEL_GIT_COMMIT_REF:branch,NEXT_PUBLIC_SUPABASE_URL:url},
    encoding:'utf8',
  });
}

test('rewrite preview rejects a production or missing database binding',()=>{
  assert.equal(check('preview','astra/complete-ui-rewrite','https://snbnwgetfuvkjkhfxmmz.supabase.co').status,1);
  assert.equal(check('preview','astra/complete-ui-rewrite','').status,1);
});

test('rewrite preview accepts QA without changing other deployment environments',()=>{
  assert.equal(check('preview','astra/complete-ui-rewrite','https://tkcirsdfvvahwrcratkn.supabase.co').status,0);
  assert.equal(check('preview','staging','https://example.supabase.co').status,0);
  assert.equal(check('production','main','https://example.supabase.co').status,0);
});
