'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { prepareAssemblyOutputs } from '@/lib/takeoff/assemblyEngine.server';
import { measureDrawingGeometry, pdfDistance, roundMeasurement, type DrawingGeometry, type NormalizedPoint } from '@/lib/takeoff/geometry';

type PageMeta = { pageNumber: number; width: number; height: number };
type CalibrationInput = { sheetId: string; pageWidth: number; pageHeight: number; points: NormalizedPoint[]; knownDistanceFt: number };
type DrawingInput = {
  takeoffSetId: string;
  sheetId: string;
  estimateSectionId?: string | null;
  assemblyVersionId: string;
  name: string;
  location?: string | null;
  drawingReference?: string | null;
  riskClassCode?: string | null;
  variables?: Record<string, number | string | null | undefined>;
  geometry: DrawingGeometry;
};

async function ctx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in.');
  const { data: profile } = await supabase.from('profiles').select('company_id,role').eq('id', user.id).single();
  if (!profile?.company_id || profile.role === 'employee') throw new Error('Owner access required.');
  return { supabase, user, companyId: profile.company_id };
}

async function editableSet(supabase: any, companyId: string, setId: string) {
  const { data: set } = await supabase.from('takeoff_sets').select('id,estimate_id,status,source_document_id').eq('id', setId).eq('company_id', companyId).maybeSingle();
  if (!set || set.status !== 'active') throw new Error('Active takeoff set not found.');
  const { data: estimate } = await supabase.from('estimates').select('id,status').eq('id', set.estimate_id).eq('company_id', companyId).maybeSingle();
  if (!estimate) throw new Error('Estimate not found.');
  if (['accepted', 'approved', 'superseded'].includes(estimate.status)) throw new Error('This estimate revision is locked.');
  const { count } = await supabase.from('proposal_presentations').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('estimate_id', set.estimate_id);
  if ((count || 0) > 0) throw new Error('This estimate revision was already issued. Create the next revision before changing takeoff.');
  return set;
}

export async function attachPlanToTakeoffSet(fd: FormData) {
  const setId = String(fd.get('takeoff_set_id') || '');
  const storagePath = String(fd.get('storage_path') || '').trim();
  const filename = String(fd.get('source_filename') || '').trim();
  const mimeType = String(fd.get('mime_type') || '').trim() || 'application/pdf';
  if (!setId || !storagePath || !filename) throw new Error('PDF plan file is required.');
  if (mimeType !== 'application/pdf' && !filename.toLowerCase().endsWith('.pdf')) throw new Error('The drawing workspace currently requires a PDF plan set.');

  const { supabase, user, companyId } = await ctx();
  const set = await editableSet(supabase, companyId, setId);
  const { count } = await supabase.from('takeoff_measurements').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('takeoff_set_id', setId).eq('status', 'active');
  if (set.source_document_id && (count || 0) > 0) throw new Error('This takeoff already contains drawing measurements. Create a new takeoff revision/set before replacing its source plans.');

  const { data: doc, error: docError } = await supabase.from('company_documents').insert({
    company_id: companyId,
    document_type: 'plan',
    title: filename,
    storage_path: storagePath,
    mime_type: 'application/pdf',
    source: 'upload',
    review_status: 'filed',
    reviewed_at: new Date().toISOString(),
    reviewed_by: user.id,
    notes: `Source plans for takeoff set ${setId}`,
    created_by: user.id,
  }).select('id').single();
  if (docError || !doc) throw new Error(docError?.message || 'Could not file source plans.');

  const { error } = await supabase.from('takeoff_sets').update({ source_document_id: doc.id, source_filename: filename, page_count: null }).eq('id', setId).eq('company_id', companyId);
  if (error) throw new Error(error.message);
  revalidatePath(`/takeoff/${setId}`);
  revalidatePath('/takeoff');
}

export async function initializeTakeoffSheets(setId: string, pages: PageMeta[]) {
  if (!setId || !Array.isArray(pages) || !pages.length) throw new Error('PDF pages were not detected.');
  if (pages.length > 1000) throw new Error('Plan set is too large for one takeoff set.');
  const { supabase, companyId } = await ctx();
  await editableSet(supabase, companyId, setId);
  const clean = pages.map((p, index) => {
    const pageNumber = Number(p.pageNumber);
    const width = Number(p.width);
    const height = Number(p.height);
    if (!Number.isInteger(pageNumber) || pageNumber < 1 || !(width > 0) || !(height > 0)) throw new Error('PDF page metadata is invalid.');
    return { company_id: companyId, takeoff_set_id: setId, page_number: pageNumber, page_width: width, page_height: height, sort_order: index + 1 };
  });
  const { error } = await supabase.from('takeoff_sheets').upsert(clean, { onConflict: 'takeoff_set_id,page_number', ignoreDuplicates: false });
  if (error) throw new Error(error.message);
  const { error: setError } = await supabase.from('takeoff_sets').update({ page_count: clean.length }).eq('id', setId).eq('company_id', companyId);
  if (setError) throw new Error(setError.message);
  revalidatePath(`/takeoff/${setId}`);
  return { pageCount: clean.length };
}

export async function saveSheetCalibration(input: CalibrationInput) {
  if (!input?.sheetId || !Array.isArray(input.points) || input.points.length !== 2) throw new Error('Click exactly two calibration points.');
  const known = Number(input.knownDistanceFt);
  const width = Number(input.pageWidth);
  const height = Number(input.pageHeight);
  if (!(known > 0) || !(width > 0) || !(height > 0)) throw new Error('Enter the known drawing distance in feet.');
  const distance = pdfDistance(input.points[0], input.points[1], width, height);
  if (!(distance > 0)) throw new Error('Calibration points must be different.');

  const { supabase, companyId } = await ctx();
  const { data: sheet } = await supabase.from('takeoff_sheets').select('id,takeoff_set_id').eq('id', input.sheetId).eq('company_id', companyId).maybeSingle();
  if (!sheet) throw new Error('Takeoff sheet not found.');
  await editableSet(supabase, companyId, sheet.takeoff_set_id);

  const calibration = {
    points: input.points,
    known_distance_ft: known,
    pdf_distance: distance,
    ft_per_pdf_unit: known / distance,
    calibrated_at: new Date().toISOString(),
  };
  const { error } = await supabase.rpc('carez_save_takeoff_sheet_calibration', {
    p_sheet_id: input.sheetId,
    p_page_width: width,
    p_page_height: height,
    p_calibration: calibration,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/takeoff/${sheet.takeoff_set_id}`);
  return calibration;
}

export async function createDrawingMeasurement(input: DrawingInput) {
  if (!input?.takeoffSetId || !input.sheetId || !input.assemblyVersionId || !String(input.name || '').trim()) throw new Error('Assembly and object name are required.');
  const { supabase, companyId } = await ctx();
  const set = await editableSet(supabase, companyId, input.takeoffSetId);
  const { data: sheet } = await supabase.from('takeoff_sheets').select('id,page_number,sheet_number,title,page_width,page_height,scale_status,calibration').eq('id', input.sheetId).eq('takeoff_set_id', input.takeoffSetId).eq('company_id', companyId).maybeSingle();
  if (!sheet) throw new Error('Takeoff sheet not found.');

  const { data: version } = await supabase.from('concrete_assembly_versions').select('id,default_risk_class_code,concrete_assemblies(primary_measurement)').eq('id', input.assemblyVersionId).eq('company_id', companyId).eq('status', 'published').maybeSingle();
  if (!version) throw new Error('Published concrete assembly not found.');
  const assembly: any = Array.isArray((version as any).concrete_assemblies) ? (version as any).concrete_assemblies[0] : (version as any).concrete_assemblies;
  const primaryUnit = String(assembly?.primary_measurement || '');
  const expectedType = primaryUnit === 'SF' ? 'polygon' : primaryUnit === 'EA' ? 'count' : primaryUnit === 'LF' ? 'polyline' : null;
  if (!expectedType) throw new Error(`${primaryUnit || 'This assembly'} is not supported by the drawing workspace yet.`);
  if (input.geometry.type !== expectedType) throw new Error(`This assembly must be measured as ${primaryUnit}.`);
  if (input.geometry.type !== 'count' && sheet.scale_status !== 'calibrated') throw new Error('Calibrate this sheet before measuring length or area.');

  const measured = measureDrawingGeometry(input.geometry, Number(sheet.page_width || 0), Number(sheet.page_height || 0), sheet.calibration);
  if (measured.unit !== primaryUnit) throw new Error(`Drawing produced ${measured.unit}; assembly requires ${primaryUnit}.`);
  const values: Record<string, number | string | null | undefined> = { ...(input.variables || {}) };
  if (primaryUnit === 'SF' && measured.perimeterLf > 0) values.perimeter_lf = roundMeasurement(measured.perimeterLf, 3);

  const engine = await prepareAssemblyOutputs({
    supabase,
    companyId,
    assemblyVersionId: input.assemblyVersionId,
    rawQuantity: roundMeasurement(measured.quantity, 4),
    inputs: values,
    riskClassCode: input.riskClassCode || version.default_risk_class_code || null,
  });

  if (input.estimateSectionId) {
    const { count } = await supabase.from('estimate_sections').select('id', { count: 'exact', head: true }).eq('id', input.estimateSectionId).eq('estimate_id', set.estimate_id).eq('company_id', companyId);
    if ((count || 0) !== 1) throw new Error('Estimate scope area does not belong to this estimate.');
  }

  const reference = String(input.drawingReference || '').trim() || `${sheet.sheet_number || `Page ${sheet.page_number}`}${sheet.title ? ` — ${sheet.title}` : ''}`;
  const geometry = {
    type: input.geometry.type,
    points: input.geometry.points.map(p => ({ x: Number(p.x.toFixed(7)), y: Number(p.y.toFixed(7)) })),
    source_page: sheet.page_number,
    measured_quantity: roundMeasurement(measured.quantity, 4),
    measured_unit: measured.unit,
    perimeter_lf: roundMeasurement(measured.perimeterLf, 4),
  };

  const { data, error } = await supabase.rpc('carez_commit_drawing_measurement', {
    p_takeoff_set_id: input.takeoffSetId,
    p_sheet_id: input.sheetId,
    p_estimate_section_id: input.estimateSectionId || null,
    p_assembly_version_id: input.assemblyVersionId,
    p_name: String(input.name).trim(),
    p_location: String(input.location || '').trim(),
    p_drawing_reference: reference,
    p_measurement_type: primaryUnit === 'SF' ? 'area' : primaryUnit === 'EA' ? 'count' : 'linear',
    p_raw_quantity: roundMeasurement(measured.quantity, 4),
    p_raw_unit: primaryUnit,
    p_variables: engine.values,
    p_risk_class_code: engine.riskClassCode || '',
    p_geometry: geometry,
    p_outputs: engine.prepared,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/takeoff/${input.takeoffSetId}`);
  revalidatePath('/takeoff');
  revalidatePath('/estimates');
  return { id: data as string, quantity: roundMeasurement(measured.quantity), unit: primaryUnit, perimeterLf: roundMeasurement(measured.perimeterLf) };
}

export async function deleteDrawingMeasurement(measurementId: string, setId: string) {
  if (!measurementId || !setId) return;
  const { supabase, companyId } = await ctx();
  await editableSet(supabase, companyId, setId);
  const { count } = await supabase.from('takeoff_measurements').select('id', { count: 'exact', head: true }).eq('id', measurementId).eq('takeoff_set_id', setId).eq('company_id', companyId);
  if ((count || 0) !== 1) throw new Error('Takeoff measurement not found.');
  const { error } = await supabase.rpc('carez_delete_takeoff_measurement', { p_measurement_id: measurementId });
  if (error) throw new Error(error.message);
  revalidatePath(`/takeoff/${setId}`);
  revalidatePath('/takeoff');
  revalidatePath('/estimates');
}
