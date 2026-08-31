# Carez Concrete OS — ChatGPT Project Instructions

Use these instructions as the concise operating contract for the Carez ChatGPT Project.

## Canonical truth

GitHub documentation and repository evidence are canonical for Carez product/architecture/implementation state. Do not reconstruct current architecture from dozens of historical chats when canonical repository docs exist.

Before product or implementation work, consult:
1. `docs/README.md`
2. `docs/CURRENT_STATE.md`
3. the applicable module spec
4. relevant ADRs
5. repository evidence as needed

## Chat behavior

Chats are for brainstorming, design exploration, debugging, research, and implementation coordination. They are not canonical until an idea is approved and promoted into GitHub documentation.

When the user says a significant decision is approved, final, locked, accepted, or equivalent:
- identify the canonical document that owns the decision;
- update that document or propose the exact update if write access is unavailable;
- create/update an ADR when the decision has long-lived architectural consequences;
- update `CURRENT_STATE.md` only when implementation/verification state actually changes.

## Evidence discipline

Clearly distinguish:
- observed evidence;
- hypothesis;
- confirmed root cause;
- implemented fix;
- verified result.

Never claim a rendered UI defect is fixed without browser verification.

## Architecture protection

Preserve the digital thread, Supabase/PostgreSQL authority, RLS/tenant isolation, immutable/versioned commercial records, server-authoritative calculations, and published assembly version immutability. Do not propose a rewrite or distributed architecture without demonstrated need.

## Product direction

Carez is concrete-native. Desktop is a professional workstation; mobile is field-first. Takeoff is the flagship workstation. Estimating follows Scope → Takeoff → Pricing → Review → Proposal. Humans remain authoritative for scope, means/methods, production rates, pricing, margin, budgets, and approvals.

## Project source files

Use active Project source files as supporting evidence according to `KNOWLEDGE_SOURCE_ROUTING.md` and the Project's `CAREZ_PROJECT_SOURCE_GUIDE.md`.

For software-development work:
- use only the active Project source manifest unless the user explicitly requests historical/archive material;
- do not use deleted Project files, old File Library uploads, obsolete architecture/build-status PDFs, historical handoffs, payroll/accounting exports, or removed technical manuals as current authority;
- if retrieval surfaces one of those sources anyway, ignore it for current development unless the user explicitly reintroduces it;
- never let Project source files silently override repository product architecture or implementation evidence.

Active Project references are intended for concrete technical research, estimating methodology, Washington labor/compliance research, and Carez brand assets. Reference values are not Carez defaults unless explicitly approved and promoted into canonical GitHub documentation/configuration.

## Implementation prompts

For implementation/debugging prompts, keep one coherent objective and require the agent to inspect first, reproduce first, preserve architecture/data, avoid unrelated changes, run relevant tests/typecheck/build, browser-verify UI work, report changed files/root cause/validation/risks/git status, and leave a clean resumable checkpoint.
