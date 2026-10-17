-- Connect persisted inspection, resource, scheduling and delivery authorities.
-- Only passed or explicitly waived required inspections clear work (human decision).
-- Canonical invoker views plus in-place, shape-checked compatibility projections
-- preserve existing dependent views, column order, typmods, IDs and all records.
set local search_path=pg_catalog,public,extensions;

create or replace view public.carez_resource_readiness_v1 with(security_invoker=true) as
SELECT c.*,p.job_number,p.project_name,p.package_name,p.location,p.field_label,p.task_name,p.operation_status FROM (
WITH schedule_date AS (
         SELECT w.company_id, w.work_package_operation_id AS operation_id,
            min(w.schedule_date) FILTER (WHERE w.schedule_date >= CASE WHEN auth.uid() IS NULL OR w.company_id=public.get_my_company_id() THEN public.carez_company_calendar_date(w.company_id,clock_timestamp()) END) AS next_schedule_date
           FROM work_schedule_items w
          WHERE w.status <> 'cancelled'::text AND w.item_type = 'work'::text AND w.work_package_operation_id IS NOT NULL
          GROUP BY w.company_id,w.work_package_operation_id
        ), material_reservation AS (
         SELECT ir.company_id, ir.resource_requirement_id,
            ir.inventory_item_id,
            COALESCE(sum(ir.quantity) FILTER (WHERE ir.status = ANY (ARRAY['reserved'::text, 'consumed'::text])), 0::numeric) AS requirement_reserved_qty,COALESCE(sum(ir.quantity) FILTER(WHERE ir.status='consumed'),0::numeric) AS consumed_qty,COALESCE(sum(ir.quantity) FILTER(WHERE ir.status='reserved'),0::numeric) AS reserved_qty
           FROM inventory_reservations ir
          GROUP BY ir.company_id,ir.resource_requirement_id, ir.inventory_item_id
        ), material_total_reserved AS (
         SELECT ir.company_id,ir.inventory_item_id,
            COALESCE(sum(ir.quantity) FILTER (WHERE ir.status = 'reserved'::text), 0::numeric) AS total_reserved_qty
           FROM inventory_reservations ir
          GROUP BY ir.company_id,ir.inventory_item_id
        ), po_actual AS (
         SELECT pol.company_id, po.project_id, pol.unit AS purchase_unit, pol.id AS purchase_order_line_id,
            po.status AS po_status,
            po.expected_delivery_date,
            pol.quantity AS ordered_qty,
            COALESCE(sum(r.quantity_received), 0::numeric) AS received_qty,
            po.po_number,(select count(*)::integer from public.work_package_resource_requirements rr2 where rr2.company_id=pol.company_id and rr2.purchase_order_line_id=pol.id and rr2.waived_at is null) AS resource_link_count
           FROM purchase_order_lines pol
             JOIN purchase_orders po ON po.id = pol.purchase_order_id AND po.company_id = pol.company_id
             LEFT JOIN purchase_order_receipts r ON r.purchase_order_line_id = pol.id AND r.company_id = pol.company_id
          GROUP BY pol.id, po.project_id, po.status, po.expected_delivery_date, pol.quantity, po.po_number
        ), equipment_state AS (
         SELECT er.company_id,er.resource_requirement_id,
            er.equipment_asset_id,
            er.start_date,
            er.end_date,
            er.status AS reservation_status,
            a.name AS equipment_name,
            a.active AS equipment_active,
            a.status AS equipment_status,
            a.next_service_date,
            (( SELECT count(*) AS count
                   FROM equipment_reservations x
                  WHERE x.company_id=er.company_id AND x.equipment_asset_id = er.equipment_asset_id AND x.id <> er.id AND (x.status = ANY (ARRAY['planned'::text, 'confirmed'::text])) AND daterange(x.start_date, x.end_date, '[]'::text) && daterange(er.start_date, er.end_date, '[]'::text)))::integer AS conflict_count
           FROM equipment_reservations er
             JOIN equipment_assets a ON a.id = er.equipment_asset_id AND a.company_id = er.company_id
        ), base AS (
         SELECT rr.id,
            rr.company_id,
            rr.work_package_operation_id,
            rr.resource_type,
            rr.label,
            rr.required_quantity,
            rr.unit,
            rr.inventory_item_id,
            rr.equipment_asset_id,
            rr.vendor_id,
            rr.purchase_order_line_id,
            rr.required_before_start,
            rr.need_offset_days,
            rr.need_by_override,
            rr.vendor_status,
            rr.vendor_reference,
            rr.waived_at,
            rr.waived_by,
            rr.waiver_reason,
            rr.notes,
            rr.created_by,
            rr.created_at,
            rr.updated_at,
            o.work_package_id,
            wp.project_id,
            wp.planned_start_date,
            COALESCE(rr.need_by_override, sd.next_schedule_date + rr.need_offset_days, wp.planned_start_date + rr.need_offset_days) AS need_by_date,
            i.name AS inventory_name,
            i.quantity_on_hand,
            i.active AS inventory_active,
            mr.requirement_reserved_qty,mr.consumed_qty,mr.reserved_qty,
            mtr.total_reserved_qty,
            pa.po_status,
            pa.expected_delivery_date,
            pa.ordered_qty,
            CASE WHEN pa.resource_link_count>1 THEN 0::numeric ELSE pa.received_qty END AS received_qty,pa.resource_link_count AS po_resource_count,
            pa.po_number,
            es.start_date AS equipment_start_date,
            es.end_date AS equipment_end_date,
            es.reservation_status,
            es.equipment_name,
            es.equipment_active,
            es.equipment_status,
            es.next_service_date,
            es.conflict_count,
            v.name AS vendor_name,
            v.active AS vendor_active
           FROM work_package_resource_requirements rr
             JOIN work_package_operations o ON o.id = rr.work_package_operation_id AND o.company_id = rr.company_id
             JOIN work_packages wp ON wp.id = o.work_package_id AND wp.company_id = o.company_id
             LEFT JOIN schedule_date sd ON sd.company_id=rr.company_id AND sd.operation_id = rr.work_package_operation_id
             LEFT JOIN inventory_items i ON i.id = rr.inventory_item_id AND i.company_id = rr.company_id
             LEFT JOIN material_reservation mr ON mr.company_id=rr.company_id AND mr.inventory_item_id=rr.inventory_item_id AND mr.resource_requirement_id = rr.id
             LEFT JOIN material_total_reserved mtr ON mtr.company_id=rr.company_id AND mtr.inventory_item_id = rr.inventory_item_id
             LEFT JOIN po_actual pa ON pa.company_id=rr.company_id AND pa.project_id=wp.project_id AND upper(pa.purchase_unit)=upper(rr.unit) AND pa.purchase_order_line_id = rr.purchase_order_line_id
             LEFT JOIN equipment_state es ON es.company_id=rr.company_id AND es.equipment_asset_id=rr.equipment_asset_id AND es.resource_requirement_id = rr.id
             LEFT JOIN vendors v ON v.id = rr.vendor_id AND v.company_id = rr.company_id
        ), calc AS (
         SELECT b.id,
            b.company_id,
            b.work_package_operation_id,
            b.resource_type,
            b.label,
            b.required_quantity,
            b.unit,
            b.inventory_item_id,
            b.equipment_asset_id,
            b.vendor_id,
            b.purchase_order_line_id,
            b.required_before_start,
            b.need_offset_days,
            b.need_by_override,
            b.vendor_status,
            b.vendor_reference,
            b.waived_at,
            b.waived_by,
            b.waiver_reason,
            b.notes,
            b.created_by,
            b.created_at,
            b.updated_at,
            b.work_package_id,
            b.project_id,
            b.planned_start_date,
            b.need_by_date,
            b.inventory_name,
            b.quantity_on_hand,
            b.inventory_active,
            b.requirement_reserved_qty,b.consumed_qty,b.reserved_qty,
            b.total_reserved_qty,
            b.po_status,
            b.expected_delivery_date,
            b.ordered_qty,
            b.received_qty,b.po_resource_count,
            b.po_number,
            b.equipment_start_date,
            b.equipment_end_date,
            b.reservation_status,
            b.equipment_name,
            b.equipment_active,
            b.equipment_status,
            b.next_service_date,
            b.conflict_count,
            b.vendor_name,
            b.vendor_active,
                CASE WHEN b.inventory_item_id IS NULL THEN 0::numeric ELSE
 COALESCE(CASE WHEN b.consumed_qty::text NOT IN ('NaN','Infinity','-Infinity') AND b.consumed_qty>=0 THEN b.consumed_qty END,0)
 + CASE WHEN b.inventory_active IS TRUE AND b.quantity_on_hand IS NOT NULL AND b.quantity_on_hand::text NOT IN ('NaN','Infinity','-Infinity') AND b.reserved_qty::text NOT IN ('NaN','Infinity','-Infinity') AND b.total_reserved_qty::text NOT IN ('NaN','Infinity','-Infinity')
 THEN LEAST(COALESCE(b.reserved_qty,0),GREATEST(b.quantity_on_hand-GREATEST(COALESCE(b.total_reserved_qty,0)-COALESCE(b.reserved_qty,0),0),0)) ELSE 0::numeric END END AS safe_inventory_qty
           FROM base b
        )
 SELECT id,
    company_id,
    work_package_operation_id,
    resource_type,
    label,
    required_quantity,
    unit,
    inventory_item_id,
    equipment_asset_id,
    vendor_id,
    purchase_order_line_id,
    required_before_start,
    need_offset_days,
    need_by_override,
    vendor_status,
    vendor_reference,
    waived_at,
    waived_by,
    waiver_reason,
    notes,
    created_by,
    created_at,
    updated_at,
    work_package_id,
    project_id,
    planned_start_date,
    need_by_date,
    inventory_name,
    quantity_on_hand,
    inventory_active,
    requirement_reserved_qty,
    total_reserved_qty,
    po_status,
    expected_delivery_date,
    ordered_qty,
    received_qty,po_resource_count,
    po_number,
    equipment_start_date,
    equipment_end_date,
    reservation_status,
    equipment_name,
    equipment_active,
    equipment_status,
    next_service_date,
    conflict_count,
    vendor_name,
    vendor_active,
    safe_inventory_qty,
    GREATEST(required_quantity - (safe_inventory_qty + COALESCE(received_qty, 0::numeric)), 0::numeric) AS shortage_quantity,
        CASE
            WHEN waived_at IS NOT NULL THEN 'waived'::text
            WHEN resource_type = 'material'::text AND (safe_inventory_qty + COALESCE(received_qty, 0::numeric)) >= required_quantity THEN 'ready'::text
            WHEN resource_type = 'material'::text AND purchase_order_line_id IS NOT NULL AND po_status = 'issued'::text THEN 'ordered'::text
            WHEN resource_type = 'material'::text THEN 'missing'::text
            WHEN resource_type = 'equipment'::text AND COALESCE(reservation_status, ''::text) = 'confirmed'::text AND COALESCE(equipment_active, false) AND (COALESCE(equipment_status, 'available'::text) <> ALL (ARRAY['service'::text, 'out_of_service'::text])) AND COALESCE(conflict_count, 0) = 0 AND need_by_date BETWEEN equipment_start_date AND equipment_end_date AND (next_service_date IS NULL OR need_by_date IS NULL OR next_service_date > need_by_date) THEN 'ready'::text
            WHEN resource_type = 'equipment'::text AND equipment_asset_id IS NULL THEN 'missing'::text
            WHEN resource_type = 'equipment'::text AND COALESCE(reservation_status, ''::text) = 'planned'::text THEN 'needs_confirmation'::text
            WHEN resource_type = 'equipment'::text THEN 'blocked'::text
            WHEN resource_type = 'vendor'::text AND (vendor_status = ANY (ARRAY['confirmed'::text, 'completed'::text])) AND vendor_id IS NOT NULL AND COALESCE(vendor_active, false) THEN 'ready'::text
            WHEN resource_type = 'vendor'::text AND vendor_status = 'requested'::text THEN 'needs_confirmation'::text
            WHEN resource_type = 'vendor'::text THEN 'missing'::text
            ELSE 'missing'::text
        END AS resource_status,
        CASE
            WHEN waived_at IS NOT NULL THEN NULL::text
            WHEN resource_type = 'material'::text AND (safe_inventory_qty + COALESCE(received_qty, 0::numeric)) >= required_quantity THEN NULL::text
            WHEN resource_type = 'material'::text AND po_resource_count>1 THEN label || ' shares a purchase order line; assign distinct source lines before clearing work'::text
            WHEN resource_type = 'material'::text AND purchase_order_line_id IS NOT NULL AND po_status = 'issued'::text AND expected_delivery_date IS NOT NULL AND need_by_date IS NOT NULL AND expected_delivery_date > need_by_date THEN label || ' arrives after it is needed'::text
            WHEN resource_type = 'material'::text AND purchase_order_line_id IS NOT NULL AND po_status = 'issued'::text THEN label || ' is ordered but not received'::text
            WHEN resource_type = 'material'::text THEN label || ' is not reserved or received'::text
            WHEN resource_type = 'equipment'::text AND equipment_asset_id IS NULL THEN label || ' has no equipment assigned'::text
            WHEN resource_type = 'equipment'::text AND NOT COALESCE(equipment_active, false) THEN label || ' equipment is inactive'::text
            WHEN resource_type = 'equipment'::text AND (COALESCE(equipment_status, 'available'::text) = ANY (ARRAY['service'::text, 'out_of_service'::text])) THEN label || ' equipment is unavailable'::text
            WHEN resource_type = 'equipment'::text AND COALESCE(conflict_count, 0) > 0 THEN label || ' equipment is reserved for conflicting work'::text
            WHEN resource_type = 'equipment'::text AND need_by_date IS NULL THEN label || ' needs a work date to verify the reservation'::text
            WHEN resource_type = 'equipment'::text AND reservation_status='confirmed' AND (equipment_start_date IS NULL OR equipment_end_date IS NULL OR need_by_date NOT BETWEEN equipment_start_date AND equipment_end_date) THEN label || ' reservation does not cover the work date'::text
            WHEN resource_type = 'equipment'::text AND next_service_date IS NOT NULL AND need_by_date IS NOT NULL AND next_service_date <= need_by_date THEN label || ' needs service before the work starts'::text
            WHEN resource_type = 'equipment'::text AND COALESCE(reservation_status, ''::text) <> 'confirmed'::text THEN label || ' equipment reservation is not confirmed'::text
            WHEN resource_type = 'vendor'::text AND vendor_id IS NULL THEN label || ' has no vendor selected'::text
            WHEN resource_type = 'vendor'::text AND NOT COALESCE(vendor_active, false) THEN label || ' vendor is inactive'::text
            WHEN resource_type = 'vendor'::text AND (vendor_status <> ALL (ARRAY['confirmed'::text, 'completed'::text])) THEN label || ' vendor is not confirmed'::text
            ELSE NULL::text
        END AS blocking_reason,
        CASE
            WHEN waived_at IS NOT NULL THEN NULL::text
            WHEN resource_type = 'material'::text AND purchase_order_line_id IS NOT NULL AND po_status = 'issued'::text AND expected_delivery_date IS NOT NULL AND need_by_date IS NOT NULL AND expected_delivery_date = need_by_date THEN label || ' is scheduled to arrive the day it is needed'::text
            WHEN resource_type = 'material'::text AND COALESCE(total_reserved_qty, 0::numeric) > COALESCE(quantity_on_hand, 0::numeric) THEN label || ' inventory is over-reserved across work packages'::text
            WHEN resource_type = 'equipment'::text AND reservation_status = 'planned'::text THEN label || ' equipment reservation still needs confirmation'::text
            WHEN resource_type = 'vendor'::text AND vendor_status = 'requested'::text THEN label || ' vendor confirmation is still pending'::text
            ELSE NULL::text
        END AS warning_reason
   FROM calc c
)c JOIN public.work_package_operation_progress p ON p.company_id=c.company_id AND p.operation_id=c.work_package_operation_id;
revoke all on public.carez_resource_readiness_v1 from public,anon,authenticated;
grant select on public.carez_resource_readiness_v1 to authenticated;

create or replace view public.carez_resource_summary_v1 with(security_invoker=true) as
SELECT company_id,
    work_package_operation_id,
    count(*)::integer AS resource_count,
    count(*) FILTER (WHERE required_before_start AND waived_at IS NULL AND (resource_status <> ALL (ARRAY['ready'::text, 'waived'::text]) OR blocking_reason IS NOT NULL))::integer AS blocking_resource_count,
    count(*) FILTER (WHERE warning_reason IS NOT NULL)::integer AS warning_resource_count,
    count(*) FILTER (WHERE resource_type = 'material'::text)::integer AS material_count,
    count(*) FILTER (WHERE resource_type = 'equipment'::text)::integer AS equipment_count,
    count(*) FILTER (WHERE resource_type = 'vendor'::text)::integer AS vendor_count,
    COALESCE(array_agg(blocking_reason ORDER BY need_by_date, label) FILTER (WHERE required_before_start AND blocking_reason IS NOT NULL), '{}'::text[]) AS blocking_reasons,
    COALESCE(array_agg(warning_reason ORDER BY need_by_date, label) FILTER (WHERE warning_reason IS NOT NULL), '{}'::text[]) AS warning_reasons,
    min(need_by_date) FILTER (WHERE required_before_start AND (resource_status <> ALL (ARRAY['ready'::text, 'waived'::text]) OR blocking_reason IS NOT NULL)) AS next_blocked_need_by
   FROM public.carez_resource_readiness_v1 r
  GROUP BY company_id, work_package_operation_id;
revoke all on public.carez_resource_summary_v1 from public,anon,authenticated;
grant select on public.carez_resource_summary_v1 to authenticated;

create or replace view public.carez_operation_readiness_v1 with(security_invoker=true) as
SELECT b.*,o.baseline_man_hours_per_unit,
 b.ready_to_start AND COALESCE(rs.blocking_resource_count,0)=0 AS ready_to_start_all,
 COALESCE(rs.blocking_resource_count,0) AS blocking_resource_count,
 COALESCE(rs.warning_resource_count,0) AS resource_warning_count,
 b.blocking_reasons||COALESCE(rs.blocking_reasons,'{}'::text[]) AS all_blocking_reasons,
 b.warning_reasons||COALESCE(rs.warning_reasons,'{}'::text[]) AS all_warning_reasons
FROM (
WITH prior AS (
         SELECT o.company_id,
            o.id AS operation_id,
            count(p.id) FILTER (WHERE p.status <> ALL (ARRAY['completed'::text, 'cancelled'::text]))::integer AS prior_open_count,
            COALESCE(array_agg(COALESCE(p.field_label, t.name) ORDER BY p.sequence) FILTER (WHERE p.id IS NOT NULL AND (p.status <> ALL (ARRAY['completed'::text, 'cancelled'::text]))), '{}'::text[]) AS prior_open_labels
           FROM work_package_operations o
             LEFT JOIN work_package_operations p ON p.company_id = o.company_id AND p.work_package_id = o.work_package_id AND p.sequence < o.sequence
             LEFT JOIN production_tasks t ON t.id = p.production_task_id AND t.company_id = p.company_id
          GROUP BY o.company_id, o.id
        ), inspection_rollup AS (
         SELECT i.company_id,
            i.required_for_operation_id AS operation_id,
            count(*)::integer AS inspection_count,
            count(*) FILTER (WHERE i.status = ANY (ARRAY['passed'::text, 'waived'::text]))::integer AS inspection_clear_count,
            count(*) FILTER (WHERE i.status <> ALL (ARRAY['passed'::text, 'waived'::text]))::integer AS inspection_blocking_count,
            count(*) FILTER (WHERE i.status = 'failed'::text)::integer AS inspection_failed_count,
            min(i.scheduled_date) FILTER (WHERE i.status <> ALL (ARRAY['passed'::text, 'waived'::text, 'cancelled'::text])) AS next_inspection_date,
            COALESCE(array_agg(i.title ORDER BY i.created_at) FILTER (WHERE i.status <> ALL (ARRAY['passed'::text, 'waived'::text])), '{}'::text[]) AS open_inspection_labels
           FROM project_inspections i
          WHERE i.required_for_operation_id IS NOT NULL
          GROUP BY i.company_id, i.required_for_operation_id
        ), scheduled AS (
         SELECT work_schedule_items.company_id,
            work_schedule_items.work_package_operation_id AS operation_id,
            min(work_schedule_items.schedule_date) FILTER (WHERE work_schedule_items.status <> 'cancelled'::text AND work_schedule_items.item_type = 'work'::text) AS scheduled_work_date,
            count(*) FILTER (WHERE (work_schedule_items.status = ANY (ARRAY['confirmed'::text, 'in_progress'::text])) AND work_schedule_items.item_type = 'work'::text)::integer AS confirmed_work_items
           FROM work_schedule_items
          WHERE work_schedule_items.work_package_operation_id IS NOT NULL
          GROUP BY work_schedule_items.company_id, work_schedule_items.work_package_operation_id
        ), facts AS (
         SELECT o.company_id,
            o.id AS operation_id,
            o.work_package_id,
            wp.project_id,
            pr.job_number,
            pr.name AS project_name,
            wp.name AS package_name,
            wp.location,
            wp.drawing_reference,
            o.production_task_id,
            t.name AS task_name,
            o.field_label,
            o.sequence,
            o.planned_quantity,
            o.unit,
            o.measurement_method,
            o.status AS operation_status,
            o.requires_prior_operations,
            o.readiness_hold_reason,
            o.readiness_hold_at,
            COALESCE(j.job_ready, false) AS job_setup_ready,
            COALESCE(j.readiness_reason,CASE WHEN j.project_id IS NULL THEN 'Job setup readiness unavailable' END) AS job_setup_reason,
            COALESCE(px.prior_open_count, 0) AS prior_open_count,
            COALESCE(px.prior_open_labels, '{}'::text[]) AS prior_open_labels,
            COALESCE(ix.inspection_count, 0) AS inspection_count,
            COALESCE(ix.inspection_clear_count, 0) AS inspection_clear_count,
            COALESCE(ix.inspection_blocking_count, 0) AS inspection_blocking_count,
            COALESCE(ix.inspection_failed_count, 0) AS inspection_failed_count,
            ix.next_inspection_date,
            COALESCE(ix.open_inspection_labels, '{}'::text[]) AS open_inspection_labels,
            sx.scheduled_work_date,
            COALESCE(sx.confirmed_work_items, 0) AS confirmed_work_items,
            o.pour_plan_id,
            pp.name AS pour_name,
            pp.status AS pour_status,
            COALESCE(pd.planned_cy, 0::numeric) AS pour_planned_cy,
            COALESCE(pd.ordered_cy, 0::numeric) AS ordered_cy
           FROM work_package_operations o
             JOIN work_packages wp ON wp.id = o.work_package_id AND wp.company_id = o.company_id
             JOIN projects pr ON pr.id = wp.project_id AND pr.company_id = wp.company_id
             JOIN production_tasks t ON t.id = o.production_task_id AND t.company_id = o.company_id
             LEFT JOIN project_job_readiness_summary j ON j.project_id = wp.project_id AND j.company_id = wp.company_id
             LEFT JOIN prior px ON px.operation_id = o.id AND px.company_id = o.company_id
             LEFT JOIN inspection_rollup ix ON ix.operation_id = o.id AND ix.company_id = o.company_id
             LEFT JOIN scheduled sx ON sx.operation_id = o.id AND sx.company_id = o.company_id
             LEFT JOIN pour_plans pp ON pp.id = o.pour_plan_id AND pp.company_id = o.company_id
             LEFT JOIN pour_delivery_actual_summary pd ON pd.pour_plan_id = o.pour_plan_id AND pd.company_id = o.company_id
        ), evaluated AS (
         SELECT f.company_id,
            f.operation_id,
            f.work_package_id,
            f.project_id,
            f.job_number,
            f.project_name,
            f.package_name,
            f.location,
            f.drawing_reference,
            f.production_task_id,
            f.task_name,
            f.field_label,
            f.sequence,
            f.planned_quantity,
            f.unit,
            f.measurement_method,
            f.operation_status,
            f.requires_prior_operations,
            f.readiness_hold_reason,
            f.readiness_hold_at,
            f.job_setup_ready,
            f.job_setup_reason,
            f.prior_open_count,
            f.prior_open_labels,
            f.inspection_count,
            f.inspection_clear_count,
            f.inspection_blocking_count,
            f.inspection_failed_count,
            f.next_inspection_date,
            f.open_inspection_labels,
            f.scheduled_work_date,
            f.confirmed_work_items,
            f.pour_plan_id,
            f.pour_name,
            f.pour_status,
            f.pour_planned_cy,
            f.ordered_cy,
            array_remove(ARRAY[
                CASE
                    WHEN f.operation_status='on_hold' AND f.readiness_hold_reason IS NULL THEN 'Operation is on hold'::text WHEN f.readiness_hold_reason IS NOT NULL THEN 'Management hold: '::text || f.readiness_hold_reason
                    ELSE NULL::text
                END,
                CASE
                    WHEN NOT f.job_setup_ready THEN COALESCE(f.job_setup_reason, 'Job setup is not ready'::text)
                    ELSE NULL::text
                END,
                CASE
                    WHEN f.requires_prior_operations AND f.prior_open_count > 0 THEN 'Finish prior work: '::text || array_to_string(f.prior_open_labels, ', '::text)
                    ELSE NULL::text
                END,
                CASE
                    WHEN f.inspection_failed_count > 0 THEN 'Inspection failed; correct work and obtain a passing result'::text
                    ELSE NULL::text
                END,
                CASE
                    WHEN f.inspection_blocking_count > 0 AND f.inspection_failed_count = 0 THEN 'Inspection not cleared: '::text || array_to_string(f.open_inspection_labels, ', '::text)
                    ELSE NULL::text
                END,
                CASE
                    WHEN f.measurement_method = 'ticket'::text AND f.pour_plan_id IS NULL THEN 'Concrete placement is not linked to a Pour Plan'::text
                    ELSE NULL::text
                END,
                CASE
                    WHEN f.measurement_method = 'ticket'::text AND f.pour_plan_id IS NOT NULL AND (COALESCE(f.pour_status, 'planning'::text) <> ALL (ARRAY['authorized'::text, 'completed'::text])) THEN 'Pour is not authorized'::text
                    ELSE NULL::text
                END,
                CASE
                    WHEN f.measurement_method = 'ticket'::text AND f.pour_plan_id IS NOT NULL AND COALESCE(f.pour_status, 'planning'::text) = 'authorized'::text AND f.ordered_cy <= 0::numeric THEN 'Ready-mix order has not been issued'::text
                    ELSE NULL::text
                END], NULL::text) AS blocking_reasons,
            array_remove(ARRAY[
                CASE
                    WHEN f.measurement_method = 'ticket'::text AND f.ordered_cy > 0::numeric AND f.pour_planned_cy > 0::numeric AND f.ordered_cy < f.pour_planned_cy THEN 'Concrete order is below planned CY'::text
                    ELSE NULL::text
                END,
                CASE
                    WHEN f.scheduled_work_date IS NOT NULL AND f.next_inspection_date IS NOT NULL AND f.next_inspection_date >= f.scheduled_work_date THEN 'Inspection is scheduled on or after the planned work date'::text
                    ELSE NULL::text
                END], NULL::text) AS warning_reasons
           FROM facts f
        )
 SELECT company_id,
    operation_id,
    work_package_id,
    project_id,
    job_number,
    project_name,
    package_name,
    location,
    drawing_reference,
    production_task_id,
    task_name,
    field_label,
    sequence,
    planned_quantity,
    unit,
    measurement_method,
    operation_status,
    requires_prior_operations,
    readiness_hold_reason,
    readiness_hold_at,
    job_setup_ready,
    job_setup_reason,
    prior_open_count,
    prior_open_labels,
    inspection_count,
    inspection_clear_count,
    inspection_blocking_count,
    inspection_failed_count,
    next_inspection_date,
    open_inspection_labels,
    scheduled_work_date,
    confirmed_work_items,
    pour_plan_id,
    pour_name,
    pour_status,
    pour_planned_cy,
    ordered_cy,
    blocking_reasons,
    warning_reasons,
        CASE
            WHEN operation_status = 'completed'::text THEN false
            WHEN operation_status = 'cancelled'::text THEN false
            ELSE cardinality(blocking_reasons) = 0
        END AS ready_to_start,
        CASE
            WHEN operation_status = 'completed'::text THEN 'completed'::text
            WHEN operation_status = 'cancelled'::text THEN 'cancelled'::text
            WHEN operation_status='on_hold' OR readiness_hold_reason IS NOT NULL THEN 'management_hold'::text
            WHEN NOT job_setup_ready THEN 'job_setup_hold'::text
            WHEN requires_prior_operations AND prior_open_count > 0 THEN 'waiting_prior_work'::text
            WHEN inspection_failed_count > 0 THEN 'inspection_failed'::text
            WHEN inspection_blocking_count > 0 THEN 'waiting_inspection'::text
            WHEN measurement_method = 'ticket'::text AND pour_plan_id IS NULL THEN 'waiting_pour_link'::text
            WHEN measurement_method = 'ticket'::text AND (COALESCE(pour_status, 'planning'::text) <> ALL (ARRAY['authorized'::text, 'completed'::text])) THEN 'waiting_pour_authorization'::text
            WHEN measurement_method = 'ticket'::text AND pour_status = 'authorized'::text AND ordered_cy <= 0::numeric THEN 'waiting_concrete_order'::text
            ELSE 'ready'::text
        END AS readiness_status,
        CASE
            WHEN operation_status = ANY (ARRAY['completed'::text, 'cancelled'::text]) THEN initcap(operation_status)
            WHEN cardinality(blocking_reasons) = 0 THEN 'Ready to start'::text
            ELSE blocking_reasons[1]
        END AS next_action
   FROM evaluated e)b
JOIN public.work_package_operations o ON o.company_id=b.company_id AND o.id=b.operation_id
LEFT JOIN public.carez_resource_summary_v1 rs ON rs.company_id=b.company_id AND rs.work_package_operation_id=b.operation_id;
revoke all on public.carez_operation_readiness_v1 from public,anon,authenticated;
grant select on public.carez_operation_readiness_v1 to authenticated;

create or replace view public.carez_start_readiness_v1 with(security_invoker=true) as
SELECT s.*,b.baseline_man_hours_per_unit FROM (
SELECT b.company_id,
    b.operation_id,
    b.work_package_id,
    b.project_id,
    b.job_number,
    b.project_name,
    b.package_name,
    b.location,
    b.drawing_reference,
    b.production_task_id,
    b.task_name,
    b.field_label,
    b.sequence,
    b.planned_quantity,
    b.unit,
    b.measurement_method,
    b.operation_status,
    b.requires_prior_operations,
    b.readiness_hold_reason,
    b.readiness_hold_at,
    b.job_setup_ready,
    b.job_setup_reason,
    b.prior_open_count,
    b.prior_open_labels,
    b.inspection_count,
    b.inspection_clear_count,
    b.inspection_blocking_count,
    b.inspection_failed_count,
    b.next_inspection_date,
    b.open_inspection_labels,
    b.scheduled_work_date,
    b.confirmed_work_items,
    b.pour_plan_id,
    b.pour_name,
    b.pour_status,
    b.pour_planned_cy,
    b.ordered_cy,
    b.blocking_reasons,
    b.warning_reasons,
    b.ready_to_start,
    b.readiness_status,
    b.next_action,
    COALESCE(rs.resource_count, 0) AS resource_count,
    COALESCE(rs.blocking_resource_count, 0) AS blocking_resource_count,
    COALESCE(rs.warning_resource_count, 0) AS resource_warning_count,
    COALESCE(rs.material_count, 0) AS material_count,
    COALESCE(rs.equipment_count, 0) AS equipment_count,
    COALESCE(rs.vendor_count, 0) AS vendor_count,
    COALESCE(rs.blocking_reasons, '{}'::text[]) AS resource_blocking_reasons,
    COALESCE(rs.warning_reasons, '{}'::text[]) AS resource_warning_reasons,
    b.blocking_reasons || COALESCE(rs.blocking_reasons, '{}'::text[]) AS all_blocking_reasons,
    b.warning_reasons || COALESCE(rs.warning_reasons, '{}'::text[]) AS all_warning_reasons,
    b.ready_to_start AND COALESCE(rs.blocking_resource_count, 0) = 0 AS ready_to_start_all,
        CASE
            WHEN NOT b.ready_to_start THEN b.readiness_status
            WHEN COALESCE(rs.blocking_resource_count, 0) > 0 THEN 'resource_hold'::text
            WHEN COALESCE(rs.warning_resource_count, 0) > 0 OR cardinality(b.warning_reasons) > 0 THEN 'ready_with_warning'::text
            ELSE 'ready'::text
        END AS start_readiness_status,
        CASE
            WHEN NOT b.ready_to_start THEN b.next_action
            WHEN COALESCE(rs.blocking_resource_count, 0) > 0 THEN rs.blocking_reasons[1]
            WHEN COALESCE(rs.warning_resource_count, 0) > 0 THEN 'Ready, but check: '::text || rs.warning_reasons[1]
            ELSE 'Ready to start'::text
        END AS start_next_action
   FROM public.carez_operation_readiness_v1 b
     LEFT JOIN public.carez_resource_summary_v1 rs ON rs.company_id = b.company_id AND rs.work_package_operation_id = b.operation_id
)s JOIN public.carez_operation_readiness_v1 b ON b.company_id=s.company_id AND b.operation_id=s.operation_id;
revoke all on public.carez_start_readiness_v1 from public,anon,authenticated;
grant select on public.carez_start_readiness_v1 to authenticated;

create or replace view public.carez_delivery_sync_v1 with(security_invoker=true) as
SELECT d.company_id,
    d.pour_plan_id,
    d.project_id,
    d.job_number,
    d.project_name,
    d.pour_name,
    d.pour_status,
    d.scheduled_date,
    d.planned_cy,
    d.ordered_cy,
    d.delivered_cy,
    d.variance_to_plan_cy,
    d.remaining_to_plan_cy,
    d.percent_of_plan_delivered,
    d.concrete_ticket_count,
    d.ticket_photo_count,
    d.tickets_missing_photo,
    d.first_delivery_date,
    d.latest_delivery_date,
    o.id AS operation_id,
    o.work_package_id,
    wp.name AS package_name,
    wp.location AS package_location,
    o.production_task_id,
    t.name AS task_name,
    o.field_label,
    o.planned_quantity AS operation_planned_quantity,
    o.unit AS operation_unit,
    o.status AS operation_status,
    o.actual_quantity,
    o.actual_quantity_source,
    o.quantity_review_status,
    o.quantity_review_reason,
    o.quantity_synced_at,
        CASE
            WHEN o.id IS NULL THEN 'unlinked'::text
            WHEN d.pour_status = 'cancelled'::text THEN 'cancelled'::text
            WHEN COALESCE(d.delivered_cy, 0::numeric) <= 0::numeric AND d.pour_status = 'completed'::text THEN 'closed_no_delivery'::text
            WHEN COALESCE(d.delivered_cy, 0::numeric) <= 0::numeric THEN 'waiting_delivery'::text
            WHEN COALESCE(d.tickets_missing_photo, 0) > 0 THEN 'missing_evidence'::text
            WHEN d.pour_status <> 'completed'::text THEN 'pour_open'::text
            WHEN o.status = 'completed'::text AND o.quantity_review_status = 'needs_review'::text THEN 'needs_review'::text
            WHEN o.status = 'completed'::text AND o.quantity_review_status = 'excluded'::text THEN 'excluded'::text
            WHEN o.status = 'completed'::text THEN 'synced'::text
            ELSE 'ready_to_sync'::text
        END AS sync_status,
    o.id IS NOT NULL AND d.pour_status = 'completed'::text AND COALESCE(d.delivered_cy, 0::numeric) > 0::numeric AND COALESCE(d.tickets_missing_photo, 0) = 0 AS can_auto_complete
   FROM pour_delivery_actual_summary d
     LEFT JOIN work_package_operations o ON o.company_id=d.company_id AND o.pour_plan_id = d.pour_plan_id AND o.measurement_method = 'ticket'::text AND o.status <> 'cancelled'::text
     LEFT JOIN work_packages wp ON wp.id = o.work_package_id AND wp.company_id = o.company_id
     LEFT JOIN production_tasks t ON t.id = o.production_task_id AND t.company_id = o.company_id;
revoke all on public.carez_delivery_sync_v1 from public,anon,authenticated;
grant select on public.carez_delivery_sync_v1 to authenticated;

create or replace view public.carez_lookahead_v1 with(security_invoker=true) as
WITH assigned AS (
         SELECT a.company_id,
            a.schedule_item_id,
            count(*)::integer AS assigned_crew
           FROM work_schedule_assignments a
          GROUP BY a.company_id, a.schedule_item_id
        ), scheduled AS (
         SELECT w.company_id,
            w.id AS schedule_item_id,
            w.project_id,
            w.schedule_date,
            w.start_time,
            w.end_time,
            w.title,w.item_type,
            w.status AS schedule_status,
            w.crew_needed,
            COALESCE(a.assigned_crew, 0) AS assigned_crew,
            w.work_package_operation_id
           FROM work_schedule_items w
             LEFT JOIN assigned a ON a.company_id = w.company_id AND a.schedule_item_id = w.id
          WHERE w.item_type = 'work'::text AND w.status <> 'cancelled'::text AND w.work_package_operation_id IS NOT NULL
        ), risk AS (
         SELECT production_operation_risk.company_id,production_operation_risk.operation_id,
            production_operation_risk.budgeted_man_hours,
            production_operation_risk.tracked_man_hours,
            production_operation_risk.budget_hours_used_percent
           FROM production_operation_risk
        )
 SELECT s.company_id,
    s.schedule_item_id,
    s.project_id,
    s.schedule_date,
    s.start_time,
    s.end_time,
    s.title,
    s.schedule_status,s.schedule_status AS status,s.item_type,
    s.crew_needed,
    s.assigned_crew,
    s.work_package_operation_id,
    r.job_number,
    r.project_name,
    r.package_name,
    r.location,
    r.task_name,
    r.field_label,
    r.planned_quantity,
    r.unit,
    r.operation_status,
    r.ready_to_start_all AS ready_to_start,
    r.start_readiness_status AS readiness_status,
    r.start_next_action AS next_action,
    r.all_blocking_reasons AS blocking_reasons,
    r.all_warning_reasons AS warning_reasons,
    r.blocking_resource_count,
    r.resource_warning_count,
    r.prior_open_count,
    r.inspection_blocking_count,
    risk.budgeted_man_hours,
    risk.tracked_man_hours,
    risk.budget_hours_used_percent,
        CASE
            WHEN NOT r.ready_to_start_all AND risk.budgeted_man_hours IS NOT NULL THEN GREATEST(risk.budgeted_man_hours - COALESCE(risk.tracked_man_hours, 0::numeric), 0::numeric)
            ELSE 0::numeric
        END AS planned_man_hours_at_risk,
    alt.operation_id AS replacement_operation_id,
    alt.package_name AS replacement_package_name,
    alt.work_label AS replacement_work_label
   FROM scheduled s
     JOIN public.carez_start_readiness_v1 r ON r.company_id = s.company_id AND r.operation_id = s.work_package_operation_id
     LEFT JOIN risk ON risk.company_id=s.company_id AND risk.operation_id = s.work_package_operation_id
     LEFT JOIN LATERAL ( SELECT ar.operation_id,
            ar.package_name,
            COALESCE(ar.field_label, ar.task_name) AS work_label
           FROM public.carez_start_readiness_v1 ar
          WHERE ar.company_id = s.company_id AND ar.project_id = s.project_id AND ar.ready_to_start_all AND (ar.operation_status = ANY (ARRAY['planned'::text, 'in_progress'::text, 'on_hold'::text])) AND ar.operation_id <> s.work_package_operation_id AND NOT (EXISTS ( SELECT 1
                   FROM work_schedule_items x
                  WHERE x.company_id = s.company_id AND x.schedule_date = s.schedule_date AND x.status <> 'cancelled'::text AND x.work_package_operation_id = ar.operation_id))
          ORDER BY ar.sequence, ar.package_name
         LIMIT 1) alt ON true;
revoke all on public.carez_lookahead_v1 from public,anon,authenticated;
grant select on public.carez_lookahead_v1 to authenticated;

create or replace view public.carez_project_work_readiness_v1 with(security_invoker=true) as
WITH measures AS (
SELECT p.company_id,p.id AS project_id,p.job_number,p.name AS project_name,
 count(r.operation_id)::integer AS operation_count,
 count(r.operation_id) FILTER(WHERE r.operation_status IN ('planned','in_progress','on_hold'))::integer AS open_operations,
 count(r.operation_id) FILTER(WHERE r.operation_status IN ('planned','in_progress','on_hold') AND r.ready_to_start_all)::integer AS ready_operation_count,
 count(r.operation_id) FILTER(WHERE r.operation_status IN ('planned','in_progress','on_hold') AND NOT r.ready_to_start_all)::integer AS blocked_operation_count,
 count(r.operation_id) FILTER(WHERE r.operation_status IN ('planned','in_progress','on_hold') AND r.inspection_blocking_count>0)::integer AS inspection_blocked_operations,
 count(r.operation_id) FILTER(WHERE r.operation_status IN ('planned','in_progress','on_hold') AND r.inspection_failed_count>0)::integer AS failed_inspection_operations,
 min(r.scheduled_work_date) FILTER(WHERE r.operation_status IN ('planned','in_progress','on_hold')) AS next_work_date
FROM public.projects p LEFT JOIN public.carez_start_readiness_v1 r ON r.company_id=p.company_id AND r.project_id=p.id GROUP BY p.company_id,p.id,p.job_number,p.name)
SELECT m.*,project_name AS name,ready_operation_count AS ready_operations,blocked_operation_count AS blocked_operations,
 next_work_date AS next_scheduled_work_date,
 CASE WHEN blocked_operation_count>0 THEN 'blocked' WHEN ready_operation_count>0 THEN 'ready' ELSE 'no_work' END AS readiness_status
FROM measures m;
revoke all on public.carez_project_work_readiness_v1 from public,anon,authenticated;
grant select on public.carez_project_work_readiness_v1 to authenticated;

create function pg_temp.carez_connect_view(p_name text,p_canonical text,p_source jsonb,p_deployed jsonb) returns void language plpgsql as $$
declare v_shape jsonb;v_sql text;v_names text[];v_more text;
begin
 select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod)) order by a.attnum),array_agg(a.attname order by a.attnum)
 into v_shape,v_names from pg_attribute a where a.attrelid=('public.'||p_name)::regclass and a.attnum>0 and not a.attisdropped;
 if v_shape is distinct from p_source and v_shape is distinct from p_deployed then raise exception 'Unrecognized % read contract: %',p_name,v_shape;end if;
 if exists(select 1 from unnest(v_names)n where not exists(select 1 from pg_attribute a where a.attrelid=('public.'||p_canonical)::regclass and a.attname=n and a.attnum>0 and not a.attisdropped)) then raise exception 'Canonical % is missing an existing field',p_name;end if;
 select string_agg(format('v.%I::%s AS %I',a.attname,format_type(a.atttypid,a.atttypmod),a.attname),',' order by a.attnum) into v_sql from pg_attribute a where a.attrelid=('public.'||p_name)::regclass and a.attnum>0 and not a.attisdropped;
 select string_agg(format('v.%I',a.attname),',' order by a.attnum) into v_more from pg_attribute a where a.attrelid=('public.'||p_canonical)::regclass and a.attnum>0 and not a.attisdropped and not(a.attname=any(v_names));
 execute format('create or replace view public.%I with(security_invoker=true) as select %s%s from public.%I v',p_name,v_sql,case when v_more is null then '' else ','||v_more end,p_canonical);
 execute format('revoke all on public.%I from public,anon,authenticated',p_name);execute format('grant select on public.%I to authenticated',p_name);
end $$;

select pg_temp.carez_connect_view('work_package_resource_requirement_status','carez_resource_readiness_v1',$shape$[{"name":"company_id","type":"uuid"},{"name":"id","type":"uuid"},{"name":"work_package_operation_id","type":"uuid"},{"name":"resource_type","type":"text"},{"name":"label","type":"text"},{"name":"required_quantity","type":"numeric(14,4)"},{"name":"unit","type":"text"},{"name":"inventory_item_id","type":"uuid"},{"name":"equipment_asset_id","type":"uuid"},{"name":"vendor_id","type":"uuid"},{"name":"purchase_order_line_id","type":"uuid"},{"name":"required_before_start","type":"boolean"},{"name":"need_by_override","type":"date"},{"name":"need_by_date","type":"date"},{"name":"vendor_status","type":"text"},{"name":"vendor_reference","type":"text"},{"name":"notes","type":"text"},{"name":"waived_at","type":"timestamp with time zone"},{"name":"waiver_reason","type":"text"},{"name":"project_id","type":"uuid"},{"name":"job_number","type":"text"},{"name":"project_name","type":"text"},{"name":"package_name","type":"text"},{"name":"location","type":"text"},{"name":"field_label","type":"text"},{"name":"task_name","type":"text"},{"name":"operation_status","type":"text"},{"name":"resource_status","type":"text"},{"name":"safe_inventory_qty","type":"numeric"},{"name":"received_qty","type":"numeric"},{"name":"shortage_quantity","type":"numeric"},{"name":"requirement_reserved_qty","type":"numeric"},{"name":"equipment_name","type":"text"},{"name":"equipment_start_date","type":"text"},{"name":"equipment_end_date","type":"text"},{"name":"vendor_name","type":"text"},{"name":"blocking_reason","type":"text"},{"name":"warning_reason","type":"text"}]$shape$::jsonb,$shape$[{"name":"id","type":"uuid"},{"name":"company_id","type":"uuid"},{"name":"work_package_operation_id","type":"uuid"},{"name":"resource_type","type":"text"},{"name":"label","type":"text"},{"name":"required_quantity","type":"numeric"},{"name":"unit","type":"text"},{"name":"inventory_item_id","type":"uuid"},{"name":"equipment_asset_id","type":"uuid"},{"name":"vendor_id","type":"uuid"},{"name":"purchase_order_line_id","type":"uuid"},{"name":"required_before_start","type":"boolean"},{"name":"need_offset_days","type":"integer"},{"name":"need_by_override","type":"date"},{"name":"vendor_status","type":"text"},{"name":"vendor_reference","type":"text"},{"name":"waived_at","type":"timestamp with time zone"},{"name":"waived_by","type":"uuid"},{"name":"waiver_reason","type":"text"},{"name":"notes","type":"text"},{"name":"created_by","type":"uuid"},{"name":"created_at","type":"timestamp with time zone"},{"name":"updated_at","type":"timestamp with time zone"},{"name":"work_package_id","type":"uuid"},{"name":"project_id","type":"uuid"},{"name":"planned_start_date","type":"date"},{"name":"need_by_date","type":"date"},{"name":"inventory_name","type":"text"},{"name":"quantity_on_hand","type":"numeric"},{"name":"inventory_active","type":"boolean"},{"name":"requirement_reserved_qty","type":"numeric"},{"name":"total_reserved_qty","type":"numeric"},{"name":"po_status","type":"text"},{"name":"expected_delivery_date","type":"date"},{"name":"ordered_qty","type":"numeric(12,4)"},{"name":"received_qty","type":"numeric"},{"name":"po_number","type":"text"},{"name":"equipment_start_date","type":"date"},{"name":"equipment_end_date","type":"date"},{"name":"reservation_status","type":"text"},{"name":"equipment_name","type":"text"},{"name":"equipment_active","type":"boolean"},{"name":"equipment_status","type":"text"},{"name":"next_service_date","type":"date"},{"name":"conflict_count","type":"integer"},{"name":"vendor_name","type":"text"},{"name":"vendor_active","type":"boolean"},{"name":"safe_inventory_qty","type":"numeric"},{"name":"shortage_quantity","type":"numeric"},{"name":"resource_status","type":"text"},{"name":"blocking_reason","type":"text"},{"name":"warning_reason","type":"text"}]$shape$::jsonb);

select pg_temp.carez_connect_view('work_package_resource_summary','carez_resource_summary_v1',$shape$[{"name":"company_id","type":"uuid"},{"name":"work_package_operation_id","type":"uuid"},{"name":"resource_count","type":"integer"},{"name":"blocking_resource_count","type":"integer"},{"name":"warning_resource_count","type":"integer"},{"name":"material_count","type":"integer"},{"name":"equipment_count","type":"integer"},{"name":"vendor_count","type":"integer"},{"name":"blocking_reasons","type":"text[]"},{"name":"warning_reasons","type":"text[]"},{"name":"next_blocked_need_by","type":"date"}]$shape$::jsonb,$shape$[{"name":"company_id","type":"uuid"},{"name":"work_package_operation_id","type":"uuid"},{"name":"resource_count","type":"integer"},{"name":"blocking_resource_count","type":"integer"},{"name":"warning_resource_count","type":"integer"},{"name":"material_count","type":"integer"},{"name":"equipment_count","type":"integer"},{"name":"vendor_count","type":"integer"},{"name":"blocking_reasons","type":"text[]"},{"name":"warning_reasons","type":"text[]"},{"name":"next_blocked_need_by","type":"date"}]$shape$::jsonb);

select pg_temp.carez_connect_view('work_package_operation_readiness','carez_operation_readiness_v1',$shape$[{"name":"company_id","type":"uuid"},{"name":"operation_id","type":"uuid"},{"name":"project_id","type":"uuid"},{"name":"project_name","type":"text"},{"name":"job_number","type":"text"},{"name":"work_package_id","type":"uuid"},{"name":"package_name","type":"text"},{"name":"location","type":"text"},{"name":"field_label","type":"text"},{"name":"task_name","type":"text"},{"name":"planned_quantity","type":"numeric(14,4)"},{"name":"unit","type":"text"},{"name":"operation_status","type":"text"},{"name":"sequence","type":"integer"},{"name":"scheduled_work_date","type":"date"},{"name":"baseline_man_hours_per_unit","type":"numeric(12,6)"},{"name":"ready_to_start","type":"boolean"},{"name":"ready_to_start_all","type":"boolean"},{"name":"readiness_status","type":"text"},{"name":"next_action","type":"text"},{"name":"blocking_reasons","type":"text[]"},{"name":"warning_reasons","type":"text[]"},{"name":"prior_open_count","type":"integer"},{"name":"requires_prior_operations","type":"boolean"},{"name":"inspection_blocking_count","type":"integer"},{"name":"inspection_clear_count","type":"integer"},{"name":"inspection_count","type":"integer"},{"name":"measurement_method","type":"text"},{"name":"pour_status","type":"text"},{"name":"ordered_cy","type":"numeric"},{"name":"pour_name","type":"text"},{"name":"readiness_hold_reason","type":"text"},{"name":"blocking_resource_count","type":"integer"},{"name":"resource_warning_count","type":"integer"},{"name":"all_blocking_reasons","type":"text[]"},{"name":"all_warning_reasons","type":"text[]"}]$shape$::jsonb,$shape$[{"name":"company_id","type":"uuid"},{"name":"operation_id","type":"uuid"},{"name":"work_package_id","type":"uuid"},{"name":"project_id","type":"uuid"},{"name":"job_number","type":"text"},{"name":"project_name","type":"text"},{"name":"package_name","type":"text"},{"name":"location","type":"text"},{"name":"drawing_reference","type":"text"},{"name":"production_task_id","type":"uuid"},{"name":"task_name","type":"text"},{"name":"field_label","type":"text"},{"name":"sequence","type":"integer"},{"name":"planned_quantity","type":"numeric"},{"name":"unit","type":"text"},{"name":"measurement_method","type":"text"},{"name":"operation_status","type":"text"},{"name":"requires_prior_operations","type":"boolean"},{"name":"readiness_hold_reason","type":"text"},{"name":"readiness_hold_at","type":"timestamp with time zone"},{"name":"job_setup_ready","type":"boolean"},{"name":"job_setup_reason","type":"text"},{"name":"prior_open_count","type":"integer"},{"name":"prior_open_labels","type":"text[]"},{"name":"inspection_count","type":"integer"},{"name":"inspection_clear_count","type":"integer"},{"name":"inspection_blocking_count","type":"integer"},{"name":"inspection_failed_count","type":"integer"},{"name":"next_inspection_date","type":"date"},{"name":"open_inspection_labels","type":"text[]"},{"name":"scheduled_work_date","type":"date"},{"name":"confirmed_work_items","type":"integer"},{"name":"pour_plan_id","type":"uuid"},{"name":"pour_name","type":"text"},{"name":"pour_status","type":"text"},{"name":"pour_planned_cy","type":"numeric"},{"name":"ordered_cy","type":"numeric"},{"name":"blocking_reasons","type":"text[]"},{"name":"warning_reasons","type":"text[]"},{"name":"ready_to_start","type":"boolean"},{"name":"readiness_status","type":"text"},{"name":"next_action","type":"text"}]$shape$::jsonb);

select pg_temp.carez_connect_view('work_package_start_readiness','carez_start_readiness_v1',$shape$[{"name":"company_id","type":"uuid"},{"name":"operation_id","type":"uuid"},{"name":"project_id","type":"uuid"},{"name":"project_name","type":"text"},{"name":"job_number","type":"text"},{"name":"work_package_id","type":"uuid"},{"name":"package_name","type":"text"},{"name":"location","type":"text"},{"name":"field_label","type":"text"},{"name":"task_name","type":"text"},{"name":"planned_quantity","type":"numeric(14,4)"},{"name":"unit","type":"text"},{"name":"operation_status","type":"text"},{"name":"sequence","type":"integer"},{"name":"scheduled_work_date","type":"date"},{"name":"ready_to_start","type":"boolean"},{"name":"ready_to_start_all","type":"boolean"},{"name":"readiness_status","type":"text"},{"name":"start_next_action","type":"text"},{"name":"blocking_reasons","type":"text[]"},{"name":"warning_reasons","type":"text[]"},{"name":"all_blocking_reasons","type":"text[]"},{"name":"all_warning_reasons","type":"text[]"},{"name":"prior_open_count","type":"integer"},{"name":"requires_prior_operations","type":"boolean"},{"name":"inspection_blocking_count","type":"integer"},{"name":"inspection_clear_count","type":"integer"},{"name":"inspection_count","type":"integer"},{"name":"measurement_method","type":"text"},{"name":"pour_status","type":"text"},{"name":"ordered_cy","type":"numeric"},{"name":"pour_name","type":"text"},{"name":"readiness_hold_reason","type":"text"},{"name":"blocking_resource_count","type":"integer"},{"name":"resource_warning_count","type":"integer"}]$shape$::jsonb,$shape$[{"name":"company_id","type":"uuid"},{"name":"operation_id","type":"uuid"},{"name":"work_package_id","type":"uuid"},{"name":"project_id","type":"uuid"},{"name":"job_number","type":"text"},{"name":"project_name","type":"text"},{"name":"package_name","type":"text"},{"name":"location","type":"text"},{"name":"drawing_reference","type":"text"},{"name":"production_task_id","type":"uuid"},{"name":"task_name","type":"text"},{"name":"field_label","type":"text"},{"name":"sequence","type":"integer"},{"name":"planned_quantity","type":"numeric"},{"name":"unit","type":"text"},{"name":"measurement_method","type":"text"},{"name":"operation_status","type":"text"},{"name":"requires_prior_operations","type":"boolean"},{"name":"readiness_hold_reason","type":"text"},{"name":"readiness_hold_at","type":"timestamp with time zone"},{"name":"job_setup_ready","type":"boolean"},{"name":"job_setup_reason","type":"text"},{"name":"prior_open_count","type":"integer"},{"name":"prior_open_labels","type":"text[]"},{"name":"inspection_count","type":"integer"},{"name":"inspection_clear_count","type":"integer"},{"name":"inspection_blocking_count","type":"integer"},{"name":"inspection_failed_count","type":"integer"},{"name":"next_inspection_date","type":"date"},{"name":"open_inspection_labels","type":"text[]"},{"name":"scheduled_work_date","type":"date"},{"name":"confirmed_work_items","type":"integer"},{"name":"pour_plan_id","type":"uuid"},{"name":"pour_name","type":"text"},{"name":"pour_status","type":"text"},{"name":"pour_planned_cy","type":"numeric"},{"name":"ordered_cy","type":"numeric"},{"name":"blocking_reasons","type":"text[]"},{"name":"warning_reasons","type":"text[]"},{"name":"ready_to_start","type":"boolean"},{"name":"readiness_status","type":"text"},{"name":"next_action","type":"text"},{"name":"resource_count","type":"integer"},{"name":"blocking_resource_count","type":"integer"},{"name":"resource_warning_count","type":"integer"},{"name":"material_count","type":"integer"},{"name":"equipment_count","type":"integer"},{"name":"vendor_count","type":"integer"},{"name":"resource_blocking_reasons","type":"text[]"},{"name":"resource_warning_reasons","type":"text[]"},{"name":"all_blocking_reasons","type":"text[]"},{"name":"all_warning_reasons","type":"text[]"},{"name":"ready_to_start_all","type":"boolean"},{"name":"start_readiness_status","type":"text"},{"name":"start_next_action","type":"text"}]$shape$::jsonb);

select pg_temp.carez_connect_view('pour_work_package_delivery_sync','carez_delivery_sync_v1',$shape$[{"name":"company_id","type":"uuid"},{"name":"pour_plan_id","type":"uuid"},{"name":"project_id","type":"uuid"},{"name":"job_number","type":"text"},{"name":"pour_name","type":"text"},{"name":"scheduled_date","type":"date"},{"name":"pour_status","type":"text"},{"name":"planned_cy","type":"numeric(14,2)"},{"name":"ordered_cy","type":"numeric"},{"name":"delivered_cy","type":"numeric"},{"name":"remaining_to_plan_cy","type":"numeric(14,2)"},{"name":"variance_to_plan_cy","type":"numeric"},{"name":"percent_of_plan_delivered","type":"numeric"},{"name":"concrete_ticket_count","type":"integer"},{"name":"ticket_photo_count","type":"integer"},{"name":"tickets_missing_photo","type":"integer"},{"name":"first_delivery_date","type":"date"},{"name":"latest_delivery_date","type":"date"},{"name":"operation_id","type":"uuid"},{"name":"operation_status","type":"text"},{"name":"operation_planned_quantity","type":"numeric(14,4)"},{"name":"actual_quantity","type":"numeric(14,4)"},{"name":"quantity_review_status","type":"text"},{"name":"quantity_review_reason","type":"text"},{"name":"package_name","type":"text"},{"name":"package_location","type":"text"},{"name":"field_label","type":"text"},{"name":"task_name","type":"text"},{"name":"sync_status","type":"text"}]$shape$::jsonb,$shape$[{"name":"company_id","type":"uuid"},{"name":"pour_plan_id","type":"uuid"},{"name":"project_id","type":"uuid"},{"name":"job_number","type":"text"},{"name":"project_name","type":"text"},{"name":"pour_name","type":"text"},{"name":"pour_status","type":"text"},{"name":"scheduled_date","type":"date"},{"name":"planned_cy","type":"numeric"},{"name":"ordered_cy","type":"numeric"},{"name":"delivered_cy","type":"numeric"},{"name":"variance_to_plan_cy","type":"numeric"},{"name":"remaining_to_plan_cy","type":"numeric"},{"name":"percent_of_plan_delivered","type":"numeric"},{"name":"concrete_ticket_count","type":"integer"},{"name":"ticket_photo_count","type":"integer"},{"name":"tickets_missing_photo","type":"integer"},{"name":"first_delivery_date","type":"date"},{"name":"latest_delivery_date","type":"date"},{"name":"operation_id","type":"uuid"},{"name":"work_package_id","type":"uuid"},{"name":"package_name","type":"text"},{"name":"package_location","type":"text"},{"name":"production_task_id","type":"uuid"},{"name":"task_name","type":"text"},{"name":"field_label","type":"text"},{"name":"operation_planned_quantity","type":"numeric"},{"name":"operation_unit","type":"text"},{"name":"operation_status","type":"text"},{"name":"actual_quantity","type":"numeric"},{"name":"actual_quantity_source","type":"text"},{"name":"quantity_review_status","type":"text"},{"name":"quantity_review_reason","type":"text"},{"name":"quantity_synced_at","type":"timestamp with time zone"},{"name":"sync_status","type":"text"},{"name":"can_auto_complete","type":"boolean"}]$shape$::jsonb);

select pg_temp.carez_connect_view('work_package_lookahead','carez_lookahead_v1',$shape$[{"name":"company_id","type":"uuid"},{"name":"schedule_item_id","type":"uuid"},{"name":"project_id","type":"uuid"},{"name":"schedule_date","type":"date"},{"name":"start_time","type":"time without time zone"},{"name":"end_time","type":"time without time zone"},{"name":"status","type":"text"},{"name":"item_type","type":"text"},{"name":"job_number","type":"text"},{"name":"project_name","type":"text"},{"name":"package_name","type":"text"},{"name":"location","type":"text"},{"name":"work_package_operation_id","type":"uuid"},{"name":"field_label","type":"text"},{"name":"task_name","type":"text"},{"name":"planned_quantity","type":"numeric(14,4)"},{"name":"unit","type":"text"},{"name":"crew_needed","type":"integer"},{"name":"assigned_crew","type":"integer"},{"name":"ready_to_start","type":"boolean"},{"name":"warning_reasons","type":"text[]"},{"name":"next_action","type":"text"},{"name":"planned_man_hours_at_risk","type":"numeric"},{"name":"blocking_reasons","type":"text[]"},{"name":"blocking_resource_count","type":"integer"},{"name":"resource_warning_count","type":"integer"},{"name":"replacement_operation_id","type":"uuid"},{"name":"replacement_package_name","type":"text"},{"name":"replacement_work_label","type":"text"}]$shape$::jsonb,$shape$[{"name":"company_id","type":"uuid"},{"name":"schedule_item_id","type":"uuid"},{"name":"project_id","type":"uuid"},{"name":"schedule_date","type":"date"},{"name":"start_time","type":"time without time zone"},{"name":"end_time","type":"time without time zone"},{"name":"title","type":"text"},{"name":"schedule_status","type":"text"},{"name":"crew_needed","type":"integer"},{"name":"assigned_crew","type":"integer"},{"name":"work_package_operation_id","type":"uuid"},{"name":"job_number","type":"text"},{"name":"project_name","type":"text"},{"name":"package_name","type":"text"},{"name":"location","type":"text"},{"name":"task_name","type":"text"},{"name":"field_label","type":"text"},{"name":"planned_quantity","type":"numeric"},{"name":"unit","type":"text"},{"name":"operation_status","type":"text"},{"name":"ready_to_start","type":"boolean"},{"name":"readiness_status","type":"text"},{"name":"next_action","type":"text"},{"name":"blocking_reasons","type":"text[]"},{"name":"warning_reasons","type":"text[]"},{"name":"blocking_resource_count","type":"integer"},{"name":"resource_warning_count","type":"integer"},{"name":"prior_open_count","type":"integer"},{"name":"inspection_blocking_count","type":"integer"},{"name":"budgeted_man_hours","type":"numeric"},{"name":"tracked_man_hours","type":"numeric"},{"name":"budget_hours_used_percent","type":"numeric"},{"name":"planned_man_hours_at_risk","type":"numeric"},{"name":"replacement_operation_id","type":"uuid"},{"name":"replacement_package_name","type":"text"},{"name":"replacement_work_label","type":"text"}]$shape$::jsonb);

select pg_temp.carez_connect_view('project_work_readiness_summary','carez_project_work_readiness_v1',$shape$[{"name":"company_id","type":"uuid"},{"name":"project_id","type":"uuid"},{"name":"job_number","type":"text"},{"name":"name","type":"text"},{"name":"operation_count","type":"integer"},{"name":"blocked_operation_count","type":"integer"},{"name":"ready_operation_count","type":"integer"},{"name":"next_work_date","type":"date"},{"name":"readiness_status","type":"text"}]$shape$::jsonb,$shape$[{"name":"company_id","type":"uuid"},{"name":"project_id","type":"uuid"},{"name":"job_number","type":"text"},{"name":"project_name","type":"text"},{"name":"open_operations","type":"integer"},{"name":"ready_operations","type":"integer"},{"name":"blocked_operations","type":"integer"},{"name":"inspection_blocked_operations","type":"integer"},{"name":"failed_inspection_operations","type":"integer"},{"name":"next_scheduled_work_date","type":"date"}]$shape$::jsonb);

drop function pg_temp.carez_connect_view(text,text,jsonb,jsonb);
