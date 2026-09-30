import assert from 'node:assert/strict';
import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {dirname,join,relative,resolve,sep} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {resolveProjectRoute} from '../lib/ui/navigation.ts';

const root=new URL('../',import.meta.url);
const rootPath=fileURLToPath(root);
const readMaybe=(path:string)=>{
  const url=new URL(path,root);
  return existsSync(url)?readFileSync(url,'utf8'):'';
};

function sourceFiles(directory:string):string[]{
  return readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
    const path=join(directory,entry.name);
    return entry.isDirectory()?sourceFiles(path):/\.[jt]sx?$/.test(entry.name)?[path]:[];
  });
}

test('application source imports Fluent instead of removed UI frameworks or shared UI primitives',()=>{
  const forbidden:string[]=[];
  const sharedUiPath=resolve(rootPath,'components/ui');
  for(const file of [...sourceFiles(resolve(rootPath,'app')),...sourceFiles(resolve(rootPath,'components'))]){
    const source=readFileSync(file,'utf8');
    for(const match of source.matchAll(/\b(?:from\s*|import\s*|require\s*\(\s*)['"]([^'"]+)['"]/g)){
      const specifier=match[1];
      const relativeTarget=specifier.startsWith('.')?resolve(dirname(file),specifier):null;
      if(/^(?:@base-ui\/|@radix-ui\/|lucide-react(?:\/|$)|@\/components\/ui(?:\/|$))/.test(specifier)
        ||(relativeTarget!==null&&(relativeTarget===sharedUiPath||relativeTarget.startsWith(`${sharedUiPath}${sep}`)))){
        forbidden.push(`${relative(rootPath,file)}: ${specifier}`);
      }
    }
  }
  assert.deepEqual(forbidden,[]);
});

test('the application supplies a light and dark Fluent provider',()=>{
  const layout=readMaybe('app/layout.tsx');
  const appearance=readMaybe('components/CarezAppearanceProvider.tsx');
  assert.match(layout,/<CarezAppearanceProvider>/);
  assert.match(appearance,/FluentProvider/);
  assert.match(appearance,/webLightTheme/);
  assert.match(appearance,/webDarkTheme/);
  assert.match(appearance,/theme=\{resolvedTheme===['"]dark['"]\?carezDarkTheme:webLightTheme\}/);
});

test('project context stays within its authoritative route boundary',()=>{
  assert.deepEqual(resolveProjectRoute('/projects/project-1'),{projectId:'project-1',workspace:'project-overview',workspaceLabel:'Overview'});
  assert.deepEqual(resolveProjectRoute('/job-setup/project-1'),{projectId:'project-1',workspace:'job-setup',workspaceLabel:'Job setup'});
  assert.equal(resolveProjectRoute('/schedule'),null);
  assert.equal(resolveProjectRoute('/takeoff/set-1'),null);
  assert.equal(resolveProjectRoute('/estimates/estimate-1'),null);
});

test('Project Overview retains tenant boundaries, workspaces, and direct actions',()=>{
  const page=readMaybe('app/projects/[id]/page.tsx');
  assert.match(page,/if\(!user\)redirect\(['"]\/login['"]\)/);
  assert.match(page,/\.eq\(['"]company_id['"],profile\.company_id\)/);
  assert.match(page,/Review Crew Time/);
  assert.match(page,/What Needs Your Attention/);
  for(const href of [
    '/field?view=time-review',
    '/field?view=production',
    '/field?view=schedule',
    '/field?view=work-packages',
    '/documents',
    '/forecast',
    '/change-orders',
  ])assert.ok(page.includes(`href="${href}"`),`Project Overview action ${href} must remain linked`);
  for(const tab of ['Commercial Baseline','Scope & Specs','Activity'])assert.ok(page.includes(tab),`${tab} tab must remain`);
  assert.doesNotMatch(page,/Order Materials/);
  assert.doesNotMatch(page,/href="\/financials\?tab=procurement&view=procurement"/);
});
