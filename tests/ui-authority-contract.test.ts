import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');
const ADR_024 = 'docs/decisions/ADR-024-precision-grid-dual-theme-application-system.md';
const ADR_025 = 'docs/decisions/ADR-025-carez-operations-workspace.md';

test('ADR-025 is current presentation authority while historical/domain contracts remain explicit', () => {
  assert.equal(existsSync(new URL(ADR_024, root)), true);
  assert.equal(existsSync(new URL(ADR_025, root)), true);

  const adr024 = read(ADR_024);
  const adr025 = read(ADR_025);
  const readme = read('docs/README.md');
  const currentState = read('docs/CURRENT_STATE.md');
  const codex = read('CODEX.md');
  const pack = read('docs/design-system/CAREZ_COMPONENT_PACK.md');
  const adr015 = read('docs/decisions/ADR-015-dark-minimal-shadcn-application-system.md');
  const adr016 = read('docs/decisions/ADR-016-top-navigation-shell-and-component-pack.md');
  const adr019 = read('docs/decisions/ADR-019-tactile-metric-card-system.md');
  const adr020 = read('docs/decisions/ADR-020-integrated-takeoff-workstation-and-precision-cursor.md');

  assert.match(adr025, /Accepted design authority/i);
  assert.match(adr025, /80% Command Deck/i);
  assert.match(adr025, /20% Spatial Blueprint/i);
  assert.match(adr025, /Inter/i);
  assert.match(adr025, /purposeful motion|Motion must answer/i);
  assert.match(adr025, /2D Takeoff geometry remains quantity authority|Persisted 2D Takeoff geometry remains quantity authority/i);
  assert.match(adr025, /application-wide rollout incomplete/i);

  assert.match(currentState, /full rewrite is not complete/i);
  assert.match(currentState, /Issue #76 is open again/i);
  assert.match(readme, /ADR-025/);
  assert.match(codex, /local Codex execution contract/i);
  assert.match(pack, /Inter/i);
  assert.match(pack, /Spatial Blueprint/i);
  assert.match(pack, /light.*dark|light\/dark/i);

  assert.match(adr024, /supersess|supersed/i);
  assert.match(adr015, /ADR-024/);
  assert.match(adr016, /ADR-024/);
  assert.match(adr019, /ADR-024/);
  assert.match(adr020, /2D|quantity authority/i);
});
