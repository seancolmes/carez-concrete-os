import 'server-only';
import { evaluateTakeoffFormula, formulaTrace, roundTakeoff, takeoffFormulaVariables } from '@/lib/takeoff/formula';

const moneyRound = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type AssemblyInputValues = Record<string, number | string | null | undefined>;
type MissingAssemblyInput = { key: string; label: string; unit: string | null };

const uniqueMissingInputs = (inputs: MissingAssemblyInput[]) => {
  const seen = new Set<string>();
  return inputs.filter(input => {
    if (seen.has(input.key)) return false;
    seen.add(input.key);
    return true;
  });
};

export async function resolveTakeoffLaborRate(supabase: any, companyId: string, riskClassCode: string | null) {
  const { data: profile } = await supabase
    .from('estimating_labor_profiles')
    .select('*')
    .eq('company_id', companyId)
    .eq('active', true)
    .eq('is_default', true)
    .maybeSingle();
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

export async function resolveTakeoffCurrentUnitCost(supabase: any, companyId: string, component: any, outputUnit: string) {
  if (component.pricing_strategy === 'none') return { unitCost: 0, status: 'not_priced', source: 'not priced by assembly' };
  if (component.pricing_strategy === 'manual') return null;
  if (Number(component.default_unit_cost || 0) > 0) return { unitCost: Number(component.default_unit_cost), status: 'priced', source: 'assembly version default' };
  if (!component.catalog_item_id) return null;

  const { data: catalog } = await supabase.from('cost_catalog_items').select('default_unit,default_unit_cost,name').eq('id', component.catalog_item_id).eq('company_id', companyId).maybeSingle();
  if (!catalog || String(catalog.default_unit || '').toUpperCase() !== outputUnit.toUpperCase()) return null;

  const { data: bill } = await supabase.from('vendor_bill_lines').select('unit,unit_cost,created_at').eq('company_id', companyId).eq('catalog_item_id', component.catalog_item_id).gt('unit_cost', 0).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (bill && String(bill.unit || '').toUpperCase() === outputUnit.toUpperCase()) {
    return { unitCost: Number(bill.unit_cost), status: 'priced', source: `latest vendor bill · ${String(bill.created_at).slice(0, 10)}` };
  }

  const { data: po } = await supabase.from('purchase_order_lines').select('unit,unit_cost,created_at').eq('company_id', companyId).eq('catalog_item_id', component.catalog_item_id).gt('unit_cost', 0).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (po && String(po.unit || '').toUpperCase() === outputUnit.toUpperCase()) {
    return { unitCost: Number(po.unit_cost), status: 'priced', source: `latest purchase order · ${String(po.created_at).slice(0, 10)}` };
  }

  if (Number(catalog.default_unit_cost || 0) > 0) return { unitCost: Number(catalog.default_unit_cost), status: 'priced', source: `cost catalog · ${catalog.name}` };
  return null;
}

export async function prepareAssemblyOutputs({
  supabase,
  companyId,
  assemblyVersionId,
  rawQuantity,
  inputs,
  riskClassCode: requestedRiskClassCode,
}: {
  supabase: any;
  companyId: string;
  assemblyVersionId: string;
  rawQuantity: number;
  inputs: AssemblyInputValues;
  riskClassCode?: string | null;
}) {
  if (!Number.isFinite(rawQuantity) || rawQuantity <= 0) throw new Error('Measured quantity must be greater than zero.');

  const [{ data: version }, { data: variables }, { data: components }] = await Promise.all([
    supabase.from('concrete_assembly_versions').select('id,assembly_id,status,default_risk_class_code,source_label,source_reference,concrete_assemblies(code,name,primary_measurement)').eq('id', assemblyVersionId).eq('company_id', companyId).maybeSingle(),
    supabase.from('concrete_assembly_variables').select('*').eq('assembly_version_id', assemblyVersionId).eq('company_id', companyId).order('sort_order'),
    supabase.from('concrete_assembly_components').select('*').eq('assembly_version_id', assemblyVersionId).eq('company_id', companyId).order('sort_order'),
  ]);
  if (!version || version.status !== 'published') throw new Error('Published assembly version not found.');
  if (!components?.length) throw new Error('This assembly has no components.');

  const assembly: any = Array.isArray((version as any).concrete_assemblies) ? (version as any).concrete_assemblies[0] : (version as any).concrete_assemblies;
  const values: Record<string, number> = { quantity: rawQuantity };
  const missingRequired = new Map<string, MissingAssemblyInput>();
  for (const variable of variables || []) {
    if (variable.value_type !== 'number') continue;
    const requested = inputs[variable.variable_key];
    const supplied = requested !== null && requested !== undefined && String(requested).trim() !== '' ? Number(requested) : NaN;
    const hasDefault = variable.default_value !== null && variable.default_value !== undefined && String(variable.default_value).trim() !== '';
    const value = Number.isFinite(supplied) ? supplied : hasDefault ? Number(variable.default_value) : NaN;
    if (!Number.isFinite(value)) {
      if (variable.required) {
        missingRequired.set(variable.variable_key, { key: variable.variable_key, label: variable.label, unit: variable.unit || null });
        continue;
      }
      values[variable.variable_key] = 0;
      continue;
    }
    if (variable.min_value !== null && value < Number(variable.min_value)) throw new Error(`${variable.label} must be at least ${variable.min_value}.`);
    if (variable.max_value !== null && value > Number(variable.max_value)) throw new Error(`${variable.label} must be no more than ${variable.max_value}.`);
    values[variable.variable_key] = value;
  }

  const missingForFormula = (formula: any): MissingAssemblyInput[] => {
    if (!formula) return [];
    return takeoffFormulaVariables(formula)
      .map(key => missingRequired.get(key))
      .filter((input): input is MissingAssemblyInput => Boolean(input));
  };
  const holdTrace = (formula: any, missingInputs: MissingAssemblyInput[]) => ({
    formula,
    inputs: values,
    result: null,
    status: 'missing_input',
    missing_inputs: missingInputs,
  });

  const riskClassCode = String(requestedRiskClassCode || version.default_risk_class_code || '').trim() || null;
  const laborRate = await resolveTakeoffLaborRate(supabase, companyId, riskClassCode);
  const prepared: any[] = [];
  for (const component of components) {
    const quantityMissing = missingForFormula(component.quantity_formula);
    const laborMissing = component.estimate_item_type === 'labor' && component.labor_rate_formula
      ? missingForFormula(component.labor_rate_formula)
      : [];
    const componentMissing = uniqueMissingInputs([...quantityMissing, ...laborMissing]);

    const productionQuantity = quantityMissing.length
      ? 0
      : Math.max(0, roundTakeoff(evaluateTakeoffFormula(component.quantity_formula, values), 4));
    const baseline = component.estimate_item_type === 'labor' && component.labor_rate_formula && !quantityMissing.length && !laborMissing.length
      ? Math.max(0, roundTakeoff(evaluateTakeoffFormula(component.labor_rate_formula, values), 6))
      : null;
    const estimatedHours = component.estimate_item_type === 'labor' && !componentMissing.length
      ? roundTakeoff(productionQuantity * Number(baseline || 0), 4)
      : 0;

    let unitCost = 0;
    let directCost = 0;
    let pricingStatus = componentMissing.length ? 'missing_input' : productionQuantity === 0 ? 'not_priced' : 'missing_price';
    let costSource: string | null = componentMissing.length ? `input required · ${componentMissing.map(input => input.label).join(', ')}` : null;
    if (!componentMissing.length && component.estimate_item_type === 'labor') {
      if (laborRate) {
        unitCost = laborRate.rate;
        directCost = moneyRound(estimatedHours * unitCost);
        pricingStatus = 'priced';
        costSource = laborRate.source;
      } else {
        pricingStatus = estimatedHours === 0 ? 'not_priced' : 'missing_labor_rate';
      }
    } else if (!componentMissing.length && productionQuantity > 0) {
      const price = await resolveTakeoffCurrentUnitCost(supabase, companyId, component, component.output_unit);
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
        quantity: quantityMissing.length ? holdTrace(component.quantity_formula, quantityMissing) : formulaTrace(component.quantity_formula, values, productionQuantity),
        labor_rate: component.labor_rate_formula
          ? laborMissing.length || quantityMissing.length
            ? holdTrace(component.labor_rate_formula, uniqueMissingInputs([...quantityMissing, ...laborMissing]))
            : baseline !== null ? formulaTrace(component.labor_rate_formula, values, baseline) : null
          : null,
        missing_inputs: componentMissing,
        assembly: { code: assembly?.code, name: assembly?.name, source: version.source_label, reference: version.source_reference },
      },
    });
  }

  return { version, assembly, variables: variables || [], components, values, missingRequired: [...missingRequired.values()], riskClassCode, prepared };
}
