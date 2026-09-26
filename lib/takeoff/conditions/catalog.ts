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
  { key: 'elevation_reference', label: 'Elevation reference', group: 'drawing', valueType: 'select', options: ['top', 'bottom', 'centerline'], requiredBy: ['3d_projection'] },
];

const edgeCommonInputs = [
  ...commonWasteInputs,
  ...commonLaborInputs.filter(input => input.key !== 'anchor_embed_mh_per_ea'),
  ...commonDrawingInputs,
];

const edgeOutputs = (options: { excavation?: boolean } = {}): ConditionOutputDefinition[] => [
  output('concrete.installed_cy', 'concrete', 'Concrete — installed', 'material', 'CY', 'edge-volume-v1', 'concrete'),
  output('concrete.procurement_cy', 'concrete', 'Concrete — procurement', 'material', 'CY', 'waste-adjustment-v1', 'concrete_procurement'),
  output('forms.contact_sf', 'forms', 'Form contact area', 'material', 'SF', 'edge-form-contact-v1', 'forms'),
  output('reinforcing.steel_lb', 'reinforcing', 'Reinforcing steel', 'material', 'LB', 'edge-rebar-weight-v1', 'rebar'),
  ...(options.excavation ? [
    output('excavation_backfill.excavation_cy', 'excavation_backfill', 'Excavation', 'material', 'CY', 'linear-excavation-v1', 'excavation'),
    output('excavation_backfill.backfill_cy', 'excavation_backfill', 'Backfill', 'material', 'CY', 'excavation-less-concrete-v1', 'backfill'),
  ] : []),
  output('labor.place_concrete_mh', 'labor', 'Place concrete labor', 'labor', 'HR', 'production-rate-v1', 'labor_place'),
  output('labor.forms_mh', 'labor', 'Form labor', 'labor', 'HR', 'production-rate-v1', 'labor_forms'),
  output('labor.reinforcing_mh', 'labor', 'Reinforcing labor', 'labor', 'HR', 'production-rate-v1', 'labor_rebar'),
];

const edgeModules = ['concrete', 'forms', 'reinforcing', 'excavation_backfill', 'labor'];

const edgeDefinition = (
  key: 'thickened_edge' | 'thickened_slab' | 'grade_beam' | 'foundation_wall' | 'column_pier' | 'elevated_slab' | 'stairs' | 'curb',
  name: string,
  primaryUnit: 'EA' | 'LF' | 'SF',
  roles: ConditionArchetypeDefinition['roles'],
  inputs: ConditionInputDefinition[],
  options: { excavation?: boolean } = {},
): ConditionArchetypeDefinition => ({
  key,
  name,
  primaryUnit,
  roles,
  inputs,
  defaultModules: edgeModules,
  outputs: edgeOutputs(options),
});

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
  thickened_edge: edgeDefinition(
    'thickened_edge',
    'Thickened Edge',
    'LF',
    [{ key: 'run', label: 'Thickened edge run', unit: 'LF', geometryType: 'polyline', primary: true, required: true }],
    [
      numberInput('width_ft', 'Thickened width', 'planFacts', 'FT', ['concrete.installed_cy']),
      numberInput('depth_ft', 'Thickened depth', 'planFacts', 'FT', ['concrete.installed_cy', 'forms.contact_sf']),
      numberInput('slab_thickness_in', 'Adjacent slab thickness', 'planFacts', 'IN', ['concrete.installed_cy']),
      numberInput('formed_sides', 'Formed sides', 'methods', 'EA', ['forms.contact_sf'], 0),
      numberInput('longitudinal_bar_count', 'Longitudinal bar count', 'methods', 'EA', ['reinforcing.steel_lb']),
      numberInput('rebar_unit_weight_lb_per_ft', 'Rebar unit weight', 'methods', 'LB/LF', ['reinforcing.steel_lb']),
      ...edgeCommonInputs,
    ],
  ),
  thickened_slab: edgeDefinition(
    'thickened_slab',
    'Thickened Slab',
    'SF',
    [
      { key: 'area', label: 'Net slab area', unit: 'SF', geometryType: 'polygon', primary: true, required: true },
      { key: 'thickened_edge', label: 'Thickened edge run', unit: 'LF', geometryType: 'polyline', primary: false, required: false },
    ],
    [
      numberInput('thickness_in', 'Slab thickness', 'planFacts', 'IN', ['concrete.installed_cy']),
      numberInput('thickened_width_ft', 'Thickened width', 'planFacts', 'FT', ['concrete.installed_cy']),
      numberInput('thickened_depth_in', 'Thickened depth', 'planFacts', 'IN', ['concrete.installed_cy', 'forms.contact_sf']),
      numberInput('reinforcing_lb_per_sf', 'Reinforcing allowance', 'methods', 'LB/SF', ['reinforcing.steel_lb']),
      numberInput('formed_sides', 'Formed sides', 'methods', 'EA', ['forms.contact_sf'], 0),
      ...edgeCommonInputs,
    ],
  ),
  grade_beam: edgeDefinition(
    'grade_beam',
    'Grade Beam',
    'LF',
    [{ key: 'run', label: 'Grade beam run', unit: 'LF', geometryType: 'polyline', primary: true, required: true }],
    [
      numberInput('width_ft', 'Width', 'planFacts', 'FT', ['concrete.installed_cy']),
      numberInput('depth_ft', 'Depth', 'planFacts', 'FT', ['concrete.installed_cy', 'forms.contact_sf']),
      numberInput('excavation_width_ft', 'Excavation width', 'planFacts', 'FT', ['excavation_backfill.excavation_cy']),
      numberInput('excavation_depth_ft', 'Excavation depth', 'planFacts', 'FT', ['excavation_backfill.excavation_cy']),
      numberInput('formed_sides', 'Formed sides', 'methods', 'EA', ['forms.contact_sf'], 0),
      numberInput('longitudinal_bar_count', 'Longitudinal bar count', 'methods', 'EA', ['reinforcing.steel_lb']),
      numberInput('rebar_unit_weight_lb_per_ft', 'Rebar unit weight', 'methods', 'LB/LF', ['reinforcing.steel_lb']),
      ...edgeCommonInputs,
    ],
    { excavation: true },
  ),
  foundation_wall: edgeDefinition(
    'foundation_wall',
    'Foundation Wall',
    'LF',
    [{ key: 'run', label: 'Foundation wall run', unit: 'LF', geometryType: 'polyline', primary: true, required: true }],
    [
      numberInput('thickness_ft', 'Wall thickness', 'planFacts', 'FT', ['concrete.installed_cy']),
      numberInput('height_ft', 'Wall height', 'planFacts', 'FT', ['concrete.installed_cy', 'forms.contact_sf']),
      numberInput('excavation_width_ft', 'Excavation width', 'planFacts', 'FT', ['excavation_backfill.excavation_cy']),
      numberInput('excavation_depth_ft', 'Excavation depth', 'planFacts', 'FT', ['excavation_backfill.excavation_cy']),
      numberInput('formed_sides', 'Formed sides', 'methods', 'EA', ['forms.contact_sf'], 0),
      numberInput('longitudinal_bar_count', 'Longitudinal bar count', 'methods', 'EA', ['reinforcing.steel_lb']),
      numberInput('rebar_unit_weight_lb_per_ft', 'Rebar unit weight', 'methods', 'LB/LF', ['reinforcing.steel_lb']),
      ...edgeCommonInputs,
    ],
    { excavation: true },
  ),
  column_pier: edgeDefinition(
    'column_pier',
    'Column / Pier',
    'EA',
    [{ key: 'locations', label: 'Column / pier locations', unit: 'EA', geometryType: 'count', primary: true, required: true }],
    [
      numberInput('width_ft', 'Width', 'planFacts', 'FT', ['concrete.installed_cy', 'forms.contact_sf']),
      numberInput('length_ft', 'Length', 'planFacts', 'FT', ['concrete.installed_cy', 'forms.contact_sf']),
      numberInput('depth_ft', 'Depth', 'planFacts', 'FT', ['concrete.installed_cy', 'forms.contact_sf']),
      numberInput('formed_sides', 'Formed sides', 'methods', 'EA', ['forms.contact_sf'], 0),
      numberInput('rebar_lf_per_each', 'Reinforcing length per column / pier', 'methods', 'LF/EA', ['reinforcing.steel_lb']),
      numberInput('rebar_unit_weight_lb_per_ft', 'Rebar unit weight', 'methods', 'LB/LF', ['reinforcing.steel_lb']),
      ...edgeCommonInputs,
    ],
  ),
  elevated_slab: edgeDefinition(
    'elevated_slab',
    'Elevated Slab',
    'SF',
    [
      { key: 'area', label: 'Net elevated slab area', unit: 'SF', geometryType: 'polygon', primary: true, required: true },
      { key: 'edge_forms', label: 'Elevated slab edge forms', unit: 'LF', geometryType: 'polyline', primary: false, required: false },
    ],
    [
      numberInput('thickness_in', 'Slab thickness', 'planFacts', 'IN', ['concrete.installed_cy']),
      numberInput('reinforcing_lb_per_sf', 'Reinforcing allowance', 'methods', 'LB/SF', ['reinforcing.steel_lb']),
      numberInput('formed_sides', 'Formed sides', 'methods', 'EA', ['forms.contact_sf'], 0),
      ...edgeCommonInputs,
    ],
  ),
  stairs: edgeDefinition(
    'stairs',
    'Concrete Stairs',
    'EA',
    [{ key: 'locations', label: 'Stair flights', unit: 'EA', geometryType: 'count', primary: true, required: true }],
    [
      numberInput('stair_width_ft', 'Stair width', 'planFacts', 'FT', ['concrete.installed_cy', 'forms.contact_sf']),
      numberInput('tread_depth_ft', 'Tread depth', 'planFacts', 'FT', ['concrete.installed_cy']),
      numberInput('riser_count', 'Riser count', 'planFacts', 'EA', ['concrete.installed_cy', 'forms.contact_sf']),
      numberInput('riser_height_in', 'Riser height', 'planFacts', 'IN', ['concrete.installed_cy', 'forms.contact_sf']),
      numberInput('waist_thickness_in', 'Waist thickness', 'planFacts', 'IN', ['concrete.installed_cy']),
      numberInput('formed_sides', 'Formed sides', 'methods', 'EA', ['forms.contact_sf'], 0),
      numberInput('reinforcing_lb_per_sf', 'Reinforcing allowance', 'methods', 'LB/SF', ['reinforcing.steel_lb']),
      ...edgeCommonInputs,
    ],
  ),
  curb: edgeDefinition(
    'curb',
    'Concrete Curb',
    'LF',
    [{ key: 'run', label: 'Curb run', unit: 'LF', geometryType: 'polyline', primary: true, required: true }],
    [
      numberInput('width_ft', 'Width', 'planFacts', 'FT', ['concrete.installed_cy']),
      numberInput('height_ft', 'Height', 'planFacts', 'FT', ['concrete.installed_cy', 'forms.contact_sf']),
      numberInput('formed_sides', 'Formed sides', 'methods', 'EA', ['forms.contact_sf'], 0),
      numberInput('rebar_lb_per_lf', 'Reinforcing allowance', 'methods', 'LB/LF', ['reinforcing.steel_lb']),
      ...edgeCommonInputs,
    ],
  ),
  opening_boxout: {
    key: 'opening_boxout',
    name: 'Opening / Boxout',
    primaryUnit: 'EA',
    roles: [{ key: 'locations', label: 'Opening / boxout locations', unit: 'EA', geometryType: 'count', primary: true, required: true }],
    inputs: [
      numberInput('width_ft', 'Opening width', 'planFacts', 'FT', ['concrete.opening_cy', 'forms.contact_sf']),
      numberInput('height_ft', 'Opening height', 'planFacts', 'FT', ['concrete.opening_cy', 'forms.contact_sf']),
      numberInput('depth_ft', 'Opening depth', 'planFacts', 'FT', ['concrete.opening_cy', 'forms.contact_sf']),
      numberInput('formed_sides', 'Formed sides', 'methods', 'EA', ['forms.contact_sf'], 0),
      ...commonLaborInputs.filter(input => ['form_mh_per_sf'].includes(input.key)),
      ...commonDrawingInputs,
    ],
    defaultModules: ['concrete', 'forms', 'labor'],
    outputs: [
      output('concrete.opening_cy', 'concrete', 'Concrete opening deduction', 'material', 'CY', 'opening-volume-v1', 'opening'),
      output('forms.contact_sf', 'forms', 'Opening form contact area', 'material', 'SF', 'opening-form-contact-v1', 'forms'),
      output('labor.forms_mh', 'labor', 'Opening form labor', 'labor', 'HR', 'production-rate-v1', 'labor_forms'),
    ],
  },
};

export function conditionArchetype(key: string): ConditionArchetypeDefinition {
  const definition = CONDITION_ARCHETYPES[key];
  if (!definition) throw new Error(`Unsupported Concrete Condition archetype: ${key}`);
  return definition;
}
