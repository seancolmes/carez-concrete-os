'use client';

import { Plus, Trash2 } from 'lucide-react';
import { CarezNumberField } from '@/components/carez/fields';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  conditionModuleDefinition,
  conditionModuleFieldVisible,
  nextConditionModuleInstanceKey,
} from '@/lib/takeoff/conditions/moduleSchema';
import type {
  ConditionArchetypeDefinition,
  ConditionModuleConfiguration,
  ConditionModuleInputDefinition,
  ConditionModuleKey,
  ConditionScalar,
} from '@/lib/takeoff/conditions/types';

type Props = {
  definition: ConditionArchetypeDefinition;
  moduleKey: ConditionModuleKey;
  modules: ConditionModuleConfiguration[];
  onChange: (modules: ConditionModuleConfiguration[]) => void;
  disabled?: boolean;
};

const titleCase = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());

const PRESETS: Partial<Record<ConditionModuleKey, Array<{ label: string; values: Record<string, ConditionScalar> }>>> = {
  reinforcing: [
    { label: 'Continuous', values: { kind: 'continuous', bar_size: '#4', bars_per_run: 2, layers: 1, faces: 1, splice_policy: 'none', waste_pct: 0 } },
    { label: 'Transverse', values: { kind: 'transverse', bar_size: '#4', spacing_in: 18, pieces_per_location: 1, layers: 1, faces: 1, waste_pct: 0 } },
    { label: 'Dowel / starter', values: { kind: 'dowel', bar_size: '#4', spacing_in: 18, pieces_per_location: 1, layers: 1, faces: 1, waste_pct: 0 } },
    { label: 'Stirrup / tie', values: { kind: 'stirrup', bar_size: '#3', spacing_in: 12, pieces_per_location: 1, layers: 1, faces: 1, waste_pct: 0 } },
    { label: 'Custom', values: { kind: 'custom', bar_size: '#4', layers: 1, faces: 1, waste_pct: 0 } },
  ],
  anchors_embeds: [
    { label: 'Measured anchors', values: { kind: 'anchor_bolt', count_mode: 'measured_role' } },
    { label: 'Anchors @ spacing', values: { kind: 'anchor_bolt', count_mode: 'spacing', per_location: 1, extra_count: 0 } },
    { label: 'Fixed count', values: { kind: 'embed', count_mode: 'fixed_count' } },
  ],
  miscellaneous: [
    { label: 'Item', values: { category: 'other', quantity_ea: 1 } },
  ],
};

function defaultValues(fields: ConditionModuleInputDefinition[]) {
  const values: Record<string, ConditionScalar> = {};
  for (const field of fields) {
    if (field.valueType === 'boolean') values[field.key] = false;
  }
  return values;
}

export function ConditionModuleEditor({ definition, moduleKey, modules, onChange, disabled = false }: Props) {
  const schema = conditionModuleDefinition(definition, moduleKey);
  if (!schema) return <div className="px-3 py-4 text-xs text-muted-foreground">This module is not available for this Condition version.</div>;

  const indexes = modules
    .map((module, index) => ({ module, index }))
    .filter(row => row.module.moduleKey === moduleKey)
    .sort((a, b) => Number(a.module.sortOrder || 0) - Number(b.module.sortOrder || 0));

  const update = (index: number, patch: Partial<ConditionModuleConfiguration>) => {
    onChange(modules.map((module, current) => current === index ? { ...module, ...patch } : module));
  };
  const updateValue = (index: number, key: string, value: ConditionScalar) => {
    const current = modules[index];
    const inputValues = { ...(current.inputValues || {}), [key]: value };
    const inputProvenance = {
      ...(current.inputProvenance || {}),
      [key]: { mode: 'project_value' as const, sourceLabel: 'Condition Properties' },
    };
    update(index, { inputValues, inputProvenance });
  };
  const add = (preset: Record<string, ConditionScalar> = {}, label?: string) => {
    const instanceKey = nextConditionModuleInstanceKey(moduleKey, modules);
    const same = indexes.length;
    const inputValues = { ...defaultValues(schema.inputs), ...preset };
    const inputProvenance = Object.fromEntries(Object.keys(inputValues).map(key => [key, { mode: 'project_value' as const, sourceLabel: 'Condition Properties' }]));
    onChange([...modules, {
      moduleKey,
      instanceKey,
      label: label || `${schema.label} ${same + 1}`,
      enabled: true,
      inputValues,
      inputProvenance,
      sortOrder: Math.max(0, ...modules.map(module => Number(module.sortOrder || 0))) + 10,
    }]);
  };
  const remove = (index: number) => {
    if (modules[index]?.instanceKey === 'default') return;
    onChange(modules.filter((_, current) => current !== index));
  };

  const presets = PRESETS[moduleKey] || [];

  return <div className="space-y-2">
    {indexes.map(({ module, index }) => {
      const values = module.inputValues || {};
      const visible = schema.inputs.filter(field => conditionModuleFieldVisible(moduleKey, field, values));
      return <section key={`${moduleKey}:${module.instanceKey || 'default'}`} className="overflow-hidden rounded-md border border-border bg-card/35">
        <header className="flex min-h-9 items-center gap-2 border-b border-border bg-muted/25 px-2.5">
          <label className="inline-flex min-w-0 flex-1 items-center gap-2 text-xs font-semibold">
            <input type="checkbox" checked={module.enabled} disabled={disabled} onChange={event => update(index, { enabled: event.target.checked })} className="accent-primary" />
            <span className="truncate">{module.label || schema.label}</span>
            <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[9px] font-normal text-muted-foreground">{module.instanceKey || 'default'}</span>
          </label>
          {schema.repeatable && module.instanceKey !== 'default' ? <Button type="button" size="icon-sm" variant="ghost" onClick={() => remove(index)} disabled={disabled} aria-label={`Remove ${module.label || schema.label}`}><Trash2 /></Button> : null}
        </header>
        {module.enabled ? <div className="grid grid-cols-2 gap-2 p-2.5 max-[1180px]:grid-cols-1">
          {visible.map(field => <label key={`${module.instanceKey}-${field.key}`} className="min-w-0">
            <span className="mb-1 block text-[10px] font-semibold text-muted-foreground">{field.label}</span>
            {field.valueType === 'boolean'
              ? <label className="flex h-8 items-center gap-2 rounded-md border border-input bg-background px-2 text-[10px]"><input type="checkbox" checked={Boolean(values[field.key])} disabled={disabled} onChange={event => updateValue(index, field.key, event.target.checked)} className="accent-primary" /><span>Enabled</span></label>
              : field.valueType === 'select'
                ? <select className="h-8 w-full rounded-md border border-input bg-background px-2 text-[11px] outline-none focus:border-ring" value={String(values[field.key] ?? '')} disabled={disabled} onChange={event => updateValue(index, field.key, event.target.value)}><option value="">Select…</option>{(field.options || []).map(option => <option key={option} value={option}>{titleCase(option)}</option>)}</select>
                : field.valueType === 'text'
                  ? <Input className="h-8 text-[11px]" value={String(values[field.key] ?? '')} disabled={disabled} onChange={event => updateValue(index, field.key, event.target.value)} />
                  : <CarezNumberField value={String(values[field.key] ?? '')} onChange={event => updateValue(index, field.key, event.target.value === '' ? '' : Number(event.target.value))} unit={field.unit} min={field.minimum} max={field.maximum} step={field.valueType === 'integer' ? 1 : 'any'} disabled={disabled} />}
          </label>)}
        </div> : <div className="px-3 py-2 text-[10px] text-muted-foreground">Excluded from this Condition.</div>}
      </section>;
    })}

    {schema.repeatable ? <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-dashed border-border bg-muted/10 p-2">
      <span className="mr-1 text-[10px] font-semibold text-muted-foreground">Add {schema.label.toLowerCase()}</span>
      {(presets.length ? presets : [{ label: schema.label, values: {} }]).map(preset => <Button key={preset.label} type="button" size="sm" variant="outline" className="h-7 text-[10px]" disabled={disabled} onClick={() => add(preset.values, `${schema.label} ${indexes.length + 1}`)}><Plus />{preset.label}</Button>)}
    </div> : null}
  </div>;
}
