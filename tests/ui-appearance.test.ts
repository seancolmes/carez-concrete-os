import assert from 'node:assert/strict';
import test from 'node:test';
import {runInNewContext} from 'node:vm';
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

test('theme preferences resolve to light, dark, or the device setting', () => {
  assert.equal(resolveThemePreference('system', false), 'light');
  assert.equal(resolveThemePreference('system', true), 'dark');
  assert.equal(resolveThemePreference('light', true), 'light');
  assert.equal(resolveThemePreference('dark', false), 'dark');
});

test('boot migrates saved dark preference before paint and preserves density', () => {
  const root={dataset:{} as Record<string,string>,style:{} as Record<string,string>,classList:{toggle(_name:string,value:boolean){assert.equal(value,true);}}};
  runInNewContext(CAREZ_APPEARANCE_BOOT_SCRIPT,{document:{documentElement:root},window:{matchMedia:()=>({matches:true})},localStorage:{getItem:(key:string)=>key===CAREZ_DENSITY_STORAGE_KEY?'compact':key===CAREZ_THEME_STORAGE_KEY?'dark':null}});
  assert.equal(root.dataset.themePreference,'dark');
  assert.equal(root.dataset.theme,'dark');
  assert.equal(root.dataset.density,'compact');
  assert.equal(root.style.colorScheme,'dark');
});

test('boot follows a light device preference when no theme was saved', () => {
  const root={dataset:{} as Record<string,string>,style:{} as Record<string,string>,classList:{toggle(_name:string,value:boolean){assert.equal(value,false);}}};
  runInNewContext(CAREZ_APPEARANCE_BOOT_SCRIPT,{document:{documentElement:root},window:{matchMedia:(query:string)=>({matches:query===CAREZ_THEME_MEDIA_QUERY?false:true})},localStorage:{getItem:()=>null}});
  assert.equal(root.dataset.themePreference,'system');
  assert.equal(root.dataset.theme,'light');
  assert.equal(root.style.colorScheme,'light');
});
