import 'server-only';

// Production callers enter the Concrete Condition calculation path here. The
// pure kernel remains separately importable only so deterministic fixtures can
// run without a database or browser.
export { calculateCondition, roundConditionQuantity } from './calculate.ts';
export { adaptConditionOutputsToLegacy } from './legacyAdapter.ts';
export {
  assertCompleteConditionMappings,
  buildConditionCommitOutputs,
  resolveConditionInputGroups,
} from './persistence.ts';
export type {
  LegacyConditionOutputMapping,
  LegacyPreparedConditionOutput,
} from './legacyAdapter.ts';
export type { ConditionCommitOutput } from './persistence.ts';
export { prepareConcreteConditionPilotPersistence } from './persistence.server.ts';
