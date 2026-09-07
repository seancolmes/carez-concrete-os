# Carez Concrete OS — Knowledge Source Routing

Use the source that owns the question. Retrieval should be bounded by the task, not by the size of the repository.

## Retrieval discipline

For repository implementation, root `AGENTS.md` is the compact execution entrypoint and `docs/README.md` provides the task-based reading map.

- Start with the minimum authoritative source set for the task.
- When the user explicitly names source files, read those first and broaden only for a concrete contradiction, missing dependency, or safety concern.
- Prefer a known owning file or bounded implementation area over recursive searches across `docs/`.
- Do not reread unchanged sources merely to reconfirm conclusions already established in the same task.
- Read `CURRENT_STATE.md` only for current implementation/verification state; do not use it as a substitute for module/architecture contracts.
- Read `ROADMAP.md` only when sequence or priority matters.
- Read `BRANCH_AND_RELEASE_MODEL.md` only when branch, QA target, deployment line, or production-promotion behavior matters.
- Historical/superseded evidence belongs in Git history, closed issues/PRs, migrations, tags/releases, or archived external sources—not in the active documentation path.

## Product / architecture

Use, in order:
1. `docs/ARCHITECTURE.md`
2. applicable `docs/modules/*.md`
3. relevant active ADRs
4. repository implementation evidence

For a bounded implementation whose approved behavior is already clear, do not re-read this entire hierarchy unless implementation evidence exposes a contradiction.

## Current implementation / bug status

Use:
1. repository source on the active branch;
2. `docs/CURRENT_STATE.md` when a concise current-state checkpoint is needed;
3. tests/build output;
4. Supabase/Vercel evidence as applicable;
5. browser evidence for rendered behavior.

Do not use an old chat, architecture snapshot, handoff document, or archived Project file as proof that a current bug still exists or is fixed.

## Database / persisted behavior

Use:
1. relevant `supabase/` migrations and current schema evidence;
2. relevant server/domain code;
3. RLS/policy evidence;
4. applicable canonical ADR/module contract when interpretation is required.

Do not scan unrelated migrations or database domains for a localized task. Production migration history remains separately governed from QA while Issue #59 is open.

## Active ChatGPT Project sources

The active Project source set is governed by `CAREZ_PROJECT_SOURCE_GUIDE.md` in the ChatGPT Project.

For software-development work, use Project files only when external/domain evidence is actually required. Repository architecture and implementation remain canonical for Carez software state.

If retrieval surfaces a deleted Project file, old File Library upload, obsolete handoff, historical accounting record, or other archived material, do not treat it as current development authority.

## Concrete technical questions

Use the active Project technical sources, currently focused on the ACI 302 slab excerpt and the Formwork Guide. Preserve source terminology and distinguish source-derived facts from inference.

Technical references inform concrete-domain reasoning; they do not define Carez product architecture and do not override project drawings/specifications, current codes, manufacturer requirements, or engineered temporary-works requirements.

## Estimating methodology / production references

Use approved Carez Concrete Condition/module contracts first, then active Project estimating references for terminology, workflow, benchmarks, and sanity checks.

Generic productivity values, national cost-book prices, waste factors, and example markups are benchmarks only. They do not become Carez defaults without explicit approval.

## Regulatory / payroll / company compliance

Use the active Washington WAC/L&I/ESD references or live authoritative agency data when current applicability matters.

Rates and classifications are jurisdiction-specific and effective-date-sensitive. Model them as configurable/effective-dated values, not permanent constants.

## Company financial/history questions

Historical company financial/payroll records are not part of the active software-development source set. Use such records only when explicitly introduced for a scoped historical, finance-QA, or cost-history task.

Do not promote private company records into repository docs unless intentionally generalized into a product requirement.

## Brand / UX

Use approved Carez design-system docs, brand assets, and current mockup decisions. Screenshots are design evidence, not an excuse to replace canonical tokens with sampled values.

## Chat history

Chat is exploratory working context. Use old chats only when canonical sources do not contain the needed decision or when the user explicitly asks to recover prior brainstorming. Once a decision is approved, promote it to GitHub documentation.
