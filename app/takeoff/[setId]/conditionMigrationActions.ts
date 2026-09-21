'use server';

import { createClient } from '@/lib/supabase/server';
import {
  buildLegacyMigrationInventory,
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
