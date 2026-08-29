-- Carez Concrete Assembly Library v2
-- Adds common physical concrete scopes without mutating published v1 assemblies.
-- National-reference labor baselines remain versioned; material dollars stay current/manual in Carez.

do $$
declare
  c record;
  a_id uuid;
  v_id uuid;
  task_form_footing uuid;
  task_rebar_footing uuid;
  task_place_footing uuid;
  task_form_slab uuid;
  task_rebar_slab uuid;
  task_place_slab uuid;
  task_broom uuid;
  task_sawcut uuid;
  task_form_wall uuid;
  task_rebar_wall uuid;
  task_place_wall uuid;
  task_strip uuid;
  task_form_steps uuid;
  task_rebar_steps uuid;
  task_place_steps uuid;
  task_nosing uuid;
begin
  for c in select id from public.companies loop
    select id into task_form_footing from public.production_tasks where company_id=c.id and name='Form Footings' limit 1;
    select id into task_rebar_footing from public.production_tasks where company_id=c.id and name='Set Rebar Footings' limit 1;
    select id into task_place_footing from public.production_tasks where company_id=c.id and name='Place Footings' limit 1;
    select id into task_form_slab from public.production_tasks where company_id=c.id and name='Form Slab Edge' limit 1;
    select id into task_rebar_slab from public.production_tasks where company_id=c.id and name='Set Slab Rebar / Mesh' limit 1;
    select id into task_place_slab from public.production_tasks where company_id=c.id and name='Place Slab / Flatwork' limit 1;
    select id into task_broom from public.production_tasks where company_id=c.id and name='Broom Finish' limit 1;
    select id into task_sawcut from public.production_tasks where company_id=c.id and name='Sawcut / Control Joints' limit 1;
    select id into task_form_wall from public.production_tasks where company_id=c.id and name='Form Stem Walls' limit 1;
    select id into task_rebar_wall from public.production_tasks where company_id=c.id and name='Set Rebar Walls' limit 1;
    select id into task_place_wall from public.production_tasks where company_id=c.id and name='Place Walls' limit 1;
    select id into task_strip from public.production_tasks where company_id=c.id and name='Strip Forms' limit 1;

    insert into public.production_tasks(company_id,name,category,production_unit,active,sort_order)
    values(c.id,'Form Steps','Formwork','LF',true,52)
    on conflict do nothing;
    insert into public.production_tasks(company_id,name,category,production_unit,active,sort_order)
    values(c.id,'Set Rebar Steps','Rebar','LB',true,82)
    on conflict do nothing;
    insert into public.production_tasks(company_id,name,category,production_unit,active,sort_order)
    values(c.id,'Place / Finish Steps','Placement','LF',true,132)
    on conflict do nothing;
    insert into public.production_tasks(company_id,name,category,production_unit,active,sort_order)
    values(c.id,'Install Step Nosing','Finishing','LF',true,134)
    on conflict do nothing;

    select id into task_form_steps from public.production_tasks where company_id=c.id and name='Form Steps' limit 1;
    select id into task_rebar_steps from public.production_tasks where company_id=c.id and name='Set Rebar Steps' limit 1;
    select id into task_place_steps from public.production_tasks where company_id=c.id and name='Place / Finish Steps' limit 1;
    select id into task_nosing from public.production_tasks where company_id=c.id and name='Install Step Nosing' limit 1;

    -- PAD / COLUMN FOOTING ---------------------------------------------------
    select id into a_id from public.concrete_assemblies where company_id=c.id and code='FTG-PAD';
    if a_id is null then
      insert into public.concrete_assemblies(company_id,code,name,category,primary_measurement,description,active)
      values(c.id,'FTG-PAD','Pad / Column Footing','Foundation','EA','Count identical square or rectangular pad footings, then derive SFCA, reinforcing and concrete from detail dimensions.',true)
      returning id into a_id;

      insert into public.concrete_assembly_versions(company_id,assembly_id,version_no,status,source_type,source_label,source_year,source_reference,default_risk_class_code,notes)
      values(c.id,a_id,1,'draft','national_reference','2026 National Construction Estimator',2026,
        'Column footing / pile cap forms: square or rectangular, 3 uses F5@.070 MH/SFCA. Reinforcing set/tie baseline and concrete placement remain separately traceable.','0217-01',
        'Dimensions and reinforcing quantity must come from the structural detail; National reference supplies labor baselines, not engineered steel quantity.')
      returning id into v_id;

      insert into public.concrete_assembly_variables(company_id,assembly_version_id,variable_key,label,value_type,unit,default_value,min_value,required,help_text,sort_order) values
        (c.id,v_id,'length_ft','Pad length','number','FT','4'::jsonb,0,true,'Plan/detail overall footing length.',10),
        (c.id,v_id,'width_ft','Pad width','number','FT','4'::jsonb,0,true,'Plan/detail overall footing width.',20),
        (c.id,v_id,'depth_in','Pad depth','number','IN','12'::jsonb,0,true,'Plan/detail concrete depth.',30),
        (c.id,v_id,'formed_perimeter_pct','Formed perimeter','number','%','100'::jsonb,0,false,'100 = all four sides formed; use 0 for completely earth-formed.',40),
        (c.id,v_id,'rebar_lb_per_ea','Rebar per footing','number','LB/EA',null,0,true,'Enter reinforcing weight from the structural detail/bar schedule.',50),
        (c.id,v_id,'rebar_waste_pct','Rebar lap/waste','number','%','10'::jsonb,0,false,'Allowance for laps and waste.',60),
        (c.id,v_id,'concrete_waste_pct','Concrete waste','number','%','3'::jsonb,0,false,'Ready-mix allowance.',70);

      insert into public.concrete_assembly_components(company_id,assembly_version_id,component_key,label,estimate_item_type,production_task_id,output_unit,quantity_formula,labor_rate_formula,baseline_source,pricing_strategy,labor_task,sort_order) values
        (c.id,v_id,'pad_form_labor','Form pad footing','labor',task_form_footing,'SFCA','{"op":"mul","args":[{"var":"quantity"},{"const":2},{"op":"add","args":[{"var":"length_ft"},{"var":"width_ft"}]},{"op":"div","args":[{"var":"depth_in"},{"const":12}]},{"op":"div","args":[{"var":"formed_perimeter_pct"},{"const":100}]}]}'::jsonb,'{"const":0.070}'::jsonb,'National Estimator 2026: square/rectangular column footing forms, 3 uses, F5@.070 MH/SFCA','current_cost','Formwork',10),
        (c.id,v_id,'pad_form_material','Pad form lumber / hardware allowance','material',null,'SFCA','{"op":"mul","args":[{"var":"quantity"},{"const":2},{"op":"add","args":[{"var":"length_ft"},{"var":"width_ft"}]},{"op":"div","args":[{"var":"depth_in"},{"const":12}]},{"op":"div","args":[{"var":"formed_perimeter_pct"},{"const":100}]}]}'::jsonb,null,null,'manual',null,20),
        (c.id,v_id,'pad_rebar_material','Pad reinforcing steel','material',null,'LB','{"op":"mul","args":[{"var":"quantity"},{"var":"rebar_lb_per_ea"},{"op":"add","args":[{"const":1},{"op":"div","args":[{"var":"rebar_waste_pct"},{"const":100}]}]}]}'::jsonb,null,null,'current_cost',null,30),
        (c.id,v_id,'pad_rebar_labor','Set and tie pad rebar','labor',task_rebar_footing,'LB','{"op":"mul","args":[{"var":"quantity"},{"var":"rebar_lb_per_ea"},{"op":"add","args":[{"const":1},{"op":"div","args":[{"var":"rebar_waste_pct"},{"const":100}]}]}]}'::jsonb,'{"const":0.008}'::jsonb,'National Estimator 2026: Grade 60 reinforcing set/tie baseline RB@.008 MH/LB','current_cost','Rebar',40),
        (c.id,v_id,'pad_concrete_material','Ready-mix pad footing concrete','material',null,'CY','{"op":"mul","args":[{"var":"quantity"},{"op":"div","args":[{"op":"mul","args":[{"var":"length_ft"},{"var":"width_ft"},{"op":"div","args":[{"var":"depth_in"},{"const":12}]}]},{"const":27}]},{"op":"add","args":[{"const":1},{"op":"div","args":[{"var":"concrete_waste_pct"},{"const":100}]}]}]}'::jsonb,null,null,'current_cost',null,50),
        (c.id,v_id,'pad_place_labor','Place pad footing concrete','labor',task_place_footing,'CY','{"op":"mul","args":[{"var":"quantity"},{"op":"div","args":[{"op":"mul","args":[{"var":"length_ft"},{"var":"width_ft"},{"op":"div","args":[{"var":"depth_in"},{"const":12}]}]},{"const":27}]},{"op":"add","args":[{"const":1},{"op":"div","args":[{"var":"concrete_waste_pct"},{"const":100}]}]}]}'::jsonb,'{"const":0.552}'::jsonb,'National Estimator 2026: foundation concrete placed directly from chute CL@.552 MH/CY','current_cost','Placement',60);

      update public.concrete_assembly_versions set status='published' where id=v_id;
    end if;

    -- GRADE / TIE BEAM ------------------------------------------------------
    select id into a_id from public.concrete_assemblies where company_id=c.id and code='BEAM-GRADE';
    if a_id is null then
      insert into public.concrete_assemblies(company_id,code,name,category,primary_measurement,description,active)
      values(c.id,'BEAM-GRADE','Grade Beam / Tie Beam','Foundation','LF','Linear formed beam: derives SFCA, engineered reinforcing weight and concrete volume while preserving labor operations.',true)
      returning id into a_id;

      insert into public.concrete_assembly_versions(company_id,assembly_id,version_no,status,source_type,source_label,source_year,source_reference,default_risk_class_code,notes)
      values(c.id,a_id,1,'draft','national_reference','2026 National Construction Estimator',2026,
        'Wall footing, grade beam or tie beam forms: 3 uses F5@.050 MH/SFCA; concrete and reinforcing remain separate.','0217-01',
        'Use structural-detail reinforcing weight. Form quantity follows formed sides and beam depth.')
      returning id into v_id;

      insert into public.concrete_assembly_variables(company_id,assembly_version_id,variable_key,label,value_type,unit,default_value,min_value,required,help_text,sort_order) values
        (c.id,v_id,'width_in','Beam width','number','IN','12'::jsonb,0,true,'Plan/detail beam width.',10),
        (c.id,v_id,'depth_in','Beam depth','number','IN','24'::jsonb,0,true,'Plan/detail beam depth.',20),
        (c.id,v_id,'form_sides','Formed sides','number','EA','2'::jsonb,0,true,'0 earth-formed, 1 one side, 2 both sides.',30),
        (c.id,v_id,'rebar_lb_per_lf','Rebar density','number','LB/LF',null,0,true,'Enter engineered reinforcing pounds per beam LF.',40),
        (c.id,v_id,'rebar_waste_pct','Rebar lap/waste','number','%','10'::jsonb,0,false,'Allowance for laps and waste.',50),
        (c.id,v_id,'concrete_waste_pct','Concrete waste','number','%','3'::jsonb,0,false,'Ready-mix allowance.',60);

      insert into public.concrete_assembly_components(company_id,assembly_version_id,component_key,label,estimate_item_type,production_task_id,output_unit,quantity_formula,labor_rate_formula,baseline_source,pricing_strategy,labor_task,sort_order) values
        (c.id,v_id,'grade_beam_form_labor','Form grade / tie beam','labor',task_form_footing,'SFCA','{"op":"mul","args":[{"var":"quantity"},{"op":"div","args":[{"var":"depth_in"},{"const":12}]},{"var":"form_sides"}]}'::jsonb,'{"const":0.050}'::jsonb,'National Estimator 2026: wall footing, grade beam or tie beam forms, 3 uses F5@.050 MH/SFCA','current_cost','Formwork',10),
        (c.id,v_id,'grade_beam_form_material','Grade beam form lumber / hardware allowance','material',null,'SFCA','{"op":"mul","args":[{"var":"quantity"},{"op":"div","args":[{"var":"depth_in"},{"const":12}]},{"var":"form_sides"}]}'::jsonb,null,null,'manual',null,20),
        (c.id,v_id,'grade_beam_rebar_material','Grade beam reinforcing steel','material',null,'LB','{"op":"mul","args":[{"var":"quantity"},{"var":"rebar_lb_per_lf"},{"op":"add","args":[{"const":1},{"op":"div","args":[{"var":"rebar_waste_pct"},{"const":100}]}]}]}'::jsonb,null,null,'current_cost',null,30),
        (c.id,v_id,'grade_beam_rebar_labor','Set and tie grade beam rebar','labor',task_rebar_footing,'LB','{"op":"mul","args":[{"var":"quantity"},{"var":"rebar_lb_per_lf"},{"op":"add","args":[{"const":1},{"op":"div","args":[{"var":"rebar_waste_pct"},{"const":100}]}]}]}'::jsonb,'{"const":0.008}'::jsonb,'National Estimator 2026: Grade 60 reinforcing set/tie baseline RB@.008 MH/LB','current_cost','Rebar',40),
        (c.id,v_id,'grade_beam_concrete_material','Ready-mix grade beam concrete','material',null,'CY','{"op":"mul","args":[{"op":"div","args":[{"op":"mul","args":[{"var":"quantity"},{"op":"div","args":[{"var":"width_in"},{"const":12}]},{"op":"div","args":[{"var":"depth_in"},{"const":12}]}]},{"const":27}]},{"op":"add","args":[{"const":1},{"op":"div","args":[{"var":"concrete_waste_pct"},{"const":100}]}]}]}'::jsonb,null,null,'current_cost',null,50),
        (c.id,v_id,'grade_beam_place_labor','Place grade beam concrete','labor',task_place_footing,'CY','{"op":"mul","args":[{"op":"div","args":[{"op":"mul","args":[{"var":"quantity"},{"op":"div","args":[{"var":"width_in"},{"const":12}]},{"op":"div","args":[{"var":"depth_in"},{"const":12}]}]},{"const":27}]},{"op":"add","args":[{"const":1},{"op":"div","args":[{"var":"concrete_waste_pct"},{"const":100}]}]}]}'::jsonb,'{"const":0.552}'::jsonb,'National Estimator 2026: foundation concrete placed directly from chute CL@.552 MH/CY','current_cost','Placement',60);

      update public.concrete_assembly_versions set status='published' where id=v_id;
    end if;

    -- BROOM-FINISHED FLATWORK ----------------------------------------------
    select id into a_id from public.concrete_assemblies where company_id=c.id and code='FLAT-BROOM';
    if a_id is null then
      insert into public.concrete_assemblies(company_id,code,name,category,primary_measurement,description,active)
      values(c.id,'FLAT-BROOM','Broom-Finished Flatwork','Flatwork','SF','Driveways, patios, walks and similar non-roadway flatwork with explicit broom-finish labor, edge forms, reinforcing, cure and sawcut quantities.',true)
      returning id into a_id;

      insert into public.concrete_assembly_versions(company_id,assembly_id,version_no,status,source_type,source_label,source_year,source_reference,default_risk_class_code,notes)
      values(c.id,a_id,1,'draft','national_reference','2026 National Construction Estimator',2026,
        'Slab-on-grade edge forms and reinforcing; broom finish CM@.012 MH/SF; green concrete sawcut C8@.010 MH/LF.','0217-01',
        'Use 0217-00 when flatwork is not in connection with wood-frame construction; roadway-connected work belongs in the dedicated ROW assembly.')
      returning id into v_id;

      insert into public.concrete_assembly_variables(company_id,assembly_version_id,variable_key,label,value_type,unit,default_value,min_value,required,help_text,sort_order) values
        (c.id,v_id,'thickness_in','Concrete thickness','number','IN','4'::jsonb,0,true,'Concrete thickness from plan/detail.',10),
        (c.id,v_id,'perimeter_lf','Formed perimeter','number','LF',null,0,true,'PDF polygon derives perimeter automatically; adjust only where not all perimeter is formed.',20),
        (c.id,v_id,'sawcut_lf','Sawcut / control joints','number','LF','0'::jsonb,0,false,'Planned control-joint LF.',30),
        (c.id,v_id,'reinforcement_factor','Mesh / rebar coverage','number','SF/SF','1.1'::jsonb,0,false,'1.10 represents 10% overlap/waste for area-based slab reinforcing.',40),
        (c.id,v_id,'concrete_waste_pct','Concrete waste','number','%','3'::jsonb,0,false,'Ready-mix allowance.',50);

      insert into public.concrete_assembly_components(company_id,assembly_version_id,component_key,label,estimate_item_type,production_task_id,output_unit,quantity_formula,labor_rate_formula,baseline_source,pricing_strategy,labor_task,sort_order) values
        (c.id,v_id,'broom_edge_form_labor','Form flatwork edge','labor',task_form_slab,'LF','{"var":"perimeter_lf"}'::jsonb,'{"op":"piecewise_lte","value":{"var":"thickness_in"},"cases":[{"lte":6,"then":0.061},{"lte":12,"then":0.086},{"lte":24,"then":0.119},{"lte":36,"then":0.160}],"else":0.160}'::jsonb,'National Estimator 2026 slab-on-grade edge forms, 3 uses, height-banded MH/LF','current_cost','Formwork',10),
        (c.id,v_id,'broom_edge_form_material','Flatwork edge form material allowance','material',null,'LF','{"var":"perimeter_lf"}'::jsonb,null,null,'manual',null,20),
        (c.id,v_id,'broom_reinforcement_material','Slab reinforcing coverage','material',null,'SF','{"op":"mul","args":[{"var":"quantity"},{"var":"reinforcement_factor"}]}'::jsonb,null,null,'current_cost',null,30),
        (c.id,v_id,'broom_reinforcement_labor','Set slab reinforcing / mesh','labor',task_rebar_slab,'SF','{"op":"mul","args":[{"var":"quantity"},{"var":"reinforcement_factor"}]}'::jsonb,'{"const":0.004}'::jsonb,'National Estimator 2026 typical welded-wire slab reinforcing RI@.004 MH/SF','current_cost','Rebar',40),
        (c.id,v_id,'broom_concrete_material','Ready-mix flatwork concrete','material',null,'CY','{"op":"mul","args":[{"op":"div","args":[{"op":"mul","args":[{"var":"quantity"},{"op":"div","args":[{"var":"thickness_in"},{"const":12}]}]},{"const":27}]},{"op":"add","args":[{"const":1},{"op":"div","args":[{"var":"concrete_waste_pct"},{"const":100}]}]}]}'::jsonb,null,null,'current_cost',null,50),
        (c.id,v_id,'broom_place_labor','Place flatwork concrete','labor',task_place_slab,'CY','{"op":"mul","args":[{"op":"div","args":[{"op":"mul","args":[{"var":"quantity"},{"op":"div","args":[{"var":"thickness_in"},{"const":12}]}]},{"const":27}]},{"op":"add","args":[{"const":1},{"op":"div","args":[{"var":"concrete_waste_pct"},{"const":100}]}]}]}'::jsonb,'{"const":0.421}'::jsonb,'National Estimator 2026 ready-mix slab placement baseline CL@.421 MH/CY','current_cost','Placement',60),
        (c.id,v_id,'broom_finish_labor','Broom finish concrete','labor',task_broom,'SF','{"var":"quantity"}'::jsonb,'{"const":0.012}'::jsonb,'National Estimator 2026 concrete slab broom finish CM@.012 MH/SF','current_cost','Finishing',70),
        (c.id,v_id,'broom_cure_material','Curing / sealing compound','material',null,'SF','{"var":"quantity"}'::jsonb,null,null,'current_cost',null,80),
        (c.id,v_id,'broom_sawcut_labor','Sawcut / control joints','labor',task_sawcut,'LF','{"var":"sawcut_lf"}'::jsonb,'{"const":0.010}'::jsonb,'National Estimator 2026 green concrete sawcut C8@.010 MH/LF','current_cost','Finishing',90);

      update public.concrete_assembly_versions set status='published' where id=v_id;
    end if;

    -- ROADWAY-CONNECTED SIDEWALK / APPROACH --------------------------------
    select id into a_id from public.concrete_assemblies where company_id=c.id and code='FLAT-ROW';
    if a_id is null then
      insert into public.concrete_assemblies(company_id,code,name,category,primary_measurement,description,active)
      values(c.id,'FLAT-ROW','ROW Sidewalk / Driveway Approach','Civil / ROW','SF','Roadway-connected sidewalks, approaches, curb-adjacent flatwork and similar scopes. Uses the 0214-01 L&I phase by default after subbase preparation.',true)
      returning id into a_id;

      insert into public.concrete_assembly_versions(company_id,assembly_id,version_no,status,source_type,source_label,source_year,source_reference,default_risk_class_code,notes)
      values(c.id,a_id,1,'draft','blended','2026 National Construction Estimator + WAC 296-17A-0214',2026,
        'Physical productivity follows slab/flatwork references. WAC 296-17A-0214-01 covers concrete curbs, gutters and sidewalks in connection with highways, streets or roadways after grade/subbase preparation.','0214-01',
        'Do not use this assembly for ordinary non-roadway flatwork. Subbase establishment is not included in this concrete assembly.')
      returning id into v_id;

      insert into public.concrete_assembly_variables(company_id,assembly_version_id,variable_key,label,value_type,unit,default_value,min_value,required,help_text,sort_order) values
        (c.id,v_id,'thickness_in','Concrete thickness','number','IN','4'::jsonb,0,true,'Concrete thickness from civil plan/detail.',10),
        (c.id,v_id,'perimeter_lf','Formed perimeter','number','LF',null,0,true,'PDF polygon derives perimeter automatically.',20),
        (c.id,v_id,'sawcut_lf','Sawcut / control joints','number','LF','0'::jsonb,0,false,'Planned control-joint LF.',30),
        (c.id,v_id,'reinforcement_factor','Reinforcing coverage','number','SF/SF','1'::jsonb,0,false,'Use 0 when no reinforcing; use >1 for overlap/waste where mesh or area reinforcing is specified.',40),
        (c.id,v_id,'concrete_waste_pct','Concrete waste','number','%','3'::jsonb,0,false,'Ready-mix allowance.',50);

      insert into public.concrete_assembly_components(company_id,assembly_version_id,component_key,label,estimate_item_type,production_task_id,output_unit,quantity_formula,labor_rate_formula,baseline_source,pricing_strategy,labor_task,sort_order) values
        (c.id,v_id,'row_edge_form_labor','Form ROW flatwork edge','labor',task_form_slab,'LF','{"var":"perimeter_lf"}'::jsonb,'{"op":"piecewise_lte","value":{"var":"thickness_in"},"cases":[{"lte":6,"then":0.061},{"lte":12,"then":0.086},{"lte":24,"then":0.119},{"lte":36,"then":0.160}],"else":0.160}'::jsonb,'National Estimator 2026 slab-on-grade edge forms, 3 uses, height-banded MH/LF','current_cost','Formwork',10),
        (c.id,v_id,'row_edge_form_material','ROW edge form material allowance','material',null,'LF','{"var":"perimeter_lf"}'::jsonb,null,null,'manual',null,20),
        (c.id,v_id,'row_reinforcement_material','ROW reinforcing coverage','material',null,'SF','{"op":"mul","args":[{"var":"quantity"},{"var":"reinforcement_factor"}]}'::jsonb,null,null,'current_cost',null,30),
        (c.id,v_id,'row_reinforcement_labor','Set ROW reinforcing / mesh','labor',task_rebar_slab,'SF','{"op":"mul","args":[{"var":"quantity"},{"var":"reinforcement_factor"}]}'::jsonb,'{"const":0.004}'::jsonb,'National Estimator 2026 typical welded-wire slab reinforcing RI@.004 MH/SF','current_cost','Rebar',40),
        (c.id,v_id,'row_concrete_material','Ready-mix ROW concrete','material',null,'CY','{"op":"mul","args":[{"op":"div","args":[{"op":"mul","args":[{"var":"quantity"},{"op":"div","args":[{"var":"thickness_in"},{"const":12}]}]},{"const":27}]},{"op":"add","args":[{"const":1},{"op":"div","args":[{"var":"concrete_waste_pct"},{"const":100}]}]}]}'::jsonb,null,null,'current_cost',null,50),
        (c.id,v_id,'row_place_labor','Place ROW concrete','labor',task_place_slab,'CY','{"op":"mul","args":[{"op":"div","args":[{"op":"mul","args":[{"var":"quantity"},{"op":"div","args":[{"var":"thickness_in"},{"const":12}]}]},{"const":27}]},{"op":"add","args":[{"const":1},{"op":"div","args":[{"var":"concrete_waste_pct"},{"const":100}]}]}]}'::jsonb,'{"const":0.421}'::jsonb,'National Estimator 2026 ready-mix slab placement baseline CL@.421 MH/CY','current_cost','Placement',60),
        (c.id,v_id,'row_broom_finish_labor','Broom finish ROW concrete','labor',task_broom,'SF','{"var":"quantity"}'::jsonb,'{"const":0.012}'::jsonb,'National Estimator 2026 concrete slab broom finish CM@.012 MH/SF','current_cost','Finishing',70),
        (c.id,v_id,'row_cure_material','ROW curing / sealing compound','material',null,'SF','{"var":"quantity"}'::jsonb,null,null,'current_cost',null,80),
        (c.id,v_id,'row_sawcut_labor','Sawcut / control joints','labor',task_sawcut,'LF','{"var":"sawcut_lf"}'::jsonb,'{"const":0.010}'::jsonb,'National Estimator 2026 green concrete sawcut C8@.010 MH/LF','current_cost','Finishing',90);

      update public.concrete_assembly_versions set status='published' where id=v_id;
    end if;

    -- STEPS ON GRADE --------------------------------------------------------
    select id into a_id from public.concrete_assemblies where company_id=c.id and code='STEP-GRADE';
    if a_id is null then
      insert into public.concrete_assemblies(company_id,code,name,category,primary_measurement,description,active)
      values(c.id,'STEP-GRADE','Concrete Steps on Grade','Flatwork','LF','Measure total LF of risers. Carez derives forms, rebar, concrete and optional steel nosing from the National steps-on-grade assembly.',true)
      returning id into a_id;

      insert into public.concrete_assembly_versions(company_id,assembly_id,version_no,status,source_type,source_label,source_year,source_reference,default_risk_class_code,notes)
      values(c.id,a_id,1,'draft','national_reference','2026 National Construction Estimator',2026,
        'Cast-in-place steps-on-grade: side forms P9@.080 MH/LF, riser forms P9@.040, #3 rebar P9@.009, optional nosing P9@.004, concrete P9@.030; source rule calculates LF of risers as width x rise x 2.','0217-01',
        'Primary takeoff quantity is total LF of risers, not stair run. Source assumes 6-inch risers, 12-inch treads and monolithic slab support; revise assembly for materially different geometry.')
      returning id into v_id;

      insert into public.concrete_assembly_variables(company_id,assembly_version_id,variable_key,label,value_type,unit,default_value,min_value,max_value,required,help_text,sort_order) values
        (c.id,v_id,'rebar_lb_per_lf','Rebar per LF of riser','number','LB/LF','1'::jsonb,0,null,true,'Source baseline is 1 lb of #3 rebar per LF of riser; replace with engineered quantity when known.',10),
        (c.id,v_id,'concrete_cy_per_lf','Concrete per LF of riser','number','CY/LF','0.03'::jsonb,0,null,true,'Source baseline is .03 CY per LF of riser.',20),
        (c.id,v_id,'nosing_factor','Steel nosing included','number','0/1','0'::jsonb,0,1,false,'0 = no steel nosing; 1 = include 4.5 lb/LF steel nosing and installation labor.',30);

      insert into public.concrete_assembly_components(company_id,assembly_version_id,component_key,label,estimate_item_type,production_task_id,output_unit,quantity_formula,labor_rate_formula,baseline_source,pricing_strategy,labor_task,sort_order) values
        (c.id,v_id,'steps_form_material','Steps form lumber / hardware allowance','material',null,'LF','{"var":"quantity"}'::jsonb,null,null,'manual',null,10),
        (c.id,v_id,'steps_form_labor','Form step sides and risers','labor',task_form_steps,'LF','{"var":"quantity"}'::jsonb,'{"const":0.120}'::jsonb,'National Estimator 2026 steps-on-grade: side forms .080 + riser forms .040 = .120 MH/LF of riser','current_cost','Formwork',20),
        (c.id,v_id,'steps_rebar_material','Steps reinforcing steel','material',null,'LB','{"op":"mul","args":[{"var":"quantity"},{"var":"rebar_lb_per_lf"}]}'::jsonb,null,null,'current_cost',null,30),
        (c.id,v_id,'steps_rebar_labor','Set and tie step reinforcing','labor',task_rebar_steps,'LB','{"op":"mul","args":[{"var":"quantity"},{"var":"rebar_lb_per_lf"}]}'::jsonb,'{"const":0.009}'::jsonb,'National Estimator 2026 steps-on-grade #3 rebar: 1 lb/LF with P9@.009 MH/LF','current_cost','Rebar',40),
        (c.id,v_id,'steps_concrete_material','Ready-mix step concrete','material',null,'CY','{"op":"mul","args":[{"var":"quantity"},{"var":"concrete_cy_per_lf"}]}'::jsonb,null,null,'current_cost',null,50),
        (c.id,v_id,'steps_place_finish_labor','Place and finish steps','labor',task_place_steps,'LF','{"var":"quantity"}'::jsonb,'{"const":0.030}'::jsonb,'National Estimator 2026 steps-on-grade concrete component P9@.030 MH/LF of riser','current_cost','Placement / Finishing',60),
        (c.id,v_id,'steps_nosing_material','Steel step nosing','material',null,'LB','{"op":"mul","args":[{"var":"quantity"},{"const":4.5},{"var":"nosing_factor"}]}'::jsonb,null,'National Estimator 2026 steps-on-grade: 4.5 lb steel nosing per LF when used','manual',null,70),
        (c.id,v_id,'steps_nosing_labor','Install steel step nosing','labor',task_nosing,'LF','{"op":"mul","args":[{"var":"quantity"},{"var":"nosing_factor"}]}'::jsonb,'{"const":0.004}'::jsonb,'National Estimator 2026 embedded steel step nosing P9@.004 MH/LF','current_cost','Finishing',80);

      update public.concrete_assembly_versions set status='published' where id=v_id;
    end if;

    -- ROADWAY RETAINING / MEDIAN WALL --------------------------------------
    select id into a_id from public.concrete_assemblies where company_id=c.id and code='WALL-RETAIN-ROW';
    if a_id is null then
      insert into public.concrete_assemblies(company_id,code,name,category,primary_measurement,description,active)
      values(c.id,'WALL-RETAIN-ROW','ROW Retaining / Median Wall','Civil / ROW','LF','Cast-in-place roadway-connected retaining or median wall. Explicitly defaults to L&I 0214-02.',true)
      returning id into a_id;

      insert into public.concrete_assembly_versions(company_id,assembly_id,version_no,status,source_type,source_label,source_year,source_reference,default_risk_class_code,notes)
      values(c.id,a_id,1,'draft','blended','2026 National Construction Estimator + WAC 296-17A-0214',2026,
        'Concrete wall form/rebar/placement baselines from National reference. WAC 296-17A-0214-02 covers roadway-connected concrete median and retaining walls after grade/subbase preparation.','0214-02',
        'Use WALL-STEM or another non-roadway assembly when the wall is not in connection with a highway, street or roadway project.')
      returning id into v_id;

      insert into public.concrete_assembly_variables(company_id,assembly_version_id,variable_key,label,value_type,unit,default_value,min_value,required,help_text,sort_order) values
        (c.id,v_id,'height_ft','Wall height','number','FT','6'::jsonb,0,true,'Finished concrete wall height.',10),
        (c.id,v_id,'thickness_in','Wall thickness','number','IN','8'::jsonb,0,true,'Concrete wall thickness.',20),
        (c.id,v_id,'rebar_lb_per_sf','Rebar density','number','LB/SF',null,0,true,'Engineered reinforcing pounds per one-side wall face SF.',30),
        (c.id,v_id,'rebar_waste_pct','Rebar lap/waste','number','%','10'::jsonb,0,false,'Allowance for laps and waste.',40),
        (c.id,v_id,'concrete_waste_pct','Concrete waste','number','%','3'::jsonb,0,false,'Ready-mix allowance.',50);

      insert into public.concrete_assembly_components(company_id,assembly_version_id,component_key,label,estimate_item_type,production_task_id,output_unit,quantity_formula,labor_rate_formula,baseline_source,pricing_strategy,labor_task,sort_order) values
        (c.id,v_id,'row_wall_form_labor','Form retaining wall — both faces','labor',task_form_wall,'SFCA','{"op":"mul","args":[{"var":"quantity"},{"var":"height_ft"},{"const":2}]}'::jsonb,'{"op":"piecewise_lte","value":{"var":"height_ft"},"cases":[{"lte":4,"then":0.08},{"lte":6,"then":0.10},{"lte":12,"then":0.11},{"lte":16,"then":0.13}],"else":0.14}'::jsonb,'National Estimator 2026 wall forms, 3 uses: height-banded F5 Craft@Hrs per SFCA','current_cost','Formwork',10),
        (c.id,v_id,'row_wall_form_material','Retaining wall form material / hardware allowance','material',null,'SFCA','{"op":"mul","args":[{"var":"quantity"},{"var":"height_ft"},{"const":2}]}'::jsonb,null,null,'manual',null,20),
        (c.id,v_id,'row_wall_rebar_material','Retaining wall reinforcing steel','material',null,'LB','{"op":"mul","args":[{"var":"quantity"},{"var":"height_ft"},{"var":"rebar_lb_per_sf"},{"op":"add","args":[{"const":1},{"op":"div","args":[{"var":"rebar_waste_pct"},{"const":100}]}]}]}'::jsonb,null,null,'current_cost',null,30),
        (c.id,v_id,'row_wall_rebar_labor','Set and tie retaining wall rebar','labor',task_rebar_wall,'LB','{"op":"mul","args":[{"var":"quantity"},{"var":"height_ft"},{"var":"rebar_lb_per_sf"},{"op":"add","args":[{"const":1},{"op":"div","args":[{"var":"rebar_waste_pct"},{"const":100}]}]}]}'::jsonb,'{"const":0.008}'::jsonb,'National Estimator 2026 reinforcing set/tie RB@.008 MH/LB baseline','current_cost','Rebar',40),
        (c.id,v_id,'row_wall_concrete_material','Ready-mix retaining wall concrete','material',null,'CY','{"op":"mul","args":[{"op":"div","args":[{"op":"mul","args":[{"var":"quantity"},{"var":"height_ft"},{"op":"div","args":[{"var":"thickness_in"},{"const":12}]}]},{"const":27}]},{"op":"add","args":[{"const":1},{"op":"div","args":[{"var":"concrete_waste_pct"},{"const":100}]}]}]}'::jsonb,null,null,'current_cost',null,50),
        (c.id,v_id,'row_wall_place_labor','Place retaining wall concrete','labor',task_place_wall,'CY','{"op":"mul","args":[{"op":"div","args":[{"op":"mul","args":[{"var":"quantity"},{"var":"height_ft"},{"op":"div","args":[{"var":"thickness_in"},{"const":12}]}]},{"const":27}]},{"op":"add","args":[{"const":1},{"op":"div","args":[{"var":"concrete_waste_pct"},{"const":100}]}]}]}'::jsonb,'{"const":0.552}'::jsonb,'National Estimator 2026 foundation/wall placement baseline CL@.552 MH/CY; pump/access method must be reviewed','current_cost','Placement',60),
        (c.id,v_id,'row_wall_strip_labor','Strip / clean retaining wall forms','labor',task_strip,'SFCA','{"op":"mul","args":[{"var":"quantity"},{"var":"height_ft"},{"const":2}]}'::jsonb,'{"const":0.011}'::jsonb,'National Estimator 2026 strip wood forms and dismantle bracing CL@.011 MH/SF','current_cost','Strip',70);

      update public.concrete_assembly_versions set status='published' where id=v_id;
    end if;
  end loop;
end $$;
