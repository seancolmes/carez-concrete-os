'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type { Derived3DScene, Derived3DSolid, Derived3DIssue } from '@/lib/takeoff/conditions/derived3d/contracts';
import { DEFAULT_DERIVED_3D_VIEW_STATE, type Derived3DViewState } from '@/lib/takeoff/3d/viewState';
import type { Takeoff3DCameraMemory } from '@/lib/takeoff/3d/camera';
import { focusFrameForSolids, sheetSolidsForSelection } from '@/lib/takeoff/3d/selection';
import { formatArchitecturalLength } from '@/lib/takeoff/lengthFormat';
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

export function Takeoff3DViewport({ scene, pdfUrl, activeSheetId, activePageNumber, activeSheetLabel, cameraMemory, onJumpToIssue, selectedMeasurementId, selectedConditionVersionId, viewState, onViewStateChange, onSelectSolid }: Takeoff3DViewportProps) {
  const localMemory = useTakeoff3DCamera();
  const actions = useRef<Takeoff3DCameraActions | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [checksOpen, setChecksOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [meshIssues, setMeshIssues] = useState<Record<string, Derived3DIssue>>({});
  const onMeshIssue = useCallback((solidId: string, issue: Derived3DIssue | null) => {
    setMeshIssues(current => {
      if (!issue && !current[solidId]) return current;
      const next = { ...current };
      if (issue) next[solidId] = issue;
      else delete next[solidId];
      return next;
    });
  }, []);
  const sheetSolids = useMemo(() => sheetSolidsForSelection(scene, activeSheetId), [scene, activeSheetId]);
  const visibleSolids = useMemo(() => sheetSolids.filter(solid =>
    !viewState.hidden.includes(solid.conditionVersionId) && (!viewState.isolated || solid.conditionVersionId === viewState.isolated)
    && (viewState.zone === 'all' || solid.zone === viewState.zone) && (viewState.elevation === 'all' || String(solid.shape.top) === viewState.elevation)), [sheetSolids, viewState]);
  const plane = activeSheetId ? scene.sheetPlanes[activeSheetId] : undefined;
  const sheetIssues = [...scene.issues, ...Object.values(meshIssues)].filter(issue => issue.sheetId === activeSheetId);
  const calibrated = plane && Number.isFinite(plane.worldWidth) && Number.isFinite(plane.worldHeight) && (plane.worldWidth ?? 0) > 0 && (plane.worldHeight ?? 0) > 0;
  const retry = () => setAttempt(current => current + 1);
  const zones = [...new Set(sheetSolids.map(solid => solid.zone).filter((zone): zone is string => Boolean(zone)))].sort();
  const elevations = [...new Set(sheetSolids.map(solid => solid.shape.top))].sort((a, b) => a - b);
  const renderedSolids = visibleSolids.filter(solid => !meshIssues[solid.id]);
  const selectedSolids = renderedSolids.filter(solid => solid.measurementId === selectedMeasurementId);
  const selectedIssue = sheetIssues.find(issue => issue.severity === 'hold' && (selectedMeasurementId
    ? issue.measurementId === selectedMeasurementId
    : issue.measurementId === null && issue.conditionVersionId === selectedConditionVersionId));
  const emptyIssue = renderedSolids.length ? null : selectedIssue ?? sheetIssues.find(issue => issue.severity === 'hold');
  const displayedIssue = selectedIssue ?? emptyIssue;
  const hasFilters = Boolean(viewState.hidden.length || viewState.isolated || viewState.zone !== 'all' || viewState.elevation !== 'all');
  const canFilterSelected = sheetSolids.some(solid => solid.conditionVersionId === selectedConditionVersionId);
  const selectedHidden = Boolean(selectedConditionVersionId && viewState.hidden.includes(selectedConditionVersionId));
  const showAll = () => onViewStateChange({ ...DEFAULT_DERIVED_3D_VIEW_STATE, hidden: [] });
  const toggleSelected = () => {
    if (canFilterSelected && selectedConditionVersionId) onViewStateChange(current => ({ ...current, isolated: null,
      hidden: current.hidden.includes(selectedConditionVersionId) ? current.hidden.filter(id => id !== selectedConditionVersionId) : [...current.hidden, selectedConditionVersionId] }));
  };
  const isolateSelected = () => {
    if (canFilterSelected && selectedConditionVersionId) onViewStateChange(current => ({ ...current, hidden: [], isolated: current.isolated === selectedConditionVersionId ? null : selectedConditionVersionId }));
  };
  const focusSelected = () => {
    const frame = focusFrameForSolids(selectedSolids);
    if (frame) actions.current?.focusSelected(frame.target, frame.width, frame.height);
  };

  return <section className={styles.viewport} aria-label={`${activeSheetLabel} 3D plan`}>
    <Takeoff3DToolbar label={activeSheetLabel} onHome={() => actions.current?.home()} onTop={() => actions.current?.top()}
      onFocus={focusSelected} canFocus={Boolean(calibrated && pdfUrl && selectedSolids.length)} filtersOpen={filtersOpen} onToggleFilters={() => setFiltersOpen(current => !current)}
      issueCount={sheetIssues.length} checksOpen={checksOpen} onToggleChecks={() => setChecksOpen(current => !current)} />
    {filtersOpen && <div className={styles.filters} aria-label="3D filters">
      <label>Zone<select aria-label="3D zone" value={viewState.zone} onChange={event => onViewStateChange(current => ({ ...current, zone: event.target.value }))}>
        <option value="all">All zones</option>{viewState.zone !== 'all' && !zones.includes(viewState.zone) && <option value={viewState.zone}>{viewState.zone} (not on this sheet)</option>}
        {zones.map(zone => <option key={zone} value={zone}>{zone}</option>)}
      </select></label>
      <label>Top elevation<select aria-label="3D top elevation" value={viewState.elevation} onChange={event => onViewStateChange(current => ({ ...current, elevation: event.target.value }))}>
        <option value="all">All elevations</option>{viewState.elevation !== 'all' && !elevations.some(value => String(value) === viewState.elevation) && <option value={viewState.elevation}>{formatArchitecturalLength(Number(viewState.elevation))} (not on this sheet)</option>}
        {elevations.map(value => <option key={value} value={String(value)}>{formatArchitecturalLength(value)}</option>)}
      </select></label>
      <Button size="xs" variant="ghost" disabled={!canFilterSelected} onClick={toggleSelected}>{selectedHidden ? 'Show selected' : 'Hide selected'}</Button>
      <Button size="xs" variant="ghost" disabled={!canFilterSelected} aria-pressed={Boolean(viewState.isolated && viewState.isolated === selectedConditionVersionId)} onClick={isolateSelected}>Isolate</Button>
      <Button size="xs" variant="ghost" disabled={!hasFilters} onClick={showAll}>Show all</Button>
    </div>}
    <div className={styles.canvas}>
      {calibrated && pdfUrl ? <Takeoff3DErrorBoundary key={`${activeSheetId}:${attempt}`} onRetry={retry}>
        <Takeoff3DScene plane={plane} pdfUrl={pdfUrl} pageNumber={activePageNumber} memory={cameraMemory ?? localMemory.current} actions={actions} onRetry={retry}
          solids={visibleSolids} selectedMeasurementId={selectedMeasurementId} onSelectSolid={onSelectSolid} onMeshIssue={onMeshIssue} />
      </Takeoff3DErrorBoundary> : <div className={styles.message} role="status">
        <strong>3D input required</strong>
        <span>{!pdfUrl ? 'The active sheet needs a PDF reference.' : sheetIssues.find(issue => issue.severity === 'hold')?.message ?? 'The active sheet needs calibrated 3D dimensions.'}</span>
        {sheetIssues.find(issue => issue.severity === 'hold') && <Button size="xs" variant="outline" onClick={() => {
          const issue = sheetIssues.find(entry => entry.severity === 'hold'); if (issue) onJumpToIssue(issue);
        }}>Resolve input</Button>}
      </div>}
      {calibrated && pdfUrl && displayedIssue && <div className={`${styles.issueOverlay} ${!renderedSolids.length ? styles.centeredIssue : ''}`} role="status">
        <strong>{displayedIssue.code === '3d_input_required' ? '3D input required' : '3D unavailable for this Takeoff'}</strong>
        <span>{displayedIssue.message}</span>
        <Button size="xs" variant="outline" onClick={() => onJumpToIssue(displayedIssue)}>Resolve input</Button>
      </div>}
      {calibrated && pdfUrl && !renderedSolids.length && !displayedIssue && <div className={`${styles.issueOverlay} ${styles.centeredIssue}`} role="status">
        <strong>{hasFilters ? 'No visible concrete' : 'No 3D concrete on this sheet'}</strong>
        <span>{hasFilters ? 'Restore visibility to review this sheet.' : 'Supported measured concrete will appear here.'}</span>
        {hasFilters && <Button size="xs" variant="outline" onClick={showAll}>Show all</Button>}
      </div>}
      {checksOpen && <div className={styles.checks}>
        <strong>3D checks</strong>
        {sheetIssues.length ? sheetIssues.map(issue => <div key={issue.id}>
          <p>{issue.message}</p><Button size="xs" variant="outline" onClick={() => onJumpToIssue(issue)}>Resolve input</Button>
        </div>) : <p>No 3D input issues for this sheet.</p>}
      </div>}
    </div>
    <div className={styles.hint}>{sheetIssues.some(issue => issue.severity === 'hold') && renderedSolids.length > 0 ? 'Partial model · ' : ''}{!scene.coverage.checksComplete ? 'Checks incomplete · ' : ''}Drag to orbit · Right-drag to pan · Scroll to zoom</div>
  </section>;
}
