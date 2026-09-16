import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CAREZ_APPEARANCE_BOOT_SCRIPT,
  CAREZ_DENSITY_STORAGE_KEY,
  CAREZ_THEME_MEDIA_QUERY,
  CAREZ_THEME_STORAGE_KEY,
  normalizeDensityPreference,
  normalizeThemePreference,
  resolveThemePreference,
} from '../lib/ui/appearance.ts';

test('theme preference normalizes safely', () => {
  assert.equal(normalizeThemePreference('light'), 'light');
  assert.equal(normalizeThemePreference('dark'), 'dark');
  assert.equal(normalizeThemePreference('system'), 'system');
  assert.equal(normalizeThemePreference('sepia'), 'system');
  assert.equal(normalizeThemePreference(null), 'system');
});

test('density preference normalizes safely', () => {
  assert.equal(normalizeDensityPreference('default'), 'default');
  assert.equal(normalizeDensityPreference('compact'), 'compact');
  assert.equal(normalizeDensityPreference('comfortable'), 'comfortable');
  assert.equal(normalizeDensityPreference('dense'), 'default');
  assert.equal(normalizeDensityPreference(undefined), 'default');
});

test('system resolves from OS while explicit themes do not', () => {
  assert.equal(resolveThemePreference('system', false), 'light');
  assert.equal(resolveThemePreference('system', true), 'dark');
  assert.equal(resolveThemePreference('light', true), 'light');
  assert.equal(resolveThemePreference('dark', false), 'dark');
});

test('boot script owns persistence and DOM state', () => {
  assert.match(CAREZ_APPEARANCE_BOOT_SCRIPT, new RegExp(CAREZ_THEME_STORAGE_KEY));
  assert.match(CAREZ_APPEARANCE_BOOT_SCRIPT, new RegExp(CAREZ_DENSITY_STORAGE_KEY));
  assert.match(CAREZ_APPEARANCE_BOOT_SCRIPT, /prefers-color-scheme: dark/);
  assert.match(CAREZ_APPEARANCE_BOOT_SCRIPT, /dataset\.themePreference/);
  assert.match(CAREZ_APPEARANCE_BOOT_SCRIPT, /dataset\.theme/);
  assert.match(CAREZ_APPEARANCE_BOOT_SCRIPT, /dataset\.density/);
  assert.match(CAREZ_APPEARANCE_BOOT_SCRIPT, /classList\.toggle\('dark'/);
  assert.equal(CAREZ_THEME_MEDIA_QUERY, '(prefers-color-scheme: dark)');
});
