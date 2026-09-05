'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { prepareConcreteConditionPilotPersistence } from '@/lib/takeoff/conditions/persistence.server';
import { CONDITION_ARCHETYPE_KEYS, type ConditionArchetypeKey, type PersistConcreteConditionPilotInput } from '@/lib/takeoff/conditions/types';

async function conditionContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in.');
  const { data: profile, error } = await supabase.from('profiles')
    .select('company_id,role')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!profile?.company_id || profile.role === 'employee') throw new Error('Office access required.');
  return { supabase, companyId: profile.company_id as string };
}

async function editableTakeoffSet(supabase: any, companyId: string, takeoffSetId: string) {
  const { data: set, error } = await supabase.from('takeoff_sets')
    .select('id,estimate_id,status')
    .eq('id', takeoffSetId)
    .eq('company_id', companyId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!set || set.status !== 'active') throw new Error('Active takeoff set not found.');

  const [{ data: estimate }, { count: issuedCount }] = await Promise.all([
    supabase.from('estimates').select('id,status').eq('id', set.estimate_id).eq('company_id', companyId).maybeSingle(),
    supabase.from('proposal_presentations').select('id', { count: 'exact', head: true }).eq('estimate_id', set.estimate_id).eq('company_id', companyId),
  ]);
  if (!estimate || ['accepted', 'approved', 'superseded'].includes(estimate.status)) {
    throw new Error('This estimate revision is locked.');
  }
  if ((issuedCount || 0) > 0) {
    throw new Error('This estimate revision was already issued. Create the next revision before changing takeoff.');
  }
  return set;
}

function nextAvailableConditionCode(requestedCode: string, existingCodes: string[]) {
  const base = requestedCode.trim().toUpperCase();
  const used = new Set(existingCodes.map(value => String(value || '').trim().toUpperCase()).filter(Boolean));
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

function refreshConditionSurfaces(takeoffSetId: string) {
  revalidatePath(`/takeoff/${takeoffSetId}`);
  revalidatePath('/takeoff');
  revalidatePath('/takeoff/plans');
  revalidatePath('/takeoff/assemblies');
  revalidatePath('/estimates');
}

export async function createProjectConcreteConditionPilot(input: {
  takeoffSetId: string;
  archetypeKey: ConditionArchetypeKey;
  code: string;
  name: string;
  description?: string;
}) {
  const { supabase, companyId } = await conditionContext();
  const takeoffSetId = String(input?.takeoffSetId || '').trim();
  const requestedCode = String(input?.code || '').trim().toUpperCase();
  const archetypeKey = String(input?.archetypeKey || '').trim() as ConditionArchetypeKey;
  const name = String(input?.name || '').trim();
  const description = String(input?.description || '').trim() || null;
  if (!takeoffSetId || !CONDITION_ARCHETYPE_KEYS.includes(archetypeKey) || !requestedCode || !name) {
    throw new Error('Condition family, code, and name are required.');
  }
  await editableTakeoffSet(supabase, companyId, takeoffSetId);

  const { data: existingConditions, error: existingConditionsError } = await supabase.from('project_concrete_conditions')
    .select('code')
    .eq('company_id', companyId)
    .eq('takeoff_set_id', takeoffSetId);
  if (existingConditionsError) throw new Error(existingConditionsError.message);
  const code = nextAvailableConditionCode(requestedCode, (existingConditions || []).map((row: any) => row.code));

  let template: any = null;
  for (const pilotKey of CONDITION_ARCHETYPE_KEYS) {
    const { data, error: templateError } = await supabase.rpc(
      'carez_ensure_pilot_condition_template',
      { p_archetype_code: pilotKey },
    );
    if (templateError) throw new Error(templateError.message);
    if (pilotKey === archetypeKey) template = data;
  }
  const templateVersionId = String(template?.template_version_id || '');
  const compatibilityAssemblyVersionId = String(template?.legacy_assembly_version_id || '');
  if (!templateVersionId || !compatibilityAssemblyVersionId) {
    throw new Error('Concrete Condition template could not be prepared.');
  }

  const { data: conditionVersionId, error } = await supabase.rpc(
    'carez_create_project_concrete_condition',
    {
      p_takeoff_set_id: takeoffSetId,
      p_template_version_id: templateVersionId,
      p_code: code,
      p_name: name,
      p_description: description,
      p_plan_facts: {},
      p_method_inputs: {},
      p_production_inputs: {},
      p_commercial_inputs: {},
      p_drawing_inputs: {},
      p_input_provenance: {},
      p_output_overrides: {},
      p_legacy_method_profile_id: null,
    },
  );
  if (error) throw new Error(error.message);
  refreshConditionSurfaces(takeoffSetId);
  return {
    condition_version_id: conditionVersionId as string,
    compatibility_assembly_version_id: compatibilityAssemblyVersionId,
    condition_code: code,
  };
}

/**
 * The browser submits inputs and stable IDs only. Measurements, prices,
 * calculations, lineage, legacy projections, and reconciliation are resolved
 * on the authenticated server and committed by one database transaction.
 */
export async function saveAndRecalculateConcreteConditionPilot(
  input: PersistConcreteConditionPilotInput,
) {
  const { supabase, companyId } = await conditionContext();
  const prepared = await prepareConcreteConditionPilotPersistence({ supabase, companyId, input });
  const { data, error } = await supabase.rpc(
    'carez_commit_project_condition_calculation',
    prepared.rpcPayload,
  );
  if (error) throw new Error(error.message);

  refreshConditionSurfaces(prepared.takeoffSetId);
  return data;
}

export async function getConcreteConditionReconciliation(conditionVersionId: string) {
  if (!String(conditionVersionId || '').trim()) throw new Error('Condition version is required.');
  const { supabase, companyId } = await conditionContext();
  const { data, error } = await supabase.from('condition_legacy_reconciliation')
    .select('*')
    .eq('company_id', companyId)
    .eq('condition_version_id', conditionVersionId)
    .order('output_key');
  if (error) throw new Error(error.message);
  return data || [];
}
