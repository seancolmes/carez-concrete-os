import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const root=new URL('../',import.meta.url);
const source=(path:string)=>readFileSync(new URL(path,root),'utf8');
const page=source('app/page.tsx');
const dashboard=source('components/today/TodaySurface.tsx');
const appearance=source('components/ThemeSwitch.tsx');
const navigation=source('lib/ui/navigation.ts');

test('Dashboard retains recorded quantities, direct navigation, and honest unavailable values',()=>{
  for(const table of ['change_order_financial_summary','daily_logs','timecards','retainage_available_summary','work_schedule_items'])assert.match(page,new RegExp(`from\\('${table}'\\)`));
  assert.match(page,/available_to_release/);
  assert.match(page,/Retainage held/);
  assert.match(page,/Earned \/ unbilled',value:'—'/);
  assert.match(page,/unbilled_contract/);
  assert.match(page,/bid_due/);
  assert.match(page,/inspection_clear_count/);
  assert.match(dashboard,/No active jobs yet/);
  assert.match(dashboard,/No concrete scheduled in the next 7 days/);
  assert.match(dashboard,/DataGrid/);
  assert.match(dashboard,/OverlayDrawer/);
  assert.match(dashboard,/VerticalBarChart/);
  assert.doesNotMatch(dashboard,/LineChart/);
  assert.match(dashboard,/ProgressBar/);
  assert.match(dashboard,/MessageBar/);
  assert.match(navigation,/href:'\/dashboard',label:'Dashboard'/);
  assert.match(source('app/overview/page.tsx'),/redirect\('\/dashboard'\)/);
});

test('global appearance switch uses the existing preference provider',()=>{
  assert.match(appearance,/useCarezAppearance/);
  assert.match(appearance,/Switch aria-label="Use dark mode"/);
  assert.match(appearance,/setThemePreference\(data.checked\?'dark':'light'\)/);
  assert.match(source('components/AppShell.tsx'),/<ThemeSwitch\/>/);
});
