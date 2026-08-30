import type { NormalizedPoint } from './geometry';

export type GeometryAnchor = 'center' | 'left' | 'right' | 'custom';
export type RenderConfig = { mode: 'linear_buffer' | 'area_polygon' | 'count_marker'; widthVariable?: string; widthUnit?: 'IN' | 'FT'; defaultAnchor?: GeometryAnchor };
export type DisplayStyle = { color: string; opacity: number; borderColor: string; borderWidth: number; pattern: 'solid' | 'dashed' };

export const parseRenderConfig = (value: unknown): RenderConfig | null => {
  if (!value || typeof value !== 'object') return null;
  const config = value as Record<string, unknown>;
  if (!['linear_buffer', 'area_polygon', 'count_marker'].includes(String(config.mode))) return null;
  if (config.mode === 'linear_buffer' && (typeof config.widthVariable !== 'string' || !['IN', 'FT'].includes(String(config.widthUnit)))) return null;
  return { mode: config.mode as RenderConfig['mode'], widthVariable: typeof config.widthVariable === 'string' ? config.widthVariable : undefined, widthUnit: config.widthUnit as RenderConfig['widthUnit'], defaultAnchor: ['center', 'left', 'right', 'custom'].includes(String(config.defaultAnchor)) ? config.defaultAnchor as GeometryAnchor : 'center' };
};
export const resolveDisplayStyle = (value: unknown, fallback: string): DisplayStyle => {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const color = typeof source.color === 'string' ? source.color : fallback;
  const opacity = Number(source.opacity ?? .28), borderWidth = Number(source.borderWidth ?? 1.5);
  return { color, opacity: Number.isFinite(opacity) ? Math.max(0, Math.min(1, opacity)) : .28, borderColor: typeof source.borderColor === 'string' ? source.borderColor : color, borderWidth: Number.isFinite(borderWidth) ? Math.max(.5, borderWidth) : 1.5, pattern: source.pattern === 'dashed' ? 'dashed' : 'solid' };
};
type PdfPoint = { x: number; y: number };
const toPdf = (point: NormalizedPoint, width: number, height: number): PdfPoint => ({ x: point.x * width, y: point.y * height });
const toNormalized = (point: PdfPoint, width: number, height: number): NormalizedPoint => ({ x: point.x / width, y: point.y / height });
const lineIntersection = (a: PdfPoint, b: PdfPoint, c: PdfPoint, d: PdfPoint): PdfPoint | null => { const den = (a.x-b.x)*(c.y-d.y)-(a.y-b.y)*(c.x-d.x); if (Math.abs(den)<1e-8) return null; const cross1=a.x*b.y-a.y*b.x,cross2=c.x*d.y-c.y*d.x; return {x:(cross1*(c.x-d.x)-(a.x-b.x)*cross2)/den,y:(cross1*(c.y-d.y)-(a.y-b.y)*cross2)/den}; };
/** Derives an open-path physical footprint in PDF space without mutating source geometry. */
export function linearFootprint(points: NormalizedPoint[], pageWidth: number, pageHeight: number, feetPerPdfUnit: number, widthIn: number, anchor: GeometryAnchor = 'center', customOffsetIn = 0): NormalizedPoint[] {
  if (points.length < 2 || !(pageWidth > 0 && pageHeight > 0 && feetPerPdfUnit > 0 && widthIn > 0)) return [];
  const path = points.map(point => toPdf(point, pageWidth, pageHeight)); const width = widthIn / 12 / feetPerPdfUnit;
  const centerOffset = anchor === 'left' ? width / 2 : anchor === 'right' ? -width / 2 : anchor === 'custom' ? customOffsetIn / 12 / feetPerPdfUnit : 0;
  const side = (sign: number) => {
    const distance = centerOffset + sign * width / 2;
    const offsetSegment = (a: PdfPoint, b: PdfPoint) => { const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy); return len ? [{x:a.x-dy/len*distance,y:a.y+dx/len*distance},{x:b.x-dy/len*distance,y:b.y+dx/len*distance}] as const : [a,b] as const; };
    return path.map((point,index) => { if (index===0) return offsetSegment(path[0],path[1])[0]; if (index===path.length-1) return offsetSegment(path[index-1],path[index])[1]; const previous=offsetSegment(path[index-1],path[index]), next=offsetSegment(path[index],path[index+1]); const miter=lineIntersection(previous[0],previous[1],next[0],next[1]); return miter && Math.hypot(miter.x-point.x,miter.y-point.y)<=width*4 ? miter : {x:(previous[1].x+next[0].x)/2,y:(previous[1].y+next[0].y)/2}; });
  };
  return [...side(1), ...side(-1).reverse()].map(point => toNormalized(point, pageWidth, pageHeight));
}
