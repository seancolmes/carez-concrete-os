import type { DrawingGeometry, NormalizedPoint } from './geometry';

export type ScaleRegionBounds = { x: number; y: number; width: number; height: number };
export type ScaleKind = 'architectural' | 'engineering' | 'metric' | 'manual' | 'nts';
export type ScaleSourceType = 'pdf_text' | 'manual' | 'legacy';

export type ScaleCalibration = {
  ft_per_pdf_unit: number;
  method: 'pdf_text' | 'manual' | 'legacy';
  scale_label: string;
  source_text?: string | null;
  source_bounds?: ScaleRegionBounds | null;
  confidence?: number | null;
  known_distance_ft?: number;
  pdf_distance?: number;
  points?: NormalizedPoint[];
  accepted_at?: string;
};

export type TakeoffScaleRegion = {
  id: string;
  sheet_id: string;
  takeoff_set_id?: string;
  name: string;
  region_bounds: ScaleRegionBounds | null;
  scale_label: string;
  scale_kind: ScaleKind;
  source_type: ScaleSourceType;
  source_text?: string | null;
  source_bounds?: ScaleRegionBounds | null;
  confidence?: number | null;
  calibration: ScaleCalibration;
  is_default: boolean;
};

export type ScaleCandidate = {
  id: string;
  label: string;
  scaleKind: ScaleKind;
  sourceText: string;
  sourceBounds: ScaleRegionBounds | null;
  confidence: number;
  feetPerPdfUnit: number | null;
  usable: boolean;
};

export type PdfTextItemLike = {
  str?: unknown;
  transform?: unknown;
  width?: unknown;
  height?: unknown;
};

const FRACTIONS: Record<string, string> = {
  '¼': '1/4', '½': '1/2', '¾': '3/4', '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8',
};

const finite = (value: unknown) => Number.isFinite(Number(value));
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export function normalizeScaleText(value: unknown) {
  return String(value || '')
    .replace(/[¼½¾⅛⅜⅝⅞]/g, match => ` ${FRACTIONS[match]} `)
    .replace(/[“”″]/g, '"')
    .replace(/[‘’′]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function mixedNumber(value: string) {
  const normalized = normalizeScaleText(value);
  if (!normalized) return 0;
  const parts = normalized.split(' ').filter(Boolean);
  let total = 0;
  for (const part of parts) {
    if (part.includes('/')) {
      const [numerator, denominator] = part.split('/').map(Number);
      if (!(denominator > 0)) return NaN;
      total += numerator / denominator;
    } else {
      total += Number(part);
    }
  }
  return total;
}

function decimalFraction(value: number, maxDenominator = 64) {
  if (!Number.isFinite(value)) return '';
  const whole = Math.floor(value);
  const fraction = value - whole;
  if (fraction < 1e-9) return String(whole);
  let bestNumerator = 0;
  let bestDenominator = 1;
  let bestError = Infinity;
  for (let denominator = 2; denominator <= maxDenominator; denominator += 1) {
    const numerator = Math.round(fraction * denominator);
    const error = Math.abs(fraction - numerator / denominator);
    if (error < bestError) {
      bestError = error;
      bestNumerator = numerator;
      bestDenominator = denominator;
    }
  }
  const divisor = (() => {
    let a = bestNumerator;
    let b = bestDenominator;
    while (b) [a, b] = [b, a % b];
    return a || 1;
  })();
  const fractionText = `${bestNumerator / divisor}/${bestDenominator / divisor}`;
  return whole ? `${whole} ${fractionText}` : fractionText;
}

export function parseScaleNotation(rawText: unknown): Omit<ScaleCandidate, 'id' | 'sourceBounds'> | null {
  const sourceText = normalizeScaleText(rawText);
  if (!sourceText) return null;

  const nts = /\b(?:N\.?T\.?S\.?|NOT\s+TO\s+SCALE)\b/i.test(sourceText);
  if (nts && /\bSCALE\b/i.test(sourceText)) {
    return {
      label: 'NTS',
      scaleKind: 'nts',
      sourceText,
      confidence: 0.99,
      feetPerPdfUnit: null,
      usable: false,
    };
  }

  const imperial = sourceText.match(/(?:\bSCALE\b\s*:?\s*)?((?:\d+\s+)?(?:\d+\/\d+|\d+(?:\.\d+)?))\s*(?:\"|IN(?:CH(?:ES)?)?)\s*(?:=|:)\s*(\d+(?:\.\d+)?)\s*(?:'|FT|FEET)(?:\s*-?\s*((?:\d+\s+)?(?:\d+\/\d+|\d+(?:\.\d+)?))\s*(?:\"|IN(?:CH(?:ES)?)?))?/i);
  if (imperial) {
    const paperInches = mixedNumber(imperial[1]);
    const realFeet = Number(imperial[2]);
    const realInches = imperial[3] ? mixedNumber(imperial[3]) : 0;
    const actualFeet = realFeet + realInches / 12;
    if (paperInches > 0 && actualFeet > 0) {
      const paperLabel = decimalFraction(paperInches);
      const rightInches = decimalFraction(realInches);
      const label = `${paperLabel}\" = ${realFeet}'-${rightInches}\"`;
      return {
        label,
        scaleKind: paperInches === 1 && actualFeet > 1 ? 'engineering' : 'architectural',
        sourceText,
        confidence: /\bSCALE\b/i.test(sourceText) ? 0.99 : 0.92,
        feetPerPdfUnit: actualFeet / (paperInches * 72),
        usable: true,
      };
    }
  }

  const ratio = sourceText.match(/(?:\bSCALE\b\s*:?\s*)?\b1\s*:\s*(\d{2,5})\b/i);
  if (ratio && (/\bSCALE\b/i.test(sourceText) || /^1\s*:\s*\d{2,5}$/i.test(sourceText))) {
    const denominator = Number(ratio[1]);
    if (denominator > 1) {
      return {
        label: `1:${denominator}`,
        scaleKind: 'metric',
        sourceText,
        confidence: /\bSCALE\b/i.test(sourceText) ? 0.98 : 0.82,
        feetPerPdfUnit: denominator / (72 * 12),
        usable: true,
      };
    }
  }

  return null;
}

function textItemBounds(item: PdfTextItemLike, pageWidth: number, pageHeight: number): ScaleRegionBounds | null {
  if (!Array.isArray(item.transform) || item.transform.length < 6 || !finite(item.transform[4]) || !finite(item.transform[5])) return null;
  const transform = item.transform.map(Number);
  const width = Math.abs(Number(item.width || 0));
  const height = Math.max(Math.abs(Number(item.height || 0)), Math.hypot(transform[2], transform[3]), 1);
  const x = transform[4];
  const baseline = transform[5];
  return {
    x: clamp01(x / pageWidth),
    y: clamp01(1 - (baseline + height) / pageHeight),
    width: clamp01(width / pageWidth),
    height: clamp01(height / pageHeight),
  };
}

function unionBounds(bounds: ScaleRegionBounds[]): ScaleRegionBounds | null {
  if (!bounds.length) return null;
  const x1 = Math.min(...bounds.map(bound => bound.x));
  const y1 = Math.min(...bounds.map(bound => bound.y));
  const x2 = Math.max(...bounds.map(bound => bound.x + bound.width));
  const y2 = Math.max(...bounds.map(bound => bound.y + bound.height));
  return { x: clamp01(x1), y: clamp01(y1), width: clamp01(x2 - x1), height: clamp01(y2 - y1) };
}

export function detectScaleCandidates(items: PdfTextItemLike[], pageWidth: number, pageHeight: number, pageNumber = 1) {
  if (!(pageWidth > 0) || !(pageHeight > 0)) return [] as ScaleCandidate[];
  const entries = (Array.isArray(items) ? items : [])
    .map((item, index) => {
      const text = normalizeScaleText(item?.str);
      const bounds = textItemBounds(item, pageWidth, pageHeight);
      return text && bounds ? { index, text, bounds, baseline: bounds.y + bounds.height } : null;
    })
    .filter(Boolean) as { index: number; text: string; bounds: ScaleRegionBounds; baseline: number }[];

  const groups: typeof entries[] = [];
  for (const entry of entries.sort((a, b) => a.baseline - b.baseline || a.bounds.x - b.bounds.x)) {
    const tolerance = Math.max(entry.bounds.height * 0.9, 0.0035);
    const group = groups.find(candidate => Math.abs(candidate[0].baseline - entry.baseline) <= tolerance);
    if (group) group.push(entry);
    else groups.push([entry]);
  }

  const sources = [
    ...entries.map(entry => ({ text: entry.text, bounds: entry.bounds })),
    ...groups.map(group => {
      const ordered = [...group].sort((a, b) => a.bounds.x - b.bounds.x);
      return { text: ordered.map(entry => entry.text).join(' '), bounds: unionBounds(ordered.map(entry => entry.bounds)) };
    }),
  ];

  const candidates: ScaleCandidate[] = [];
  for (const source of sources) {
    const parsed = parseScaleNotation(source.text);
    if (!parsed) continue;
    const key = `${parsed.label}|${Math.round((source.bounds?.x || 0) * 1000)}|${Math.round((source.bounds?.y || 0) * 1000)}`;
    if (candidates.some(candidate => `${candidate.label}|${Math.round((candidate.sourceBounds?.x || 0) * 1000)}|${Math.round((candidate.sourceBounds?.y || 0) * 1000)}` === key)) continue;
    candidates.push({
      ...parsed,
      id: `scale-${pageNumber}-${candidates.length + 1}`,
      sourceBounds: source.bounds,
    });
  }

  return candidates.sort((a, b) => Number(b.usable) - Number(a.usable) || b.confidence - a.confidence);
}

export function boundsFromPoints(points: NormalizedPoint[]): ScaleRegionBounds | null {
  if (!Array.isArray(points) || points.length !== 2) return null;
  const x = Math.min(points[0].x, points[1].x);
  const y = Math.min(points[0].y, points[1].y);
  const width = Math.abs(points[1].x - points[0].x);
  const height = Math.abs(points[1].y - points[0].y);
  if (!(width > 0.002 && height > 0.002)) return null;
  return { x: clamp01(x), y: clamp01(y), width: clamp01(width), height: clamp01(height) };
}

export function pointInScaleBounds(point: NormalizedPoint, bounds: ScaleRegionBounds | null | undefined, tolerance = 0.0005) {
  if (!bounds) return true;
  return point.x >= bounds.x - tolerance
    && point.x <= bounds.x + bounds.width + tolerance
    && point.y >= bounds.y - tolerance
    && point.y <= bounds.y + bounds.height + tolerance;
}

export function geometryFitsScaleBounds(geometry: DrawingGeometry, bounds: ScaleRegionBounds | null | undefined) {
  if (!bounds) return true;
  const points = [...geometry.points, ...(geometry.holes || []).flat()];
  return points.length > 0 && points.every(point => pointInScaleBounds(point, bounds));
}

const boundsArea = (bounds: ScaleRegionBounds | null | undefined) => bounds ? bounds.width * bounds.height : Number.POSITIVE_INFINITY;

export function findScaleRegionForPoint(regions: TakeoffScaleRegion[], point: NormalizedPoint) {
  const accepted = (regions || []).filter(region => Number(region?.calibration?.ft_per_pdf_unit) > 0);
  const bounded = accepted.filter(region => region.region_bounds && pointInScaleBounds(point, region.region_bounds)).sort((a, b) => boundsArea(a.region_bounds) - boundsArea(b.region_bounds));
  if (bounded.length) return bounded[0];
  return accepted.find(region => region.is_default) || accepted.find(region => !region.region_bounds) || null;
}

export function findScaleRegionForGeometry(regions: TakeoffScaleRegion[], geometry: DrawingGeometry) {
  const accepted = (regions || []).filter(region => Number(region?.calibration?.ft_per_pdf_unit) > 0);
  const bounded = accepted.filter(region => region.region_bounds && geometryFitsScaleBounds(geometry, region.region_bounds)).sort((a, b) => boundsArea(a.region_bounds) - boundsArea(b.region_bounds));
  if (bounded.length) return bounded[0];
  const fallback = accepted.find(region => region.is_default) || accepted.find(region => !region.region_bounds) || null;
  return fallback && geometryFitsScaleBounds(geometry, fallback.region_bounds) ? fallback : null;
}

export function calibrationFromDetectedScale(candidate: ScaleCandidate): ScaleCalibration {
  if (!candidate.usable || !(Number(candidate.feetPerPdfUnit) > 0)) throw new Error('This detected label does not define a measurable scale.');
  return {
    ft_per_pdf_unit: Number(candidate.feetPerPdfUnit),
    method: 'pdf_text',
    scale_label: candidate.label,
    source_text: candidate.sourceText,
    source_bounds: candidate.sourceBounds,
    confidence: candidate.confidence,
    accepted_at: new Date().toISOString(),
  };
}

export function calibrationFromManual(points: NormalizedPoint[], knownDistanceFt: number, pageWidth: number, pageHeight: number): ScaleCalibration {
  if (!Array.isArray(points) || points.length !== 2) throw new Error('Manual calibration requires two points.');
  if (!(knownDistanceFt > 0) || !(pageWidth > 0) || !(pageHeight > 0)) throw new Error('Manual calibration values are invalid.');
  const dx = (points[1].x - points[0].x) * pageWidth;
  const dy = (points[1].y - points[0].y) * pageHeight;
  const distance = Math.hypot(dx, dy);
  if (!(distance > 0)) throw new Error('Manual calibration points must be different.');
  return {
    ft_per_pdf_unit: knownDistanceFt / distance,
    method: 'manual',
    scale_label: `${knownDistanceFt.toLocaleString('en-US', { maximumFractionDigits: 4 })} FT manual calibration`,
    known_distance_ft: knownDistanceFt,
    pdf_distance: distance,
    points,
    accepted_at: new Date().toISOString(),
  };
}
