import { calculateStripFootingV3, STRIP_FOOTING_V3_DEFINITION } from './stripFootingV3.ts';
import type {
  ConditionArchetypeDefinition,
  ConditionCalculation,
  ConditionCalculationRequest,
  ConditionHold,
  ConditionMeasurementRole,
  ConditionModuleConfiguration,
  ConditionModuleDefinition,
  ConditionModuleInputDefinition,
  ConditionOutput,
  ConditionOutputDefinition,
  ConditionTraceValue,
} from './types.ts';

export const STRIP_FOOTING_V4_CONTRACT_VERSION = 4;
export const STRIP_FOOTING_V4_ENDPOINT_ROLE = '__run_endpoints';

const moduleInput = (
  key: string,
  label: string,
  valueType: ConditionModuleInputDefinition['valueType'],
  options: Omit<ConditionModuleInputDefinition, 'key' | 'label' | 'valueType'> = {},
): ConditionModuleInputDefinition => ({ key, label, valueType, ...options });

const formsModule = STRIP_FOOTING_V3_DEFINITION.modules?.find(module => module.key === 'forms');
if (!formsModule) throw new Error('Strip Footing v3 Forms module is required by v4.');

const v4FormsModule: ConditionModuleDefinition = {
  ...formsModule,
  inputs: formsModule.inputs.flatMap(field => field.key === 'formed_sides'
    ? [
        field,
        moduleInput('bulkhead_count_source', 'End bulkheads / pour stops', 'select', { options: ['run_endpoints', 'explicit_count', 'none'] }),
        moduleInput('bulkhead_explicit_count', 'Explicit bulkhead count', 'integer', { unit: 'EA', minimum: 0 }),
      ]
    : [field]),
};

const outputDefinition = (definition: ConditionOutputDefinition): ConditionOutputDefinition => {
  if (definition.outputKey === 'forms.end_contact_sf') {
    return { ...definition, label: 'End bulkhead contact area', algorithm: 'strip-end-bulkhead-v4' };
  }
  if (definition.outputKey === 'forms.form_material_lf') {
    return { ...definition, algorithm: 'strip-form-material-v4' };
  }
  return definition;
};

export const STRIP_FOOTING_V4_DEFINITION: ConditionArchetypeDefinition = {
  ...STRIP_FOOTING_V3_DEFINITION,
  contractVersion: STRIP_FOOTING_V4_CONTRACT_VERSION,
  roles: STRIP_FOOTING_V3_DEFINITION.roles.filter(role => role.key !== 'end_forms'),
  modules: (STRIP_FOOTING_V3_DEFINITION.modules || []).map(module => module.key === 'forms' ? v4FormsModule : module),
  outputs: STRIP_FOOTING_V3_DEFINITION.outputs.map(outputDefinition),
};

type BulkheadResolution = {
  quantity: number | null;
  source: string;
  holds: ConditionHold[];
  measurementRoles: ConditionMeasurementRole[];
  measurementIdAliases: Record<string, string>;
  trace: ConditionTraceValue[];
};

const hold = (key: string, label: string): ConditionHold => ({
  code: 'input_required',
  message: `${label} is required for this output.`,
  requiredInputs: [key],
});

const uniqueHolds = (holds: ConditionHold[]) => {
  const seen = new Set<string>();
  return holds.filter(item => {
    const key = `${item.code}|${item.message}|${(item.requiredInputs || []).join(',')}|${(item.dependencyOutputKeys || []).join(',')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

function defaultFormsModule(request: ConditionCalculationRequest): ConditionModuleConfiguration | undefined {
  return (request.modules || []).find(module => module.moduleKey === 'forms' && (module.instanceKey || 'default') === 'default');
}

const syntheticBulkheadMeasurementId = (measurementId: string) => `__derived_bulkheads__${measurementId}`;

function lineageRole(request: ConditionCalculationRequest, quantity: number) {
  const run = request.measurementRoles.find(role => role.roleKey === 'run');
  if (!run) return { measurementRoles: [] as ConditionMeasurementRole[], measurementIdAliases: {} as Record<string, string> };
  const syntheticId = syntheticBulkheadMeasurementId(run.measurementId);
  return {
    measurementRoles: [{
      roleKey: 'end_forms',
      measurementId: syntheticId,
      sheetId: run.sheetId,
      quantity,
      unit: 'EA',
      geometryType: 'count',
    } satisfies ConditionMeasurementRole],
    measurementIdAliases: { [syntheticId]: run.measurementId },
  };
}

function resolveBulkheads(request: ConditionCalculationRequest): BulkheadResolution {
  const forms = defaultFormsModule(request);
  if (!forms?.enabled) {
    const lineage = lineageRole(request, 0);
    return { quantity: 0, source: 'none', holds: [], ...lineage, trace: [] };
  }

  const source = String(forms.inputValues?.bulkhead_count_source || '').trim();
  const sourceTrace: ConditionTraceValue[] = source ? [{
    key: 'forms.default.bulkhead_count_source',
    value: source,
    mode: forms.inputProvenance?.bulkhead_count_source?.mode,
    sourceLabel: forms.inputProvenance?.bulkhead_count_source?.sourceLabel,
  }] : [];

  if (!source) {
    return {
      quantity: null,
      source,
      holds: [hold('forms.default.bulkhead_count_source', 'End bulkheads / pour stops count source')],
      measurementRoles: [],
      measurementIdAliases: {},
      trace: [],
    };
  }

  if (source === 'none') {
    const lineage = lineageRole(request, 0);
    return { quantity: 0, source, holds: [], ...lineage, trace: sourceTrace };
  }

  if (source === 'explicit_count') {
    const raw = forms.inputValues?.bulkhead_explicit_count;
    if (raw === '' || raw === null || raw === undefined) {
      return {
        quantity: null,
        source,
        holds: [hold('forms.default.bulkhead_explicit_count', 'Explicit bulkhead count')],
        measurementRoles: [],
        measurementIdAliases: {},
        trace: sourceTrace,
      };
    }
    const quantity = Number(raw);
    if (!Number.isFinite(quantity) || quantity < 0 || !Number.isInteger(quantity)) {
      throw new Error('Explicit bulkhead count must be a nonnegative whole number.');
    }
    const lineage = lineageRole(request, quantity);
    return {
      quantity,
      source,
      holds: [],
      ...lineage,
      trace: [...sourceTrace, {
        key: 'forms.default.bulkhead_explicit_count',
        value: quantity,
        mode: forms.inputProvenance?.bulkhead_explicit_count?.mode,
        sourceLabel: forms.inputProvenance?.bulkhead_explicit_count?.sourceLabel,
      }],
    };
  }

  if (source === 'run_endpoints') {
    const endpointFacts = request.measurementRoles.filter(role => role.roleKey === STRIP_FOOTING_V4_ENDPOINT_ROLE);
    if (!endpointFacts.length) {
      return {
        quantity: null,
        source,
        holds: [hold('role.run.geometry.endpoints', 'Footing run endpoint geometry')],
        measurementRoles: [],
        measurementIdAliases: {},
        trace: sourceTrace,
      };
    }
    const quantity = endpointFacts.reduce((sum, role) => sum + Number(role.quantity || 0), 0);
    const measurementIdAliases: Record<string, string> = {};
    const measurementRoles = endpointFacts.map(role => {
      const syntheticId = syntheticBulkheadMeasurementId(role.measurementId);
      measurementIdAliases[syntheticId] = role.measurementId;
      return { ...role, roleKey: 'end_forms', measurementId: syntheticId, unit: 'EA' as const, geometryType: 'count' as const };
    });
    return {
      quantity,
      source,
      holds: [],
      measurementRoles,
      measurementIdAliases,
      trace: [...sourceTrace, { key: 'geometry.run_open_endpoints', value: quantity }],
    };
  }

  throw new Error(`Unsupported end bulkhead count source: ${source}.`);
}

function remapTraceValues(values: ConditionTraceValue[], resolution: BulkheadResolution) {
  let replaced = false;
  const retained = values.filter(value => {
    if (value.key !== 'role.end_forms') return true;
    replaced = true;
    return false;
  });
  return replaced ? [...retained, ...resolution.trace] : retained;
}

function remapMeasurementIds(measurementIds: string[], resolution: BulkheadResolution) {
  return [...new Set(measurementIds.map(id => resolution.measurementIdAliases[id] || id))];
}

function mapOutput(output: ConditionOutput, definition: ConditionOutputDefinition, resolution: BulkheadResolution, formsEnabled: boolean): ConditionOutput {
  const mapped: ConditionOutput = {
    ...output,
    label: definition.label,
    trace: {
      ...output.trace,
      algorithm: definition.algorithm,
      measurementIds: remapMeasurementIds(output.trace.measurementIds, resolution),
      values: remapTraceValues(output.trace.values, resolution),
    },
  };
  const bulkheadDependent = output.outputKey === 'forms.end_contact_sf' || output.outputKey === 'forms.form_material_lf';
  const formLabor = output.outputKey === 'labor.forms_mh';
  if (formsEnabled && resolution.quantity === null && (bulkheadDependent || formLabor) && output.quantityMode !== 'explicit_override') {
    return {
      ...mapped,
      status: 'held',
      quantity: null,
      holds: uniqueHolds([
        ...mapped.holds,
        ...resolution.holds,
        ...(formLabor ? [{
          code: 'input_required' as const,
          message: 'Resolve End bulkheads / pour stops before calculating form labor.',
          dependencyOutputKeys: ['forms.end_contact_sf'],
        }] : []),
      ]),
      trace: { ...mapped.trace, derivedQuantity: null },
    };
  }
  return mapped;
}

export function calculateStripFootingV4(request: ConditionCalculationRequest): ConditionCalculation {
  if (request.archetypeKey !== 'strip_wall_footing') throw new Error('Strip Footing v4 calculator requires strip_wall_footing.');
  if (!request.conditionVersionId.trim()) throw new Error('Condition version ID is required.');
  if (request.measurementRoles.some(role => role.roleKey === 'end_forms')) {
    throw new Error('Strip Footing v4 derives End bulkheads / pour stops from the footing run; persisted end_forms roles are not supported.');
  }

  const resolution = resolveBulkheads(request);
  const v3Request: ConditionCalculationRequest = {
    ...request,
    measurementRoles: [
      ...request.measurementRoles.filter(role => role.roleKey !== STRIP_FOOTING_V4_ENDPOINT_ROLE),
      ...resolution.measurementRoles,
    ],
  };
  const base = calculateStripFootingV3(v3Request);
  const formsEnabled = Boolean(defaultFormsModule(request)?.enabled);
  const definitions = new Map(STRIP_FOOTING_V4_DEFINITION.outputs.map(definition => [definition.outputKey, definition]));

  return {
    archetypeKey: 'strip_wall_footing',
    conditionVersionId: request.conditionVersionId,
    outputs: base.outputs.map(output => {
      const definition = definitions.get(output.outputKey);
      if (!definition) throw new Error(`Strip Footing v4 definition is missing ${output.outputKey}.`);
      return mapOutput(output, definition, resolution, formsEnabled);
    }),
  };
}
