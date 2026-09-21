import { ChevronRight } from 'lucide-react';
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
};

const money = (value: unknown) => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
}).format(Number(value || 0));

const decimal = (value: unknown, digits = 2) => Number(value || 0).toLocaleString('en-US', {
  maximumFractionDigits: digits,
});

const statusClass = (state: ReturnType<typeof getWorksheetPricingState>) => {
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
}: {
  estimateId: string;
  item: EstimateItem;
  output?: TakeoffOutput;
  locked: boolean;
}) {
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
      {output && !locked ? <form action={updateGeneratedEstimateItemPrice} className={styles.priceForm}>
        <input type="hidden" name="estimate_id" value={estimateId}/>
        <input type="hidden" name="output_id" value={output.id}/>
        <input
          aria-label={`Unit cost for ${primaryLabel}`}
          name="unit_cost"
          type="number"
          min="0"
          step="0.01"
          defaultValue={unitCost || ''}
          placeholder="0.00"
          required
        />
        <button type="submit">Save</button>
      </form> : <div className={styles.priceReadout}>
        <span>{money(unitCost)}</span>
        <small>per {unit || 'unit'}</small>
      </div>}
    </div>
    <CostCells item={item}/>
    <div><span className={`${styles.status} ${statusClass(state)}`}>{getWorksheetPricingLabel(state)}</span></div>
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
      return firstSection - secondSection || String(first.name).localeCompare(String(second.name));
    });

  const manualGroups = [...manualBySection.entries()].sort(([first], [second]) => {
    const firstOrder = first === 'unassigned' ? 999999 : sectionOrder.get(first) ?? 999999;
    const secondOrder = second === 'unassigned' ? 999999 : sectionOrder.get(second) ?? 999999;
    return firstOrder - secondOrder;
  });

  if (items.length === 0) {
    return <div className={styles.shell}><div className={styles.empty}>No estimate cost lines yet. Start with Takeoff so assemblies can generate the cost structure.</div></div>;
  }

  return <div className={styles.shell}>
    <div className={styles.scroller}>
      <div className={styles.grid}>
        <span>Cost line</span>
        <span>Production</span>
        <span>Unit cost</span>
        <span>Material</span>
        <span>Labor</span>
        <span>Equip / Sub</span>
        <span>Direct</span>
        <span>Status</span>
      </div>

      {measurementGroups.map(measurement => {
        const rows = generatedByMeasurement.get(measurement.id) || [];
        const groupTotal = rows.reduce((sum, row) => sum + Number(row.direct_cost || 0), 0);
        const section = measurement.estimate_section_id ? sectionMap.get(measurement.estimate_section_id) : null;
        const reference = [measurement.location, measurement.drawing_reference].filter(Boolean).join(' · ');
        return <details className={styles.group} key={measurement.id} open>
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
            <div className={styles.groupControlLabel}>Estimate scope</div>
            <div className={styles.scopeCell}>
              <form action={assignTakeoffMeasurementSection} className={styles.scopeForm}>
                <input type="hidden" name="estimate_id" value={estimateId}/>
                <input type="hidden" name="measurement_id" value={measurement.id}/>
                <select name="section_id" defaultValue={measurement.estimate_section_id || ''} disabled={locked} aria-label={`Scope section for ${measurement.name}`}>
                  <option value="">Unassigned scope</option>
                  {sections.map(scope => <option key={scope.id} value={scope.id}>{scope.name}</option>)}
                </select>
                <button type="submit" disabled={locked}>Assign</button>
              </form>
            </div>
          </div>
          {rows.map(item => <WorksheetRow key={item.id} estimateId={estimateId} item={item} output={outputByItem.get(item.id)} locked={locked}/>) }
          <WorksheetSubtotal items={rows}/>
        </details>;
      })}

      {manualGroups.map(([sectionId, rows]) => {
        const section = sectionId === 'unassigned' ? null : sectionMap.get(sectionId);
        const groupTotal = rows.reduce((sum, row) => sum + Number(row.direct_cost || 0), 0);
        return <details className={`${styles.group} ${styles.manualGroup}`} key={`manual-${sectionId}`} open>
          <summary className={styles.groupHead}>
            <div className={styles.groupIdentity}>
              <div className={styles.groupTitleLine}><ChevronRight className={styles.disclosureIcon} size={15}/><strong>{section?.name || 'Unassigned / General'} — Manual costs</strong></div>
              <span>Costs entered outside the Takeoff assembly system</span>
            </div>
            <div className={styles.groupQuantity}>{rows.length} line{rows.length === 1 ? '' : 's'}</div>
            <div className={styles.groupMeta}>Manual exception lines</div>
            <div className={styles.groupTotal} style={{gridColumn: '7 / span 2'}}>{money(groupTotal)}</div>
          </summary>
          {rows.map(item => <WorksheetRow key={item.id} estimateId={estimateId} item={item} locked={locked}/>) }
          <WorksheetSubtotal items={rows}/>
        </details>;
      })}
    </div>
  </div>;
}