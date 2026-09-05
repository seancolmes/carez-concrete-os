import { resolveConditionInputGroups } from '../persistence.ts';
import { CONDITION_INPUT_GROUPS } from '../types.ts';
import type { ConditionRawInputGroups } from '../types.ts';
import type { Derived3DInputResolution, Derived3DConditionSource, BuildDerived3DSceneInput } from './contracts.ts';
import { record, stableDerived3DHash } from './coordinates.ts';

export function resolvedPhysicalInputs(input: Derived3DInputResolution) {
  const resolved = resolveConditionInputGroups(input);
  const values: ConditionRawInputGroups = {};
  for (const group of CONDITION_INPUT_GROUPS) if (resolved[group]) values[group] = Object.fromEntries(Object.entries(resolved[group]!).map(([key, value]) => [key, value.value]));
  return { planFacts: values.planFacts || {}, drawingInputs: values.drawing || {} };
}
export function sourceFromCondition(summary: any, version: any, template: any, archetype: any, roles: any[], modules: any[]): Derived3DConditionSource {
  const effective = resolvedPhysicalInputs({ companyDefaults: record(template?.input_defaults), companyProvenance: record(template?.input_provenance), projectValues: {
    planFacts: record(version.plan_facts), methods: record(version.method_inputs), production: record(version.production_inputs), commercial: record(version.commercial_inputs), drawing: record(version.drawing_inputs),
  }, projectProvenance: record(version.input_provenance) });
  const concrete = modules.find(m => m.module_key === 'concrete' && m.instance_key === 'default');
  const fallbackColor = summary.archetype_code === 'slab_on_grade' ? '#60a5fa' : summary.archetype_code === 'pad_column_footing' ? '#f59e0b' : '#34d399';
  return {
    conditionId: summary.condition_id, conditionVersionId: version.id, code: summary.code, name: summary.name,
    archetypeKey: summary.archetype_code, contractVersion: Number(archetype?.version_no || 0), engineKey: String(archetype?.engine_key || ''),
    templateVersionId: version.template_version_id, archetypeVersionId: version.archetype_version_id, updatedAt: version.updated_at,
    color: typeof effective.drawingInputs.color === 'string' && /^#[0-9a-f]{6}$/i.test(effective.drawingInputs.color) ? effective.drawingInputs.color : fallbackColor,
    ...effective, concreteProfile: concrete ? { enabled: Boolean(concrete.enabled), profile: concrete.input_values?.profile, topWidthFt: concrete.input_values?.top_width_ft } : undefined,
    roles: roles.map(r => ({ roleKey: r.role_key, roleInstanceKey: r.role_instance_key, measurementId: r.measurement_id })),
  };
}
export function prepareDerived3DSources(companyId: string, takeoffSetId: string, data: any, measurements: any[], sheets: any[], regions: any[]): BuildDerived3DSceneInput {
  if (!companyId || !takeoffSetId) throw new Error('A tenant-scoped takeoff is required.');
  const latest = new Map<string, any>();
  for (const summary of data.conditions || []) { const prior = latest.get(summary.condition_id); if (!prior || Number(summary.revision_no) > Number(prior.revision_no)) latest.set(summary.condition_id, summary); }
  return {
    scopeKey: `${companyId}:${takeoffSetId}`, state: 'saved',
    conditions: [...latest.values()].flatMap(summary => {
      const version = data.versions.find((v: any) => v.id === summary.condition_version_id);
      if (!version) return [];
      return [sourceFromCondition(summary, version, data.templateVersions.find((t: any) => t.id === version.template_version_id), data.archetypeVersions.find((a: any) => a.id === version.archetype_version_id), data.roles.filter((r: any) => r.condition_version_id === version.id), data.modules.filter((m: any) => m.condition_version_id === version.id))];
    }),
    measurements: measurements.map(m => {
      const sheet = sheets.find(s => s.id === m.sheet_id);
      const region = m.scale_region_id ? regions.find(r => r.id === m.scale_region_id && r.sheet_id === m.sheet_id) : null;
      // An assigned missing/invalid region never falls back to another scale.
      const calibration = m.scale_region_id ? region?.calibration ?? null : sheet?.calibration ?? null;
      return { id: m.id, sheet_id: m.sheet_id, name: m.name, location: m.location, raw_quantity: m.raw_quantity, raw_unit: m.raw_unit, geometry: m.geometry, updated_at: m.updated_at, geometry_anchor: m.geometry_anchor, geometry_offset_in: m.geometry_offset_in, calibration, calibrationKey: stableDerived3DHash([m.scale_region_id || m.sheet_id, region?.updated_at, calibration]) };
    }),
    sheets: sheets.map(s => ({ id: s.id, page_width: s.page_width, page_height: s.page_height, calibration: s.calibration, revision: String(s.revision_id || s.updated_at || s.id) })),
  };
}
