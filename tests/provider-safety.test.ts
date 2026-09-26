import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {plaidEnvironment,plaidPost} from '../lib/plaid.ts';
import {PROVIDER_MUTATION_DENIED_MESSAGE,providerMutationAllowed} from '../lib/provider-mutation-policy.ts';

type Runtime={NODE_ENV?:string;VERCEL_ENV?:string};
type RouteResponse={status:number;body:Record<string,unknown>};

function loadPost(path:string,runtime:Runtime,dependencies:Record<string,unknown>){
  const source=readFileSync(path,'utf8');
  const javascript=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  const module={exports:{} as {POST:(request?:unknown)=>Promise<RouteResponse>}};
  const mocks:Record<string,unknown>={
    'next/server':{NextResponse:{json:(body:Record<string,unknown>,options?:{status:number})=>({status:options?.status??200,body})}},
    '@/lib/provider-mutation-policy':{providerMutationAllowed:()=>providerMutationAllowed(runtime),PROVIDER_MUTATION_DENIED_MESSAGE},
    'node:crypto':crypto,
    ...dependencies,
  };
  runInNewContext(javascript,{module,exports:module.exports,require:(id:string)=>{
    if(!(id in mocks))throw new Error(`Unexpected import: ${id}`);
    return mocks[id];
  },URL,Date,Buffer},{filename:path});
  return module.exports.POST;
}

const blockedRuntimes:Runtime[]=[
  {NODE_ENV:'development'},
  {NODE_ENV:'production',VERCEL_ENV:'preview'},
  {NODE_ENV:'production',VERCEL_ENV:'staging'},
];

for(const runtime of blockedRuntimes){
  test(`Plaid sync denies ${JSON.stringify(runtime)} before provider or database access`,async()=>{
    let calls=0;
    const touched=()=>{calls++;throw new Error('Provider or database accessed');};
    const post=loadPost('app/api/plaid/sync/route.ts',runtime,{
      '@/lib/supabase/server':{createClient:touched},
      '@/lib/plaid':{plaidConfigured:touched,syncPlaidConnection:touched},
      '@/lib/bank-reconciliation':{analyzeBankTransactions:touched},
    });
    const response=await post();
    assert.equal(response.status,403);
    assert.equal(response.body.error,PROVIDER_MUTATION_DENIED_MESSAGE);
    assert.equal(calls,0);
  });

  test(`Outlook sync denies ${JSON.stringify(runtime)} before provider or database access`,async()=>{
    let calls=0;
    const touched=()=>{calls++;throw new Error('Provider or database accessed');};
    const post=loadPost('app/api/outlook/sync/route.ts',runtime,{
      '@/lib/supabase/server':{createClient:touched},
      '@/lib/outlook':{outlookConfigured:touched,ensureOutlookAccessToken:touched,createOutlookSubscription:touched,renewOutlookSubscription:touched,syncOutlookMailbox:touched},
    });
    const response=await post({url:'http://localhost:3000/api/outlook/sync'});
    assert.equal(response.status,403);
    assert.equal(response.body.error,PROVIDER_MUTATION_DENIED_MESSAGE);
    assert.equal(calls,0);
  });
}

test('production runtime reaches the authorized Plaid and Outlook handlers with stubbed providers',async()=>{
  const runtime={NODE_ENV:'production',VERCEL_ENV:'production'};
  let plaidSyncs=0,outlookSyncs=0;
  const profile={select:()=>({eq:()=>({single:async()=>({data:{company_id:'company',role:'owner'}})})})};
  const plaidConnection={select:()=>({eq:()=>({eq:async()=>({data:[{id:'plaid-connection'}]})})})};
  const outlookConnection={select:()=>({eq:()=>({eq:()=>({maybeSingle:async()=>({data:{id:'outlook-connection',subscription_id:'subscription',subscription_expires_at:new Date(Date.now()+48*60*60*1000).toISOString()}})})})}),update:()=>({eq:()=>({eq:async()=>({error:null})})})};
  const auth={getUser:async()=>({data:{user:{id:'user'}}})};
  const plaidPostRoute=loadPost('app/api/plaid/sync/route.ts',runtime,{
    '@/lib/supabase/server':{createClient:async()=>({auth,from:(table:string)=>table==='profiles'?profile:plaidConnection})},
    '@/lib/plaid':{plaidConfigured:()=>true,syncPlaidConnection:async()=>{plaidSyncs++;return {changed:1};}},
    '@/lib/bank-reconciliation':{analyzeBankTransactions:async()=>({analyzed:0,candidates:0,autoMatched:0,autoApplied:0})},
  });
  const plaid=await plaidPostRoute();
  assert.equal(plaid.status,200);
  assert.equal(plaid.body.changed,1);
  assert.equal(plaidSyncs,1);

  const outlookPostRoute=loadPost('app/api/outlook/sync/route.ts',runtime,{
    '@/lib/supabase/server':{createClient:async()=>({auth,from:(table:string)=>table==='profiles'?profile:outlookConnection})},
    '@/lib/outlook':{outlookConfigured:()=>true,ensureOutlookAccessToken:async()=>'<stub>',createOutlookSubscription:async()=>{throw new Error('Unexpected subscription creation');},renewOutlookSubscription:async()=>{throw new Error('Unexpected renewal');},syncOutlookMailbox:async()=>{outlookSyncs++;return {created:0,candidates:0,ignored:0};}},
  });
  const outlook=await outlookPostRoute({url:'https://carez.example/api/outlook/sync'});
  assert.equal(outlook.status,200);
  assert.equal(outlook.body.ok,true);
  assert.equal(outlookSyncs,1);
});

test('local and preview runtime stay blocked without any QA override',()=>{
  assert.equal(providerMutationAllowed({NODE_ENV:'development',VERCEL_ENV:'production'}),false);
  assert.equal(providerMutationAllowed({NODE_ENV:'production',VERCEL_ENV:'preview'}),false);
  assert.equal(providerMutationAllowed({NODE_ENV:'production'}),false);
  const attemptedOverride={NODE_ENV:'development',VERCEL_ENV:'preview',CAREZ_ALLOW_PROVIDER_MUTATION_QA:'true'};
  assert.equal(providerMutationAllowed(attemptedOverride),false);
  assert.equal(providerMutationAllowed({NODE_ENV:'production',VERCEL_ENV:'production'}),true);
});

test('Plaid environment must be explicit and valid before a provider request',async()=>{
  assert.equal(plaidEnvironment(undefined),null);
  assert.equal(plaidEnvironment('unexpected'),null);
  for(const value of ['sandbox','development','production'])assert.equal(plaidEnvironment(value),value);

  const original={client:process.env.PLAID_CLIENT_ID,secret:process.env.PLAID_SECRET,env:process.env.PLAID_ENV,fetch:globalThis.fetch};
  let requests=0;
  try{
    process.env.PLAID_CLIENT_ID='stub';process.env.PLAID_SECRET='stub';
    globalThis.fetch=(async()=>{requests++;throw new Error('Provider contacted');}) as typeof fetch;
    for(const value of [undefined,'unexpected']){
      if(value===undefined)delete process.env.PLAID_ENV;else process.env.PLAID_ENV=value;
      await assert.rejects(plaidPost('/accounts/get',{}),/PLAID_ENV must be sandbox, development, or production/);
    }
    assert.equal(requests,0);
  }finally{
    if(original.client===undefined)delete process.env.PLAID_CLIENT_ID;else process.env.PLAID_CLIENT_ID=original.client;
    if(original.secret===undefined)delete process.env.PLAID_SECRET;else process.env.PLAID_SECRET=original.secret;
    if(original.env===undefined)delete process.env.PLAID_ENV;else process.env.PLAID_ENV=original.env;
    globalThis.fetch=original.fetch;
  }
});

test('ordinary AppShell navigation mounts no provider sync pulse',()=>{
  const shell=readFileSync('components/AppShell.tsx','utf8');
  assert.doesNotMatch(shell,/BankSyncPulse|OutlookSyncPulse|\/api\/(?:plaid|outlook)\/sync/);
  assert.doesNotMatch(readFileSync('components/PlaidBankControls.tsx','utf8'),/fetch\(['"]\/api\/plaid\/sync/);
});

test('manual provider entry points enforce the shared runtime gate',()=>{
  for(const path of [
    'app/api/plaid/refresh-balance/route.ts','app/api/plaid/link-token/route.ts','app/api/plaid/exchange/route.ts',
    'app/api/outlook/connect/route.ts','app/api/outlook/callback/route.ts','app/api/outlook/webhook/route.ts',
  ]){
    const source=readFileSync(path,'utf8');
    assert.match(source,/providerMutationAllowed\(\)/,`${path} lacks the runtime gate`);
    assert.ok(source.indexOf('if(!providerMutationAllowed())')<source.indexOf('createClient(')||!source.includes('createClient('),`${path} accesses database before the runtime gate`);
  }
  const actions=readFileSync('app/leads/inbox/actions.ts','utf8');
  assert.match(actions,/syncOutlookNow\(\)\{if\(!providerMutationAllowed\(\)\)/);
  assert.match(actions,/disconnectOutlook\(\)\{if\(!providerMutationAllowed\(\)\)/);
});
