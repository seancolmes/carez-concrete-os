'use client';

import { useState } from 'react';
import type { DrawingGeometry, NormalizedPoint } from '@/lib/takeoff/geometry';

type VertexRef = { ring: 'outer' | 'hole'; holeIndex?: number; pointIndex: number };
type Props = {
  geometry: DrawingGeometry;
  pageWidth: number;
  pageHeight: number;
  color: string;
  onChange: (geometry: DrawingGeometry) => void;
};

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const copyGeometry = (geometry: DrawingGeometry): DrawingGeometry => ({
  type: geometry.type,
  points: geometry.points.map(point => ({ ...point })),
  ...(geometry.holes?.length ? { holes: geometry.holes.map(hole => hole.map(point => ({ ...point }))) } : {}),
});

export function TakeoffVertexEditor({ geometry, pageWidth, pageHeight, color, onChange }: Props) {
  const [active, setActive] = useState<VertexRef | null>(null);

  const eventPoint = (event: { clientX: number; clientY: number; currentTarget: SVGElement }) => {
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return { x: clamp((event.clientX - rect.left) / rect.width), y: clamp((event.clientY - rect.top) / rect.height) };
  };

  const move = (event: React.PointerEvent<SVGCircleElement>, vertex: VertexRef) => {
    if (!active) return;
    const point = eventPoint(event);
    if (!point) return;
    const next = copyGeometry(geometry);
    if (vertex.ring === 'outer') next.points[vertex.pointIndex] = point;
    else if (next.holes && vertex.holeIndex !== undefined) next.holes[vertex.holeIndex][vertex.pointIndex] = point;
    onChange(next);
  };

  const start = (event: React.PointerEvent<SVGCircleElement>, vertex: VertexRef) => {
    event.stopPropagation();
    event.preventDefault();
    setActive(vertex);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const end = (event: React.PointerEvent<SVGCircleElement>) => {
    event.stopPropagation();
    setActive(null);
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch {}
  };

  const remove = (event: React.MouseEvent<SVGCircleElement>, vertex: VertexRef) => {
    event.preventDefault();
    event.stopPropagation();
    const next = copyGeometry(geometry);
    const ring = vertex.ring === 'outer' ? next.points : next.holes?.[vertex.holeIndex || 0];
    const minimum = vertex.ring === 'hole' || geometry.type === 'polygon' ? 3 : geometry.type === 'polyline' ? 2 : 1;
    if (!ring || ring.length <= minimum) return;
    ring.splice(vertex.pointIndex, 1);
    onChange(next);
  };

  const insert = (event: React.MouseEvent<SVGLineElement>, ring: 'outer' | 'hole', afterIndex: number, holeIndex?: number) => {
    event.preventDefault();
    event.stopPropagation();
    const point = eventPoint(event);
    if (!point) return;
    const next = copyGeometry(geometry);
    const target = ring === 'outer' ? next.points : next.holes?.[holeIndex || 0];
    if (!target) return;
    target.splice(afterIndex + 1, 0, point);
    onChange(next);
  };

  const renderSegments = (points: NormalizedPoint[], ring: 'outer' | 'hole', holeIndex?: number) => {
    if (geometry.type === 'count' && ring === 'outer') return null;
    const count = geometry.type === 'polygon' || ring === 'hole' ? points.length : points.length - 1;
    return Array.from({ length: count }, (_, index) => {
      const start = points[index];
      const finish = points[(index + 1) % points.length];
      return <line
        key={`${ring}-${holeIndex || 0}-segment-${index}`}
        x1={start.x * pageWidth}
        y1={start.y * pageHeight}
        x2={finish.x * pageWidth}
        y2={finish.y * pageHeight}
        stroke="transparent"
        strokeWidth="14"
        vectorEffect="non-scaling-stroke"
        pointerEvents="stroke"
        onDoubleClick={event => insert(event, ring, index, holeIndex)}
        style={{ cursor: 'copy' }}
      />;
    });
  };

  const renderHandle = (point: NormalizedPoint, vertex: VertexRef, key: string) => {
    const isActive = active?.ring === vertex.ring
      && active?.holeIndex === vertex.holeIndex
      && active?.pointIndex === vertex.pointIndex;
    return <g key={key} transform={`translate(${point.x * pageWidth} ${point.y * pageHeight})`}>
      <circle
        r={isActive ? 8 : 6.5}
        fill={isActive ? '#ffffff' : '#0b121b'}
        stroke={color}
        strokeWidth={isActive ? 3 : 2.2}
        vectorEffect="non-scaling-stroke"
        onPointerDown={event => start(event, vertex)}
        onPointerMove={event => move(event, vertex)}
        onPointerUp={end}
        onPointerCancel={end}
        onContextMenu={event => remove(event, vertex)}
        style={{ cursor: 'move', pointerEvents: 'all' }}
      />
      <circle r="2" fill={color} pointerEvents="none" />
    </g>;
  };

  return <g>
    {renderSegments(geometry.points, 'outer')}
    {(geometry.holes || []).flatMap((hole, holeIndex) => renderSegments(hole, 'hole', holeIndex))}
    {geometry.points.map((point, index) => renderHandle(point, { ring: 'outer', pointIndex: index }, `outer-${index}`))}
    {(geometry.holes || []).flatMap((hole, holeIndex) => hole.map((point, index) => renderHandle(
      point,
      { ring: 'hole', holeIndex, pointIndex: index },
      `hole-${holeIndex}-${index}`,
    )))}
  </g>;
}
