'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { updateDrawingMeasurementInputs } from '@/app/takeoff/[setId]/actions';
import { enumOptions, isAssemblyVariableActive } from '@/lib/takeoff/assemblyContext';
import styles from './TakeoffDrawingWorkspace.module.css';

type Props = {
  measurement: any;
  version: any;
  assembly: any;
  variables: any[];
  outputs: any[];
  takeoffSetId: string;
  locked: boolean;
  onMessage: (message: string) => void;
};

const editableVariables = (variables: any[], versionId: string | undefined, primaryMeasurement: string | undefined) =>
  variables.filter(variable => variable.assembly_version_id === versionId)
    .filter(variable => !(variable.variable_key === 'perimeter_lf' && primaryMeasurement === 'SF'));

const initialValues = (measurement: any, rows: any[]) => {
  const stored = measurement?.variables && typeof measurement.variables === 'object' ? measurement.variables : {};
  const next: Record<string, string> = {};
  for (const variable of rows) {
    const hasStored = Object.prototype.hasOwnProperty.call(stored, variable.variable_key);
    const value = hasStored ? stored[variable.variable_key] : variable.default_value;
    next[variable.variable_key] = value === null || value === undefined ? '' : String(value);
  }
  return next;
};

export function TakeoffAssemblyInputEditor({ measurement, version, assembly, variables, outputs, takeoffSetId, locked, onMessage }: Props) {
  const router = useRouter();
  const rows = useMemo(
    () => editableVariables(variables, version?.id, assembly?.primary_measurement),
    [variables, version?.id, assembly?.primary_measurement],
  );
  const [values, setValues] = useState<Record<string, string>>(() => initialValues(measurement, rows));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValues(initialValues(measurement, rows));
  }, [measurement, rows]);

  const missingLabels = useMemo(() => {
    const labels = new Set<string>();
    for (const output of outputs) {
      if (output.pricing_status !== 'missing_input') continue;
      const missing = Array.isArray(output.formula_trace?.missing_inputs) ? output.formula_trace.missing_inputs : [];
      for (const input of missing) {
        const label = String(input?.label || '').trim();
        if (label) labels.add(label);
      }
    }
    return [...labels];
  }, [outputs]);

  if (!rows.length) return null;

  const recalculate = async () => {
    if (locked || saving) return;
    setSaving(true);
    try {
      const result = await updateDrawingMeasurementInputs({
        measurementId: measurement.id,
        takeoffSetId,
        variables: values,
      });
      onMessage(result.inputHolds
        ? `Assembly recalculated · ${result.inputHolds} input hold${result.inputHolds === 1 ? '' : 's'} remain`
        : 'Assembly recalculated · input holds cleared');
      router.refresh();
    } catch (error: any) {
      onMessage(error?.message || 'Could not recalculate assembly inputs.');
    } finally {
      setSaving(false);
    }
  };

  return <div>
    <div className={styles.groupTitle}>Assembly Inputs</div>
    <div className={styles.groupHelp}>Change estimating assumptions here. Carez recalculates dependent quantities and linked estimate lines without redrawing the takeoff.</div>
    {missingLabels.length > 0 && <div className={styles.statusWarn}>Input required: {missingLabels.join(', ')}. Geometry and unaffected assembly outputs are already saved.</div>}
    <div className={styles.variableGrid}>{rows.filter(variable => isAssemblyVariableActive(variable, values)).map(variable => <label className={styles.field} key={variable.id}>
      <span>{variable.label}{variable.required ? ' *' : ''}</span>
      {variable.value_type === 'boolean' ? <span className={styles.checkRow}><input
          type="checkbox"
          checked={values[variable.variable_key] === 'true'}
          disabled={locked || saving}
          onChange={event => setValues(current => ({ ...current, [variable.variable_key]: event.target.checked ? 'true' : 'false' }))}
        /> Enabled</span> : variable.value_type === 'enum' ? <select
          value={values[variable.variable_key] ?? ''}
          disabled={locked || saving}
          onChange={event => setValues(current => ({ ...current, [variable.variable_key]: event.target.value }))}
        ><option value="">Select…</option>{enumOptions(variable.options).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <div className={styles.inputUnit}>
        <input
          type={['number', 'dimension', 'percentage'].includes(variable.value_type) ? 'number' : 'text'}
          step="any"
          min={variable.min_value ?? undefined}
          max={variable.max_value ?? undefined}
          value={values[variable.variable_key] ?? ''}
          disabled={locked || saving}
          onChange={event => setValues(current => ({ ...current, [variable.variable_key]: event.target.value }))}
        />
        {variable.unit && <b>{variable.unit}</b>}
      </div>}
      {variable.help_text && <small>{variable.help_text}</small>}
    </label>)}</div>
    {!locked && <button type="button" className={styles.primary} disabled={saving} onClick={() => void recalculate()}>
      {saving ? <RefreshCw size={14}/> : <Check size={14}/>} {saving ? 'Recalculating…' : 'Recalculate Assembly'}
    </button>}
  </div>;
}
