export type AssemblyTemplateProperty = {
  key: string;
  label: string;
  valueType: 'number' | 'dimension' | 'percentage' | 'boolean' | 'enum' | 'text';
  unit?: string | null;
  required?: boolean;
  inputRole?: 'plan_fact' | 'method_decision' | 'production_assumption' | 'commercial_assumption';
  group?: string;
  helpText?: string;
  options?: Array<{ value: string; label: string }>;
};

export type AssemblyTemplateComponent = {
  key: string;
  label: string;
  itemType: 'labor' | 'material' | 'equipment' | 'subcontractor' | 'other';
  resourceBehavior: 'consumed_material' | 'reusable_inventory' | 'labor' | 'owned_equipment' | 'rental' | 'subcontractor' | 'readiness_resource' | 'legacy_other';
  outputUnit: string;
  formula: string;
  laborRateFormula?: string | null;
  pricingStrategy?: 'current_cost' | 'catalog' | 'manual' | 'none';
  activationRule?: Record<string, unknown> | null;
};

export type AssemblyTemplate = {
  id: string;
  name: string;
  code: string;
  category: string;
  primaryMeasurement: 'LF' | 'SF' | 'EA' | 'CY';
  description: string;
  sourceNote: string;
  properties: AssemblyTemplateProperty[];
  components: AssemblyTemplateComponent[];
};

export const ASSEMBLY_TEMPLATES: AssemblyTemplate[] = [
  {
    id: 'strip-footing',
    name: 'Strip Footing',
    code: 'FTG-STRIP',
    category: 'Foundations',
    primaryMeasurement: 'LF',
    description: 'Linear footing recipe with explicit plan dimensions, formwork, reinforcing, placement, and production assumptions.',
    sourceNote: 'Structural starting pattern only. No company production rate, material price, waste factor, risk class, or means/method is pre-approved.',
    properties: [
      { key: 'width_in', label: 'Footing width', valueType: 'dimension', unit: 'IN', required: true, inputRole: 'plan_fact', group: 'Plan facts' },
      { key: 'depth_in', label: 'Footing depth', valueType: 'dimension', unit: 'IN', required: true, inputRole: 'plan_fact', group: 'Plan facts' },
      { key: 'formed_sides', label: 'Formed sides', valueType: 'number', unit: 'EA', required: true, inputRole: 'method_decision', group: 'Means & methods', helpText: '0 = earth formed, 1 = one formed side, 2 = both sides.' },
      { key: 'rebar_lb_per_lf', label: 'Reinforcing density', valueType: 'number', unit: 'LB/LF', required: true, inputRole: 'plan_fact', group: 'Plan facts' },
      { key: 'concrete_waste_pct', label: 'Concrete allowance', valueType: 'percentage', unit: '%', required: true, inputRole: 'production_assumption', group: 'Production' },
      { key: 'form_labor_mh_per_sfca', label: 'Form labor rate', valueType: 'number', unit: 'MH/SFCA', required: true, inputRole: 'production_assumption', group: 'Production' },
      { key: 'rebar_labor_mh_per_lb', label: 'Rebar labor rate', valueType: 'number', unit: 'MH/LB', required: true, inputRole: 'production_assumption', group: 'Production' },
      { key: 'placement_labor_mh_per_cy', label: 'Placement labor rate', valueType: 'number', unit: 'MH/CY', required: true, inputRole: 'production_assumption', group: 'Production' },
    ],
    components: [
      { key: 'ready_mix', label: 'Ready-mix concrete', itemType: 'material', resourceBehavior: 'consumed_material', outputUnit: 'CY', formula: '(Takeoff.Length * (Properties.width_in / 12) * (Properties.depth_in / 12) / 27) * (1 + Properties.concrete_waste_pct / 100)', pricingStrategy: 'current_cost' },
      { key: 'reinforcing', label: 'Reinforcing steel', itemType: 'material', resourceBehavior: 'consumed_material', outputUnit: 'LB', formula: 'Takeoff.Length * Properties.rebar_lb_per_lf', pricingStrategy: 'current_cost' },
      { key: 'form_inventory', label: 'Footing form contact area', itemType: 'material', resourceBehavior: 'reusable_inventory', outputUnit: 'SFCA', formula: 'Takeoff.Length * (Properties.depth_in / 12) * Properties.formed_sides', pricingStrategy: 'manual' },
      { key: 'form_labor', label: 'Form footing', itemType: 'labor', resourceBehavior: 'labor', outputUnit: 'SFCA', formula: 'Takeoff.Length * (Properties.depth_in / 12) * Properties.formed_sides', laborRateFormula: 'Properties.form_labor_mh_per_sfca', pricingStrategy: 'current_cost' },
      { key: 'rebar_labor', label: 'Set reinforcing', itemType: 'labor', resourceBehavior: 'labor', outputUnit: 'LB', formula: 'Takeoff.Length * Properties.rebar_lb_per_lf', laborRateFormula: 'Properties.rebar_labor_mh_per_lb', pricingStrategy: 'current_cost' },
      { key: 'placement_labor', label: 'Place footing concrete', itemType: 'labor', resourceBehavior: 'labor', outputUnit: 'CY', formula: 'Takeoff.Length * (Properties.width_in / 12) * (Properties.depth_in / 12) / 27', laborRateFormula: 'Properties.placement_labor_mh_per_cy', pricingStrategy: 'current_cost' },
    ],
  },
  {
    id: 'slab-on-grade',
    name: 'Slab on Grade',
    code: 'SOG',
    category: 'Slabs & Flatwork',
    primaryMeasurement: 'SF',
    description: 'Area-based slab recipe with concrete, reinforcing, edge forms, vapor retarder, placement, and finishing.',
    sourceNote: 'Structural starting pattern only. Project specifications and estimator-approved methods remain authoritative.',
    properties: [
      { key: 'thickness_in', label: 'Slab thickness', valueType: 'dimension', unit: 'IN', required: true, inputRole: 'plan_fact', group: 'Plan facts' },
      { key: 'rebar_lb_per_sf', label: 'Reinforcing density', valueType: 'number', unit: 'LB/SF', required: true, inputRole: 'plan_fact', group: 'Plan facts' },
      { key: 'vapor_retarder', label: 'Vapor retarder', valueType: 'boolean', required: true, inputRole: 'plan_fact', group: 'Plan facts' },
      { key: 'concrete_waste_pct', label: 'Concrete allowance', valueType: 'percentage', unit: '%', required: true, inputRole: 'production_assumption', group: 'Production' },
      { key: 'edge_form_mh_per_lf', label: 'Edge-form labor rate', valueType: 'number', unit: 'MH/LF', required: true, inputRole: 'production_assumption', group: 'Production' },
      { key: 'rebar_labor_mh_per_lb', label: 'Rebar labor rate', valueType: 'number', unit: 'MH/LB', required: true, inputRole: 'production_assumption', group: 'Production' },
      { key: 'placement_labor_mh_per_cy', label: 'Placement labor rate', valueType: 'number', unit: 'MH/CY', required: true, inputRole: 'production_assumption', group: 'Production' },
      { key: 'finish_labor_mh_per_sf', label: 'Finish labor rate', valueType: 'number', unit: 'MH/SF', required: true, inputRole: 'production_assumption', group: 'Production' },
    ],
    components: [
      { key: 'ready_mix', label: 'Ready-mix concrete', itemType: 'material', resourceBehavior: 'consumed_material', outputUnit: 'CY', formula: '(Takeoff.Area * (Properties.thickness_in / 12) / 27) * (1 + Properties.concrete_waste_pct / 100)', pricingStrategy: 'current_cost' },
      { key: 'reinforcing', label: 'Reinforcing steel', itemType: 'material', resourceBehavior: 'consumed_material', outputUnit: 'LB', formula: 'Takeoff.Area * Properties.rebar_lb_per_sf', pricingStrategy: 'current_cost' },
      { key: 'vapor_retarder', label: 'Vapor retarder', itemType: 'material', resourceBehavior: 'consumed_material', outputUnit: 'SF', formula: 'Takeoff.Area', pricingStrategy: 'current_cost', activationRule: { op: 'eq', left: { var: 'properties.vapor_retarder' }, right: { const: true } } },
      { key: 'edge_form_inventory', label: 'Slab edge forms', itemType: 'material', resourceBehavior: 'reusable_inventory', outputUnit: 'LF', formula: 'Takeoff.Perimeter', pricingStrategy: 'manual' },
      { key: 'edge_form_labor', label: 'Form slab edge', itemType: 'labor', resourceBehavior: 'labor', outputUnit: 'LF', formula: 'Takeoff.Perimeter', laborRateFormula: 'Properties.edge_form_mh_per_lf', pricingStrategy: 'current_cost' },
      { key: 'rebar_labor', label: 'Set slab reinforcing', itemType: 'labor', resourceBehavior: 'labor', outputUnit: 'LB', formula: 'Takeoff.Area * Properties.rebar_lb_per_sf', laborRateFormula: 'Properties.rebar_labor_mh_per_lb', pricingStrategy: 'current_cost' },
      { key: 'placement_labor', label: 'Place slab concrete', itemType: 'labor', resourceBehavior: 'labor', outputUnit: 'CY', formula: 'Takeoff.Area * (Properties.thickness_in / 12) / 27', laborRateFormula: 'Properties.placement_labor_mh_per_cy', pricingStrategy: 'current_cost' },
      { key: 'finish_labor', label: 'Finish slab', itemType: 'labor', resourceBehavior: 'labor', outputUnit: 'SF', formula: 'Takeoff.Area', laborRateFormula: 'Properties.finish_labor_mh_per_sf', pricingStrategy: 'current_cost' },
    ],
  },
  {
    id: 'stem-wall',
    name: 'Stem Wall',
    code: 'WALL-STEM',
    category: 'Walls',
    primaryMeasurement: 'LF',
    description: 'Linear wall recipe with two-sided form contact area, reinforcing, concrete, placement, and stripping-related production inputs.',
    sourceNote: 'Structural starting pattern only. Wall dimensions, reinforcement, form system, productivity, and pricing remain estimator/company decisions.',
    properties: [
      { key: 'wall_width_in', label: 'Wall width', valueType: 'dimension', unit: 'IN', required: true, inputRole: 'plan_fact', group: 'Plan facts' },
      { key: 'wall_height_ft', label: 'Wall height', valueType: 'dimension', unit: 'FT', required: true, inputRole: 'plan_fact', group: 'Plan facts' },
      { key: 'rebar_lb_per_lf', label: 'Reinforcing density', valueType: 'number', unit: 'LB/LF', required: true, inputRole: 'plan_fact', group: 'Plan facts' },
      { key: 'concrete_waste_pct', label: 'Concrete allowance', valueType: 'percentage', unit: '%', required: true, inputRole: 'production_assumption', group: 'Production' },
      { key: 'wall_form_mh_per_sfca', label: 'Wall-form labor rate', valueType: 'number', unit: 'MH/SFCA', required: true, inputRole: 'production_assumption', group: 'Production' },
      { key: 'rebar_labor_mh_per_lb', label: 'Rebar labor rate', valueType: 'number', unit: 'MH/LB', required: true, inputRole: 'production_assumption', group: 'Production' },
      { key: 'placement_labor_mh_per_cy', label: 'Placement labor rate', valueType: 'number', unit: 'MH/CY', required: true, inputRole: 'production_assumption', group: 'Production' },
    ],
    components: [
      { key: 'ready_mix', label: 'Ready-mix concrete', itemType: 'material', resourceBehavior: 'consumed_material', outputUnit: 'CY', formula: '(Takeoff.Length * (Properties.wall_width_in / 12) * Properties.wall_height_ft / 27) * (1 + Properties.concrete_waste_pct / 100)', pricingStrategy: 'current_cost' },
      { key: 'reinforcing', label: 'Wall reinforcing steel', itemType: 'material', resourceBehavior: 'consumed_material', outputUnit: 'LB', formula: 'Takeoff.Length * Properties.rebar_lb_per_lf', pricingStrategy: 'current_cost' },
      { key: 'wall_forms', label: 'Wall form contact area', itemType: 'material', resourceBehavior: 'reusable_inventory', outputUnit: 'SFCA', formula: 'Takeoff.Length * Properties.wall_height_ft * 2', pricingStrategy: 'manual' },
      { key: 'wall_form_labor', label: 'Form wall', itemType: 'labor', resourceBehavior: 'labor', outputUnit: 'SFCA', formula: 'Takeoff.Length * Properties.wall_height_ft * 2', laborRateFormula: 'Properties.wall_form_mh_per_sfca', pricingStrategy: 'current_cost' },
      { key: 'rebar_labor', label: 'Set wall reinforcing', itemType: 'labor', resourceBehavior: 'labor', outputUnit: 'LB', formula: 'Takeoff.Length * Properties.rebar_lb_per_lf', laborRateFormula: 'Properties.rebar_labor_mh_per_lb', pricingStrategy: 'current_cost' },
      { key: 'placement_labor', label: 'Place wall concrete', itemType: 'labor', resourceBehavior: 'labor', outputUnit: 'CY', formula: 'Takeoff.Length * (Properties.wall_width_in / 12) * Properties.wall_height_ft / 27', laborRateFormula: 'Properties.placement_labor_mh_per_cy', pricingStrategy: 'current_cost' },
    ],
  },
];

export const assemblyTemplateById = (id: string) => ASSEMBLY_TEMPLATES.find(template => template.id === id) || null;
