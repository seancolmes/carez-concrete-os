'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { prepareAssemblyOutputs } from '@/lib/takeoff/assemblyEngine.server';

const num = (value: FormDataEntryValue | null) => {
  const n = Number(String(value ?? '').replace(/[$,% ,]/g, ''));
  return Number.isFinite(n) ? n : NaN;
};

async function ctx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in.');
  const { data: profile } = await supabase.from('profiles').select('company_id,role').eq('id', user.id).single();
  if (!profile?.company_id || profile.role === 'employee') throw new Error('Owner access required.');
  return { supabase, user, companyId: profile.company_id };
}

async function assertEstimateEditable(supabase: any, companyId: string, estimateId: string) {
  const { data: estimate } = await supabase.from('estimates').select('id,status').eq('id', estimateId).eq('company_id', companyId).maybeSingle();
  if (!estimate) throw new Error('Estimate not found.');
  if (['accepted', 'approved', 'superseded'].includes(estimate.status)) throw new Error('This estimate revision is locked.');
  const { count } = await supabase.from('proposal_presentations').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('estimate_id', estimateId);
  if ((count || 0) > 0) throw new Error('This estimate revision was already issued. Create the next revision before changing takeoff.');
}

export async function createTakeoffSet(fd: FormData) {
  const estimateId = String(fd.get('estimate_id') || '');
  const name = String(fd.get('name') || '').trim() || 'Concrete Takeoff';
  if (!estimateId) throw new Error('Choose the estimate you are taking off.');
  const { supabase, user, companyId } = await ctx();
  await assertEstimateEditable(supabase, companyId, estimateId);
  const { data, error } = await supabase.from('takeoff_sets').insert({
    company_id: companyId,
    estimate_id: estimateId,
    name,
    revision_label: String(fd.get('revision_label') || 'Current').trim() || 'Current',
    source_filename: String(fd.get('source_filename') || '').trim() || null,
    notes: String(fd.get('notes') || '').trim() || null,
    created_by: user.id,
  }).select('id').single();
  if (error) throw new Error(error.message);
  revalidatePath('/takeoff');
  revalidatePath('/takeoff/plans');
  revalidatePath('/estimates');
  redirect(`/takeoff/${data.id}`);
}

export async function createAssemblyMeasurement(fd: FormData) {
  const takeoffSetId = String(fd.get('takeoff_set_id') || '');
  const assemblyVersionId = String(fd.get('assembly_version_id') || '');
  const sectionId = String(fd.get('estimate_section_id') || '') || null;
  const requestedName = String(fd.get('name') || '').trim();
  const location = String(fd.get('location') || '').trim();
  const rawQuantity = num(fd.get('raw_quantity'));
  if (!takeoffSetId || !assemblyVersionId || !Number.isFinite(rawQuantity) || rawQuantity <= 0) throw new Error('Choose an assembly and enter the measured quantity.');

  const { supabase, companyId } = await ctx();
  const { data: set } = await supabase.from('takeoff_sets').select('id,estimate_id,status').eq('id', takeoffSetId).eq('company_id', companyId).maybeSingle();
  if (!set || set.status !== 'active') throw new Error('Active takeoff set not found.');
  await assertEstimateEditable(supabase, companyId, set.estimate_id);

  const inputs: Record<string, string> = {};
  for (const [key, value] of fd.entries()) {
    if (key.startsWith('var_')) inputs[key.slice(4)] = String(value ?? '').trim();
  }
  const requestedRiskClass = String(fd.get('risk_class_code') || '').trim() || null;
  const engine = await prepareAssemblyOutputs({
    supabase,
    companyId,
    assemblyVersionId,
    rawQuantity,
    inputs,
    riskClassCode: requestedRiskClass,
  });

  const assemblyName = String(engine.assembly?.name || 'Concrete');
  const { count } = await supabase.from('takeoff_measurements').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('takeoff_set_id', takeoffSetId).eq('assembly_version_id', assemblyVersionId).eq('status', 'active');
  const name = requestedName || `${assemblyName}${location ? ` — ${location}` : ''} ${Number(count || 0) + 1}`;
  const primaryUnit = String(engine.assembly?.primary_measurement || 'LF');
  const measurementType = primaryUnit === 'SF' ? 'area' : primaryUnit === 'EA' ? 'count' : primaryUnit === 'CY' ? 'volume' : 'linear';
  const { error } = await supabase.rpc('carez_commit_takeoff_measurement', {
    p_takeoff_set_id: takeoffSetId,
    p_estimate_section_id: sectionId,
    p_assembly_version_id: assemblyVersionId,
    p_name: name,
    p_location: location,
    p_drawing_reference: String(fd.get('drawing_reference') || '').trim(),
    p_measurement_type: measurementType,
    p_raw_quantity: rawQuantity,
    p_raw_unit: primaryUnit,
    p_variables: engine.values,
    p_risk_class_code: engine.riskClassCode || '',
    p_outputs: engine.prepared,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/takeoff');
  revalidatePath(`/takeoff/${takeoffSetId}`);
  revalidatePath('/takeoff/plans');
  revalidatePath('/estimates');
}

export async function updateTakeoffOutputPrice(fd: FormData) {
  const outputId = String(fd.get('output_id') || '');
  const takeoffSetId = String(fd.get('takeoff_set_id') || '');
  const unitCost = num(fd.get('unit_cost'));
  if (!outputId || !Number.isFinite(unitCost) || unitCost < 0) throw new Error('Enter a valid unit cost.');
  const { supabase } = await ctx();
  const { error } = await supabase.rpc('carez_update_takeoff_output_price', { p_output_id: outputId, p_unit_cost: unitCost });
  if (error) throw new Error(error.message);
  revalidatePath('/takeoff');
  if (takeoffSetId) revalidatePath(`/takeoff/${takeoffSetId}`);
  revalidatePath('/takeoff/plans');
  revalidatePath('/estimates');
}

export async function deleteTakeoffMeasurement(fd: FormData) {
  const measurementId = String(fd.get('measurement_id') || '');
  if (!measurementId) return;
  const { supabase } = await ctx();
  const { data: measurement } = await supabase.from('takeoff_measurements').select('takeoff_set_id').eq('id', measurementId).maybeSingle();
  const { error } = await supabase.rpc('carez_delete_takeoff_measurement', { p_measurement_id: measurementId });
  if (error) throw new Error(error.message);
  revalidatePath('/takeoff');
  if (measurement?.takeoff_set_id) revalidatePath(`/takeoff/${measurement.takeoff_set_id}`);
  revalidatePath('/takeoff/plans');
  revalidatePath('/estimates');
}

export async function updateEstimatingLaborProfile(fd: FormData) {
  const rate = num(fd.get('burdened_hourly_rate'));
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('Enter a valid burdened labor rate.');
  const { supabase, user, companyId } = await ctx();
  const baseRisk = String(fd.get('base_risk_class_code') || '').trim() || null;
  const { data: current } = await supabase.from('estimating_labor_profiles').select('id').eq('company_id', companyId).eq('active', true).eq('is_default', true).maybeSingle();
  if (current) {
    const { error } = await supabase.from('estimating_labor_profiles').update({
      burdened_hourly_rate: rate,
      base_risk_class_code: baseRisk,
      source_type: 'manual',
      source_label: 'Owner-reviewed estimating labor profile',
      effective_date: new Date().toISOString().slice(0, 10),
      notes: String(fd.get('notes') || '').trim() || 'Owner-adjusted from the historical payroll starting point.',
    }).eq('id', current.id).eq('company_id', companyId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('estimating_labor_profiles').insert({
      company_id: companyId,
      name: 'Carez Estimating Labor',
      burdened_hourly_rate: rate,
      base_risk_class_code: baseRisk,
      source_type: 'manual',
      source_label: 'Owner-reviewed estimating labor profile',
      is_default: true,
      active: true,
      created_by: user.id,
    });
    if (error) throw new Error(error.message);
  }
  revalidatePath('/takeoff');
  revalidatePath('/takeoff/plans');
  revalidatePath('/estimates');
}
