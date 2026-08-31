'use client';

import { Ruler, ScanSearch, Trash2 } from 'lucide-react';
import type { ScaleCandidate, TakeoffScaleRegion } from '@/lib/takeoff/scaleRegions';
import styles from './TakeoffDrawingWorkspace.module.css';

export function TakeoffScalePanel({
  regions,
  candidates,
  detectionStatus,
  locked,
  busy,
  knownDistanceFt,
  calibrationPointCount,
  pendingCandidate,
  pendingManualLabel,
  regionPointCount,
  onKnownDistanceChange,
  onUseDetectedSheet,
  onAssignDetectedRegion,
  onPickManual,
  onUseManualSheet,
  onAssignManualRegion,
  onSaveRegion,
  onCancelRegion,
  onDeleteRegion,
}: {
  regions: TakeoffScaleRegion[];
  candidates: ScaleCandidate[];
  detectionStatus: 'idle' | 'scanning' | 'ready' | 'none' | 'error';
  locked: boolean;
  busy: boolean;
  knownDistanceFt: string;
  calibrationPointCount: number;
  pendingCandidate: ScaleCandidate | null;
  pendingManualLabel: string | null;
  regionPointCount: number;
  onKnownDistanceChange: (value: string) => void;
  onUseDetectedSheet: (candidate: ScaleCandidate) => void;
  onAssignDetectedRegion: (candidate: ScaleCandidate) => void;
  onPickManual: () => void;
  onUseManualSheet: () => void;
  onAssignManualRegion: () => void;
  onSaveRegion: () => void;
  onCancelRegion: () => void;
  onDeleteRegion: (region: TakeoffScaleRegion) => void;
}) {
  const usable = candidates.filter(candidate => candidate.usable);
  const nts = candidates.some(candidate => !candidate.usable && candidate.scaleKind === 'nts');
  const pendingLabel = pendingCandidate?.label || pendingManualLabel;

  return <div className={`${styles.group} ${styles.scaleGate}`}>
    <div className={styles.groupHead}><div><div className={styles.groupTitle}>Drawing Scale</div><div className={styles.groupHelp}>Carez reads vector PDF scale labels. Confirm the proposal before it controls quantities.</div></div><ScanSearch size={17}/></div>

    {regions.length > 0 && <div className={styles.objectList}>{regions.map(region => <div key={region.id} className={styles.scaleReady}>
      <span>{region.is_default ? 'Whole sheet' : 'Scale region'}</span>
      <strong>{region.scale_label}</strong>
      <button type="button" disabled={locked || busy} title="Remove unused scale region" onClick={() => onDeleteRegion(region)}><Trash2 size={13}/></button>
    </div>)}</div>}

    {detectionStatus === 'scanning' && <div className={styles.groupHelp}>Scanning embedded PDF text for architectural or engineering scale labels…</div>}
    {detectionStatus === 'error' && <div className={styles.groupHelp}>PDF text could not be scanned. Use manual calibration below.</div>}
    {detectionStatus === 'none' && <div className={styles.groupHelp}>No usable scale label was found on this sheet. Scanned drawings and NTS details require manual calibration.</div>}
    {nts && <div className={styles.groupHelp}><strong>NTS detected.</strong> Do not measure this view until a dimension is manually calibrated.</div>}

    {usable.map(candidate => <div key={candidate.id} className={styles.previewCard}>
      <span>Detected from PDF text · {Math.round(candidate.confidence * 100)}% confidence</span>
      <strong>{candidate.label}</strong>
      <small>{candidate.sourceText}</small>
      <div className={styles.buttonRow}>
        <button type="button" className={styles.primary} disabled={locked || busy} onClick={() => onUseDetectedSheet(candidate)}>Use whole sheet</button>
        <button type="button" className={styles.secondary} disabled={locked || busy} onClick={() => onAssignDetectedRegion(candidate)}>Assign region</button>
      </div>
    </div>)}

    {pendingLabel && <div className={styles.previewCard}>
      <span>Assign scale region</span>
      <strong>{pendingLabel}</strong>
      <small>Pick two opposite corners around the plan or detail that uses this scale.</small>
      <div className={styles.buttonRow}>
        <button type="button" className={styles.primary} disabled={locked || busy || regionPointCount !== 2} onClick={onSaveRegion}>Save region</button>
        <button type="button" className={styles.secondary} disabled={busy} onClick={onCancelRegion}>Cancel</button>
      </div>
    </div>}

    <details className={styles.advanced}>
      <summary><Ruler size={14}/> Manual calibration fallback</summary>
      <div className={styles.advancedBody}>
        <label className={styles.field}><span>Known dimension</span><div className={styles.inputUnit}><input value={knownDistanceFt} onChange={event => onKnownDistanceChange(event.target.value)} inputMode="decimal"/><b>FT</b></div></label>
        <div className={styles.buttonRow}>
          <button type="button" className={styles.secondary} disabled={locked || busy} onClick={onPickManual}>Pick 2 points</button>
          <button type="button" className={styles.primary} disabled={locked || busy || calibrationPointCount !== 2} onClick={onUseManualSheet}>Use whole sheet</button>
          <button type="button" className={styles.secondary} disabled={locked || busy || calibrationPointCount !== 2} onClick={onAssignManualRegion}>Assign region</button>
        </div>
        <div className={styles.groupHelp}>Use a printed dimension line only when the PDF scale label is missing, NTS, scanned, or unreliable.</div>
      </div>
    </details>
  </div>;
}
