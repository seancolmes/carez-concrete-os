'use client';

import { useRef, useState } from 'react';
import type { Derived3DScene, Derived3DSolid, Derived3DIssue } from '@/lib/takeoff/conditions/derived3d/contracts';
import type { Derived3DViewState } from '@/lib/takeoff/3d/viewState';
import type { Takeoff3DCameraMemory } from '@/lib/takeoff/3d/camera';
import { Button } from '@/components/ui/button';
import { Takeoff3DScene } from './Takeoff3DScene';
import { Takeoff3DToolbar } from './Takeoff3DToolbar';
import { Takeoff3DErrorBoundary } from './Takeoff3DErrorBoundary';
import type { Takeoff3DCameraActions } from './Takeoff3DControls';
import { useTakeoff3DCamera } from './useTakeoff3DCamera';
import styles from './Takeoff3DViewport.module.css';

export type Takeoff3DViewportProps = {
  scene: Derived3DScene; pdfUrl: string; activeSheetId: string | null; activePageNumber: number; activeSheetLabel: string;
  selectedMeasurementId: string | null; selectedConditionVersionId: string | null;
  viewState: Derived3DViewState;
  onViewStateChange: (value: Derived3DViewState | ((current: Derived3DViewState) => Derived3DViewState)) => void;
  onSelectSolid: (solid: Derived3DSolid) => void;
  onJumpToIssue: (issue: Derived3DIssue) => void;
  cameraMemory?: Map<string, Takeoff3DCameraMemory>;
};

export function Takeoff3DViewport({ scene, pdfUrl, activeSheetId, activePageNumber, activeSheetLabel, cameraMemory, onJumpToIssue }: Takeoff3DViewportProps) {
  const localMemory = useTakeoff3DCamera();
  const actions = useRef<Takeoff3DCameraActions | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [checksOpen, setChecksOpen] = useState(false);
  const plane = activeSheetId ? scene.sheetPlanes[activeSheetId] : undefined;
  const sheetIssues = scene.issues.filter(issue => issue.sheetId === activeSheetId);
  const calibrated = plane && Number.isFinite(plane.worldWidth) && Number.isFinite(plane.worldHeight) && (plane.worldWidth ?? 0) > 0 && (plane.worldHeight ?? 0) > 0;
  const retry = () => setAttempt(current => current + 1);

  return <section className={styles.viewport} aria-label={`${activeSheetLabel} 3D plan`}>
    <Takeoff3DToolbar label={activeSheetLabel} onHome={() => actions.current?.home()} onTop={() => actions.current?.top()}
      issueCount={sheetIssues.length} checksOpen={checksOpen} onToggleChecks={() => setChecksOpen(current => !current)} />
    <div className={styles.canvas}>
      {calibrated && pdfUrl ? <Takeoff3DErrorBoundary key={`${activeSheetId}:${attempt}`} onRetry={retry}>
        <Takeoff3DScene plane={plane} pdfUrl={pdfUrl} pageNumber={activePageNumber} memory={cameraMemory ?? localMemory.current} actions={actions} onRetry={retry} />
      </Takeoff3DErrorBoundary> : <div className={styles.message} role="status">
        <strong>3D input required</strong>
        <span>{!pdfUrl ? 'The active sheet needs a PDF reference.' : sheetIssues.find(issue => issue.severity === 'hold')?.message ?? 'The active sheet needs calibrated 3D dimensions.'}</span>
      </div>}
      {checksOpen && <div className={styles.checks}>
        <strong>3D checks</strong>
        {sheetIssues.length ? sheetIssues.map(issue => <div key={issue.id}>
          <p>{issue.message}</p><Button size="xs" variant="outline" onClick={() => onJumpToIssue(issue)}>Resolve input</Button>
        </div>) : <p>No 3D input issues for this sheet.</p>}
      </div>}
    </div>
    <div className={styles.hint}>Drag to orbit · Right-drag to pan · Scroll to zoom</div>
  </section>;
}
