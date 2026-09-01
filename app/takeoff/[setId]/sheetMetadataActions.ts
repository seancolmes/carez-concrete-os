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
    .select('id,page_number,sheet_number,title')
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

    const { error } = await supabase.from('takeoff_sheets')
      .update(patch)
      .eq('id', sheet.id)
      .eq('company_id', companyId)
      .eq('takeoff_set_id', takeoffSetId);
    if (error) throw new Error(error.message);
    updated += 1;
  }

  if (updated) {
    revalidatePath(`/takeoff/${takeoffSetId}`);
    revalidatePath('/takeoff');
    revalidatePath('/takeoff/plans');
  }
  return { updated };
}
