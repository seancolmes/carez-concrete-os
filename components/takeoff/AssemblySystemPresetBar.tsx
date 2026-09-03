'use client';

import { useState, useTransition } from 'react';
import {
  Activity, Boxes, BrickWall, Cable, ChevronDown, CircleDot, Droplets, Grid3X3,
  Hammer, PackagePlus, Plus, Ruler, Sparkles, Waves, X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { addAssemblySystemPreset, type ConcreteSystemPreset } from '@/app/takeoff/[setId]/assemblySystemActions';
import styles from './AssemblySystemPresetBar.module.css';

type SystemOption = {
  id: ConcreteSystemPreset;
  label: string;
  detail: string;
  group: 'Concrete' | 'Reinforcing' | 'Materials' | 'Production';
  icon: typeof Plus;
};

const SYSTEMS: SystemOption[] = [
  { id: 'concrete_volume', label: 'Concrete', detail: 'Volume + order allowance', group: 'Concrete', icon: Boxes },
  { id: 'rebar_continuous', label: 'Continuous rebar', detail: 'Bar size + count + laps', group: 'Reinforcing', icon: Cable },
  { id: 'rebar_spaced', label: 'Spaced / transverse', detail: 'Bar size + spacing + length', group: 'Reinforcing', icon: Ruler },
  { id: 'rebar_grid', label: 'Rebar grid / mat', detail: 'Spacing + directions + layers', group: 'Reinforcing', icon: Grid3X3 },
  { id: 'wwf', label: 'WWF / WWR', detail: 'Area coverage + overlap', group: 'Reinforcing', icon: Waves },
  { id: 'dowels', label: 'Dowels / starters', detail: 'Size + spacing + embed length', group: 'Reinforcing', icon: CircleDot },
  { id: 'fiber', label: 'Fiber', detail: 'Dosage by concrete quantity', group: 'Reinforcing', icon: Sparkles },
  { id: 'vapor_barrier', label: 'Vapor barrier', detail: 'Coverage + overlap / waste', group: 'Materials', icon: Droplets },
  { id: 'formwork', label: 'Formwork', detail: 'Contact area + form labor', group: 'Materials', icon: BrickWall },
  { id: 'labor', label: 'Labor operation', detail: 'Quantity basis + MH/unit', group: 'Production', icon: Hammer },
  { id: 'placement', label: 'Placement / pump', detail: 'Direct, pump, buggy, equipment', group: 'Production', icon: Activity },
  { id: 'custom', label: 'Custom item', detail: 'Start from measured quantity', group: 'Production', icon: PackagePlus },
];

export function AssemblySystemPresetBar({ setId, versionId, disabled = false }: { setId: string; versionId: string; disabled?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();

  const add = (system: SystemOption) => {
    setMessage(`Adding ${system.label}…`);
    startTransition(async () => {
      try {
        const result = await addAssemblySystemPreset(setId, { versionId, preset: system.id });
        setMessage(`${system.label} added · ${result.propertyCount} variable${result.propertyCount === 1 ? '' : 's'} · ${result.componentCount} item${result.componentCount === 1 ? '' : 's'}`);
        setOpen(false);
        router.refresh();
      } catch (error: any) {
        setMessage(error?.message || `Unable to add ${system.label}.`);
      }
    });
  };

  return <div className={styles.wrap}>
    <div className={styles.bar}>
      <div className={styles.label}>
        <span>Concrete systems</span>
        <strong>Add the building blocks this scope can use.</strong>
      </div>
      <div className={styles.quick}>
        {SYSTEMS.slice(0, 5).map(system => <button key={system.id} type="button" disabled={disabled || pending} onClick={() => add(system)} title={system.detail}><system.icon size={13} />{system.label}</button>)}
      </div>
      <button type="button" className={styles.addButton} disabled={disabled || pending} onClick={() => setOpen(value => !value)}><Plus size={14} />Add system<ChevronDown size={12} /></button>
      {message && <span className={styles.message}>{message}</span>}
    </div>

    {open && <div className={styles.menu} role="dialog" aria-label="Add concrete system">
      <header><div><span>System library</span><strong>Choose a concrete calculation block</strong></div><button type="button" onClick={() => setOpen(false)} aria-label="Close system library"><X size={15} /></button></header>
      <div className={styles.systemGrid}>
        {(['Concrete', 'Reinforcing', 'Materials', 'Production'] as const).map(group => <section key={group}>
          <h4>{group}</h4>
          <div>{SYSTEMS.filter(system => system.group === group).map(system => <button key={system.id} type="button" disabled={pending} onClick={() => add(system)}>
            <span className={styles.icon}><system.icon size={15} /></span>
            <span><strong>{system.label}</strong><small>{system.detail}</small></span>
            <Plus size={13} />
          </button>)}</div>
        </section>)}
      </div>
      <footer>Systems create editable variables and starter math. They do not choose project dimensions, bar layouts, production rates, products, or prices for you.</footer>
    </div>}
  </div>;
}
