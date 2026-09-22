import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import test from 'node:test';

const root=new URL('../',import.meta.url);
const read=(path:string)=>readFileSync(new URL(path,root),'utf8');

test('the shell exposes one compact seven-surface primary navigation',()=>{
  const shell=read('components/AppShell.tsx');
  assert.equal(existsSync(new URL('components/ui/navigation-menu.tsx',root)),true);
  assert.match(shell,/NavigationMenuList/);
  assert.match(shell,/NavigationMenuTrigger/);
  assert.match(shell,/Today/);
  for(const surface of ['preconstruction','projects','field','production','finance','system'])assert.match(shell,new RegExp(`GLOBAL_DESTINATIONS.*${surface}`));
  assert.match(shell,/aria-current/);
});

test('desktop dropdowns reserve readable label width and hand off before the shell crowds',()=>{
  const shell=read('components/AppShell.tsx');
  const primitive=read('components/ui/navigation-menu.tsx');
  assert.match(shell,/function dropdownLayout/);
  assert.match(shell,/grid-cols-2 min-w-\[28rem\]/);
  assert.match(shell,/grid-cols-1 min-w-\[14rem\]/);
  assert.match(shell,/whitespace-nowrap/);
  assert.match(shell,/hidden min-w-0 xl:flex/);
  assert.match(shell,/className="xl:hidden" aria-label="Open menu"/);
  assert.match(primitive,/max-w-\[calc\(100vw-2rem\)\]/);
});

test('the shell has no Workspaces directory, Quick Access, or secondary navigation chrome',()=>{
  const shell=read('components/AppShell.tsx');
  assert.doesNotMatch(shell,/Workspaces|QUICK ACCESS|ExpandableNavbar|CarezPinnedNav|CarezNavigationManager|Search workspaces/);
  assert.match(shell,/Search Carez/);
  assert.match(shell,/⌘K/);
});

test('mobile navigation exposes Today and the same six curated domains',()=>{
  const shell=read('components/AppShell.tsx');
  assert.match(shell,/aria-label="Mobile primary navigation"/);
  assert.match(shell,/MobileDomain/);
  assert.match(shell,/WORKSPACE_PRESENTATION_SURFACES\.filter\(surface=>surface\.id!=='today'\)/);
  assert.doesNotMatch(shell,/overflow-x/);
});
