'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { evaluateTakeoffFormula, formulaTrace, roundTakeoff } from '@/lib/takeoff/formula';

const num = (value: FormDataEntryValue | null) => {
  const n = Number(String(value ?? '').replace(/[$,% ,]/g, ''));
  return Number.isFinite(n) ? n : NaN;
};
const moneyRound = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

async function ctx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in.');
  const { data: profile } = await supabase.from('profiles').select('company_id,role').eq('id', user.id).single();
  if (!profile?.company_id || profile.role === 'employee') throw new Error('Owner access required.');
  return { supabase, user, companyId: profile.company_id };
}

async function assertEstimateEditable(supabase: any, companyId: string, estimateId: string) {
  const { data: estimate } = await supabase.from('estimates').select('id,status').eq('id', estimateId).eq('company_id', companyId).maybeSingle();
  if (!estimate) throw new Error('Estimate not found.');
  if (['accepted', 'approved', 'superseded'].includes(estimate.status)) throw new Error('This estimate revision is locked.');
  const { count } = await supabase.from('proposal_presentations').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('estimate_id', estimateId);
  if ((count || 0) > 0) throw new Error('This estimate revision was already issued. Create the next revision before changing takeoff.');
}

async function resolveLaborRate(supabase: any, companyId: string, riskClassCode: string | null) {
  const { data: profile } = await supabase.from('estimating_labor_profiles').select('*').eq('company_id', companyId).eq('active', true).eq('is_default', true).maybeSingle();
  if (!profile || Number(profile.burdened_hourly_rate || 0) <= 0) return null;

  let rate = Number(profile.burdened_hourly_rate || 0);
  let source = `${profile.name} · ${profile.source_label || profile.source_type}`;
  const selected = riskClassCode || profile.base_risk_class_code || null;
  if (selected && profile.base_risk_class_code && selected !== profile.base_risk_class_code) {
    const [{ data: baseRisk }, { data: selectedRisk }] = await Promise.all([
      supabase.from('li_risk_classes').select('employer_rate_per_hour').eq('company_id', companyId).eq('code', profile.base_risk_class_code).eq('active', true).order('tax_year', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('li_risk_classes').select('employer_rate_per_hour').eq('company_id', companyId).eq('code', selected).eq('active', true).order('tax_year', { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (baseRisk && selectedRisk) {
      rate += Number(selectedRisk.employer_rate_per_hour || 0) - Number(baseRisk.employer_rate_per_hour || 0);
      source += ` · L&I adjusted ${profile.base_risk_class_code} → ${selected}`;
    }
  }
  return { rate: moneyRound(rate), source, profileId: profile.id };
}

async function resolveCurrentUnitCost(supabase: any, companyId: string, component: any, outputUnit: string) {
  if (component.pricing_strategy === 'none') return { unitCost: 0, status: 'not_priced', source: 'not priced by assembly' };
  if (component.pricing_strategy === 'manual') return null;
  if (Number(component.default_unit_cost || 0) > 0) return { unitCost: Number(component.default_unit_cost), status: 'priced', source: 'assembly version default' };
  if (!component.catalog_item_id) return null;

  const { data: catalog } = await supabase.from('cost_catalog_items').select('default_unit,default_unit_cost,name').eq('id', component.catalog_item_id).eq('company_id', companyId).maybeSingle();
  if (!catalog || String(catalog.default_unit || '').toUpperCase() !== outputUnit.toUpperCase()) return null;

  const { data: bill } = await supabase.from('vendor_bill_lines').select('unit,unit_cost,created_at').eq('company_id', companyId).eq('catalog_item_id', component.catalog_item_id).gt('unit_cost', 0).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (bill && String(bill.unit || '').toUpperCase() === outputUnit.toUpperCase()) return { unitCost: Number(bill.unit_cost), status: 'priced', source: `latest vendor bill · ${String(bill.created_at).slice(0, 10)}` };

  const { data: po } = await supabase.from('purchase_order_lines').select('unit,unit_cost,created_at').eq('company_id', companyId).eq('catalog_item_id', component.catalog_item_id).gt('unit_cost', 0).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (po && String(po.unit || '').toUpperCase() === outputUnit.toUpperCase()) return { unitCost: Number(po.unit_cost), status: 'priced', source: `latest purchase order · ${String(po.created_at).slice(0, 10)}` };

  if (Number(catalog.default_unit_cost || 0) > 0) return { unitCost: Number(catalog.default_unit_cost), status: 'priced', source: `cost catalog · ${catalog.name}` };
  return null;
}

export async function createTakeoffSet(fd: FormData) {
  const estimateId = String(fd.get('estimate_id') || '');
  const name = String(fd.get('name') || '').trim();
  if (!estimateId || !name) return;
  const { supabase, user, companyId } = await ctx();
  await assertEstimateEditable(supabase, companyId, estimateId);
  const { error } = await supabase.from('takeoff_sets').insert({
    company_id: companyId,
    estimate_id: estimateId,
    name,
    revision_label: String(fd.get('revision_label') || 'Current').trim() || 'Current',
    source_filename: String(fd.get('source_filename') || '').trim() || null,
    notes: String(fd.get('notes') || '').trim() || null,
    created_by: user.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/takeoff');
  revalidatePath('/estimates');
}

export async function createAssemblyMeasurement(fd: FormData) {
  const takeoffSetId = String(fd.get('takeoff_set_id') || '');
  const assemblyVersionId = String(fd.get('assembly_version_id') || '');
  const sectionId = String(fd.get('estimate_section_id') || '') || null;
  const name = String(fd.get('name') || '').trim();
  const rawQuantity = num(fd.get('raw_quantity'));
  if (!takeoffSetId || !assemblyVersionId || !name || !Number.isFinite(rawQuantity) || rawQuantity <= 0) throw new Error('Name and measured quantity are required.');

  const { supabase, companyId } = await ctx();
  const [{ data: set }, { data: version }, { data: variables }, { data: components }] = await Promise.all([
    supabase.from('takeoff_sets').select('id,estimate_id,status').eq('id', takeoffSetId).eq('company_id', companyId).maybeSingle(),
    supabase.from('concrete_assembly_versions').select('id,assembly_id,status,default_risk_class_code,source_label,source_reference,concrete_assemblies(code,name,primary_measurement)').eq('id', assemblyVersionId).eq('company_id', companyId).maybeSingle(),
    supabase.from('concrete_assembly_variables').select('*').eq('assembly_version_id', assemblyVersionId).eq('company_id', companyId).order('sort_order'),
    supabase.from('concrete_assembly_components').select('*').eq('assembly_version_id', assemblyVersionId).eq('company_id', companyId).order('sort_order'),
  ]);
  if (!set || set.status !== 'active') throw new Error('Active takeoff set not found.');
  await assertEstimateEditable(supabase, companyId, set.estimate_id);
  if (!version || version.status !== 'published') throw new Error('Published assembly version not found.');
  if (!components?.length) throw new Error('This assembly has no components.');

  const assembly: any = Array.isArray((version as any).concrete_assemblies) ? (version as any).concrete_assemblies[0] : (version as any).concrete_assemblies;
  const values: Record<string, number> = { quantity: rawQuantity };
  for (const variable of variables || []) {
    if (variable.value_type !== 'number') continue;
    const input = String(fd.get(`var_${variable.variable_key}`) ?? '').trim();
    const fallback = variable.default_value === null || variable.default_value === undefined ? '' : String(variable.default_value);
    const raw = input !== '' ? input : fallback;
    if (raw === '' && variable.required) throw new Error(`${variable.label} is required.`);
    const value = raw === '' ? 0 : Number(raw);
    if (!Number.isFinite(value)) throw new Error(`${variable.label} must be a number.`);
    if (variable.min_value !== null && value < Number(variable.min_value)) throw new Error(`${variable.label} must be at least ${variable.min_value}.`);
    if (variable.max_value !== null && value > Number(variable.max_value)) throw new Error(`${variable.label} must be no more than ${variable.max_value}.`);
    values[variable.variable_key] = value;
  }

  const riskClassCode = String(fd.get('risk_class_code') || version.default_risk_class_code || '').trim() || null;
  const laborRate = await resolveLaborRate(supabase, companyId, riskClassCode);
  const prepared: any[] = [];
  for (const component of components) {
    const productionQuantity = Math.max(0, roundTakeoff(evaluateTakeoffFormula(component.quantity_formula, values), 4));
    const baseline = component.estimate_item_type === 'labor' && component.labor_rate_formula
      ? Math.max(0, roundTakeoff(evaluateTakeoffFormula(component.labor_rate_formula, values), 6))
      : null;
    const estimatedHours = component.estimate_item_type === 'labor' ? roundTakeoff(productionQuantity * Number(baseline || 0), 4) : 0;

    let unitCost = 0;
    let directCost = 0;
    let pricingStatus = productionQuantity === 0 ? 'not_priced' : 'missing_price';
    let costSource: string | null = null;
    if (component.estimate_item_type === 'labor') {
      if (laborRate) {
        unitCost = laborRate.rate;
        directCost = moneyRound(estimatedHours * unitCost);
        pricingStatus = 'priced';
        costSource = laborRate.source;
      } else {
        pricingStatus = estimatedHours === 0 ? 'not_priced' : 'missing_labor_rate';
      }
    } else if (productionQuantity > 0) {
      const price = await resolveCurrentUnitCost(supabase, companyId, component, component.output_unit);
      if (price) {
        unitCost = Number(price.unitCost || 0);
        directCost = moneyRound(productionQuantity * unitCost);
        pricingStatus = price.status;
        costSource = price.source;
      }
    }

    prepared.push({
      assembly_component_id: component.id,
      component_key: component.component_key,
      label: component.label,
      estimate_item_type: component.estimate_item_type,
      cost_code_id: component.cost_code_id || '',
      catalog_item_id: component.catalog_item_id || '',
      production_task_id: component.production_task_id || '',
      production_quantity: productionQuantity,
      production_unit: component.output_unit,
      estimated_man_hours: estimatedHours,
      baseline_man_hours_per_unit: baseline ?? '',
      baseline_source: component.baseline_source || '',
      unit_cost: unitCost,
      cost_source: costSource || '',
      direct_cost: directCost,
      pricing_status: pricingStatus,
      labor_task: component.labor_task || '',
      formula_trace: {
        quantity: formulaTrace(component.quantity_formula, values, productionQuantity),
        labor_rate: component.labor_rate_formula && baseline !== null ? formulaTrace(component.labor_rate_formula, values, baseline) : null,
        assembly: { code: assembly?.code, name: assembly?.name, source: version.source_label, reference: version.source_reference },
      },
    });
  }

  const primaryUnit = String(assembly?.primary_measurement || 'LF');
  const measurementType = primaryUnit === 'SF' ? 'area' : primaryUnit === 'EA' ? 'count' : primaryUnit === 'CY' ? 'volume' : 'linear';
  const { error } = await supabase.rpc('carez_commit_takeoff_measurement', {
    p_takeoff_set_id: takeoffSetId,
    p_estimate_section_id: sectionId,
    p_assembly_version_id: assemblyVersionId,
    p_name: name,
    p_location: String(fd.get('location') || '').trim(),
    p_drawing_reference: String(fd.get('drawing_reference') || '').trim(),
    p_measurement_type: measurementType,
    p_raw_quantity: rawQuantity,
    p_raw_unit: primaryUnit,
    p_variables: values,
    p_risk_class_code: riskClassCode || '',
    p_outputs: prepared,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/takeoff');
  revalidatePath('/estimates');
}

export async function updateTakeoffOutputPrice(fd: FormData) {
  const outputId = String(fd.get('output_id') || '');
  const unitCost = num(fd.get('unit_cost'));
  if (!outputId || !Number.isFinite(unitCost) || unitCost < 0) throw new Error('Enter a valid unit cost.');
  const { supabase } = await ctx();
  const { error } = await supabase.rpc('carez_update_takeoff_output_price', { p_output_id: outputId, p_unit_cost: unitCost });
  if (error) throw new Error(error.message);
  revalidatePath('/takeoff');
  revalidatePath('/estimates');
}

export async function deleteTakeoffMeasurement(fd: FormData) {
  const measurementId = String(fd.get('measurement_id') || '');
  if (!measurementId) return;
  const { supabase } = await ctx();
  const { error } = await supabase.rpc('carez_delete_takeoff_measurement', { p_measurement_id: measurementId });
  if (error) throw new Error(error.message);
  revalidatePath('/takeoff');
  revalidatePath('/estimates');
}

export async function updateEstimatingLaborProfile(fd: FormData) {
  const rate = num(fd.get('burdened_hourly_rate'));
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('Enter a valid burdened labor rate.');
  const { supabase, user, companyId } = await ctx();
  const baseRisk = String(fd.get('base_risk_class_code') || '').trim() || null;
  const { data: current } = await supabase.from('estimating_labor_profiles').select('id').eq('company_id', companyId).eq('active', true).eq('is_default', true).maybeSingle();
  if (current) {
    const { error } = await supabase.from('estimating_labor_profiles').update({
      burdened_hourly_rate: rate,
      base_risk_class_code: baseRisk,
      source_type: 'manual',
      source_label: 'Owner-reviewed estimating labor profile',
      effective_date: new Date().toISOString().slice(0, 10),
      notes: String(fd.get('notes') || '').trim() || 'Owner-adjusted from the historical payroll starting point.',
    }).eq('id', current.id).eq('company_id', companyId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('estimating_labor_profiles').insert({
      company_id: companyId,
      name: 'Carez Estimating Labor',
      burdened_hourly_rate: rate,
      base_risk_class_code: baseRisk,
      source_type: 'manual',
      source_label: 'Owner-reviewed estimating labor profile',
      is_default: true,
      active: true,
      created_by: user.id,
    });
    if (error) throw new Error(error.message);
  }
  revalidatePath('/takeoff');
  revalidatePath('/estimates');
}
