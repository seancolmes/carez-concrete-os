import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('login uses the reusable Carez grid pattern as a supporting background layer', () => {
  const page = readFileSync('app/login/page.tsx', 'utf8');
  const component = readFileSync('components/ui/grid-pattern.tsx', 'utf8');
  const css = readFileSync('app/globals.css', 'utf8');

  assert.match(component, /function GridPattern/);
  assert.match(component, /patternUnits="userSpaceOnUse"/);
  assert.match(page, /import \{ GridPattern \} from '@\/components\/ui\/grid-pattern';/);
  assert.match(page, /<GridPattern/);
  assert.match(page, /className="carez-login-grid"/);
  assert.match(css, /\.carez-login-grid\s*\{/);
  assert.match(css, /mask-image:/);
  assert.match(css, /var\(--ring\)/);
});
