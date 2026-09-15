import type { ConditionArchetypeDefinition, ConditionInputDefinition, ConditionOutputDefinition } from './types.ts';

const numberInput = (
  key: string,
  label: string,
  group: ConditionInputDefinition['group'],
  unit: string,
  requiredBy: string[],
  minimum = 0,
): ConditionInputDefinition => ({ key, label, group, valueType: 'number', unit, requiredBy, minimum });

const output = (
  outputKey: string,
  moduleKey: ConditionOutputDefinition['moduleKey'],
  label: string,
  resourceClass: ConditionOutputDefinition['resourceClass'],
  unit: ConditionOutputDefinition['unit'],
  algorithm: string,
  legacyComponentKey: string,
): ConditionOutputDefinition => ({ outputKey, moduleKey, label, resourceClass, unit, algorithm, legacyComponentKey });

const commonWasteInputs: ConditionInputDefinition[] = [
  numberInput('concrete_waste_pct', 'Concrete waste', 'commercial', '%', ['concrete.procurement_cy']),
  numberInput('rebar_waste_pct', 'Reinforcing waste', 'commercial', '%', ['reinforcing.steel_lb']),
];

const commonLaborInputs: ConditionInputDefinition[] = [
  numberInput('place_concrete_mh_per_cy', 'Place concrete production rate', 'production', 'MH/CY', ['labor.place_concrete_mh']),
  numberInput('form_mh_per_sf', 'Form production rate', 'production', 'MH/SF', ['labor.forms_mh']),
  numberInput('rebar_mh_per_lb', 'Reinforcing production rate', 'production', 'MH/LB', ['labor.reinforcing_mh']),
  numberInput('anchor_embed_mh_per_ea', 'Anchor/embed production rate', 'production', 'MH/EA', ['labor.anchors_embeds_mh']),
];

const commonDrawingInputs: ConditionInputDefinition[] = [
  { key: 'elevation_ft', label: 'Elevation', group: 'drawing', valueType: 'number', unit: 'FT', requiredBy: ['3d_projection'] },
  { key: 'elevation_reference', label: 'Elevation reference', group: 'drawing', valueType: 'select', requiredBy: ['3d_projection'] },
  { key: 'qc_connection_group', label: '3D connection review group', group: 'drawing', valueType: 'text' },
  { key: 'qc_connection_tolerance_ft', label: 'Connection gap tolerance', group: 'drawing', valueType: 'number', unit: 'FT', minimum: 0 },
  { key: 'qc_elevation_group', label: '3D elevation match group', group: 'drawing', valueType: 'text' },
  { key: 'qc_elevation_tolerance_ft', label: 'Elevation match tolerance', group: 'drawing', valueType: 'number', unit: 'FT', minimum: 0 },
  { key: 'qc_support_group', label: '3D support review group', group: 'drawing', valueType: 'text' },
  { key: 'qc_support_tolerance_ft', label: 'Support gap tolerance', group: 'drawing', valueType: 'number', unit: 'FT', minimum: 0 },
];

export const CONDITION_ARCHETYPES: Record<string, ConditionArchetypeDefinition> = {
  pad_column_footing: {
    key: 'pad_column_footing',
    name: 'Pad / Column Footing',
    primaryUnit: 'EA',
    roles: [
      { key: 'locations', label: 'Footing locations', unit: 'EA', geometryType: 'count', primary: true, required: true },
      { key: 'anchors_embeds', label: 'Anchors / embeds', unit: 'EA', geometryType: 'count', primary: false, required: false },
    ],
    inputs: [
      numberInput('width_ft', 'Width', 'planFacts', 'FT', ['concrete.installed_cy', 'forms.contact_sf']),
      numberInput('length_ft', 'Length', 'planFacts', 'FT', ['concrete.installed_cy', 'forms.contact_sf']),
      numberInput('depth_ft', 'Depth', 'planFacts', 'FT', ['concrete.installed_cy', 'forms.contact_sf']),
      numberInput('formed_sides', 'Formed sides', 'methods', 'EA', ['forms.contact_sf'], 0),
      numberInput('rebar_lf_per_each', 'Reinforcing length per footing', 'methods', 'LF/EA', ['reinforcing.steel_lb']),
      numberInput('rebar_unit_weight_lb_per_ft', 'Rebar unit weight', 'methods', 'LB/LF', ['reinforcing.steel_lb']),
      numberInput('anchor_count_per_each', 'Anchors per footing', 'planFacts', 'EA/EA', ['anchors_embeds.anchor_ea']),
      ...commonWasteInputs,
      ...commonLaborInputs,
      ...commonDrawingInputs,
    ],
    defaultModules: ['concrete', 'forms', 'reinforcing', 'anchors_embeds', 'labor'],
    outputs: [
      output('concrete.installed_cy', 'concrete', 'Concrete — installed', 'material', 'CY', 'pad-volume-v1', 'concrete'),
      output('concrete.procurement_cy', 'concrete', 'Concrete — procurement', 'material', 'CY', 'waste-adjustment-v1', 'concrete_procurement'),
      output('forms.contact_sf', 'forms', 'Form contact area', 'material', 'SF', 'pad-form-contact-v1', 'forms'),
      output('reinforcing.steel_lb', 'reinforcing', 'Reinforcing steel', 'material', 'LB', 'pad-rebar-weight-v1', 'rebar'),
      output('anchors_embeds.anchor_ea', 'anchors_embeds', 'Anchors / embeds', 'material', 'EA', 'role-or-each-count-v1', 'anchors'),
      output('labor.place_concrete_mh', 'labor', 'Place concrete labor', 'labor', 'HR', 'production-rate-v1', 'labor_place'),
      output('labor.forms_mh', 'labor', 'Form labor', 'labor', 'HR', 'production-rate-v1', 'labor_forms'),
      output('labor.reinforcing_mh', 'labor', 'Reinforcing labor', 'labor', 'HR', 'production-rate-v1', 'labor_rebar'),
      output('labor.anchors_embeds_mh', 'labor', 'Anchor / embed labor', 'labor', 'HR', 'production-rate-v1', 'labor_anchors'),
    ],
  },
  strip_wall_footing: {
    key: 'strip_wall_footing',
    name: 'Strip / Wall Footing',
    primaryUnit: 'LF',
    roles: [
      { key: 'run', label: 'Footing run', unit: 'LF', geometryType: 'polyline', primary: true, required: true },
      { key: 'end_forms', label: 'End forms', unit: 'EA', geometryType: 'count', primary: false, required: false },
      { key: 'anchors_embeds', label: 'Anchors / embeds', unit: 'EA', geometryType: 'count', primary: false, required: false },
    ],
    inputs: [
      numberInput('width_ft', 'Width', 'planFacts', 'FT', ['concrete.installed_cy', 'forms.end_contact_sf']),
      numberInput('depth_ft', 'Depth', 'planFacts', 'FT', ['concrete.installed_cy', 'forms.side_contact_sf', 'forms.end_contact_sf']),
      numberInput('formed_sides', 'Formed sides', 'methods', 'EA', ['forms.side_contact_sf'], 0),
      numberInput('longitudinal_bar_count', 'Longitudinal bar count', 'methods', 'EA', ['reinforcing.steel_lb']),
      numberInput('rebar_unit_weight_lb_per_ft', 'Rebar unit weight', 'methods', 'LB/LF', ['reinforcing.steel_lb']),
      numberInput('anchor_count_per_lf', 'Anchors per foot', 'planFacts', 'EA/LF', ['anchors_embeds.anchor_ea']),
      ...commonWasteInputs,
      ...commonLaborInputs,
      ...commonDrawingInputs,
    ],
    defaultModules: ['concrete', 'forms', 'reinforcing', 'anchors_embeds', 'labor'],
    outputs: [
      output('concrete.installed_cy', 'concrete', 'Concrete — installed', 'material', 'CY', 'strip-volume-v1', 'concrete'),
      output('concrete.procurement_cy', 'concrete', 'Concrete — procurement', 'material', 'CY', 'waste-adjustment-v1', 'concrete_procurement'),
      output('forms.side_contact_sf', 'forms', 'Side form contact area', 'material', 'SF', 'strip-side-form-v1', 'forms'),
      output('forms.end_contact_sf', 'forms', 'End form contact area', 'material', 'SF', 'strip-end-form-v1', 'end_forms'),
      output('reinforcing.steel_lb', 'reinforcing', 'Reinforcing steel', 'material', 'LB', 'strip-longitudinal-rebar-v1', 'rebar'),
      output('anchors_embeds.anchor_ea', 'anchors_embeds', 'Anchors / embeds', 'material', 'EA', 'role-or-linear-count-v1', 'anchors'),
      output('labor.place_concrete_mh', 'labor', 'Place concrete labor', 'labor', 'HR', 'production-rate-v1', 'labor_place'),
      output('labor.forms_mh', 'labor', 'Form labor', 'labor', 'HR', 'production-rate-v1', 'labor_forms'),
      output('labor.reinforcing_mh', 'labor', 'Reinforcing labor', 'labor', 'HR', 'production-rate-v1', 'labor_rebar'),
      output('labor.anchors_embeds_mh', 'labor', 'Anchor / embed labor', 'labor', 'HR', 'production-rate-v1', 'labor_anchors'),
    ],
  },
  slab_on_grade: {
    key: 'slab_on_grade',
    name: 'Slab on Grade',
    primaryUnit: 'SF',
    roles: [
      { key: 'area', label: 'Net slab area', unit: 'SF', geometryType: 'polygon', primary: true, required: true },
      { key: 'edge_forms', label: 'Edge forms', unit: 'LF', geometryType: 'polyline', primary: false, required: false },
      { key: 'joints', label: 'Joints', unit: 'LF', geometryType: 'polyline', primary: false, required: false },
      { key: 'anchors_embeds', label: 'Anchors / embeds', unit: 'EA', geometryType: 'count', primary: false, required: false },
    ],
    inputs: [
      numberInput('thickness_in', 'Slab thickness', 'planFacts', 'IN', ['concrete.installed_cy', 'forms.edge_contact_sf']),
      numberInput('reinforcing_lb_per_sf', 'Reinforcing allowance', 'methods', 'LB/SF', ['reinforcing.steel_lb']),
      numberInput('base_depth_in', 'Base depth', 'planFacts', 'IN', ['slab_systems.base_cy']),
      numberInput('vapor_barrier_waste_pct', 'Vapor barrier waste', 'commercial', '%', ['slab_systems.vapor_barrier_sf']),
      numberInput('place_finish_mh_per_sf', 'Place and finish production rate', 'production', 'MH/SF', ['labor.place_finish_mh']),
      numberInput('form_mh_per_sf', 'Form production rate', 'production', 'MH/SF', ['labor.forms_mh']),
      numberInput('rebar_mh_per_lb', 'Reinforcing production rate', 'production', 'MH/LB', ['labor.reinforcing_mh']),
      numberInput('anchor_embed_mh_per_ea', 'Anchor/embed production rate', 'production', 'MH/EA', ['labor.anchors_embeds_mh']),
      ...commonWasteInputs,
      ...commonDrawingInputs,
    ],
    defaultModules: ['concrete', 'forms', 'reinforcing', 'anchors_embeds', 'slab_systems', 'labor'],
    outputs: [
      output('concrete.installed_cy', 'concrete', 'Concrete — installed', 'material', 'CY', 'slab-volume-v1', 'concrete'),
      output('concrete.procurement_cy', 'concrete', 'Concrete — procurement', 'material', 'CY', 'waste-adjustment-v1', 'concrete_procurement'),
      output('forms.edge_contact_sf', 'forms', 'Edge form contact area', 'material', 'SF', 'slab-edge-form-v1', 'forms'),
      output('reinforcing.steel_lb', 'reinforcing', 'Reinforcing steel', 'material', 'LB', 'slab-rebar-allowance-v1', 'rebar'),
      output('slab_systems.vapor_barrier_sf', 'slab_systems', 'Vapor barrier', 'material', 'SF', 'area-waste-v1', 'vapor_barrier'),
      output('slab_systems.base_cy', 'slab_systems', 'Aggregate base', 'material', 'CY', 'slab-base-volume-v1', 'base'),
      output('anchors_embeds.anchor_ea', 'anchors_embeds', 'Anchors / embeds', 'material', 'EA', 'role-count-v1', 'anchors'),
      output('labor.place_finish_mh', 'labor', 'Place and finish labor', 'labor', 'HR', 'production-rate-v1', 'labor_place_finish'),
      output('labor.forms_mh', 'labor', 'Form labor', 'labor', 'HR', 'production-rate-v1', 'labor_forms'),
      output('labor.reinforcing_mh', 'labor', 'Reinforcing labor', 'labor', 'HR', 'production-rate-v1', 'labor_rebar'),
      output('labor.anchors_embeds_mh', 'labor', 'Anchor / embed labor', 'labor', 'HR', 'production-rate-v1', 'labor_anchors'),
    ],
  },
};

export function conditionArchetype(key: string): ConditionArchetypeDefinition {
  const definition = CONDITION_ARCHETYPES[key];
  if (!definition) throw new Error(`Unsupported Concrete Condition archetype: ${key}`);
  return definition;
}
