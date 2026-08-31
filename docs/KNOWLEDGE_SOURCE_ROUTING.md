# Carez Concrete OS — Knowledge Source Routing

Use the source that owns the question.

## Product / architecture
Use, in order:
1. `docs/ARCHITECTURE.md`
2. applicable `docs/modules/*.md`
3. relevant ADRs
4. repository implementation evidence

## Current implementation / bug status
Use:
1. repository source on the active branch;
2. `docs/CURRENT_STATE.md`;
3. tests/build output;
4. browser/Vercel evidence for rendered behavior.

Do not use an old chat or architecture snapshot as proof that a current bug still exists or is fixed.

## Database / persisted behavior
Use:
1. `supabase/` migrations and current schema evidence;
2. server/domain code;
3. RLS/policy evidence.

## Concrete technical questions
Use ChatGPT Project technical sources such as ACI, formwork, concrete manuals, project drawings/specifications, and other attached references. Preserve source terminology and distinguish source-derived facts from inference.

## Estimating methodology / production references
Use Project estimating references, then Carez module/assembly contracts. External references inform method; they do not override approved Carez architecture.

## Regulatory / payroll / company compliance
Use current company/regulatory source files or live authoritative agency data when requested. Do not treat software architecture docs as regulatory authority.

## Company financial/history questions
Use company-specific Project records, accounting exports, and connected systems. Do not promote private company records into repository docs unless they are intentionally generalized into a product requirement.

## Brand / UX
Use approved Carez design-system docs, brand assets, and current mockup decisions. Screenshots are design evidence, not an excuse to replace canonical tokens with sampled values.

## Chat history
Chat is exploratory working context. Use old chats only when canonical sources do not contain the needed decision or when the user explicitly asks to recover prior brainstorming. Once a decision is approved, promote it to GitHub documentation.
