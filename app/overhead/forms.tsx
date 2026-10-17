'use client';

import {useActionState} from 'react';
import {Button, Checkbox, DialogTrigger, Field, Input} from '@fluentui/react-components';
import {updateOverheadItem, updateOverheadPlan} from './actions';
import {initialSaveState, type SaveState} from './save-contract';

function Feedback({state}:{state:SaveState}) {
  if (state.status === 'idle') return null;
  return <p role={state.status==='error'?'alert':'status'} className={state.status==='error'?'text-sm text-destructive':'text-sm text-muted-foreground'}>{state.message}</p>;
}

const inputValue = (value: unknown) => value === null || value === undefined ? '' : String(value);

export function PlanForm({company,requestId}:{company:Record<string,unknown>;requestId:string}) {
  const [state,action,pending]=useActionState(updateOverheadPlan,initialSaveState);
  return <form action={action} className="grid gap-3"><input type="hidden" name="request_id" value={requestId}/><input type="hidden" name="expected_revision" value={String(company.plan_revision??'')}/>
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Target Profit Margin %"><Input appearance="underline" name="target_margin_percent" type="number" min="0" max="80" step="0.1" required defaultValue={inputValue(company.target_margin_percent)}/></Field>
      <Field label="Productive Field Hours We Expect to Sell / Year"><Input appearance="underline" name="planned_productive_hours_annual" type="number" min="1" step="1" required defaultValue={inputValue(company.planned_productive_hours_annual)}/></Field>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="What Owner Needs to Earn / Year"><Input appearance="underline" name="owner_compensation_target_annual" type="number" min="0" step="100" required defaultValue={inputValue(company.owner_compensation_target_annual)}/></Field>
      <Field label="Owner Field Labor Value / Hr"><Input appearance="underline" name="owner_field_rate" type="number" min="0" step="0.01" required defaultValue={inputValue(company.owner_field_rate)}/></Field>
    </div>
    <Field label="Owner Field Hours Expected / Year"><Input appearance="underline" name="owner_planned_field_hours_annual" type="number" min="0" step="1" required defaultValue={inputValue(company.owner_planned_field_hours_annual)}/></Field>
    <Feedback state={state}/>
    <div className="flex flex-wrap justify-end gap-2"><DialogTrigger action="close" disableButtonEnhancement><Button type="button" appearance="secondary">Cancel</Button></DialogTrigger><Button appearance="primary" type="submit" disabled={pending}>Save Business Plan</Button></div>
  </form>;
}

export function ItemForm({item}:{item:{id:string;name:string;frequency:string|null;amount:unknown;business_use_percent:unknown;active:boolean|null;annualText:string}}) {
  const [state,action,pending]=useActionState(updateOverheadItem,initialSaveState);
  return <form action={action} className="grid gap-3">
    <input type="hidden" name="id" value={item.id}/>
    <div><div className="text-sm font-medium">{item.name}</div><div className="mt-1 text-xs text-muted-foreground">{item.frequency} · annual business portion {item.annualText}</div></div>
    <Field label="Amount"><Input appearance="underline" name="amount" type="number" step="0.01" min="0" required defaultValue={inputValue(item.amount)}/></Field>
    <Field label="Business Use %"><Input appearance="underline" name="business_use_percent" type="number" step="1" min="0" max="100" required defaultValue={inputValue(item.business_use_percent)}/></Field>
    <Feedback state={state}/>
    <div className="flex items-center gap-3 md:justify-end"><Checkbox name="active" defaultChecked={item.active===true} label="Active"/><Button appearance="primary" type="submit" size="small" disabled={pending}>Save</Button></div>
  </form>;
}
