-- Internal sequence tables are not application-readable.
alter table public.opportunity_sequences enable row level security;
revoke all on table public.opportunity_sequences from anon,authenticated;

alter table public.project_document_sequences enable row level security;
revoke all on table public.project_document_sequences from anon,authenticated;
