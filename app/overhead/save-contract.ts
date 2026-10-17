export type SaveState = {status: 'idle' | 'saved' | 'error'; message: string};
export const initialSaveState: SaveState = {status: 'idle', message: ''};

export type PlanValues = {
  target_margin_percent: number;
  planned_productive_hours_annual: number;
  owner_compensation_target_annual: number;
  owner_planned_field_hours_annual: number;
  owner_field_rate: number;
};

function requiredNumber(form: FormData, name: string, label: string, min: number, max?: number, step?: number): number {
  const entry = form.get(name);
  if (typeof entry !== 'string' || entry.trim() === '') throw new Error(`${label} is required.`);
  const value = Number(entry);
  if (!Number.isFinite(value) || value < min || (max !== undefined && value > max)) {
    throw new Error(`${label} is outside its allowed range.`);
  }
  if (step !== undefined && Math.abs((value - min) / step - Math.round((value - min) / step)) > 1e-7) {
    throw new Error(`${label} must use the allowed increment.`);
  }
  return value;
}

export function parsePlanValues(form: FormData): PlanValues {
  return {
    target_margin_percent: requiredNumber(form, 'target_margin_percent', 'Target profit margin', 0, 80, 0.1),
    planned_productive_hours_annual: requiredNumber(form, 'planned_productive_hours_annual', 'Productive field hours', 1, undefined, 1),
    owner_compensation_target_annual: requiredNumber(form, 'owner_compensation_target_annual', 'Owner annual earnings', 0, undefined, 100),
    owner_planned_field_hours_annual: requiredNumber(form, 'owner_planned_field_hours_annual', 'Owner field hours', 0, undefined, 1),
    owner_field_rate: requiredNumber(form, 'owner_field_rate', 'Owner field labor value', 0, undefined, 0.01),
  };
}

export function parseItemValues(form: FormData) {
  const id = form.get('id');
  if (typeof id !== 'string' || !id.trim()) throw new Error('Overhead item is required.');
  return {
    id,
    amount: requiredNumber(form, 'amount', 'Amount', 0, undefined, 0.01),
    business_use_percent: requiredNumber(form, 'business_use_percent', 'Business use', 0, 100, 1),
    active: form.get('active') === 'on',
  };
}

export type WriteResult<T> = {data: T | null; error: unknown};
export async function confirmItemUpdate(id: string, update: () => Promise<WriteResult<{id: string}>>): Promise<void> {
  const result = await update();
  if (result.error || result.data?.id !== id) throw new Error('Overhead item was not saved.');
}

export async function persistPlan(companyId:string,values:PlanValues,requestId:string,revision:string,
  save:(args:{p_request_id:string;p_expected_revision:number;p_values:PlanValues})=>Promise<WriteResult<{company_id:string}>>):Promise<void>{
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)||!/^\d+$/.test(revision)||!Number.isSafeInteger(Number(revision)))throw new Error('Reopen the business plan before saving.');
  const result=await save({p_request_id:requestId,p_expected_revision:Number(revision),p_values:values});
  if(result.error||result.data?.company_id!==companyId)throw new Error('Business plan was not saved. No complete atomic update was confirmed.');
}
