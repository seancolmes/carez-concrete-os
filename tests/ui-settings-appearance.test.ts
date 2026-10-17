import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');

test('retired theme controls are absent from Settings and both application shells', () => {
  assert.equal(existsSync(new URL('components/settings/AppearanceSettings.tsx',root)),false);
  assert.equal(existsSync(new URL('components/ThemeSwitch.tsx',root)),false);
  for(const path of ['app/settings/page.tsx','components/AppShell.tsx','app/employee/page.tsx']){
    assert.doesNotMatch(read(path),/AppearanceSettings|ThemeSwitch|Use dark mode|setThemePreference/);
  }
  const settings = read('app/settings/page.tsx');
  assert.doesNotMatch(settings,/selectedTab==='appearance'/);
  assert.match(settings,/\|\|'company'/);
  for(const category of ['Company','Connections','System & labor'])assert.ok(settings.includes(category));
});
