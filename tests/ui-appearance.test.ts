import assert from 'node:assert/strict';
import test from 'node:test';
import {runInNewContext} from 'node:vm';
import {
  CAREZ_APPEARANCE_BOOT_SCRIPT,
  CAREZ_DENSITY_STORAGE_KEY,
  CAREZ_THEME_STORAGE_KEY,
  normalizeDensityPreference,
  normalizeThemePreference,
  resolveThemePreference,
} from '../lib/ui/appearance.ts';

test('retired and unknown theme preferences always normalize to light', () => {
  assert.equal(normalizeThemePreference('light'), 'light');
  assert.equal(normalizeThemePreference('dark'), 'light');
  assert.equal(normalizeThemePreference('system'), 'light');
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

test('saved preferences cannot activate dark mode under either OS preference', () => {
  for(const preference of ['light','dark','system',null]){
    for(const prefersDark of [true,false]) assert.equal(resolveThemePreference(preference,prefersDark),'light');
  }
});

function boot(storedTheme:string|null,prefersDark:boolean){
  let darkClass=true;
  const reads:string[]=[];
  const root={
    dataset:{} as Record<string,string>,
    style:{} as Record<string,string>,
    classList:{toggle(name:string,enabled:boolean){assert.equal(name,'dark');darkClass=enabled;}},
  };
  runInNewContext(CAREZ_APPEARANCE_BOOT_SCRIPT,{
    document:{documentElement:root},
    window:{matchMedia:()=>({matches:prefersDark})},
    localStorage:{getItem:(key:string)=>{reads.push(key);return key===CAREZ_DENSITY_STORAGE_KEY?'compact':key===CAREZ_THEME_STORAGE_KEY?storedTheme:null;}},
  });
  return {root,darkClass,reads};
}

test('boot keeps light as the fresh default and preserves density', () => {
  const {root,darkClass}=boot(null,false);
  assert.equal(root.dataset.themePreference,'light');
  assert.equal(root.dataset.theme,'light');
  assert.equal(root.dataset.density,'compact');
  assert.equal(root.style.colorScheme,'only light');
  assert.equal(darkClass,false);
});

test('boot ignores saved dark preferences and removes an obsolete dark class before paint', () => {
  for(const prefersDark of [false,true]){
    const {root,darkClass,reads}=boot('dark',prefersDark);
    assert.equal(root.dataset.themePreference,'light');
    assert.equal(root.dataset.theme,'light');
    assert.equal(root.style.colorScheme,'only light');
    assert.equal(darkClass,false);
    assert.deepEqual(reads,[CAREZ_DENSITY_STORAGE_KEY]);
  }
});

test('boot stays light with a saved device setting in both directions', () => {
  assert.equal(boot('system',true).root.dataset.theme,'light');
  assert.equal(boot('system',false).root.dataset.theme,'light');
});

test('blocked browser storage cannot prevent light prepaint initialization',()=>{
  const root={dataset:{} as Record<string,string>,style:{} as Record<string,string>,classList:{toggle(){}}};
  runInNewContext(CAREZ_APPEARANCE_BOOT_SCRIPT,{document:{documentElement:root},localStorage:{getItem(){throw new Error('Storage denied');}}});
  assert.equal(root.dataset.theme,'light');
  assert.equal(root.dataset.density,'default');
  assert.equal(root.style.colorScheme,'only light');
});
