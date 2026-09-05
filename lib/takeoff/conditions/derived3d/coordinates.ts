import type { Derived3DPlanPoint, Derived3DSheetSource } from './contracts.ts';

export function finiteNumber(value: unknown): number | null {
  if (value === '' || value === null || value === undefined || typeof value === 'boolean' || (typeof value !== 'number' && typeof value !== 'string')) return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}
export function positiveNumber(value: unknown): number | null { const n = finiteNumber(value); return n !== null && n > 0 ? n : null; }
export function record(value: unknown): Record<string, any> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}; }
export function calibrationScale(value: unknown): number | null {
  const c = record(value);
  const direct = positiveNumber(c.ft_per_pdf_unit);
  if (direct) return direct;
  const known = positiveNumber(c.known_distance_ft), pdf = positiveNumber(c.pdf_distance);
  return known && pdf ? known / pdf : null;
}
// Stable page coordinates: X is page-right, Z is page-down; Y is elevation.
export function toPlanPoint(point: { x: number; y: number }, sheet: Derived3DSheetSource, scale: number): Derived3DPlanPoint {
  return { x: point.x * Number(sheet.page_width) * scale, z: point.y * Number(sheet.page_height) * scale };
}
export function elevationRange(elevation: number, depth: number, reference: unknown): { bottom: number; top: number } | null {
  if (!Number.isFinite(elevation) || !Number.isFinite(depth) || depth <= 0) return null;
  if (reference === 'top') return { bottom: elevation - depth, top: elevation };
  if (reference === 'bottom') return { bottom: elevation, top: elevation + depth };
  if (reference === 'centerline') return { bottom: elevation - depth / 2, top: elevation + depth / 2 };
  return null;
}
function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, stableValue(v)]));
  return value;
}
// Two independent words reduce accidental cache-key collisions. Not an authorization token.
export function stableDerived3DHash(value: unknown): string {
  const text = JSON.stringify(stableValue(value)); let a = 0x811c9dc5, b = 0x9e3779b9;
  for (let i = 0; i < text.length; i++) { a = Math.imul(a ^ text.charCodeAt(i), 0x01000193); b = Math.imul(b ^ text.charCodeAt(i), 0x85ebca6b); }
  return [a, b].map(n => (n >>> 0).toString(16).padStart(8, '0')).join('');
}
