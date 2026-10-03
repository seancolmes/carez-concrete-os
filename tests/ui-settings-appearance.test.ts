import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const componentUrl = new URL('components/settings/AppearanceSettings.tsx', root);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');

test('Settings exposes persisted dark, light, and device themes', () => {
  assert.equal(existsSync(componentUrl), true);
  const component = read('components/settings/AppearanceSettings.tsx');
  const provider = read('components/CarezAppearanceProvider.tsx');
  const settings = read('app/settings/page.tsx');
  assert.match(component, /useCarezAppearance/);
  assert.match(component, /setThemePreference/);
  assert.match(component, /value="dark"/);
  assert.match(component, /value="light"/);
  assert.match(component, /value="system"/);
  assert.doesNotMatch(component, /Workspace density|densityPreference|setDensityPreference/);
  assert.match(component, /<Select appearance="outline"/);
  assert.match(component, /border-border bg-card/);
  assert.match(provider, /CAREZ_THEME_STORAGE_KEY/);
  assert.match(provider, /FluentProvider/);
  assert.match(provider, /webDarkTheme/);
  assert.match(provider, /resolvedTheme==='dark'\?carezDarkTheme:carezLightTheme/);
  assert.match(settings, /AppearanceSettings/);
  assert.match(settings, /title="Appearance"/);
});
