import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  MAX_ACTIVE_DRAFTS,
  buildStructuralDrafts,
  sampleDraftFrame,
} from '../app/login/structuralDraftingScene.ts';

test('public landing page connects product story to working sign-in', () => {
  const page = readFileSync('app/login/page.tsx', 'utf8');
  assert.match(page, /From the drawing to the/);
  assert.match(page, /id="workflow"/);
  assert.match(page, /id="capabilities"/);
  assert.match(page, /id="workspace-access"/);
  assert.match(page, /<WorkspaceLoginDialog open=\{loginOpen\}/);
  assert.match(page, /Sign in to your workspace/);
  assert.match(page, /onClick=\{\(\)=>setLoginOpen\(true\)\}/);
  assert.doesNotMatch(page, /href="\/(demo|estimating-sandbox)"/);
});

test('structural drafting scene includes the specified concrete plan language', () => {
  const drafts = buildStructuralDrafts(1440, 900);

  assert.ok(drafts.some((draft) => draft.kind === 'slab'));
  assert.ok(drafts.some((draft) => draft.kind === 'rebar'));
  assert.ok(drafts.some((draft) => draft.kind === 'crosshair'));
  assert.deepEqual(
    drafts.filter((draft) => draft.label).map((draft) => draft.label),
    ['#4 Rebar @ 12" O.C.', "T.O.F. El. 102.4'", 'Grid Line B-4'],
  );
});

test('structural drafting animation keeps a bounded number of visible drafts', () => {
  const drafts = buildStructuralDrafts(1440, 900);

  for (let elapsed = 0; elapsed <= 30_000; elapsed += 125) {
    const frame = sampleDraftFrame(drafts, elapsed);
    assert.ok(frame.length <= MAX_ACTIVE_DRAFTS);
    assert.ok(frame.every(({ progress, opacity }) => progress >= 0 && progress <= 1 && opacity >= 0 && opacity <= 1));
  }
});

test('login preserves real Supabase sign-in on the new landing page', () => {
  const page = readFileSync('app/login/page.tsx', 'utf8');
  const loginForm = readFileSync('components/auth/LoginForm.tsx', 'utf8');
  const loginAction = readFileSync('app/login/actions.ts', 'utf8');
  const handoff = readFileSync('components/brand/GatewayTransitionProvider.tsx', 'utf8');
  assert.match(page, /className=\{styles\.page\}/);
  assert.match(page, /<LoginForm\s*\/>/);
  assert.match(loginAction, /supabase\.auth\.signInWithPassword\(\{email,password\}\)/);
  assert.match(loginForm, /signInToWorkspace\(email,password\)/);
  assert.match(loginForm, /if\(result\.error\)/);
  assert.match(loginForm, /fetch\('\/api\/auth\/workspace-readiness'/);
  assert.match(loginForm, /begin\(result\.destination\|\|'\/'\)/);
  assert.match(handoff, /<SplashScreen key="workspace-handoff" kind="handoff"/);
  assert.match(handoff, /router\.push\(destination\)/);
  assert.doesNotMatch(handoff, /router\.push\('\/overview'\)/);
});

test('Pourtrace login contains no demo-only auth claims or inline remote font imports', () => {
  const page = readFileSync('app/login/page.tsx', 'utf8');
  const globalStyles = readFileSync('app/globals.css', 'utf8');

  assert.doesNotMatch(page, /256-bit|SSL|@import\s+url\(/i);
  assert.doesNotMatch(globalStyles, /@import\s+url\(/i);
});
