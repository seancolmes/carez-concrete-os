export const CONDITION_ARCHETYPE_KEYS = [
  'pad_column_footing',
  'strip_wall_footing',
  'slab_on_grade',
] as const;

export type ConditionArchetypeKey = (typeof CONDITION_ARCHETYPE_KEYS)[number];

export const CONDITION_INPUT_GROUPS = [
  'planFacts',
  'methods',
  'production',
  'commercial',
  'drawing',
] as const;

export type ConditionInputGroup = (typeof CONDITION_INPUT_GROUPS)[number];
export type ConditionValueMode = 'platform_default' | 'company_default' | 'project_value' | 'explicit_override';
export type ConditionMeasurementUnit = 'EA' | 'LF' | 'SF';
export type ConditionGeometryType = 'count' | 'polyline' | 'polygon';
export type ConditionModuleKey =
  | 'concrete'
  | 'forms'
  | 'reinforcing'
  | 'anchors_embeds'
  | 'slab_systems'
  | 'labor';

export type ConditionOutputStatus = 'ready' | 'held' | 'inactive';
export type ConditionHoldCode =
  | 'input_required'
  | 'labor_rate_required'
  | 'method_verification_required'
  | 'price_required'
  | 'review_required'
  | '3d_input_required';

export type ConditionResourceClass = 'material' | 'labor' | 'equipment' | 'other';

export type ConditionScalar = number | string | boolean;

export type ConditionValue = {
  value: ConditionScalar;
  mode: ConditionValueMode;
  sourceId?: string;
  sourceLabel?: string;
  note?: string;
};

export type ConditionInputGroups = Partial<Record<ConditionInputGroup, Record<string, ConditionValue>>>;

export type ConditionMeasurementRole = {
  roleKey: string;
  measurementId: string;
  sheetId: string;
  quantity: number;
  unit: ConditionMeasurementUnit;
  geometryType: ConditionGeometryType;
};

export type ConditionModuleSelection = {
  moduleKey: ConditionModuleKey;
  instanceKey?: string;
  enabled: boolean;
};

export type ConditionOutputOverride = {
  quantity: number;
  reason: string;
  sourceLabel?: string;
};

export type ConditionCalculationRequest = {
  archetypeKey: ConditionArchetypeKey;
  conditionVersionId: string;
  inputs?: ConditionInputGroups;
  measurementRoles: ConditionMeasurementRole[];
  modules?: ConditionModuleSelection[];
  outputOverrides?: Record<string, ConditionOutputOverride>;
};

export type ConditionHold = {
  code: ConditionHoldCode;
  message: string;
  requiredInputs?: string[];
  dependencyOutputKeys?: string[];
};

export type ConditionTraceValue = {
  key: string;
  value: ConditionScalar;
  group?: ConditionInputGroup;
  mode?: ConditionValueMode;
  sourceId?: string;
  sourceLabel?: string;
};

export type ConditionOutputTrace = {
  algorithm: string;
  conditionVersionId: string;
  measurementIds: string[];
  values: ConditionTraceValue[];
  derivedQuantity: number | null;
  override?: ConditionOutputOverride;
};

export type ConditionOutput = {
  outputKey: string;
  moduleKey: ConditionModuleKey;
  label: string;
  resourceClass: ConditionResourceClass;
  unit: 'CY' | 'SF' | 'LB' | 'EA' | 'HR';
  status: ConditionOutputStatus;
  quantity: number | null;
  quantityMode: 'derived' | 'explicit_override';
  holds: ConditionHold[];
  trace: ConditionOutputTrace;
  legacyComponentKey: string;
};

export type ConditionCalculation = {
  archetypeKey: ConditionArchetypeKey;
  conditionVersionId: string;
  outputs: ConditionOutput[];
};

export type ConditionInputDefinition = {
  key: string;
  label: string;
  group: ConditionInputGroup;
  valueType: 'number' | 'integer' | 'boolean' | 'text' | 'select';
  unit?: string;
  minimum?: number;
  maximum?: number;
  requiredBy?: string[];
};

export type ConditionRoleDefinition = {
  key: string;
  label: string;
  unit: ConditionMeasurementUnit;
  geometryType: ConditionGeometryType;
  primary: boolean;
  required: boolean;
};

export type ConditionOutputDefinition = {
  outputKey: string;
  moduleKey: ConditionModuleKey;
  label: string;
  resourceClass: ConditionResourceClass;
  unit: ConditionOutput['unit'];
  algorithm: string;
  legacyComponentKey: string;
};

export type ConditionArchetypeDefinition = {
  key: ConditionArchetypeKey;
  name: string;
  primaryUnit: ConditionMeasurementUnit;
  roles: ConditionRoleDefinition[];
  inputs: ConditionInputDefinition[];
  defaultModules: ConditionModuleKey[];
  outputs: ConditionOutputDefinition[];
};
