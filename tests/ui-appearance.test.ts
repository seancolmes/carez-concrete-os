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

test('theme preference normalizes safely and keeps light as the fresh default', () => {
  assert.equal(normalizeThemePreference('light'), 'light');
  assert.equal(normalizeThemePreference('dark'), 'dark');
  assert.equal(normalizeThemePreference('system'), 'system');
  assert.equal(normalizeThemePreference('sepia'), 'light');
  assert.equal(normalizeThemePreference(undefined), 'light');
});

test('density preference normalizes safely', () => {
  assert.equal(normalizeDensityPreference('default'), 'default');
  assert.equal(normalizeDensityPreference('compact'), 'compact');
  assert.equal(normalizeDensityPreference('comfortable'), 'comfortable');
  assert.equal(normalizeDensityPreference('dense'), 'default');
  assert.equal(normalizeDensityPreference(undefined), 'default');
});

test('theme preferences resolve to the selected or device theme', () => {
  assert.equal(resolveThemePreference('light',true),'light');
  assert.equal(resolveThemePreference('dark',false),'dark');
  assert.equal(resolveThemePreference('system',true),'dark');
  assert.equal(resolveThemePreference('system',false),'light');
});

function boot(storedTheme:string|null,prefersDark:boolean){
  let darkClass=false;
  const root={
    dataset:{} as Record<string,string>,
    style:{} as Record<string,string>,
    classList:{toggle(name:string,enabled:boolean){assert.equal(name,'dark');darkClass=enabled;}},
  };
  runInNewContext(CAREZ_APPEARANCE_BOOT_SCRIPT,{
    document:{documentElement:root},
    window:{matchMedia:(query:string)=>{assert.equal(query,CAREZ_THEME_MEDIA_QUERY);return {matches:prefersDark};}},
    localStorage:{getItem:(key:string)=>key===CAREZ_DENSITY_STORAGE_KEY?'compact':key===CAREZ_THEME_STORAGE_KEY?storedTheme:null},
  });
  return {root,darkClass};
}

test('boot keeps light as the fresh default and preserves density', () => {
  const {root,darkClass}=boot(null,false);
  assert.equal(root.dataset.themePreference,'light');
  assert.equal(root.dataset.theme,'light');
  assert.equal(root.dataset.density,'compact');
  assert.equal(root.style.colorScheme,'light');
  assert.equal(darkClass,false);
});

test('boot restores saved dark before paint even on a light device', () => {
  const {root,darkClass}=boot('dark',false);
  assert.equal(root.dataset.themePreference,'dark');
  assert.equal(root.dataset.theme,'dark');
  assert.equal(root.style.colorScheme,'dark');
  assert.equal(darkClass,true);
});

test('boot resolves a saved device setting in both directions', () => {
  assert.equal(boot('system',true).root.dataset.theme,'dark');
  assert.equal(boot('system',false).root.dataset.theme,'light');
});
