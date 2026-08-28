-- Customer proposal acceptance is a real stage between ready and approved/frozen budget.
alter table public.estimates drop constraint if exists estimates_status_check;
alter table public.estimates add constraint estimates_status_check
check (status = any(array['draft'::text,'ready'::text,'accepted'::text,'approved'::text,'declined'::text,'superseded'::text]));
