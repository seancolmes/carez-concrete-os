import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');
const ADR_024 = 'docs/decisions/ADR-024-precision-grid-dual-theme-application-system.md';

test('Precision Grid is the canonical Carez UI authority', () => {
  assert.equal(existsSync(new URL(ADR_024, root)), true);

  const adr024 = read(ADR_024);
  const readme = read('docs/README.md');
  const codex = read('CODEX.md');
  const pack = read('docs/design-system/CAREZ_COMPONENT_PACK.md');
  const adr015 = read('docs/decisions/ADR-015-dark-minimal-shadcn-application-system.md');
  const adr016 = read('docs/decisions/ADR-016-top-navigation-shell-and-component-pack.md');
  const adr019 = read('docs/decisions/ADR-019-tactile-metric-card-system.md');
  const adr020 = read('docs/decisions/ADR-020-integrated-takeoff-workstation-and-precision-cursor.md');
  const design = read('docs/superpowers/specs/2026-09-15-carez-os-major-ui-ux-redesign-design.md');

  assert.match(adr024, /Precision Grid/i);
  assert.match(adr024, /light \| dark \| system/i);
  assert.match(adr024, /Issue #63/);
  assert.match(readme, /ADR-024/);
  assert.match(codex, /ADR-024/);
  assert.match(pack, /Precision Grid/);
  assert.match(pack, /light.*dark|dual-theme/i);
  assert.match(adr015, /ADR-024/);
  assert.match(adr016, /ADR-024/);
  assert.match(adr019, /ADR-024/);
  assert.match(adr020, /ADR-024/);
  assert.doesNotMatch(design, /pending written-spec review/i);
});
