'use client';

import { Focus, RotateCcw, SlidersHorizontal, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import styles from './Takeoff3DViewport.module.css';

export function Takeoff3DToolbar({ label, onHome, onTop, issueCount, checksOpen, onToggleChecks, onFocus, canFocus, filtersOpen, onToggleFilters }: {
  label: string; onHome: () => void; onTop: () => void;
  issueCount: number; checksOpen: boolean; onToggleChecks: () => void;
  onFocus: () => void; canFocus: boolean; filtersOpen: boolean; onToggleFilters: () => void;
}) {
  return <div className="absolute top-6 right-6 z-40 flex items-center bg-[#181A1B]/95 backdrop-blur-md border border-[#343A3F] rounded-xl shadow-lg p-1 overflow-hidden max-w-[calc(100%-3rem)]" onPointerDown={event=>event.stopPropagation()} onClick={event=>event.stopPropagation()} onDoubleClick={event=>event.stopPropagation()} onWheel={event=>event.stopPropagation()} aria-label="3D view controls">
    <strong className={styles.sheetLabel}>{label}</strong>
    <Button className="h-auto px-3 py-2 text-sm text-[#A1A1AA] hover:text-white hover:bg-[#2A2E33] rounded-lg transition-colors" size="xs" variant="ghost" onClick={onHome}><RotateCcw />Home</Button>
    <Button className="h-auto px-3 py-2 text-sm text-[#A1A1AA] hover:text-white hover:bg-[#2A2E33] rounded-lg transition-colors" size="xs" variant="ghost" onClick={onTop}><Square />Top</Button>
    <Button className="h-auto px-3 py-2 text-sm text-[#A1A1AA] hover:text-white hover:bg-[#2A2E33] rounded-lg transition-colors" size="xs" variant="ghost" onClick={onFocus} disabled={!canFocus} title="Focus selected Takeoff"><Focus />Focus</Button>
    <Button className="h-auto px-3 py-2 text-sm text-[#A1A1AA] hover:text-white hover:bg-[#2A2E33] rounded-lg transition-colors" size="xs" variant="ghost" onClick={onToggleFilters} aria-expanded={filtersOpen}><SlidersHorizontal />Filters</Button>
    <Button className="h-auto px-3 py-2 text-sm text-[#A1A1AA] hover:text-white hover:bg-[#2A2E33] rounded-lg transition-colors" size="xs" variant="ghost" aria-expanded={checksOpen} onClick={onToggleChecks}>3D checks {issueCount}</Button>
  </div>;
}
