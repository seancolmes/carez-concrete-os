# Carez Codex Worktrees

This workflow governs ChatGPT Desktop/Codex managed worktrees for Carez.

## Purpose

Use Local as the foreground integration workspace and managed worktrees as isolated background workspaces.

Use a managed worktree when work is:
- independent from the current foreground task,
- risky or experimental,
- long-running/background work,
- useful to investigate or implement without disturbing Local.

Do not create a worktree for a small sequential edit that is already clear and bounded.

## Starting state

Normal base: local `staging`.

Run the `Worktree Preflight` action before intentional parallel work.

A managed worktree starts from the selected branch HEAD. If Local has changes, Codex may apply those uncommitted changes to the worktree snapshot. Treat the worktree as a snapshot of the foreground state, not as a fresh copy of `origin/staging`.

Codex-managed worktrees use detached HEAD by default. Do not create a branch in the worktree for the normal Carez workflow.

## Isolation rules

- Local remains the accepted integration/QA workspace.
- Prefer one active writable Carez worktree; use at most two when tasks are genuinely independent.
- Do not run two writable worktrees against the same files or tightly coupled feature surface.
- Read-heavy specialist subagents do not require separate worktrees.
- Worktree Codex must follow the same Carez AGENTS, CODEX, rules, hooks, skills, and validation contract.
- Do not commit, push, deploy, mutate remote Supabase/Vercel/GitHub, or change shared branches from a worktree unless explicitly authorized.
- Never use a worktree to evade local policy, hook, or permission controls.

## Desktop versus CLI worktrees

Use ChatGPT Desktop **Worktree** mode for normal Carez managed-worktree work and Handoff.

A diagnostic `codex exec --worktree` session verifies Git isolation, but it is not a substitute for the Desktop Local Environment/Handoff path. On the current Windows setup, the CLI worktree test created a clean detached worktree but did not run the Desktop `carez-local` setup or copy Desktop-managed ignored files.

## Local environment

The Carez Local Environment setup runs when a managed worktree is created:

`pnpm install --frozen-lockfile`

Ignored local files required by the managed worktree are copied according to `.worktreeinclude`.

Do not add tracked source files to `.worktreeinclude`; tracked files arrive through Git.

## Handoff to Local

Use **Hand off -> Local** when:
- the change needs final inspection in the normal IDE,
- the usual local dev server or browser QA is required,
- Nik is ready to accept/reject the work,
- the work should enter the normal GitHub Desktop local-commit path.

Handoff is preferred over creating a worktree branch when the final destination is the local staging checkout. Codex handles the Git movement between the managed worktree and Local.

After handoff:
1. confirm Local is still on `staging`,
2. inspect the moved diff,
3. run the required validation/QA,
4. obtain Nik acceptance,
5. commit with GitHub Desktop,
6. do not push until the staging release gate.

## Handing Local to a worktree

Use **Hand off -> Worktree** when a foreground chat becomes background work and Local needs to be freed for another task. Returning the chat later should use its same managed worktree.

## Permanent worktrees

Do not use permanent worktrees for routine Carez tasks. Create one only for a genuinely long-lived independent line of work that needs multiple chats and explicit human approval.

## Cleanup

Managed worktrees are disposable. Archiving their chat allows Desktop to clean them up. Desktop also manages older worktrees according to its configured retention limit and preserves snapshots before automatic deletion.

Pin a chat only when its worktree must be preserved.

## Safe parallel patterns

Good:
- Worktree A: investigate a dependency upgrade while Local handles a UI task.
- Worktree A: implement a self-contained migration while Local remains untouched.
- Worktree A: exploratory redesign prototype that may be discarded.

Avoid:
- Local and Worktree A both editing `app/page.tsx`.
- Two worktrees modifying the same migration chain.
- A worktree creating/pushing a branch just to return work to Local.
- Multiple worktrees merely to make a small task look parallel.
