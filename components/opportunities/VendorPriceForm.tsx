'use client';

import {useActionState} from 'react';
import {submitVendorPrice,type VendorPriceActionState} from '@/app/vendor-quotes/actions';
import {Button,Input} from '@fluentui/react-components';

const initial:VendorPriceActionState={error:'',success:''};

export function VendorPriceForm({token,output}:{token:string;output:{id:string;unit_cost:number|null;source_reference:string|null}}){
  const [state,action,pending]=useActionState(submitVendorPrice,initial);
  return <form action={action} className="grid gap-2 sm:grid-cols-[minmax(130px,180px)_minmax(160px,1fr)_auto] sm:items-end">
    <input type="hidden" name="token" value={token}/><input type="hidden" name="output_id" value={output.id}/>
    <label className="grid gap-1 text-xs text-[#AAAAAA]">Unit price<Input appearance="underline" name="unit_cost" type="number" min="0" max="1000000000" step="0.0001" required defaultValue={output.unit_cost==null?'':String(output.unit_cost)} className="font-mono"/></label>
    <label className="grid gap-1 text-xs text-[#AAAAAA]">Quote line / mix reference<Input appearance="underline" name="source_reference" maxLength={250} defaultValue={output.source_reference||''}/></label>
    <Button type="submit" appearance="primary" disabled={pending}>{pending?'Saving…':'Save unit price'}</Button>
    {state.error?<p role="alert" className="text-xs text-[#E98B8B] sm:col-span-3">{state.error}</p>:null}
    {state.success?<p role="status" className="text-xs text-[#A7C7AE] sm:col-span-3">{state.success}</p>:null}
  </form>;
}
