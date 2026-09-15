import type { ConditionArchetypeKey, ConditionRawInputGroups, ConditionInputProvenance } from '../types.ts';

export type Derived3DPlanPoint = { x: number; z: number };
export type Derived3DBoxShape = { kind: 'box'; centerX: number; centerZ: number; width: number; length: number; yawRad: number; bottom: number; top: number };
export type Derived3DPrismShape = { kind: 'prism'; outer: Derived3DPlanPoint[]; holes: Derived3DPlanPoint[][]; bottom: number; top: number; topOuter?: Derived3DPlanPoint[] };
export type Derived3DShape = Derived3DBoxShape | Derived3DPrismShape;
export type Derived3DSourceReference = {
  conditionId: string; conditionVersionId: string; measurementId: string; roleKey: string; roleInstanceKey: string;
  templateVersionId: string | null; archetypeVersionId: string | null; measurementRevision: string | null;
  conditionRevision: string | null; sheetId: string; sheetRevision: string | null; calibrationKey: string;
};
export type Derived3DSolid = Derived3DSourceReference & {
  id: string; geometryKey: string; conditionCode: string; conditionName: string; archetypeKey: ConditionArchetypeKey;
  measurementName: string; zone: string | null; color: string; sourceQuantityKey: string; shape: Derived3DShape;
};
export type Derived3DIssueCode = '3d_input_required' | 'invalid_geometry' | 'cutout_inconsistency' | 'potential_overlap' | 'geometric_overlap' | 'duplicate_placement' | 'unsupported_projection' | 'quantity_mismatch' | 'check_limit';
export type Derived3DIssue = {
  id: string; code: Derived3DIssueCode; severity: 'hold' | 'warning'; conditionVersionId: string;
  measurementId: string | null; sheetId: string | null; message: string; relatedSolidIds?: string[];
  target?: 'general' | 'drawing' | 'concrete'; sourceKey?: string;
};
export type Derived3DQuantityReference = { measurementId: string; value: number; unit: string; revision: string | null };
export type Derived3DScene = {
  hash: string; scopeKey: string; solids: Derived3DSolid[]; issues: Derived3DIssue[];
  sourceQuantities: Record<string, Derived3DQuantityReference>;
  coverage: { requested: number; projected: number; held: number; checksComplete: boolean };
  state: 'saved' | 'preview';
  unavailable?: boolean;
};
export type Derived3DConditionSource = {
  conditionId: string; conditionVersionId: string; code: string; name: string; archetypeKey: ConditionArchetypeKey;
  contractVersion?: number; engineKey?: string; templateVersionId?: string; archetypeVersionId?: string; updatedAt?: string;
  color: string; planFacts: Record<string, unknown>; drawingInputs: Record<string, unknown>;
  concreteProfile?: { enabled: boolean; profile: unknown; topWidthFt: unknown };
  provenance?: ConditionInputProvenance;
  roles: Array<{ roleKey: string; measurementId: string; roleInstanceKey?: string }>;
};
export type Derived3DMeasurementSource = {
  id: string; sheet_id: string | null; name: string; location?: string | null; raw_quantity: number | string; raw_unit: string;
  geometry: unknown; calibration?: unknown; updated_at?: string; geometry_anchor?: string | null; geometry_offset_in?: number | string | null;
  sourceIssue?: string; calibrationKey?: string;
};
export type Derived3DSheetSource = { id: string; page_width: number | string | null; page_height: number | string | null; calibration: unknown; revision?: string | null };
export type BuildDerived3DSceneInput = { scopeKey?: string; conditions: Derived3DConditionSource[]; measurements: Derived3DMeasurementSource[]; sheets: Derived3DSheetSource[]; state?: 'saved' | 'preview' };
export type Derived3DInputResolution = { companyDefaults?: ConditionRawInputGroups; companyProvenance?: ConditionInputProvenance; projectValues?: ConditionRawInputGroups; projectProvenance?: ConditionInputProvenance };

// Display buffers only. This cache is never serialized or used for quantity persistence.
export type Derived3DGeometryCache = Map<string, { key: string; shape: Derived3DShape }>;
