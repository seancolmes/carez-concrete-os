'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ClipboardCheck, RefreshCw, ShieldCheck } from 'lucide-react';
import { verifyTakeoffMethodProfile } from '@/app/takeoff/[setId]/actions';
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
  { role: 'plan_fact', label: 'Known From Plans', help: 'Dimensions and scope requirements supplied by the drawings/specifications.' },
  { role: 'method_decision', label: 'How We Build It', help: 'Carez means-and-method decisions that control the physical resource recipe.' },
  { role: 'production_assumption', label: 'Production', help: 'Estimator-reviewed productivity assumptions. These change labor hours, not physical material counts.' },
  { role: 'commercial_assumption', label: 'Material / Commercial', help: 'Waste and commercial assumptions kept separate from geometry and means/methods.' },
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

function methodName(assembly: any, active: any[], values: Record<string, string>) {
  const decisions = active
    .filter(variable => variable.input_role === 'method_decision')
    .map(variable => {
      const value = values[variable.variable_key];
      if (!value) return null;
      if (variable.value_type === 'enum') {
        const option = enumOptions(variable.options).find(entry => entry.value === value);
        return option?.label || value.replaceAll('_', ' ');
      }
      return `${variable.label} ${value}${variable.unit ? ` ${variable.unit}` : ''}`;
    })
    .filter(Boolean)
    .slice(0, 3);
  return `${assembly?.name || 'Build Method'}${decisions.length ? ` — ${decisions.join(' / ')}` : ' — Verified Method'}`;
}

function InputControl({ variable, value, disabled, onChange }: { variable: any; value: string; disabled: boolean; onChange: (value: string) => void }) {
  return <label className={styles.field}>
    <span>{variable.label}{variable.required ? ' *' : ''}{variable.requires_verification && <em>VERIFY</em>}</span>
    {variable.value_type === 'boolean' ? <label className={styles.checkRow}>
      <input type="checkbox" checked={value === 'true'} disabled={disabled} onChange={event => onChange(event.target.checked ? 'true' : 'false')} />
      <b>{value === 'true' ? 'Enabled' : 'Disabled'}</b>
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
  takeoffSetId,
  assembly,
  version,
  variables,
  profiles,
  values,
  selectedProfileId,
  locked,
  onValuesChange,
  onProfileChange,
  onMessage,
}: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
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
  const profileMatches = Boolean(selectedProfile) && requiredVerification.every(variable =>
    normalized(selectedProfile.method_inputs?.[variable.variable_key]) === normalized(values[variable.variable_key]),
  );
  const missingRequired = requiredVerification.filter(variable => !String(values[variable.variable_key] ?? '').trim());
  const needsVerification = requiredVerification.length > 0;

  if (!rows.length) return null;

  const chooseProfile = (profileId: string) => {
    const profile = versionProfiles.find(entry => entry.id === profileId) || null;
    onProfileChange(profile?.id || null);
    if (!profile) return;
    const next = { ...values };
    for (const [key, value] of Object.entries(profile.method_inputs || {})) next[key] = normalized(value);
    onValuesChange(next);
    onMessage(`Using verified build method: ${profile.name}`);
  };

  const verifyCurrent = async () => {
    if (saving || locked || missingRequired.length) return;
    const methodInputs: Record<string, unknown> = {};
    for (const variable of activeRows) {
      if (!['method_decision', 'production_assumption', 'commercial_assumption'].includes(variable.input_role)) continue;
      const raw = values[variable.variable_key];
      if (raw === '' || raw === undefined) continue;
      methodInputs[variable.variable_key] = typedValue(variable, raw);
    }
    setSaving(true);
    try {
      const result = await verifyTakeoffMethodProfile({
        takeoffSetId,
        assemblyVersionId: version.id,
        name: methodName(assembly, activeRows, values),
        methodInputs,
      });
      onProfileChange(result.id);
      onMessage(`Build method verified · revision ${result.revisionNo}`);
      router.refresh();
    } catch (error: any) {
      onMessage(error?.message || 'Could not verify the build method.');
    } finally {
      setSaving(false);
    }
  };

  return <div className={styles.panel}>
    <div className={styles.header}>
      <div>
        <div className={styles.kicker}>BUILD PLAN</div>
        <strong>Plan facts → means & methods → resources</strong>
        <p>Confirm how Carez will actually build this scope before measuring it.</p>
      </div>
      <span className={`${styles.state} ${!needsVerification || profileMatches ? styles.verified : styles.unverified}`}>
        {!needsVerification || profileMatches ? <ShieldCheck size={14}/> : <ClipboardCheck size={14}/>} {!needsVerification ? 'NO METHOD GATE' : profileMatches ? 'VERIFIED' : 'VERIFY METHOD'}
      </span>
    </div>

    {versionProfiles.length > 0 && <label className={styles.profilePicker}>
      <span>Verified job method</span>
      <select value={selectedProfileId || ''} disabled={locked || saving} onChange={event => chooseProfile(event.target.value)}>
        <option value="">Current inputs — not verified</option>
        {versionProfiles.map(profile => <option key={profile.id} value={profile.id}>R{profile.revision_no} · {profile.name}</option>)}
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
            if (variable.requires_verification) onProfileChange(null);
          }}
        />)}</div>
      </section>;
    })}

    {needsVerification && <div className={styles.verifyBar}>
      <div>
        {profileMatches ? <><CheckCircle2 size={15}/><span><strong>{selectedProfile?.name}</strong><small>Verified assumptions are locked to measurements created with this profile.</small></span></> : <><ClipboardCheck size={15}/><span><strong>{missingRequired.length ? `${missingRequired.length} required assumption${missingRequired.length === 1 ? '' : 's'} missing` : 'Current method is not verified'}</strong><small>{missingRequired.length ? missingRequired.map(variable => variable.label).join(', ') : 'Verify these means/method and production assumptions before drawing.'}</small></span></>}
      </div>
      {!locked && !profileMatches && <button type="button" disabled={saving || missingRequired.length > 0} onClick={() => void verifyCurrent()}>
        {saving ? <RefreshCw size={14}/> : <ShieldCheck size={14}/>} {saving ? 'Verifying…' : 'Verify Method'}
      </button>}
    </div>}
  </div>;
}
