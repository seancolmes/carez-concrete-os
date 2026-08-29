export type NormalizedPoint = { x: number; y: number };

export type DrawingGeometry = {
  type: 'polyline' | 'polygon' | 'count';
  points: NormalizedPoint[];
};

export interface LineTakeoffSegment {
  type: 'Line';
  start: NormalizedPoint;
  end: NormalizedPoint;
}

export interface ArcTakeoffSegment {
  type: 'Arc';
  start: NormalizedPoint;
  end: NormalizedPoint;
  center: NormalizedPoint;
  /** Clockwise is interpreted visually on the PDF page, where Y increases downward. */
  clockwise: boolean;
}

export type TakeoffSegment = LineTakeoffSegment | ArcTakeoffSegment;

export interface TakeoffPath {
  id?: string;
  name?: string;
  closed: boolean;
  segments: TakeoffSegment[];
}

const TAU = Math.PI * 2;
const POINT_TOLERANCE = 1e-7;
const MAX_PATH_SEGMENTS = 4000;
const DEFAULT_ARC_STEP_DEGREES = 2;

const finite = (value: unknown) => Number.isFinite(Number(value));

function assertPageDimensions(pageWidth: number, pageHeight: number) {
  if (!(pageWidth > 0) || !(pageHeight > 0)) throw new Error('PDF page dimensions are missing.');
}

function validateNormalizedPoint(point: NormalizedPoint, label: string, allowOutsidePage = false) {
  if (!point || !finite(point.x) || !finite(point.y)) throw new Error(`${label} is invalid.`);
  if (!allowOutsidePage && (point.x < -0.001 || point.x > 1.001 || point.y < -0.001 || point.y > 1.001)) {
    throw new Error(`${label} is outside the PDF page.`);
  }
}

function pointsEqual(a: NormalizedPoint, b: NormalizedPoint, tolerance = POINT_TOLERANCE) {
  return Math.abs(a.x - b.x) <= tolerance && Math.abs(a.y - b.y) <= tolerance;
}

export function validateDrawingGeometry(geometry: DrawingGeometry) {
  if (!geometry || !['polyline', 'polygon', 'count'].includes(geometry.type)) throw new Error('Unsupported drawing geometry.');
  if (!Array.isArray(geometry.points)) throw new Error('Drawing points are missing.');
  const minimum = geometry.type === 'polygon' ? 3 : geometry.type === 'polyline' ? 2 : 1;
  if (geometry.points.length < minimum) throw new Error(`${geometry.type} requires at least ${minimum} point${minimum === 1 ? '' : 's'}.`);
  if (geometry.points.length > 2000) throw new Error('Drawing contains too many points.');
  for (const point of geometry.points) validateNormalizedPoint(point, 'Drawing point');
}

export function validateTakeoffPath(path: TakeoffPath) {
  if (!path || !Array.isArray(path.segments) || path.segments.length === 0) throw new Error('Takeoff path segments are missing.');
  if (path.segments.length > MAX_PATH_SEGMENTS) throw new Error('Takeoff path contains too many segments.');

  path.segments.forEach((segment, index) => {
    if (!segment || !['Line', 'Arc'].includes(segment.type)) throw new Error(`Takeoff segment ${index + 1} is unsupported.`);
    validateNormalizedPoint(segment.start, `Takeoff segment ${index + 1} start`);
    validateNormalizedPoint(segment.end, `Takeoff segment ${index + 1} end`);
    if (segment.type === 'Arc') validateNormalizedPoint(segment.center, `Takeoff segment ${index + 1} center`, true);

    if (index > 0) {
      const previous = path.segments[index - 1];
      if (!pointsEqual(previous.end, segment.start, 0.001)) throw new Error(`Takeoff path has a gap before segment ${index + 1}.`);
    }
  });
}

function pdfPoint(point: NormalizedPoint, pageWidth: number, pageHeight: number) {
  return { x: point.x * pageWidth, y: point.y * pageHeight };
}

/**
 * Converts PDF screen coordinates to a Cartesian plane so signed area follows
 * the conventional rule: counter-clockwise paths are positive.
 */
function cartesianPdfPoint(point: NormalizedPoint, pageWidth: number, pageHeight: number) {
  return { x: point.x * pageWidth, y: pageHeight - point.y * pageHeight };
}

export function pdfDistance(a: NormalizedPoint, b: NormalizedPoint, pageWidth: number, pageHeight: number) {
  assertPageDimensions(pageWidth, pageHeight);
  const first = pdfPoint(a, pageWidth, pageHeight);
  const second = pdfPoint(b, pageWidth, pageHeight);
  return Math.hypot(second.x - first.x, second.y - first.y);
}

export function polylinePdfLength(points: NormalizedPoint[], pageWidth: number, pageHeight: number, closed = false) {
  assertPageDimensions(pageWidth, pageHeight);
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += pdfDistance(points[index - 1], points[index], pageWidth, pageHeight);
  }
  if (closed && points.length > 2) total += pdfDistance(points[points.length - 1], points[0], pageWidth, pageHeight);
  return total;
}

/** Signed shoelace area in PDF square units. Counter-clockwise is positive. */
export function signedPolygonPdfArea(points: NormalizedPoint[], pageWidth: number, pageHeight: number) {
  assertPageDimensions(pageWidth, pageHeight);
  if (points.length < 3) return 0;

  let twiceArea = 0;
  for (let index = 0; index < points.length; index += 1) {
    const first = cartesianPdfPoint(points[index], pageWidth, pageHeight);
    const second = cartesianPdfPoint(points[(index + 1) % points.length], pageWidth, pageHeight);
    twiceArea += first.x * second.y - second.x * first.y;
  }
  return twiceArea / 2;
}

export function polygonPdfArea(points: NormalizedPoint[], pageWidth: number, pageHeight: number) {
  return Math.abs(signedPolygonPdfArea(points, pageWidth, pageHeight));
}

function directedArcSweep(segment: ArcTakeoffSegment, pageWidth: number, pageHeight: number) {
  const start = pdfPoint(segment.start, pageWidth, pageHeight);
  const end = pdfPoint(segment.end, pageWidth, pageHeight);
  const center = pdfPoint(segment.center, pageWidth, pageHeight);
  const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
  const endAngle = Math.atan2(end.y - center.y, end.x - center.x);
  let sweep = endAngle - startAngle;

  // In PDF screen coordinates, positive angular movement is visually clockwise.
  if (segment.clockwise) {
    while (sweep <= 0) sweep += TAU;
  } else {
    while (sweep >= 0) sweep -= TAU;
  }

  if (Math.abs(sweep) < POINT_TOLERANCE) sweep = segment.clockwise ? TAU : -TAU;
  return { start, end, center, startAngle, sweep };
}

export function arcPdfLength(segment: ArcTakeoffSegment, pageWidth: number, pageHeight: number) {
  assertPageDimensions(pageWidth, pageHeight);
  const arc = directedArcSweep(segment, pageWidth, pageHeight);
  const startRadius = Math.hypot(arc.start.x - arc.center.x, arc.start.y - arc.center.y);
  const endRadius = Math.hypot(arc.end.x - arc.center.x, arc.end.y - arc.center.y);
  const radius = (startRadius + endRadius) / 2;
  if (!(radius > 0)) throw new Error('Arc radius must be greater than zero.');
  return radius * Math.abs(arc.sweep);
}

/**
 * Converts line and arc segments into a point ring. Arc segments are subdivided
 * into short chords so the same signed shoelace calculation can evaluate them.
 */
export function flattenTakeoffPath(
  path: TakeoffPath,
  pageWidth: number,
  pageHeight: number,
  arcStepDegrees = DEFAULT_ARC_STEP_DEGREES,
) {
  validateTakeoffPath(path);
  assertPageDimensions(pageWidth, pageHeight);
  if (!(arcStepDegrees > 0 && arcStepDegrees <= 45)) throw new Error('Arc resolution must be between 0 and 45 degrees.');

  const points: NormalizedPoint[] = [];
  const append = (point: NormalizedPoint) => {
    if (!points.length || !pointsEqual(points[points.length - 1], point)) points.push(point);
  };

  path.segments.forEach(segment => {
    append(segment.start);
    if (segment.type === 'Line') {
      append(segment.end);
      return;
    }

    const arc = directedArcSweep(segment, pageWidth, pageHeight);
    const startRadius = Math.hypot(arc.start.x - arc.center.x, arc.start.y - arc.center.y);
    const endRadius = Math.hypot(arc.end.x - arc.center.x, arc.end.y - arc.center.y);
    const radius = (startRadius + endRadius) / 2;
    if (!(radius > 0)) throw new Error('Arc radius must be greater than zero.');

    const stepRadians = arcStepDegrees * Math.PI / 180;
    const steps = Math.max(1, Math.ceil(Math.abs(arc.sweep) / stepRadians));
    for (let index = 1; index <= steps; index += 1) {
      if (index === steps) {
        append(segment.end);
        continue;
      }
      const angle = arc.startAngle + arc.sweep * (index / steps);
      append({
        x: (arc.center.x + radius * Math.cos(angle)) / pageWidth,
        y: (arc.center.y + radius * Math.sin(angle)) / pageHeight,
      });
    }
  });

  if (path.closed && points.length > 1 && pointsEqual(points[0], points[points.length - 1])) points.pop();
  return points;
}

export function takeoffPathPdfLength(path: TakeoffPath, pageWidth: number, pageHeight: number) {
  validateTakeoffPath(path);
  assertPageDimensions(pageWidth, pageHeight);

  let total = path.segments.reduce((sum, segment) => {
    if (segment.type === 'Line') return sum + pdfDistance(segment.start, segment.end, pageWidth, pageHeight);
    return sum + arcPdfLength(segment, pageWidth, pageHeight);
  }, 0);

  if (path.closed) {
    const first = path.segments[0].start;
    const last = path.segments[path.segments.length - 1].end;
    if (!pointsEqual(first, last)) total += pdfDistance(last, first, pageWidth, pageHeight);
  }
  return total;
}

export function calibrationScale(calibration: any) {
  const knownDistanceFt = Number(calibration?.known_distance_ft || 0);
  const pdfDistanceUnits = Number(calibration?.pdf_distance || 0);
  if (!(knownDistanceFt > 0) || !(pdfDistanceUnits > 0)) throw new Error('This drawing sheet is not calibrated.');
  return knownDistanceFt / pdfDistanceUnits;
}

/**
 * Calculates net slab SF from one or more closed paths.
 *
 * Rules:
 * - The largest closed path is treated as the main slab boundary regardless of
 *   the direction it was drawn.
 * - Additional counter-clockwise paths have positive signed shoelace area and
 *   are automatically subtracted as cutouts.
 * - Additional clockwise paths are treated as additive slab regions.
 * - Arc segments are chorded at two-degree increments before shoelace area is
 *   calculated, preserving the same orientation and cutout rules.
 */
export function calculateSlabArea(
  paths: TakeoffPath[],
  pageWidth: number,
  pageHeight: number,
  calibration: any,
) {
  assertPageDimensions(pageWidth, pageHeight);
  if (!Array.isArray(paths) || paths.length === 0) return 0;

  const feetPerPdfUnit = calibrationScale(calibration);
  const signedAreas = paths.map((path, index) => {
    if (!path.closed) throw new Error(`Slab path ${index + 1} must be closed.`);
    const points = flattenTakeoffPath(path, pageWidth, pageHeight);
    if (points.length < 3) throw new Error(`Slab path ${index + 1} requires at least three points.`);
    return signedPolygonPdfArea(points, pageWidth, pageHeight);
  });

  let mainIndex = 0;
  for (let index = 1; index < signedAreas.length; index += 1) {
    if (Math.abs(signedAreas[index]) > Math.abs(signedAreas[mainIndex])) mainIndex = index;
  }

  let netPdfArea = Math.abs(signedAreas[mainIndex]);
  signedAreas.forEach((signedArea, index) => {
    if (index === mainIndex) return;
    if (signedArea > 0) netPdfArea -= Math.abs(signedArea); // counter-clockwise cutout
    else netPdfArea += Math.abs(signedArea); // clockwise additive region
  });

  return Math.max(0, netPdfArea) * feetPerPdfUnit * feetPerPdfUnit;
}

export function measureDrawingGeometry(geometry: DrawingGeometry, pageWidth: number, pageHeight: number, calibration: any) {
  validateDrawingGeometry(geometry);
  assertPageDimensions(pageWidth, pageHeight);
  if (geometry.type === 'count') return { quantity: geometry.points.length, unit: 'EA', perimeterLf: 0 };

  const feetPerPdfUnit = calibrationScale(calibration);
  if (geometry.type === 'polyline') {
    return {
      quantity: polylinePdfLength(geometry.points, pageWidth, pageHeight) * feetPerPdfUnit,
      unit: 'LF',
      perimeterLf: 0,
    };
  }

  const area = polygonPdfArea(geometry.points, pageWidth, pageHeight) * feetPerPdfUnit * feetPerPdfUnit;
  const perimeter = polylinePdfLength(geometry.points, pageWidth, pageHeight, true) * feetPerPdfUnit;
  return { quantity: area, unit: 'SF', perimeterLf: perimeter };
}

export function roundMeasurement(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
