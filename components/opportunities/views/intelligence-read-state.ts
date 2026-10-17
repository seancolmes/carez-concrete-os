export const intelligenceReadNames = [
  'pipeline', 'profiles', 'guardrails', 'feedback', 'leveling',
  'scopeItems', 'options', 'winRates', 'leads', 'estimates',
] as const;

export type IntelligenceReadName = typeof intelligenceReadNames[number];
export type IntelligenceRecord = Record<string, any>;
export type IntelligenceRead = {
  data: IntelligenceRecord[] | null;
  error: {message: string; code?: string} | null;
};
export type IntelligenceReads = Record<IntelligenceReadName, IntelligenceRead>;

/** Availability is a read state, not a pursuit or price-comparison decision. */
export function intelligenceReadState(reads: IntelligenceReads) {
  const available = Object.fromEntries(intelligenceReadNames.map(name => [
    name, reads[name].error == null && Array.isArray(reads[name].data),
  ])) as Record<IntelligenceReadName, boolean>;
  const records = Object.fromEntries(intelligenceReadNames.map(name => [
    name, reads[name].data ?? [],
  ])) as Record<IntelligenceReadName, IntelligenceRecord[]>;
  const pipeline = records.pipeline;
  const decided = available.winRates
    ? records.winRates.reduce((sum, row) => sum + Number(row.decided_bids || 0), 0) : null;
  const wins = available.winRates
    ? records.winRates.reduce((sum, row) => sum + Number(row.wins || 0), 0) : null;
  const comparisonAvailable = available.feedback && available.leveling && available.scopeItems;
  return {
    available,
    records,
    activePursuits: available.pipeline
      ? pipeline.filter(row => !['won', 'lost', 'passed'].includes(row.pipeline_stage)).length : null,
    proposalsOut: available.pipeline
      ? pipeline.filter(row => row.pipeline_stage === 'proposal_out').length : null,
    followupsDue: available.pipeline ? pipeline.filter(row => row.needs_follow_up).length : null,
    decided,
    wins,
    choicesAvailable: available.leads && available.estimates,
    comparisonAvailable,
    guardrailComparisonAvailable: available.guardrails && comparisonAvailable,
  };
}

export function intelligenceComparisonState(
  model: ReturnType<typeof intelligenceReadState>,
  levelingRecord: IntelligenceRecord | undefined,
): 'unavailable' | 'missing' | 'ready' | 'needs-scope-check' {
  if (!model.comparisonAvailable) return 'unavailable';
  if (!levelingRecord) return 'missing';
  if (levelingRecord.comparison_ready === true) return 'ready';
  if (levelingRecord.comparison_ready === false) return 'needs-scope-check';
  return 'unavailable';
}
