'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

async function context() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in.');
  const { data: profile } = await supabase.from('profiles').select('company_id,role').eq('id', user.id).single();
  if (!profile?.company_id || profile.role === 'employee') throw new Error('Owner access required.');
  return { supabase, companyId: profile.company_id };
}

async function assertEditableSet(supabase: any, companyId: string, setId: string) {
  const { data: set } = await supabase.from('takeoff_sets').select('id,estimate_id,status').eq('id', setId).eq('company_id', companyId).maybeSingle();
  if (!set || set.status !== 'active') throw new Error('Active takeoff set not found.');
  const { data: estimate } = await supabase.from('estimates').select('id,status').eq('id', set.estimate_id).eq('company_id', companyId).maybeSingle();
  if (!estimate || ['accepted', 'approved', 'superseded'].includes(estimate.status)) throw new Error('This estimate revision is locked.');
  const { count } = await supabase.from('proposal_presentations').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('estimate_id', set.estimate_id);
  if ((count || 0) > 0) throw new Error('This estimate revision was already issued. Create the next revision before changing takeoff.');
}

export async function createTakeoffScopeVariant(input: {
  takeoffSetId: string;
  assemblyVersionId: string;
  name: string;
  variantCode: string;
  inputs: Record<string, unknown>;
  notes?: string | null;
}) {
  const { supabase, companyId } = await context();
  await assertEditableSet(supabase, companyId, input.takeoffSetId);

  const { data: id, error } = await supabase.rpc('carez_create_verified_takeoff_scope_variant', {
    p_takeoff_set_id: input.takeoffSetId,
    p_assembly_version_id: input.assemblyVersionId,
    p_name: String(input.name || '').trim(),
    p_variant_code: String(input.variantCode || '').trim().toUpperCase(),
    p_inputs: input.inputs || {},
    p_verification_notes: String(input.notes || '').trim() || null,
  });
  if (error) throw new Error(error.message);

  const { data: variant, error: fetchError } = await supabase.from('takeoff_method_profiles')
    .select('id,assembly_version_id,revision_no,name,status,method_inputs,verification_notes,verified_by,verified_at,profile_kind,variant_code')
    .eq('id', id).eq('company_id', companyId).single();
  if (fetchError) throw new Error(fetchError.message);

  revalidatePath(`/takeoff/${input.takeoffSetId}`);
  return variant;
}
