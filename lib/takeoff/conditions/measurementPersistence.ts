/** Server persistence orchestration. Quantities are never calculated here. */
export async function persistDrawingMeasurementWithConditions({
  supabase,
  companyId,
  measurementId,
  persistMeasurement,
  recalculateCondition,
}: {
  supabase: any;
  companyId: string;
  measurementId: string;
  persistMeasurement: () => Promise<void>;
  recalculateCondition: (conditionVersionId: string) => Promise<void>;
}) {
  // Capture projection ownership before the atomic measurement RPC clears it.
  // Uncalculated/shared drafts must not silently claim another Condition's
  // compatibility projection simply because their geometry changed.
  const [{ data: roles, error: roleError }, { data: anchors, error: anchorError }] = await Promise.all([
    supabase.from('project_condition_measurement_roles').select('condition_version_id')
      .eq('company_id', companyId).eq('measurement_id', measurementId),
    supabase.from('project_concrete_condition_versions').select('id')
      .eq('company_id', companyId).eq('compatibility_anchor_measurement_id', measurementId).eq('status', 'draft'),
  ]);
  if (roleError || anchorError) throw new Error((roleError || anchorError).message);
  const linkedIds = [...new Set<string>([
    ...(roles || []).map((role: any) => String(role.condition_version_id)),
    ...(anchors || []).map((version: any) => String(version.id)),
  ])];
  let projectedIds: string[] = [];
  if (linkedIds.length) {
    const { data: versions, error: versionError } = await supabase.from('project_concrete_condition_versions')
      .select('id').eq('company_id', companyId).eq('status', 'draft').in('id', linkedIds);
    if (versionError) throw new Error(versionError.message);
    const draftIds = (versions || []).map((version: any) => String(version.id));
    if (draftIds.length) {
      const { data: conditions, error: conditionError } = await supabase.from('project_concrete_conditions')
        .select('compatibility_projection_version_id').eq('company_id', companyId)
        .eq('status', 'active').in('compatibility_projection_version_id', draftIds);
      if (conditionError) throw new Error(conditionError.message);
      projectedIds = [...new Set<string>((conditions || []).map((condition: any) => String(condition.compatibility_projection_version_id)))].sort();
    }
  }

  // The RPC invalidates ALL linked drafts transactionally, even when no draft
  // owned a projection. A rejected edit must not start any recalculation.
  await persistMeasurement();
  const pendingConditionVersionIds: string[] = [];
  for (const versionId of projectedIds) {
    try {
      // Reload authoritative measurements/inputs and use the existing commit
      // RPC's timestamp, ownership, verification and estimate-history guards.
      await recalculateCondition(versionId);
    } catch {
      // The geometry save succeeded. Keep its invalidated outputs absent and
      // allow the caller to refresh, rather than implying the edit was rolled back.
      pendingConditionVersionIds.push(versionId);
    }
  }
  return { pendingConditionVersionIds };
}
