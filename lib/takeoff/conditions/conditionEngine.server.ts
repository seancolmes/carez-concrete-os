import 'server-only';

// Production callers enter the Concrete Condition calculation path here. The
// pure kernel remains separately importable only so deterministic fixtures can
// run without a database or browser.
export { calculateCondition, roundConditionQuantity } from './calculate.ts';
export { adaptConditionOutputsToLegacy } from './legacyAdapter.ts';
export type {
  LegacyConditionOutputMapping,
  LegacyPreparedConditionOutput,
} from './legacyAdapter.ts';
