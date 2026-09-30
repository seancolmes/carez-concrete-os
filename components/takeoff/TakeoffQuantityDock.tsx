'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {WarningRegular as AlertTriangle,ChevronDownRegular as ChevronDown,ChevronUpRegular as ChevronUp,ReOrderDotsHorizontalRegular as GripHorizontal,SearchRegular as Search,TableRegular as Table2} from '@fluentui/react-icons';
import { Button, Input } from '@fluentui/react-components';
import {
  projectConditionWorksheet,
  type ConditionWorksheetAuthority,
} from '@/lib/takeoff/conditionWorksheet';
import { formatTakeoffQuantityValue } from '@/lib/takeoff/lengthFormat';
import { useTakeoffPaneResize } from '@/lib/takeoff/useTakeoffPaneResize';
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
  issues: string[];
  status: string;
  pricingMissing: number;
};

const ROW_HEIGHT = 32;
const CONCRETE_OUTPUT = /concrete|ready.?mix/;
const REINFORCING_OUTPUT = /rebar|reinforc|mesh/;
const FORMWORK_OUTPUT = /form|shor|brace/;
const COLUMN_STORAGE_KEY = 'carez.takeoff.quantityWorksheet.columns.v1';
const COLUMN_LABELS = ['Measurement', 'Quantity', 'Unit', 'Condition / assembly', 'Section', 'Concrete', 'Reinforcing', 'Formwork', 'Man-hours', 'Direct cost', 'Status'] as const;
const DEFAULT_COLUMN_WIDTHS = [220, 96, 64, 200, 160, 120, 120, 120, 96, 112, 200];
const MIN_COLUMN_WIDTHS = [150, 72, 50, 120, 105, 90, 90, 90, 78, 88, 130];
const MAX_COLUMN_WIDTH = 520;

const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
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

export function TakeoffQuantityDock({ measurements, outputs, assemblies, versions, sections, sheets, currentSheetId, selectedMeasurementId, onOpenMeasurement }: Props) {
  useTakeoffPaneResize();
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const heightDragRef = useRef<{ y: number; height: number } | null>(null);
  const columnDragRef = useRef<{ index: number; x: number; width: number } | null>(null);
  const [height, setHeight] = useState(228);
  const [collapsed, setCollapsed] = useState(true);
  const [resizing, setResizing] = useState(false);
  const [scope, setScope] = useState<'sheet' | 'all'>('sheet');
  const [query, setQuery] = useState('');
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(150);
  const [columnWidths, setColumnWidths] = useState<number[]>(DEFAULT_COLUMN_WIDTHS);
  const [conditionAuthorities, setConditionAuthorities] = useState<ConditionWorksheetAuthority[]>([]);
  const [conditionAware, setConditionAware] = useState(false);

  const versionMap = useMemo(() => new Map(versions.map((version: any) => [version.id, version])), [versions]);
  const assemblyMap = useMemo(() => new Map(assemblies.map((assembly: any) => [assembly.id, assembly])), [assemblies]);
  const sectionMap = useMemo(() => new Map(sections.map((section: any) => [section.id, section])), [sections]);
  const sheetMap = useMemo(() => new Map(sheets.map((sheet: any) => [sheet.id, sheet])), [sheets]);
  const authorityByMeasurement = useMemo(() => new Map(conditionAuthorities.map(authority => [authority.measurementId, authority])), [conditionAuthorities]);
  const outputsByMeasurement = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const output of outputs) {
      const list = map.get(output.measurement_id) || [];
      list.push(output);
      map.set(output.measurement_id, list);
    }
    return map;
  }, [outputs]);

  useEffect(() => {
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<{ authorities?: ConditionWorksheetAuthority[] }>).detail;
      setConditionAuthorities(Array.isArray(detail?.authorities) ? detail.authorities : []);
      setConditionAware(true);
    };
    window.addEventListener('carez:condition-worksheet-state', receive as EventListener);
    window.dispatchEvent(new CustomEvent('carez:condition-worksheet-request'));
    return () => window.removeEventListener('carez:condition-worksheet-state', receive as EventListener);
  }, []);

  const rows = useMemo<WorksheetRow[]>(() => measurements.map(measurement => {
    const version: any = versionMap.get(measurement.assembly_version_id);
    const assembly: any = version ? assemblyMap.get(version.assembly_id) : null;
    const section: any = sectionMap.get(measurement.estimate_section_id);
    const sheet: any = sheetMap.get(measurement.sheet_id);
    const authority = authorityByMeasurement.get(measurement.id);
    if (authority) {
      const projected = projectConditionWorksheet(authority);
      return {
        measurement,
        assembly: authority.conditionName,
        section: section?.name || 'Unassigned',
        sheet: sheet?.sheet_number || `Page ${sheet?.page_number || '—'}`,
        concrete: projected.concrete,
        reinforcing: projected.reinforcing,
        formwork: projected.formwork,
        manHours: projected.manHours,
        cost: projected.cost,
        issues: projected.issues,
        status: projected.status,
        pricingMissing: projected.pricingMissing,
      };
    }

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
      issues: warnings,
      status: warnings.length ? `${conditionAware ? 'Compatibility · ' : ''}${warnings.length} issue${warnings.length === 1 ? '' : 's'}` : conditionAware ? 'Compatibility' : 'Ready',
      pricingMissing: rowOutputs.filter(output => output.pricing_status === 'missing_price' || output.pricing_status === 'missing_labor_rate').length,
    };
  }), [measurements, versionMap, assemblyMap, sectionMap, sheetMap, outputsByMeasurement, authorityByMeasurement, conditionAware]);

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter(row => {
      if (scope === 'sheet' && row.measurement.sheet_id !== currentSheetId) return false;
      return !needle || [row.measurement.name, row.assembly, row.section, row.sheet, row.measurement.location].some(value => String(value || '').toLowerCase().includes(needle));
    });
  }, [rows, scope, currentSheetId, query]);

  const totals = useMemo(() => filteredRows.reduce((total, row) => ({
    manHours: total.manHours + row.manHours,
    cost: total.cost + row.cost,
    issues: total.issues + row.issues.length,
    pricingMissing: total.pricingMissing + row.pricingMissing,
  }), { manHours: 0, cost: 0, issues: 0, pricingMissing: 0 }), [filteredRows]);

  const gridWidth = columnWidths.reduce((total, width) => total + width, 0);
  const gridStyle = useMemo<CSSProperties>(() => ({ gridTemplateColumns: columnWidths.map(width => `${width}px`).join(' '), minWidth: `${gridWidth}px` }), [columnWidths, gridWidth]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(COLUMN_STORAGE_KEY);
      if (!raw) return;
      const stored = JSON.parse(raw);
      if (!Array.isArray(stored) || stored.length !== DEFAULT_COLUMN_WIDTHS.length) return;
      const safe = stored.map((value, index) => Math.max(MIN_COLUMN_WIDTHS[index], Math.min(MAX_COLUMN_WIDTH, Number(value) || DEFAULT_COLUMN_WIDTHS[index])));
      setColumnWidths(safe);
    } catch { /* Keep defaults. */ }
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(columnWidths)); }
    catch { /* Browser storage is optional. */ }
  }, [columnWidths]);

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
      if (heightDragRef.current) setHeight(Math.max(150, Math.min(480, heightDragRef.current.height + heightDragRef.current.y - event.clientY)));
      if (columnDragRef.current) {
        const { index, x, width } = columnDragRef.current;
        const nextWidth = Math.max(MIN_COLUMN_WIDTHS[index], Math.min(MAX_COLUMN_WIDTH, width + event.clientX - x));
        setColumnWidths(current => current.map((currentWidth, currentIndex) => currentIndex === index ? nextWidth : currentWidth));
      }
    };
    const end = () => {
      setResizing(false);
      heightDragRef.current = null;
      columnDragRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, []);

  useEffect(() => {
    setScrollTop(0);
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [scope, query, currentSheetId]);

  useEffect(() => {
    const selectMeasurement = (event: Event) => {
      const measurementId = String((event as CustomEvent<{ measurementId?: string }>).detail?.measurementId || '');
      const measurement = measurements.find(row => row.id === measurementId);
      if (measurement) onOpenMeasurement(measurement);
    };
    window.addEventListener('carez:select-takeoff-measurement', selectMeasurement as EventListener);
    return () => window.removeEventListener('carez:select-takeoff-measurement', selectMeasurement as EventListener);
  }, [measurements, onOpenMeasurement]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('carez:takeoff-selection-change', { detail: { measurementId: selectedMeasurementId } }));
  }, [selectedMeasurementId]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('carez:takeoff-sheet-change', { detail: { sheetId: currentSheetId } }));
  }, [currentSheetId]);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body || collapsed || !selectedMeasurementId) return;
    const index = filteredRows.findIndex(row => row.measurement.id === selectedMeasurementId);
    if (index < 0) return; // Respect the estimator's active filters.
    const top = index * ROW_HEIGHT;
    if (top < body.scrollTop) body.scrollTop = top;
    else if (top + ROW_HEIGHT > body.scrollTop + body.clientHeight) body.scrollTop = top + ROW_HEIGHT - body.clientHeight;
    setScrollTop(body.scrollTop);
  }, [selectedMeasurementId, collapsed, filteredRows]);

  const overscan = 5;
  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - overscan);
  const count = Math.ceil(viewportHeight / ROW_HEIGHT) + overscan * 2;
  const visibleRows = filteredRows.slice(start, start + count);

  const rollups=filteredRows.reduce((result,row)=>{
    const measured=Number(row.measurement.raw_quantity);
    if(row.measurement.raw_unit==='SF'&&Number.isFinite(measured))result.sf+=measured;
    if(row.measurement.raw_unit==='LF'&&Number.isFinite(measured))result.lf+=measured;
    const authority=authorityByMeasurement.get(row.measurement.id);
    if(authority){
      if(result.conditions.has(authority.conditionVersionId))return result;
      result.conditions.add(authority.conditionVersionId);
      const concrete=authority.outputs.find(output=>output.output_key==='concrete.installed_cy');
      if(!authority.calculated||authority.pendingRecalculation||!concrete||concrete.status==='held'||concrete.production_quantity===null){result.pending=true;return result;}
      if(concrete.status==='ready'){result.cy+=Number(concrete.production_quantity);result.hasConcrete=true;}
    }else{
      const concrete=(outputsByMeasurement.get(row.measurement.id)||[]).filter(output=>displayableOutput(output)&&output.production_unit==='CY'&&CONCRETE_OUTPUT.test(textKey(output))&&!/procurement|order|waste/.test(textKey(output)));
      for(const output of concrete){
        if(output.pricing_status==='missing_input'||output.production_quantity===null){result.pending=true;continue;}
        result.cy+=Number(output.production_quantity||0);result.hasConcrete=true;
      }
    }
    return result;
  },{cy:0,sf:0,lf:0,hasConcrete:false,pending:false,conditions:new Set<string>()});

  return <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 backdrop-blur-xl bg-[#121212]/85 border border-[#343A3F] shadow-[0_10px_40px_rgba(0,0,0,0.5)] rounded-full px-4 py-2 max-w-[calc(100%-2rem)] text-white cursor-default" aria-label="Takeoff quantity dock" onClick={event=>event.stopPropagation()} onDoubleClick={event=>event.stopPropagation()} onPointerDown={event=>event.stopPropagation()} onPointerUp={event=>event.stopPropagation()} onWheel={event=>event.stopPropagation()} onKeyDown={event=>{if(event.key==='Escape')setCollapsed(true);event.stopPropagation();}}>
    <div><div className="text-[9px] font-mono text-[#A1A1AA] uppercase tracking-wider">CY · installed</div><output className="text-[12px] font-mono tabular-nums font-semibold text-white">{rollups.hasConcrete?quantity(rollups.cy):'—'}{rollups.pending?' *':''}</output></div>
    <span className="h-5 w-px shrink-0 bg-[#343A3F]" aria-hidden="true"/>
    <div><div className="text-[9px] font-mono text-[#A1A1AA] uppercase tracking-wider">SF · measured</div><output className="text-[12px] font-mono tabular-nums font-semibold text-white">{quantity(rollups.sf)}</output></div>
    <span className="h-5 w-px shrink-0 bg-[#343A3F]" aria-hidden="true"/>
    <div><div className="text-[9px] font-mono text-[#A1A1AA] uppercase tracking-wider">LF · measured</div><output className="text-[12px] font-mono tabular-nums font-semibold text-white">{quantity(rollups.lf)}</output></div>
    <Button type="button" appearance="subtle" size="small" aria-label="Quantity Worksheet" aria-expanded={!collapsed} aria-controls="takeoff-quantity-worksheet" onClick={()=>setCollapsed(value=>!value)}><Table2 fontSize={14}/></Button>
    {rollups.pending?<span className="absolute -top-4 left-2 whitespace-nowrap text-[9px] text-[#A1A1AA]">* Partial · calculation pending or held</span>:null}
    <section id="takeoff-quantity-worksheet" hidden={collapsed} className={`${styles.dock} ${styles.floatingWorksheet}`} style={{height}} aria-label="Takeoff quantity worksheet" data-resizing={resizing} data-current-sheet-id={currentSheetId || ''}>

    {!collapsed && <Button type="button" className={styles.resizeHandle} aria-label="Resize quantity worksheet" title="Drag or use Up / Down arrows to resize" onKeyDown={event => {
      if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      setHeight(current => event.key === 'Home' ? 150 : event.key === 'End' ? 480 : Math.max(150, Math.min(480, current + (event.key === 'ArrowUp' ? 24 : -24))));
    }} onPointerDown={event => {
      setResizing(true);
      heightDragRef.current = { y: event.clientY, height };
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
      event.currentTarget.setPointerCapture(event.pointerId);
    }}><GripHorizontal fontSize={15} /></Button>}
    <header className={styles.header}>
      <div className={styles.title}><Table2 fontSize={15} /><strong>Quantity Worksheet</strong><span>{filteredRows.length} measurement{filteredRows.length === 1 ? '' : 's'}</span></div>
      {!collapsed && <>
        <div className={styles.scope} aria-label="Worksheet scope">
          <Button type="button" className={scope === 'sheet' ? styles.active : ''} onClick={() => setScope('sheet')}>This Sheet</Button>
          <Button type="button" className={scope === 'all' ? styles.active : ''} onClick={() => setScope('all')}>All Sheets</Button>
        </div>
        <label className={styles.search}><Search fontSize={13} /><span className="sr-only">Filter worksheet</span><Input appearance="underline" value={query} onChange={event => setQuery(event.target.value)} placeholder="Filter measurements" /></label>
        <div className={styles.totals}><span><b>{quantity(totals.manHours)}</b> MH</span><span><b>{money(totals.cost)}</b> direct{totals.pricingMissing > 0 ? ' partial' : ''}</span>{totals.issues > 0 && <span className={styles.totalWarning}><AlertTriangle fontSize={12} /><b>{totals.issues}</b> issue{totals.issues === 1 ? '' : 's'}</span>}</div>
      </>}
      <Button type="button" className={styles.collapse} aria-expanded={!collapsed} aria-controls="takeoff-quantity-grid" onClick={() => setCollapsed(value => !value)}>{collapsed ? <ChevronUp fontSize={15} /> : <ChevronDown fontSize={15} />}<span>{collapsed ? 'Open' : 'Collapse'}</span></Button>
    </header>

    <div id="takeoff-quantity-grid" className={styles.grid} role="table" inert={collapsed} aria-hidden={collapsed||undefined} style={{height:height-38,visibility:collapsed?'hidden':undefined}} aria-rowcount={filteredRows.length}>
      <div className={`${styles.gridRow} ${styles.gridHeader}`} role="row" style={gridStyle}>
        {COLUMN_LABELS.map((label, index) => <span role="columnheader" key={label}>{label}<Button type="button" className={styles.columnResizeHandle} aria-label={`Resize ${label} column`} title="Drag to resize · double-click to reset" onDoubleClick={event => {
          event.preventDefault(); event.stopPropagation();
          setColumnWidths(current => current.map((width, currentIndex) => currentIndex === index ? DEFAULT_COLUMN_WIDTHS[index] : width));
        }} onPointerDown={event => {
          event.preventDefault(); event.stopPropagation();
          columnDragRef.current = { index, x: event.clientX, width: columnWidths[index] };
          document.body.style.cursor = 'col-resize';
          document.body.style.userSelect = 'none';
          event.currentTarget.setPointerCapture(event.pointerId);
        }} /></span>)}
      </div>
      <div ref={bodyRef} className={styles.body} onScroll={event => setScrollTop(event.currentTarget.scrollTop)}>
        {filteredRows.length === 0 ? <div className={styles.empty}>No measurements match this worksheet view.</div> : <div className={styles.virtual} style={{ height: filteredRows.length * ROW_HEIGHT, minWidth: gridWidth }}>
          <div style={{ transform: `translateY(${start * ROW_HEIGHT}px)` }}>
            {visibleRows.map((row, index) => <Button type="button" role="row" aria-rowindex={start + index + 2} aria-selected={selectedMeasurementId === row.measurement.id} data-takeoff-measurement-id={row.measurement.id} key={row.measurement.id} className={`${styles.gridRow} ${styles.dataRow} ${selectedMeasurementId === row.measurement.id ? styles.selected : ''}`} style={gridStyle} onClick={() => onOpenMeasurement(row.measurement)}>
              <span role="cell" className={styles.measurement}><strong>{row.measurement.name}</strong><small>{row.sheet}{row.measurement.location ? ` · ${row.measurement.location}` : ''}</small></span>
              <span role="cell" className={styles.numeric} title={`${row.measurement.raw_quantity} ${row.measurement.raw_unit}`}>{formatTakeoffQuantityValue(row.measurement.raw_quantity, row.measurement.raw_unit)}</span>
              <span role="cell">{row.measurement.raw_unit}</span>
              <span role="cell">{row.assembly}</span>
              <span role="cell">{row.section}</span>
              <span role="cell" className={styles.numeric}>{row.concrete}</span>
              <span role="cell" className={styles.numeric}>{row.reinforcing}</span>
              <span role="cell" className={styles.numeric}>{row.formwork}</span>
              <span role="cell" className={styles.numeric}>{quantity(row.manHours)}</span>
              <span role="cell" className={styles.numeric}>{money(row.cost)}{row.pricingMissing > 0 ? ' partial' : ''}</span>
              <span role="cell" title={row.issues.join('\n')}>{row.status === 'Ready' || row.status === 'Compatibility' ? <span className={styles.ready}>{row.status}</span> : <span className={styles.warning}>{row.issues.length ? <AlertTriangle fontSize={12} /> : null}{row.status}</span>}</span>
            </Button>)}
          </div>
        </div>}
      </div>
    </div>
  </section>
  </div>;
}
