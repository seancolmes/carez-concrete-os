export type LegacyMigrationClassification =
  | 'mapped'
  | 'historical_only'
  | 'unsupported_review'
  | 'unreferenced';

export type LegacyMigrationStatus =
  | 'pending'
  | 'exact'
  | 'held'
  | 'mismatch'
  | 'skipped'
  | 'error';

export type LegacyMigrationCandidateFacts = {
  referencedByIssuedHistory: boolean;
  activeMeasurementRefs: number;
  templateMappingCount: number;
  supportedPilotFamily: boolean;
};

export function classifyLegacyMigrationCandidate(
  input: LegacyMigrationCandidateFacts,
): LegacyMigrationClassification {
  if (input.referencedByIssuedHistory) return 'historical_only';
  if (
    input.activeMeasurementRefs > 0
    && input.supportedPilotFamily
    && input.templateMappingCount > 0
  ) return 'mapped';
  if (input.activeMeasurementRefs > 0) return 'unsupported_review';
  return 'unreferenced';
}
