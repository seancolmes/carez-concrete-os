'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { prepareConcreteConditionPilotPersistence } from '@/lib/takeoff/conditions/persistence.server';
import type { PersistConcreteConditionPilotInput } from '@/lib/takeoff/conditions/types';

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

  revalidatePath(`/takeoff/${prepared.takeoffSetId}`);
  revalidatePath('/takeoff');
  revalidatePath('/takeoff/plans');
  revalidatePath('/estimates');
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
