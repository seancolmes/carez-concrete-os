export type NormalizedPoint = { x: number; y: number };
export type DrawingGeometry = {
  type: 'polyline' | 'polygon' | 'count';
  points: NormalizedPoint[];
};

const finite = (n: unknown) => Number.isFinite(Number(n));

export function validateDrawingGeometry(geometry: DrawingGeometry) {
  if (!geometry || !['polyline', 'polygon', 'count'].includes(geometry.type)) throw new Error('Unsupported drawing geometry.');
  if (!Array.isArray(geometry.points)) throw new Error('Drawing points are missing.');
  const min = geometry.type === 'polygon' ? 3 : geometry.type === 'polyline' ? 2 : 1;
  if (geometry.points.length < min) throw new Error(`${geometry.type} requires at least ${min} point${min === 1 ? '' : 's'}.`);
  if (geometry.points.length > 2000) throw new Error('Drawing contains too many points.');
  for (const point of geometry.points) {
    if (!finite(point?.x) || !finite(point?.y)) throw new Error('Drawing point is invalid.');
    if (point.x < -0.001 || point.x > 1.001 || point.y < -0.001 || point.y > 1.001) throw new Error('Drawing point is outside the PDF page.');
  }
}

function pdfPoint(point: NormalizedPoint, pageWidth: number, pageHeight: number) {
  return { x: point.x * pageWidth, y: point.y * pageHeight };
}

export function pdfDistance(a: NormalizedPoint, b: NormalizedPoint, pageWidth: number, pageHeight: number) {
  const p1 = pdfPoint(a, pageWidth, pageHeight);
  const p2 = pdfPoint(b, pageWidth, pageHeight);
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

export function polylinePdfLength(points: NormalizedPoint[], pageWidth: number, pageHeight: number, closed = false) {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += pdfDistance(points[i - 1], points[i], pageWidth, pageHeight);
  if (closed && points.length > 2) total += pdfDistance(points[points.length - 1], points[0], pageWidth, pageHeight);
  return total;
}

export function polygonPdfArea(points: NormalizedPoint[], pageWidth: number, pageHeight: number) {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = pdfPoint(points[i], pageWidth, pageHeight);
    const b = pdfPoint(points[(i + 1) % points.length], pageWidth, pageHeight);
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

export function calibrationScale(calibration: any) {
  const known = Number(calibration?.known_distance_ft || 0);
  const pdf = Number(calibration?.pdf_distance || 0);
  if (!(known > 0) || !(pdf > 0)) throw new Error('This drawing sheet is not calibrated.');
  return known / pdf;
}

export function measureDrawingGeometry(geometry: DrawingGeometry, pageWidth: number, pageHeight: number, calibration: any) {
  validateDrawingGeometry(geometry);
  if (!(pageWidth > 0) || !(pageHeight > 0)) throw new Error('PDF page dimensions are missing.');
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
