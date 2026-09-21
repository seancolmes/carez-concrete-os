'use server';

import { createClient } from '@/lib/supabase/server';
import { prepareConcreteConditionPilotPersistence } from '@/lib/takeoff/conditions/persistence.server';
import type { PersistConcreteConditionPilotInput } from '@/lib/takeoff/conditions/types';
import {
  assertLegacyMigrationEstimateLineage,
  buildLegacyMigrationInventory,
  legacyMigrationConditionCode,
  legacyPilotPreparationFromLedger,
  prepareLegacyPilotMigration,
  type LegacyPilotMigrationPreparation,
} from '@/lib/takeoff/conditions/legacyMigration.server';

async function migrationContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in.');
  const { data: profile, error } = await supabase.from('profiles')
    .select('company_id,role')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!profile?.company_id || profile.role === 'employee') throw new Error('Office access required.');
  return { supabase, companyId: String(profile.company_id), userId: String(user.id) };
}

export async function dryRunLegacyConditionMigration(input: { takeoffSetId: string }) {
  const { supabase, companyId, userId } = await migrationContext();
  const takeoffSetId = String(input?.takeoffSetId || '').trim();
  if (!takeoffSetId) throw new Error('Takeoff set is required.');

  const { data: run, error: runError } = await supabase.from('condition_legacy_migration_runs')
    .insert({
      company_id: companyId,
      takeoff_set_id: takeoffSetId,
      mode: 'dry_run',
      status: 'running',
      created_by: userId,
      source_snapshot: { takeoff_set_id: takeoffSetId },
    })
    .select('id')
    .single();
  if (runError || !run?.id) throw new Error(runError?.message || 'Migration dry run could not start.');

  try {
    const inventory = await buildLegacyMigrationInventory({ supabase, companyId, takeoffSetId });
    const preparations = new Map<string, LegacyPilotMigrationPreparation>();
    const preparationErrors = new Map<string, string>();

    if (inventory.estimateStatus === 'draft' && inventory.proposalCount === 0) {
      for (const candidate of inventory.candidates) {
        if (candidate.objectType !== 'measurement' || candidate.classification !== 'mapped') continue;
        try {
          const preparation = await prepareLegacyPilotMigration({
            supabase,
            companyId,
            takeoffSetId,
            measurementId: candidate.legacyId,
          });
          preparations.set(candidate.legacyId, preparation);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Legacy pilot migration preparation failed.';
          if (!message.includes('unsupported_review')) throw error;
          preparationErrors.set(candidate.legacyId, message);
        }
      }
    }

    const items = inventory.candidates.map(candidate => {
      const preparation = candidate.objectType === 'measurement' ? preparations.get(candidate.legacyId) : undefined;
      const preparationError = candidate.objectType === 'measurement' ? preparationErrors.get(candidate.legacyId) : undefined;
      const classification = preparationError ? 'unsupported_review' : candidate.classification;
      const targetTemplateVersionId = preparation?.targetTemplateVersionId || candidate.targetTemplateVersionId;
      return {
        company_id: companyId,
        run_id: run.id,
        object_type: candidate.objectType,
        legacy_id: candidate.legacyId,
        classification,
        target_kind: targetTemplateVersionId ? 'condition_template_version' : null,
        target_id: targetTemplateVersionId,
        result_status: 'pending',
        details: {
          ...candidate.details,
          supported_pilot_family: preparation?.family || candidate.supportedPilotFamily,
          source_assembly_version_id: candidate.sourceAssemblyVersionId,
          target_compatibility_assembly_version_id: preparation?.targetCompatibilityAssemblyVersionId || candidate.targetCompatibilityAssemblyVersionId,
          ...(preparation?.provenance || {}),
          migration_preparation: preparation ? {
            status: 'ready',
            condition_draft: preparation.conditionDraft,
            compatibility_rebind: preparation.compatibilityRebind,
          } : preparationError ? {
            status: 'unsupported_review',
            reason: preparationError,
          } : null,
        },
      };
    });

    if (items.length) {
      const { error: itemError } = await supabase.from('condition_legacy_migration_items').upsert(items, {
        onConflict: 'run_id,object_type,legacy_id',
      });
      if (itemError) throw new Error(itemError.message);
    }

    const byClassification = items.reduce<Record<string, number>>((summary, item) => {
      summary[item.classification] = (summary[item.classification] || 0) + 1;
      return summary;
    }, {});
    const summary = {
      estimate_id: inventory.estimateId,
      estimate_status: inventory.estimateStatus,
      proposal_count: inventory.proposalCount,
      total_items: inventory.candidates.length,
      classifications: byClassification,
    };

    const { error: completeError } = await supabase.from('condition_legacy_migration_runs')
      .update({ status: 'completed', summary, completed_at: new Date().toISOString() })
      .eq('company_id', companyId)
      .eq('id', run.id);
    if (completeError) throw new Error(completeError.message);

    return { runId: String(run.id), summary };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Legacy migration dry run failed.';
    await supabase.from('condition_legacy_migration_runs')
      .update({ status: 'failed', error_text: message, completed_at: new Date().toISOString() })
      .eq('company_id', companyId)
      .eq('id', run.id);
    throw error;
  }
}


async function findApplyRun(supabase: any, companyId: string, takeoffSetId: string, dryRunId: string) {
  const { data, error } = await supabase.from('condition_legacy_migration_runs')
    .select('id,status,summary,error_text,source_snapshot')
    .eq('company_id', companyId)
    .eq('takeoff_set_id', takeoffSetId)
    .eq('mode', 'apply')
    .contains('source_snapshot', { dry_run_id: dryRunId })
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function ensureApplyRun({
  supabase,
  companyId,
  userId,
  takeoffSetId,
  dryRunId,
}: {
  supabase: any;
  companyId: string;
  userId: string;
  takeoffSetId: string;
  dryRunId: string;
}) {
  const existing = await findApplyRun(supabase, companyId, takeoffSetId, dryRunId);
  if (existing) return { run: existing, created: false };

  const { data, error } = await supabase.from('condition_legacy_migration_runs')
    .insert({
      company_id: companyId,
      takeoff_set_id: takeoffSetId,
      mode: 'apply',
      status: 'running',
      created_by: userId,
      source_snapshot: { takeoff_set_id: takeoffSetId, dry_run_id: dryRunId },
    })
    .select('id,status,summary,error_text,source_snapshot')
    .single();
  if (!error && data?.id) return { run: data, created: true };
  if (error?.code !== '23505') throw new Error(error?.message || 'Migration apply run could not start.');

  const raced = await findApplyRun(supabase, companyId, takeoffSetId, dryRunId);
  if (!raced) throw new Error('Migration apply run could not be recovered after a concurrent start.');
  return { run: raced, created: false };
}

async function ensureApplyItems({
  supabase,
  companyId,
  applyRunId,
  sourceItems,
}: {
  supabase: any;
  companyId: string;
  applyRunId: string;
  sourceItems: any[];
}) {
  const { count, error: countError } = await supabase.from('condition_legacy_migration_items')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('run_id', applyRunId);
  if (countError) throw new Error(countError.message);
  if ((count || 0) > 0) return;

  const rows = sourceItems.map(item => ({
    company_id: companyId,
    run_id: applyRunId,
    object_type: item.object_type,
    legacy_id: item.legacy_id,
    classification: item.classification,
    target_kind: item.target_kind,
    target_id: item.target_id,
    result_status: item.object_type === 'measurement' && item.classification === 'mapped' ? 'pending' : 'skipped',
    details: item.details || {},
    error_text: null,
  }));
  if (!rows.length) return;
  const { error } = await supabase.from('condition_legacy_migration_items').insert(rows);
  if (error) throw new Error(error.message);
}

async function ensureMigrationCondition({
  supabase,
  companyId,
  takeoffSetId,
  measurementId,
  measurementName,
  preparation,
}: {
  supabase: any;
  companyId: string;
  takeoffSetId: string;
  measurementId: string;
  measurementName: string;
  preparation: LegacyPilotMigrationPreparation;
}) {
  const code = legacyMigrationConditionCode(measurementId);
  const migrationMarker = `P0.5E legacy migration source measurement ${measurementId}`;

  const { data: existingCondition, error: conditionError } = await supabase.from('project_concrete_conditions')
    .select('id,takeoff_set_id,code,description,status')
    .eq('company_id', companyId)
    .eq('takeoff_set_id', takeoffSetId)
    .eq('code', code)
    .maybeSingle();
  if (conditionError) throw new Error(conditionError.message);

  if (existingCondition) {
    if (existingCondition.status !== 'active' || existingCondition.description !== migrationMarker) {
      throw new Error('Deterministic migration Condition identity is already in use.');
    }
    const { data: existingVersion, error: versionError } = await supabase.from('project_concrete_condition_versions')
      .select('id,template_version_id,status,revision_no')
      .eq('company_id', companyId)
      .eq('condition_id', existingCondition.id)
      .order('revision_no', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (versionError) throw new Error(versionError.message);
    if (!existingVersion
      || existingVersion.status !== 'draft'
      || String(existingVersion.template_version_id) !== preparation.targetTemplateVersionId) {
      throw new Error('Existing migration Condition no longer matches the prepared target template.');
    }
    return String(existingVersion.id);
  }

  const inputGroups = preparation.conditionDraft.inputs;
  const { data: conditionVersionId, error } = await supabase.rpc('carez_create_project_concrete_condition', {
    p_takeoff_set_id: takeoffSetId,
    p_template_version_id: preparation.targetTemplateVersionId,
    p_code: code,
    p_name: `${measurementName} — Migrated Condition`,
    p_description: migrationMarker,
    p_plan_facts: inputGroups.planFacts || {},
    p_method_inputs: inputGroups.methods || {},
    p_production_inputs: inputGroups.production || {},
    p_commercial_inputs: inputGroups.commercial || {},
    p_drawing_inputs: inputGroups.drawing || {},
    p_input_provenance: preparation.conditionDraft.inputProvenance,
    p_output_overrides: {},
    p_legacy_method_profile_id: null,
  });
  if (error || !conditionVersionId) throw new Error(error?.message || 'Migration Condition could not be created.');
  return String(conditionVersionId);
}

export async function applyLegacyConditionMigration(input: { dryRunId: string }) {
  const { supabase, companyId, userId } = await migrationContext();
  const dryRunId = String(input?.dryRunId || '').trim();
  if (!dryRunId) throw new Error('Completed migration dry run is required.');

  const { data: dryRun, error: dryRunError } = await supabase.from('condition_legacy_migration_runs')
    .select('id,takeoff_set_id,mode,status,summary')
    .eq('company_id', companyId)
    .eq('id', dryRunId)
    .eq('mode', 'dry_run')
    .eq('status', 'completed')
    .maybeSingle();
  if (dryRunError) throw new Error(dryRunError.message);
  if (!dryRun?.takeoff_set_id) throw new Error('Completed migration dry run not found.');
  const takeoffSetId = String(dryRun.takeoff_set_id);

  const { data: sourceItems, error: sourceItemsError } = await supabase.from('condition_legacy_migration_items')
    .select('id,object_type,legacy_id,classification,target_kind,target_id,result_status,details,error_text')
    .eq('company_id', companyId)
    .eq('run_id', dryRunId)
    .order('created_at');
  if (sourceItemsError) throw new Error(sourceItemsError.message);

  const { run: initialRun } = await ensureApplyRun({
    supabase,
    companyId,
    userId,
    takeoffSetId,
    dryRunId,
  });
  const applyRunId = String(initialRun.id);

  if (initialRun.status === 'completed') {
    return { runId: applyRunId, summary: initialRun.summary || {}, idempotent: true };
  }

  if (initialRun.status === 'failed') {
    const { error } = await supabase.from('condition_legacy_migration_runs')
      .update({ status: 'running', error_text: null, completed_at: null })
      .eq('company_id', companyId)
      .eq('id', applyRunId);
    if (error) throw new Error(error.message);
  }

  await ensureApplyItems({
    supabase,
    companyId,
    applyRunId,
    sourceItems: sourceItems || [],
  });

  const sourceByMeasurement = new Map(
    (sourceItems || [])
      .filter((item: any) => item.object_type === 'measurement')
      .map((item: any) => [String(item.legacy_id), item]),
  );

  const { data: applyItems, error: applyItemsError } = await supabase.from('condition_legacy_migration_items')
    .select('id,legacy_id,classification,target_kind,target_id,result_status,details,error_text')
    .eq('company_id', companyId)
    .eq('run_id', applyRunId)
    .eq('object_type', 'measurement')
    .eq('classification', 'mapped')
    .order('created_at');
  if (applyItemsError) throw new Error(applyItemsError.message);

  let currentItemId: string | null = null;
  const results: Array<Record<string, unknown>> = [];

  try {
    for (const item of applyItems || []) {
      currentItemId = String(item.id);
      const measurementId = String(item.legacy_id);
      const sourceItem: any = sourceByMeasurement.get(measurementId);
      if (!sourceItem) throw new Error('Mapped apply item is missing source dry-run lineage.');

      const preparation = legacyPilotPreparationFromLedger(
        sourceItem.details,
        String(dryRun.summary?.estimate_id || ''),
        measurementId,
      );

      const { data: rebindResult, error: rebindError } = await supabase.rpc(
        'carez_commit_legacy_condition_migration',
        { p_run_id: applyRunId, p_item_id: currentItemId },
      );
      if (rebindError) throw new Error(rebindError.message);

      const { data: measurement, error: measurementError } = await supabase.from('takeoff_measurements')
        .select('id,name,estimate_id,takeoff_set_id,assembly_version_id')
        .eq('company_id', companyId)
        .eq('takeoff_set_id', takeoffSetId)
        .eq('id', measurementId)
        .eq('status', 'active')
        .maybeSingle();
      if (measurementError) throw new Error(measurementError.message);
      if (!measurement) throw new Error('Rebound migration measurement could not be loaded.');
      if (String(measurement.assembly_version_id) !== preparation.targetCompatibilityAssemblyVersionId) {
        throw new Error('Compatibility rebind did not reach the prepared target assembly.');
      }

      const conditionVersionId = await ensureMigrationCondition({
        supabase,
        companyId,
        takeoffSetId,
        measurementId,
        measurementName: String(measurement.name || 'Legacy takeoff'),
        preparation,
      });

      const { data: currentApplyItem, error: currentApplyItemError } = await supabase.from('condition_legacy_migration_items')
        .select('details')
        .eq('company_id', companyId)
        .eq('id', currentItemId)
        .maybeSingle();
      if (currentApplyItemError) throw new Error(currentApplyItemError.message);
      const { error: targetError } = await supabase.from('condition_legacy_migration_items')
        .update({
          target_kind: 'project_condition_version',
          target_id: conditionVersionId,
          details: {
            ...(currentApplyItem?.details || {}),
            migration_condition: {
              condition_version_id: conditionVersionId,
              condition_code: legacyMigrationConditionCode(measurementId),
            },
          },
        })
        .eq('company_id', companyId)
        .eq('id', currentItemId);
      if (targetError) throw new Error(targetError.message);

      const persistenceInput = {
        conditionVersionId,
        inputs: preparation.conditionDraft.inputs,
        inputProvenance: preparation.conditionDraft.inputProvenance,
        modules: preparation.conditionDraft.modules,
        measurementRoles: [preparation.conditionDraft.measurementRole],
        outputOverrides: {},
        compatibilityAnchorMeasurementId: measurementId,
      } as PersistConcreteConditionPilotInput;

      const prepared = await prepareConcreteConditionPilotPersistence({
        supabase,
        companyId,
        input: persistenceInput,
      });
      const { error: calculationError } = await supabase.rpc(
        'carez_commit_project_condition_calculation',
        prepared.rpcPayload,
      );
      if (calculationError) throw new Error(calculationError.message);

      const { data: reconciliation, error: reconciliationError } = await supabase.from('condition_legacy_reconciliation')
        .select('output_key,reconciliation_status,is_current_projection')
        .eq('company_id', companyId)
        .eq('condition_version_id', conditionVersionId)
        .order('output_key');
      if (reconciliationError) throw new Error(reconciliationError.message);
      const reconciliationRows = reconciliation || [];
      if (!reconciliationRows.length) throw new Error('Legacy migration reconciliation produced no mapped outputs.');
      const invalid = reconciliationRows.filter((row: any) =>
        !row.is_current_projection || !['exact', 'held', 'inactive'].includes(String(row.reconciliation_status)));
      if (invalid.length) {
        throw new Error(`Legacy migration reconciliation mismatch: ${invalid.map((row: any) => `${row.output_key}=${row.reconciliation_status}`).join(', ')}.`);
      }

      const estimateId = String(measurement.estimate_id || preparation.estimateId);
      if (!estimateId) throw new Error('Migration estimate lineage is unavailable.');
      const lineage = await assertLegacyMigrationEstimateLineage({
        supabase,
        companyId,
        estimateId,
        measurementId,
        conditionVersionId,
      });

      const held = reconciliationRows.some((row: any) => row.reconciliation_status === 'held');
      const resultStatus = held ? 'held' : 'exact';
      const { data: finalApplyItem, error: finalApplyItemError } = await supabase.from('condition_legacy_migration_items')
        .select('details')
        .eq('company_id', companyId)
        .eq('id', currentItemId)
        .maybeSingle();
      if (finalApplyItemError) throw new Error(finalApplyItemError.message);

      const statusCounts = reconciliationRows.reduce<Record<string, number>>((counts, row: any) => {
        const status = String(row.reconciliation_status);
        counts[status] = (counts[status] || 0) + 1;
        return counts;
      }, {});
      const { error: itemCompleteError } = await supabase.from('condition_legacy_migration_items')
        .update({
          target_kind: 'project_condition_version',
          target_id: conditionVersionId,
          result_status: resultStatus,
          error_text: null,
          details: {
            ...(finalApplyItem?.details || {}),
            migration_reconciliation: {
              condition_version_id: conditionVersionId,
              statuses: statusCounts,
              lineage,
              rebind: rebindResult || null,
            },
          },
          updated_at: new Date().toISOString(),
        })
        .eq('company_id', companyId)
        .eq('id', currentItemId);
      if (itemCompleteError) throw new Error(itemCompleteError.message);

      results.push({
        itemId: currentItemId,
        measurementId,
        conditionVersionId,
        resultStatus,
        reconciliation: statusCounts,
        lineage,
      });
      currentItemId = null;
    }

    const { data: runItems, error: runItemsError } = await supabase.from('condition_legacy_migration_items')
      .select('classification,result_status')
      .eq('company_id', companyId)
      .eq('run_id', applyRunId);
    if (runItemsError) throw new Error(runItemsError.message);

    const byStatus = (runItems || []).reduce<Record<string, number>>((counts, row: any) => {
      const status = String(row.result_status);
      counts[status] = (counts[status] || 0) + 1;
      return counts;
    }, {});
    const summary = {
      dry_run_id: dryRunId,
      estimate_id: dryRun.summary?.estimate_id || null,
      total_items: (runItems || []).length,
      mapped_measurements: (applyItems || []).length,
      results: byStatus,
      migrated: results,
      cutover_ready: (byStatus.mismatch || 0) === 0 && (byStatus.error || 0) === 0,
    };

    const { error: completeError } = await supabase.from('condition_legacy_migration_runs')
      .update({ status: 'completed', summary, error_text: null, completed_at: new Date().toISOString() })
      .eq('company_id', companyId)
      .eq('id', applyRunId);
    if (completeError) throw new Error(completeError.message);

    return { runId: applyRunId, summary, idempotent: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Legacy migration apply failed.';
    const mismatch = /reconciliation|lineage|duplicate|orphan/i.test(message);
    if (currentItemId) {
      await supabase.from('condition_legacy_migration_items')
        .update({
          result_status: mismatch ? 'mismatch' : 'error',
          error_text: message,
          updated_at: new Date().toISOString(),
        })
        .eq('company_id', companyId)
        .eq('id', currentItemId);
    }
    await supabase.from('condition_legacy_migration_runs')
      .update({ status: 'failed', error_text: message, completed_at: new Date().toISOString() })
      .eq('company_id', companyId)
      .eq('id', applyRunId);
    throw error;
  }
}
