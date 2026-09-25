import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');
const governancePath = 'docs/workflow/KNOWLEDGE_GOVERNANCE.md';

test('GOV-001 knowledge governance is canonical, discoverable, and independent of human memory', () => {
  assert.equal(existsSync(new URL(governancePath, root)), true);

  const governance = read(governancePath);
  const agents = read('AGENTS.md');
  const codex = read('CODEX.md');

  assert.match(agents, /docs\/workflow\/KNOWLEDGE_GOVERNANCE\.md/);
  assert.match(codex, /docs\/workflow\/KNOWLEDGE_GOVERNANCE\.md/);
  assert.match(governance, /Nik must never be expected to remember an undocumented follow-up step/i);
  assert.match(governance, /every actionable Codex or local-agent prompt must be immediately followed by a separate \*\*What you do next\*\* section/i);
  assert.match(governance, /tells Nik exactly what to do, what to return, what remains unauthorized, and whether to stay in the current chat/i);
  assert.match(governance, /A Carez development response may then finish with \*\*Next recommended action:\*\*/i);
  for (const section of [
    'Architecture & Governance',
    'Active Development / Preconstruction',
    'Active Development / Projects',
    'Active Development / Field',
    'Active Development / Production',
    'Active Development / Finance',
    'Active Development / Platform',
    'Database & Data',
    'Release & Environments',
    'QA & Incidents',
    'Tooling & Command Center',
  ]) {
    assert.ok(governance.includes(section), `Control Room must include ${section}`);
  }
  assert.match(governance, /inactive for \*\*more than 14 calendar days\*\* and no preserved active worktree remains[\s\S]*close and archive the chat/i);
  assert.match(governance, /Archived chats are historical evidence only; they must never become current implementation authority/i);
  assert.match(governance, /If a fresh chat receives only \*\*“Carez rehydrate this session”\*\*[\s\S]*Work ID and objective \*\*UNRESOLVED\*\*/i);
  assert.match(governance, /Do not infer or select an active task from chat history, memory, recency, visible chat lists, old PRs, old branches, archived chats, or prior issue references/i);
  assert.match(governance, /Historical context may help locate evidence, but it cannot establish the active work unit/i);
  assert.match(governance, /Remote Desktop Commander must not be invoked during rehydration unless Nik explicitly authorizes Remote Desktop Commander in the current request/i);
  assert.match(governance, /If current local Git state is required but unavailable, request a read-only local Codex rehydration packet or exact user-supplied Git status, HEAD, and diff evidence/i);
});
