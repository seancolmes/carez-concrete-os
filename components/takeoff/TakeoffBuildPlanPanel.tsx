'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ClipboardCheck, RefreshCw, Save, ShieldCheck } from 'lucide-react';
import { createTakeoffScopeVariant } from '@/app/takeoff/[setId]/scopeVariantActions';
import { enumOptions, isAssemblyVariableActive } from '@/lib/takeoff/assemblyContext';
import styles from './TakeoffBuildPlanPanel.module.css';

type Props = {
  takeoffSetId: string;
  assembly: any;
  version: any;
  variables: any[];
  profiles: any[];
  values: Record<string, string>;
  selectedProfileId: string | null;
  locked: boolean;
  onValuesChange: (values: Record<string, string>) => void;
  onProfileChange: (profileId: string | null) => void;
  onMessage: (message: string) => void;
};

const roleGroups = [
  { role: 'plan_fact', label: 'Plan variables', help: 'Dimensions and requirements from this detail.' },
  { role: 'method_decision', label: 'Build method', help: 'How this scope will be built on this job.' },
  { role: 'production_assumption', label: 'Production', help: 'Estimator-approved MH/unit and production assumptions.' },
  { role: 'commercial_assumption', label: 'Allowances', help: 'Waste and other job-specific estimating allowances.' },
] as const;

function normalized(value: unknown) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

function typedValue(variable: any, value: string) {
  if (variable.value_type === 'boolean') return value === 'true';
  if (['number', 'dimension', 'percentage'].includes(variable.value_type)) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
  return value;
}

function profileMatchesValues(profile: any, activeRows: any[], requiredVerification: any[], values: Record<string, string>) {
  if (!profile) return false;
  const keys = profile.profile_kind === 'scope_variant'
    ? Object.keys(profile.method_inputs || {})
    : requiredVerification.map(variable => variable.variable_key);
  return keys.every(key => normalized(profile.method_inputs?.[key]) === normalized(values[key]));
}

function InputControl({ variable, value, disabled, onChange }: { variable: any; value: string; disabled: boolean; onChange: (value: string) => void }) {
  return <label className={styles.field}>
    <span>{variable.label}{variable.required ? ' *' : ''}{variable.requires_verification && <em>VERIFY</em>}</span>
    {variable.value_type === 'boolean' ? <label className={styles.checkRow}>
      <input type="checkbox" checked={value === 'true'} disabled={disabled} onChange={event => onChange(event.target.checked ? 'true' : 'false')} />
      <b>{value === 'true' ? 'Yes' : 'No'}</b>
    </label> : variable.value_type === 'enum' ? <select value={value ?? ''} disabled={disabled} onChange={event => onChange(event.target.value)}>
      <option value="">Select…</option>
      {enumOptions(variable.options).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select> : <div className={styles.inputUnit}>
      <input
        type={['number', 'dimension', 'percentage'].includes(variable.value_type) ? 'number' : 'text'}
        step="any"
        min={variable.min_value ?? undefined}
        max={variable.max_value ?? undefined}
        value={value ?? ''}
        disabled={disabled}
        onChange={event => onChange(event.target.value)}
      />
      {variable.unit && <b>{variable.unit}</b>}
    </div>}
    {variable.help_text && <small>{variable.help_text}</small>}
  </label>;
}

export function TakeoffBuildPlanPanel({
  takeoffSetId, assembly, version, variables, profiles, values, selectedProfileId, locked,
  onValuesChange, onProfileChange, onMessage,
}: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [variantCode, setVariantCode] = useState('');
  const [variantName, setVariantName] = useState('');

  const rows = useMemo(
    () => variables.filter(variable => variable.assembly_version_id === version?.id && !['legacy', 'derived'].includes(variable.input_role || 'legacy')),
    [variables, version?.id],
  );
  const activeRows = useMemo(() => rows.filter(variable => isAssemblyVariableActive(variable, values)), [rows, values]);
  const requiredVerification = useMemo(
    () => activeRows.filter(variable => variable.requires_verification && ['method_decision', 'production_assumption', 'commercial_assumption'].includes(variable.input_role)),
    [activeRows],
  );
  const versionProfiles = useMemo(
    () => profiles.filter(profile => profile.assembly_version_id === version?.id && profile.status === 'verified'),
    [profiles, version?.id],
  );
  const selectedProfile = versionProfiles.find(profile => profile.id === selectedProfileId) || null;
  const profileMatches = profileMatchesValues(selectedProfile, activeRows, requiredVerification, values);
  const missingRequired = activeRows.filter(variable => variable.required && !String(values[variable.variable_key] ?? '').trim());
  const scopeVariants = versionProfiles.filter(profile => profile.profile_kind === 'scope_variant');
  const legacyMethods = versionProfiles.filter(profile => profile.profile_kind !== 'scope_variant');

  if (!rows.length) return null;

  const chooseProfile = (profileId: string) => {
    const profile = versionProfiles.find(entry => entry.id === profileId) || null;
    onProfileChange(profile?.id || null);
    if (!profile) return;
    const next = { ...values };
    for (const [key, value] of Object.entries(profile.method_inputs || {})) next[key] = normalized(value);
    onValuesChange(next);
    onMessage(profile.profile_kind === 'scope_variant'
      ? `Using Project Scope Variant ${profile.variant_code || profile.name}`
      : `Using legacy verified build method: ${profile.name}`);
  };

  const saveVariant = async () => {
    const code = variantCode.trim().toUpperCase();
    if (saving || locked || missingRequired.length || !code) return;
    const inputs: Record<string, unknown> = {};
    for (const variable of activeRows) {
      const raw = values[variable.variable_key];
      if (raw === '' || raw === undefined) continue;
      inputs[variable.variable_key] = typedValue(variable, raw);
    }
    setSaving(true);
    try {
      const result = await createTakeoffScopeVariant({
        takeoffSetId,
        assemblyVersionId: version.id,
        variantCode: code,
        name: variantName.trim() || `${code} · ${assembly?.name || 'Scope'}`,
        inputs,
      });
      onProfileChange(result.id);
      setVariantCode('');
      setVariantName('');
      onMessage(`Project Scope Variant ${result.variant_code || code} saved · revision ${result.revision_no}`);
      router.refresh();
    } catch (error: any) {
      onMessage(error?.message || 'Could not save the Project Scope Variant.');
    } finally {
      setSaving(false);
    }
  };

  return <div className={styles.panel}>
    <div className={styles.header}>
      <div><div className={styles.kicker}>PROJECT SCOPE VARIANT</div><strong>{assembly?.name || 'Concrete scope'}</strong></div>
      <span className={`${styles.state} ${profileMatches ? styles.verified : styles.unverified}`}>
        {profileMatches ? <ShieldCheck size={14}/> : <ClipboardCheck size={14}/>} {profileMatches ? (selectedProfile?.profile_kind === 'scope_variant' ? 'VARIANT ACTIVE' : 'LEGACY METHOD') : missingRequired.length ? 'INPUTS REQUIRED' : 'CUSTOM INPUTS'}
      </span>
    </div>

    {(versionProfiles.length > 0 || selectedProfileId) && <label className={styles.profilePicker}>
      <span>Project variant</span>
      <select value={selectedProfileId || ''} disabled={locked || saving} onChange={event => chooseProfile(event.target.value)}>
        <option value="">Current inputs — unsaved variant</option>
        {scopeVariants.length > 0 && <optgroup label="Project Scope Variants">
          {scopeVariants.map(profile => <option key={profile.id} value={profile.id}>{profile.variant_code || 'VAR'} · R{profile.revision_no} · {profile.name}</option>)}
        </optgroup>}
        {legacyMethods.length > 0 && <optgroup label="Legacy verified methods">
          {legacyMethods.map(profile => <option key={profile.id} value={profile.id}>R{profile.revision_no} · {profile.name}</option>)}
        </optgroup>}
      </select>
    </label>}

    {roleGroups.map(group => {
      const groupRows = activeRows.filter(variable => variable.input_role === group.role);
      if (!groupRows.length) return null;
      return <section className={styles.group} key={group.role}>
        <div className={styles.groupHeader}><strong>{group.label}</strong><span>{group.help}</span></div>
        <div className={styles.grid}>{groupRows.map(variable => <InputControl
          key={variable.id}
          variable={variable}
          value={values[variable.variable_key] ?? ''}
          disabled={locked || saving}
          onChange={value => {
            onValuesChange({ ...values, [variable.variable_key]: value });
            onProfileChange(null);
          }}
        />)}</div>
      </section>;
    })}

    {!locked && <div className={styles.variantCreate}>
      <div className={styles.variantFields}>
        <label><span>Variant code</span><input value={variantCode} onChange={event => setVariantCode(event.target.value.toUpperCase())} placeholder="S1" maxLength={40} /></label>
        <label><span>Name <em>optional</em></span><input value={variantName} onChange={event => setVariantName(event.target.value)} placeholder={`${variantCode || 'S1'} · ${assembly?.name || 'Scope'}`} /></label>
      </div>
      <button type="button" disabled={saving || missingRequired.length > 0 || !variantCode.trim()} onClick={() => void saveVariant()}>
        {saving ? <RefreshCw size={14}/> : <Save size={14}/>} {saving ? 'Saving…' : 'Save variant'}
      </button>
    </div>}

    <div className={styles.verifyBar}>
      <div>
        {profileMatches ? <><CheckCircle2 size={15}/><span><strong>{selectedProfile?.profile_kind === 'scope_variant' ? `${selectedProfile.variant_code} · ${selectedProfile.name}` : selectedProfile?.name}</strong><small>This verified configuration can be reused for new measurements on this Takeoff set.</small></span></> : <><ClipboardCheck size={15}/><span><strong>{missingRequired.length ? `${missingRequired.length} required input${missingRequired.length === 1 ? '' : 's'} missing` : 'Save these inputs as a project variant when they repeat.'}</strong><small>{missingRequired.length ? missingRequired.map(variable => variable.label).join(', ') : 'Example: S1, S2, F1, F2.'}</small></span></>}
      </div>
    </div>
  </div>;
}
