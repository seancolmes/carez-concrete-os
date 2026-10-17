-- Keep historical function objects/rows; close alternate client mutation paths
-- only after all seven governed replacement entry points are present.
do $$ declare v_signature text;v_function regprocedure;begin
 foreach v_signature in array array[
 'public.carez_employee_clock_in_v2(uuid,numeric,numeric,numeric,text)',
 'public.carez_employee_clock_out_v2(numeric,numeric,numeric,text)',
 'public.carez_employee_start_task_v2(uuid,numeric,numeric,numeric)',
 'public.carez_employee_start_work_v2(uuid,numeric,numeric,numeric)',
 'public.carez_employee_start_break_v2()',
 'public.carez_employee_end_break_v2()',
 'public.carez_employee_complete_work_package_operation_v2(uuid)'
 ] loop
  if to_regprocedure(v_signature) is null then raise exception 'Governed employee replacement unavailable: %',v_signature;end if;
 end loop;
 foreach v_signature in array array[
 'public.employee_clock_in(uuid,double precision,double precision,numeric,text)',
 'public.employee_clock_out(double precision,double precision,numeric,text)',
 'public.employee_start_task(uuid,double precision,double precision,numeric)',
 'public.employee_start_work(uuid,double precision,double precision,numeric)',
 'public.employee_stop_task(double precision,double precision,numeric)',
 'public.employee_clock_in(uuid,numeric,numeric,numeric,text)',
 'public.employee_clock_out(numeric,numeric,numeric,text)',
 'public.employee_start_task(uuid,numeric,numeric,numeric)',
 'public.employee_start_work(uuid,numeric,numeric,numeric)',
 'public.employee_start_break()',
 'public.employee_end_break()',
 'public.employee_complete_work_package_operation(uuid)',
 'public.employee_report_production(uuid,numeric,text)'
 ] loop
  v_function:=to_regprocedure(v_signature);
  if v_function is not null then execute format('revoke all on function %s from public,anon,authenticated',v_function);end if;
 end loop;
end $$;
