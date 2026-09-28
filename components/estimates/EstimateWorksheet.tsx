'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { PourtraceDialog } from '@/components/overlays/PourtraceOverlays';
import { assignTakeoffMeasurementSection, updateGeneratedEstimateItemPrice } from '@/app/estimates/actions';
import { formatTakeoffMeasurement } from '@/lib/takeoff/lengthFormat';
import {
  getWorksheetCostBuckets,
  getWorksheetLineQuantity,
  getWorksheetPricingLabel,
  getWorksheetPricingState,
} from '@/lib/estimating/worksheet';
import styles from './EstimateWorksheet.module.css';

type Section = {
  id: string;
  name: string;
  scope_type?: string | null;
  sort_order?: number | null;
};

type Measurement = {
  id: string;
  name: string;
  location?: string | null;
  drawing_reference?: string | null;
  raw_quantity?: number | string | null;
  raw_unit?: string | null;
  estimate_section_id?: string | null;
  created_at?: string | null;
};

type EstimateItem = {
  id: string;
  section_id?: string | null;
  item_type?: string | null;
  description?: string | null;
  quantity?: number | string | null;
  unit?: string | null;
  unit_cost?: number | string | null;
  direct_cost?: number | string | null;
  regular_hours?: number | string | null;
  overtime_hours?: number | string | null;
  source_takeoff_measurement_id?: string | null;
  source_takeoff_output_id?: string | null;
  sort_order?: number | null;
  created_at?: string | null;
};

type TakeoffOutput = {
  id: string;
  measurement_id: string;
  generated_estimate_item_id?: string | null;
  label?: string | null;
  pricing_status?: string | null;
  cost_source?: string | null;
  price_source_kind?: string | null;
  price_source_label?: string | null;
  price_source_reference?: string | null;
  price_effective_date?: string | null;
  baseline_man_hours_per_unit?: number | string | null;
  baseline_source?: string | null;
};

const money = (value: unknown) => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
}).format(Number(value || 0));

const decimal = (value: unknown, digits = 2) => Number(value || 0).toLocaleString('en-US', {
  maximumFractionDigits: digits,
});

const statusClass = (state: ReturnType<typeof getWorksheetPricingState>) => {
  if (state === 'no_input') return styles.required;
  if (state === 'price_required') return styles.required;
  if (state === 'manual_override') return styles.override;
  if (state === 'priced') return styles.priced;
  return styles.manual;
};

function CostCells({ item }: { item: EstimateItem }) {
  const buckets = getWorksheetCostBuckets(item);
  return <>
    <div className={`${styles.money} ${buckets.material ? '' : styles.mutedMoney}`}>{buckets.material ? money(buckets.material) : '—'}</div>
    <div className={`${styles.money} ${buckets.labor ? '' : styles.mutedMoney}`}>{buckets.labor ? money(buckets.labor) : '—'}</div>
    <div className={`${styles.money} ${buckets.equipment ? '' : styles.mutedMoney}`}>{buckets.equipment ? money(buckets.equipment) : '—'}</div>
    <div className={styles.money}>{money(buckets.total)}</div>
  </>;
}

function WorksheetRow({
  estimateId,
  item,
  output,
  locked,
  autoOpenPrice,
}: {
  estimateId: string;
  item: EstimateItem;
  output?: TakeoffOutput;
  locked: boolean;
  autoOpenPrice?: boolean;
}) {
  const [priceOpen,setPriceOpen]=useState(false);
  const [savePending,setSavePending]=useState(false);
  const [saveMessage,setSaveMessage]=useState('');
  const router=useRouter();
  useEffect(()=>{if(autoOpenPrice)setPriceOpen(true);},[autoOpenPrice]);
  const { quantity, unit } = getWorksheetLineQuantity(item);
  const state = getWorksheetPricingState(item, output);
  const unitCost = Number(item.unit_cost || 0);
  const primaryLabel = output?.label || item.description || 'Estimate line';
  const provenanceLabel = output?.price_source_label || output?.cost_source || 'assembly output';
  const provenanceMeta = output
    ? [
      output.price_effective_date ? `effective ${output.price_effective_date}` : null,
      output.price_source_reference,
    ].filter(Boolean).join(' · ')
    : '';
  const source = output
    ? `${String(item.item_type || 'cost').toUpperCase()} · ${provenanceLabel}`
    : `${String(item.item_type || 'cost').toUpperCase()} · manual estimate line`;

  return <div className={styles.row}>
    <div className={styles.description}>
      <strong>{primaryLabel}</strong>
      <span title={item.description || undefined}>{source}</span>
      {provenanceMeta ? <span title={provenanceMeta}>{provenanceMeta}</span> : null}
    </div>
    <div className={styles.number}>{formatTakeoffMeasurement(quantity, unit)}</div>
    <div>
      {output && !locked ? <PourtraceDialog variant="review" title={`Unit cost · ${primaryLabel}`} description={`${formatTakeoffMeasurement(quantity, unit)} · ${String(item.item_type || 'cost').toLowerCase()}`} trigger={<span className={styles.priceTrigger}>{money(unitCost)} <span>Edit</span></span>} triggerClassName={styles.priceButton} open={priceOpen} onOpenChange={open=>{setPriceOpen(open);if(!open&&autoOpenPrice){const url=new URL(window.location.href);url.searchParams.delete('costOutput');window.history.replaceState(null,'',url);}}}>
        <div className={styles.priceEvidence}>
          <div><span>Current unit cost</span><strong>{money(unitCost)} / {unit || 'unit'}</strong></div>
          <div><span>Recorded source</span><strong>{output.price_source_label || output.cost_source || 'No source recorded'}</strong></div>
          {String(item.item_type).toLowerCase() === 'labor' ? <div><span>{String(output.baseline_source || '').toLowerCase().includes('national estimator') ? 'National Estimator recommendation' : 'Production reference'}</span><strong>{output.baseline_man_hours_per_unit != null ? `${decimal(output.baseline_man_hours_per_unit, 4)} MH / unit` : 'No verified production recommendation'}{output.baseline_source ? ` · ${output.baseline_source}` : ''}</strong></div> : <div><span>Cost recommendation</span><strong>No company history or catalog recommendation is available yet.</strong></div>}
        </div>
        <form onSubmit={async event=>{event.preventDefault();if(savePending)return;setSavePending(true);setSaveMessage('');try{await updateGeneratedEstimateItemPrice(new FormData(event.currentTarget));setSaveMessage('Unit cost saved. Pricing status is refreshing.');router.refresh();}catch(error){setSaveMessage(`Save failed: ${error instanceof Error?error.message:'Try again.'}`);}finally{setSavePending(false);}}} className={styles.priceDialogForm}>
        <input type="hidden" name="estimate_id" value={estimateId}/>
        <input type="hidden" name="output_id" value={output.id}/>
        <label htmlFor={`unit-cost-${output.id}`}>Unit cost override</label>
        <input
          id={`unit-cost-${output.id}`}
          aria-label={`Unit cost for ${primaryLabel}`}
          name="unit_cost"
          type="number"
          min="0"
          step="0.01"
          defaultValue={unitCost || ''}
          placeholder="0.00"
          required
        />
        <button type="submit" disabled={savePending}>{savePending?'Saving…':'Save unit cost'}</button>
        {saveMessage?<p role="status">{saveMessage}</p>:null}
      </form>
      <a className="mt-3 inline-flex text-xs font-semibold text-primary underline-offset-2 hover:underline" href={`/estimates/${encodeURIComponent(estimateId)}?pricingOutput=${encodeURIComponent(output.id)}#pricing-coverage`}>Back to Pricing Coverage</a>
      </PourtraceDialog> : <div className={styles.priceReadout}>
        <span>{money(unitCost)}</span>
        <small>per {unit || 'unit'}</small>
      </div>}
    </div>
    <CostCells item={item}/>
    <div><span className={`${styles.status} ${statusClass(state)}`}><i aria-hidden="true"/>{getWorksheetPricingLabel(state).toLowerCase()}</span></div>
  </div>;
}

function WorksheetSubtotal({ items }: { items: EstimateItem[] }) {
  const totals = items.reduce((sum, item) => {
    const cost = getWorksheetCostBuckets(item);
    sum.material += cost.material;
    sum.labor += cost.labor;
    sum.equipment += cost.equipment;
    sum.total += cost.total;
    return sum;
  }, { material: 0, labor: 0, equipment: 0, total: 0 });

  return <div className={styles.subtotal}>
    <div className={styles.subtotalLabel}>Measurement subtotal</div>
    <div className={styles.money}>{money(totals.material)}</div>
    <div className={styles.money}>{money(totals.labor)}</div>
    <div className={styles.money}>{money(totals.equipment)}</div>
    <div className={styles.money}>{money(totals.total)}</div>
    <div/>
  </div>;
}

export function EstimateWorksheet({
  estimateId,
  sections,
  measurements,
  items,
  outputs,
  locked,
}: {
  estimateId: string;
  sections: Section[];
  measurements: Measurement[];
  items: EstimateItem[];
  outputs: TakeoffOutput[];
  locked: boolean;
}) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'scope' | 'name' | 'cost'>('scope');
  const [focusOutputId,setFocusOutputId]=useState<string|null>(null);
  useEffect(()=>{
    const id=new URLSearchParams(window.location.search).get('costOutput');
    const output=outputs.find(row=>row.id===id);
    const item=output?.generated_estimate_item_id?items.find(row=>row.id===output.generated_estimate_item_id):null;
    if(!output||!item)return;
    setQuery(item.description||output.label||'');
    setFocusOutputId(output.id);
  },[outputs,items]);
  const sectionMap = new Map(sections.map(section => [section.id, section]));
  const sectionOrder = new Map(sections.map((section, index) => [section.id, Number(section.sort_order ?? index)]));
  const outputByItem = new Map(outputs.filter(output => output.generated_estimate_item_id).map(output => [output.generated_estimate_item_id!, output]));
  const generatedByMeasurement = new Map<string, EstimateItem[]>();
  const manualBySection = new Map<string, EstimateItem[]>();

  for (const item of items) {
    if (item.source_takeoff_measurement_id) {
      const rows = generatedByMeasurement.get(item.source_takeoff_measurement_id) || [];
      rows.push(item);
      generatedByMeasurement.set(item.source_takeoff_measurement_id, rows);
    } else {
      const key = item.section_id || 'unassigned';
      const rows = manualBySection.get(key) || [];
      rows.push(item);
      manualBySection.set(key, rows);
    }
  }

  const measurementGroups = measurements
    .filter(measurement => (generatedByMeasurement.get(measurement.id) || []).length > 0)
    .sort((first, second) => {
      const firstSection = first.estimate_section_id ? sectionOrder.get(first.estimate_section_id) ?? 999999 : 999999;
      const secondSection = second.estimate_section_id ? sectionOrder.get(second.estimate_section_id) ?? 999999 : 999999;
      if (sort === 'name') return String(first.name).localeCompare(String(second.name));
      if (sort === 'cost') {
        const firstCost = (generatedByMeasurement.get(first.id) || []).reduce((sum, item) => sum + Number(item.direct_cost || 0), 0);
        const secondCost = (generatedByMeasurement.get(second.id) || []).reduce((sum, item) => sum + Number(item.direct_cost || 0), 0);
        return secondCost - firstCost || String(first.name).localeCompare(String(second.name));
      }
      return firstSection - secondSection || String(first.name).localeCompare(String(second.name));
    })
    .filter(measurement => {
      const term = query.trim().toLocaleLowerCase();
      if (!term) return true;
      const sectionName = measurement.estimate_section_id ? sectionMap.get(measurement.estimate_section_id)?.name || '' : '';
      return [measurement.name, measurement.location, measurement.drawing_reference, sectionName,
        ...(generatedByMeasurement.get(measurement.id) || []).map(item => item.description || ''),
      ].some(value => String(value || '').toLocaleLowerCase().includes(term));
    });

  const manualGroups = [...manualBySection.entries()].sort(([first], [second]) => {
    const firstOrder = first === 'unassigned' ? 999999 : sectionOrder.get(first) ?? 999999;
    const secondOrder = second === 'unassigned' ? 999999 : sectionOrder.get(second) ?? 999999;
    return firstOrder - secondOrder;
  }).map(([sectionId, rows]) => [sectionId, rows.filter(item => {
    const term = query.trim().toLocaleLowerCase();
    return !term || [sectionMap.get(sectionId)?.name, item.description, item.item_type].some(value => String(value || '').toLocaleLowerCase().includes(term));
  })] as const).filter(([, rows]) => rows.length > 0);

  const visibleLineCount = measurementGroups.reduce((count, measurement) => count + (generatedByMeasurement.get(measurement.id)?.length || 0), 0)
    + manualGroups.reduce((count, [, rows]) => count + rows.length, 0);
  const assemblyGroups = [...new Set(measurementGroups.map(measurement => measurement.estimate_section_id || 'unassigned'))]
    .map(sectionId => {
      const groupMeasurements = measurementGroups.filter(measurement => (measurement.estimate_section_id || 'unassigned') === sectionId);
      const groupItems = groupMeasurements.flatMap(measurement => generatedByMeasurement.get(measurement.id) || []);
      return { sectionId, name: sectionMap.get(sectionId)?.name || 'Unassigned scope', measurements: groupMeasurements, lineCount: groupItems.length, cost: groupItems.reduce((sum, item) => sum + Number(item.direct_cost || 0), 0) };
    }).sort((first, second) => sort === 'name' ? first.name.localeCompare(second.name) : sort === 'cost' ? second.cost - first.cost || first.name.localeCompare(second.name) : (sectionOrder.get(first.sectionId) ?? 999999) - (sectionOrder.get(second.sectionId) ?? 999999));

  const exportVisible = () => {
    const columns = ['Assembly', 'Condition', 'Cost line', 'Type', 'Quantity', 'Unit', 'Unit cost', 'Direct cost', 'Pricing status'];
    const records = [
      ...measurementGroups.flatMap(measurement => (generatedByMeasurement.get(measurement.id) || []).map(item => {
        const output = outputByItem.get(item.id);
        const { quantity, unit } = getWorksheetLineQuantity(item);
        return [sectionMap.get(measurement.estimate_section_id || '')?.name || 'Unassigned scope', measurement.name, output?.label || item.description || '', item.item_type || '', quantity, unit, item.unit_cost || 0, item.direct_cost || 0, getWorksheetPricingLabel(getWorksheetPricingState(item, output))];
      })),
      ...manualGroups.flatMap(([sectionId, rows]) => rows.map(item => {
        const { quantity, unit } = getWorksheetLineQuantity(item);
        return [sectionMap.get(sectionId)?.name || 'Unassigned / General', 'Manual costs', item.description || '', item.item_type || '', quantity, unit, item.unit_cost || 0, item.direct_cost || 0, getWorksheetPricingLabel(getWorksheetPricingState(item, undefined))];
      })),
    ];
    const csv = [columns, ...records].map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `estimate-${estimateId}-lines.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  if (items.length === 0) {
    return <div className={styles.shell}><div className={styles.empty}>No estimate cost lines yet. Start with Takeoff so assemblies can generate the cost structure.</div></div>;
  }

  return <div className={styles.shell}>
    <div className={styles.toolbar}>
      <label className={styles.searchLabel}>Search assembly or line<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Assembly, condition, resource…" type="search" /></label>
      <label className={styles.sortLabel}>Sort<select value={sort} onChange={event => setSort(event.target.value as typeof sort)}><option value="scope">Scope order</option><option value="name">Condition A–Z</option><option value="cost">Direct cost, high to low</option></select></label>
      <span className={styles.resultCount} aria-live="polite">{assemblyGroups.length + manualGroups.length} assemblies · {visibleLineCount} lines</span>
      <button type="button" className={styles.exportButton} onClick={exportVisible} disabled={!visibleLineCount}>Export visible CSV</button>
    </div>
    <div className={styles.scroller}>
      {assemblyGroups.map(assembly => <details className={styles.assembly} key={`${assembly.sectionId}-${query}`} open={Boolean(query)}>
        <summary className={styles.assemblyHead}><ChevronRight className={styles.disclosureIcon} size={16}/><strong>{assembly.name}</strong><span>{assembly.measurements.length} condition{assembly.measurements.length === 1 ? '' : 's'} · {assembly.lineCount} cost lines</span><b>{money(assembly.cost)}</b></summary>
      {assembly.measurements.map(measurement => {
        const rows = generatedByMeasurement.get(measurement.id) || [];
        const groupTotal = rows.reduce((sum, row) => sum + Number(row.direct_cost || 0), 0);
        const section = measurement.estimate_section_id ? sectionMap.get(measurement.estimate_section_id) : null;
        const reference = [measurement.location, measurement.drawing_reference].filter(Boolean).join(' · ');
        return <details className={styles.group} key={`${measurement.id}-${query}`} open={Boolean(query)}>
          <summary className={styles.groupHead}>
            <div className={styles.groupIdentity}>
              <div className={styles.groupTitleLine}><ChevronRight className={styles.disclosureIcon} size={15}/><strong>{measurement.name}</strong></div>
              <span>{section?.name || 'Unassigned scope'}{reference ? ` · ${reference}` : ''}</span>
            </div>
            <div className={styles.groupQuantity}>{formatTakeoffMeasurement(measurement.raw_quantity, measurement.raw_unit)}</div>
            <div className={styles.groupMeta}>{rows.length} cost line{rows.length === 1 ? '' : 's'} · {section?.name || 'Unassigned scope'}</div>
            <div className={styles.groupTotal} style={{gridColumn: '7 / span 2'}}>{money(groupTotal)}</div>
          </summary>
          <div className={styles.groupControls}>
            <div className={styles.scopeCell}><span>Estimate scope</span>
              {!locked ? <PourtraceDialog variant="decision" title={`Move condition · ${measurement.name}`} description="Assign this measured condition to an estimate scope area." trigger={<span>{section?.name || 'Unassigned scope'} · Change</span>} triggerClassName={styles.scopeTrigger}>
              <form action={assignTakeoffMeasurementSection} className={styles.scopeForm}>
                <input type="hidden" name="estimate_id" value={estimateId}/>
                <input type="hidden" name="measurement_id" value={measurement.id}/>
                <select name="section_id" defaultValue={measurement.estimate_section_id || ''} disabled={locked} aria-label={`Scope section for ${measurement.name}`}>
                  <option value="">Unassigned scope</option>
                  {sections.map(scope => <option key={scope.id} value={scope.id}>{scope.name}</option>)}
                </select>
                <button type="submit" disabled={locked}>Assign</button>
              </form></PourtraceDialog> : <strong>{section?.name || 'Unassigned scope'}</strong>}
            </div>
            <span>Production</span><span>Unit cost</span><span>Material</span><span>Labor</span><span>Equip / Sub</span><span>Direct</span><span>Status</span>
          </div>
          {rows.map(item => <WorksheetRow key={item.id} estimateId={estimateId} item={item} output={outputByItem.get(item.id)} locked={locked} autoOpenPrice={outputByItem.get(item.id)?.id===focusOutputId}/>) }
          <WorksheetSubtotal items={rows}/>
        </details>;
      })}</details>)}

      {manualGroups.map(([sectionId, rows]) => {
        const section = sectionId === 'unassigned' ? null : sectionMap.get(sectionId);
        const groupTotal = rows.reduce((sum, row) => sum + Number(row.direct_cost || 0), 0);
        return <details className={`${styles.group} ${styles.manualGroup}`} key={`manual-${sectionId}`}>
          <summary className={styles.groupHead}>
            <div className={styles.groupIdentity}>
              <div className={styles.groupTitleLine}><ChevronRight className={styles.disclosureIcon} size={15}/><strong>{section?.name || 'Unassigned / General'} — Manual costs</strong></div>
              <span>Costs entered outside the Takeoff assembly system</span>
            </div>
            <div className={styles.groupQuantity}>{rows.length} line{rows.length === 1 ? '' : 's'}</div>
            <div className={styles.groupMeta}>Manual exception lines</div>
            <div className={styles.groupTotal} style={{gridColumn: '7 / span 2'}}>{money(groupTotal)}</div>
          </summary>
          <div className={styles.groupControls}><span>Manual cost line</span><span>Production</span><span>Unit cost</span><span>Material</span><span>Labor</span><span>Equip / Sub</span><span>Direct</span><span>Status</span></div>
          {rows.map(item => <WorksheetRow key={item.id} estimateId={estimateId} item={item} locked={locked}/>) }
          <WorksheetSubtotal items={rows}/>
        </details>;
      })}
      {visibleLineCount === 0 ? <div className={styles.empty}>No assemblies or cost lines match this search.</div> : null}
    </div>
  </div>;
}
