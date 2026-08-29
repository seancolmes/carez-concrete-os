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
type GeometryUpdateInput = { measurementId: string; takeoffSetId: string; geometry: DrawingGeometry };
type AssemblyInputUpdate = {
  measurementId: string;
  takeoffSetId: string;
  variables: Record<string, number | string | null | undefined>;
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

const roundedPoints = (points: NormalizedPoint[]) => points.map(point => ({
  x: Number(point.x.toFixed(7)),
  y: Number(point.y.toFixed(7)),
}));

const cleanDrawingGeometry = (geometry: DrawingGeometry): DrawingGeometry => ({
  type: geometry.type,
  points: roundedPoints(geometry.points),
  ...(geometry.type === 'polygon' && geometry.holes?.length
    ? { holes: geometry.holes.map(roundedPoints) }
    : {}),
});

const drawingGeometryFromStored = (raw: any): DrawingGeometry => {
  if (!raw || !['polyline', 'polygon', 'count'].includes(raw.type) || !Array.isArray(raw.points) || !raw.points.length) {
    throw new Error('Drawing geometry is missing.');
  }
  const points = raw.points.map((point: any) => ({ x: Number(point.x), y: Number(point.y) }));
  const holes = raw.type === 'polygon' && Array.isArray(raw.holes)
    ? raw.holes.map((hole: any[]) => hole.map((point: any) => ({ x: Number(point.x), y: Number(point.y) })))
    : undefined;
  return cleanDrawingGeometry({ type: raw.type, points, ...(holes?.length ? { holes } : {}) } as DrawingGeometry);
};

const storedGeometry = (geometry: DrawingGeometry, pageNumber: number, measured: ReturnType<typeof measureDrawingGeometry>) => ({
  ...cleanDrawingGeometry(geometry),
  source_page: pageNumber,
  measured_quantity: roundMeasurement(measured.quantity, 4),
  measured_unit: measured.unit,
  perimeter_lf: roundMeasurement(measured.perimeterLf, 4),
  ...(measured.grossQuantity !== undefined ? { gross_quantity: roundMeasurement(measured.grossQuantity, 4) } : {}),
  ...(measured.cutoutQuantity !== undefined ? { cutout_quantity: roundMeasurement(measured.cutoutQuantity, 4) } : {}),
  ...(measured.cutoutPerimeterLf !== undefined ? { cutout_perimeter_lf: roundMeasurement(measured.cutoutPerimeterLf, 4) } : {}),
});

const refreshTakeoff = (setId: string) => {
  revalidatePath(`/takeoff/${setId}`);
  revalidatePath('/takeoff');
  revalidatePath('/takeoff/plans');
  revalidatePath('/estimates');
};

const inputHoldCount = (prepared: any[]) => prepared.filter(output => output.pricing_status === 'missing_input').length;

export async function attachPlanToTakeoffSet(fd: FormData) {
  const setId = String(fd.get('takeoff_set_id') || '');
  const storagePath = String(fd.get('storage_path') || '').trim();
  const filename = String(fd.get('source_filename') || '').trim();
  const mimeType = String(fd.get('mime_type') || '').trim() || 'application/pdf';
  if (!setId || !storagePath || !filename) throw new Error('PDF plan file is required.');
  if (mimeType !== 'application/pdf' && !filename.toLowerCase().endsWith('.pdf')) throw new Error('The drawing workspace currently requires a PDF plan set.');

  const { supabase, companyId } = await ctx();
  await editableSet(supabase, companyId, setId);
  const { error } = await supabase.rpc('carez_attach_takeoff_plan', {
    p_takeoff_set_id: setId,
    p_storage_path: storagePath,
    p_source_filename: filename,
    p_mime_type: mimeType,
  });
  if (error) throw new Error(error.message);
  refreshTakeoff(setId);
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

  const cleanGeometry = cleanDrawingGeometry(input.geometry);
  const measured = measureDrawingGeometry(cleanGeometry, Number(sheet.page_width || 0), Number(sheet.page_height || 0), sheet.calibration);
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
  const geometry = storedGeometry(cleanGeometry, Number(sheet.page_number), measured);

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
  refreshTakeoff(input.takeoffSetId);
  return {
    id: data as string,
    quantity: roundMeasurement(measured.quantity),
    unit: primaryUnit,
    perimeterLf: roundMeasurement(measured.perimeterLf),
    cutoutQuantity: roundMeasurement(measured.cutoutQuantity || 0),
    inputHolds: inputHoldCount(engine.prepared),
  };
}

export async function updateDrawingMeasurementGeometry(input: GeometryUpdateInput) {
  if (!input?.measurementId || !input.takeoffSetId) throw new Error('Takeoff measurement is required.');
  const { supabase, companyId } = await ctx();
  await editableSet(supabase, companyId, input.takeoffSetId);
  const { data: measurement } = await supabase.from('takeoff_measurements')
    .select('id,takeoff_set_id,sheet_id,assembly_version_id,variables,risk_class_code')
    .eq('id', input.measurementId)
    .eq('takeoff_set_id', input.takeoffSetId)
    .eq('company_id', companyId)
    .maybeSingle();
  if (!measurement?.sheet_id) throw new Error('Drawing takeoff measurement not found.');

  const [{ data: sheet }, { data: version }] = await Promise.all([
    supabase.from('takeoff_sheets')
      .select('id,page_number,page_width,page_height,scale_status,calibration')
      .eq('id', measurement.sheet_id)
      .eq('company_id', companyId)
      .maybeSingle(),
    supabase.from('concrete_assembly_versions')
      .select('id,default_risk_class_code,concrete_assemblies(primary_measurement)')
      .eq('id', measurement.assembly_version_id)
      .eq('company_id', companyId)
      .eq('status', 'published')
      .maybeSingle(),
  ]);
  if (!sheet) throw new Error('Takeoff sheet not found.');
  if (!version) throw new Error('Published concrete assembly not found.');

  const assembly: any = Array.isArray((version as any).concrete_assemblies)
    ? (version as any).concrete_assemblies[0]
    : (version as any).concrete_assemblies;
  const primaryUnit = String(assembly?.primary_measurement || '');
  const expectedType = primaryUnit === 'SF' ? 'polygon' : primaryUnit === 'EA' ? 'count' : primaryUnit === 'LF' ? 'polyline' : null;
  if (!expectedType || input.geometry.type !== expectedType) throw new Error(`This assembly must remain a ${primaryUnit} takeoff.`);
  if (input.geometry.type !== 'count' && sheet.scale_status !== 'calibrated') throw new Error('Calibrate this sheet before editing length or area.');

  const cleanGeometry = cleanDrawingGeometry(input.geometry);
  const measured = measureDrawingGeometry(cleanGeometry, Number(sheet.page_width || 0), Number(sheet.page_height || 0), sheet.calibration);
  const values: Record<string, number | string | null | undefined> = { ...((measurement.variables as any) || {}) };
  if (primaryUnit === 'SF') values.perimeter_lf = roundMeasurement(measured.perimeterLf, 3);
  const engine = await prepareAssemblyOutputs({
    supabase,
    companyId,
    assemblyVersionId: measurement.assembly_version_id,
    rawQuantity: roundMeasurement(measured.quantity, 4),
    inputs: values,
    riskClassCode: measurement.risk_class_code || version.default_risk_class_code || null,
  });

  const { error } = await supabase.rpc('carez_update_drawing_measurement', {
    p_measurement_id: measurement.id,
    p_geometry: storedGeometry(cleanGeometry, Number(sheet.page_number), measured),
    p_raw_quantity: roundMeasurement(measured.quantity, 4),
    p_raw_unit: primaryUnit,
    p_variables: engine.values,
    p_outputs: engine.prepared,
  });
  if (error) throw new Error(error.message);
  refreshTakeoff(input.takeoffSetId);
  return {
    id: measurement.id,
    quantity: roundMeasurement(measured.quantity),
    unit: primaryUnit,
    perimeterLf: roundMeasurement(measured.perimeterLf),
    cutoutQuantity: roundMeasurement(measured.cutoutQuantity || 0),
    inputHolds: inputHoldCount(engine.prepared),
  };
}

export async function updateDrawingMeasurementInputs(input: AssemblyInputUpdate) {
  if (!input?.measurementId || !input.takeoffSetId || !input.variables) throw new Error('Takeoff measurement inputs are required.');
  const { supabase, companyId } = await ctx();
  await editableSet(supabase, companyId, input.takeoffSetId);
  const { data: measurement } = await supabase.from('takeoff_measurements')
    .select('id,takeoff_set_id,sheet_id,assembly_version_id,geometry,risk_class_code')
    .eq('id', input.measurementId)
    .eq('takeoff_set_id', input.takeoffSetId)
    .eq('company_id', companyId)
    .maybeSingle();
  if (!measurement?.sheet_id || !measurement.geometry) throw new Error('Drawing takeoff measurement not found.');

  const [{ data: sheet }, { data: version }] = await Promise.all([
    supabase.from('takeoff_sheets')
      .select('id,page_number,page_width,page_height,scale_status,calibration')
      .eq('id', measurement.sheet_id)
      .eq('company_id', companyId)
      .maybeSingle(),
    supabase.from('concrete_assembly_versions')
      .select('id,default_risk_class_code,concrete_assemblies(primary_measurement)')
      .eq('id', measurement.assembly_version_id)
      .eq('company_id', companyId)
      .eq('status', 'published')
      .maybeSingle(),
  ]);
  if (!sheet) throw new Error('Takeoff sheet not found.');
  if (!version) throw new Error('Published concrete assembly not found.');

  const assembly: any = Array.isArray((version as any).concrete_assemblies)
    ? (version as any).concrete_assemblies[0]
    : (version as any).concrete_assemblies;
  const primaryUnit = String(assembly?.primary_measurement || '');
  const expectedType = primaryUnit === 'SF' ? 'polygon' : primaryUnit === 'EA' ? 'count' : primaryUnit === 'LF' ? 'polyline' : null;
  const cleanGeometry = drawingGeometryFromStored(measurement.geometry);
  if (!expectedType || cleanGeometry.type !== expectedType) throw new Error(`This assembly must remain a ${primaryUnit} takeoff.`);
  if (cleanGeometry.type !== 'count' && sheet.scale_status !== 'calibrated') throw new Error('Calibrate this sheet before recalculating length or area.');

  const measured = measureDrawingGeometry(cleanGeometry, Number(sheet.page_width || 0), Number(sheet.page_height || 0), sheet.calibration);
  const values: Record<string, number | string | null | undefined> = { ...input.variables };
  if (primaryUnit === 'SF' && measured.perimeterLf > 0) values.perimeter_lf = roundMeasurement(measured.perimeterLf, 3);
  const engine = await prepareAssemblyOutputs({
    supabase,
    companyId,
    assemblyVersionId: measurement.assembly_version_id,
    rawQuantity: roundMeasurement(measured.quantity, 4),
    inputs: values,
    riskClassCode: measurement.risk_class_code || version.default_risk_class_code || null,
  });

  const { error } = await supabase.rpc('carez_update_drawing_measurement', {
    p_measurement_id: measurement.id,
    p_geometry: storedGeometry(cleanGeometry, Number(sheet.page_number), measured),
    p_raw_quantity: roundMeasurement(measured.quantity, 4),
    p_raw_unit: primaryUnit,
    p_variables: engine.values,
    p_outputs: engine.prepared,
  });
  if (error) throw new Error(error.message);
  refreshTakeoff(input.takeoffSetId);
  return {
    id: measurement.id,
    quantity: roundMeasurement(measured.quantity),
    unit: primaryUnit,
    inputHolds: inputHoldCount(engine.prepared),
  };
}

export async function duplicateDrawingMeasurement(measurementId: string, setId: string) {
  if (!measurementId || !setId) throw new Error('Takeoff measurement is required.');
  const { supabase, companyId } = await ctx();
  await editableSet(supabase, companyId, setId);
  const { data: measurement } = await supabase.from('takeoff_measurements')
    .select('id,takeoff_set_id,sheet_id,estimate_section_id,assembly_version_id,name,location,drawing_reference,risk_class_code,variables,geometry')
    .eq('id', measurementId)
    .eq('takeoff_set_id', setId)
    .eq('company_id', companyId)
    .maybeSingle();
  if (!measurement?.sheet_id || !measurement.geometry) throw new Error('Drawing takeoff measurement not found.');

  const raw = measurement.geometry as any;
  const points = Array.isArray(raw.points) ? raw.points.map((point: any) => ({ x: Number(point.x), y: Number(point.y) })) : [];
  const holes = Array.isArray(raw.holes)
    ? raw.holes.map((hole: any[]) => hole.map((point: any) => ({ x: Number(point.x), y: Number(point.y) })))
    : undefined;
  const allPoints = [...points, ...(holes || []).flat()];
  if (!allPoints.length) throw new Error('Drawing geometry is missing.');
  const minX = Math.min(...allPoints.map(point => point.x));
  const maxX = Math.max(...allPoints.map(point => point.x));
  const minY = Math.min(...allPoints.map(point => point.y));
  const maxY = Math.max(...allPoints.map(point => point.y));
  const dx = maxX <= .975 ? .015 : minX >= .025 ? -.015 : 0;
  const dy = maxY <= .975 ? .015 : minY >= .025 ? -.015 : 0;
  const shift = (point: NormalizedPoint) => ({
    x: Math.max(0, Math.min(1, point.x + dx)),
    y: Math.max(0, Math.min(1, point.y + dy)),
  });
  const geometry: DrawingGeometry = {
    type: raw.type,
    points: points.map(shift),
    ...(holes?.length ? { holes: holes.map((hole: NormalizedPoint[]) => hole.map(shift)) } : {}),
  };
  const variables = { ...((measurement.variables as any) || {}) };
  delete variables.perimeter_lf;

  return createDrawingMeasurement({
    takeoffSetId: setId,
    sheetId: measurement.sheet_id,
    estimateSectionId: measurement.estimate_section_id,
    assemblyVersionId: measurement.assembly_version_id,
    name: `${measurement.name} Copy`,
    location: measurement.location,
    drawingReference: measurement.drawing_reference,
    riskClassCode: measurement.risk_class_code,
    variables,
    geometry,
  });
}

export async function deleteDrawingMeasurement(measurementId: string, setId: string) {
  if (!measurementId || !setId) return;
  const { supabase, companyId } = await ctx();
  await editableSet(supabase, companyId, setId);
  const { count } = await supabase.from('takeoff_measurements').select('id', { count: 'exact', head: true }).eq('id', measurementId).eq('takeoff_set_id', setId).eq('company_id', companyId);
  if ((count || 0) !== 1) throw new Error('Takeoff measurement not found.');
  const { error } = await supabase.rpc('carez_delete_takeoff_measurement', { p_measurement_id: measurementId });
  if (error) throw new Error(error.message);
  refreshTakeoff(setId);
}
