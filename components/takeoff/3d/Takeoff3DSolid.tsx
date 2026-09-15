'use client';

import { useEffect, useMemo, useState } from 'react';
import { Edges, useCursor } from '@react-three/drei';
import { Color } from 'three';
import type { Derived3DIssue, Derived3DSolid } from '@/lib/takeoff/conditions/derived3d/contracts';
import { buildTakeoffMeshGeometry } from '@/lib/takeoff/3d/meshGeometry';
import { solidSelectionIdentity } from '@/lib/takeoff/3d/selection';

export function Takeoff3DSolid({ solid, selected, onSelect, onIssue }: {
  solid: Derived3DSolid; selected: boolean; onSelect: (solid: Derived3DSolid) => void;
  onIssue: (solidId: string, issue: Derived3DIssue | null) => void;
}) {
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);
  const result = useMemo(() => {
    try { return { geometry: buildTakeoffMeshGeometry(solid.shape), error: null }; }
    catch (error) { return { geometry: null, error: error instanceof Error ? error.message : String(error) }; }
  // The domain key owns geometry invalidation; selection/color never rebuild it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solid.geometryKey]);
  useEffect(() => () => result.geometry?.dispose(), [result]);
  useEffect(() => {
    onIssue(solid.id, result.error ? {
      id: `mesh:${solid.id}`, code: 'unsupported_projection', severity: 'hold',
      conditionVersionId: solid.conditionVersionId, measurementId: solid.measurementId,
      sheetId: solid.sheetId, message: result.error, relatedSolidIds: [solid.id], target: 'drawing',
    } : null);
    return () => onIssue(solid.id, null);
  }, [result.error, solid.id, solid.conditionVersionId, solid.measurementId, solid.sheetId, onIssue]);
  const colors = useMemo(() => [0.06, -0.08, -0.14].map(lightness => new Color(solid.color).offsetHSL(0, 0, lightness + (selected ? 0.035 : 0))), [solid.color, selected]);
  if (!result.geometry) return null;
  return <mesh geometry={result.geometry} userData={solidSelectionIdentity(solid)}
    onClick={event => { event.stopPropagation(); onSelect(solid); }}
    onPointerOver={event => { event.stopPropagation(); setHovered(true); }}
    onPointerOut={() => setHovered(false)}>
    {colors.map((color, index) => <meshStandardMaterial key={index} attach={`material-${index}`} color={color}
      roughness={0.85} metalness={0} flatShading transparent={false} opacity={1}
      emissive={solid.color} emissiveIntensity={selected ? 0.1 : 0} />)}
    <Edges key={solid.geometryKey} threshold={20} color={selected ? '#e2e8f0' : hovered ? '#64748b' : '#18212c'}
      lineWidth={selected ? 2 : hovered ? 1.5 : 0.75} />
  </mesh>;
}
