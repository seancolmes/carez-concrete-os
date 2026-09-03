'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { assemblyTemplateById } from '@/lib/takeoff/assemblyTemplates';
import { compileFormulaExpression } from '@/lib/takeoff/formulaExpression';

const keyPattern = /^[a-z][a-z0-9_]*$/;

async function ctx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in.');
  const { data: profile } = await supabase.from('profiles').select('company_id,role').eq('id', user.id).single();
  if (!profile?.company_id || profile.role === 'employee') throw new Error('Owner access required.');
  return { supabase, companyId: profile.company_id, userId: user.id };
}

async function editableSet(supabase: any, companyId: string, setId: string) {
  const { data: set } = await supabase.from('takeoff_sets').select('id,estimate_id,status').eq('id', setId).eq('company_id', companyId).maybeSingle();
  if (!set || set.status !== 'active') throw new Error('Active takeoff set not found.');
  const { data: estimate } = await supabase.from('estimates').select('id,status').eq('id', set.estimate_id).eq('company_id', companyId).maybeSingle();
  if (!estimate || ['accepted', 'approved', 'superseded'].includes(estimate.status)) throw new Error('This estimate revision is locked.');
  const { count } = await supabase.from('proposal_presentations').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('estimate_id', set.estimate_id);
  if ((count || 0) > 0) throw new Error('This estimate revision was already issued. Create the next revision before changing takeoff.');
  return set;
}

async function draftVersion(supabase: any, companyId: string, versionId: string) {
  const { data: version } = await supabase.from('concrete_assembly_versions')
    .select('id,assembly_id,version_no,status')
    .eq('id', versionId).eq('company_id', companyId).maybeSingle();
  if (!version || version.status !== 'draft') throw new Error('Assembly draft not found. Published versions are read-only.');
  return version;
}

const refresh = (setId: string) => {
  revalidatePath(`/takeoff/${setId}`);
  revalidatePath('/takeoff');
  revalidatePath('/takeoff/assemblies');
  revalidatePath('/estimates');
};

const normalizedKey = (value: string, label: string) => {
  const key = String(value || '').trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  if (!keyPattern.test(key)) throw new Error(`${label} must start with a letter and use only letters, numbers, and underscores.`);
  return key;
};

const jsonDefault = (value: unknown) => value === '' || value === undefined ? null : value;

export async function createAssemblyDraft(setId: string, input: {
  code: string;
  name: string;
  category: string;
  primaryMeasurement: 'LF' | 'SF' | 'EA' | 'CY';
  description?: string;
  folderId?: string | null;
}) {
  const { supabase, companyId } = await ctx();
  await editableSet(supabase, companyId, setId);
  const { data, error } = await supabase.rpc('carez_create_custom_assembly', {
    p_code: String(input.code || '').trim(),
    p_name: String(input.name || '').trim(),
    p_category: String(input.category || '').trim(),
    p_primary_measurement: input.primaryMeasurement,
    p_folder_id: input.folderId || null,
    p_description: String(input.description || '').trim() || null,
  });
  if (error) throw new Error(error.message);
  refresh(setId);
  return data as { assembly_id: string; assembly_version_id: string; version_no: number; status: string };
}

export async function createAssemblyFromTemplate(setId: string, input: {
  templateId: string;
  code?: string;
  name?: string;
  category?: string;
}) {
  const template = assemblyTemplateById(input.templateId);
  if (!template) throw new Error('Assembly template not found.');
  const { supabase, companyId, userId } = await ctx();
  await editableSet(supabase, companyId, setId);
  const { data, error } = await supabase.rpc('carez_create_custom_assembly', {
    p_code: String(input.code || template.code).trim(),
    p_name: String(input.name || template.name).trim(),
    p_category: String(input.category || template.category).trim(),
    p_primary_measurement: template.primaryMeasurement,
    p_folder_id: null,
    p_description: template.description,
  });
  if (error) throw new Error(error.message);
  const created = data as { assembly_id: string; assembly_version_id: string; version_no: number; status: string };

  const properties = template.properties.map((property, index) => ({
    company_id: companyId,
    assembly_version_id: created.assembly_version_id,
    variable_key: property.key,
    label: property.label,
    value_type: property.valueType,
    unit: property.unit || null,
    default_value: null,
    options: property.options || null,
    required: property.required !== false,
    help_text: property.helpText || null,
    sort_order: (index + 1) * 10,
    property_group: property.group || null,
    expose_in_takeoff: true,
    allow_override: true,
    input_role: property.inputRole || 'plan_fact',
    requires_verification: ['method_decision', 'production_assumption', 'commercial_assumption'].includes(property.inputRole || ''),
  }));
  if (properties.length) {
    const { error: propertyError } = await supabase.from('concrete_assembly_variables').insert(properties);
    if (propertyError) throw new Error(propertyError.message);
  }

  const components = template.components.map((component, index) => ({
    company_id: companyId,
    assembly_version_id: created.assembly_version_id,
    component_key: component.key,
    label: component.label,
    estimate_item_type: component.itemType,
    output_unit: component.outputUnit,
    quantity_formula: compileFormulaExpression(component.formula),
    labor_rate_formula: component.laborRateFormula ? compileFormulaExpression(component.laborRateFormula) : null,
    pricing_strategy: component.pricingStrategy || 'current_cost',
    activation_rule: component.activationRule || null,
    resource_behavior: component.resourceBehavior,
    estimate_visible: true,
    baseline_source: component.itemType === 'labor' ? 'Estimator/company production assumption required' : null,
    sort_order: (index + 1) * 10,
    notes: 'Created from Carez structural template. No price or production rate was promoted as company truth.',
  }));
  if (components.length) {
    const { error: componentError } = await supabase.from('concrete_assembly_components').insert(components);
    if (componentError) throw new Error(componentError.message);
  }

  await supabase.from('concrete_assembly_versions').update({
    source_type: 'manual',
    source_label: `Template · ${template.name}`,
    source_reference: `carez-template:${template.id}`,
    notes: `${template.sourceNote} Copied by ${userId}.`,
  }).eq('id', created.assembly_version_id).eq('company_id', companyId).eq('status', 'draft');

  refresh(setId);
  return created;
}

async function cloneVersionIntoNewIdentity(supabase: any, companyId: string, targetVersionId: string, sourceVersionId: string) {
  const [variablesResult, componentsResult, childrenResult, bindingsResult] = await Promise.all([
    supabase.from('concrete_assembly_variables').select('*').eq('company_id', companyId).eq('assembly_version_id', sourceVersionId).order('sort_order'),
    supabase.from('concrete_assembly_components').select('*').eq('company_id', companyId).eq('assembly_version_id', sourceVersionId).order('sort_order'),
    supabase.from('concrete_assembly_children').select('*').eq('company_id', companyId).eq('assembly_version_id', sourceVersionId).order('sort_order'),
    supabase.from('concrete_assembly_property_bindings').select('*').eq('company_id', companyId).eq('assembly_version_id', sourceVersionId).order('sort_order'),
  ]);
  const variableIdMap = new Map<string, string>();
  for (const variable of variablesResult.data || []) {
    const { id, created_at, updated_at, ...rest } = variable as any;
    const { data: inserted, error } = await supabase.from('concrete_assembly_variables').insert({ ...rest, assembly_version_id: targetVersionId }).select('id').single();
    if (error) throw new Error(error.message);
    variableIdMap.set(id, inserted.id);
  }
  if ((componentsResult.data || []).length) {
    const rows = (componentsResult.data || []).map(({ id, created_at, updated_at, ...rest }: any) => ({ ...rest, assembly_version_id: targetVersionId }));
    const { error } = await supabase.from('concrete_assembly_components').insert(rows);
    if (error) throw new Error(error.message);
  }
  if ((childrenResult.data || []).length) {
    const rows = (childrenResult.data || []).map(({ id, created_at, updated_at, ...rest }: any) => ({ ...rest, assembly_version_id: targetVersionId }));
    const { error } = await supabase.from('concrete_assembly_children').insert(rows);
    if (error) throw new Error(error.message);
  }
  for (const binding of bindingsResult.data || []) {
    const { id, created_at, updated_at, variable_id, ...rest } = binding as any;
    const mapped = variableIdMap.get(variable_id);
    if (!mapped) continue;
    const { error } = await supabase.from('concrete_assembly_property_bindings').insert({ ...rest, assembly_version_id: targetVersionId, variable_id: mapped });
    if (error) throw new Error(error.message);
  }
}

export async function duplicateAssemblyDraft(setId: string, input: { sourceVersionId: string; code: string; name: string }) {
  const { supabase, companyId } = await ctx();
  await editableSet(supabase, companyId, setId);
  const { data: source } = await supabase.from('concrete_assembly_versions')
    .select('id,assembly_id,category_snapshot,primary_measurement_snapshot,description_snapshot,concrete_assemblies!concrete_assembly_versions_assembly_id_fkey(category,primary_measurement,description)')
    .eq('id', input.sourceVersionId).eq('company_id', companyId).maybeSingle();
  if (!source) throw new Error('Source assembly version not found.');
  const assembly: any = Array.isArray((source as any).concrete_assemblies) ? (source as any).concrete_assemblies[0] : (source as any).concrete_assemblies;
  const created = await createAssemblyDraft(setId, {
    code: input.code,
    name: input.name,
    category: String(source.category_snapshot || assembly?.category || 'Concrete'),
    primaryMeasurement: String(source.primary_measurement_snapshot || assembly?.primary_measurement || 'LF') as any,
    description: String(source.description_snapshot || assembly?.description || ''),
  });
  await cloneVersionIntoNewIdentity(supabase, companyId, created.assembly_version_id, source.id);
  refresh(setId);
  return created;
}

export async function createAssemblyRevision(setId: string, versionId: string) {
  const { supabase, companyId } = await ctx();
  await editableSet(supabase, companyId, setId);
  const { data, error } = await supabase.rpc('carez_create_assembly_revision', { p_assembly_version_id: versionId });
  if (error) throw new Error(error.message);
  refresh(setId);
  return { assembly_version_id: data as string };
}

export async function updateAssemblyDraftIdentity(setId: string, input: { versionId: string; code: string; name: string; category: string; description?: string }) {
  const { supabase, companyId } = await ctx();
  await editableSet(supabase, companyId, setId);
  const version = await draftVersion(supabase, companyId, input.versionId);
  const payload = { code: String(input.code || '').trim(), name: String(input.name || '').trim(), category: String(input.category || '').trim(), description: String(input.description || '').trim() || null };
  if (!payload.code || !payload.name || !payload.category) throw new Error('Assembly code, name, and category are required.');
  const { error: assemblyError } = await supabase.from('concrete_assemblies').update(payload).eq('id', version.assembly_id).eq('company_id', companyId);
  if (assemblyError) throw new Error(assemblyError.message);
  const { error: versionError } = await supabase.from('concrete_assembly_versions').update({ assembly_code_snapshot: payload.code, assembly_name_snapshot: payload.name, category_snapshot: payload.category, description_snapshot: payload.description }).eq('id', version.id).eq('company_id', companyId).eq('status', 'draft');
  if (versionError) throw new Error(versionError.message);
  refresh(setId);
}

export async function saveAssemblyProperty(setId: string, input: {
  versionId: string;
  id?: string | null;
  key: string;
  label: string;
  valueType: 'number' | 'dimension' | 'percentage' | 'boolean' | 'enum' | 'text';
  unit?: string | null;
  defaultValue?: unknown;
  required?: boolean;
  propertyGroup?: string | null;
  inputRole?: 'legacy' | 'plan_fact' | 'method_decision' | 'production_assumption' | 'commercial_assumption' | 'derived';
  exposeInTakeoff?: boolean;
  allowOverride?: boolean;
  options?: Array<{ value: string; label: string }> | null;
  sourceNamespace?: 'takeoff' | 'project' | 'parent' | 'plan_fact' | 'property' | null;
  sourceKey?: string | null;
}) {
  const { supabase, companyId } = await ctx();
  await editableSet(supabase, companyId, setId);
  await draftVersion(supabase, companyId, input.versionId);
  const key = normalizedKey(input.key, 'Property key');
  const payload = {
    company_id: companyId,
    assembly_version_id: input.versionId,
    variable_key: key,
    label: String(input.label || '').trim(),
    value_type: input.valueType,
    unit: String(input.unit || '').trim() || null,
    default_value: jsonDefault(input.defaultValue),
    options: input.valueType === 'enum' ? input.options || [] : null,
    required: input.required !== false,
    property_group: String(input.propertyGroup || '').trim() || null,
    expose_in_takeoff: input.exposeInTakeoff !== false,
    allow_override: input.allowOverride !== false,
    input_role: input.inputRole || 'plan_fact',
    requires_verification: ['method_decision', 'production_assumption', 'commercial_assumption'].includes(input.inputRole || ''),
  };
  if (!payload.label) throw new Error('Property label is required.');
  let propertyId = input.id || null;
  if (propertyId) {
    const { error } = await supabase.from('concrete_assembly_variables').update(payload).eq('id', propertyId).eq('company_id', companyId).eq('assembly_version_id', input.versionId);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabase.from('concrete_assembly_variables').insert(payload).select('id').single();
    if (error) throw new Error(error.message);
    propertyId = data.id;
  }
  await supabase.from('concrete_assembly_property_bindings').delete().eq('company_id', companyId).eq('assembly_version_id', input.versionId).eq('variable_id', propertyId);
  if (input.sourceNamespace && input.sourceKey) {
    const { error } = await supabase.from('concrete_assembly_property_bindings').insert({
      company_id: companyId,
      assembly_version_id: input.versionId,
      variable_id: propertyId,
      source_namespace: input.sourceNamespace,
      source_key: input.sourceKey,
      precedence: 100,
      sort_order: 10,
    });
    if (error) throw new Error(error.message);
  }
  refresh(setId);
  return { id: propertyId };
}

export async function deleteAssemblyProperty(setId: string, versionId: string, propertyId: string) {
  const { supabase, companyId } = await ctx();
  await editableSet(supabase, companyId, setId);
  await draftVersion(supabase, companyId, versionId);
  const { error } = await supabase.from('concrete_assembly_variables').delete().eq('id', propertyId).eq('company_id', companyId).eq('assembly_version_id', versionId);
  if (error) throw new Error(error.message);
  refresh(setId);
}

export async function saveAssemblyComponent(setId: string, input: {
  versionId: string;
  id?: string | null;
  key: string;
  label: string;
  itemType: 'labor' | 'material' | 'equipment' | 'subcontractor' | 'other';
  resourceBehavior: 'consumed_material' | 'reusable_inventory' | 'labor' | 'owned_equipment' | 'rental' | 'subcontractor' | 'readiness_resource' | 'legacy_other';
  outputUnit: string;
  formula: string;
  laborRateFormula?: string | null;
  pricingStrategy?: 'current_cost' | 'catalog' | 'manual' | 'none';
  defaultUnitCost?: number | null;
  activationRule?: Record<string, unknown> | null;
  estimateVisible?: boolean;
  notes?: string | null;
}) {
  const { supabase, companyId } = await ctx();
  await editableSet(supabase, companyId, setId);
  await draftVersion(supabase, companyId, input.versionId);
  const payload = {
    company_id: companyId,
    assembly_version_id: input.versionId,
    component_key: normalizedKey(input.key, 'Resource key'),
    label: String(input.label || '').trim(),
    estimate_item_type: input.itemType,
    resource_behavior: input.resourceBehavior,
    output_unit: String(input.outputUnit || '').trim().toUpperCase(),
    quantity_formula: compileFormulaExpression(input.formula),
    labor_rate_formula: input.itemType === 'labor' && input.laborRateFormula ? compileFormulaExpression(input.laborRateFormula) : null,
    pricing_strategy: input.pricingStrategy || 'current_cost',
    default_unit_cost: Number.isFinite(Number(input.defaultUnitCost)) && Number(input.defaultUnitCost) > 0 ? Number(input.defaultUnitCost) : null,
    activation_rule: input.activationRule || null,
    estimate_visible: input.estimateVisible !== false,
    baseline_source: input.itemType === 'labor' ? 'Estimator/company production assumption' : null,
    notes: String(input.notes || '').trim() || null,
  };
  if (!payload.label || !payload.output_unit) throw new Error('Resource label and output unit are required.');
  if (input.id) {
    const { error } = await supabase.from('concrete_assembly_components').update(payload).eq('id', input.id).eq('company_id', companyId).eq('assembly_version_id', input.versionId);
    if (error) throw new Error(error.message);
    refresh(setId);
    return { id: input.id };
  }
  const { data, error } = await supabase.from('concrete_assembly_components').insert(payload).select('id').single();
  if (error) throw new Error(error.message);
  refresh(setId);
  return { id: data.id };
}

export async function deleteAssemblyComponent(setId: string, versionId: string, componentId: string) {
  const { supabase, companyId } = await ctx();
  await editableSet(supabase, companyId, setId);
  await draftVersion(supabase, companyId, versionId);
  const { error } = await supabase.from('concrete_assembly_components').delete().eq('id', componentId).eq('company_id', companyId).eq('assembly_version_id', versionId);
  if (error) throw new Error(error.message);
  refresh(setId);
}

export async function saveAssemblyChild(setId: string, input: {
  versionId: string;
  id?: string | null;
  childVersionId: string;
  key: string;
  label: string;
  quantityFormula: string;
  variableBindings?: Record<string, string>;
}) {
  const { supabase, companyId } = await ctx();
  await editableSet(supabase, companyId, setId);
  await draftVersion(supabase, companyId, input.versionId);
  const { data: child } = await supabase.from('concrete_assembly_versions').select('id,status').eq('id', input.childVersionId).eq('company_id', companyId).maybeSingle();
  if (!child || child.status !== 'published') throw new Error('Child assembly must be a published company assembly version.');
  const bindings: Record<string, unknown> = {};
  for (const [key, expression] of Object.entries(input.variableBindings || {})) {
    if (!String(expression || '').trim()) continue;
    bindings[key] = compileFormulaExpression(expression);
  }
  const payload = {
    company_id: companyId,
    assembly_version_id: input.versionId,
    child_assembly_version_id: input.childVersionId,
    child_key: normalizedKey(input.key, 'Child key'),
    label: String(input.label || '').trim(),
    quantity_formula: compileFormulaExpression(input.quantityFormula || 'Takeoff.Quantity'),
    variable_bindings: bindings,
  };
  if (!payload.label) throw new Error('Child assembly label is required.');
  if (input.id) {
    const { error } = await supabase.from('concrete_assembly_children').update(payload).eq('id', input.id).eq('company_id', companyId).eq('assembly_version_id', input.versionId);
    if (error) throw new Error(error.message);
    refresh(setId);
    return { id: input.id };
  }
  const { data, error } = await supabase.from('concrete_assembly_children').insert(payload).select('id').single();
  if (error) throw new Error(error.message);
  refresh(setId);
  return { id: data.id };
}

export async function deleteAssemblyChild(setId: string, versionId: string, childId: string) {
  const { supabase, companyId } = await ctx();
  await editableSet(supabase, companyId, setId);
  await draftVersion(supabase, companyId, versionId);
  const { error } = await supabase.from('concrete_assembly_children').delete().eq('id', childId).eq('company_id', companyId).eq('assembly_version_id', versionId);
  if (error) throw new Error(error.message);
  refresh(setId);
}

export async function reorderAssemblyBlock(setId: string, input: { versionId: string; kind: 'property' | 'component' | 'child'; id: string; sortOrder: number }) {
  const { supabase, companyId } = await ctx();
  await editableSet(supabase, companyId, setId);
  await draftVersion(supabase, companyId, input.versionId);
  const table = input.kind === 'property' ? 'concrete_assembly_variables' : input.kind === 'component' ? 'concrete_assembly_components' : 'concrete_assembly_children';
  const { error } = await supabase.from(table).update({ sort_order: Math.max(0, Math.round(input.sortOrder)) }).eq('id', input.id).eq('company_id', companyId).eq('assembly_version_id', input.versionId);
  if (error) throw new Error(error.message);
  refresh(setId);
}

export async function publishAssemblyDraft(setId: string, versionId: string) {
  const { supabase, companyId } = await ctx();
  await editableSet(supabase, companyId, setId);
  await draftVersion(supabase, companyId, versionId);
  const { data, error } = await supabase.rpc('carez_publish_assembly_version', { p_assembly_version_id: versionId });
  if (error) throw new Error(error.message);
  refresh(setId);
  return { assembly_version_id: data as string };
}
