export type AssemblyPropertyValue = number | string | boolean | null | undefined;

export type AssemblyPropertyVariable = {
  id: string;
  variable_key: string;
  label: string;
  value_type: 'number' | 'dimension' | 'percentage' | 'boolean' | 'enum' | 'text' | string;
  unit?: string | null;
  default_value?: unknown;
  options?: unknown;
  min_value?: number | string | null;
  max_value?: number | string | null;
  required?: boolean;
  allow_override?: boolean;
};

export type AssemblyPropertyBinding = {
  variable_id: string;
  source_namespace: 'takeoff' | 'project' | 'parent' | 'plan_fact' | 'property' | string;
  source_key: string;
  precedence?: number | string | null;
  sort_order?: number | string | null;
};

export type AssemblyResolutionContext = {
  takeoff?: Record<string, AssemblyPropertyValue>;
  project?: Record<string, AssemblyPropertyValue>;
  parent?: Record<string, AssemblyPropertyValue>;
  planFact?: Record<string, AssemblyPropertyValue>;
};

export type MissingAssemblyProperty = { key: string; label: string; unit: string | null };

const supplied = (value: AssemblyPropertyValue) => value !== null && value !== undefined && !(typeof value === 'string' && value.trim() === '');

const namespacePrefix: Record<string, string> = {
  takeoff: 'Takeoff',
  project: 'Project',
  parent: 'Parent',
  plan_fact: 'PlanFact',
};

const contextRecord = (namespace: string, context: AssemblyResolutionContext) => {
  if (namespace === 'takeoff') return context.takeoff;
  if (namespace === 'project') return context.project;
  if (namespace === 'parent') return context.parent;
  if (namespace === 'plan_fact') return context.planFact;
  return undefined;
};

const lookupContextValue = (namespace: string, key: string, context: AssemblyResolutionContext) => {
  const record = contextRecord(namespace, context);
  if (!record) return undefined;
  if (key in record) return record[key];
  const prefix = namespacePrefix[namespace];
  const stripped = prefix && key.startsWith(`${prefix}.`) ? key.slice(prefix.length + 1) : key;
  return stripped in record ? record[stripped] : undefined;
};

const coercePropertyValue = (variable: AssemblyPropertyVariable, raw: AssemblyPropertyValue): AssemblyPropertyValue => {
  if (!supplied(raw)) return undefined;
  if (['number', 'dimension', 'percentage'].includes(variable.value_type)) {
    const value = Number(raw);
    if (!Number.isFinite(value)) throw new Error(`${variable.label} is not a valid number.`);
    if (variable.min_value !== null && variable.min_value !== undefined && value < Number(variable.min_value)) {
      throw new Error(`${variable.label} must be at least ${variable.min_value}.`);
    }
    if (variable.max_value !== null && variable.max_value !== undefined && value > Number(variable.max_value)) {
      throw new Error(`${variable.label} must be no more than ${variable.max_value}.`);
    }
    return value;
  }
  if (variable.value_type === 'boolean') {
    if (typeof raw === 'boolean') return raw;
    const normalized = String(raw).trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
    throw new Error(`${variable.label} must be true or false.`);
  }
  const value = String(raw);
  if (variable.value_type === 'enum') {
    const options = Array.isArray(variable.options) ? variable.options.map(String) : [];
    if (!options.includes(value)) throw new Error(`${variable.label} has an invalid selection.`);
  }
  return value;
};

const addNumericNamespace = (formulaValues: Record<string, number>, prefix: string, values?: Record<string, AssemblyPropertyValue>) => {
  for (const [key, raw] of Object.entries(values || {})) {
    const value = Number(raw);
    if (supplied(raw) && Number.isFinite(value)) formulaValues[`${prefix}.${key}`] = value;
  }
};

export function buildTakeoffPropertyContext(
  rawQuantity: number,
  primaryUnit: string,
  inputs: Record<string, AssemblyPropertyValue> = {},
) {
  const context: Record<string, AssemblyPropertyValue> = { Quantity: rawQuantity };
  if (primaryUnit === 'LF') context.Length = rawQuantity;
  if (primaryUnit === 'SF') context.Area = rawQuantity;
  if (primaryUnit === 'EA') context.Count = rawQuantity;
  if (primaryUnit === 'CY') context.Volume = rawQuantity;

  const perimeter = inputs.perimeter_lf ?? inputs.Perimeter ?? inputs['Takeoff.Perimeter'];
  if (supplied(perimeter) && Number.isFinite(Number(perimeter))) context.Perimeter = Number(perimeter);
  return context;
}

export function resolveAssemblyPropertyValues({
  variables,
  bindings,
  explicitInputs,
  context,
}: {
  variables: AssemblyPropertyVariable[];
  bindings: AssemblyPropertyBinding[];
  explicitInputs: Record<string, AssemblyPropertyValue>;
  context: AssemblyResolutionContext;
}) {
  const byKey = new Map(variables.map(variable => [variable.variable_key, variable]));
  const bindingsByVariable = new Map<string, AssemblyPropertyBinding[]>();
  for (const binding of bindings) {
    const rows = bindingsByVariable.get(binding.variable_id) || [];
    rows.push(binding);
    bindingsByVariable.set(binding.variable_id, rows);
  }
  for (const rows of bindingsByVariable.values()) {
    rows.sort((a, b) => Number(b.precedence || 0) - Number(a.precedence || 0) || Number(a.sort_order || 0) - Number(b.sort_order || 0));
  }

  const storedValues: Record<string, number | string | boolean> = {};
  const formulaValues: Record<string, number> = {};
  const sources: Record<string, string> = {};
  const missingRequired = new Map<string, MissingAssemblyProperty>();
  const resolving = new Set<string>();
  const resolved = new Set<string>();

  addNumericNamespace(formulaValues, 'Takeoff', context.takeoff);
  addNumericNamespace(formulaValues, 'Project', context.project);
  addNumericNamespace(formulaValues, 'Parent', context.parent);
  addNumericNamespace(formulaValues, 'PlanFact', context.planFact);
  for (const [key, raw] of Object.entries(explicitInputs || {})) {
    const value = Number(raw);
    if (supplied(raw) && Number.isFinite(value)) formulaValues[key] = value;
  }

  const resolveVariable = (variable: AssemblyPropertyVariable): AssemblyPropertyValue => {
    if (resolved.has(variable.variable_key)) return storedValues[variable.variable_key];
    if (resolving.has(variable.variable_key)) throw new Error(`Assembly property binding cycle detected at ${variable.label}.`);
    resolving.add(variable.variable_key);

    const explicit = explicitInputs[variable.variable_key];
    let boundValue: AssemblyPropertyValue;
    let boundSource: string | null = null;
    for (const binding of bindingsByVariable.get(variable.id) || []) {
      let candidate: AssemblyPropertyValue;
      if (binding.source_namespace === 'property') {
        const sourceVariable = byKey.get(binding.source_key);
        candidate = sourceVariable ? resolveVariable(sourceVariable) : undefined;
      } else {
        candidate = lookupContextValue(binding.source_namespace, binding.source_key, context);
      }
      if (supplied(candidate)) {
        boundValue = candidate;
        const prefix = namespacePrefix[binding.source_namespace] || 'Properties';
        boundSource = `${prefix}.${binding.source_key}`;
        break;
      }
    }

    let raw: AssemblyPropertyValue;
    let source: string;
    if (supplied(explicit) && (variable.allow_override !== false || !supplied(boundValue))) {
      raw = explicit;
      source = 'input';
    } else if (supplied(boundValue)) {
      raw = boundValue;
      source = boundSource || 'binding';
    } else if (supplied(explicit)) {
      raw = explicit;
      source = 'input';
    } else if (supplied(variable.default_value as AssemblyPropertyValue)) {
      raw = variable.default_value as AssemblyPropertyValue;
      source = 'default';
    } else if (variable.required) {
      missingRequired.set(variable.variable_key, { key: variable.variable_key, label: variable.label, unit: variable.unit || null });
      resolving.delete(variable.variable_key);
      resolved.add(variable.variable_key);
      return undefined;
    } else if (['number', 'dimension', 'percentage'].includes(variable.value_type)) {
      raw = 0;
      source = 'implicit_zero';
    } else {
      resolving.delete(variable.variable_key);
      resolved.add(variable.variable_key);
      return undefined;
    }

    const value = coercePropertyValue(variable, raw);
    if (value !== undefined && value !== null) {
      storedValues[variable.variable_key] = value as number | string | boolean;
      sources[variable.variable_key] = source;
      if (['number', 'dimension', 'percentage'].includes(variable.value_type)) {
        const numeric = Number(value);
        formulaValues[variable.variable_key] = numeric;
        formulaValues[`Properties.${variable.variable_key}`] = numeric;
      }
    }
    resolving.delete(variable.variable_key);
    resolved.add(variable.variable_key);
    return value;
  };

  for (const variable of variables) resolveVariable(variable);

  return {
    storedValues,
    formulaValues,
    sources,
    missingRequired: [...missingRequired.values()],
  };
}
