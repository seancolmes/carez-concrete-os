import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const componentUrl = new URL('components/settings/AppearanceSettings.tsx', root);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');

test('Settings exposes theme without a non-functional density selector', () => {
  assert.equal(existsSync(componentUrl), true);
  const component = read('components/settings/AppearanceSettings.tsx');
  const settings = read('app/settings/page.tsx');
  assert.match(component, /useCarezAppearance/);
  assert.match(component, /PourTrace color system/);
  assert.match(component, /value="system"/);
  assert.match(component, /value="light"/);
  assert.match(component, /value="dark"/);
  assert.doesNotMatch(component, /Workspace density|densityPreference|setDensityPreference/);
  assert.match(component, /dark:bg-\[#181A1B\]/);
  assert.match(settings, /AppearanceSettings/);
  assert.match(settings, /title="Appearance"/);
});
