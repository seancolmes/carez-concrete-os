import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const root=new URL('../',import.meta.url);
const source=(path:string)=>readFileSync(new URL(path,root),'utf8');
const page=source('app/page.tsx');
const dashboard=source('components/today/TodaySurface.tsx');
const demo=source('app/dashboard/demo/page.tsx');
const navigation=source('lib/ui/navigation.ts');

test('Dashboard retains recorded quantities, direct navigation, and honest unavailable values',()=>{
  for(const table of ['change_order_financial_summary','daily_logs','timecards','retainage_available_summary','work_schedule_items'])assert.match(page,new RegExp(`from\\('${table}'\\)`));
  assert.match(page,/available_to_release/);
  assert.match(page,/Retainage available/);
  assert.match(page,/Available to release/);
  assert.match(page,/Open CO sell value/);
  assert.match(page,/Selected sell value/);
  assert.match(dashboard,/Open CO sell value/);
  assert.match(demo,/Retainage available/);
  assert.match(demo,/Available to release/);
  assert.match(demo,/Open CO sell value/);
  assert.match(demo,/Selected sell value/);
  assert.match(page,/Earned \/ unbilled',value:'—'/);
  assert.match(page,/unbilled_contract/);
  assert.match(page,/bid_due/);
  assert.match(page,/inspection_clear_count/);
  assert.match(dashboard,/No active jobs yet/);
  assert.match(dashboard,/No concrete scheduled in the next 7 days/);
  assert.match(dashboard,/DataGrid/);
  assert.match(dashboard,/<DialogSurface className="pt-dialog/);
  assert.doesNotMatch(dashboard,/OverlayDrawer/);
  assert.match(dashboard,/VerticalBarChart/);
  assert.doesNotMatch(dashboard,/LineChart/);
  assert.match(dashboard,/ProgressBar/);
  assert.match(dashboard,/MessageBar/);
  assert.match(navigation,/href:'\/dashboard',label:'Dashboard'/);
  assert.match(source('app/overview/page.tsx'),/redirect\('\/dashboard'\)/);
});

test('Dashboard shell has no retired theme switch',()=>{
  assert.doesNotMatch(source('components/AppShell.tsx'),/ThemeSwitch|setThemePreference/);
  assert.match(source('components/CarezAppearanceProvider.tsx'),/theme=\{pourTraceTheme\}/);
});
