import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {WORKSPACE_PRESENTATION_SURFACES} from '../lib/ui/navigation.ts';

const shell=readFileSync(new URL('../components/AppShell.tsx',import.meta.url),'utf8');

test('top navigation exposes the five consolidated workspace routes',()=>{
  assert.deepEqual(WORKSPACE_PRESENTATION_SURFACES.map(({label,href})=>[label,href]),[
    ['Overview','/overview'],['Opportunities','/opportunities'],['Projects','/projects'],['Financials','/financials'],['Administration','/settings'],
  ]);
  assert.match(shell,/aria-label="Primary domains"/);
  assert.match(shell,/<Link key=\{item\.id\} href=\{item\.href\}/);
  assert.match(shell,/aria-label="Mobile primary navigation"/);
  assert.doesNotMatch(shell,/DomainMegaMenu|CarezDomainDeck|carez-domain-deck/);
});

test('search button and Cmd+K open the command palette with company-scoped records',()=>{
  assert.match(shell,/aria-label="Search Pourtrace"/);
  assert.match(shell,/event\.metaKey\|\|event\.ctrlKey/);
  assert.match(shell,/event\.key\.toLowerCase\(\)==='k'/);
  assert.match(shell,/CommandGroup heading="Financials"/);
  assert.match(shell,/CommandGroup heading="Projects"/);
  assert.match(shell,/CommandGroup heading="Opportunities"/);
  assert.match(shell,/CommandGroup heading="Crew members"/);
  for(const table of ['projects','leads','crew_members'])assert.match(shell,new RegExp("from\\('"+table+"'\\).*eq\\('company_id'"));
  assert.doesNotMatch(shell,/navigationCommandValue|allDestinationsFor|NAVIGATION_COMMAND_GROUPS/);
});
