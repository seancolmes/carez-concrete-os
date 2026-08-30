import 'server-only';
import { evaluateTakeoffFormula, formulaTrace, roundTakeoff, takeoffFormulaVariables } from '@/lib/takeoff/formula';
import {
  buildTakeoffPropertyContext,
  resolveAssemblyPropertyValues,
  type AssemblyPropertyValue,
  type MissingAssemblyProperty,
} from '@/lib/takeoff/assemblyContext';

const moneyRound = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type AssemblyInputValues = Record<string, AssemblyPropertyValue>;
type MissingAssemblyInput = MissingAssemblyProperty;
export type AssemblyExternalContext = {
  project?: Record<string, AssemblyPropertyValue>;
  planFacts?: Record<string, AssemblyPropertyValue>;
};

const uniqueMissingInputs = (inputs: MissingAssemblyInput[]) => {
  const seen = new Set<string>();
  return inputs.filter(input => {
    const key = `${input.key}|${input.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
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
  context: externalContext = {},
}: {
  supabase: any;
  companyId: string;
  assemblyVersionId: string;
  rawQuantity: number;
  inputs: AssemblyInputValues;
  riskClassCode?: string | null;
  context?: AssemblyExternalContext;
}) {
  if (!Number.isFinite(rawQuantity) || rawQuantity <= 0) throw new Error('Measured quantity must be greater than zero.');

  type LoadedVersion = {
    version: any;
    assembly: { code: string; name: string; category: string; primary_measurement: string; description: string | null };
    variables: any[];
    components: any[];
    bindings: any[];
    children: any[];
  };

  const versionCache = new Map<string, Promise<LoadedVersion>>();
  const loadVersion = (versionId: string) => {
    const cached = versionCache.get(versionId);
    if (cached) return cached;
    const pending = (async () => {
      const [versionResult, variablesResult, componentsResult, bindingsResult, childrenResult] = await Promise.all([
        supabase.from('concrete_assembly_versions')
          .select('id,assembly_id,status,default_risk_class_code,source_label,source_reference,assembly_code_snapshot,assembly_name_snapshot,category_snapshot,primary_measurement_snapshot,description_snapshot')
          .eq('id', versionId).eq('company_id', companyId).maybeSingle(),
        supabase.from('concrete_assembly_variables').select('*').eq('assembly_version_id', versionId).eq('company_id', companyId).order('sort_order'),
        supabase.from('concrete_assembly_components').select('*').eq('assembly_version_id', versionId).eq('company_id', companyId).order('sort_order'),
        supabase.from('concrete_assembly_property_bindings').select('*').eq('assembly_version_id', versionId).eq('company_id', companyId).order('precedence', { ascending: false }).order('sort_order'),
        supabase.from('concrete_assembly_children').select('*').eq('assembly_version_id', versionId).eq('company_id', companyId).order('sort_order'),
      ]);
      const version = versionResult.data;
      if (!version || version.status !== 'published') throw new Error('Published assembly version not found.');
      return {
        version,
        assembly: {
          code: String(version.assembly_code_snapshot || ''),
          name: String(version.assembly_name_snapshot || ''),
          category: String(version.category_snapshot || ''),
          primary_measurement: String(version.primary_measurement_snapshot || ''),
          description: version.description_snapshot || null,
        },
        variables: variablesResult.data || [],
        components: componentsResult.data || [],
        bindings: bindingsResult.data || [],
        children: childrenResult.data || [],
      };
    })();
    versionCache.set(versionId, pending);
    return pending;
  };

  const rootLoaded = await loadVersion(assemblyVersionId);
  const laborRateCache = new Map<string, Promise<any>>();
  const getLaborRate = (riskCode: string | null) => {
    const key = riskCode || '';
    const cached = laborRateCache.get(key);
    if (cached) return cached;
    const pending = resolveTakeoffLaborRate(supabase, companyId, riskCode);
    laborRateCache.set(key, pending);
    return pending;
  };

  const prepared: any[] = [];
  let rootValues: Record<string, number | string | boolean> = {};
  let rootMissing: MissingAssemblyInput[] = [];
  let rootRiskClassCode: string | null = null;

  const prepareNode = async ({
    versionId,
    nodeQuantity,
    nodeInputs,
    parentProperties,
    path,
    inheritedMissing,
    depth,
    isRoot,
  }: {
    versionId: string;
    nodeQuantity: number;
    nodeInputs: AssemblyInputValues;
    parentProperties: Record<string, AssemblyPropertyValue>;
    path: string[];
    inheritedMissing: MissingAssemblyInput[];
    depth: number;
    isRoot: boolean;
  }) => {
    if (depth > 16) throw new Error('Assembly child nesting exceeds the supported depth.');
    const loaded = await loadVersion(versionId);

    const takeoffContext = buildTakeoffPropertyContext(nodeQuantity, loaded.assembly.primary_measurement, nodeInputs);
    const resolution = resolveAssemblyPropertyValues({
      variables: loaded.variables,
      bindings: loaded.bindings,
      explicitInputs: nodeInputs,
      context: {
        takeoff: takeoffContext,
        project: externalContext.project,
        parent: parentProperties,
        planFact: externalContext.planFacts,
      },
    });
    const storedValues: Record<string, number | string | boolean> = { ...resolution.storedValues, quantity: nodeQuantity };
    const formulaValues: Record<string, number> = { ...resolution.formulaValues, quantity: nodeQuantity };
    const missingByKey = new Map<string, MissingAssemblyInput>();
    for (const input of resolution.missingRequired) {
      missingByKey.set(input.key, input);
      missingByKey.set(`Properties.${input.key}`, input);
    }

    if (isRoot) {
      rootValues = storedValues;
      rootMissing = resolution.missingRequired;
    }

    const missingForFormula = (formula: any): MissingAssemblyInput[] => {
      if (!formula) return [];
      return uniqueMissingInputs(takeoffFormulaVariables(formula)
        .filter(key => !(key in formulaValues))
        .map(key => missingByKey.get(key) || { key, label: key, unit: null }));
    };
    const holdTrace = (formula: any, missingInputs: MissingAssemblyInput[]) => ({
      formula,
      inputs: formulaValues,
      result: null,
      status: 'missing_input',
      missing_inputs: missingInputs,
    });

    const requested = String(requestedRiskClassCode || '').trim() || null;
    const nodeRiskClassCode = requested || String(loaded.version.default_risk_class_code || '').trim() || null;
    if (isRoot) rootRiskClassCode = nodeRiskClassCode;
    const laborRate = await getLaborRate(nodeRiskClassCode);

    for (const component of loaded.components) {
      const quantityMissing = uniqueMissingInputs([...inheritedMissing, ...missingForFormula(component.quantity_formula)]);
      const laborMissing = component.estimate_item_type === 'labor' && component.labor_rate_formula
        ? uniqueMissingInputs([...inheritedMissing, ...missingForFormula(component.labor_rate_formula)])
        : inheritedMissing;
      const componentMissing = uniqueMissingInputs([...quantityMissing, ...laborMissing]);
      const productionQuantity = quantityMissing.length
        ? 0
        : Math.max(0, roundTakeoff(evaluateTakeoffFormula(component.quantity_formula, formulaValues), 4));
      const baseline = component.estimate_item_type === 'labor' && component.labor_rate_formula && !quantityMissing.length && !laborMissing.length
        ? Math.max(0, roundTakeoff(evaluateTakeoffFormula(component.labor_rate_formula, formulaValues), 6))
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

      const componentPath = [...path, component.component_key].join('/');
      prepared.push({
        assembly_component_id: component.id,
        component_key: componentPath,
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
          quantity: quantityMissing.length ? holdTrace(component.quantity_formula, quantityMissing) : formulaTrace(component.quantity_formula, formulaValues, productionQuantity),
          labor_rate: component.labor_rate_formula
            ? laborMissing.length || quantityMissing.length
              ? holdTrace(component.labor_rate_formula, uniqueMissingInputs([...quantityMissing, ...laborMissing]))
              : baseline !== null ? formulaTrace(component.labor_rate_formula, formulaValues, baseline) : null
            : null,
          missing_inputs: componentMissing,
          property_sources: resolution.sources,
          assembly: {
            version_id: loaded.version.id,
            code: loaded.assembly.code,
            name: loaded.assembly.name,
            source: loaded.version.source_label,
            reference: loaded.version.source_reference,
            path: path.join('/'),
          },
        },
      });
    }

    for (const child of loaded.children) {
      const quantityMissing = uniqueMissingInputs([...inheritedMissing, ...missingForFormula(child.quantity_formula)]);
      const childQuantity = quantityMissing.length
        ? 0
        : Math.max(0, roundTakeoff(evaluateTakeoffFormula(child.quantity_formula, formulaValues), 6));
      const childInputs: AssemblyInputValues = {};
      const bindingMissing: MissingAssemblyInput[] = [];
      for (const [key, formula] of Object.entries((child.variable_bindings as Record<string, any>) || {})) {
        const missing = missingForFormula(formula);
        if (missing.length) {
          bindingMissing.push(...missing.map(item => ({ ...item, key: `${child.child_key}.${key}:${item.key}` })));
          continue;
        }
        childInputs[key] = roundTakeoff(evaluateTakeoffFormula(formula as any, formulaValues), 6);
      }
      await prepareNode({
        versionId: child.child_assembly_version_id,
        nodeQuantity: childQuantity,
        nodeInputs: childInputs,
        parentProperties: resolution.storedValues,
        path: [...path, child.child_key],
        inheritedMissing: uniqueMissingInputs([...quantityMissing, ...bindingMissing]),
        depth: depth + 1,
        isRoot: false,
      });
    }
  };

  await prepareNode({
    versionId: assemblyVersionId,
    nodeQuantity: rawQuantity,
    nodeInputs: inputs,
    parentProperties: {},
    path: [],
    inheritedMissing: [],
    depth: 0,
    isRoot: true,
  });

  if (!prepared.length) throw new Error('This assembly has no output components.');
  return {
    version: rootLoaded.version,
    assembly: rootLoaded.assembly,
    variables: rootLoaded.variables,
    components: rootLoaded.components,
    values: rootValues,
    missingRequired: rootMissing,
    riskClassCode: rootRiskClassCode,
    prepared,
  };
}
