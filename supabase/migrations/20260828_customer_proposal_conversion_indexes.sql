-- Carez OS: cover proposal-conversion foreign keys used by audit/history lookups.

create index if not exists proposal_settings_created_by_idx
  on public.proposal_settings(created_by)
  where created_by is not null;

create index if not exists proposal_clarifications_created_by_idx
  on public.proposal_clarifications(created_by)
  where created_by is not null;

create index if not exists proposal_presentations_created_by_idx
  on public.proposal_presentations(created_by)
  where created_by is not null;

create index if not exists proposal_engagement_handled_by_idx
  on public.proposal_engagement_events(handled_by)
  where handled_by is not null;
