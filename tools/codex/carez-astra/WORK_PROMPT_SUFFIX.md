# Carez premium Work prompt footer

Append this block to GPT-6 Astra Work implementation prompts when premium execution is justified.

```text
CAREZ PREMIUM EXECUTION RULE

Use Astra only for the requested high-value implementation/decision work.

Read only the files named above and direct dependencies required to implement the task. Do not broadly scan the repository or reopen approved design/architecture.

If helper work is needed, use Luna first and Terra only when Luna is insufficient. Never spawn another Astra. Use no more than two workers, and give each a fresh bounded brief rather than the full conversation.

DO NOT perform post-implementation validation:
- no tests/typecheck/lint unless explicitly requested in this prompt
- no browser or visual QA
- no regression sweep
- no auto-review/reviewer pass
- no GitHub Actions inspection
- no Vercel/deployment monitoring or waiting
- no optional cleanup or second polish pass

The Carez control room handles acceptance separately.

IMPLEMENT -> COMMIT -> PUSH -> STOP.

After the requested implementation is committed and pushed to the assigned branch, stop immediately and return only the commit SHA, files changed, and any blocker.
```
