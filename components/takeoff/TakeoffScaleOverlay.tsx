'use client';

import type { NormalizedPoint } from '@/lib/takeoff/geometry';
import { boundsFromPoints, type ScaleCandidate, type TakeoffScaleRegion } from '@/lib/takeoff/scaleRegions';

export function TakeoffScaleOverlay({
  regions,
  pendingCandidate,
  regionPoints,
  pageWidth,
  pageHeight,
}: {
  regions: TakeoffScaleRegion[];
  pendingCandidate: ScaleCandidate | null;
  regionPoints: NormalizedPoint[];
  pageWidth: number;
  pageHeight: number;
}) {
  const draft = boundsFromPoints(regionPoints);
  return <g pointerEvents="none">
    {regions.filter(region => region.region_bounds).map((region, index) => {
      const bounds = region.region_bounds!;
      const x = bounds.x * pageWidth;
      const y = bounds.y * pageHeight;
      const width = bounds.width * pageWidth;
      const height = bounds.height * pageHeight;
      return <g key={region.id}>
        <rect x={x} y={y} width={width} height={height} fill="rgba(95,199,154,.04)" stroke="#5fc79a" strokeWidth="1.5" strokeDasharray="8 5" vectorEffect="non-scaling-stroke"/>
        <rect x={x + 5} y={y + 5} width={Math.max(82, region.scale_label.length * 6 + 18)} height="18" rx="4" fill="rgba(7,12,18,.88)" stroke="#5fc79a" vectorEffect="non-scaling-stroke"/>
        <text x={x + 12} y={y + 17} fill="#eafbf3" fontSize="9" fontWeight="700">{region.name} · {region.scale_label}</text>
      </g>;
    })}
    {pendingCandidate?.sourceBounds && (() => {
      const bounds = pendingCandidate.sourceBounds;
      return <rect x={bounds.x * pageWidth} y={bounds.y * pageHeight} width={bounds.width * pageWidth} height={bounds.height * pageHeight} fill="rgba(228,177,93,.12)" stroke="#e4b15d" strokeWidth="2" vectorEffect="non-scaling-stroke"/>;
    })()}
    {draft && <rect x={draft.x * pageWidth} y={draft.y * pageHeight} width={draft.width * pageWidth} height={draft.height * pageHeight} fill="rgba(111,149,238,.10)" stroke="#6f95ee" strokeWidth="2" strokeDasharray="7 5" vectorEffect="non-scaling-stroke"/>}
    {regionPoints.map((point, index) => <circle key={index} cx={point.x * pageWidth} cy={point.y * pageHeight} r="5" fill="#6f95ee" stroke="#07101a" strokeWidth="2" vectorEffect="non-scaling-stroke"/>)}
  </g>;
}
