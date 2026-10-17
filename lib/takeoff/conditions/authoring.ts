import type {
  ConditionInputGroup,
  ConditionInputDefinition,
  ConditionInputProvenance,
  ConditionMeasurementRoleAssignment,
  ConditionRawInputGroups,
  ConditionRoleDefinition,
  ConditionScalar,
} from './types.ts';

export type ConditionAuthoringMeasurement = {
  id: string;
  sheet_id: string | null;
  assembly_version_id: string;
  measurement_type?: string;
  geometry?: { type?: string } | null;
  raw_quantity: number | string;
  raw_unit: string;
};

export type ConditionInputDraft = Partial<
  Record<ConditionInputGroup, Record<string, ConditionScalar | ''>>
>;

export function conditionCodeFromName(name: string) {
  return String(name || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36);
}

function normalizedMeasurementType(measurement: ConditionAuthoringMeasurement) {
  if (measurement.measurement_type) return measurement.measurement_type;
  if (measurement.geometry?.type === 'polyline') return 'linear';
  if (measurement.geometry?.type === 'polygon') return 'area';
  if (measurement.geometry?.type === 'count') return 'count';
  return '';
}

export function conditionMeasurementMatchesRole(
  measurement: ConditionAuthoringMeasurement,
  role: ConditionRoleDefinition,
  compatibilityAssemblyVersionId?: string | null,
) {
  const expectedType = role.geometryType === 'count'
    ? 'count'
    : role.geometryType === 'polyline'
      ? 'linear'
      : 'area';
  if (!measurement.sheet_id
      || normalizedMeasurementType(measurement) !== expectedType
      || String(measurement.raw_unit).toUpperCase() !== role.unit) return false;
  if (role.primary && compatibilityAssemblyVersionId) {
    return measurement.assembly_version_id === compatibilityAssemblyVersionId;
  }
  return true;
}

export function prepareConditionAuthoringInputs(draft: ConditionInputDraft) {
  const inputs: ConditionRawInputGroups = {};
  const provenance: ConditionInputProvenance = {};
  for (const [group, values] of Object.entries(draft) as Array<[
    ConditionInputGroup,
    Record<string, ConditionScalar | ''>,
  ]>) {
    const clean: Record<string, ConditionScalar> = {};
    const sources: Record<string, { mode: 'project_value'; sourceLabel: string }> = {};
    for (const [key, value] of Object.entries(values || {})) {
      if (value === '' || value === null || value === undefined) continue;
      if (typeof value === 'number' && !Number.isFinite(value)) continue;
      clean[key] = value;
      sources[key] = { mode: 'project_value', sourceLabel: 'Condition Properties' };
    }
    if (Object.keys(clean).length) {
      inputs[group] = clean;
      provenance[group] = sources;
    }
  }
  return { inputs, provenance };
}

/** Check supplied values without filling absent inputs or erasing recorded zero. */
export function conditionAuthoringInputErrors(definitions: ConditionInputDefinition[], draft: ConditionInputDraft) {
  const errors: string[] = [];
  for (const input of definitions) {
    if (input.valueType !== 'number' && input.valueType !== 'integer') continue;
    const supplied = draft[input.group]?.[input.key];
    if (supplied === '' || supplied === null || supplied === undefined) continue;
    const value = Number(supplied);
    if (!Number.isFinite(value) || (input.valueType === 'integer' && !Number.isInteger(value))) {
      errors.push(`${input.label} must be a finite ${input.valueType === 'integer' ? 'whole number' : 'number'}.`);
    } else if (input.minimum !== undefined && value < input.minimum) {
      errors.push(input.minimum === 0.000001
        ? `${input.label} must be greater than zero. Leave unused inputs blank.`
        : `${input.label} must be at least ${input.minimum}${input.unit ? ` ${input.unit}` : ''}.`);
    } else if (input.maximum !== undefined && value > input.maximum) {
      errors.push(`${input.label} must be at most ${input.maximum}${input.unit ? ` ${input.unit}` : ''}.`);
    }
  }
  return errors;
}

export function prepareConditionRoleAssignments(
  roles: ConditionRoleDefinition[],
  selected: Record<string, string> | ConditionRoleOccurrence[],
) {
  if (Array.isArray(selected)) {
    const validRoles = new Set(roles.map(role => role.key));
    const measurements = new Set<string>(), instances = new Set<string>();
    return selected.filter(row => row.measurementId).map(row => {
      if (!validRoles.has(row.roleKey)) throw new Error(`Unknown measurement role: ${row.roleKey}`);
      const identity = `${row.roleKey}:${row.roleInstanceKey}`;
      if (instances.has(identity) || measurements.has(row.measurementId)) throw new Error('Each occurrence and measurement must be linked only once.');
      instances.add(identity); measurements.add(row.measurementId);
      return {...row};
    });
  }
  const assignments: ConditionMeasurementRoleAssignment[] = [];
  roles.forEach((role, index) => {
    const measurementId = String(selected[role.key] || '').trim();
    if (!measurementId) return;
    assignments.push({
      roleKey: role.key,
      roleInstanceKey: `${role.key}-1`,
      measurementId,
      sortOrder: (index + 1) * 10,
    });
  });
  return assignments;
}

export type ConditionRoleOccurrence = Required<ConditionMeasurementRoleAssignment>;

/** Keep persisted occurrence identities/order, including multiple instances of one role. */
export function conditionRoleOccurrences(roles: ConditionRoleDefinition[], assignments: ConditionMeasurementRoleAssignment[]): ConditionRoleOccurrence[] {
  const rows = assignments.map((row, index) => ({...row, roleInstanceKey: row.roleInstanceKey || `${row.roleKey}-1`, sortOrder: row.sortOrder ?? (index + 1) * 10})).sort((a,b) => a.sortOrder-b.sortOrder || a.roleInstanceKey.localeCompare(b.roleInstanceKey));
  for (const role of roles) if (!rows.some(row => row.roleKey === role.key)) rows.push({roleKey:role.key,roleInstanceKey:`${role.key}-1`,measurementId:'',sortOrder:Math.max(0,...rows.map(row=>row.sortOrder))+10});
  return rows;
}

export function appendConditionRole(rows: ConditionRoleOccurrence[], roleKey: string, instanceKey: string): ConditionRoleOccurrence[] {
  if (rows.some(row => row.roleKey===roleKey && row.roleInstanceKey===instanceKey)) throw new Error('Measurement occurrence already exists.');
  return [...rows,{roleKey,roleInstanceKey:instanceKey,measurementId:'',sortOrder:Math.max(0,...rows.map(row=>row.sortOrder))+10}];
}

/** Selection never steals another occurrence's measurement. Unlinking never deletes geometry. */
export function replaceConditionRole(rows: ConditionRoleOccurrence[], roleKey: string, instanceKey: string, measurementId: string): ConditionRoleOccurrence[] {
  if (!rows.some(row=>row.roleKey===roleKey && row.roleInstanceKey===instanceKey)) throw new Error('Measurement occurrence is unavailable. Reload before linking.');
  if (measurementId && rows.some(row=>(row.roleKey!==roleKey || row.roleInstanceKey!==instanceKey) && row.measurementId===measurementId)) throw new Error('This measurement is already linked. Unlink it there first.');
  return rows.map(row=>row.roleKey===roleKey && row.roleInstanceKey===instanceKey?{...row,measurementId}:row);
}

export function conditionRoleSignature(rows: ConditionRoleOccurrence[]) {
  return rows.filter(row=>row.measurementId).map(row=>[row.roleKey,row.roleInstanceKey,row.measurementId,row.sortOrder]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))||String(a[1]).localeCompare(String(b[1])));
}

/** One compatibility projection anchor; all primary-role occurrences still calculate. */
export function conditionRoleAnchor(rows: ConditionRoleOccurrence[], roles: ConditionRoleDefinition[], anchor: string | null | undefined) {
  return anchor && rows.some(row=>row.measurementId===anchor && roles.some(role=>role.key===row.roleKey && role.primary)) ? anchor : '';
}
