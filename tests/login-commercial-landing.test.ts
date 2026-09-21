import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { loginLandingContent } from '../app/login/loginLandingContent.ts';
import {
  MAX_ACTIVE_DRAFTS,
  buildStructuralDrafts,
  sampleDraftFrame,
} from '../app/login/structuralDraftingScene.ts';

test('commercial landing content sends concrete contractors to the requested destinations', () => {
  assert.equal(loginLandingContent.headline, 'The Operating System for Concrete Contractors.');
  assert.equal(
    loginLandingContent.subheadline,
    'Automate PDF takeoffs, calculate multi-phase estimates, track live mud delivery yield, and digitize field pour logs on one unified platform.',
  );
  assert.deepEqual(loginLandingContent.ctas, [
    { label: 'Book a Concrete Demo', href: '/demo', emphasis: 'primary' },
    { label: 'Explore Yield Estimator', href: '/estimating-sandbox', emphasis: 'secondary' },
  ]);
  assert.deepEqual(loginLandingContent.categories, [
    'PDF Takeoffs',
    'Mix Estimating',
    'Pour Logs',
    'Yield Analytics',
  ]);
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


test('landing locks the marketing and login columns to a centered structural axis with a full-width capability rail', () => {
  const page = readFileSync('app/login/page.tsx', 'utf8');
  const css = readFileSync('app/globals.css', 'utf8');

  assert.match(page, /className="carez-login-intro lg:border-r border-neutral-900"/);
  assert.match(page, /className="carez-login-capabilities border-t border-neutral-900 pt-4"/);
  assert.match(css, /\.carez-login \{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /\.carez-login-capabilities \{[^}]*grid-column:1\/-1/);

  const formRule = css.match(/\.carez-login-form \{[^}]*\}/)?.[0] || '';
  assert.doesNotMatch(formRule, /border-left:/);
});
