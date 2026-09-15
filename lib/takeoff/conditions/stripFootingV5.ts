import { calculateStripFootingV4, STRIP_FOOTING_V4_DEFINITION } from './stripFootingV4.ts';
import type {
  ConditionArchetypeDefinition,
  ConditionCalculation,
  ConditionCalculationRequest,
  ConditionInputDefinition,
  ConditionModuleDefinition,
  ConditionModuleInputDefinition,
  ConditionOutputDefinition,
} from './types.ts';

export const STRIP_FOOTING_V5_CONTRACT_VERSION = 5;
export const STRIP_FOOTING_V5_RESOURCE_MODEL = 'physical_boards_v5';

const moduleInput = (
  key: string,
  label: string,
  valueType: ConditionModuleInputDefinition['valueType'],
  options: Omit<ConditionModuleInputDefinition, 'key' | 'label' | 'valueType'> = {},
): ConditionModuleInputDefinition => ({ key, label, valueType, ...options });

const formsModule = STRIP_FOOTING_V4_DEFINITION.modules?.find(module => module.key === 'forms');
if (!formsModule) throw new Error('Strip Footing v4 Forms module is required by v5.');

const v5FormsModule: ConditionModuleDefinition = {
  ...formsModule,
  inputs: formsModule.inputs.flatMap(field => {
    if (field.key === 'form_material_factor_lf_per_lf') return [];
    if (field.key === 'resource_tracking') {
      return [
        { ...field, label: 'Track form boards' },
        moduleInput('form_resource_model', 'Form resource model', 'select', { options: [STRIP_FOOTING_V5_RESOURCE_MODEL] }),
        moduleInput('form_board_size', 'Form board', 'select', { options: ['2x4', '2x6', '2x8', '2x10', '2x12', 'custom'] }),
        moduleInput('form_board_custom_course_height_in', 'Custom board course height', 'number', { unit: 'IN', minimum: 0.000001 }),
      ];
    }
    return [field];
  }),
};

const v5VerificationInputs: ConditionInputDefinition[] = [
  { key: 'qc_connection_group', label: '3D connection review group', group: 'drawing', valueType: 'text' },
  { key: 'qc_connection_tolerance_ft', label: 'Connection gap tolerance', group: 'drawing', valueType: 'number', unit: 'FT', minimum: 0 },
  { key: 'qc_elevation_group', label: '3D elevation match group', group: 'drawing', valueType: 'text' },
  { key: 'qc_elevation_tolerance_ft', label: 'Elevation match tolerance', group: 'drawing', valueType: 'number', unit: 'FT', minimum: 0 },
  { key: 'qc_support_group', label: '3D support review group', group: 'drawing', valueType: 'text' },
  { key: 'qc_support_tolerance_ft', label: 'Support gap tolerance', group: 'drawing', valueType: 'number', unit: 'FT', minimum: 0 },
];

const outputDefinition = (definition: ConditionOutputDefinition): ConditionOutputDefinition => {
  if (definition.outputKey === 'forms.form_material_lf') {
    // The persisted compatibility algorithm key remains v4 so the existing
    // projection stays stable. Runtime trace identifies the v5 physical-board
    // resource model explicitly.
    return { ...definition, label: 'Form boards — installed' };
  }
  return definition;
};

export const STRIP_FOOTING_V5_DEFINITION: ConditionArchetypeDefinition = {
  ...STRIP_FOOTING_V4_DEFINITION,
  contractVersion: STRIP_FOOTING_V5_CONTRACT_VERSION,
  inputs: [...STRIP_FOOTING_V4_DEFINITION.inputs, ...v5VerificationInputs],
  modules: (STRIP_FOOTING_V4_DEFINITION.modules || []).map(module => module.key === 'forms' ? v5FormsModule : module),
  outputs: STRIP_FOOTING_V4_DEFINITION.outputs.map(outputDefinition),
};

export function calculateStripFootingV5(request: ConditionCalculationRequest): ConditionCalculation {
  const forms = (request.modules || []).find(module => module.moduleKey === 'forms' && (module.instanceKey || 'default') === 'default');
  if (forms?.inputValues?.form_resource_model !== STRIP_FOOTING_V5_RESOURCE_MODEL) {
    throw new Error('Strip Footing v5 requires the physical form-board resource model.');
  }
  return calculateStripFootingV4(request);
}
