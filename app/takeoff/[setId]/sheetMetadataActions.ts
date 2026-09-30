'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

type SheetMetadataCandidate = {
  pageNumber: number;
  sheetNumber?: string | null;
  title?: string | null;
};

const clean = (value: unknown, max: number) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, max) : null;
};

export async function applyAutomaticSheetMetadata(takeoffSetId: string, candidates: SheetMetadataCandidate[]) {
  if (!takeoffSetId || !Array.isArray(candidates) || !candidates.length) return { updated: 0 };
  if (candidates.length > 1000) throw new Error('Plan set is too large for automatic sheet naming.');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in.');
  const { data: profile } = await supabase.from('profiles').select('company_id,role').eq('id', user.id).single();
  if (!profile?.company_id || profile.role === 'employee') throw new Error('Owner access required.');
  const companyId = profile.company_id;

  const { data: set } = await supabase.from('takeoff_sets')
    .select('id,status,estimate_id')
    .eq('id', takeoffSetId)
    .eq('company_id', companyId)
    .maybeSingle();
  if (!set || set.status !== 'active') throw new Error('Active takeoff set not found.');

  const { data: estimate } = await supabase.from('estimates')
    .select('id,status')
    .eq('id', set.estimate_id)
    .eq('company_id', companyId)
    .maybeSingle();
  if (!estimate || ['accepted', 'approved', 'superseded'].includes(estimate.status)) {
    throw new Error('This estimate revision is locked.');
  }
  const { count: issued } = await supabase.from('proposal_presentations')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('estimate_id', set.estimate_id);
  if ((issued || 0) > 0) throw new Error('This estimate revision was already issued.');

  const { data: sheets, error: sheetError } = await supabase.from('takeoff_sheets')
    .select('id,page_number,sheet_number,title,updated_at')
    .eq('company_id', companyId)
    .eq('takeoff_set_id', takeoffSetId);
  if (sheetError) throw new Error(sheetError.message);
  const byPage = new Map((sheets || []).map((sheet: any) => [Number(sheet.page_number), sheet]));

  let updated = 0;
  for (const candidate of candidates) {
    const pageNumber = Number(candidate.pageNumber);
    if (!Number.isInteger(pageNumber) || pageNumber < 1) continue;
    const sheet: any = byPage.get(pageNumber);
    if (!sheet) continue;

    const existingNumber = clean(sheet.sheet_number, 80);
    const existingTitle = clean(sheet.title, 180);
    const inferredNumber = clean(candidate.sheetNumber, 80);
    const inferredTitle = clean(candidate.title, 180);
    const patch: Record<string, string> = {};
    if (!existingNumber && inferredNumber) patch.sheet_number = inferredNumber;
    if (!existingTitle && inferredTitle) patch.title = inferredTitle;
    if (!Object.keys(patch).length) continue;

    const { data: changed, error } = await supabase.from('takeoff_sheets')
      .update(patch)
      .eq('id', sheet.id)
      .eq('company_id', companyId)
      .eq('takeoff_set_id', takeoffSetId)
      .eq('updated_at', sheet.updated_at)
      .select('id');
    if (error) throw new Error(error.message);
    updated += changed?.length || 0;
  }

  if (updated) {
    revalidatePath(`/takeoff/${takeoffSetId}`);
    revalidatePath('/takeoff');
    revalidatePath('/takeoff/plans');
  }
  return { updated };
}

type SheetMetadataCorrection = {
  takeoffSetId: string;
  sheetId: string;
  pageNumber: number;
  expectedUpdatedAt: string;
  sheetNumber: string;
  title: string;
};

function correctedLabel(value: unknown, limit: number, field: string) {
  if (typeof value !== 'string') throw new Error(`${field} must be text.`);
  const result = value.replace(/\s+/g, ' ').trim();
  if (result.length > limit) throw new Error(`${field} must be ${limit} characters or fewer.`);
  return result || null;
}

export async function correctTakeoffSheetMetadata(input: SheetMetadataCorrection) {
  if (!input || !input.takeoffSetId || !input.sheetId
    || !Number.isInteger(input.pageNumber) || input.pageNumber < 1
    || !input.expectedUpdatedAt || !Number.isFinite(Date.parse(input.expectedUpdatedAt))) {
    throw new Error('A selected drawing sheet and version are required.');
  }
  const sheetNumber = correctedLabel(input.sheetNumber, 80, 'Sheet number');
  const title = correctedLabel(input.title, 180, 'Sheet title');

  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error('Not signed in.');
  const { data: profile, error: profileError } = await supabase.from('profiles')
    .select('company_id,role').eq('id', user.id).maybeSingle();
  if (profileError || !profile?.company_id || profile.role === 'employee') {
    throw new Error('Takeoff editing authority required.');
  }
  const companyId = profile.company_id;

  const { data: set, error: setError } = await supabase.from('takeoff_sets')
    .select('id,status,estimate_id')
    .eq('id', input.takeoffSetId).eq('company_id', companyId).maybeSingle();
  if (setError || !set || set.status !== 'active') throw new Error('Active takeoff set not found.');
  const { data: estimate, error: estimateError } = await supabase.from('estimates')
    .select('id,status').eq('id', set.estimate_id).eq('company_id', companyId).maybeSingle();
  if (estimateError || !estimate || ['accepted', 'approved', 'superseded'].includes(estimate.status)) {
    throw new Error('This estimate revision is locked.');
  }
  const { count: issued, error: issuedError } = await supabase.from('proposal_presentations')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId).eq('estimate_id', set.estimate_id);
  if (issuedError || issued === null) throw new Error('Could not verify revision status.');
  if (issued > 0) throw new Error('This estimate revision was already issued.');

  const { data: sheet, error: sheetError } = await supabase.from('takeoff_sheets')
    .select('id,page_number,sheet_number,title,updated_at')
    .eq('id', input.sheetId).eq('takeoff_set_id', set.id).eq('company_id', companyId).maybeSingle();
  if (sheetError || !sheet || Number(sheet.page_number) !== input.pageNumber) {
    throw new Error('Selected drawing sheet not found.');
  }
  if (sheet.updated_at !== input.expectedUpdatedAt) {
    throw new Error('Sheet changed. Refresh and try again.');
  }
  if (sheet.sheet_number === sheetNumber && sheet.title === title) return { updated: false };

  // This RPC exists only after the migration that guards and audits direct writes.
  const { error: correctionError } = await supabase.rpc('carez_correct_takeoff_sheet_metadata', {
    p_takeoff_set_id: set.id,
    p_sheet_id: sheet.id,
    p_page_number: input.pageNumber,
    p_expected_updated_at: input.expectedUpdatedAt,
    p_sheet_number: sheetNumber,
    p_title: title,
  });
  if (correctionError?.code === 'PGRST202') {
    throw new Error('Sheet label editing is pending the database migration for this workspace.');
  }
  if (correctionError) throw new Error(correctionError.message);

  revalidatePath(`/takeoff/${set.id}`);
  revalidatePath('/takeoff');
  revalidatePath('/takeoff/plans');
  return { updated: true };
}
