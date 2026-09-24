revoke all
on table public.estimate_review_acknowledgements
from authenticated;

grant select
on table public.estimate_review_acknowledgements
to authenticated;

create index if not exists estimate_review_ack_estimate_id_fk_idx
on public.estimate_review_acknowledgements(estimate_id);
