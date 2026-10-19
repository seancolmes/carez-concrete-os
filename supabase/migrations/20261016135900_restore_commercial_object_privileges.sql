-- Reconcile recovered grants with 20260926020000's existing commercial write
-- boundary. Commands govern headers; editable draft lines retain their existing
-- role/tenant RLS. Approved evidence and financial views are read only.
revoke all on public.change_order_number_sequences,public.change_orders,
 public.change_order_items,public.change_order_events,
 public.approved_commercial_deltas,public.approved_commercial_delta_items
 from public,anon,authenticated;
grant select on public.change_orders,public.change_order_events,
 public.approved_commercial_deltas,public.approved_commercial_delta_items to authenticated;
grant select,insert,update,delete on public.change_order_items to authenticated;
revoke all on public.change_order_financial_summary,
 public.project_authorized_contract_summary,public.commercial_baseline_item_references
 from public,anon,authenticated;
grant select on public.change_order_financial_summary,
 public.project_authorized_contract_summary,public.commercial_baseline_item_references to authenticated;
