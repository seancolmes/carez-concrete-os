'use client';

import { Focus, RotateCcw, SlidersHorizontal, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import styles from './Takeoff3DViewport.module.css';

export function Takeoff3DToolbar({ label, onHome, onTop, issueCount, checksOpen, onToggleChecks }: {
  label: string; onHome: () => void; onTop: () => void;
  issueCount: number; checksOpen: boolean; onToggleChecks: () => void;
}) {
  return <div className={styles.toolbar} aria-label="3D view controls">
    <strong className={styles.sheetLabel}>{label}</strong>
    <Button size="xs" variant="ghost" onClick={onHome}><RotateCcw />Home</Button>
    <Button size="xs" variant="ghost" onClick={onTop}><Square />Top</Button>
    <Button size="xs" variant="ghost" disabled title="No model element to focus"><Focus />Focus</Button>
    <Button size="xs" variant="ghost" disabled title="No model elements to filter"><SlidersHorizontal />Filters</Button>
    <Button size="xs" variant="ghost" aria-expanded={checksOpen} onClick={onToggleChecks}>3D checks {issueCount}</Button>
  </div>;
}
