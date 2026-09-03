'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Blocks3, ChevronDown, ChevronUp, GripHorizontal, Search, Table2 } from 'lucide-react';
import { formatTakeoffQuantityValue } from '@/lib/takeoff/lengthFormat';
import { useTakeoffPaneResize } from '@/lib/takeoff/useTakeoffPaneResize';
import { useAssemblyBuilderContext } from './AssemblyBuilderContext';
import styles from './TakeoffQuantityDock.module.css';

type Props = {
  measurements: any[];
  outputs: any[];
  assemblies: any[];
  versions: any[];
  sections: any[];
  sheets: any[];
  currentSheetId: string | null;
  selectedMeasurementId: string | null;
  onOpenMeasurement: (measurement: any) => void;
};

type WorksheetRow = {
  measurement: any;
  assembly: string;
  section: string;
  sheet: string;
  concrete: string;
  reinforcing: string;
  formwork: string;
  manHours: number;
  cost: number;
  warnings: string[];
};

const ROW_HEIGHT = 32;
const CONCRETE_OUTPUT = /concrete|ready.?mix/;
const REINFORCING_OUTPUT = /rebar|reinforc|mesh/;
const FORMWORK_OUTPUT = /form|shor|brace/;
const money = (value: number) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
}).format(value);
const quantity = (value: unknown, digits = 2) => Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: digits });
const textKey = (output: any) => `${output.component_key || ''} ${output.label || ''}`.toLowerCase();
const displayableOutput = (output: any) => output.is_active !== false || output.pricing_status === 'missing_input';
const outputQuantity = (outputs: any[], match: RegExp) => {
  const relevant = outputs.filter(output => displayableOutput(output) && match.test(textKey(output)));
  if (!relevant.length) return '—';
  const held = relevant.some(output => output.pricing_status === 'missing_input');
  const calculable = relevant.filter(output => output.pricing_status !== 'missing_input');
  const totals = new Map<string, number>();
  for (const output of calculable) {
    const unit = String(output.production_unit || '').toUpperCase() || 'EA';
    totals.set(unit, (totals.get(unit) || 0) + Number(output.production_quantity || 0));
  }
  const measured = [...totals].map(([unit, value]) => `${quantity(value)} ${unit}`).join(' + ');
  return [measured || null, held ? 'HOLD' : null].filter(Boolean).join(' + ') || '—';
};
const outputWarnings = (output: any): string[] => {
  if (output.pricing_status === 'missing_input') {
    const missing = Array.isArray(output.formula_trace?.missing_inputs) ? output.formula_trace.missing_inputs : [];
    const labels = [...new Set(missing.map((input: any) => String(input?.label || '').trim()).filter(Boolean))];
    return labels.length ? labels.map(label => `Input: ${label}`) : ['Input required'];
  }
  if (output.pricing_status === 'missing_labor_rate') return ['Labor rate missing'];
  if (output.pricing_status === 'missing_price') return ['Price missing'];
  return [];
};

export function TakeoffQuantityDock({
  measurements, outputs, assemblies, versions, sections, sheets, currentSheetId, selectedMeasurementId, onOpenMeasurement,
}: Props) {
  useTakeoffPaneResize();
  const builder = useAssemblyBuilderContext();
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ y: number; height: number } | null>(null);
  const [height, setHeight] = useState(228);
  const [collapsed, setCollapsed] = useState(false);
  const [scope, setScope] = useState<'sheet' | 'all'>('sheet');
  const [query, setQuery] = useState('');
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(150);

  const versionMap = useMemo(() => new Map(versions.map((version: any) => [version.id, version])), [versions]);
  const assemblyMap = useMemo(() => new Map(assemblies.map((assembly: any) => [assembly.id, assembly])), [assemblies]);
  const sectionMap = useMemo(() => new Map(sections.map((section: any) => [section.id, section])), [sections]);
  const sheetMap = useMemo(() => new Map(sheets.map((sheet: any) => [sheet.id, sheet])), [sheets]);
  const outputsByMeasurement = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const output of outputs) {
      const list = map.get(output.measurement_id) || [];
      list.push(output);
      map.set(output.measurement_id, list);
    }
    return map;
  }, [outputs]);

  const rows = useMemo<WorksheetRow[]>(() => measurements.map(measurement => {
    const version: any = versionMap.get(measurement.assembly_version_id);
    const assembly: any = version ? assemblyMap.get(version.assembly_id) : null;
    const section: any = sectionMap.get(measurement.estimate_section_id);
    const sheet: any = sheetMap.get(measurement.sheet_id);
    const rowOutputs = (outputsByMeasurement.get(measurement.id) || []).filter(displayableOutput);
    const warnings = [...new Set(rowOutputs.flatMap(outputWarnings))];
    return {
      measurement,
      assembly: assembly?.name || 'Unlinked assembly',
      section: section?.name || 'Unassigned',
      sheet: sheet?.sheet_number || `Page ${sheet?.page_number || '—'}`,
      concrete: outputQuantity(rowOutputs, CONCRETE_OUTPUT),
      reinforcing: outputQuantity(rowOutputs, REINFORCING_OUTPUT),
      formwork: outputQuantity(rowOutputs, FORMWORK_OUTPUT),
      manHours: rowOutputs.reduce((total, output) => total + Number(output.estimated_man_hours || 0), 0),
      cost: rowOutputs.reduce((total, output) => total + Number(output.direct_cost || 0), 0),
      warnings,
    };
  }), [measurements, versionMap, assemblyMap, sectionMap, sheetMap, outputsByMeasurement]);

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter(row => {
      if (scope === 'sheet' && row.measurement.sheet_id !== currentSheetId) return false;
      return !needle || [row.measurement.name, row.assembly, row.section, row.sheet, row.measurement.location]
        .some(value => String(value || '').toLowerCase().includes(needle));
    });
  }, [rows, scope, currentSheetId, query]);

  const totals = useMemo(() => filteredRows.reduce((total, row) => ({
    manHours: total.manHours + row.manHours,
    cost: total.cost + row.cost,
    warnings: total.warnings + row.warnings.length,
  }), { manHours: 0, cost: 0, warnings: 0 }), [filteredRows]);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const update = () => setViewportHeight(body.clientHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(body);
    return () => observer.disconnect();
  }, [collapsed]);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (!dragRef.current) return;
      setHeight(Math.max(150, Math.min(480, dragRef.current.height + dragRef.current.y - event.clientY)));
    };
    const end = () => { dragRef.current = null; document.body.style.cursor = ''; };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      document.body.style.cursor = '';
    };
  }, []);

  useEffect(() => {
    setScrollTop(0);
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [scope, query, currentSheetId]);

  const overscan = 5;
  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - overscan);
  const count = Math.ceil(viewportHeight / ROW_HEIGHT) + overscan * 2;
  const visibleRows = filteredRows.slice(start, start + count);

  if (builder.open) return null;

  return <section
    className={`${styles.dock} ${collapsed ? styles.collapsed : ''}`}
    style={{ height: collapsed ? 38 : height }}
    aria-label="Takeoff quantity worksheet"
  >
    {!collapsed && <button
      type="button"
      className={styles.resizeHandle}
      aria-label="Resize quantity worksheet"
      onPointerDown={event => {
        dragRef.current = { y: event.clientY, height };
        document.body.style.cursor = 'ns-resize';
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
    ><GripHorizontal size={15} /></button>}
    <header className={styles.header}>
      <div className={styles.title}><Table2 size={15} /><strong>Quantity Worksheet</strong><span>{filteredRows.length} measurement{filteredRows.length === 1 ? '' : 's'}</span></div>
      {!collapsed && <>
        <button type="button" className={styles.builderButton} onClick={builder.openLibrary}><Blocks3 size={13} /><span>Assembly Builder</span></button>
        <div className={styles.scope} aria-label="Worksheet scope">
          <button type="button" className={scope === 'sheet' ? styles.active : ''} onClick={() => setScope('sheet')}>This Sheet</button>
          <button type="button" className={scope === 'all' ? styles.active : ''} onClick={() => setScope('all')}>All Sheets</button>
        </div>
        <label className={styles.search}><Search size={13} /><span className="sr-only">Filter worksheet</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Filter measurements" /></label>
        <div className={styles.totals}><span><b>{quantity(totals.manHours)}</b> MH</span><span><b>{money(totals.cost)}</b> direct</span>{totals.warnings > 0 && <span className={styles.totalWarning}><AlertTriangle size={12} /><b>{totals.warnings}</b> hold{totals.warnings === 1 ? '' : 's'}</span>}</div>
      </>}
      <button type="button" className={styles.collapse} aria-expanded={!collapsed} onClick={() => setCollapsed(value => !value)}>{collapsed ? <ChevronUp size={15} /> : <ChevronDown size={15} />}<span>{collapsed ? 'Open' : 'Collapse'}</span></button>
    </header>

    {!collapsed && <div className={styles.grid} role="table" aria-rowcount={filteredRows.length}>
      <div className={`${styles.gridRow} ${styles.gridHeader}`} role="row">
        <span role="columnheader">Measurement</span><span role="columnheader">Quantity</span><span role="columnheader">Unit</span><span role="columnheader">Assembly</span><span role="columnheader">Section</span><span role="columnheader">Concrete</span><span role="columnheader">Reinforcing</span><span role="columnheader">Formwork</span><span role="columnheader">Man-hours</span><span role="columnheader">Direct cost</span><span role="columnheader">Status</span>
      </div>
      <div ref={bodyRef} className={styles.body} onScroll={event => setScrollTop(event.currentTarget.scrollTop)}>
        {filteredRows.length === 0 ? <div className={styles.empty}>No measurements match this worksheet view.</div> : <div className={styles.virtual} style={{ height: filteredRows.length * ROW_HEIGHT }}>
          <div style={{ transform: `translateY(${start * ROW_HEIGHT}px)` }}>
            {visibleRows.map((row, index) => <button
              type="button"
              role="row"
              aria-rowindex={start + index + 2}
              key={row.measurement.id}
              className={`${styles.gridRow} ${styles.dataRow} ${selectedMeasurementId === row.measurement.id ? styles.selected : ''}`}
              onClick={() => onOpenMeasurement(row.measurement)}
            >
              <span role="cell" className={styles.measurement}><strong>{row.measurement.name}</strong><small>{row.sheet}{row.measurement.location ? ` · ${row.measurement.location}` : ''}</small></span>
              <span role="cell" className={styles.numeric} title={`${row.measurement.raw_quantity} ${row.measurement.raw_unit}`}>{formatTakeoffQuantityValue(row.measurement.raw_quantity, row.measurement.raw_unit)}</span>
              <span role="cell">{row.measurement.raw_unit}</span>
              <span role="cell">{row.assembly}</span>
              <span role="cell">{row.section}</span>
              <span role="cell" className={styles.numeric}>{row.concrete}</span>
              <span role="cell" className={styles.numeric}>{row.reinforcing}</span>
              <span role="cell" className={styles.numeric}>{row.formwork}</span>
              <span role="cell" className={styles.numeric}>{quantity(row.manHours)}</span>
              <span role="cell" className={styles.numeric}>{money(row.cost)}</span>
              <span role="cell">{row.warnings.length ? <span className={styles.warning}><AlertTriangle size={12} />{row.warnings.join(', ')}</span> : <span className={styles.ready}>Ready</span>}</span>
            </button>)}
          </div>
        </div>}
      </div>
    </div>}
  </section>;
}
