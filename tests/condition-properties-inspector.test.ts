import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('Condition Properties uses a persistent, keyboard-accessible resizable inspector', () => {
  const workspace = readFileSync('components/takeoff/IntegratedTakeoffConditionWorkspace.tsx', 'utf8');
  const css = readFileSync('components/takeoff/IntegratedTakeoffConditionWorkspace.module.css', 'utf8');

  assert.match(workspace, /carez\.takeoff\.condition-properties-width/);
  assert.match(workspace, /role="separator"/);
  assert.match(workspace, /aria-valuemin=\{340\}/);
  assert.match(workspace, /aria-valuemax=\{560\}/);
  assert.match(workspace, /ArrowLeft/);
  assert.match(workspace, /ArrowRight/);
  assert.match(css, /\.propertiesResizer\{/);
  assert.match(css, /--condition-properties-width/);
});

test('Condition Properties uses technical indexed tabs and inline numeric validation', () => {
  const workspace = readFileSync('components/takeoff/IntegratedTakeoffConditionWorkspace.tsx', 'utf8');
  const css = readFileSync('components/takeoff/IntegratedTakeoffConditionWorkspace.module.css', 'utf8');
  const direction = readFileSync('components/takeoff/ConditionPropertiesDirectionA.module.css', 'utf8');

  assert.match(workspace, /padStart\(2,'0'\)/);
  assert.match(workspace, /className=\{styles\.tabIndex\}/);
  assert.match(workspace, /ariaInvalid=\{invalidNumber\}/);
  assert.match(workspace, /className=\{direction\.inlineValidation\}/);
  assert.match(css, /\.propertySection\{margin:0;overflow:visible;border:0/);
  assert.match(direction, /\.inlineValidation\{/);
});

test('sign in is product-neutral and does not render the legacy Carez Concrete logo', () => {
  const form = readFileSync('components/auth/LoginForm.tsx', 'utf8');
  const page = readFileSync('app/login/page.tsx', 'utf8');

  assert.equal(form.includes('carez-wordmark.png'), false);
  assert.equal(form.includes("from 'next/image'"), false);
  assert.match(form, /Sign in to Carez/);
  assert.match(form, /Show password/);
  assert.match(page, /CAREZ \/\/ PROJECT OPERATING SYSTEM/);
  assert.equal(page.includes('CAREZ / CONCRETE OPERATIONS'), false);
});
