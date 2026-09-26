import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const componentUrl = new URL('components/settings/AppearanceSettings.tsx', root);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');

test('Settings exposes Carez appearance preferences', () => {
  assert.equal(existsSync(componentUrl), true);
  const component = read('components/settings/AppearanceSettings.tsx');
  const settings = read('app/settings/page.tsx');
  assert.match(component, /useCarezAppearance/);
  assert.match(component, /Steam Sleek V28/);
  assert.doesNotMatch(component, /Steam Light/);
  assert.doesNotMatch(component, /value="dark"/);
  assert.match(component, /Workspace default/);
  assert.match(component, /Compact/);
  assert.match(component, /Comfortable/);
  assert.match(settings, /AppearanceSettings/);
  assert.match(settings, /title="Appearance"/);
});
