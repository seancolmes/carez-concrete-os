'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { compileFormulaExpression } from '@/lib/takeoff/formulaExpression';

export type ConcreteSystemPreset =
  | 'concrete_volume'
  | 'rebar_continuous'
  | 'rebar_spaced'
  | 'rebar_grid'
  | 'wwf'
  | 'dowels'
  | 'fiber'
  | 'vapor_barrier'
  | 'formwork'
  | 'labor'
  | 'placement'
  | 'custom';

type PropertySeed = {
  key: string;
  label: string;
  valueType: 'number' | 'dimension' | 'percentage' | 'boolean' | 'enum' | 'text';
  unit?: string | null;
  required?: boolean;
  inputRole?: 'plan_fact' | 'method_decision' | 'production_assumption' | 'commercial_assumption';
  group?: string;
  options?: Array<{ value: string; label: string; attributes?: Record<string, number> }> | null;
  activationRule?: Record<string, unknown> | null;
};

type ComponentSeed = {
  key: string;
  label: string;
  itemType: 'labor' | 'material' | 'equipment' | 'subcontractor' | 'other';
  behavior: 'consumed_material' | 'reusable_inventory' | 'labor' | 'owned_equipment' | 'rental' | 'subcontractor' | 'readiness_resource' | 'legacy_other';
  unit: string;
  formula: string;
  laborRateFormula?: string | null;
  pricingStrategy?: 'current_cost' | 'catalog' | 'manual' | 'none';
  activationRule?: Record<string, unknown> | null;
  notes?: string | null;
};

const rebarOptions = [
  ['3', '#3', 0.376], ['4', '#4', 0.668], ['5', '#5', 1.043], ['6', '#6', 1.502],
  ['7', '#7', 2.044], ['8', '#8', 2.67], ['9', '#9', 3.4], ['10', '#10', 4.303],
  ['11', '#11', 5.313], ['14', '#14', 7.65], ['18', '#18', 13.6],
].map(([value, label, weight]) => ({ value: String(value), label: String(label), attributes: { lb_per_ft: Number(weight) } }));

async function context() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in.');
  const { data: profile } = await supabase.from('profiles').select('company_id,role').eq('id', user.id).single();
  if (!profile?.company_id || profile.role === 'employee') throw new Error('Owner access required.');
  return { supabase, companyId: profile.company_id };
}

async function assertEditableSet(supabase: any, companyId: string, setId: string) {
  const { data: set } = await supabase.from('takeoff_sets').select('id,estimate_id,status').eq('id', setId).eq('company_id', companyId).maybeSingle();
  if (!set || set.status !== 'active') throw new Error('Active takeoff set not found.');
  const { data: estimate } = await supabase.from('estimates').select('id,status').eq('id', set.estimate_id).eq('company_id', companyId).maybeSingle();
  if (!estimate || ['accepted', 'approved', 'superseded'].includes(estimate.status)) throw new Error('This estimate revision is locked.');
  const { count } = await supabase.from('proposal_presentations').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('estimate_id', set.estimate_id);
  if ((count || 0) > 0) throw new Error('This estimate revision was already issued. Create the next revision before changing takeoff.');
}

const suffixKey = (base: string, used: Set<string>) => {
  if (!used.has(base)) { used.add(base); return base; }
  let index = 2;
  while (used.has(`${base}_${index}`)) index += 1;
  const key = `${base}_${index}`;
  used.add(key);
  return key;
};

const activeWhenTrue = (key: string) => ({ op: 'eq', left: { var: `properties.${key}` }, right: { const: true } });
const activeWhenChoice = (key: string, value: string) => ({ op: 'eq', left: { var: `properties.${key}` }, right: { const: value } });

function systemSeeds(preset: ConcreteSystemPreset, primary: string, variableKeys: Set<string>, componentKeys: Set<string>) {
  const properties: PropertySeed[] = [];
  const components: ComponentSeed[] = [];
  const prop = (base: string, seed: Omit<PropertySeed, 'key'>) => {
    const key = suffixKey(base, variableKeys);
    properties.push({ key, ...seed });
    return key;
  };
  const component = (base: string, seed: Omit<ComponentSeed, 'key'>) => {
    const key = suffixKey(base, componentKeys);
    components.push({ key, ...seed });
    return key;
  };

  if (preset === 'concrete_volume') {
    const waste = prop('concrete_waste_pct', { label: 'Concrete waste / order allowance', valueType: 'percentage', unit: '%', required: true, inputRole: 'production_assumption', group: 'Concrete' });
    let baseFormula = 'Quantity';
    if (primary === 'SF') {
      const thickness = prop('concrete_thickness_in', { label: 'Concrete thickness', valueType: 'dimension', unit: 'IN', required: true, inputRole: 'plan_fact', group: 'Concrete' });
      baseFormula = `Area * ${thickness} / 12 / 27`;
    } else if (primary === 'LF') {
      const width = prop('concrete_width_in', { label: 'Concrete width', valueType: 'dimension', unit: 'IN', required: true, inputRole: 'plan_fact', group: 'Concrete' });
      const depth = prop('concrete_depth_in', { label: 'Concrete depth / height', valueType: 'dimension', unit: 'IN', required: true, inputRole: 'plan_fact', group: 'Concrete' });
      baseFormula = `Length * ${width} / 12 * ${depth} / 12 / 27`;
    } else if (primary === 'EA') {
      const volumeEach = prop('concrete_cy_each', { label: 'Concrete per each', valueType: 'number', unit: 'CY/EA', required: true, inputRole: 'plan_fact', group: 'Concrete' });
      baseFormula = `Count * ${volumeEach}`;
    } else if (primary === 'CY') {
      baseFormula = 'Volume';
    }
    component('ready_mix', { label: 'Ready-mix concrete', itemType: 'material', behavior: 'consumed_material', unit: 'CY', formula: `(${baseFormula}) * (1 + ${waste} / 100)`, pricingStrategy: 'current_cost', notes: 'Concrete system starter. Review dimensions, allowance, mix/product, and pricing before publishing.' });
  }

  if (preset === 'rebar_continuous') {
    const use = prop('use_continuous_rebar', { label: 'Use continuous reinforcing', valueType: 'boolean', required: true, inputRole: 'plan_fact', group: 'Reinforcing' });
    const rule = activeWhenTrue(use);
    const size = prop('continuous_bar_size', { label: 'Continuous bar size', valueType: 'enum', required: true, inputRole: 'plan_fact', group: 'Reinforcing', options: rebarOptions, activationRule: rule });
    const count = prop('continuous_bar_count', { label: 'Continuous bar count', valueType: 'number', unit: 'EA', required: true, inputRole: 'plan_fact', group: 'Reinforcing', activationRule: rule });
    const laps = prop('continuous_rebar_allowance_pct', { label: 'Lap / reinforcing allowance', valueType: 'percentage', unit: '%', required: true, inputRole: 'production_assumption', group: 'Reinforcing', activationRule: rule });
    component('continuous_rebar', { label: 'Continuous reinforcing', itemType: 'material', behavior: 'consumed_material', unit: 'LB', formula: `Length * ${count} * ${size}.lb_per_ft * (1 + ${laps} / 100)`, pricingStrategy: 'current_cost', activationRule: rule, notes: 'Continuous-bar system starter. Bar size, count, laps and product remain estimator-controlled.' });
  }

  if (preset === 'rebar_spaced') {
    const use = prop('use_spaced_rebar', { label: 'Use spaced / transverse reinforcing', valueType: 'boolean', required: true, inputRole: 'plan_fact', group: 'Reinforcing' });
    const rule = activeWhenTrue(use);
    const size = prop('spaced_bar_size', { label: 'Spaced bar size', valueType: 'enum', required: true, inputRole: 'plan_fact', group: 'Reinforcing', options: rebarOptions, activationRule: rule });
    const spacing = prop('spaced_bar_spacing_in', { label: 'Bar spacing', valueType: 'dimension', unit: 'IN', required: true, inputRole: 'plan_fact', group: 'Reinforcing', activationRule: rule });
    const length = prop('spaced_bar_length_ft', { label: 'Each bar length', valueType: 'dimension', unit: 'FT', required: true, inputRole: 'plan_fact', group: 'Reinforcing', activationRule: rule });
    const allowance = prop('spaced_rebar_allowance_pct', { label: 'Lap / reinforcing allowance', valueType: 'percentage', unit: '%', required: true, inputRole: 'production_assumption', group: 'Reinforcing', activationRule: rule });
    component('spaced_rebar', { label: 'Spaced / transverse reinforcing', itemType: 'material', behavior: 'consumed_material', unit: 'LB', formula: `(ceil(Length * 12 / ${spacing}) + 1) * ${length} * ${size}.lb_per_ft * (1 + ${allowance} / 100)`, pricingStrategy: 'current_cost', activationRule: rule, notes: 'Spaced-bar starter. Review measured basis, edge condition and bar length for the actual detail.' });
  }

  if (preset === 'rebar_grid') {
    const use = prop('use_rebar_grid', { label: 'Use rebar grid / mat', valueType: 'boolean', required: true, inputRole: 'plan_fact', group: 'Reinforcing' });
    const rule = activeWhenTrue(use);
    const size = prop('grid_bar_size', { label: 'Grid bar size', valueType: 'enum', required: true, inputRole: 'plan_fact', group: 'Reinforcing', options: rebarOptions, activationRule: rule });
    const spacing = prop('grid_spacing_in', { label: 'Grid spacing', valueType: 'dimension', unit: 'IN', required: true, inputRole: 'plan_fact', group: 'Reinforcing', activationRule: rule });
    const directions = prop('grid_directions', { label: 'Grid directions', valueType: 'enum', required: true, inputRole: 'plan_fact', group: 'Reinforcing', options: [{ value: 'one_way', label: 'One way', attributes: { factor: 1 } }, { value: 'each_way', label: 'Each way', attributes: { factor: 2 } }], activationRule: rule });
    const mats = prop('grid_mats', { label: 'Mats / layers', valueType: 'number', unit: 'EA', required: true, inputRole: 'plan_fact', group: 'Reinforcing', activationRule: rule });
    const allowance = prop('grid_rebar_allowance_pct', { label: 'Lap / reinforcing allowance', valueType: 'percentage', unit: '%', required: true, inputRole: 'production_assumption', group: 'Reinforcing', activationRule: rule });
    const basis = primary === 'SF' ? 'Area' : primary === 'LF' ? 'Length' : 'Quantity';
    const formula = primary === 'SF'
      ? `${basis} / (${spacing} / 12) * ${directions}.factor * ${mats} * ${size}.lb_per_ft * (1 + ${allowance} / 100)`
      : `${basis} * ${directions}.factor * ${mats} * ${size}.lb_per_ft * (1 + ${allowance} / 100)`;
    component('rebar_grid', { label: 'Rebar grid / mat', itemType: 'material', behavior: 'consumed_material', unit: 'LB', formula, pricingStrategy: 'current_cost', activationRule: rule, notes: primary === 'SF' ? 'Grid starter uses area/spacing estimating math. Review edge bars, laps, openings, support steel and drawing-specific layout.' : 'Grid starter requires estimator review because the primary geometry is not area-based.' });
  }

  if (preset === 'wwf') {
    const use = prop('use_wwf', { label: 'Use WWF / WWR', valueType: 'boolean', required: true, inputRole: 'plan_fact', group: 'Reinforcing' });
    const rule = activeWhenTrue(use);
    const allowance = prop('wwf_allowance_pct', { label: 'WWF overlap / waste', valueType: 'percentage', unit: '%', required: true, inputRole: 'production_assumption', group: 'Reinforcing', activationRule: rule });
    const coverage = primary === 'SF' ? 'Area' : primary === 'EA' ? 'Count' : 'Quantity';
    component('wwf', { label: 'WWF / WWR', itemType: 'material', behavior: 'consumed_material', unit: primary === 'SF' ? 'SF' : 'EA', formula: `${coverage} * (1 + ${allowance} / 100)`, pricingStrategy: 'current_cost', activationRule: rule, notes: 'WWF/WWR coverage starter. Select the actual mesh product and verify laps, sheets/rolls and procurement units.' });
  }

  if (preset === 'dowels') {
    const use = prop('use_dowels', { label: 'Use dowels / starters', valueType: 'boolean', required: true, inputRole: 'plan_fact', group: 'Reinforcing' });
    const rule = activeWhenTrue(use);
    const size = prop('dowel_bar_size', { label: 'Dowel bar size', valueType: 'enum', required: true, inputRole: 'plan_fact', group: 'Reinforcing', options: rebarOptions, activationRule: rule });
    const spacing = prop('dowel_spacing_in', { label: 'Dowel spacing', valueType: 'dimension', unit: 'IN', required: true, inputRole: 'plan_fact', group: 'Reinforcing', activationRule: rule });
    const length = prop('dowel_length_ft', { label: 'Dowel length', valueType: 'dimension', unit: 'FT', required: true, inputRole: 'plan_fact', group: 'Reinforcing', activationRule: rule });
    const allowance = prop('dowel_allowance_pct', { label: 'Dowel allowance', valueType: 'percentage', unit: '%', required: true, inputRole: 'production_assumption', group: 'Reinforcing', activationRule: rule });
    const measured = primary === 'LF' ? 'Length' : 'Perimeter';
    component('dowels', { label: 'Dowels / starters', itemType: 'material', behavior: 'consumed_material', unit: 'LB', formula: `(ceil(${measured} * 12 / ${spacing}) + 1) * ${length} * ${size}.lb_per_ft * (1 + ${allowance} / 100)`, pricingStrategy: 'current_cost', activationRule: rule, notes: 'Dowel starter. Verify edges/corners, embed/development length, epoxy scope and actual drawing spacing.' });
  }

  if (preset === 'fiber') {
    const use = prop('use_fiber', { label: 'Use fiber reinforcement', valueType: 'boolean', required: true, inputRole: 'plan_fact', group: 'Reinforcing' });
    const rule = activeWhenTrue(use);
    const dosage = prop('fiber_dosage_lb_per_cy', { label: 'Fiber dosage', valueType: 'number', unit: 'LB/CY', required: true, inputRole: 'plan_fact', group: 'Reinforcing', activationRule: rule });
    let volume = primary === 'CY' ? 'Volume' : 'Quantity';
    if (primary === 'SF') {
      const thickness = prop('fiber_thickness_in', { label: 'Concrete thickness for fiber', valueType: 'dimension', unit: 'IN', required: true, inputRole: 'plan_fact', group: 'Reinforcing', activationRule: rule });
      volume = `Area * ${thickness} / 12 / 27`;
    } else if (primary === 'LF') {
      const width = prop('fiber_width_in', { label: 'Concrete width for fiber', valueType: 'dimension', unit: 'IN', required: true, inputRole: 'plan_fact', group: 'Reinforcing', activationRule: rule });
      const depth = prop('fiber_depth_in', { label: 'Concrete depth for fiber', valueType: 'dimension', unit: 'IN', required: true, inputRole: 'plan_fact', group: 'Reinforcing', activationRule: rule });
      volume = `Length * ${width} / 12 * ${depth} / 12 / 27`;
    }
    component('fiber', { label: 'Fiber reinforcement', itemType: 'material', behavior: 'consumed_material', unit: 'LB', formula: `(${volume}) * ${dosage}`, pricingStrategy: 'current_cost', activationRule: rule, notes: 'Fiber dosage starter. Select the specified fiber/product and verify dosage from the project documents.' });
  }

  if (preset === 'vapor_barrier') {
    const use = prop('use_vapor_barrier', { label: 'Use vapor barrier / retarder', valueType: 'boolean', required: true, inputRole: 'plan_fact', group: 'Vapor barrier' });
    const rule = activeWhenTrue(use);
    const allowance = prop('vapor_allowance_pct', { label: 'Vapor overlap / waste', valueType: 'percentage', unit: '%', required: true, inputRole: 'production_assumption', group: 'Vapor barrier', activationRule: rule });
    let coverage = primary === 'SF' ? 'Area' : primary === 'EA' ? 'Count' : 'Quantity';
    if (primary === 'LF') {
      const width = prop('vapor_width_ft', { label: 'Vapor coverage width', valueType: 'dimension', unit: 'FT', required: true, inputRole: 'plan_fact', group: 'Vapor barrier', activationRule: rule });
      coverage = `Length * ${width}`;
    }
    component('vapor_barrier', { label: 'Vapor barrier / retarder', itemType: 'material', behavior: 'consumed_material', unit: 'SF', formula: `(${coverage}) * (1 + ${allowance} / 100)`, pricingStrategy: 'current_cost', activationRule: rule, notes: 'Vapor starter. Select actual product and account for seams, penetrations, turned-up edges and accessory tape where required.' });
  }

  if (preset === 'formwork') {
    const use = prop('use_formwork', { label: 'Use formwork', valueType: 'boolean', required: true, inputRole: 'method_decision', group: 'Formwork' });
    const rule = activeWhenTrue(use);
    let area = 'Quantity';
    if (primary === 'LF') {
      const height = prop('form_height_ft', { label: 'Form height / depth', valueType: 'dimension', unit: 'FT', required: true, inputRole: 'plan_fact', group: 'Formwork', activationRule: rule });
      const sides = prop('formed_sides', { label: 'Formed sides', valueType: 'number', unit: 'EA', required: true, inputRole: 'method_decision', group: 'Formwork', activationRule: rule });
      area = `Length * ${height} * ${sides}`;
    } else if (primary === 'SF') {
      const height = prop('edge_form_height_ft', { label: 'Edge form height', valueType: 'dimension', unit: 'FT', required: true, inputRole: 'plan_fact', group: 'Formwork', activationRule: rule });
      area = `Perimeter * ${height}`;
    } else if (primary === 'EA') {
      const each = prop('form_area_each_sfca', { label: 'Form contact area per each', valueType: 'number', unit: 'SFCA/EA', required: true, inputRole: 'plan_fact', group: 'Formwork', activationRule: rule });
      area = `Count * ${each}`;
    }
    const rate = prop('form_labor_mh_per_sfca', { label: 'Form labor production', valueType: 'number', unit: 'MH/SFCA', required: true, inputRole: 'production_assumption', group: 'Formwork', activationRule: rule });
    component('formwork_demand', { label: 'Formwork demand', itemType: 'material', behavior: 'reusable_inventory', unit: 'SFCA', formula: area, pricingStrategy: 'manual', activationRule: rule, notes: 'Physical form-contact demand. Add specific panels/lumber/hardware or child recipes to represent the actual forming system.' });
    component('form_labor', { label: 'Form labor', itemType: 'labor', behavior: 'labor', unit: 'SFCA', formula: area, laborRateFormula: rate, pricingStrategy: 'current_cost', activationRule: rule, notes: 'Estimator-controlled form production assumption.' });
  }

  if (preset === 'labor') {
    const unit = primary || 'EA';
    const rate = prop('labor_mh_per_unit', { label: `Labor production`, valueType: 'number', unit: `MH/${unit}`, required: true, inputRole: 'production_assumption', group: 'Labor' });
    component('labor_operation', { label: 'Labor operation', itemType: 'labor', behavior: 'labor', unit, formula: 'Quantity', laborRateFormula: rate, pricingStrategy: 'current_cost', notes: 'Rename this operation and set the estimator-approved production basis.' });
  }

  if (preset === 'placement') {
    const method = prop('placement_method', { label: 'Placement method', valueType: 'enum', required: true, inputRole: 'method_decision', group: 'Placement', options: [{ value: 'direct', label: 'Direct / chute' }, { value: 'line_pump', label: 'Line pump' }, { value: 'boom_pump', label: 'Boom pump' }, { value: 'buggy', label: 'Buggy / cart' }, { value: 'other', label: 'Other' }] });
    component('line_pump', { label: 'Line pump', itemType: 'subcontractor', behavior: 'subcontractor', unit: 'EA', formula: '1', pricingStrategy: 'current_cost', activationRule: activeWhenChoice(method, 'line_pump'), notes: 'Pump service placeholder. Replace/bind to the actual company Resource or supplier quote.' });
    component('boom_pump', { label: 'Boom pump', itemType: 'subcontractor', behavior: 'subcontractor', unit: 'EA', formula: '1', pricingStrategy: 'current_cost', activationRule: activeWhenChoice(method, 'boom_pump'), notes: 'Pump service placeholder. Replace/bind to the actual company Resource or supplier quote.' });
    component('placement_equipment', { label: 'Placement equipment', itemType: 'equipment', behavior: 'owned_equipment', unit: primary || 'EA', formula: 'Quantity', pricingStrategy: 'manual', activationRule: { op: 'or', args: [activeWhenChoice(method, 'buggy'), activeWhenChoice(method, 'other')] }, notes: 'Placement-equipment starter. Review quantity basis and equipment cost treatment.' });
  }

  if (preset === 'custom') {
    component('custom_item', { label: 'Custom scope item', itemType: 'material', behavior: 'consumed_material', unit: primary || 'EA', formula: 'Quantity', pricingStrategy: 'current_cost', notes: 'Custom starter. Edit label, unit, resource type and deterministic formula.' });
  }

  return { properties, components };
}

export async function addAssemblySystemPreset(setId: string, input: { versionId: string; preset: ConcreteSystemPreset }) {
  const { supabase, companyId } = await context();
  await assertEditableSet(supabase, companyId, setId);

  const { data: version } = await supabase.from('concrete_assembly_versions')
    .select('id,status,primary_measurement_snapshot')
    .eq('id', input.versionId).eq('company_id', companyId).maybeSingle();
  if (!version || version.status !== 'draft') throw new Error('Scope Recipe draft not found. Published recipes are read-only.');

  const [{ data: variables }, { data: components }] = await Promise.all([
    supabase.from('concrete_assembly_variables').select('variable_key,sort_order').eq('company_id', companyId).eq('assembly_version_id', input.versionId),
    supabase.from('concrete_assembly_components').select('component_key,sort_order').eq('company_id', companyId).eq('assembly_version_id', input.versionId),
  ]);

  const variableKeys = new Set((variables || []).map((row: any) => String(row.variable_key)));
  const componentKeys = new Set((components || []).map((row: any) => String(row.component_key)));
  const seeds = systemSeeds(input.preset, String(version.primary_measurement_snapshot || 'LF'), variableKeys, componentKeys);
  if (!seeds.properties.length && !seeds.components.length) throw new Error('Unsupported concrete system preset.');

  const nextVariableSort = Math.max(0, ...(variables || []).map((row: any) => Number(row.sort_order || 0))) + 10;
  const nextComponentSort = Math.max(0, ...(components || []).map((row: any) => Number(row.sort_order || 0))) + 10;

  if (seeds.properties.length) {
    const rows = seeds.properties.map((seed, index) => ({
      company_id: companyId,
      assembly_version_id: input.versionId,
      variable_key: seed.key,
      label: seed.label,
      value_type: seed.valueType,
      unit: seed.unit || null,
      default_value: null,
      options: seed.options || null,
      required: seed.required !== false,
      help_text: null,
      sort_order: nextVariableSort + index * 10,
      activation_rule: seed.activationRule || null,
      property_group: seed.group || null,
      expose_in_takeoff: true,
      allow_override: true,
      input_role: seed.inputRole || 'plan_fact',
      requires_verification: ['method_decision', 'production_assumption', 'commercial_assumption'].includes(seed.inputRole || ''),
    }));
    const { error } = await supabase.from('concrete_assembly_variables').insert(rows);
    if (error) throw new Error(error.message);
  }

  if (seeds.components.length) {
    const rows = seeds.components.map((seed, index) => ({
      company_id: companyId,
      assembly_version_id: input.versionId,
      component_key: seed.key,
      label: seed.label,
      estimate_item_type: seed.itemType,
      output_unit: seed.unit,
      quantity_formula: compileFormulaExpression(seed.formula),
      labor_rate_formula: seed.itemType === 'labor' && seed.laborRateFormula ? compileFormulaExpression(seed.laborRateFormula) : null,
      pricing_strategy: seed.pricingStrategy || 'current_cost',
      activation_rule: seed.activationRule || null,
      resource_behavior: seed.behavior,
      estimate_visible: true,
      baseline_source: seed.itemType === 'labor' ? 'Estimator/company production assumption required' : null,
      sort_order: nextComponentSort + index * 10,
      notes: seed.notes || null,
    }));
    const { error } = await supabase.from('concrete_assembly_components').insert(rows);
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/takeoff/${setId}`);
  revalidatePath('/takeoff/assemblies');
  return { propertyCount: seeds.properties.length, componentCount: seeds.components.length };
}
