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
        <rect x={x} y={y} width={width} height={height} fill="rgba(0,153,102,.04)" stroke="#009966" strokeWidth="1.5" strokeDasharray="8 5" vectorEffect="non-scaling-stroke"/>
        <rect x={x + 5} y={y + 5} width={Math.max(82, region.scale_label.length * 6 + 18)} height="18" rx="4" fill="rgba(23,27,25,.88)" stroke="#009966" vectorEffect="non-scaling-stroke"/>
        <text x={x + 12} y={y + 17} fill="#F4F6F5" fontSize="9" fontWeight="700">{region.name} · {region.scale_label}</text>
      </g>;
    })}
    {pendingCandidate?.sourceBounds && (() => {
      const bounds = pendingCandidate.sourceBounds;
      return <rect x={bounds.x * pageWidth} y={bounds.y * pageHeight} width={bounds.width * pageWidth} height={bounds.height * pageHeight} fill="rgba(138,97,11,.12)" stroke="#8A610B" strokeWidth="2" vectorEffect="non-scaling-stroke"/>;
    })()}
    {draft && <rect x={draft.x * pageWidth} y={draft.y * pageHeight} width={draft.width * pageWidth} height={draft.height * pageHeight} fill="rgba(66,111,147,.10)" stroke="#426F93" strokeWidth="2" strokeDasharray="7 5" vectorEffect="non-scaling-stroke"/>}
    {regionPoints.map((point, index) => <circle key={index} cx={point.x * pageWidth} cy={point.y * pageHeight} r="5" fill="#426F93" stroke="#171B19" strokeWidth="2" vectorEffect="non-scaling-stroke"/>)}
  </g>;
}
