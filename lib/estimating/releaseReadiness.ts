export type ReleaseState = 'not_ready' | 'blocked' | 'review' | 'release_ready';
export type WorkflowState = 'not_ready' | 'review' | 'locked';
export type ReleaseFindingAction = 'pricing' | 'labor' | 'scope' | 'takeoff' | 'proposal_setup' | 'margin';

export type ReleaseFinding = {
  finding_key: string;
  severity: 'blocker' | 'warning';
  category: string;
  title: string;
  detail: string;
  record_id: string | null;
  next_action: ReleaseFindingAction;
};

export type EstimateReleaseReadiness = {
  estimate_id: string;
  workflow_state: WorkflowState;
  release_state: ReleaseState;
  blocker_count: number;
  warning_count: number;
  blockers: ReleaseFinding[];
  warnings: ReleaseFinding[];
  commercial_fingerprint: string;
  warning_fingerprint: string;
  acknowledgement_valid: boolean;
  acknowledgement_id: string | null;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  latest_acknowledgement_id: string | null;
  latest_acknowledged_at: string | null;
};

export function parseEstimateReleaseReadiness(value: unknown): EstimateReleaseReadiness {
  if (!value || typeof value !== 'object') throw new Error('Estimate release readiness is unavailable.');
  const row = value as Partial<EstimateReleaseReadiness>;
  if (!row.estimate_id || !['not_ready', 'blocked', 'review', 'release_ready'].includes(String(row.release_state))) {
    throw new Error('Estimate release readiness response is invalid.');
  }

  return {
    estimate_id: String(row.estimate_id),
    workflow_state: String(row.workflow_state) as WorkflowState,
    release_state: String(row.release_state) as ReleaseState,
    blocker_count: Number(row.blocker_count || 0),
    warning_count: Number(row.warning_count || 0),
    blockers: Array.isArray(row.blockers) ? row.blockers as ReleaseFinding[] : [],
    warnings: Array.isArray(row.warnings) ? row.warnings as ReleaseFinding[] : [],
    commercial_fingerprint: String(row.commercial_fingerprint || ''),
    warning_fingerprint: String(row.warning_fingerprint || ''),
    acknowledgement_valid: Boolean(row.acknowledgement_valid),
    acknowledgement_id: row.acknowledgement_id ? String(row.acknowledgement_id) : null,
    acknowledged_at: row.acknowledged_at ? String(row.acknowledged_at) : null,
    acknowledged_by: row.acknowledged_by ? String(row.acknowledged_by) : null,
    latest_acknowledgement_id: row.latest_acknowledgement_id ? String(row.latest_acknowledgement_id) : null,
    latest_acknowledged_at: row.latest_acknowledged_at ? String(row.latest_acknowledged_at) : null,
  };
}

export function releaseStateLabel(state: ReleaseState) {
  if (state === 'blocked') return 'BLOCKED';
  if (state === 'review') return 'REVIEW REQUIRED';
  if (state === 'release_ready') return 'RELEASE READY';
  return 'NOT READY';
}

export function releaseStateTone(state: ReleaseState): 'danger' | 'warning' | 'success' | 'default' {
  if (state === 'blocked') return 'danger';
  if (state === 'review') return 'warning';
  if (state === 'release_ready') return 'success';
  return 'default';
}
