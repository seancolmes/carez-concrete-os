import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('Assembly Setup and Tracing keep exclusive workspace surfaces', () => {
  const workspace = readFileSync('components/takeoff/IntegratedTakeoffConditionWorkspace.tsx', 'utf8');
  const css = readFileSync('components/takeoff/IntegratedTakeoffConditionWorkspace.module.css', 'utf8');

  assert.match(workspace, /<section className=\{styles\.setupPanel\} hidden=\{phase!=='assembly'\}/);
  assert.match(workspace, /data-phase-active=\{phase==='tracing'\?'true':'false'\}/);
  assert.match(workspace, /Edit Conditions/);
  assert.match(css, /\.commandDrawer\{/);
  assert.match(css, /\.drawingHost\[data-phase-active="false"\]\{[^}]*visibility:hidden/);
  assert.match(css, /\.setupPanel\[hidden\],\.recapPanel\[hidden\]\{display:none\}/);
});

test('Condition Properties separates physical and commercial inputs with inline numeric validation', () => {
  const workspace = readFileSync('components/takeoff/IntegratedTakeoffConditionWorkspace.tsx', 'utf8');
  const css = readFileSync('components/takeoff/IntegratedTakeoffConditionWorkspace.module.css', 'utf8');
  const direction = readFileSync('components/takeoff/ConditionPropertiesDirectionA.module.css', 'utf8');

  const sections=['Dimensions','Reinforcement','Forms','Pour method','Labor'];
  const positions=sections.map(section=>workspace.indexOf(`<strong>${section}</strong>`));
  assert.ok(positions.every(position=>position>=0));
  assert.ok(positions.every((position,index)=>index===0||position>positions[index-1]));
  assert.doesNotMatch(workspace, /<strong>Scope<\/strong>|<strong>Drawing<\/strong>|<strong>More<\/strong>/);
  assert.match(workspace, /ref=\{propertyScrollRef\} className=\{`\$\{styles\.inspectorGrid\} \$\{styles\.editorGridViewport\}`\}/);
  assert.equal(workspace.match(/className=\{`\$\{styles\.inspectorScroll\} \$\{styles\.columnScroll\}`\}/g)?.length, 2);
  assert.match(workspace, /ariaInvalid=\{invalidNumber\}/);
  assert.match(workspace, /aria-labelledby="physical-variables"/);
  assert.match(workspace, /aria-labelledby="commercial-variables"/);
  assert.match(workspace, /error=\{validationText\}/);
  assert.match(css, /\.setupEditor\{[^}]*overflow:hidden/);
  assert.match(css, /\.columnScroll\{[^}]*overflow-y:auto/);
  assert.match(css, /\.propertySection\{margin:0;border-bottom:1px solid var\(--pt-line-soft\)/);
  assert.match(direction, /\.inlineValidation\{/);
});

test('sign in uses Pourtrace identity and does not render the legacy Carez Concrete logo', () => {
  const form = readFileSync('components/auth/LoginForm.tsx', 'utf8');
  const page = readFileSync('app/login/page.tsx', 'utf8');

  assert.equal(form.includes('carez-wordmark.png'), false);
  assert.equal(form.includes("from 'next/image'"), false);
  assert.match(form, /Get back to the job\./);
  assert.match(form, /Show password/);
  assert.match(page, /<AnimatedLogo idPrefix="login-navigation"\/>/);
  assert.match(page, /aria-label="Pourtrace home"/);
  assert.equal(page.includes('CAREZ / CONCRETE OPERATIONS'), false);
});
