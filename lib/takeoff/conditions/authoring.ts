import type {
  ConditionInputGroup,
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

export function prepareConditionRoleAssignments(
  roles: ConditionRoleDefinition[],
  selected: Record<string, string>,
) {
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
